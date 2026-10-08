/**
 * Configuración de pruebas para jsdom (SIMULACIONES; no son el navegador real).
 *
 * - `HTMLCanvasElement.getContext` devuelve `null`, como un navegador sin WebGL:
 *   las pruebas de componentes ven el estado alternativo de la esfera.
 * - jsdom no implementa la reproducción de `HTMLMediaElement` (escribe
 *   "Not implemented" en la consola). Aquí `load`, `pause` y `play` no hacen
 *   nada (`play` devuelve una promesa resuelta y el elemento sigue en pausa).
 *   Las pruebas que verifican la reproducción usan su propio elemento simulado
 *   y controlable; la reproducción real se comprueba en el navegador.
 * - `URL.createObjectURL`/`revokeObjectURL` devuelven URLs ficticias si jsdom no los tiene.
 */
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function getContext() {
    return null;
  } as typeof HTMLCanvasElement.prototype.getContext;
}

if (typeof HTMLMediaElement !== 'undefined') {
  HTMLMediaElement.prototype.load = function load() {};
  HTMLMediaElement.prototype.pause = function pause() {};
  HTMLMediaElement.prototype.play = function play() {
    return Promise.resolve();
  };
}

if (typeof window !== 'undefined' && typeof URL.createObjectURL !== 'function') {
  let next = 0;
  URL.createObjectURL = () => `blob:jsdom-${++next}`;
  URL.revokeObjectURL = () => {};
}
