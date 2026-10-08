import type { Song } from '@/domain';
import type { AudioSource } from '../audio/sourceRegistry';
import type { RepeatMode } from '../repeatMode';
import { StorageError, type LibraryCommit, type LibraryStorage } from './indexedDbStorage';
import {
  BACKUP_KEY_PREFIX,
  EMPTY_LIBRARY,
  LIBRARY_KEY,
  SCHEMA_VERSION,
  toStoredSong,
  validateStoredLibrary,
  type RestoredLibrary,
  type StoredLibraryRecord,
} from './librarySchema';

/** Estado de la persistencia que ve el usuario. */
export type PersistenceStatus =
  | { readonly kind: 'restoring' }
  /** Restaurada (o vacía); todavía no hubo cambios que guardar. */
  | { readonly kind: 'ready'; readonly restoredCount: number }
  | { readonly kind: 'saving' }
  /** La última transacción completa terminó. */
  | { readonly kind: 'saved' }
  | { readonly kind: 'error'; readonly message: string; readonly retry: 'save' | 'restore' | null }
  /** Guardado desactivado en esta sesión (sin IndexedDB, versión incompatible…). */
  | { readonly kind: 'off'; readonly message: string };

export interface PersistenceSnapshot {
  readonly status: PersistenceStatus;
  /** Lo que no se pudo recuperar en la última restauración. */
  readonly report: readonly string[];
  /** Crece con cada intento de restauración (para volver a ejecutar el efecto). */
  readonly restoreAttempt: number;
}

/** Estado vigente de la biblioteca que se quiere guardar. */
export interface LibraryState {
  readonly songs: readonly { readonly song: Song; readonly source: AudioSource }[];
  readonly selectedId: string | null;
  readonly volume: number;
  readonly muted: boolean;
  readonly repeatMode: RepeatMode;
  readonly shuffle: boolean;
}

export type RestoreOutcome =
  | { readonly kind: 'restored'; readonly library: RestoredLibrary }
  | { readonly kind: 'failed' };

export interface PersistenceTimers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface PersistenceOptions {
  /** Espera para agrupar cambios de preferencias (volumen, silencio). */
  preferenceDelayMs?: number;
  timers?: PersistenceTimers;
  now?: () => number;
}

const LOSS_WARNING = 'Los cambios de esta sesión podrían perderse al recargar.';

function describe(error: unknown): { message: string; retry: boolean } {
  const kind = error instanceof StorageError ? error.kind : 'failed';
  switch (kind) {
    case 'quota':
      return { message: `No queda espacio de almacenamiento para guardar. ${LOSS_WARNING}`, retry: true };
    case 'blocked':
      return {
        message: `Otra pestaña con una versión anterior bloquea el almacenamiento; ciérrala y reintenta. ${LOSS_WARNING}`,
        retry: true,
      };
    case 'incompatible':
      return {
        message: 'La biblioteca guardada es de una versión más reciente de la aplicación. Los cambios de esta sesión no se guardarán.',
        retry: false,
      };
    case 'unavailable':
      return {
        message: 'Este navegador no permite guardar la biblioteca (almacenamiento local no disponible). Los cambios se perderán al recargar.',
        retry: false,
      };
    case 'aborted':
      return { message: `No se pudo guardar (operación cancelada). ${LOSS_WARNING}`, retry: true };
    default:
      return { message: `No se pudo guardar. ${LOSS_WARNING}`, retry: true };
  }
}

interface CommittedState {
  readonly order: readonly string[];
  readonly selectedId: string | null;
  readonly volume: number;
  readonly muted: boolean;
  readonly repeatMode: RepeatMode;
  readonly shuffle: boolean;
}

/**
 * Persistencia de la biblioteca (capa cliente, sin React).
 *
 * Restauración
 * - `restore()` lee y valida una sola vez (la promesa se reutiliza, así Strict
 *   Mode no restaura dos veces). Hasta que termina, no se guarda nada: el estado
 *   vacío inicial nunca sobrescribe lo guardado.
 *
 * Guardado
 * - `requestSave(state)` recibe el estado vigente completo. Los cambios de
 *   playlist se guardan enseguida; los de preferencias se agrupan
 *   (`preferenceDelayMs`).
 * - Una sola transacción en curso. Lo que llega mientras tanto se acumula y se
 *   escribe después con el estado **más reciente**: una escritura antigua nunca
 *   sobrescribe un estado nuevo, y las escrituras no se cruzan.
 * - Cada transacción escribe solo lo necesario: los MP3 nuevos, las bajas y el
 *   registro `library` (orden, selección, volumen, silencio). Cambiar la
 *   selección o el volumen no vuelve a escribir los MP3.
 * - Si falla, el estado en memoria sigue intacto, el estado conocido en disco no
 *   cambia y se muestra un error. Reintentar (o el siguiente cambio) guarda el
 *   estado vigente.
 */
export class LibraryPersistence {
  readonly #storage: LibraryStorage;
  readonly #timers: PersistenceTimers;
  readonly #now: () => number;
  readonly #preferenceDelayMs: number;
  #snapshot: PersistenceSnapshot = { status: { kind: 'restoring' }, report: [], restoreAttempt: 0 };
  readonly #listeners = new Set<() => void>();

  #restorePromise: Promise<RestoreOutcome> | null = null;
  #canSave = false;
  /** Fallo de restauración: no se puede guardar sin sobrescribir datos que no se leyeron. */
  #restoreFailed = false;
  #persistedIds = new Set<string>();
  #committed: CommittedState | null = null;
  #revision = 0;
  #pendingBackup: { key: string; original: unknown } | undefined;

  #latest: LibraryState | null = null;
  #timer: unknown = null;
  #inFlight: Promise<void> | null = null;
  #queued = false;

  constructor(storage: LibraryStorage, options: PersistenceOptions = {}) {
    this.#storage = storage;
    this.#timers = options.timers ?? {
      setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
      clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
    };
    this.#now = options.now ?? Date.now;
    this.#preferenceDelayMs = options.preferenceDelayMs ?? 400;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readonly getSnapshot = (): PersistenceSnapshot => this.#snapshot;

  /** `true` si la restauración terminó y las operaciones pueden continuar. */
  get restoring(): boolean {
    return this.#snapshot.status.kind === 'restoring';
  }

  /** Lee y valida la biblioteca una sola vez por intento. Nunca rechaza. */
  restore(): Promise<RestoreOutcome> {
    this.#restorePromise ??= this.#doRestore();
    return this.#restorePromise;
  }

  /** Nuevo intento de restauración tras un fallo (solo si la sesión sigue vacía). */
  retryRestore(): void {
    if (!this.#restoreFailed) return;
    this.#restoreFailed = false;
    this.#restorePromise = null;
    this.#set({ status: { kind: 'restoring' }, restoreAttempt: this.#snapshot.restoreAttempt + 1 });
  }

  /**
   * Pide guardar `state` (el estado vigente).
   * @param options.preferences `true` si solo cambiaron preferencias (volumen, silencio, repetición, aleatorio): se agrupa.
   */
  requestSave(state: LibraryState, { preferences = false }: { preferences?: boolean } = {}): void {
    if (this.#restoreFailed) {
      // Hubo cambios sin haber podido leer lo guardado: no se escribe encima.
      if (state.songs.length > 0 && this.#snapshot.status.kind === 'error') {
        this.#set({
          status: {
            kind: 'off',
            message: 'No se pudo leer la biblioteca guardada: los cambios de esta sesión no se guardarán.',
          },
        });
      }
      return;
    }
    if (!this.#canSave) return;
    this.#latest = state;
    if (preferences) {
      this.#clearTimer();
      this.#timer = this.#timers.setTimeout(() => {
        this.#timer = null;
        void this.#flush();
      }, this.#preferenceDelayMs);
    } else {
      this.#clearTimer();
      void this.#flush();
    }
  }

  /** Reintenta el último guardado fallido con el estado vigente. */
  retrySave(): void {
    const status = this.#snapshot.status;
    if (status.kind !== 'error' || status.retry !== 'save') return;
    void this.#flush();
  }

  /**
   * Libera recursos (desmontaje): guarda enseguida lo pendiente de agrupar y
   * cierra la conexión cuando no quedan transacciones. La instancia puede volver
   * a usarse (Strict Mode): la conexión se reabre en la siguiente operación.
   */
  dispose(): void {
    if (this.#timer !== null) {
      this.#clearTimer();
      void this.#flush();
    }
    this.#storage.close();
  }

  /** Promesa de la transacción en curso (para pruebas). */
  get idle(): Promise<void> {
    return (this.#inFlight ?? Promise.resolve()).then(() => undefined);
  }

  // ---------- Interno ----------

  async #doRestore(): Promise<RestoreOutcome> {
    this.#canSave = false;
    try {
      const raw = await this.#storage.read();
      const result = validateStoredLibrary(raw);
      if (result.kind === 'incompatible') {
        this.#set({ status: { kind: 'off', message: result.message }, report: [] });
        return { kind: 'restored', library: EMPTY_LIBRARY };
      }
      const library = result.library;
      this.#persistedIds = new Set(library.entries.map((e) => e.song.id));
      this.#revision = library.revision;
      if (library.problems.length > 0) {
        // Los datos originales no se borran: se guarda una copia del registro
        // `library` antes de reescribirlo, y las canciones inválidas no se tocan.
        this.#committed = null; // obliga a reescribir el registro reparado
        this.#pendingBackup =
          library.originalLibrary === undefined
            ? undefined
            : { key: `${BACKUP_KEY_PREFIX}${this.#now()}`, original: library.originalLibrary };
      } else {
        this.#committed = {
          order: library.entries.map((e) => e.song.id),
          selectedId: library.selectedId,
          volume: library.volume,
          muted: library.muted,
          repeatMode: library.repeatMode,
          shuffle: library.shuffle,
        };
      }
      this.#canSave = true;
      this.#set({ status: { kind: 'ready', restoredCount: library.entries.length }, report: library.problems });
      return { kind: 'restored', library };
    } catch (error) {
      const { message, retry } = describe(error);
      if (error instanceof StorageError && (error.kind === 'unavailable' || error.kind === 'incompatible')) {
        // Sin almacenamiento utilizable: la sesión funciona solo en memoria.
        this.#set({ status: { kind: 'off', message } });
        return { kind: 'restored', library: EMPTY_LIBRARY };
      }
      this.#restoreFailed = true;
      this.#set({
        status: {
          kind: 'error',
          message: `No se pudo leer la biblioteca guardada. ${message}`,
          retry: retry ? 'restore' : null,
        },
      });
      return { kind: 'failed' };
    }
  }

  async #flush(): Promise<void> {
    this.#clearTimer();
    if (this.#inFlight) {
      this.#queued = true;
      return;
    }
    const state = this.#latest;
    if (!state || !this.#canSave) return;

    const order = state.songs.map((s) => s.song.id);
    const current = new Set(order);
    const put = state.songs
      .filter((s) => !this.#persistedIds.has(s.song.id))
      .map((s) => toStoredSong(s.song, s.source, this.#now()));
    const remove = [...this.#persistedIds].filter((id) => !current.has(id));
    const committed = this.#committed;
    const unchanged =
      put.length === 0 &&
      remove.length === 0 &&
      committed !== null &&
      committed.selectedId === state.selectedId &&
      committed.volume === state.volume &&
      committed.muted === state.muted &&
      committed.repeatMode === state.repeatMode &&
      committed.shuffle === state.shuffle &&
      committed.order.length === order.length &&
      committed.order.every((id, i) => id === order[i]);
    if (unchanged) {
      if (this.#snapshot.status.kind === 'error') this.#set({ status: { kind: 'saved' } });
      return;
    }

    const library: StoredLibraryRecord = {
      key: LIBRARY_KEY,
      schemaVersion: SCHEMA_VERSION,
      order,
      selectedId: state.selectedId,
      volume: state.volume,
      muted: state.muted,
      repeatMode: state.repeatMode,
      shuffle: state.shuffle,
      revision: this.#revision + 1,
      savedAt: this.#now(),
    };
    const change: LibraryCommit = { put, delete: remove, library, backup: this.#pendingBackup };

    this.#set({ status: { kind: 'saving' } });
    let ok = false;
    const run = this.#storage.commit(change).then(
      () => {
        ok = true;
        this.#revision = library.revision;
        this.#persistedIds = current;
        this.#committed = {
          order,
          selectedId: state.selectedId,
          volume: state.volume,
          muted: state.muted,
          repeatMode: state.repeatMode,
          shuffle: state.shuffle,
        };
        this.#pendingBackup = undefined;
      },
      (error: unknown) => {
        const { message, retry } = describe(error);
        if (error instanceof StorageError && error.kind === 'incompatible') this.#canSave = false;
        this.#queued = false;
        this.#set({ status: { kind: 'error', message, retry: retry ? 'save' : null } });
      },
    );
    this.#inFlight = run;
    await run;
    this.#inFlight = null;
    if (!ok) return;
    if (this.#queued || this.#latest !== state) {
      this.#queued = false;
      await this.#flush();
    } else {
      this.#set({ status: { kind: 'saved' } });
    }
  }

  #clearTimer(): void {
    if (this.#timer === null) return;
    this.#timers.clearTimeout(this.#timer);
    this.#timer = null;
  }

  #set(patch: Partial<PersistenceSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...patch };
    for (const listener of this.#listeners) listener();
  }
}
