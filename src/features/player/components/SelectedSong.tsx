import { useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { PlaylistSnapshot } from '@/domain';
import { displayArtist, formatDuration } from '../format';
import { toVisiblePosition } from '../songForm';
import styles from '../player.module.css';

interface SelectedSongProps {
  snapshot: PlaylistSnapshot;
}

/**
 * `true` si el contenido de `ref` es más alto que su caja (se puede desplazar).
 * Se recalcula al cambiar el texto o el tamaño (ResizeObserver).
 */
function useOverflow(ref: RefObject<HTMLElement | null>, dependency: unknown): boolean {
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      setOverflowing(false);
      return;
    }
    const check = () => setOverflowing(element.scrollHeight > element.clientHeight + 1);
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(check);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, [ref, dependency]);
  return overflowing;
}

/**
 * Datos de la canción seleccionada (la navegación está en `PlaybackControls`).
 *
 * Títulos largos (fase 4B): el título ocupa como mucho 2 líneas (3 con
 * pantallas altas, ver CSS). Si no cabe, su caja se puede desplazar con la
 * rueda, el tacto o el teclado (recibe foco y tiene nombre accesible), y el
 * texto completo también está en `title`. No hay marquesinas. Así el título no
 * mueve la esfera ni empuja los controles fuera de la vista.
 */
export function SelectedSong({ snapshot }: SelectedSongProps) {
  const headingId = useId();
  const titleBoxRef = useRef<HTMLDivElement>(null);
  const current = snapshot.currentIndex >= 0 ? snapshot.songs[snapshot.currentIndex] : undefined;
  const overflowing = useOverflow(titleBoxRef, current?.title);

  return (
    <section className={styles.selected} aria-labelledby={headingId}>
      <p className={styles.eyebrow} id={headingId}>
        {current ? 'Canción seleccionada' : 'Sin canción seleccionada'}
      </p>

      {current ? (
        <>
          <div
            ref={titleBoxRef}
            className={styles.selectedTitleBox}
            data-overflowing={overflowing ? 'true' : undefined}
            tabIndex={overflowing ? 0 : undefined}
            role={overflowing ? 'region' : undefined}
            aria-label={overflowing ? 'Título completo, desplazable' : undefined}
          >
            <h2 className={styles.selectedTitle} title={current.title}>
              {current.title}
            </h2>
          </div>
          <p
            className={`${styles.selectedArtist} ${current.artist === null ? styles.unknownArtist : ''}`}
          >
            {displayArtist(current.artist)}
          </p>
          <p className={styles.selectedMeta}>
            Posición {toVisiblePosition(snapshot.currentIndex)} de {snapshot.songs.length}
            <span aria-hidden="true"> · </span>
            <span className={styles.visuallyHidden}>, duración </span>
            {formatDuration(current.durationSeconds)}
          </p>
        </>
      ) : (
        <p className={styles.selectedEmpty}>
          Importa archivos MP3 con «Agregar canción» para empezar a recorrer la playlist.
        </p>
      )}
    </section>
  );
}
