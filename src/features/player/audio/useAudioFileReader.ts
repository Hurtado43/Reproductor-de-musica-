import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioImportError, type ReadAudioMetadata } from './readAudioMetadata';

/** Estado del archivo elegido en el diálogo. */
export type AudioFileState =
  | { readonly status: 'empty' }
  | { readonly status: 'reading'; readonly file: File }
  | { readonly status: 'ready'; readonly file: File; readonly durationSeconds: number }
  | { readonly status: 'error'; readonly file: File; readonly message: string };

/**
 * Lee los metadatos del archivo elegido y descarta las respuestas obsoletas.
 *
 * - Cada `select` invalida la lectura anterior: la cancela (libera sus
 *   recursos) y aumenta un contador; una respuesta solo se aplica si su número
 *   coincide con el actual. Si se elige B antes de terminar A, A no sobrescribe B.
 * - Al desmontarse (cerrar el diálogo) cancela la lectura pendiente. Una nueva
 *   apertura monta un hook nuevo y no ve respuestas de la anterior.
 * - No modifica la playlist: solo informa el estado del archivo.
 */
export function useAudioFileReader(readMetadata: ReadAudioMetadata) {
  const [state, setState] = useState<AudioFileState>({ status: 'empty' });
  const requestRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const cancelPending = useCallback(() => {
    requestRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  useEffect(() => cancelPending, [cancelPending]);

  const select = useCallback(
    (file: File | null) => {
      cancelPending();
      if (file === null) {
        setState({ status: 'empty' });
        return;
      }
      const request = requestRef.current;
      const controller = new AbortController();
      controllerRef.current = controller;
      setState({ status: 'reading', file });

      const isCurrent = () => request === requestRef.current && !controller.signal.aborted;

      readMetadata(file, { signal: controller.signal }).then(
        ({ durationSeconds }) => {
          if (!isCurrent()) return;
          controllerRef.current = null;
          setState({ status: 'ready', file, durationSeconds });
        },
        (error: unknown) => {
          if (!isCurrent()) return;
          controllerRef.current = null;
          const message =
            error instanceof AudioImportError
              ? error.message
              : 'No se pudo leer el archivo. Vuelve a seleccionarlo.';
          setState({ status: 'error', file, message });
        },
      );
    },
    [cancelPending, readMetadata],
  );

  return { state, select };
}
