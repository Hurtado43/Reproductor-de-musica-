'use client';

import dynamic from 'next/dynamic';
import { memo, useCallback, useEffect, useState } from 'react';
import styles from '../player.module.css';
import { SILENT_AUDIO_INPUT, type OrbAudioInput } from './orbAudio';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { chooseQualityProfile, isWebGLAvailable, type OrbQualityProfile } from './webgl';

/** El módulo WebGL solo se descarga y ejecuta en el navegador. */
const OrbCanvas = dynamic(() => import('./OrbCanvas'), { ssr: false });

/** Bloom + tone mapping activados. */
const POSTPROCESSING = true;

type SceneStatus =
  | { kind: 'checking' }
  | { kind: 'unsupported' }
  | { kind: 'loading'; profile: OrbQualityProfile }
  | { kind: 'ready'; profile: OrbQualityProfile }
  | { kind: 'failed'; reason: 'error' | 'context-lost' };

interface VisualizerProps {
  /**
   * Niveles de audio para la esfera: objeto estable que el medidor actualiza
   * fuera de React con datos reales del `AnalyserNode` (ver `orbAudio.ts`).
   * Sin él, `SILENT_AUDIO_INPUT` (energía 0).
   */
  audio?: OrbAudioInput | undefined;
}

/**
 * Espacio de la esfera 3D (sustituye a `VisualizerSlot`).
 *
 * - El primer render (servidor y cliente) es siempre el marcador "Cargando…",
 *   del mismo tamaño que la escena: no hay salto al cargarla ni diferencias de
 *   hidratación. La comprobación de WebGL ocurre en un efecto, solo en el cliente.
 * - Con WebGL, carga `OrbCanvas` de forma dinámica (`ssr: false`). Cuando se
 *   dibuja el primer fotograma, retira el borde y el texto del marcador.
 * - Sin WebGL, o si la escena falla o pierde el contexto, muestra un estado
 *   alternativo; la playlist y la importación siguen funcionando.
 * - Es `memo` y no recibe datos de la playlist: cambiar de canción, abrir el
 *   diálogo o modificar la playlist no la vuelve a renderizar ni recrea la escena.
 */
export const Visualizer = memo(function Visualizer({ audio = SILENT_AUDIO_INPUT }: VisualizerProps) {
  const [status, setStatus] = useState<SceneStatus>({ kind: 'checking' });
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    setStatus(
      isWebGLAvailable() ? { kind: 'loading', profile: chooseQualityProfile() } : { kind: 'unsupported' },
    );
  }, []);

  const handleReady = useCallback(() => {
    setStatus((prev) => (prev.kind === 'loading' ? { kind: 'ready', profile: prev.profile } : prev));
  }, []);
  const handleError = useCallback(() => setStatus({ kind: 'failed', reason: 'error' }), []);
  const handleContextLost = useCallback(
    () => setStatus({ kind: 'failed', reason: 'context-lost' }),
    [],
  );
  const retry = () =>
    setStatus(
      isWebGLAvailable() ? { kind: 'loading', profile: chooseQualityProfile() } : { kind: 'unsupported' },
    );

  const showScene = status.kind === 'loading' || status.kind === 'ready';
  const unavailable = status.kind === 'unsupported' || status.kind === 'failed';

  return (
    <div className={styles.visualizerArea}>
      <div
        className={`${styles.visualizerSlot} ${status.kind === 'ready' ? styles.visualizerReady : ''}`}
        data-testid="visualizer"
        data-state={status.kind}
      >
        {showScene && (
          <div className={styles.visualizerCanvas} aria-hidden="true">
            <SceneErrorBoundary onError={handleError}>
              <OrbCanvas
                detail={status.profile.detail}
                maxDpr={status.profile.maxDpr}
                multisampling={status.profile.multisampling}
                reducedMotion={reducedMotion}
                postprocessing={POSTPROCESSING}
                audio={audio}
                onReady={handleReady}
                onContextLost={handleContextLost}
              />
            </SceneErrorBoundary>
          </div>
        )}

        {(status.kind === 'checking' || status.kind === 'loading') && (
          <span className={styles.visualizerLabel}>Cargando visualización 3D…</span>
        )}

        {unavailable && (
          <div className={styles.visualizerFallback} role="status">
            <p>
              {status.kind === 'unsupported'
                ? 'La visualización 3D no está disponible en este navegador (WebGL desactivado o no compatible).'
                : status.reason === 'context-lost'
                  ? 'La visualización 3D se interrumpió (el navegador liberó el contexto gráfico).'
                  : 'No se pudo iniciar la visualización 3D.'}
            </p>
            <p>La playlist y la importación de canciones siguen funcionando.</p>
            {status.kind === 'failed' && (
              <button type="button" className={styles.secondaryButton} onClick={retry}>
                Reintentar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
