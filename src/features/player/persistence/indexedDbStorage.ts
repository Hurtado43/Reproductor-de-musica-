import {
  DB_NAME,
  DB_VERSION,
  LIBRARY_KEY,
  META_STORE,
  SONGS_STORE,
  type RawLibraryData,
  type StoredLibraryRecord,
  type StoredSongRecord,
} from './librarySchema';

export type StorageErrorKind =
  /** IndexedDB no existe o el navegador no permite usarlo (por ejemplo, ciertos modos privados). */
  | 'unavailable'
  /** Otra pestaña mantiene abierta una versión anterior y bloquea la apertura. */
  | 'blocked'
  /** La base guardada es de una versión más reciente. */
  | 'incompatible'
  /** Cuota de almacenamiento agotada. */
  | 'quota'
  /** La transacción se canceló sin aplicar ningún cambio. */
  | 'aborted'
  | 'failed';

export class StorageError extends Error {
  constructor(
    readonly kind: StorageErrorKind,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/** Cambios de una transacción: se aplican todos o ninguno. */
export interface LibraryCommit {
  readonly put: readonly StoredSongRecord[];
  readonly delete: readonly string[];
  readonly library: StoredLibraryRecord;
  /** Copia del registro original, solo en la primera escritura tras una recuperación parcial. */
  readonly backup?: { readonly key: string; readonly original: unknown } | undefined;
}

/** Almacenamiento de la biblioteca (IndexedDB en el navegador; se simula en pruebas). */
export interface LibraryStorage {
  read(): Promise<RawLibraryData>;
  commit(change: LibraryCommit): Promise<void>;
  /** Cierra la conexión cuando no queden operaciones pendientes. */
  close(): void;
}

function toStorageError(error: unknown, fallback: StorageErrorKind = 'failed'): StorageError {
  if (error instanceof StorageError) return error;
  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
  switch (name) {
    case 'QuotaExceededError':
      return new StorageError('quota', 'No queda espacio de almacenamiento en este navegador.', error);
    case 'VersionError':
      return new StorageError('incompatible', 'La biblioteca guardada es de una versión más reciente.', error);
    case 'SecurityError':
    case 'InvalidStateError':
      return new StorageError('unavailable', 'El navegador no permite usar el almacenamiento local.', error);
    case 'AbortError':
      return new StorageError('aborted', 'La operación de guardado se canceló.', error);
    default:
      return new StorageError(fallback, 'No se pudo acceder al almacenamiento local.', error);
  }
}

/**
 * Almacenamiento en IndexedDB (solo navegador).
 *
 * - Abre la base de forma diferida en la primera operación y la reutiliza.
 * - `commit` usa **una** transacción `readwrite` sobre `songs` y `meta`: si algo
 *   falla (cuota, error de una petición), la transacción se aborta y no queda
 *   nada a medias.
 * - `versionchange` (otra pestaña actualiza la base): cierra la conexión para no
 *   bloquearla; la siguiente operación la vuelve a abrir.
 * - `close()` cierra cuando no quedan operaciones en curso.
 */
export class IndexedDbLibraryStorage implements LibraryStorage {
  readonly #factory: IDBFactory | undefined;
  #db: Promise<IDBDatabase> | null = null;
  #active = 0;
  #closeRequested = false;

  constructor(factory: IDBFactory | undefined) {
    this.#factory = factory;
  }

  read(): Promise<RawLibraryData> {
    return this.#run(
      (db) =>
        new Promise<RawLibraryData>((resolve, reject) => {
          const tx = db.transaction([SONGS_STORE, META_STORE], 'readonly');
          const songs = tx.objectStore(SONGS_STORE).getAll();
          const library = tx.objectStore(META_STORE).get(LIBRARY_KEY);
          tx.oncomplete = () => resolve({ songs: songs.result ?? [], library: library.result });
          // Un error de una petición aborta la transacción (no se llama a
          // preventDefault): se informa en onabort.
          tx.onabort = () => reject(toStorageError(tx.error, 'aborted'));
        }),
    );
  }

  commit(change: LibraryCommit): Promise<void> {
    return this.#run(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction([SONGS_STORE, META_STORE], 'readwrite');
          tx.oncomplete = () => resolve();
          tx.onabort = () => reject(toStorageError(tx.error, 'aborted'));
          try {
            const songs = tx.objectStore(SONGS_STORE);
            const meta = tx.objectStore(META_STORE);
            for (const record of change.put) songs.put(record);
            for (const id of change.delete) songs.delete(id);
            if (change.backup) {
              meta.put({ key: change.backup.key, savedAt: Date.now(), original: change.backup.original });
            }
            meta.put(change.library);
          } catch (error) {
            // Por ejemplo, DataCloneError: se cancela todo.
            try {
              tx.abort();
            } catch {
              // Ya abortada.
            }
            reject(toStorageError(error));
          }
        }),
    );
  }

  close(): void {
    this.#closeRequested = true;
    this.#closeIfIdle();
  }

  async #run<T>(operation: (db: IDBDatabase) => Promise<T>): Promise<T> {
    this.#closeRequested = false;
    this.#active++;
    try {
      const db = await this.#open();
      return await operation(db);
    } catch (error) {
      throw toStorageError(error);
    } finally {
      this.#active--;
      this.#closeIfIdle();
    }
  }

  #closeIfIdle(): void {
    if (!this.#closeRequested || this.#active > 0 || !this.#db) return;
    const pending = this.#db;
    this.#db = null;
    pending.then((db) => db.close(), () => {});
  }

  #open(): Promise<IDBDatabase> {
    if (this.#db) return this.#db;
    const factory = this.#factory;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      if (!factory) {
        reject(new StorageError('unavailable', 'Este navegador no tiene IndexedDB.'));
        return;
      }
      let request: IDBOpenDBRequest;
      try {
        request = factory.open(DB_NAME, DB_VERSION);
      } catch (error) {
        reject(toStorageError(error, 'unavailable'));
        return;
      }
      let settled = false;
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SONGS_STORE)) db.createObjectStore(SONGS_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
      };
      request.onsuccess = () => {
        const db = request.result;
        if (settled) {
          // Llegó después de informar el bloqueo: no se usa ni se deja abierta.
          db.close();
          return;
        }
        settled = true;
        db.onversionchange = () => {
          db.close();
          if (this.#db === opening) this.#db = null;
        };
        db.onclose = () => {
          if (this.#db === opening) this.#db = null;
        };
        resolve(db);
      };
      request.onerror = (event) => {
        event.preventDefault();
        if (settled) return;
        settled = true;
        reject(toStorageError(request.error, 'failed'));
      };
      request.onblocked = () => {
        if (settled) return;
        settled = true;
        reject(new StorageError('blocked', 'Otra pestaña está usando una versión anterior de la biblioteca.'));
      };
    });
    this.#db = opening;
    opening.catch(() => {
      if (this.#db === opening) this.#db = null;
    });
    return opening;
  }
}

/** Almacenamiento del navegador (o sin IndexedDB, que fallará con `unavailable`). */
export function createBrowserLibraryStorage(): LibraryStorage {
  let factory: IDBFactory | undefined;
  try {
    factory = typeof indexedDB === 'undefined' ? undefined : indexedDB;
  } catch {
    factory = undefined; // acceder a indexedDB puede lanzar SecurityError
  }
  return new IndexedDbLibraryStorage(factory);
}
