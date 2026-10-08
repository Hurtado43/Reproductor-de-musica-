'use client';

import { Canvas } from '@react-three/fiber';
import type { OrbAudioInput } from './orbAudio';
import { OrbScene } from './OrbScene';

export interface OrbCanvasProps {
  detail: number;
  /** Resolución máxima del render (device pixel ratio). */
  maxDpr: number;
  multisampling: number;
  reducedMotion: boolean;
  /** Bloom + tone mapping. */
  postprocessing: boolean;
  audio: OrbAudioInput;
  /** Primer fotograma dibujado: la escena está lista. */
  onReady(): void;
  /** El navegador perdió el contexto WebGL. */
  onContextLost(): void;
}

/**
 * Canvas WebGL de la esfera. Solo se carga en el navegador (`next/dynamic`
 * con `ssr: false` desde `Visualizer`): este módulo nunca se ejecuta en el
 * servidor.
 *
 * - `dpr` limitado (1 a `maxDpr`): no renderiza a resolución nativa en
 *   pantallas densas.
 * - Sin controles de cámara ni eventos: el canvas tiene `pointer-events: none`,
 *   así que no captura clics ni el desplazamiento táctil.
 * - Fondo transparente: se ve el degradado del área principal.
 * - Con movimiento reducido, `frameloop="demand"`: solo dibuja cuando algo cambia.
 * - Al desmontarse, React Three Fiber libera el renderer y los objetos de la
 *   escena; la geometría propia la libera `OrbMesh`.
 */
export default function OrbCanvas({
  detail,
  maxDpr,
  multisampling,
  reducedMotion,
  postprocessing,
  audio,
  onReady,
  onContextLost,
}: OrbCanvasProps) {
  return (
    <Canvas
      dpr={[1, maxDpr]}
      frameloop={reducedMotion ? 'demand' : 'always'}
      camera={{ position: [0, 0, 4.1], fov: 38, near: 0.1, far: 20 }}
      gl={{ alpha: true, antialias: !postprocessing, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener(
          'webglcontextlost',
          (event) => {
            event.preventDefault();
            onContextLost();
          },
          { once: true },
        );
      }}
    >
      <OrbScene
        detail={detail}
        reducedMotion={reducedMotion}
        audio={audio}
        postprocessing={postprocessing}
        multisampling={multisampling}
        onFirstFrame={onReady}
      />
    </Canvas>
  );
}
