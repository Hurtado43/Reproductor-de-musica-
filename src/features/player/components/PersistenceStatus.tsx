import type { PersistenceSnapshot } from '../persistence/LibraryPersistence';
import styles from '../player.module.css';

interface PersistenceStatusProps {
  state: PersistenceSnapshot;
  /** `false` si reintentar la restauración ya no es posible (la sesión tiene canciones). */
  canRetryRestore: boolean;
  onRetry(): void;
  onDismissReport(): void;
  reportDismissed: boolean;
}

function label(state: PersistenceSnapshot): string {
  const { status } = state;
  switch (status.kind) {
    case 'restoring':
      return 'Restaurando la biblioteca guardada…';
    case 'ready':
      return status.restoredCount > 0 ? 'Biblioteca restaurada de este navegador' : 'Se guardará en este navegador';
    case 'saving':
      return 'Guardando…';
    case 'saved':
      return 'Guardado en este navegador';
    case 'error':
    case 'off':
      return status.message;
  }
}

/**
 * Estado de la persistencia, dentro del encabezado de la playlist (no desplaza
 * la esfera ni tapa los controles). Región `role="status"` con texto breve;
 * en error, botón "Reintentar" cuando tiene sentido.
 */
export function PersistenceStatus({
  state,
  canRetryRestore,
  onRetry,
  onDismissReport,
  reportDismissed,
}: PersistenceStatusProps) {
  const { status, report } = state;
  const isError = status.kind === 'error' || status.kind === 'off';
  const retry =
    status.kind === 'error' &&
    (status.retry === 'save' || (status.retry === 'restore' && canRetryRestore));

  return (
    <>
      <div className={styles.persistence} data-kind={status.kind}>
        <p
          className={`${styles.persistenceText} ${isError ? styles.persistenceError : ''}`}
          role="status"
          aria-live="polite"
          data-testid="persistence-status"
        >
          {label(state)}
        </p>
        {retry && (
          <button type="button" className={styles.persistenceRetry} onClick={onRetry}>
            Reintentar
          </button>
        )}
      </div>
      {report.length > 0 && !reportDismissed && (
        <div className={styles.restoreReport} role="alert" data-testid="restore-report">
          <p className={styles.restoreReportTitle}>No se pudo recuperar todo lo guardado:</p>
          <ul>
            {report.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <button type="button" className={styles.persistenceRetry} onClick={onDismissReport}>
            Entendido
          </button>
        </div>
      )}
    </>
  );
}
