import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import type { PlaybackSnapshot, PlaybackStatus } from '../audio/AudioEngine';
import { formatDuration } from '../format';
import { REPEAT_LABEL, type RepeatMode } from '../repeatMode';
import styles from '../player.module.css';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  MutedIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
  VolumeIcon,
} from './icons';

/** Segundos que avanzan o retroceden las flechas sobre la barra de progreso. */
export const SEEK_STEP_SECONDS = 5;

const STATUS_LABEL: Record<PlaybackStatus, string> = {
  empty: 'Sin canción',
  loading: 'Cargando…',
  paused: 'En pausa',
  playing: 'Reproduciendo',
  buffering: 'Esperando datos…',
  ended: 'Finalizada',
  error: 'Error',
};

interface PlaybackControlsProps {
  playback: PlaybackSnapshot;
  hasPrevious: boolean;
  hasNext: boolean;
  onTogglePlay(): void;
  onPrevious(): void;
  onNext(): void;
  onSeek(seconds: number): void;
  onVolume(volume: number): void;
  onToggleMute(): void;
  /** Modo de repetición (fase 4B) y su cambio cíclico. */
  repeatMode: RepeatMode;
  onCycleRepeat(): void;
  /** Reproducción aleatoria (fase 5): activada o no, y su cambio. */
  shuffle: boolean;
  onToggleShuffle(): void;
  /**
   * Lee `currentTime` del elemento de audio real (fase 4B). Mientras suena, la
   * barra lo consulta en cada fotograma para avanzar sin saltos. `null` si no
   * hay elemento.
   */
  readCurrentTime?: (() => number | null) | undefined;
  /** Deshabilita volumen, silencio y repetición (mientras se restauran las preferencias guardadas). */
  preferencesDisabled?: boolean | undefined;
}

/** Tiempo legible para la barra: "m:ss" (o "h:mm:ss"). */
function clock(seconds: number): string {
  return formatDuration(Number.isFinite(seconds) ? seconds : 0);
}

const raf = (callback: () => void): unknown =>
  typeof requestAnimationFrame === 'function' ? requestAnimationFrame(callback) : setTimeout(callback, 16);
const cancelRaf = (handle: unknown): void => {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle as number);
  else clearTimeout(handle as ReturnType<typeof setTimeout>);
};

interface SeekBarProps {
  playback: PlaybackSnapshot;
  onSeek(seconds: number): void;
  readCurrentTime?: (() => number | null) | undefined;
}

/**
 * Barra de progreso (fase 4B: avance fluido).
 *
 * - El tiempo siempre sale del elemento real: del snapshot del motor (eventos
 *   `timeupdate`, `seeked`…) y, mientras suena, de `currentTime` leído en cada
 *   fotograma con `requestAnimationFrame`. No se suman intervalos.
 * - Esas lecturas escriben directamente en el DOM (valor, `--progress`,
 *   `aria-valuetext` y el tiempo transcurrido): no hay estado de React por
 *   fotograma ni renderizados del resto de la aplicación.
 * - El bucle solo existe con el estado "Reproduciendo" y se cancela al pausar,
 *   terminar, cambiar de canción o desmontar. Es independiente del bucle del
 *   analizador (que no lee el tiempo).
 * - Mientras el usuario arrastra (ratón o tacto), las lecturas automáticas no
 *   mueven la barra: manda la interacción.
 */
function SeekBar({ playback, onSeek, readCurrentTime }: SeekBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const elapsedRef = useRef<HTMLSpanElement>(null);
  const scrubbingRef = useRef(false);

  const hasSong = playback.songId !== null;
  const duration = playback.duration;
  const canSeek = hasSong && duration !== null && playback.status !== 'error';
  const total = duration ?? 0;
  // El total se redondea hacia arriba, como la duración de la lista.
  const totalLabel = duration === null ? '–:––' : clock(Math.ceil(total));

  // Lo que necesita `paint` en el momento (sin recrear funciones por fotograma).
  const view = useRef({ canSeek, total, totalLabel });
  view.current = { canSeek, total, totalLabel };

  const paint = useRef((seconds: number) => {
    const input = inputRef.current;
    const elapsedEl = elapsedRef.current;
    if (!input || !elapsedEl) return;
    const { canSeek: seekable, total: length, totalLabel: label } = view.current;
    const time = seekable ? Math.min(Math.max(Number.isFinite(seconds) ? seconds : 0, 0), length) : 0;
    const fraction = seekable && length > 0 ? time / length : 0;
    input.value = String(time);
    input.style.setProperty('--progress', `${(fraction * 100).toFixed(3)}%`);
    // El texto solo cambia una vez por segundo: no se reescribe en cada fotograma.
    const elapsedText = clock(time);
    const valueText = `${elapsedText} de ${label}`;
    if (input.getAttribute('aria-valuetext') !== valueText) input.setAttribute('aria-valuetext', valueText);
    if (elapsedEl.textContent !== elapsedText) elapsedEl.textContent = elapsedText;
  }).current;

  // Cada render (pausa, seek, cambio de canción, final…) pinta el tiempo del snapshot.
  useLayoutEffect(() => {
    if (!scrubbingRef.current) paint(playback.currentTime);
  });

  // Mientras suena: un fotograma, una lectura de currentTime del elemento real.
  const playing = playback.status === 'playing' && canSeek && readCurrentTime !== undefined;
  useEffect(() => {
    if (!playing || !readCurrentTime) return;
    let handle: unknown = null;
    const tick = () => {
      if (!scrubbingRef.current) {
        const time = readCurrentTime();
        if (time !== null) paint(time);
      }
      handle = raf(tick);
    };
    handle = raf(tick);
    return () => cancelRaf(handle);
  }, [playing, readCurrentTime, playback.songId, paint]);

  const handleSeekKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!canSeek) return;
    const elapsed = Number(inputRef.current?.value ?? playback.currentTime);
    const page = total * 0.1;
    const targets: Record<string, number> = {
      ArrowRight: elapsed + SEEK_STEP_SECONDS,
      ArrowUp: elapsed + SEEK_STEP_SECONDS,
      ArrowLeft: elapsed - SEEK_STEP_SECONDS,
      ArrowDown: elapsed - SEEK_STEP_SECONDS,
      PageUp: elapsed + page,
      PageDown: elapsed - page,
      Home: 0,
      End: total,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    onSeek(target);
  };

  const endScrub = () => {
    scrubbingRef.current = false;
  };

  return (
    <div className={styles.progress}>
      <input
        ref={inputRef}
        className={styles.seek}
        type="range"
        min={0}
        max={canSeek ? total : 1}
        step="any"
        defaultValue={0}
        disabled={!canSeek}
        aria-label="Posición en la canción"
        onPointerDown={() => {
          scrubbingRef.current = true;
        }}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onBlur={endScrub}
        onChange={(event) => {
          const target = Number(event.target.value);
          paint(target);
          onSeek(target);
        }}
        onKeyDown={handleSeekKey}
      />
      <div className={styles.times} aria-hidden="true">
        <span ref={elapsedRef} data-testid="elapsed" />
        <span data-testid="duration">{totalLabel}</span>
      </div>
    </div>
  );
}

/**
 * Controles del reproductor: estado, aleatorio y repetición, progreso con
 * tiempos, transporte y volumen.
 *
 * - Todo lo que muestra sale del motor, que a su vez lee el elemento de audio.
 * - La barra es un `<input type="range">` nativo (ratón, tacto y teclado). Las
 *   flechas mueven ±5 s, RePág/AvPág ±10 % e Inicio/Fin van a los extremos.
 * - Sin canción, Reproducir y la barra están deshabilitados; el volumen y la
 *   repetición siguen activos porque son preferencias.
 */
export function PlaybackControls({
  playback,
  hasPrevious,
  hasNext,
  onTogglePlay,
  onPrevious,
  onNext,
  onSeek,
  onVolume,
  onToggleMute,
  repeatMode,
  onCycleRepeat,
  shuffle,
  onToggleShuffle,
  readCurrentTime,
  preferencesDisabled = false,
}: PlaybackControlsProps) {
  const uid = useId();
  const hasSong = playback.songId !== null;
  const volumePercent = Math.round(playback.volume * 100);

  const statusText =
    playback.error?.kind === 'blocked'
      ? playback.error.message
      : playback.error
        ? `${STATUS_LABEL.error}: ${playback.error.message}`
        : STATUS_LABEL[playback.status];

  return (
    <div className={styles.controls} data-status={playback.status}>
      <div className={styles.statusRow}>
        <p
          className={`${styles.playbackStatus} ${playback.error ? styles.playbackStatusError : ''}`}
          role="status"
          aria-live="polite"
          data-testid="playback-status"
        >
          {statusText}
        </p>
        <div className={styles.modeButtons} role="group" aria-label="Modos de reproducción">
          <button
            type="button"
            className={styles.modeButton}
            data-active={shuffle ? 'true' : undefined}
            onClick={onToggleShuffle}
            disabled={preferencesDisabled}
            aria-pressed={shuffle}
            aria-label="Aleatorio"
            title={shuffle ? 'Aleatorio activado' : 'Aleatorio desactivado'}
          >
            <ShuffleIcon width={18} height={18} />
          </button>
          <button
            type="button"
            className={styles.modeButton}
            data-mode={repeatMode}
            data-active={repeatMode !== 'off' ? 'true' : undefined}
            onClick={onCycleRepeat}
            disabled={preferencesDisabled}
            aria-describedby={`${uid}-repeat-hint`}
            title={`${REPEAT_LABEL[repeatMode]} (cambiar)`}
          >
            {repeatMode === 'one' ? <RepeatOneIcon width={18} height={18} /> : <RepeatIcon width={18} height={18} />}
            {/* Nombre accesible = modo actual; visualmente, el icono y su color. */}
            <span className={styles.visuallyHidden}>{REPEAT_LABEL[repeatMode]}</span>
          </button>
        </div>
        <span id={`${uid}-repeat-hint`} className={styles.visuallyHidden}>
          Cambia entre sin repetición, repetir playlist y repetir canción.
        </span>
      </div>

      <SeekBar playback={playback} onSeek={onSeek} readCurrentTime={readCurrentTime} />

      <div className={styles.controlsRow}>
        <div className={styles.transport} role="group" aria-label="Controles de reproducción">
          <button
            type="button"
            className={styles.roundButton}
            onClick={onPrevious}
            aria-disabled={!hasPrevious}
            aria-label="Anterior"
            title="Anterior"
          >
            <ArrowLeftIcon />
          </button>
          <button
            type="button"
            className={styles.playButton}
            onClick={onTogglePlay}
            disabled={!hasSong}
            aria-label={playback.wantsToPlay ? 'Pausar' : 'Reproducir'}
          >
            {playback.wantsToPlay ? <PauseIcon width={26} height={26} /> : <PlayIcon width={26} height={26} />}
          </button>
          <button
            type="button"
            className={styles.roundButton}
            onClick={onNext}
            aria-disabled={!hasNext}
            aria-label="Siguiente"
            title="Siguiente"
          >
            <ArrowRightIcon />
          </button>
        </div>

        <div className={styles.volume}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onToggleMute}
            disabled={preferencesDisabled}
            aria-pressed={playback.muted}
            aria-label="Silenciar"
            title={playback.muted ? 'Activar sonido' : 'Silenciar'}
          >
            {playback.muted || playback.volume === 0 ? <MutedIcon /> : <VolumeIcon />}
          </button>
          <input
            className={styles.volumeRange}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={playback.volume}
            disabled={preferencesDisabled}
            aria-label="Volumen"
            aria-valuetext={`${volumePercent} %${playback.muted ? ', silenciado' : ''}`}
            style={{ '--progress': `${volumePercent}%` } as CSSProperties}
            onChange={(event) => onVolume(Number(event.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
