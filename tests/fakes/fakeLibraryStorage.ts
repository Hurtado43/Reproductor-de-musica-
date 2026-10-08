import {
  StorageError,
  type LibraryCommit,
  type LibraryStorage,
  type StorageErrorKind,
} from '../../src/features/player/persistence/indexedDbStorage';
import type { RawLibraryData } from '../../src/features/player/persistence/librarySchema';

/*
 * Almacenamiento de la biblioteca SIMULADO, en memoria (no es IndexedDB).
 * Imita lo que importa del adaptador real:
 * - `commit` es todo o nada: si falla, no cambia nada.
 * - Se pueden programar fallos (`failNext`), dejar operaciones pendientes
 *   (`holdCommits`, `holdRead`) y registrar cada transacción (`commits`).
 */

export class FakeLibraryStorage implements LibraryStorage {
  readonly songs = new Map<string, Record<string, unknown>>();
  readonly meta = new Map<string, Record<string, unknown>>();
  readonly commits: LibraryCommit[] = [];
  reads = 0;
  closes = 0;
  #failures: StorageErrorKind[] = [];
  #readFailure: StorageErrorKind | null = null;
  holdCommits = false;
  holdRead = false;
  readonly heldCommits: { resolve(): void; reject(e: unknown): void; change: LibraryCommit }[] = [];
  #heldRead: (() => void) | null = null;

  failNext(kind: StorageErrorKind): void {
    this.#failures.push(kind);
  }

  failRead(kind: StorageErrorKind | null): void {
    this.#readFailure = kind;
  }

  read(): Promise<RawLibraryData> {
    this.reads++;
    const run = () => {
      if (this.#readFailure) throw new StorageError(this.#readFailure, `fallo simulado: ${this.#readFailure}`);
      return { songs: [...this.songs.values()].map((s) => ({ ...s })), library: this.meta.get('library') };
    };
    if (!this.holdRead) return Promise.resolve().then(run);
    return new Promise((resolve, reject) => {
      this.#heldRead = () => {
        try {
          resolve(run());
        } catch (e) {
          reject(e);
        }
      };
    });
  }

  releaseRead(): void {
    const release = this.#heldRead;
    this.#heldRead = null;
    release?.();
  }

  commit(change: LibraryCommit): Promise<void> {
    const apply = () => {
      const failure = this.#failures.shift();
      if (failure) throw new StorageError(failure, `fallo simulado: ${failure}`);
      // Todo o nada: se calcula primero y se aplica al final.
      for (const record of change.put) this.songs.set(record.id, { ...record });
      for (const id of change.delete) this.songs.delete(id);
      if (change.backup) this.meta.set(change.backup.key, { key: change.backup.key, original: change.backup.original });
      this.meta.set('library', { ...change.library, order: [...change.library.order] });
      this.commits.push(change);
    };
    if (!this.holdCommits) return Promise.resolve().then(apply);
    return new Promise<void>((resolve, reject) => {
      this.heldCommits.push({
        change,
        resolve: () => {
          try {
            apply();
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      });
    });
  }

  /** Completa la transacción pendiente más antigua. */
  releaseCommit(): void {
    this.heldCommits.shift()?.resolve();
  }

  close(): void {
    this.closes++;
  }

  /** Orden guardado (ids). */
  get order(): string[] {
    return ((this.meta.get('library')?.order as string[]) ?? []).slice();
  }

  get library(): Record<string, unknown> | undefined {
    return this.meta.get('library');
  }
}
