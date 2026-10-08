import { useMemo, useState } from 'react';
import type { PlaylistSnapshot, Song } from '@/domain';
import { createIdGenerator } from '@/lib/idGenerator';
import type { AudioSource } from './audio/sourceRegistry';
import { PlaylistController, type ImportSongRequest } from './playlistController';

export interface PlaylistActions {
  /**
   * Importa una canción con su archivo real (inserción atómica).
   * @throws Error de validación, `RangeError` o `DuplicateSongIdError`; nada cambia.
   */
  importSong(request: ImportSongRequest): Song;
  /** Elimina la canción y su archivo. */
  removeSong(id: string): boolean;
  selectSong(id: string): boolean;
  next(): boolean;
  previous(): boolean;
  /** Archivo y duración precisa de una canción (para la reproducción futura). */
  getSource(id: string): AudioSource | undefined;
  /** Selección actual leída de `Playlist` en el momento (no del último render). */
  currentId(): string | null;
  /** Vacía la playlist y el registro de fuentes. @returns `false` si ya estaba vacía. */
  clearAll(): boolean;
  /** Snapshot de la playlist en el momento (no el del último render). */
  peek(): PlaylistSnapshot;
  /** Número de canciones en el momento. */
  size(): number;
  /**
   * Reconstruye la playlist restaurada (solo sobre una playlist vacía).
   * @throws Error si ya hay canciones o ids repetidos; nada cambia.
   */
  restoreLibrary(
    entries: readonly { readonly song: Song; readonly source: AudioSource }[],
    selectedId: string | null,
  ): void;
}

export interface UsePlaylistOptions {
  /** Generador de ids (se inyecta en pruebas). Por defecto, `createIdGenerator()`. */
  generateId?: (() => string) | undefined;
}

/**
 * Adaptador entre el `PlaylistController` (playlist + archivos) y React.
 *
 * - Crea **un controlador por montaje** (estado del componente), nunca global.
 * - La lista enlazada es la fuente de verdad del orden y la selección; React
 *   recibe un snapshot nuevo (datos planos, sin `File` ni nodos) después de
 *   cada operación que cambia el estado.
 * - No genera ids durante el render: solo en las acciones.
 */
export function usePlaylist(options: UsePlaylistOptions = {}): {
  snapshot: PlaylistSnapshot;
  actions: PlaylistActions;
} {
  // Crear el generador no produce ids; solo se llaman al importar.
  const [controller] = useState(
    () => new PlaylistController(options.generateId ?? createIdGenerator()),
  );
  const [snapshot, setSnapshot] = useState(() => controller.snapshot());

  const actions = useMemo<PlaylistActions>(() => {
    const commit = () => setSnapshot(controller.snapshot());
    const commitIf = (changed: boolean) => {
      if (changed) commit();
      return changed;
    };

    return {
      importSong(request) {
        const song = controller.importSong(request);
        commit();
        return song;
      },
      removeSong: (id) => commitIf(controller.removeSong(id)),
      selectSong: (id) => commitIf(controller.selectSong(id)),
      next: () => commitIf(controller.next()),
      previous: () => commitIf(controller.previous()),
      getSource: (id) => controller.getSource(id),
      currentId: () => controller.currentId,
      size: () => controller.size,
      peek: () => controller.snapshot(),
      clearAll: () => commitIf(controller.clear()),
      restoreLibrary(entries, selectedId) {
        controller.restore(entries, selectedId);
        commit();
      },
    };
  }, [controller]);

  return { snapshot, actions };
}
