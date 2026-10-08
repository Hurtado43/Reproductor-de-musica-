import { useEffect, useId, useState, type ReactNode, type Ref } from 'react';
import type { PlaylistSnapshot } from '@/domain';
import { displayArtist, formatDuration, formatSongCount } from '../format';
import { filterSongs } from '../songSearch';
import { toVisiblePosition } from '../songForm';
import styles from '../player.module.css';
import { CloseIcon, PlusIcon, SearchIcon, TrashIcon } from './icons';

interface PlaylistPanelProps {
  snapshot: PlaylistSnapshot;
  addButtonRef: Ref<HTMLButtonElement>;
  headingRef: Ref<HTMLHeadingElement>;
  /** Registra el botón de selección de cada fila (para mover el foco tras eliminar). */
  selectButtonRef(songId: string): Ref<HTMLButtonElement>;
  onAddClick(): void;
  onSelect(id: string): void;
  onRemove(id: string): void;
  /** Deshabilita "Agregar canción" (por ejemplo, mientras se restaura la biblioteca). */
  addDisabled?: boolean | undefined;
  /** Estado de la persistencia, debajo del resumen. */
  status?: ReactNode;
  /** "Vaciar playlist" (fase 4B): abre la confirmación. */
  onClearClick(): void;
  clearButtonRef?: Ref<HTMLButtonElement> | undefined;
  /** Deshabilita "Vaciar playlist" (por ejemplo, mientras se restaura). */
  clearDisabled?: boolean | undefined;
}

/**
 * Playlist lateral: resumen, acciones, búsqueda y una fila por canción.
 *
 * Búsqueda (fase 4B): solo filtra lo que se muestra. No cambia el orden de la
 * lista enlazada, la selección ni la reproducción, y no se guarda. Cada fila
 * conserva su posición en la playlist completa, y seleccionar o eliminar usa
 * siempre el id de la canción.
 */
export function PlaylistPanel({
  snapshot,
  addButtonRef,
  headingRef,
  selectButtonRef,
  onAddClick,
  onSelect,
  onRemove,
  addDisabled = false,
  status,
  onClearClick,
  clearButtonRef,
  clearDisabled = false,
}: PlaylistPanelProps) {
  const { songs, currentId } = snapshot;
  const headingId = useId();
  const searchId = useId();
  const [query, setQuery] = useState('');

  // Sin canciones (por ejemplo, tras vaciar) la búsqueda no tiene sentido.
  useEffect(() => {
    if (songs.length === 0) setQuery('');
  }, [songs.length]);

  const filtering = query.trim() !== '';
  const visible = filterSongs(songs, query);
  const currentHidden = filtering && currentId !== null && !visible.some((r) => r.song.id === currentId);

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <header className={styles.panelHeader}>
        <div className={styles.panelHeading}>
          <h2 ref={headingRef} id={headingId} className={styles.panelTitle} tabIndex={-1}>
            Playlist
          </h2>
          <p className={styles.panelStats} data-testid="playlist-stats">
            {formatSongCount(songs.length)}
            <span aria-hidden="true"> · </span>
            <span className={styles.visuallyHidden}>, duración total </span>
            {formatDuration(snapshot.totalDurationSeconds)}
          </p>
          {status}
        </div>
        <div className={styles.panelActions}>
          <button
            ref={addButtonRef}
            type="button"
            className={styles.primaryButton}
            onClick={onAddClick}
            aria-haspopup="dialog"
            disabled={addDisabled}
          >
            <PlusIcon />
            Agregar canción
          </button>
          {songs.length > 0 && (
            <button
              ref={clearButtonRef}
              type="button"
              className={styles.textButton}
              onClick={onClearClick}
              disabled={clearDisabled}
              aria-haspopup="dialog"
            >
              <TrashIcon width={16} height={16} />
              Vaciar playlist
            </button>
          )}
        </div>
        {songs.length > 0 && (
          <>
            <div className={styles.search} role="search">
              <SearchIcon className={styles.searchIcon} width={16} height={16} />
              <label htmlFor={searchId} className={styles.visuallyHidden}>
                Buscar canción
              </label>
              <input
                id={searchId}
                type="search"
                className={styles.searchInput}
                placeholder="Buscar canción"
                value={query}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && query !== '') {
                    event.preventDefault();
                    setQuery('');
                  }
                }}
              />
              {query !== '' && (
                <button
                  type="button"
                  className={styles.searchClear}
                  onClick={() => setQuery('')}
                  aria-label="Limpiar búsqueda"
                  title="Limpiar búsqueda"
                >
                  <CloseIcon width={16} height={16} />
                </button>
              )}
            </div>
            <p className={styles.searchStatus} role="status" aria-live="polite" data-testid="search-status">
              {filtering
                ? `${visible.length} de ${formatSongCount(songs.length)}${currentHidden ? ' · la canción seleccionada no coincide' : ''}`
                : ''}
            </p>
          </>
        )}
      </header>

      {songs.length === 0 ? (
        <div className={styles.emptyState}>
          <p>La playlist está vacía.</p>
          <p>Usa «Agregar canción» para importar archivos MP3 de tu dispositivo.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className={styles.emptyState} data-testid="no-results">
          <p>Ninguna canción coincide con «{query.trim()}».</p>
          <p>La búsqueda revisa el título y el artista.</p>
          <button type="button" className={styles.secondaryButton} onClick={() => setQuery('')}>
            Limpiar búsqueda
          </button>
        </div>
      ) : (
        <ol className={styles.songList} aria-label={filtering ? 'Canciones que coinciden' : 'Canciones'}>
          {visible.map(({ song, index }) => {
            const isCurrent = song.id === currentId;
            const position = toVisiblePosition(index);
            const duration = formatDuration(song.durationSeconds);
            const artist = displayArtist(song.artist);
            return (
              <li
                key={song.id}
                data-song-id={song.id}
                className={`${styles.songRow} ${isCurrent ? styles.songRowCurrent : ''}`}
              >
                <button
                  type="button"
                  ref={selectButtonRef(song.id)}
                  className={styles.songSelect}
                  onClick={() => onSelect(song.id)}
                  aria-current={isCurrent ? 'true' : undefined}
                  aria-label={`${position}. ${song.title}, ${song.artist === null ? artist.toLowerCase() : `de ${artist}`}, ${duration}${isCurrent ? ', seleccionada' : ''}`}
                >
                  <span className={styles.songPosition} aria-hidden="true">
                    {position}
                  </span>
                  <span className={styles.songText} aria-hidden="true">
                    <span className={styles.songTitle} title={song.title}>
                      {song.title}
                    </span>
                    <span
                      className={`${styles.songArtist} ${song.artist === null ? styles.unknownArtist : ''}`}
                      title={artist}
                    >
                      {artist}
                    </span>
                  </span>
                  <span className={styles.songDuration} aria-hidden="true">
                    {duration}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.songRemove}
                  onClick={() => onRemove(song.id)}
                  aria-label={`Eliminar ${position}. ${song.title}`}
                  title="Eliminar"
                >
                  <CloseIcon width={18} height={18} />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
