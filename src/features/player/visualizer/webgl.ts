/**
 * `true` si el navegador puede crear un contexto WebGL (2 o 1).
 * Solo debe llamarse en el cliente (dentro de un efecto). Libera el contexto
 * de prueba para no ocupar uno de los pocos que permite el navegador.
 */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as
      | WebGLRenderingContext
      | WebGL2RenderingContext
      | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Calidad de la escena según el dispositivo. */
export interface OrbQualityProfile {
  /** Subdivisión del icosaedro. */
  detail: number;
  /** Device pixel ratio máximo. */
  maxDpr: number;
  /** Muestras MSAA del compositor. */
  multisampling: number;
}

export const DESKTOP_PROFILE: OrbQualityProfile = { detail: 28, maxDpr: 1.5, multisampling: 4 };
export const MOBILE_PROFILE: OrbQualityProfile = { detail: 18, maxDpr: 1.25, multisampling: 2 };

/**
 * Elige el perfil una sola vez al montar (pantalla estrecha o puntero táctil →
 * móvil). No se recalcula al redimensionar, para no recrear la geometría.
 */
export function chooseQualityProfile(): OrbQualityProfile {
  const mobile =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
  return mobile ? MOBILE_PROFILE : DESKTOP_PROFILE;
}
