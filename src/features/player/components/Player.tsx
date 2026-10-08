'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { readAudioMetadata, type ReadAudioMetadata } from '../audio/readAudioMetadata';
import { usePlayback, type PlaybackHookEnvironment } from '../audio/usePlayback';
import type { ImportSongRequest } from '../playlistController';
import { resultingVisiblePosition } from '../songForm';
import { usePlaylist, type UsePlaylistOptions } from '../usePlaylist';
import { formatSongCount } from '../format';
import type { LibraryStorage } from '../persistence/indexedDbStorage';
import type { LibraryState, PersistenceOptions } from '../persistence/LibraryPersistence';
import { useLibraryPersistence } from '../persistence/useLibraryPersistence';
import { PersistenceStatus } from './PersistenceStatus';
import { ClearPlaylistDialog } from './ClearPlaylistDialog';
import {
  actionAfterEnd,
  DEFAULT_REPEAT_MODE,
  nextRepeatMode,
  REPEAT_LABEL,
  type RepeatMode,
} from '../repeatMode';
import { ShuffleNavigator, type RandomSource } from '../shuffle';
import styles from '../player.module.css';
import { AddSongDialog } from './AddSongDialog';
import { PlaybackControls } from './PlaybackControls';
import { PlaylistPanel } from './PlaylistPanel';
import { SelectedSong } from './SelectedSong';
import { Visualizer } from '../visualizer/Visualizer';

/** A dónde mover el foco después de una operación que quita el elemento enfocado. */
type PendingFocus = { kind: 'song'; id: string } | { kind: 'playlist' } | null;

export interface PlayerProps extends UsePlaylistOptions {
  /** Lector de metadatos de audio. Por defecto, el real del navegador (se simula en pruebas). */
  readMetadata?: ReadAudioMetadata | undefined;
  /** Entorno del motor de audio y del medidor. Por defecto, el del navegador (se simula en pruebas). */
  playbackEnvironment?: PlaybackHookEnvironment | undefined;
  /** Almacenamiento de la biblioteca. Por defecto, IndexedDB del navegador (se simula en pruebas). */
  libraryStorage?: LibraryStorage | undefined;
  persistenceOptions?: PersistenceOptions | undefined;
  /** Generador para el aleatorio (fase 5). Por defecto, `Math.random` (se fija en pruebas). */
  random?: RandomSource | undefined;
}

/**
 * Reproductor (componente cliente). Cada montaje tiene su propia playlist y su
 * registro de archivos (vía `usePlaylist`); empieza vacío, así que el HTML del
 * servidor y el primer render del cliente coinciden.
 *
 * La selección solo cambia por: clic en una fila (`handleSelect`), Anterior o
 * Siguiente (`handleStep`), la primera importación en una playlist vacía o la
 * eliminación de la canción actual (reglas de `Playlist`). Ningún efecto la modifica.
 *
 * Reproducción: un `AudioEngine` por montaje (`usePlayback`). Después de cada
 * acción que puede cambiar la selección, `syncPlayback` lee la selección actual
 * de `Playlist` y, si cambió, carga esa canción en el motor:
 *   - Primera importación o eliminación de la actual → queda en pausa.
 *   - Fila, Anterior o Siguiente → sigue sonando si estaba sonando.
 *   - Final automático (`ended`) → avanza al nodo `next` y reproduce.
 *   - Misma canción → no se recarga (conserva su tiempo).
 * No hay un segundo índice de reproducción: el motor solo sabe qué id cargó.
 *
 * Persistencia (fase 4A): al montar se restaura la biblioteca de IndexedDB
 * (canciones con su archivo, orden, selección, volumen y silencio). Mientras
 * tanto, "Agregar canción", el volumen y el silencio están deshabilitados. La
 * canción restaurada queda en pausa, al inicio: restaurar nunca reproduce.
 * Después, cada cambio de la playlist o de las preferencias pide un guardado.
 *
 * Fase 4B:
 *   - Repetición (`repeatMode`): solo decide qué pasa al terminar una canción
 *     (`actionAfterEnd`). Anterior y Siguiente no la consultan.
 *   - "Vaciar playlist": con confirmación; detiene el audio, invalida lo
 *     pendiente (`engine.unload`), vacía la playlist y el registro, y la
 *     persistencia guarda el estado vacío en una transacción.
 *   - La búsqueda vive en `PlaylistPanel` y solo afecta a la presentación.
 *
 * Fase 5 — aleatorio (`ShuffleNavigator`): con el modo activo, Anterior,
 * Siguiente y el final eligen ids con un historial y candidatos propios de la
 * sesión, y la selección se hace siempre con `Playlist.select`. El orden de la
 * lista enlazada y el guardado no cambian. "Repetir canción" tiene prioridad al
 * terminar; con "Repetir playlist", al agotar los candidatos empieza otro ciclo.
 *
 * Esfera: recibe `audioInput`, un objeto estable que el medidor de niveles
 * actualiza fuera de React (fase 3B). Cambiar de canción no la vuelve a renderizar.
 */
export function Player({
  readMetadata = readAudioMetadata,
  playbackEnvironment,
  libraryStorage,
  persistenceOptions,
  random,
  ...options
}: PlayerProps) {
  const { snapshot, actions } = usePlaylist(options);
  const { engine, playback, audioInput } = usePlayback(playbackEnvironment);
  const { persistence, persistenceState } = useLibraryPersistence(libraryStorage, persistenceOptions);
  const restoring = persistenceState.status.kind === 'restoring';
  const [reportDismissed, setReportDismissed] = useState(false);
  const [dialog, setDialog] = useState<'add' | 'clear' | null>(null);
  const dialogOpen = dialog !== null;
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(DEFAULT_REPEAT_MODE);
  // El manejador de `ended` lee el modo vigente en el momento de terminar.
  const repeatModeRef = useRef<RepeatMode>(DEFAULT_REPEAT_MODE);
  repeatModeRef.current = repeatMode;
  const [shuffle, setShuffle] = useState(false);
  const shuffleRef = useRef(false);
  shuffleRef.current = shuffle;
  // Historial y candidatos del aleatorio: auxiliares de la sesión (solo ids).
  const [shuffler] = useState(() => new ShuffleNavigator(random ?? Math.random));
  const [announcement, setAnnouncement] = useState('');
  const [pendingFocus, setPendingFocus] = useState<PendingFocus>(null);

  const addButtonRef = useRef<HTMLButtonElement>(null);
  const clearButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const selectButtons = useRef(new Map<string, HTMLButtonElement>());

  const selectButtonRef = (songId: string) => (element: HTMLButtonElement | null) => {
    if (element) selectButtons.current.set(songId, element);
    else selectButtons.current.delete(songId);
  };

  // Devolver el foco al botón que abrió el diálogo después de cerrarlo (solo foco).
  useEffect(() => {
    if (dialogOpen || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    const opener = openerRef.current?.isConnected ? openerRef.current : addButtonRef.current;
    opener?.focus();
  }, [dialogOpen]);

  // Evitar que la página se desplace detrás del diálogo.
  useEffect(() => {
    if (!dialogOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [dialogOpen]);

  // Mover el foco cuando el elemento enfocado desaparece al eliminar (solo foco).
  useEffect(() => {
    if (pendingFocus === null) return;
    const target =
      pendingFocus.kind === 'song' ? selectButtons.current.get(pendingFocus.id) : headingRef.current;
    target?.focus();
    setPendingFocus(null);
  }, [pendingFocus, snapshot]);

  /**
   * Carga en el motor la canción que `Playlist` tiene seleccionada, si es otra.
   * `autoplay` decide si intenta sonar (cambio manual o final automático) o queda en pausa.
   */
  const syncPlayback = (autoplay: boolean) => {
    const id = actions.currentId();
    if (id === engine.songId) return;
    if (id === null) {
      engine.unload();
      return;
    }
    engine.load(id, actions.getSource(id)?.file ?? null, { autoplay });
  };

  // Restaurar la biblioteca guardada (una vez por intento; la promesa se
  // memoriza, así Strict Mode no la aplica dos veces). Nunca llama a play().
  useEffect(() => {
    let active = true;
    void persistence.restore().then((outcome) => {
      if (!active || outcome.kind !== 'restored' || actions.size() > 0) return;
      const { library } = outcome;
      engine.setVolume(library.volume);
      engine.setMuted(library.muted);
      setRepeatMode(library.repeatMode); // nunca inicia audio
      setShuffle(library.shuffle); // nunca inicia audio
      setReportDismissed(false);
      if (library.entries.length === 0) {
        shuffler.reset();
        return;
      }
      actions.restoreLibrary(library.entries, library.selectedId);
      // El historial y los candidatos no se guardan: se reconstruyen.
      if (library.shuffle) shuffler.start(actions.currentId(), library.entries.map((e) => e.song.id));
      syncPlayback(false); // carga la selección en pausa, desde el inicio
      setAnnouncement(`Se restauró la playlist guardada: ${formatSongCount(library.entries.length)}.`);
    });
    return () => {
      active = false;
    };
    // syncPlayback y actions leen siempre el estado vigente del motor y de la playlist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistence, persistenceState.restoreAttempt]);

  /** Estado vigente que se guarda (la playlist en orden, con sus archivos). */
  const libraryState = (): LibraryState => {
    const songs = [];
    for (const song of snapshot.songs) {
      const source = actions.getSource(song.id);
      if (source) songs.push({ song, source });
    }
    const { volume, muted } = engine.getSnapshot();
    return {
      songs,
      selectedId: snapshot.currentId,
      volume,
      muted,
      repeatMode: repeatModeRef.current,
      shuffle: shuffleRef.current,
    };
  };

  // Guardar después de importar, eliminar o cambiar la selección (incluido el
  // avance automático). Durante la restauración se ignora.
  useEffect(() => {
    persistence.requestSave(libraryState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  // Volumen, silencio, repetición y aleatorio: se agrupan (no se escribe en cada movimiento).
  useEffect(() => {
    persistence.requestSave(libraryState(), { preferences: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.volume, playback.muted, repeatMode, shuffle]);

  // Final de canción (una sola vez por carga: el motor descarta `ended`
  // repetidos o de fuentes anteriores). La decisión depende del modo de
  // repetición vigente y de la playlist en ese momento.
  useEffect(() => {
    engine.setEndedHandler(() => {
      const live = actions.peek();
      if (shuffleRef.current && repeatModeRef.current !== 'one') {
        endShuffled(live.songs.map((s) => s.id));
        return;
      }
      const action = actionAfterEnd(repeatModeRef.current, live.hasNext, live.songs.length);
      switch (action) {
        case 'next':
          actions.next();
          syncPlayback(true);
          break;
        case 'first': {
          const first = live.songs[0];
          if (first) actions.selectSong(first.id);
          syncPlayback(true);
          break;
        }
        case 'replay':
          // Misma canción: el motor la reinicia desde 0 (estado "Finalizada").
          engine.play();
          break;
        case 'stop':
          setAnnouncement('Fin de la playlist.');
          return;
      }
      const title = live.songs.find((s) => s.id === actions.currentId())?.title;
      if (title) {
        setAnnouncement(action === 'replay' ? `Repitiendo «${title}».` : `Reproduciendo «${title}».`);
      }
    });
    return () => engine.setEndedHandler(null);
  });

  /**
   * Final con aleatorio (y sin "Repetir canción", que tiene prioridad):
   * historial adelantado o candidato pendiente; agotados, "Repetir playlist"
   * inicia otro ciclo y "Sin repetición" deja la canción finalizada.
   */
  const endShuffled = (allIds: string[]) => {
    const current = actions.currentId();
    let id = shuffler.next();
    if (id === null && repeatModeRef.current === 'all') {
      shuffler.newCycle(allIds, current);
      id = shuffler.next();
    }
    if (id === null) {
      setAnnouncement('Fin de la reproducción aleatoria.');
      return;
    }
    if (id === current) {
      engine.play(); // una sola canción: se repite desde 0
    } else {
      actions.selectSong(id);
      syncPlayback(true);
    }
    const title = actions.peek().songs.find((s) => s.id === id)?.title;
    if (title) setAnnouncement(`Reproduciendo «${title}».`);
  };

  // Lectura del tiempo real del elemento para la barra de progreso (fase 4B).
  const readCurrentTime = useCallback(() => engine.mediaElement?.currentTime ?? null, [engine]);

  /** Activa o desactiva el aleatorio. No toca la canción actual ni el audio. */
  const toggleShuffle = () => {
    const enabled = !shuffle;
    if (enabled) shuffler.start(actions.currentId(), snapshot.songs.map((s) => s.id));
    else shuffler.reset();
    setShuffle(enabled);
    setAnnouncement(enabled ? 'Reproducción aleatoria activada.' : 'Reproducción aleatoria desactivada.');
  };

  const cycleRepeat = () => {
    const mode = nextRepeatMode(repeatMode);
    setRepeatMode(mode);
    setAnnouncement(`Modo de repetición: ${REPEAT_LABEL[mode].toLowerCase()}.`);
  };

  const openDialog = (kind: 'add' | 'clear' = 'add') => {
    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement ? active : addButtonRef.current;
    setDialog(kind);
  };

  const closeDialog = () => {
    restoreFocusRef.current = true;
    setDialog(null);
  };

  /**
   * Vaciar playlist confirmado: detiene el audio y descarta lo pendiente
   * (`unload` invalida respuestas de `play()`/`resume()`, quita la fuente y
   * revoca su URL; el medidor lleva la esfera a 0), vacía la lista y el
   * registro, y deja que la persistencia guarde el estado vacío. Volumen,
   * silencio y repetición se conservan.
   */
  const handleConfirmClear = () => {
    const count = snapshot.songs.length;
    engine.unload();
    actions.clearAll();
    shuffler.reset(); // sin candidatos ni historial; el modo sigue activo si lo estaba
    setAnnouncement(`Se vació la playlist: se quitaron ${formatSongCount(count)}.`);
    closeDialog();
  };

  const handleImport = (request: ImportSongRequest) => {
    const sizeBefore = snapshot.songs.length;
    // Si importSong lanza un error, el diálogo lo muestra y sigue abierto.
    const song = actions.importSong(request);
    // Aleatorio: la canción nueva es un candidato más; la actual no cambia.
    if (shuffleRef.current) {
      shuffler.add(song.id);
      shuffler.sync(actions.currentId());
    }
    // Solo carga algo si la playlist estaba vacía (primera importación): queda en pausa.
    syncPlayback(false);
    setAnnouncement(
      `«${song.title}» se agregó en la posición ${resultingVisiblePosition(request.placement, sizeBefore)}.`,
    );
    closeDialog();
  };

  const handleRemove = (id: string) => {
    const index = snapshot.songs.findIndex((song) => song.id === id);
    const song = snapshot.songs[index];
    if (!song) return;
    // Vecino visible (con la búsqueda activa, algunas filas no se muestran).
    const rendered = (s: { id: string }) => selectButtons.current.has(s.id);
    const neighbor =
      snapshot.songs.slice(index + 1).find(rendered) ??
      [...snapshot.songs.slice(0, index)].reverse().find(rendered);
    const removedCurrent = id === engine.songId;
    if (!actions.removeSong(id)) return;
    // Aleatorio: fuera del historial y de los candidatos; si era la actual, la
    // alternativa que eligió `Playlist` pasa a ser la actual del historial.
    shuffler.remove(id);
    if (shuffleRef.current) shuffler.sync(actions.currentId());
    // Eliminar la actual: detener ya y cargar la nueva selección en pausa.
    // Eliminar otra canción no toca el audio.
    if (removedCurrent) syncPlayback(false);
    setAnnouncement(`«${song.title}» se eliminó de la playlist.`);
    setPendingFocus(neighbor ? { kind: 'song', id: neighbor.id } : { kind: 'playlist' });
  };

  const handleSelect = (id: string) => {
    const song = snapshot.songs.find((s) => s.id === id);
    const wasPlaying = engine.wantsToPlay;
    if (song && actions.selectSong(id)) {
      if (shuffleRef.current) shuffler.select(id); // entra en el historial y sale de los candidatos
      syncPlayback(wasPlaying);
      setAnnouncement(`Seleccionada: «${song.title}».`);
    }
  };

  /** Mueve la selección un paso (`offset` = ±1) y anuncia el resultado. */
  const handleStep = (offset: 1 | -1) => {
    if (snapshot.currentIndex < 0) return;
    if (shuffle) {
      // Aleatorio: historial y candidatos; la selección la hace `Playlist`.
      const wasPlayingShuffled = engine.wantsToPlay;
      const id = offset === 1 ? shuffler.next() : shuffler.previous();
      if (id !== null && actions.selectSong(id)) {
        syncPlayback(wasPlayingShuffled);
        const title = snapshot.songs.find((s) => s.id === id)?.title;
        if (title) setAnnouncement(`Seleccionada: «${title}».`);
      } else {
        setAnnouncement(
          offset === 1 ? 'No quedan canciones en este ciclo aleatorio.' : 'No hay canciones anteriores en el historial.',
        );
      }
      return;
    }
    const target = snapshot.songs[snapshot.currentIndex + offset];
    const wasPlaying = engine.wantsToPlay;
    const moved = offset === 1 ? actions.next() : actions.previous();
    if (moved) syncPlayback(wasPlaying);
    if (moved && target) {
      setAnnouncement(`Seleccionada: «${target.title}».`);
    } else {
      setAnnouncement(
        offset === 1 ? 'Ya estás en la última canción.' : 'Ya estás en la primera canción.',
      );
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.shell} inert={dialogOpen}>
        <main className={styles.stage}>
          <h1 className={styles.appTitle}>the protoype</h1>
          <div className={styles.stageColumn}>
            <Visualizer audio={audioInput} />
            <SelectedSong snapshot={snapshot} />
            <PlaybackControls
              playback={playback}
              hasPrevious={shuffle ? shuffler.hasPrevious : snapshot.hasPrevious}
              hasNext={shuffle ? shuffler.hasNext : snapshot.hasNext}
              onTogglePlay={() => engine.togglePlay()}
              onPrevious={() => handleStep(-1)}
              onNext={() => handleStep(1)}
              onSeek={(seconds) => engine.seek(seconds)}
              onVolume={(volume) => {
                engine.setVolume(volume);
                if (volume > 0 && playback.muted) engine.setMuted(false);
              }}
              onToggleMute={() => engine.setMuted(!playback.muted)}
              repeatMode={repeatMode}
              onCycleRepeat={cycleRepeat}
              shuffle={shuffle}
              onToggleShuffle={toggleShuffle}
              readCurrentTime={readCurrentTime}
              preferencesDisabled={restoring}
            />
          </div>
        </main>
        <PlaylistPanel
          snapshot={snapshot}
          addButtonRef={addButtonRef}
          headingRef={headingRef}
          selectButtonRef={selectButtonRef}
          onAddClick={() => openDialog('add')}
          onClearClick={() => openDialog('clear')}
          clearButtonRef={clearButtonRef}
          clearDisabled={restoring}
          onSelect={handleSelect}
          onRemove={handleRemove}
          addDisabled={restoring}
          status={
            <PersistenceStatus
              state={persistenceState}
              canRetryRestore={snapshot.songs.length === 0}
              onRetry={() => {
                const { status } = persistenceState;
                if (status.kind !== 'error') return;
                if (status.retry === 'restore') persistence.retryRestore();
                else persistence.retrySave();
              }}
              reportDismissed={reportDismissed}
              onDismissReport={() => setReportDismissed(true)}
            />
          }
        />
      </div>

      <p className={styles.visuallyHidden} role="status" aria-live="polite">
        {announcement}
      </p>

      {dialog === 'clear' && (
        <ClearPlaylistDialog
          count={snapshot.songs.length}
          onConfirm={handleConfirmClear}
          onCancel={closeDialog}
        />
      )}

      {dialog === 'add' && (
        <AddSongDialog
          size={snapshot.songs.length}
          readMetadata={readMetadata}
          onImport={handleImport}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
