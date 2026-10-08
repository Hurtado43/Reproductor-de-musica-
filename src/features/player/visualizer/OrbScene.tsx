'use client';

import { Environment, Lightformer } from '@react-three/drei';
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import type { OrbAudioInput } from './orbAudio';
import { OrbMesh } from './OrbMesh';

interface OrbSceneProps {
  detail: number;
  reducedMotion: boolean;
  audio: OrbAudioInput;
  /** Bloom + tone mapping. Sin él se ve el material tal cual (revisión). */
  postprocessing: boolean;
  /** Muestras de MSAA del compositor (menos en móvil). */
  multisampling: number;
  onFirstFrame?: (() => void) | undefined;
}

/**
 * Entorno de reflejos generado dentro de la escena con `Lightformer` (sin HDR
 * remotos). Se renderiza una sola vez (`frames={1}`) porque las luces no se
 * mueven: la esfera gira y se deforma, y sus reflejos cambian con ella.
 *   - Paneles rojos a los lados → reflejos carmín amplios.
 *   - Tiras blancas arriba y al frente → brillos blancos definidos.
 *   - Un relleno rojo muy tenue desde el frente → se lee el volumen.
 *   - El resto del entorno es negro → zonas oscuras entre los reflejos.
 */
function OrbEnvironment() {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" color="#f04452" intensity={3} position={[-3, 0.4, 1.6]} rotation={[0, Math.PI / 2.6, 0]} scale={[6, 4.5, 1]} />
      <Lightformer form="rect" color="#c62f3b" intensity={2} position={[3.2, -0.6, -0.4]} rotation={[0, -Math.PI / 2.2, 0]} scale={[5, 3.5, 1]} />
      <Lightformer form="rect" color="#ffffff" intensity={4} position={[0.4, 3.2, 1.2]} rotation={[Math.PI / 2, 0, 0]} scale={[5, 0.7, 1]} />
      <Lightformer form="rect" color="#ffffff" intensity={1.4} position={[1.6, 0.9, 3.5]} scale={[0.8, 2.2, 1]} />
      {/* Relleno rojo tenue desde la cámara: el volumen se lee sin aclarar las zonas oscuras. */}
      <Lightformer form="rect" color="#a52634" intensity={0.55} position={[0, -0.4, 5]} scale={[7, 7, 1]} />
      <Lightformer form="ring" color="#ff8b91" intensity={1.2} position={[-0.6, -2.6, 2.4]} rotation={[-Math.PI / 3, 0, 0]} scale={1.4} />
    </Environment>
  );
}

/**
 * Escena de la esfera.
 *
 * Orden del render: `EffectComposer` registra su `useFrame` con prioridad 1 y
 * pasa a hacer el render; la malla actualiza la forma en prioridad 0, antes.
 * No hay otras prioridades positivas. Bloom moderado con umbral alto (solo los
 * brillos) y tone mapping ACES explícito: con el compositor, el renderer no
 * aplica el tone mapping al final.
 */
export function OrbScene({
  detail,
  reducedMotion,
  audio,
  postprocessing,
  multisampling,
  onFirstFrame,
}: OrbSceneProps) {
  return (
    <>
      <OrbEnvironment />
      <OrbMesh detail={detail} reducedMotion={reducedMotion} audio={audio} onFirstFrame={onFirstFrame} />
      {postprocessing && (
        <EffectComposer multisampling={multisampling}>
          <Bloom intensity={0.6} luminanceThreshold={0.55} luminanceSmoothing={0.25} mipmapBlur />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </>
  );
}
