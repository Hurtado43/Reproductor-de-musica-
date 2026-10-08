import { useEffect, useState, useSyncExternalStore } from 'react';
import type { OrbAudioInput } from '../visualizer/orbAudio';
import { AudioEngine, type PlaybackEnvironment, type PlaybackSnapshot } from './AudioEngine';
import { AudioLevelsMeter, type FrameScheduler } from './AudioLevelsMeter';

export type PlaybackHookEnvironment = Partial<PlaybackEnvironment & FrameScheduler>;

/**
 * Un `AudioEngine` y un `AudioLevelsMeter` por montaje del reproductor.
 *
 * - Crear las instancias no crea el elemento de audio ni el `AudioContext`: se
 *   crean en el navegador, el elemento al cargar una canción y el contexto al
 *   primer intento de reproducir (desde un manejador de eventos).
 * - El estado llega a React con `useSyncExternalStore`. En el servidor siempre
 *   es el estado vacío, igual que el primer render del cliente.
 * - `audioInput` es la entrada estable de la esfera: el medidor escribe en ella
 *   sin estado de React.
 * - Al desmontar, el medidor cancela su fotograma y `dispose()` detiene el
 *   audio, quita los listeners, revoca la URL, desconecta los nodos y cierra el
 *   contexto. En Strict Mode (montar → limpiar → montar), las instancias siguen
 *   sirviendo: el motor crearía elemento, contexto y nodo fuente nuevos en la
 *   siguiente carga, nunca dos a la vez ni un nodo de un contexto cerrado.
 */
export function usePlayback(environment?: PlaybackHookEnvironment): {
  engine: AudioEngine;
  playback: PlaybackSnapshot;
  audioInput: OrbAudioInput;
} {
  const [engine] = useState(() => new AudioEngine(environment));
  const [meter] = useState(() => new AudioLevelsMeter(engine, environment));
  const playback = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  useEffect(() => meter.connect(), [meter]);
  useEffect(() => () => engine.dispose(), [engine]);
  return { engine, playback, audioInput: meter.input };
}
