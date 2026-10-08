import { useEffect, useState, useSyncExternalStore } from 'react';
import { createBrowserLibraryStorage, type LibraryStorage } from './indexedDbStorage';
import { LibraryPersistence, type PersistenceOptions, type PersistenceSnapshot } from './LibraryPersistence';

/**
 * Una `LibraryPersistence` por montaje del reproductor.
 *
 * - Crear la instancia no abre IndexedDB: la conexión se abre en la primera
 *   operación, que ocurre en un efecto (solo en el navegador).
 * - El servidor y el primer render del cliente ven el mismo estado
 *   ("restaurando"), así que no hay diferencias de hidratación.
 * - Al desmontar, `dispose()` guarda lo pendiente de agrupar y cierra la
 *   conexión cuando terminan las transacciones. Es seguro con Strict Mode: la
 *   restauración se memoriza y la conexión se reabre si hace falta.
 */
export function useLibraryPersistence(
  storage?: LibraryStorage,
  options?: PersistenceOptions,
): { persistence: LibraryPersistence; persistenceState: PersistenceSnapshot } {
  const [persistence] = useState(
    () => new LibraryPersistence(storage ?? createBrowserLibraryStorage(), options),
  );
  const persistenceState = useSyncExternalStore(
    persistence.subscribe,
    persistence.getSnapshot,
    persistence.getSnapshot,
  );
  useEffect(() => () => persistence.dispose(), [persistence]);
  return { persistence, persistenceState };
}
