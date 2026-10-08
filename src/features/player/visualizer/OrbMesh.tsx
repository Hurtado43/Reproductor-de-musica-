'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Mesh, MeshPhysicalMaterial } from 'three';
import type { OrbAudioInput } from './orbAudio';
import { OrbDeformer } from './orbGeometry';
import { OrbAnimator } from './orbMotion';

/** Aspecto del material: base oscura, reflejos definidos y clearcoat moderado. */
export const ORB_MATERIAL = {
  /** Casi negro con un matiz granate: las zonas sin reflejo quedan oscuras. */
  color: '#24090e',
  /** Metal: el color visible viene de los reflejos del entorno (rojo y blanco). */
  metalness: 0.88,
  /** Bajo para reflejos nítidos, pero no 0: conserva el degradado de los pliegues. */
  roughness: 0.26,
  clearcoat: 0.55,
  clearcoatRoughness: 0.14,
  /** Intensidad de los reflejos en reposo. */
  envMapIntensity: 1.7,
  /** Aumento máximo de los reflejos con agudos (principal) y energía global (fase 3B). */
  envMapIntensityTrebleBoost: 0.45,
  envMapIntensityEnergyBoost: 0.15,
} as const;

export { ORB_AUDIO_SMOOTHING } from './orbMotion';

interface OrbMeshProps {
  detail: number;
  reducedMotion: boolean;
  /** Niveles de audio reales (fase 3B), escritos fuera de React por el medidor. */
  audio: OrbAudioInput;
  /** Se llama una sola vez, tras dibujar el primer fotograma. */
  onFirstFrame?: (() => void) | undefined;
}

/**
 * Malla de la esfera.
 *
 * - La geometría y el deformador se crean una vez por nivel de detalle y se
 *   liberan al desmontar.
 * - `useFrame` (prioridad 0, la predeterminada) actualiza la forma antes de que
 *   el `EffectComposer` (prioridad 1) haga el render. No toca estado de React.
 * - Fase 5: no hay movimiento ambiental. `OrbAnimator` solo avanza con la
 *   entrada activa (reproducción confirmada y señal real) y lo hace con su
 *   propio tiempo musical, nunca con el reloj absoluto. Si no cambia nada, ni
 *   siquiera se vuelve a deformar. En reposo la forma es una esfera perfecta;
 *   al perder la señal, el animador la devuelve a la esfera y se detiene.
 * - Con movimiento reducido la esfera no se mueve, aunque suene música.
 */
export function OrbMesh({ detail, reducedMotion, audio, onFirstFrame }: OrbMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<MeshPhysicalMaterial>(null);
  const firstFrameRef = useRef(false);
  const invalidate = useThree((state) => state.invalidate);
  // Un animador por montaje: conserva el tiempo musical, la rotación y los niveles.
  const animator = useMemo(() => new OrbAnimator(), []);

  const deformer = useMemo(() => new OrbDeformer(detail), [detail]);
  useEffect(() => () => deformer.dispose(), [deformer]);

  /** Escribe el estado del animador en la malla (forma, rotación y brillo). */
  const draw = useRef((target: OrbDeformer) => {
    const { levels } = animator;
    target.apply(animator.musicTime, levels.energy, levels.bass);
    const mesh = meshRef.current;
    if (mesh) mesh.rotation.set(animator.tilt, animator.rotationY, 0);
    const material = materialRef.current;
    if (material) {
      material.envMapIntensity =
        ORB_MATERIAL.envMapIntensity +
        levels.treble * ORB_MATERIAL.envMapIntensityTrebleBoost +
        levels.energy * ORB_MATERIAL.envMapIntensityEnergyBoost;
    }
  }).current;

  // Forma inicial (y al cambiar el detalle o la preferencia de movimiento):
  // el estado actual del animador, sin avanzar nada.
  useEffect(() => {
    draw(deformer);
    invalidate();
  }, [deformer, reducedMotion, draw, invalidate]);

  useFrame((_state, delta) => {
    if (!firstFrameRef.current) {
      firstFrameRef.current = true;
      onFirstFrame?.();
    }
    // Sin reproducción confirmada con señal real (o con movimiento reducido)
    // no avanza nada: el último fotograma queda tal cual.
    if (animator.step(delta, audio.current, reducedMotion)) draw(deformer);
  });

  return (
    <mesh ref={meshRef} geometry={deformer.geometry}>
      <meshPhysicalMaterial
        ref={materialRef}
        color={ORB_MATERIAL.color}
        metalness={ORB_MATERIAL.metalness}
        roughness={ORB_MATERIAL.roughness}
        clearcoat={ORB_MATERIAL.clearcoat}
        clearcoatRoughness={ORB_MATERIAL.clearcoatRoughness}
        envMapIntensity={ORB_MATERIAL.envMapIntensity}
      />
    </mesh>
  );
}
