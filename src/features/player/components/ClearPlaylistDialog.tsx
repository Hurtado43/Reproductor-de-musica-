import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { formatSongCount } from '../format';
import styles from '../player.module.css';

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

interface ClearPlaylistDialogProps {
  /** Canciones que se quitarán. */
  count: number;
  onConfirm(): void;
  onCancel(): void;
}

/**
 * Confirmación de "Vaciar playlist" (fase 4B).
 *
 * - Modal propio (`role="alertdialog"`, `aria-modal`), igual que el diálogo de
 *   importación: el resto de la interfaz recibe `inert`.
 * - Al abrirse enfoca "Cancelar" (la opción segura). Tab y Shift+Tab quedan
 *   dentro; Escape o "Cancelar" lo cierran sin cambiar nada. El padre devuelve
 *   el foco al botón que lo abrió.
 */
export function ClearPlaylistDialog({ count, onConfirm, onCancel }: ClearPlaylistDialogProps) {
  const uid = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
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

  return (
    <div className={styles.backdrop}>
      <div
        ref={dialogRef}
        className={`${styles.dialog} ${styles.confirmDialog}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        aria-describedby={`${uid}-text`}
        onKeyDown={handleKeyDown}
      >
        <h2 id={`${uid}-title`} className={styles.dialogTitle}>
          ¿Vaciar la playlist?
        </h2>
        <div id={`${uid}-text`} className={styles.confirmText}>
          <p>
            Se quitarán {formatSongCount(count)} de la biblioteca de esta aplicación, también de la
            copia guardada en este navegador.
          </p>
          <p>Los archivos originales de tu dispositivo no se eliminan.</p>
        </div>
        <div className={styles.dialogActions}>
          <button ref={cancelRef} type="button" className={styles.secondaryButton} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={styles.dangerButton} onClick={onConfirm}>
            Vaciar
          </button>
        </div>
      </div>
    </div>
  );
}
