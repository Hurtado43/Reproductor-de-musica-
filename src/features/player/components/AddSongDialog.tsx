import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import type { ReadAudioMetadata } from '../audio/readAudioMetadata';
import { useAudioFileReader, type AudioFileState } from '../audio/useAudioFileReader';
import { formatDuration, formatFileSize, formatPreciseSeconds } from '../format';
import type { ImportSongRequest } from '../playlistController';
import {
  EMPTY_SONG_FORM,
  parseSongForm,
  SONG_FORM_FIELD_ORDER,
  titleFromFileName,
  toDomainDurationSeconds,
  type PlacementChoice,
  type SongFormErrors,
  type SongFormField,
  type SongFormValues,
} from '../songForm';
import styles from '../player.module.css';
import { CloseIcon } from './icons';

interface AddSongDialogProps {
  /** Cantidad actual de canciones (define el rango de posiciones válidas). */
  size: number;
  /** Lector de metadatos (el real en la app; simulado en pruebas). */
  readMetadata: ReadAudioMetadata;
  /**
   * Importa la canción. Si lanza un error, el diálogo lo muestra y conserva los
   * datos y el archivo. Si termina bien, el componente padre cierra el diálogo.
   */
  onImport(request: ImportSongRequest): void;
  onClose(): void;
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/** Une ids para `aria-describedby`, omitiendo los vacíos. */
function describedBy(...ids: (string | false | undefined)[]): string | undefined {
  const joined = ids.filter(Boolean).join(' ');
  return joined === '' ? undefined : joined;
}

function durationText(file: AudioFileState): string {
  switch (file.status) {
    case 'empty':
      return 'Se detecta al elegir el archivo';
    case 'reading':
      return 'Leyendo archivo…';
    case 'error':
      return 'No disponible';
    case 'ready':
      return `${formatDuration(toDomainDurationSeconds(file.durationSeconds))} (${formatPreciseSeconds(file.durationSeconds)})`;
  }
}

/**
 * Diálogo modal para importar un archivo MP3 del dispositivo.
 *
 * - Al abrirse enfoca el selector de archivo. Tab y Shift+Tab quedan dentro del
 *   diálogo. Escape, "Cancelar" o "Cerrar" lo cierran; el padre devuelve el foco
 *   al botón que lo abrió.
 * - Mientras se lee el archivo muestra "Leyendo archivo…", deshabilita
 *   "Agregar" y no toca la playlist. No reproduce el audio.
 * - Si hay errores, conserva los campos y el archivo válido, marca cada campo
 *   (`aria-invalid` + `aria-describedby`) y enfoca el primero con error.
 * - Al cerrarse se desmonta: el lector cancela la lectura pendiente y libera
 *   sus recursos, y la próxima apertura empieza limpia.
 */
export function AddSongDialog({ size, readMetadata, onImport, onClose }: AddSongDialogProps) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const { state: file, select } = useAudioFileReader(readMetadata);
  const [values, setValues] = useState<SongFormValues>(EMPTY_SONG_FORM);
  const [errors, setErrors] = useState<SongFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const autoTitleRef = useRef('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Partial<Record<SongFormField, HTMLInputElement | null>>>({});

  useEffect(() => {
    fieldRefs.current.file?.focus();
  }, []);

  const clearError = (field: SongFormField) =>
    setErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    clearError('file');
    setFormError(null);
    select(chosen);
    if (chosen) {
      // El título se toma del nombre del archivo, salvo que el usuario ya lo haya cambiado.
      // Se captura el título automático anterior antes de actualizar la ref: el
      // actualizador de setValues se ejecuta después, durante el render.
      const autoTitle = titleFromFileName(chosen.name);
      const previousAutoTitle = autoTitleRef.current;
      setValues((prev) =>
        prev.title === '' || prev.title === previousAutoTitle ? { ...prev, title: autoTitle } : prev,
      );
      autoTitleRef.current = autoTitle;
      if (autoTitle !== '') clearError('title');
    }
  };

  const setText = (field: 'title' | 'artist' | 'position') => (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setValues((prev) => ({ ...prev, [field]: value }));
    if (field !== 'artist') clearError(field);
  };

  const setPlacement = (placement: PlacementChoice) => {
    setValues((prev) => ({ ...prev, placement }));
    clearError('position');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (file.status === 'reading') return;
    setFormError(null);
    const result = parseSongForm(values, size, file);
    if (!result.ok) {
      setErrors(result.errors);
      const first = SONG_FORM_FIELD_ORDER.find((field) => result.errors[field] !== undefined);
      if (first) fieldRefs.current[first]?.focus();
      return;
    }
    try {
      onImport(result.request);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'No se pudo agregar la canción. Inténtalo de nuevo.',
      );
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const maxPosition = size + 1;
  const reading = file.status === 'reading';
  // El error del archivo viene de la lectura o de un envío sin archivo válido.
  const fileMessage = file.status === 'error' ? file.message : errors.file;
  const fileErrorId = fileMessage ? id('file-error') : undefined;
  const errorId = (field: 'title' | 'position') => (errors[field] ? id(`${field}-error`) : undefined);

  return (
    <div className={styles.backdrop}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id('heading')}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.dialogHeader}>
          <h2 id={id('heading')} className={styles.dialogTitle}>
            Agregar canción
          </h2>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Cerrar">
            <CloseIcon />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor={id('file')}>Archivo MP3</label>
            <input
              ref={(el) => {
                fieldRefs.current.file = el;
              }}
              id={id('file')}
              name="file"
              type="file"
              accept=".mp3,audio/mpeg"
              className={styles.fileInput}
              onChange={handleFileChange}
              aria-invalid={fileMessage ? true : undefined}
              aria-describedby={describedBy(id('file-info'), fileErrorId)}
            />
            <div id={id('file-info')} className={styles.fileInfo} role="status">
              {file.status !== 'empty' && (
                <p className={styles.fileName}>
                  <span className={styles.fileNameText}>{file.file.name}</span>
                  <span className={styles.fileSize}> · {formatFileSize(file.file.size)}</span>
                </p>
              )}
              {reading && <p className={styles.fieldHint}>Leyendo archivo…</p>}
            </div>
            {fileMessage && (
              <p id={fileErrorId} className={styles.fieldError}>
                {fileMessage}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor={id('title')}>Título</label>
            <input
              ref={(el) => {
                fieldRefs.current.title = el;
              }}
              id={id('title')}
              name="title"
              type="text"
              autoComplete="off"
              value={values.title}
              onChange={setText('title')}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errorId('title')}
            />
            {errors.title && (
              <p id={errorId('title')} className={styles.fieldError}>
                {errors.title}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor={id('artist')}>Artista (opcional)</label>
            <input
              id={id('artist')}
              name="artist"
              type="text"
              autoComplete="off"
              value={values.artist}
              onChange={setText('artist')}
              aria-describedby={id('artist-hint')}
            />
            <p id={id('artist-hint')} className={styles.fieldHint}>
              Si lo dejas vacío se mostrará «Artista no especificado».
            </p>
          </div>

          <div className={styles.field}>
            <label htmlFor={id('duration')}>Duración (detectada del archivo)</label>
            <input
              id={id('duration')}
              name="duration"
              type="text"
              readOnly
              value={durationText(file)}
              className={styles.readOnlyInput}
            />
          </div>

          <fieldset className={styles.fieldset}>
            <legend>Ubicación</legend>
            <div className={styles.radioGroup}>
              {(
                [
                  ['first', 'Al inicio'],
                  ['last', 'Al final'],
                  ['at', 'En una posición'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className={styles.radio}>
                  <input
                    type="radio"
                    name="placement"
                    value={value}
                    checked={values.placement === value}
                    onChange={() => setPlacement(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
            {values.placement === 'at' && (
              <div className={styles.field}>
                <label htmlFor={id('position')}>Posición (de 1 a {maxPosition})</label>
                <input
                  ref={(el) => {
                    fieldRefs.current.position = el;
                  }}
                  id={id('position')}
                  name="position"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={values.position}
                  onChange={setText('position')}
                  aria-invalid={errors.position ? true : undefined}
                  aria-describedby={describedBy(id('position-hint'), errorId('position'))}
                />
                <p id={id('position-hint')} className={styles.fieldHint}>
                  La posición 1 es el inicio y la {maxPosition} es el final.
                </p>
                {errors.position && (
                  <p id={errorId('position')} className={styles.fieldError}>
                    {errors.position}
                  </p>
                )}
              </div>
            )}
          </fieldset>

          {formError && (
            <p className={styles.formError} role="alert">
              {formError}
            </p>
          )}

          <div className={styles.dialogActions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.primaryButton} disabled={reading}>
              Agregar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
