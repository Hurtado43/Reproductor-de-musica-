# Progreso del taller: Reproductor de Música

## Objetivo del taller

Crear en TypeScript un **reproductor de música real** cuya playlist se basa en una **lista doblemente enlazada**, con un frontend donde el usuario pueda:

- Agregar canciones (archivos MP3 reales de su dispositivo) al inicio, al final y en cualquier posición.
- Eliminar canciones.
- Avanzar a la siguiente canción y retroceder a la anterior.
- Usar otras funciones que se consideren pertinentes.

El producto final **reproduce los MP3 con sonido real** y muestra una **esfera 3D** (Three.js, React Three Fiber, drei y postprocessing) que reacciona al audio que suena.

> **Requisito definitivo (2026-10-07).** Reemplaza las decisiones anteriores que hablaban de "reproducción simulada" y de canciones creadas con un formulario manual. Ver "Requisitos para las fases siguientes".

## Stack definitivo

**Next.js (App Router) + TypeScript estricto**, con npm y CSS. Las pruebas usan Vitest (jsdom para los componentes). Se migró desde Vite el 2026-10-06 por decisión técnica del usuario (ver "Migración a Next.js").

## Plan de fases

| # | Fase | Estado |
|---|------|--------|
| 1 | Configuración y estructura de datos | Migrada a Next.js, pendiente de revisión |
| 2A | Playlist, interfaz e importación de MP3 | Implementada, pendiente de revisión (2026-10-07) |
| 2B | Esfera 3D | Implementada, pendiente de revisión (2026-10-07) |
| 3A | Reproducción real y controles | Implementada, pendiente de revisión (2026-10-07) |
| 3B | Análisis del audio y reacción de la esfera | Implementada, pendiente de revisión (2026-10-07) |
| 4A | Persistencia de la playlist y los archivos (IndexedDB) | Aceptada para continuar (2026-10-07) |
| 4B | Funciones adicionales y ajustes (búsqueda, repetición, vaciar, progreso fluido, títulos largos) | Aceptada para continuar (2026-10-07) |
| 5 | Esfera estática y aleatorio (A); revisión y entrega (B) | **Implementada, pendiente de revisión** (2026-10-07) |

## Fase actual

**Fase 5: implementada y pendiente de revisión (2026-10-07).** En reposo la esfera es redonda y quieta; solo la música real la deforma, y al pausar vuelve a la esfera (ajuste pedido por el usuario). Hay reproducción aleatoria con historial que no altera la lista enlazada, botones de modo de 44×44 px, revisión final del taller y documentación de entrega (`README.md`, `docs/entrega.md`, `docs/sustentacion.md`). Detalle en "Fase 5" más abajo.

## Estado para retomar

> Se actualiza al completar cada bloque de trabajo significativo. Instrucciones comunes en `AGENTS.md`.

- **Fase vigente:** 5, **implementada y pendiente de revisión** del usuario. Las fases 4A y 4B se aceptaron para continuar; las anteriores siguen pendientes de revisión formal. **No hay otra fase autorizada.**
- **Ajuste visual autorizado y completado (2026-10-07):** nombre **the protoype** en la interfaz y la pestaña; fondo blanco cálido, superficies blancas, texto oscuro y acentos carmín. Se adaptaron botones, barras, búsqueda, selección, diálogos, errores, foco y sombras. La esfera conserva su comportamiento y usa reflejos rojos y blancos. Decisión vigente en `docs/diseno-ui.md` y `AGENTS.md`.
  - Archivos: `src/app/globals.css`, `src/app/layout.tsx`, `src/features/player/player.module.css`, `components/Player.tsx`, `visualizer/OrbMesh.tsx`, `visualizer/OrbScene.tsx` (los tres últimos dentro de `src/features/player/`), documentación y captura `docs/the-protoype-ui.png`.
  - Verificaciones nuevas tras el cambio: `npm.cmd test` **434/434, 27 archivos**; `npm.cmd run typecheck` y `npm.cmd run build` **correctos, salida 0**. Las pruebas automatizadas de APIs de audio, IndexedDB y visualizador usan simulaciones; no acreditan audición real.
  - Navegador real **Edge/Chromium**, build de producción en puerto 3102: estado vacío, restauración terminada, nombre y título de pestaña, esfera renderizada, diálogo de importación, escritorio 1527×698 y móvil 375×812. Sin desbordamiento horizontal (ancho de documento 375 en móvil). Sin errores de consola; advertencia de dependencia por `THREE.Clock` obsoleto. No se importó ni escuchó audio ni se midieron FPS en este bloque.
  - El reinicio del entorno interrumpió las verificaciones; se repitieron después y estos son los resultados reales de la repetición. El servidor 3100 encontrado ya activo pertenece a una sesión anterior y no se detuvo.
- **Trabajo completado en la 5:**
  - Esfera redonda y quieta sin reproducción, que se deforma con la señal y vuelve a la esfera al pausar (`orbMotion.ts`, `orbIntensity`, `active` en la entrada; ajuste posterior a petición del usuario).
  - Aleatorio (`shuffle.ts`), integrado en el reproductor y guardado como preferencia.
  - Botones de aleatorio y repetición de 44×44 px.
  - Revisión final con MP3 especiales, verificación en desarrollo y en producción.
  - Documentación de entrega.
- **Archivos modificados:** ver la tabla "Archivos" de "Fase 5". **Cambios sin terminar:** ninguno.
- **Últimas verificaciones (2026-10-07, al cerrar la fase 5):**
  - `npm test`: **434/434** en 27 archivos (tras el ajuste de la esfera en reposo).
  - `npm run typecheck` y `npm run build`: correctos (código de salida 0).
  - **Linter:** no ejecutado; no hay ninguno configurado en el proyecto.
  - Navegador: verificación en desarrollo (puerto 3101) y secuencia final en producción (puerto 3100), con los resultados de "Fase 5".
- **Interrupción registrada:** un apagado del equipo cortó la sesión a mitad de la fase. Se retomó comprobando el estado real, sin rehacer trabajo.
- **Problemas y limitaciones conocidas:**
  - Audición no verificada (hay una comprobación manual en el README y en "Fase 5").
  - Duración estimada por el navegador en MP3 VBR sin cabecera Xing.
  - Solo se probó en Chromium.
  - Sin sincronización entre pestañas.
  - Más detalle en "Problemas pendientes y limitaciones".
- **Próximo paso:** revisión del usuario. Si la aprueba, el proyecto queda listo para la entrega; no se publica, despliega ni sube a un repositorio.
- **Punto de interrupción:** ninguno.
- **Servidores conocidos:** al cerrar la fase 5 se detuvieron los propios (3101, 3100 y el de archivos de prueba en 3198). En el bloque visual posterior se encontró un servidor previo en 3100 y se dejó intacto; el de verificación iniciado en 3102 se detuvo al terminar. Comprobar los puertos al retomar.

## Requisitos para las fases siguientes

Fijados el 2026-10-07. Estado: los de **reproducción** están implementados en la fase 3A; la **esfera** reacciona al audio real desde la 3B; la **persistencia** está implementada en la 4A. La interfaz no muestra controles que aparenten funciones sin implementar.

**Reproducción (fase 3A, implementada)**
- Se reproduce con un `HTMLAudioElement`, alimentado por el `File` guardado en el registro de fuentes (`AudioSourceRegistry`), con su propia URL temporal.
- Play y pausa controlan el audio real.
- El progreso y la duración salen del elemento de audio (`currentTime`, `duration`, `timeupdate`). **No** se avanza el progreso con un temporizador que sustituya al audio.
- La barra de progreso permite cambiar `currentTime`.
- El volumen modifica el sonido real (`element.volume` y `element.muted`). En la 3B se midió su efecto en la señal del grafo, justo antes de `destination` (ver "Fase 3B"); el efecto en los altavoces no se pudo escuchar.
- El evento `ended` avanza al nodo siguiente de la lista enlazada (`next`) y reproduce esa canción.
- Anterior y Siguiente usan los enlaces `prev` y `next` (como ya hacen en la fase 2A).
- Errores de carga, de reproducción y bloqueos de autoplay se muestran con estados visibles.

**Esfera reactiva (2B, 3B y fase 5 implementadas)**
- La escena WebGL va aislada en un componente cliente sin SSR (`Visualizer` → `OrbCanvas`).
- Web Audio API con `AnalyserNode` da los datos reales del sonido que suena.
- La deformación y el brillo responden a esos datos, con suavizado.
- **Prohibido** usar pulsaciones aleatorias o amplitudes inventadas para aparentar que reacciona a la música.
- ~~En pausa o sin canciones, la esfera puede tener un movimiento ambiental suave~~ (requisito sustituido en la fase 5): sin reproducción confirmada con señal real, la esfera es **redonda y quieta**; solo la música la deforma, al pausar vuelve a la esfera, y con `prefers-reduced-motion` no se mueve nunca.

**Persistencia (fase 4A, implementada)**
- Debe conservar **también los archivos de audio**, por ejemplo en IndexedDB. Guardar solo nombres y duraciones no cumple el objetivo.
- Implementada en IndexedDB (ver "Fase 4A"): los archivos se guardan como `Blob`/`File`, nunca en `localStorage` ni como URLs `blob:`.

**Pruebas**
- Se permiten datos ficticios y APIs simuladas en las pruebas automatizadas.
- La aplicación entregada debe funcionar con archivos y sonido reales, y cada simulación se identifica como tal.

## Versiones instaladas

| Paquete | Versión | Notas |
|---------|---------|-------|
| Node.js | 24.11.1 | Next 16.4 exige ≥ 20.9.0 |
| npm | 11.19.0 | |
| next | 16.4.0 | Etiqueta `latest` (estable) en npm el 2026-10-06 |
| react / react-dom | 19.3.0 | Next acepta `^18.2.0 \|\| ^19.0.0` |
| typescript | 7.0.2 | `next build` usa el `tsc` del proyecto (ver "Compatibilidad") |
| @types/react / @types/react-dom | 19.3.0 | |
| @types/node | 26.6.4 | |
| vitest | 5.0.3 | |
| vite | 8.3.3 | *Peer dependency* obligatoria de Vitest 5 |
| jsdom | 29.1.1 | La 30.x exige Node ≥ 24.15; la 29.1.1 admite `>=24.0.0` |
| @testing-library/react | 16.3.3 | Admite React `^18 \|\| ^19` |
| @testing-library/dom | 10.4.2 | |
| @testing-library/user-event | 14.6.7 | |
| three | 0.186.1 | **Fase 2B.** Dentro del rango de postprocessing (`>=0.168 <0.187`) |
| @react-three/fiber | 9.8.1 | **Fase 2B.** Exige React `>=19 <19.4` (aquí 19.3.0) y three `>=0.156` |
| @react-three/drei | 10.7.9 | **Fase 2B.** Exige React `^19` y Fiber `^9` |
| @react-three/postprocessing | 3.1.3 | **Fase 2B.** Exige Fiber `>=9.7.0` y postprocessing `^6.36.0` |
| postprocessing | 6.39.5 | **Fase 2B.** Exige three `>=0.168 <0.187` |
| @types/three | 0.186.0 | **Fase 2B**, desarrollo |

La revisión de la fase 2A (importación de MP3) no instaló ni cambió ninguna dependencia. En la fase 2B se instalaron las 6 de la tabla sin `--force` ni `--legacy-peer-deps`. `npm ls` no da errores, hay una sola copia de `three` y `npm audit` reporta 0 vulnerabilidades.

---

## Fase 5: esfera estática, aleatorio, revisión y entrega (2026-10-07)

### Antes de modificar

- Se leyeron `AGENTS.md` (no hay otros en subdirectorios), `CLAUDE.md`, `docs/progreso.md` y `docs/diseno-ui.md`. No había cambios locales ajenos.
- Estado real inicial: `npm test` **395/395** (24 archivos); `npm run typecheck` y `npm run build` correctos. **No hay linter** configurado ni `README.md` previo.
- **Interrupción:** la sesión se cortó (apagado del equipo) durante la actualización de expectativas de pruebas. Al retomar se comprobó qué se había aplicado (el cambio estaba hecho) y se continuó sin rehacer nada.

### A1. Esfera inmóvil sin reproducción (requisito nuevo)

**Cambio de requisito:** el movimiento ambiental deja de ser un requisito. La esfera solo se mueve con la música real.

- **`visualizer/orbMotion.ts` (`OrbAnimator`, sin React ni three):**
  - **Congelada** si `input.active` es `false` o hay `prefers-reduced-motion`: no avanzan la forma, la rotación, los niveles suavizados ni el brillo. Se conserva el último fotograma, sin transición a una forma de reposo.
  - **Tiempo musical propio:** `musicTime += delta · 2,5 · impulso` y `rotationY += delta · 0,25 · impulso`, con `impulso = clamp01(0,6·energía + 0,4·graves)` suavizados. Sin señal no avanzan: el ruido simplex da la forma, pero la señal gobierna su evolución y su intensidad. No se usa el reloj absoluto; el `delta` se recorta a 0,1 s.
  - **Suavizado único** (`ORB_AUDIO_SMOOTHING`): sube 12/18/10 por segundo (energía/graves/agudos) y baja 5/6/6. Por debajo de 0,01 un nivel pasa a 0, así que el movimiento se detiene en menos de 1 s tras un silencio real.
  - La inclinación del eje deriva del tiempo musical. La forma se recalcula siempre desde las direcciones base (`OrbDeformer`), sin acumular.
- **`OrbMesh.tsx`:** solo deforma cuando el animador indica un cambio. La forma inicial es la misma que la estática de movimiento reducido (t = 6,5).
- **Entrada `active`** (`orbAudio.ts`, `AudioLevelsMeter.ts`): es `true` solo con «Reproduciendo» confirmado por el motor, el contexto en marcha y datos reales (pasada la ventana de descarte). Pulsar Reproducir no basta. Con silencio real, volumen 0 o mute sigue `true`, con niveles 0.
- **Ajuste tras medir en el navegador:** con la caída anterior (3–5/s, umbral 0,002) el movimiento tardaba ~2,3 s en detenerse tras el silencio del archivo. Se pasó a 5–6/s con umbral 0,01: medido ~1,4 s, incluida la ventana del analizador y la granularidad de la medición.

### A2. Aleatorio y botones

- **`src/features/player/shuffle.ts` (`ShuffleNavigator`):** guarda solo ids. `history` + `cursor` y `pending` (candidatos del ciclo). El generador `RandomSource` es inyectable y la elección es uniforme: `floor(r · n)`.
- **Reglas implementadas:**
  - Siguiente: primero el historial adelantado; después un candidato al azar, nunca la actual. Sin candidatos devuelve `null` y el botón se deshabilita; los controles manuales no renuevan el ciclo.
  - Anterior: historial; sin historial, deshabilitado.
  - Al terminar: «Repetir canción» tiene prioridad (reinicia). Con «Sin repetición», candidatos y luego «Finalizada». Con «Repetir playlist», `newCycle` y la primera elección evita la última del ciclo anterior si hay al menos 2 canciones. Con una sola canción, se repite (no se inventa otra).
  - Selección manual → `select` (entra al historial y descarta el historial adelantado; sale de los candidatos).
  - Importar → `add` (candidato; no cambia la actual).
  - Eliminar → `remove` + `sync` con la alternativa que elige `Playlist` (en pausa, comportamiento existente).
  - Vaciar → `reset` (el modo sigue activo).
  - Activar → `start(actual, ids)`. Desactivar → `reset`; la canción se conserva y vuelve `prev`/`next`.
- **La selección efectiva siempre es `Playlist.select`:** el orden de la lista enlazada y el guardado no cambian.
- **Persistencia:** campo opcional `shuffle` (booleano) en `library`. Sin migración: base v1 y `schemaVersion` 1. Ausente → desactivado sin aviso; inválido → desactivado con aviso. El historial y los candidatos no se guardan: se reconstruyen al restaurar con `start`. Restaurar no reproduce.
- **Botones** (`PlaybackControls.tsx`):
  - **Aleatorio:** icono de flechas cruzadas, `aria-label` «Aleatorio» y `aria-pressed`.
  - **Repetición:** icono, con un «1» en «Repetir canción». Su nombre accesible es el modo, en texto visualmente oculto.
  - Ambos tienen 44×44 px de área (icono de 18 px). Inactivos: gris. Activos: turquesa con fondo y borde.
  - El área usa la separación de 8 px que ya había arriba y abajo (`margin-block: -8px`): no añade altura y no se solapa con la barra (medido: borde inferior del botón = borde superior de la barra).
- **Concurrencia:** el motor acepta un solo `ended` por carga y de la fuente vigente, así que un final tardío tras navegar no consume otro candidato (prueba). Cada clic consume como mucho un candidato.

### B. Revisión final del taller

| Aspecto | Comprobación | Resultado |
|---------|--------------|-----------|
| TypeScript estricto | `npm run typecheck` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`…) y dominio sin DOM | Correcto |
| Lista enlazada real | Inserción, eliminación y navegación pasan por `DoublyLinkedList`/`Playlist`; el aleatorio solo propone ids | Revisado en el código; pruebas de dominio y de aleatorio |
| Inserción al inicio, al final y en posición | Producción: C al inicio y Ritmo en la posición 2 | Correcto |
| Estados paralelos | `AudioSourceRegistry` (sincronizado por `PlaylistController`), `ShuffleNavigator` (solo ids, `sync` tras importar o eliminar) y `AudioEngine` (solo el id cargado) | Sin desincronizaciones encontradas |
| Recursos y Strict Mode | Un elemento, un contexto y una fuente; mismo canvas; restauración única | Pruebas en Strict Mode y navegador |
| MP3 especiales (generados con `@breezystack/lamejs` fuera del proyecto) | 4 minutos (3,8 MB); 22,05/32/48 kHz; ID3v2.3 con portada APIC de 1,5 MB; tasa variable sin cabecera Xing | Ver la tabla siguiente |

| Archivo | Importación | Duración detectada | Reproducción (analizador) |
|---------|-------------|--------------------|---------------------------|
| Larga 4 minutos (3 840 626 B) | Correcta | 4:01 (240,04 s) | 1 s por segundo; −16,7 dBFS; seek a 3:58 → final y avance |
| Tono 440 Hz a 22 050 Hz | Correcta | 5,07 s | −13,9 dBFS |
| Tono 440 Hz a 32 000 Hz | Correcta | 5,04 s | −13,9 dBFS |
| Tono 440 Hz a 48 000 Hz | Correcta | 5,04 s | −13,9 dBFS |
| ID3 con portada grande (1 596 622 B) | Correcta (la firma acepta ID3) | 6,03 s | −13,9 dBFS |
| VBR 64 + 192 kbps **sin cabecera Xing/VBRI** | Correcta | **24,14 s (real: 12 s)** | Suena entero; `ended` a los ~12 s y avanza. La barra muestra 0:25 de total. **Limitación:** el navegador estima la duración con la primera trama. Los VBR de LAME llevan cabecera Xing; no se pudo generar uno real (lamejs solo codifica CBR) |

- **Defectos encontrados y corregidos en esta fase:** la caída lenta del suavizado (ver A1) y el desbordamiento de 16 px a 1366×800 con títulos largos al ampliar los botones (ver A2).
- No se cambió la arquitectura.

### Ajuste posterior a petición del usuario: esfera redonda en reposo (2026-10-07)

**Cambio pedido:** en reposo (antes de reproducir, en pausa, al terminar o sin canciones) la esfera debe ser **redonda** (imagen de referencia del usuario). Al reproducir se deforma al ritmo de la música y, al pausar o parar, **vuelve a la forma original**. Sustituye a «congelar la forma deformada en el último fotograma» de la sección A1.

- **`orbGeometry.ts`:** nueva `orbIntensity(energía, graves) = clamp01(0,6·energía + 0,4·graves)`. Los pliegues de ruido se multiplican por esa intensidad, así que con niveles 0 el desplazamiento es 0: esfera perfecta.
- **`orbMotion.ts`:**
  - Sin reproducción confirmada (`active: false`), los niveles bajan a 0 con la caída del suavizado (5–6/s) y la esfera vuelve suavemente a la forma redonda. Al llegar a 0 (`atRest`) no se actualiza nada más: quieta.
  - Con `prefers-reduced-motion`, si estaba deformada vuelve a la esfera de una vez, sin animación, y después no se mueve.
  - El tiempo musical sigue sin usar el reloj absoluto, así que no hay salto al reanudar.
- **Pruebas cambiadas por el requisito nuevo:**
  - `orbMotion.test.ts`: «al pausar conserva el último fotograma» pasa a «al pausar vuelve suavemente a la esfera y después queda quieta», más una prueba de vuelta gradual sin saltos, otra de reposo inicial redondo y la de movimiento reducido ampliada.
  - `orbGeometry.test.ts`: «cambia con el tiempo (movimiento ambiental continuo)» pasa a «sin música es una esfera perfecta; con música cambia con el tiempo».
- **Verificación real** (Chromium, desarrollo, 1366×800; radios de la silueta en 72 direcciones sobre una copia de 160×160 px del canvas):
  - En reposo: variación de 1–1,5 px, que es solo la cuantización de los píxeles; es una esfera.
  - Reproduciendo el ritmo: 8–9 px, cambiando con la energía (0,70–0,95).
  - Tras pausar: 3 px a los 0,23 s y 1–1,5 px desde los 0,46 s; después, 0 valores distintos en 3 s.
  - Consola sin errores.
  - Capturas: `fase5-esfera-reposo.jpg` y `fase5-esfera-reproduciendo.jpg`.
- **Verificaciones:** `npm test` **434/434** (27 archivos); `npm run typecheck` y `npm run build` correctos.

### Archivos

| Acción | Archivo |
|--------|---------|
| Creado | `src/features/player/visualizer/orbMotion.ts`, `src/features/player/shuffle.ts` |
| Modificado | `visualizer/OrbMesh.tsx` (animador, sin reloj absoluto), `visualizer/orbAudio.ts` (`active`), `audio/AudioLevelsMeter.ts` (`active`) |
| Modificado | `components/Player.tsx` (aleatorio), `components/PlaybackControls.tsx` (botones de modo), `components/icons.tsx` (aleatorio), `player.module.css` |
| Modificado | `persistence/librarySchema.ts`, `persistence/LibraryPersistence.ts` (`shuffle`) |
| Creado | `tests/orbMotion.test.ts`, `tests/shuffle.test.ts`, `tests/PlayerShuffle.test.tsx` |
| Modificado | `tests/AudioLevelsMeter.test.ts`, `tests/PlaybackWebAudio.test.tsx`, `tests/librarySchema.test.ts`, `tests/LibraryPersistence.test.ts` |
| Creado | `README.md`, `docs/entrega.md`, `docs/sustentacion.md`, `docs/capturas/fase5-*.jpg` (2) |
| Modificado | `AGENTS.md`, `CLAUDE.md`, `docs/progreso.md`, `docs/diseno-ui.md` |

No se instaló ni cambió ninguna dependencia.

### Pruebas (432 en 27 archivos)

**Pruebas existentes modificadas, por el cambio de requisito:**
- `AudioLevelsMeter.test.ts` y `PlaybackWebAudio.test.tsx`: la entrada de la esfera tiene ahora `active`. Las expectativas `{energy, bass, treble}` pasan a incluir `active: false`.
- En los tres casos de «suena pero en silencio» (pasaje silencioso, volumen 0 y mute) pasan a `active: true` con niveles 0.
- Se renombró la prueba que hablaba de «movimiento ambiental».
- `LibraryPersistence.test.ts`: `shuffle: false` en los estados de prueba, porque el tipo lo exige. Ninguna expectativa cambió.

**Nuevas (37):**
- `orbMotion.test.ts` (9): inmóvil sin entrada activa; niveles altos sin confirmación; pausa que conserva el fotograma exacto; sin salto tras 10 min de pausa; movimiento reducido; reacción proporcional a la señal; detención con silencio real; impulso; sin acumulación.
- `AudioLevelsMeter.test.ts` (+1): `active` solo tras confirmar la reproducción y pasar la ventana de descarte.
- `shuffle.test.ts` (9, generador determinista): ciclos sin repetición; elección uniforme por índice; historial Anterior/Siguiente; agotamiento sin renovación manual; nuevo ciclo que evita la última; una sola canción; selección manual; importar y eliminar; reset.
- `PlayerShuffle.test.tsx` (14, jsdom, Strict Mode, audio y almacenamiento simulados):
  - Botón: `aria-pressed` y sin tocar el audio.
  - Navegación: Siguiente sin repetir, con orden visual y guardado intactos; historial; desactivar; clics rápidos.
  - Al terminar: los tres modos; una sola canción; final tardío.
  - Playlist: selección manual, eliminación, eliminar la actual y vaciar.
  - Preferencia restaurada sin reproducir, con datos antiguos e inválidos.
- `librarySchema.test.ts` (+3) y `LibraryPersistence.test.ts` (+1): compatibilidad y guardado de `shuffle`.

**Pruebas de mutación** (el código se restauró después de cada una):
- Los candidatos no se consumen → fallan 12.
- El aleatorio ignora «Repetir canción» → fallan 2.
- El nuevo ciclo no evita la última → falla 1.
- La esfera se mueve sin entrada activa → fallan 3.
- Tiempo musical sin depender de la señal (animación ambiental) → falla 1.

### Verificación en navegador real (Chromium del panel integrado)

**Servidores propios:**
- `next dev` en el puerto 3101 y `next start` en el 3100, con la configuración de `.claude/launch.json`.
- Un servidor de archivos de prueba en `127.0.0.1:3198` (scratchpad).
- Todos se detuvieron al terminar. No había servidores ajenos activos.

**Método:**
- MP3 generados: ritmo de 18 s con bombo (graves), charles (agudos), acorde y silencio digital de 8 a 11 s; tonos de 2,5 s; los archivos especiales.
- Viewport fijo de 1366×800 para las comparaciones.
- **Píxeles reales del canvas:** se copiaron a 160×160 en un fotograma y se contaron los valores distintos entre capturas (102 400 valores RGBA).
- Reproducir tras recargar y los botones de modo se pulsaron con clics y teclas reales. Algunas acciones posteriores usaron `click()` desde la página, con el `AudioContext` ya activo.

| Comprobación | Resultado |
|--------------|-----------|
| Antes de reproducir | 0 valores distintos en 5 s (desarrollo) y 4 s (producción); `active: false` |
| Con música (ritmo) | Energía 0,69–0,94, graves 0,65–1 y agudos 0–0,85; el canvas cambia 14 000–20 000 valores cada 250 ms y ~10 000–12 500 por fotograma |
| Silencio real del archivo (8–11 s) | Entrada 0 con `active: 1`; el movimiento decae y queda **idéntico (0)** desde ~1,4 s después de empezar el silencio; vuelve al reaparecer la música |
| Pausa | 0 valores distintos a los 300 ms, 5 s y 35 s; `currentTime` fijo |
| Reanudar tras 35 s de pausa | 7 fotogramas sin cambio (confirmación de `play()` y ventana de análisis) y después ~12 000 por fotograma, del mismo orden que antes de pausar: sin salto |
| Finalizada | 0 valores distintos en 4 s |
| Aleatorio (desarrollo) | A → C → B → Ritmo sin repetir; Siguiente deshabilitado al agotar; Anterior B, C, A y deshabilitado; Siguiente por el historial adelantado; orden visual idéntico |
| Aleatorio + repetir playlist (avance automático con seek cerca del final) | Historial adelantado (C → B → Ritmo) y dos ciclos completos de 4 sin repetir; cada ciclo nuevo empezó distinto de la última |
| Aleatorio + repetir canción | Ritmo 18,05 → 0,06 s, misma canción (prioridad) |
| Aleatorio + sin repetición | Pendientes B, C, A y «Finalizada» con Siguiente deshabilitado |
| Recarga | Aleatorio y repetición restaurados, «En pausa» en 0:00, mismo orden, ciclo reconstruido (Anterior deshabilitado) |
| 1366×800 con título de 10 líneas | Esfera (688, 84) de 320 px con título corto y largo; área principal sin desplazamiento (750/750); botones de modo de 44×44 |
| Móvil 375×812 | `scrollWidth` 375; esfera de 310 px; botones de 44×44 en (250, 556) y (298, 556); el centro de la esfera devuelve el contenedor (no captura gestos) |
| Teclado | Tab desde la caja del título → «Aleatorio» con `:focus-visible` (anillo turquesa); la barra espaciadora lo conmuta |
| **Secuencia final en producción** | Importar al final, al inicio y en la posición 2 → esfera inmóvil → reproducir (avance 1,01 s/s, `active`) → esfera en movimiento → pausar (tiempo y canvas fijos) → seek en pausa (0:12 de 0:19) → reanudar → volumen 50 % (−24,7 dBFS) → silencio (−∞, energía 0) → restaurar (−13,7 dBFS) → búsqueda «ALVAREZ» → Siguiente/Anterior → repetir playlist → aleatorio (3 distintas y Siguiente deshabilitado) → eliminar (guardado) → recargar (3 canciones, preferencias, en pausa, sin `AudioContext`) → vaciar con clics reales (guardado, foco en «Agregar canción») → recargar (vacía; preferencias conservadas; base v1, `schemaVersion` 1) |
| Consola e hidratación | Sin errores de la app ni de hidratación (desarrollo y producción); solo el aviso conocido `THREE.Clock`; servidores sin errores |

**Capturas** (`docs/capturas/`): `fase5-escritorio-1366x800-modos.jpg` (aleatorio y «Repetir playlist» activos, título largo) y `fase5-movil-375.jpg`. Las capturas son instantes aislados; la ausencia de movimiento y la reacción se midieron comparando píxeles, no con capturas.

### Comprobaciones no realizadas o con límites

- **Audición en altavoces:** no fue posible. **Comprobación manual para el usuario:**
  1. Importa un MP3, pulsa ▶ y confirma que se oye.
  2. Baja el volumen y silencia: el sonido debe bajar o callarse.
  3. Con «Repetir canción», espera al final: debe volver a sonar desde el principio.
- **FPS y fluidez percibida:** no se midieron; el panel limita a veces `requestAnimationFrame`.
- **`prefers-reduced-motion` en vivo:** no se puede emular en el panel; está cubierto por pruebas.
- **Otros navegadores y táctil real:** solo Chromium; sin Safari, Firefox ni dispositivos táctiles.
- **VBR real con cabecera Xing:** no se pudo generar; se probó un VBR sin cabecera (ver la tabla).
- **Música real:** en esta fase se usaron archivos generados. La canción real autorizada (`music.mp3`) se probó en la fase 3B.

---

## Fase 4B: funciones adicionales y ajustes de uso (2026-10-07)

### Antes de modificar

- Se leyeron `AGENTS.md` (no hay otros en subdirectorios), `CLAUDE.md`, `docs/progreso.md` ("Estado para retomar") y `docs/diseno-ui.md`. No había cambios locales posteriores a la 4A.
- Estado real inicial: `npm test` **364/364** (21 archivos), `npm run typecheck` y `npm run build` correctos (código de salida 0).

### Búsqueda en la playlist

- **Dónde:** campo «Buscar canción» (`type="search"`, con etiqueta accesible) en el encabezado de la playlist. Solo aparece cuando hay canciones.
- **Cómo filtra** (`src/features/player/songSearch.ts`, funciones puras): `normalizeForSearch` aplica NFD, quita las marcas diacríticas, pasa a minúsculas y normaliza los espacios. Una canción coincide si el título o el artista contienen el texto buscado. Una búsqueda vacía muestra todo.
- **Solo presentación:** `PlaylistPanel` guarda el texto en su propio estado. No cambia la lista enlazada, la selección, el audio, Anterior, Siguiente ni el avance automático, y no se guarda en IndexedDB.
- **Posiciones:** cada fila muestra su posición en la playlist completa («4. Adiós» aunque sea el único resultado). Seleccionar y eliminar usan siempre el **id**.
- **Estados:**
  - «La playlist está vacía.» (sin canciones) es distinto de «Ninguna canción coincide con «…».», que trae el botón «Limpiar búsqueda».
  - Una línea `role="status"` indica «N de M canciones» y, si la seleccionada queda oculta, «· la canción seleccionada no coincide». La canción sigue seleccionada y sonando.
- **Limpiar:** el botón ×, con el nombre accesible «Limpiar búsqueda», o Escape dentro del campo.
- **Foco tras eliminar con filtro:** pasa al vecino visible siguiente o anterior; si no queda ninguno visible, al encabezado «Playlist».

### Repetición real

- **Control:** botón en la línea de estado, sobre la barra, con icono y texto visible: «Sin repetición» → «Repetir playlist» → «Repetir canción». La descripción accesible explica el ciclo y cada cambio se anuncia.
- **Decisión al terminar** (`src/features/player/repeatMode.ts`, `actionAfterEnd`, función pura):

  | Modo | No es la última | Es la última | Una sola canción |
  |------|-----------------|--------------|------------------|
  | Sin repetición | Siguiente (`next`) y reproduce | «Finalizada», selección conservada | «Finalizada» |
  | Repetir playlist | Siguiente y reproduce | La primera y reproduce | La misma desde 0 |
  | Repetir canción | La misma desde 0 | La misma desde 0 | La misma desde 0 |

- **Integración:** en el manejador de `ended` de `Player`, que lee el modo vigente con una ref y la playlist en ese momento (`actions.peek()`). Repetir la misma canción llama a `engine.play()`: con el estado «Finalizada», el motor la reinicia desde 0.
  - **No se usa `HTMLAudioElement.loop`:** impediría recibir `ended` y coordinar con el motor.
  - Anterior y Siguiente no consultan el modo y conservan sus límites.
- **Concurrencia:** se apoya en las protecciones del motor.
  - `ended` se acepta una sola vez por carga y solo de la fuente vigente. Un `ended` tardío tras navegar o eliminar no avanza dos veces.
  - Un `play()` pendiente de una repetición se invalida al pausar.
  - Cambiar el modo justo antes de terminar se respeta.
- **Persistencia:** campo **opcional** `repeatMode` del registro `library`.
  - **Sin migración:** la base sigue en la versión 1 y el esquema en `schemaVersion` 1. Los registros anteriores no tienen el campo y equivalen a «Sin repetición», sin aviso. Un valor inválido también da «Sin repetición» y se informa en el aviso de restauración.
  - Se guarda como preferencia agrupada, igual que volumen y silencio, y restaurarla **nunca inicia audio**. Durante la restauración el botón está deshabilitado.

### Vaciar la playlist

- **Acción:** botón secundario «Vaciar playlist», con icono de papelera, junto a «Agregar canción». Solo aparece con canciones y está deshabilitado durante la restauración.
- **Confirmación** (`components/ClearPlaylistDialog.tsx`): `role="alertdialog"` y `aria-modal`.
  - Texto: «Se quitarán N canciones de la biblioteca de esta aplicación, también de la copia guardada en este navegador. Los archivos originales de tu dispositivo no se eliminan.»
  - Foco inicial en «Cancelar», Tab y Shift+Tab contenidos y Escape para cerrar. El resto de la interfaz queda `inert` y el foco vuelve al botón que lo abrió.
- **Confirmar** (`Player.handleConfirmClear`):
  1. `engine.unload()`: pausa, quita los listeners, desvincula el `src`, revoca la URL e invalida cualquier `play()` o `resume()` pendiente. Con el estado «Sin canción», el medidor escribe 0 en la esfera.
  2. `actions.clearAll()`, que llama a `PlaylistController.clear()` → `Playlist.clear()` + `AudioSourceRegistry.clear()`.
  3. La persistencia guarda el estado vacío en **una transacción**: borra todos los registros de canciones y escribe `order: []` y `selectedId: null`. Conserva volumen, silencio y repetición.
- **Errores:** los de la 4A. Si falla, no se dice «Guardado», nada se borra a medias y «Reintentar» guarda el estado vigente.
- **Cancelar:** no cambia nada ni interrumpe el audio.

### Progreso fluido

- **Antes:** la barra solo se movía con `timeupdate` (~4 veces por segundo), y en un tono de 8 s sobre 380 px daba saltos de unos 12 px.
- **Ahora** (`SeekBar` en `PlaybackControls.tsx`): mientras el estado es «Reproduciendo», un bucle `requestAnimationFrame` lee `currentTime` del **elemento real** (`readCurrentTime`, que viene del motor) y lo escribe directamente en el DOM.
  - Escribe el valor del rango, la variable `--progress` y, solo cuando cambia el segundo, `aria-valuetext` y el tiempo transcurrido.
  - **Sin estado de React por fotograma** y sin intervalos sumados.
  - El bucle se cancela al pausar, terminar, cambiar de canción o desmontar, y no tiene relación con el bucle del analizador.
  - Fuera de la reproducción, cada render pinta el tiempo del snapshot (pausa, seek, final, cambio de canción).
- **Interacción:** el rango es no controlado (`defaultValue`) para que React no lo pise.
  - Mientras se arrastra (`pointerdown` hasta `pointerup`, `pointercancel` o `blur`), las lecturas automáticas no lo mueven.
  - Se conservan el seek con ratón, tacto y teclado (flechas ±5 s, RePág/AvPág ±10 %, Inicio/Fin) y el estado de reproducción.

### Títulos largos y distribución

- **Caja del título** (`SelectedSong`): 2 líneas como máximo (3 si la ventana mide al menos 900 px de alto).
  - Si el título no cabe, la caja se desplaza: rueda, tacto o teclado, porque recibe foco con `role="region"` y `aria-label` «Título completo, desplazable».
  - Un degradado inferior indica que hay más texto; el título completo también está en `title`. Sin marquesinas.
  - El desbordamiento se detecta con `ResizeObserver`.
- **Corrección encontrada en el navegador:** el contorno de los acentos y descendentes sobresalía de la línea de 1,15 y la caja se marcaba como desplazable con títulos de una línea. Se corrigió con `padding-block: 0.15em` en el título y 0,3 em más de altura máxima.
- **Escritorio con poca altura** (`min-width: 768px` y `max-height: 860px`): la separación entre el encabezado y la columna baja a 16 px. El botón de repetición mide 24 px de alto.
- **Búsqueda y repetición sin saturar:** la búsqueda vive en el panel de la playlist; la repetición comparte línea con el estado y no añade altura.

### Archivos

| Acción | Archivo |
|--------|---------|
| Creado | `src/features/player/songSearch.ts`, `src/features/player/repeatMode.ts` |
| Creado | `src/features/player/components/ClearPlaylistDialog.tsx` |
| Modificado | `components/Player.tsx`: repetición en `ended`, vaciado, diálogos, `readCurrentTime` y foco tras eliminar con filtro |
| Modificado | `components/PlaylistPanel.tsx`: búsqueda, estados y «Vaciar playlist» |
| Modificado | `components/PlaybackControls.tsx`: `SeekBar` fluida y botón de repetición |
| Modificado | `components/SelectedSong.tsx`: caja de título desplazable |
| Modificado | `components/icons.tsx`: repetir, repetir una, buscar y papelera |
| Modificado | `playlistController.ts` (`clear`), `usePlaylist.ts` (`clearAll`, `peek`) |
| Modificado | `persistence/librarySchema.ts`, `persistence/LibraryPersistence.ts`: `repeatMode` |
| Modificado | `player.module.css`: estilos nuevos y ajustes de altura |
| Creado | `tests/songSearch.test.ts`, `tests/repeatMode.test.ts`, `tests/PlayerFeatures4B.test.tsx` |
| Modificado | `tests/librarySchema.test.ts` (+3), `tests/LibraryPersistence.test.ts` (+2), `tests/playlistController.test.ts` (+1) |
| Creado | `docs/capturas/fase4b-*.jpg` (3) |
| Modificado | `AGENTS.md`, `CLAUDE.md`, `docs/progreso.md` y `docs/diseno-ui.md` |

No se instaló ni cambió ninguna dependencia.

### Pruebas (395 en 24 archivos)

Las 364 anteriores siguen pasando. **Pruebas existentes modificadas:** en `LibraryPersistence.test.ts`, el ayudante `state()` y una llamada a `requestSave` añaden `repeatMode: 'off'`, porque `LibraryState` exige ahora el modo de repetición. No cambió ninguna expectativa.

Nuevas (31):

- **`songSearch.test.ts` (4, Node).** Normalización; título y artista con mayúsculas y acentos; búsqueda vacía; orden e índices completos.
- **`repeatMode.test.ts` (3, Node).** Ciclo, valores válidos y tabla de decisiones, incluida una sola canción.
- **`librarySchema.test.ts` (+3).** Datos sin el campo → sin repetición y sin aviso; valores válidos; valor inválido → sin repetición con aviso.
- **`LibraryPersistence.test.ts` (+2, almacenamiento SIMULADO).** La repetición se agrupa sin reescribir MP3; vaciar borra todo en una transacción y conserva las preferencias.
- **`playlistController.test.ts` (+1).** `clear` deja lista y registro vacíos y permite importar después.
- **`PlayerFeatures4B.test.tsx` (18, jsdom, Strict Mode, elemento de audio, almacenamiento y `requestAnimationFrame` SIMULADOS).**
  - Búsqueda: título y artista con mayúsculas y acentos y posiciones reales; sin coincidencias frente a vacía y limpiar; canción actual oculta sin cambio, sin interrumpir el audio y con Siguiente por la lista completa, sin guardar el filtro; seleccionar y eliminar por id.
  - Repetición: los tres modos; una sola canción con ambos modos; el modo vigente al terminar; final y pausa con `play()` pendiente; `ended` tardío tras navegar o eliminar; preferencia guardada, restaurada sin reproducir y con datos inválidos.
  - Vaciar: cancelar y Escape con foco devuelto y audio intacto; confirmar (audio detenido, URL revocada, todo vacío, guardado y preferencias conservadas); operaciones pendientes invalidadas; fallo de persistencia y reintento.
  - Barra: lecturas por fotograma sin `timeupdate` y cancelación al pausar; el arrastre manda sobre las lecturas.

**Pruebas de mutación** (el código se restauró después de cada una):
- Ignorar el modo de repetición → fallan 4.
- Vaciar sin `engine.unload()` → fallan 2.
- Sin protección de arrastre → falla 1.
- Sin bucle de la barra → fallan 2.

### Verificación en navegador real (Chromium del panel integrado)

**Método.**
- Tonos MP3 generados de 2,5 s (440, 660 y 880 Hz) y de 8 s (80 Hz), con títulos y artistas escritos en el diálogo (por ejemplo «José Álvarez»).
- Desarrollo: `next dev` propio en el puerto 3101 (el `next dev` ajeno del 3000 ya no respondía). Producción: `next start` en el puerto 3100.
- Reproducir, repetición, Vaciar, Cancelar y Escape se pulsaron con clics y teclas reales; el texto de búsqueda se escribió con teclas reales en desarrollo. Para filtrar, seleccionar o eliminar filas también se usaron eventos desde la página.

| Comprobación | Desarrollo | Producción |
|--------------|-----------|-----------|
| Búsqueda | «ALVAREZ» → «Canción corta» de José Álvarez («1 de 4 canciones») | Igual |
| Filtrar, seleccionar y eliminar un resultado | «corto» → 2 resultados con sus posiciones reales (2 y 3); seleccionar el 3; «660» → eliminar el resultado; «Ninguna canción coincide…»; orden final 1, 2, 3 sin la eliminada | Igual |
| Avance automático con la actual oculta | Filtro «grave» o «luis» mostrando solo la 3: suena 1 → 2 → 3 en orden completo | Igual |
| Sin repetición | En la última: «Finalizada», selección conservada | Igual |
| Repetir playlist | Última → primera, reproduciendo | Igual |
| Repetir canción | `currentTime` 8,02 → 0,00 en la misma canción | 2,51 → 0,00 y 2,53 → 0,03, dos veces seguidas |
| Recarga | «Repetir canción» restaurado, «En pausa» en 0:00 tras 3 s | Igual |
| Barra fluida | 121 actualizaciones en 2 s (todos los fotogramas), salto máximo 1,3 px, valor = `currentTime` | Con el panel visible: 121/121, salto máximo 1,7 px. Con el panel limitado a ~16 fps hubo un hueco de 1 s entre fotogramas (del navegador, no de la app); aun así la barra coincidió con el elemento (±0,006 s) |
| Título de 10 líneas a 1366×800 | Caja de 2 líneas (94 px) y desplazable; flechas reales → `scrollTop` 160. Esfera (688, 84) de 320 px con título corto y largo; Reproducir termina en y = 747; área principal sin desplazamiento (750/750) | Igual |
| Cancelar el vaciado mientras suena | Diálogo con «4 canciones»; Cancelar → el audio siguió (1 s en 1 s), energía de la esfera 0,857, foco en «Vaciar playlist» | Igual (1,01 s en 1 s, 3 canciones) |
| Confirmar el vaciado | Al instante, elemento en pausa y sin `src`, y energía 0. Después: «Guardado», 0 registros, `order` [], `repeatMode` "one", foco en «Agregar canción» | Igual. La base sigue en la versión 1 con `schemaVersion` 1 |
| Tras recargar | Playlist vacía, sin búsqueda ni «Vaciar», repetición conservada | Igual |
| Canvas, audio y errores | Mismo `<canvas>`, 1 elemento, 1 `AudioContext`; consola sin errores | Igual; solo el aviso conocido `THREE.Clock`; servidores sin errores |
| Móvil 375×812 | `scrollWidth` 375; esfera de 310 px; controles dentro del ancho (repetición de 24 px de alto); el centro de la esfera devuelve el contenedor, no el canvas; diálogo de vaciado de 343×292, completo, con el foco en «Cancelar» | — |

**Capturas** (`docs/capturas/`):
- `fase4b-escritorio-1366x800-titulo-largo.jpg`: desarrollo, título de 10 líneas en su caja de 2 líneas.
- `fase4b-produccion-escritorio-busqueda.jpg`: producción, 1366×800, búsqueda «cort» con 2 de 3 resultados.
- `fase4b-movil-375.jpg`: móvil con título largo, repetición y controles.

### Comprobaciones no realizadas o con límites

- **Audición:** no se escuchó; la evidencia es el estado del elemento, `currentTime` y los niveles del analizador.
- **FPS de la esfera y fluidez percibida:** no se midieron. Para la barra se midieron las actualizaciones por fotograma del panel, que a veces limita `requestAnimationFrame`.
- **Táctil real:** el desplazamiento táctil de la caja del título y el arrastre de la barra con el dedo no se probaron en un dispositivo; se probaron el teclado y los eventos de puntero.
- **Foco tras Escape en móvil:** en esa prueba el diálogo se abrió con `.click()` desde la página, que no enfoca el botón, y el foco volvió a `body`. Con clics reales (escritorio, desarrollo y producción) y en las pruebas automáticas, el foco vuelve a «Vaciar playlist».
- **`prefers-reduced-motion`, Safari y Firefox:** sin cambios en la 4B y sin probar en el panel.

---

## Fase 4A: persistencia de la playlist y los MP3 en IndexedDB (2026-10-07)

### Antes de modificar

- Se leyeron `CLAUDE.md`, `docs/progreso.md`, `docs/diseno-ui.md` y el código relacionado. No existía ningún `AGENTS.md` en el proyecto.
- Estado real comprobado (no copiado del informe anterior): `npm test` **318/318** (17 archivos), `npm run typecheck` correcto y `npm run build` correcto.
- **Ventana de descarte del analizador:** ya se calculaba con valores reales (`AudioLevelsMeter`: `currentTime + analyser.fftSize / context.sampleRate`), no con una constante. Da **46,4 ms a 44 100 Hz** y **42,7 ms a 48 000 Hz** (los "43 ms" del informe de la 3B eran el valor a 48 kHz). Se conservó la implementación y se añadió una prueba para ambas frecuencias; con una constante de 43 ms la prueba falla (mutación comprobada).

### Continuidad entre agentes

- **`AGENTS.md`** (nuevo, en la raíz): objetivo y requisitos, arquitectura, contratos, comandos de `package.json`, flujo de trabajo y cómo retomar. Solo instrucciones estables.
- **`CLAUDE.md`:** remite a `AGENTS.md` (instrucciones comunes) y a "Estado para retomar" (continuidad). Conserva su detalle específico. La tabla de fases separa 4A y 4B.
- **"Estado para retomar"** (arriba en este archivo): se actualizó al terminar cada bloque.

### Esquema de IndexedDB

Base `reproductor-musica`, **versión 1** (`persistence/librarySchema.ts`).

| Almacén | Clave | Contenido |
|---------|-------|-----------|
| `songs` | `id` | Un registro por canción: `id`, `title`, `artist` (`string \| null`), `durationSeconds` (entero del dominio), `preciseDurationSeconds`, `fileName`, `fileType`, `fileSize`, `lastModified`, `createdAt` y **`file` (el `File`/`Blob` real)** |
| `meta` | `key` | Registro `library`: `schemaVersion` (1), `order` (ids en orden), `selectedId` (`string \| null`), `volume`, `muted`, `revision` y `savedAt`. Tras una recuperación parcial, además, `library-before-recovery-<ms>` con una copia del registro original |

- Metadatos y archivo van en el **mismo registro**: no puede quedar uno sin el otro.
- La lista de ids es solo el formato de almacenamiento: al restaurar se reconstruye la `DoublyLinkedList` con `Playlist.add` y `Playlist.select`, sin tocar `head`, `tail`, `prev` ni `next`.
- **No se guardan:** URLs `blob:`, nodos de la lista, elementos de audio, `AudioContext`, nodos de Web Audio, objetos de three, base64 ni nada en `localStorage`. Tampoco el segundo de reproducción.
- **Dependencias:** ninguna nueva; IndexedDB nativo.

### Módulo de persistencia (`src/features/player/persistence/`, solo navegador)

| Archivo | Función |
|---------|---------|
| `librarySchema.ts` | Constantes, tipos, `validateStoredLibrary` (validación y recuperación) y `toStoredSong` |
| `indexedDbStorage.ts` | `IndexedDbLibraryStorage`: apertura diferida, `read` y `commit` en **una transacción** sobre los dos almacenes, errores tipados (`unavailable`, `blocked`, `incompatible`, `quota`, `aborted`, `failed`), `versionchange` y cierre cuando no hay operaciones |
| `LibraryPersistence.ts` | Coordinador sin React: restauración única, cola de guardado, estados y reintentos |
| `useLibraryPersistence.ts` | Una instancia por montaje y estado con `useSyncExternalStore`; `dispose()` al desmontar |
| `components/PersistenceStatus.tsx` | Estado accesible (`role="status"`), "Reintentar" e informe de lo no recuperado (`role="alert"`) |

Otros cambios: `PlaylistController.restore` y `usePlaylist.restoreLibrary`/`size`; `Player` (restauración y guardado); `PlaylistPanel` (`addDisabled`, `status`); `PlaybackControls` (`preferencesDisabled`); estilos `.persistence*` y `.restoreReport*`.

### Restauración

1. **Después del montaje cliente**, en un efecto. El servidor y el primer render del cliente muestran lo mismo ("Restaurando la biblioteca guardada…"), así que no hay diferencias de hidratación.
2. Mientras restaura: "Agregar canción", el volumen y el silencio están **deshabilitados**, y **no se guarda nada**, así la playlist vacía inicial nunca sobrescribe lo guardado.
3. **Validación** (`validateStoredLibrary`):
   - Versión de esquema mayor → incompatible (no se toca nada).
   - Por canción: id no vacío; archivo `Blob`/`File` no vacío; nombre; duración precisa finita y positiva; título y duración aceptados por `createSong` (el dominio).
   - Orden: ids únicos con canción válida. Si falta o está dañado el registro `library`, se ordena por `createdAt`.
   - Selección inválida → primera válida o `null`. Volumen fuera de [0, 1] → 1; silencio no booleano → `false`.
4. **Datos dañados:** las canciones inválidas no se muestran (nunca una canción sin archivo) y se informa cada problema. Sus registros **no se borran** y, antes de reescribir el registro `library`, se guarda una copia del original.
5. **Aplicación:** `actions.restoreLibrary` (solo sobre una playlist vacía), `engine.setVolume`/`setMuted` y `syncPlayback(false)`. La canción seleccionada queda **en pausa, al inicio**: solo se crea su URL temporal y el único elemento de audio. Restaurar **nunca llama a `play()`** y no crea el `AudioContext`.
6. **Strict Mode:** `restore()` memoriza su promesa (una sola lectura) y el efecto ignora la respuesta si se limpió. Tras desmontar, una restauración tardía no se aplica.

### Guardado consistente

- **Cuándo:** un efecto sobre el snapshot de la playlist (importar, eliminar, seleccionar, Anterior/Siguiente y avance automático) y otro sobre volumen y silencio. Nunca por fotograma ni por `timeupdate`, y sin depender de `beforeunload`.
- **Agrupación:** los cambios de volumen y silencio esperan 400 ms sin cambios; los de playlist se guardan enseguida.
- **Una transacción por guardado**, con solo lo necesario: `put` de los MP3 que aún no están guardados, `delete` de los eliminados y el registro `library`. Cambiar la selección o las preferencias **no reescribe los MP3**.
- **Sin escrituras antiguas:** una sola transacción en curso. Lo que llega mientras tanto se fusiona y se escribe después con el **estado más reciente**; `revision` crece con cada escritura confirmada.
- **Sin estados parciales:** IndexedDB aplica toda la transacción o nada. El estado conocido en disco (`persistedIds`, último registro) solo cambia tras `oncomplete`; si falla, el siguiente intento recalcula las diferencias.
- **"Guardado en este navegador"** solo después de completarse la transacción.
- **Desmontaje:** `dispose()` escribe enseguida lo pendiente de agrupar y cierra la conexión cuando no quedan transacciones. La instancia se puede reutilizar (Strict Mode).

### Errores

| Caso | Tratamiento |
|------|-------------|
| Sin IndexedDB o no permitido | La sesión funciona en memoria: «Este navegador no permite guardar la biblioteca… Los cambios se perderán al recargar.» |
| Apertura bloqueada por otra pestaña | Error con «Reintentar» |
| Versión de base o esquema más reciente | «La biblioteca guardada es de una versión más reciente… Los cambios de esta sesión no se guardarán.» No se modifica nada |
| Lectura fallida | Error con «Reintentar» (solo si la playlist sigue vacía). Si el usuario importa antes, se avisa de que no se guardará, para no escribir encima de datos que no se leyeron |
| Transacción abortada o cuota agotada | Error con «… podrían perderse al recargar» y «Reintentar», que guarda el estado vigente |
| `versionchange` | La app cierra su conexión para no bloquear a la otra pestaña; la siguiente operación la reabre |

Estados visibles: restaurando, guardando, guardado y error (más "restaurada" y "se guardará" como estados de reposo).

**Limitaciones de diseño:**
- Sin sincronización entre pestañas: dos pestañas que editan a la vez pueden sobrescribirse. La última escritura gana.
- El almacenamiento depende del navegador y del origen (`localhost:3000` y `localhost:3100` tienen bases distintas). El navegador puede borrarlo y no es una copia de seguridad permanente.

### Archivos

| Acción | Archivo |
|--------|---------|
| Creado | `AGENTS.md` |
| Creado | `src/features/player/persistence/librarySchema.ts`, `indexedDbStorage.ts`, `LibraryPersistence.ts`, `useLibraryPersistence.ts` |
| Creado | `src/features/player/components/PersistenceStatus.tsx` |
| Modificado | `src/features/player/playlistController.ts` (`restore`), `usePlaylist.ts` (`restoreLibrary`, `size`) |
| Modificado | `src/features/player/components/Player.tsx`, `PlaylistPanel.tsx`, `PlaybackControls.tsx`; `player.module.css` |
| Creado | `tests/librarySchema.test.ts`, `tests/indexedDbStorage.test.ts`, `tests/LibraryPersistence.test.ts`, `tests/PlayerPersistence.test.tsx`, `tests/fakes/fakeLibraryStorage.ts`, `tests/fakes/fakeIndexedDB.ts` |
| Modificado | `tests/playlistController.test.ts` (+3) y `tests/AudioLevelsMeter.test.ts` (+1) |
| Creado | `docs/capturas/fase4a-dev-guardado.jpg`, `docs/capturas/fase4a-movil-375-restaurada.jpg` |
| Modificado | `CLAUDE.md`, `docs/progreso.md` y `docs/diseno-ui.md` |

### Pruebas (364 en 21 archivos)

Las 318 anteriores siguen pasando sin cambios. Nuevas (46):

- **`librarySchema.test.ts` (10, Node, datos construidos en la prueba).** Biblioteca vacía; restauración de archivos, ids, orden, selección y preferencias; títulos repetidos con ids distintos; `Blob` → `File`; entradas dañadas (vacío, sin archivo, duración, metadatos, sin id, repetidas); orden con ids desconocidos y archivos sin referencia; sin registro de orden; registro dañado; volumen y silencio inválidos; versión incompatible.
- **`indexedDbStorage.test.ts` (7, Node, IndexedDB SIMULADO** mínimo en `tests/fakes/fakeIndexedDB.ts`). Creación de almacenes, lectura y escritura en una transacción; **transacción fallida por cuota sin cambios parciales**; sin IndexedDB; versión mayor; apertura bloqueada y reintento; `versionchange`; `close()` durante una transacción.
- **`LibraryPersistence.test.ts` (16, Node, almacenamiento SIMULADO en memoria).** Una lectura en Strict Mode; nada se guarda durante la restauración; "Guardado" tras la transacción; inserciones al inicio, al final y en posición; selección y preferencias sin reescribir MP3; agrupación del volumen; eliminación y eliminación de la última; sin cambios no escribe; **escrituras rápidas** (una a la vez y la última gana); **fallo sin resultados parciales y reintento con el estado vigente**; sin IndexedDB; lectura fallida y reintento; lectura fallida y cambios; versión incompatible; datos dañados con copia del original; `dispose`.
- **`PlayerPersistence.test.tsx` (9, jsdom, Strict Mode, almacenamiento SIMULADO, elemento de audio simulado).** Biblioteca vacía; controles deshabilitados mientras restaura; restauración completa en pausa sin `play()` y con una sola URL; datos dañados con informe; guardado al importar al final, al inicio y en posición, al seleccionar y al silenciar; avance automático; eliminación y eliminación de la última; fallo, error visible y «Reintentar»; desmontaje con restauración tardía no aplicada.
- **`playlistController.test.ts` (+3).** Reconstrucción de la lista enlazada con selección, navegación `prev`/`next` e importación posterior; selección por defecto; rechazo sobre una playlist no vacía o con ids repetidos.
- **`AudioLevelsMeter.test.ts` (+1).** Ventana descartada a 44,1 y 48 kHz.

**Pruebas de mutación** (se restauró el código después de cada una):
- Sin serializar escrituras → falla 1 prueba.
- Reescribir todos los MP3 en cada guardado → fallan 5.
- Guardar durante la restauración → fallan 6.
- Sin copia del registro original → falla 1.
- Ventana constante de 43 ms → falla 1.

### Verificación en navegador real (Chromium del panel integrado, IndexedDB real)

**Método.**
- Tonos MP3 reales generados (80 Hz, 4 kHz, 1 kHz y uno con silencio), importados con `DataTransfer` desde un servidor local de archivos de prueba.
- Selección, volumen, silencio, Reproducir/Pausar y eliminar con **clics reales**; recarga con `navigate`.
- Lectura directa de IndexedDB y SHA-256 desde la página, solo para verificar; no se añadió a la app.
- **Desarrollo:** el `next dev` ajeno en el puerto 3000 (no se detuvo). **Producción:** `next start` en el puerto 3100.

| Paso | Desarrollo | Producción |
|------|-----------|-----------|
| 1. Tres MP3 al final y uno en la posición 2 | Orden grave, 1 kHz, agudo, silencio; «Guardado en este navegador» | Igual |
| 2–3. Selección, volumen 0,45 y silencio; «Guardado» | Registro `library` con ese orden, selección, `volume` 0,45 y `muted` true. Revisión 6: 4 importaciones + selección + volumen y silencio agrupados en una escritura | Igual |
| Archivos | Los 4 SHA-256 guardados = SHA-256 del original; tamaños 128 731, 48 483, 128 731 y 144 613 bytes | Los 4 coinciden |
| 4. Tras recargar | Mismos ids, orden y selección; volumen 0,45 y silencio; «Biblioteca restaurada de este navegador»; sin informe de errores | Igual (ids y orden comparados entero por entero) |
| 5. Sin reproducción automática | «En pausa», 0:00 y botón «Reproducir» 3 s después | Igual y **0 `AudioContext`** creados al restaurar |
| 6. Reproducir | `currentTime` avanzó 1,54 s en 1,5 s; RMS −20,8 dBFS en el analizador (volumen 0,45); agudos 1 y graves 0; 1 contexto, 1 fuente | 1,51 s en 1,5 s; mismos niveles; mismo canvas |
| 7–8. Eliminar una y recargar | No reaparece; la base tiene 3 registros de canción (sin huérfano) | Igual |
| 9–10. Eliminar todas y recargar | Playlist vacía; 0 registros de canción; `order` [] y `selectedId` null; el volumen se conserva | Igual |
| Errores | Consola sin errores | Sin errores ni hidratación; solo el aviso conocido `THREE.Clock`; servidor sin errores |

- En desarrollo, el tono de 4 kHz terminó entre dos llamadas y **avanzó solo** a la canción siguiente; esa selección también se guardó y se restauró.
- **Incompatibilidad y `versionchange` reales:** desde la página se abrió la base con la versión 2. La app cerró su conexión (la actualización no quedó bloqueada) y, al recargar, mostró el aviso de versión más reciente con la sesión utilizable. Después se borró esa base de prueba de `localhost:3100`.
- **Móvil 375×812** (desarrollo, restaurada): sin desbordamiento horizontal (`scrollWidth` 375). La esfera mide 310 px en (33, 84), la misma posición que en la 2B, y el estado de persistencia queda en el panel, debajo de los controles (y = 763 frente a 666). Captura `fase4a-movil-375-restaurada.jpg`.
- **Escritorio:** el estado está en la columna lateral y no comparte espacio con la esfera ni con los controles (`fase4a-dev-guardado.jpg`; la esfera aún mostraba "Cargando visualización 3D…" porque el panel estaba oculto mientras se importaba).

### Comprobaciones no realizadas o con límites

- **Cuota agotada, transacción abortada y apertura bloqueada reales:** solo con pruebas simuladas. En el navegador se probaron la versión incompatible y `versionchange`.
- **Audición:** no se escuchó; la evidencia es el avance del elemento y la señal del analizador.
- **Archivos grandes y muchos archivos:** solo se probaron tonos de 48–145 KB; no se midieron tiempos de restauración con bibliotecas grandes ni el comportamiento ante cuotas reales.
- **Otros navegadores:** solo Chromium (por ejemplo, Safari con almacenamiento limitado o Firefox en modo privado no se probaron).
- **Dos pestañas a la vez:** sin sincronización (fuera del alcance). No se probó la edición simultánea.

---

## Fase 3B: análisis del audio y reacción de la esfera (2026-10-07)

### Antes de modificar

Se leyeron `CLAUDE.md`, `docs/progreso.md`, `docs/diseno-ui.md` y el código de `AudioEngine`, `usePlayback`, `Player`, `Visualizer`, `OrbMesh`, `orbGeometry` y `orbAudio`. Estado inicial comprobado: `npm test` **262/262** (13 archivos), `npm run typecheck` sin errores y `npm run build` correcto.

### Ruta de audio definitiva y propiedad

```
HTMLAudioElement (único, del motor)
   └─ MediaElementAudioSourceNode ─→ AnalyserNode ─→ AudioContext.destination
                                        │
            AudioLevelsMeter (rAF) lee aquí ─→ OrbAudioInput.current ─→ OrbMesh (useFrame)
```

| Recurso | Dueño | Se crea | Se libera |
|---------|-------|---------|-----------|
| `HTMLAudioElement` | `AudioEngine` | Primera carga de una canción (como en la 3A) | `dispose()` (desmontaje) |
| `AudioContext`, `MediaElementAudioSourceNode` y `AnalyserNode` (`AudioOutputGraph`) | `AudioEngine`, ligados a **su** elemento | Primer intento de reproducir (`#startPlayback`, que viene de un clic) | `dispose()`: desconecta los nodos y cierra el contexto (`close().catch`) |
| Bucle de análisis (`requestAnimationFrame`) | `AudioLevelsMeter` | Al confirmarse "Reproduciendo" con analizador disponible | Pausa, final, error, carga de otra canción, descarga o desconexión |
| `OrbAudioInput` (objeto estable) | `AudioLevelsMeter` | Con el medidor (`useState`) | — (solo datos) |

- **Una fuente por elemento.** El grafo se crea una vez y se reutiliza para todas las canciones, pausas, reanudaciones y renderizados. Cambiar de canción solo cambia el `src` del mismo elemento.
- **Ruta única.** No hay conexión directa fuente → destination junto a la del analizador. La ruta de reserva (abajo) la **sustituye** y nunca coexiste con ella.
- **`resume()` antes de `play()`.** Si el contexto no está `running`, el motor espera `resume()` y solo entonces llama a `play()`.
  - La espera usa las versiones de la 3A (`#playVersion`, `#sourceVersion`). Si entretanto el usuario pausa, cambia de canción, elimina la actual o se desmonta, la respuesta antigua no reproduce.
  - Con el contexto ya en marcha, `play()` se llama de inmediato (sin retraso).
  - `resume()` tiene un límite de 4 s.
- **Strict Mode.**
  - `usePlayback` crea motor y medidor con `useState`, sin efectos secundarios.
  - El medidor se conecta en un efecto que devuelve su limpieza: conectar → limpiar → conectar deja una sola suscripción y un solo fotograma.
  - `dispose()` libera elemento **y** grafo juntos; un montaje posterior crea elemento, contexto y fuente nuevos. Nunca se cierra un contexto para reutilizar después su nodo fuente con el mismo elemento.

**Fallos de Web Audio**

| Caso | Tratamiento |
|------|-------------|
| Sin `AudioContext` (o el constructor lanza) | Ruta convencional del elemento y movimiento ambiental. No se reintenta en ese montaje |
| Falla `createAnalyser` o `createMediaElementSource` | El elemento no se redirigió: ruta convencional y el contexto se cierra |
| Falla conectar el analizador | Ruta de reserva `fuente → destination` (audible, sin análisis) |
| Falla también la reserva | El elemento ya está redirigido y desconectar no devuelve la salida convencional: se descarta, se crea un elemento **nuevo** sin Web Audio y se recarga la canción en el mismo punto |
| `resume()` rechazado o sin respuesta en 4 s | «Error: No se pudo activar la salida de audio. Pulsa Reproducir para reintentar.» Reproducir reintenta `resume()` sin recargar |
| El sistema suspende el contexto mientras suena | Pausa con «La salida de audio se suspendió. Pulsa Reproducir para continuar.» |
| El sistema cierra el contexto | Error visible; Reproducir sustituye el elemento (ruta convencional) en el mismo punto. No se declara una recuperación falsa |

`PlaybackErrorKind` tiene el tipo nuevo `'output'`, que se muestra como los demás errores (`role="status"`).

### Análisis (`src/features/player/audio/audioAnalysis.ts`)

Está separado del dominio (sin React ni DOM) y de la geometría. `AudioLevelAnalyzer` reutiliza sus dos buffers (`Float32Array` de 2048 y 1024) y escribe en un objeto existente: **no crea arreglos, objetos ni nodos por fotograma**.

- **Analizador:** `fftSize = 2048` (≈ 43 ms a 48 kHz, 23,4 Hz por bin) y `smoothingTimeConstant = 0`. Sin suavizado del nodo, el espectro de una canción anterior no se mezcla con el nuevo y no se acumulan suavizados.
- **Energía:** `rms = √(Σ x² / n)` de `getFloatTimeDomainData` (se ignoran valores no finitos), en dBFS: `20·log10(rms)`.
- **Bandas:** `getFloatFrequencyData` (dB por bin). El bin `k` está centrado en `k · sampleRate / fftSize`. Se toman los bins con centro dentro de la banda, sin el bin 0 y por debajo de Nyquist:
  - `inicio = max(1, ⌈minHz / binHz⌉)` y `fin = min(fftSize/2 − 1, ⌊maxHz / binHz⌋)`. Si `inicio > fin`, la banda está vacía (nivel 0).
  - Graves **40–250 Hz**: bins 2–10 a 48 kHz y 2–11 a 44,1 kHz.
  - Agudos **2 000–8 000 Hz**: bins 86–341 a 48 kHz y 93–371 a 44,1 kHz. Con 8 kHz de `sampleRate` se limita a 2–4 kHz; por debajo de 4 kHz queda vacía.
- **Nivel de banda:** se **suma** la potencia de los bins (`Σ 10^(dB/10)`, así no depende del ancho de la banda) y se pasa a dB con la corrección de la ventana Blackman de la especificación: `+10·log10(2 / mean(w²)) ≈ +8,17 dB`. La banda se lee como el RMS en dBFS de lo que contiene.
  - **Comprobado en Chromium:** un tono MP3 de 80 Hz y amplitud 0,3 dio −13,8 dBFS de RMS temporal y −13,9 dBFS en la banda de graves.
- **Normalización:** lineal en dB con rangos **fijos** (sin control automático de ganancia), limitada a [0, 1]. `-Infinity`, NaN y rangos inválidos dan 0.

  | Nivel | 0 en | 1 en | Motivo |
  |-------|------|------|--------|
  | `energy` | −50 dBFS | −8 dBFS | Un máster fuerte (−14…−8) da 0,86–1; un pasaje suave (−32), 0,43 |
  | `bass` | −52 dBFS | −12 dBFS | Los graves concentran mucha energía |
  | `treble` | −64 dBFS | −24 dBFS | Los agudos tienen mucha menos energía que los graves |

### Medidor y conexión con la esfera

- **`AudioLevelsMeter`** (`audio/AudioLevelsMeter.ts`) es el único bucle de análisis. Corre solo con el estado "Reproduciendo" y un analizador disponible; lee una vez por fotograma y escribe en `input.current`, sin estado de React.
  - En pausa, final, error, carga de otra canción o descarga: cancela el fotograma y escribe 0 al instante.
  - Al (re)empezar descarta una ventana de análisis (`fftSize / sampleRate`), medida con `AudioContext.currentTime`: no se cuela el buffer de la canción anterior.
  - "Reproduciendo" no implica señal: un pasaje silencioso da 0 porque los datos son reales.
  - **Volumen:** no multiplica por el volumen. En Chromium el analizador ya recibe la señal atenuada por `volume` y `muted` (medido, ver abajo). No hizo falta un `GainNode` ni cambiar la arquitectura de volumen de la 3A.
- **Conexión:** `usePlayback` devuelve `audioInput` (estable) y `Player` lo pasa a `<Visualizer audio={audioInput} />`. `Visualizer` sigue siendo `memo` y la entrada no cambia de referencia: la escena no se vuelve a renderizar al reproducir, pausar, buscar o cambiar de canción.
- **Suavizado (único, en `OrbMesh`):** `smoothTowards` dependiente del tiempo, por nivel (`ORB_AUDIO_SMOOTHING`, tasas por segundo):

  | Nivel | Sube | Baja |
  |-------|------|------|
  | Energía | 12 | 3 |
  | Graves | 18 | 5 |
  | Agudos | 10 | 4 |

  Se revisó el suavizado de la 2B y se amplió a los tres niveles en lugar de añadir otro.
- **Respuesta visual** (`orbGeometry.ts`, `OrbMesh.tsx`):

  | Nivel | Efecto | Máximo |
  |-------|--------|--------|
  | Energía | Capa de ruido extra (frecuencia 1,4, velocidad 0,45) | 4,5 % del radio |
  | Graves | Amplía la capa principal (pliegues amplios) y pulsación uniforme del radio | +20 % de los pliegues y +3 % del radio |
  | Agudos (y energía) | `envMapIntensity` (reflejos) | +0,45 por agudos y +0,15 por energía sobre 1,7 |

  - La deformación se sigue calculando desde la base: no se acumula (prueba).
  - **Recalibración:** con los valores previstos en la 2B (amplitud 0,1 y frecuencia 2,3), la pendiente entre vértices vecinos llegaba a **1,25** con energía máxima, es decir, picos. Con los valores finales, la peor pendiente medida es **0,895** con energía y graves al máximo (0,629 sin audio).
  - El `boundingSphere` fijo pasa a radio 1,271, dentro del encuadre de la cámara (≈ 1,41). El tamaño del canvas sigue dependiendo solo del *viewport*.
  - Sin cambios en el material base, el entorno, el Bloom ni el tone mapping.
- **Movimiento reducido** (también si cambia durante la sesión): el efecto de `OrbMesh` pone los niveles suavizados a 0, la forma fija y `envMapIntensity` en reposo, y el bucle de la malla no aplica audio. El audio sigue sonando.
- **Sin WebGL:** la música se reproduce igual; el medidor escribe en un objeto que nadie dibuja.

### Archivos

| Acción | Archivo |
|--------|---------|
| Creado | `src/features/player/audio/audioAnalysis.ts` (RMS, bandas, normalización, `AudioLevelAnalyzer`) |
| Creado | `src/features/player/audio/audioGraph.ts` (`AudioOutputGraph` y tipos de Web Audio inyectables) |
| Creado | `src/features/player/audio/AudioLevelsMeter.ts` |
| Modificado | `src/features/player/audio/AudioEngine.ts`: grafo diferido, `resume()` antes de `play()` con versiones, errores `'output'`, sustitución del elemento, `startTime` en `load`, `outputGraph` y entorno con `createAudioContext` y temporizadores |
| Modificado | `src/features/player/audio/usePlayback.ts`: medidor, `audioInput` y entorno del medidor |
| Modificado | `src/features/player/components/Player.tsx`: `<Visualizer audio={audioInput} />` |
| Modificado | `src/features/player/visualizer/orbGeometry.ts` (graves y recalibración), `OrbMesh.tsx` (tres niveles, brillo por agudos, movimiento reducido), `orbAudio.ts` y `Visualizer.tsx` (documentación) |
| Creado | `tests/audioAnalysis.test.ts`, `tests/audioGraph.test.ts`, `tests/AudioLevelsMeter.test.ts`, `tests/PlaybackWebAudio.test.tsx` y `tests/fakes/fakeAudioContext.ts` |
| Modificado | `tests/fakes/fakeMedia.ts` (entorno sin Web Audio explícito y `overrides`) y `tests/orbGeometry.test.ts` (+3) |
| Creado | `docs/capturas/fase3b-dev-musica-reproduciendo.jpg` y `docs/capturas/fase3b-produccion-musica-reproduciendo.jpg` |
| Modificado | `CLAUDE.md`, `docs/progreso.md` y `docs/diseno-ui.md` |

No se instaló ni cambió ninguna dependencia. Los MP3 de prueba se generaron fuera del proyecto, con `@breezystack/lamejs` en el directorio temporal, como en la 2A.

### Pruebas (318 en 17 archivos)

Las 262 anteriores siguen pasando sin cambios en sus expectativas. Nuevas (56):

- **`audioAnalysis.test.ts` (18, Node).**
  - RMS de silencio, continua, cuadrada y seno, y valores no finitos.
  - Normalización, límites y sensibilidad entre pasajes suaves y fuertes.
  - Bandas → bins con 8; 22,05; 44,1; 48 y 96 kHz; Nyquist y bandas vacías.
  - Calibración de la ventana y tonos de graves y agudos.
  - Reutilización de buffers y valores extremos siempre finitos en [0, 1].
  - Usa un **analizador simulado que implementa el algoritmo de la especificación** (Blackman + DFT), no el del navegador.
- **`audioGraph.test.ts` (21, Node).**
  - Creación diferida, una fuente por elemento con pausas, repeticiones y cambios rápidos, y ruta única.
  - Clics rápidos con `resume()` pendiente; pausa, cambio, descarga y desmontaje con `resume()` pendiente; rechazo y tiempo límite de `resume()`.
  - Sin Web Audio, fallos antes y después de redirigir, y contexto cerrado o suspendido por el sistema.
  - `dispose`, `close()` rechazado sin rechazos sueltos y reutilización tras `dispose` (Strict Mode).
- **`AudioLevelsMeter.test.ts` (9, Node).**
  - Sin bucle en reposo; un solo bucle y entrada estable.
  - Pasaje silencioso → 0; pausa, final y error → 0 con el bucle cancelado; descarga.
  - Cambio de fuente sin señal antigua.
  - Volumen, volumen 0, silencio y recuperación, con una sola atenuación.
  - Sin Web Audio no hay bucle; desconexión y Strict Mode.
- **`PlaybackWebAudio.test.tsx` (5, jsdom, Strict Mode).**
  - Un elemento, un contexto y una fuente con navegación, pausa y reanudación, y la misma entrada para la escena.
  - Niveles hasta la escena y 0 en pausa.
  - Eliminar la actual con `resume()` pendiente.
  - Desmontaje: cierra el contexto, desconecta y detiene el bucle.
  - Error de salida visible y reintento.
- **`orbGeometry.test.ts` (+3).** Sin picos y dentro del límite con energía y graves al máximo; los graves inflan y amplían los pliegues; sin acumulación.

**Simulaciones:** `AudioContext`, `MediaElementAudioSourceNode` y `AnalyserNode` son **simulados** en `audioGraph`, `AudioLevelsMeter` y `PlaybackWebAudio` (`tests/fakes/fakeAudioContext.ts`). El analizador simulado aplica `volume`/`muted` del elemento porque así se **midió** en Chromium; esas pruebas no demuestran ese comportamiento.

**Pruebas de mutación** (el código se restauró después de cada una):
- Aceptar respuestas de `resume()` sin comprobar versiones → fallan 6 pruebas.
- Quitar la ventana descartada del medidor → falla 1.
- Recrear el grafo en cada reproducción → fallan 2.
- Dejar el suavizado del `AnalyserNode` → falla 1.

### Verificación en navegador real (Chromium del panel integrado, `sampleRate` 48 000)

**Método.**
- MP3 reales importados con `DataTransfer`:
  - Tonos generados de 80 Hz, 1 000 Hz y 4 000 Hz, con amplitud 0,3.
  - Un archivo de 9 s con 3 s de silencio digital en medio.
  - Una canción real (`music.mp3`), autorizada por el usuario y usada solo en el navegador, sin copiarla al proyecto.
- Reproducir, Pausar, Siguiente, Anterior, filas, barra, silencio, volumen (clic y teclas Inicio/Fin) y eliminar se pulsaron con **clics y teclas reales**. Una prueba de 7 cambios rápidos usó `click()` desde la página.
- Instrumentación solo en la página, sin código de depuración en la app: se envolvieron `createMediaElementSource`, `createAnalyser`, `AudioNode.connect` y `document.createElement('audio')`, y se leyó la entrada de la esfera (`props.audio` de `Visualizer`) desde la fibra de React.

**Punto de medida.** El nivel se midió en el **`AnalyserNode` de la app**, el último nodo antes de `destination`, con `getFloatTimeDomainData` (RMS en dBFS). Los niveles normalizados se leyeron en `OrbAudioInput.current`. No se usó `captureStream()`.

| Comprobación | Desarrollo (`next dev`) | Producción (`next start`) |
|--------------|-------------------------|---------------------------|
| Conectar el grafo no interrumpe | `currentTime` avanzó 2,01 s en 2 s tras el primer clic; contexto `running` | Igual (2,01 s en 2 s) |
| Ruta | Solo `MediaElementAudioSourceNode→AnalyserNode` y `AnalyserNode→AudioDestinationNode` | Igual |
| Tono de 1 kHz | RMS −13,9 dBFS; energía 0,859; graves 0; agudos 0 | — |
| Tono de 80 Hz | Graves 0,952; agudos 0; energía 0,859 | Graves 0,952; agudos 0; RMS −13,8…−14,0 |
| Tono de 4 kHz (tras Siguiente) | Agudos 1 y graves 0 (máximo 0 en toda la ventana: sin graves de la canción anterior) | Igual |
| Fragmento silencioso | 3,3–5,8 s: energía **0,000** con "Reproduciendo"; 0,86 antes y después | — |
| Pausa | Entrada `{0, 0, 0}` en la misma lectura; `currentTime` fijo | Igual. 7 cambios rápidos Pausar/Reproducir y Anterior/Siguiente: termina en pausa con 0 |
| Volumen 0,45 | RMS −13,9 → **−20,85 dBFS** (−6,95 dB; 20·log10 0,45 = −6,94); energía 0,859 → 0,694 | — |
| Silencio (`muted`) | RMS −∞ y niveles 0; el elemento sigue avanzando | Igual |
| Volumen 0 | — | RMS −∞, niveles 0, "Reproduciendo" |
| Recuperación | — | Volumen 1: RMS −13,9 dBFS y energía 0,859 de nuevo |
| Canción real, volumen 0,45 | Energía media 0,47–0,52 (máx. 0,66); graves 0,36–0,40; agudos 0,26–0,31; RMS −22…−36 dBFS | — |
| Canción real, volumen 1 | Energía media 0,72–0,77 (máx. 0,96); graves 0,53–0,54 (máx. 1 una vez); agudos 0,58–0,62 | Pasaje fuerte (1:24): energía 0,85; graves 0,56; agudos 0,60 |
| Avance automático | 1 kHz → 80 Hz → 4 kHz → silencio → canción, sin intervención | — |
| Seek | Clic en la mitad → 84,1 / 167,1 s; siguió sonando con energía 0,86 | 84 s; siguió sonando |
| Eliminar la actual mientras suena | Entrada 0 al instante y "En pausa" | Igual |
| Recursos | 1 elemento del motor, 1 `AudioContext`, 1 fuente y el **mismo** `<canvas>` en todo el recorrido | Igual |
| Errores | Ninguno de la app (un `Failed to fetch` vino del servidor de archivos de prueba) | 0 sin capturar y 0 de hidratación; servidor sin errores; solo el aviso conocido `THREE.Clock` |

**Valores no finitos:** ninguna lectura NaN o infinita en la entrada de la esfera.

**Evidencia visual (píxeles reales del canvas).** En cada fotograma se copió el canvas WebGL a un canvas 2D de 96×96 y se contaron los píxeles opacos de la silueta.
- En pausa: 4 164 ± 11. Con la canción sonando: 4 225 ± 33 (mín. 4 171, máx. 4 278). La silueta crece y varía con la música.
- Alternando 1,2 s sonando y 1,2 s en pausa tres veces, la silueta fue mayor al sonar las tres veces (4 306/3 992, 4 115/3 819 y 3 948/3 899).
- La luminancia media no dio una diferencia concluyente (mayor al sonar dos de tres veces): la rotación y el movimiento ambiental la dominan en ventanas tan cortas. **No se afirma un efecto medido del brillo**; el cambio de `envMapIntensity` solo se verificó en el código.
- Capturas: `fase3b-dev-musica-reproduciendo.jpg` y `fase3b-produccion-musica-reproduciendo.jpg`. La esfera queda dentro de su espacio, oscura y metálica, con reflejos turquesa. En la de desarrollo, el indicador "1 Issue" de Next corresponde al `Failed to fetch` del servidor de archivos de prueba, no a la app.

### Comprobaciones no realizadas o con límites

- **Audición:** nadie escuchó la salida y el entorno no permite capturar los altavoces. Lo medido es la señal en el analizador, el último nodo antes de `destination`.
- **Fluidez y FPS:** no se midieron. El panel limita `requestAnimationFrame` (unas 30 lecturas por segundo durante las mediciones) y no se puede grabar el movimiento continuo. Las capturas son instantes aislados.
- **`prefers-reduced-motion` en vivo:** el panel no puede emular la *media query*. El cambio en vivo depende de `usePrefersReducedMotion` (`useSyncExternalStore`, ya probado) y del efecto de `OrbMesh`, revisado en el código.
- **Fallos reales de Web Audio** (sin `AudioContext`, contexto cerrado o suspendido por el sistema) y el desmontaje real: solo con pruebas simuladas.
- **Otros navegadores:** solo Chromium. Que `volume`/`muted` se apliquen antes del nodo fuente se midió solo ahí; Safari en iOS no permite cambiar `volume`.
- **Revisión posterior** (fuera de esta fase): títulos extremos y suavidad de la barra de progreso.

---

## Fase 3A: reproducción sonora real y controles (2026-10-07)

### Antes de modificar

Se leyeron `CLAUDE.md`, `docs/progreso.md` y el código. La base estaba bien: **219/219** pruebas y typecheck correcto. No había cambios externos (fechas de modificación revisadas).

### Arquitectura

| Archivo | Función |
|---------|---------|
| `src/features/player/audio/AudioEngine.ts` | Motor de reproducción (TypeScript sin React) |
| `src/features/player/audio/usePlayback.ts` | Un motor por montaje y estado con `useSyncExternalStore` |
| `src/features/player/components/PlaybackControls.tsx` | Estado, progreso con tiempos, transporte y volumen |
| `src/features/player/playlistController.ts` / `usePlaylist.ts` | Nuevo `currentId` (lectura de la selección actual de `Playlist`) |
| `src/features/player/components/Player.tsx` | `syncPlayback`, que carga en el motor la selección de `Playlist` cuando cambia |

**Elemento de audio**

- Un solo `HTMLAudioElement` por instancia del motor.
- Se crea de forma diferida, en el navegador, la primera vez que se carga una canción. No se añade al DOM.
- El servidor nunca crea audio: el HTML de producción no contiene `<audio>`.

**Fuente de verdad**

- **Orden y selección:** `Playlist` (lista doblemente enlazada).
- **Archivo:** `AudioSourceRegistry`, consultado mediante `actions.getSource(id)`.
- **Tiempos y estado:** el elemento (`currentTime`, `duration`, `paused`, `ended` y sus eventos).
- El motor solo sabe qué id tiene cargado: no hay un segundo índice ni una playlist paralela.

**Flujo:** después de cada acción que puede cambiar la selección, `syncPlayback(autoplay)` lee `actions.currentId()`. Si es otro id, llama a `engine.load(id, file, { autoplay })`; si no queda ninguno, a `engine.unload()`.

| Situación | Resultado |
|-----------|-----------|
| Primera importación | Pausa |
| Fila, Anterior o Siguiente | Sigue sonando si estaba sonando (`engine.wantsToPlay`) |
| Final automático (`ended`) | `actions.next()` y reproducción; si no hay siguiente, "Finalizada" |
| Eliminar la actual | La nueva selección queda en pausa; sin canciones, se descarga el audio |
| Eliminar otra, importar, abrir o cancelar el diálogo | No se toca el motor |
| Seleccionar la misma canción | No se recarga (conserva su tiempo) |

**Versiones**

- `#sourceVersion` aumenta con cada carga, descarga o liberación.
- `#playVersion` aumenta con cada `play()`, `pause()`, final o error.
- Las respuestas de `play()` (éxito o error) se descartan si cualquiera de las dos versiones cambió. Así, una respuesta antigua no toca el título, los tiempos, el estado ni el error de una selección posterior, y tampoco pausa una reproducción nueva válida.

**Listeners por fuente**

- Se registran al cargar y se quitan al sustituir la fuente.
- Cada handler comprueba además que su versión sigue siendo la actual. Los eventos de una fuente anterior no avanzan la playlist ni cambian el estado de otra canción.

**"Reproduciendo" confirmado**

- Tras pulsar Reproducir, el estado es "Cargando…".
- Pasa a "Reproduciendo" solo cuando la promesa de `play()` se resuelve **y** `element.paused` es `false`.
- El evento `playing` solo actualiza el estado cuando no hay un `play()` pendiente (por ejemplo, al salir de una espera de datos).

**Recursos**

- La URL temporal se crea al cargar.
- Al sustituir la fuente o desmontar, en este orden: quitar listeners → `pause()` → `removeAttribute('src')` → `load()` → `revokeObjectURL()`. Se desvincula antes de revocar.
- Los `File` del registro no se eliminan al cambiar de canción.

**Strict Mode**

- `usePlayback` crea el motor con `useState` (el constructor no crea el elemento) y lo libera con `dispose()` en la limpieza del efecto.
- En el doble montaje de desarrollo no queda ningún elemento ni listener duplicado: en el navegador se observó **1** elemento del motor con Strict Mode activo.

**Errores**

| Caso | Tratamiento |
|------|-------------|
| `NotAllowedError` (bloqueo del navegador) | Pausa con el aviso «El navegador no permitió iniciar el sonido automáticamente. Pulsa Reproducir para empezar.» No se intenta saltar la restricción |
| `AbortError` vigente | Pausa sin error. Si es obsoleto (pausa o cambio de canción), se ignora |
| `NotSupportedError` | Error de formato |
| Otros rechazos | Error de reproducción |
| Errores del elemento (códigos 1–4) | Mensajes de carga, lectura, decodificación o formato |
| Fuente inexistente | Error «No se encontró el archivo de esta canción» |
| `waiting` | "Esperando datos…" |
| Reproducir tras un error | Vuelve a cargar la fuente |

Todas las promesas de `play()` tienen un manejador de rechazo: no quedan rechazos sin capturar.

**Tiempos**

- El tiempo transcurrido sale de `currentTime`, actualizado con `timeupdate` y `seeked` (unas 4 veces por segundo). No hay temporizadores ni contadores propios.
- El total sale de `duration` (precisa) y se muestra redondeado hacia arriba, como en la lista.
- La reproducción no se limita con la duración redondeada de `Song`: llega a la duración real del elemento.

**Barra de progreso**

- `<input type="range" step="any">` nativo, que funciona con ratón y tacto.
- Teclado propio:

  | Tecla | Efecto |
  |-------|--------|
  | ← / ↓ y → / ↑ | ±5 s |
  | RePág / AvPág | ±10 % |
  | Inicio / Fin | Extremos |

- `aria-valuetext`, por ejemplo "0:12 de 0:30".
- `seek` ignora valores no finitos, limita a [0, duración] y conserva reproducción o pausa.

**Volumen**

- `element.volume`; el silencio usa `element.muted` y conserva el volumen elegido.
- Mover el volumen con el silencio activo lo quita (comportamiento habitual en reproductores).

**Interfaz**

- Debajo de los detalles: estado visible (`role="status"`), barra con tiempos y una fila con Anterior, Reproducir/Pausar y Siguiente, más silencio y volumen.
- **Sin canciones:** Reproducir y la barra están deshabilitados, y Anterior y Siguiente tienen `aria-disabled`.
- **Esfera:** su tamaño sigue dependiendo solo del *viewport*: `min(380px, max(200px, 100dvh − 30rem))`, que da 320 px a 1366×800 y 380 px desde unos 860 px de alto.
- **Canvas:** `Visualizer` no recibe datos de reproducción, así que actualizar tiempos o estados no lo vuelve a renderizar.

**La esfera sigue en energía 0**

Sin reacción artificial: `Visualizer` recibe `SILENT_AUDIO_INPUT`.

### Cómo se conectará el analizador en la fase 3B

> Plan escrito en la 3A. Lo implementado está en "Fase 3B". Cambios respecto al plan: `fftSize` 2048, sin suavizado del nodo, `resume()` antes de `play()` y un bucle propio del medidor.

1. **Contexto de audio:** al primer "Reproducir" (gesto del usuario), se crea un `AudioContext` y `ctx.createMediaElementSource(engine.mediaElement)`. Debe hacerse **una sola vez por elemento**, y el elemento no cambia entre canciones.
2. **Cadena:** `source → analyser (AnalyserNode, fftSize 1024–2048) → ctx.destination`. Hay que reconectar a `destination` porque, una vez creado el `MediaElementSourceNode`, el sonido solo sale por el grafo de Web Audio.
3. **Lectura de niveles:** un bucle propio (`useFrame` de la escena o un `requestAnimationFrame` del motor, sin estado de React) lee `getFloatTimeDomainData` (RMS → `energy`) y `getByteFrequencyData` (bandas → `bass` y `treble`). Escribe los valores normalizados en el objeto `OrbAudioInput` que `Visualizer` pasa a la malla. La malla ya aplica `clamp01` y `smoothTowards`.
4. **Pausa y finalización:** si no hay reproducción, los niveles reales caen a 0 y queda solo el movimiento ambiental.
5. **Ciclo de vida:** `ctx.resume()` si el contexto está suspendido (autoplay); al desmontar, `disconnect()` y `ctx.close()`. Si `dispose()` crea un elemento nuevo (remontaje), hay que crear su propio `MediaElementSourceNode`.
6. **Advertencia:** en la verificación de esta fase, `element.captureStream()` en Chrome capturó la señal **antes** del volumen del elemento. Para el analizador no importa (se mide la música, no el volumen elegido), pero conviene tenerlo presente.

### Archivos

| Acción | Archivo |
|--------|---------|
| Creado | `src/features/player/audio/AudioEngine.ts`, `src/features/player/audio/usePlayback.ts` |
| Creado | `src/features/player/components/PlaybackControls.tsx` |
| Creado | `tests/AudioEngine.test.ts` (26), `tests/Playback.test.tsx` (17), `tests/fakes/fakeMedia.ts` (elemento simulado) |
| Creado | `docs/capturas/fase3a-*.jpg` (3) y `docs/capturas/fase3a-salida-elemento-*.webm` (2 grabaciones) |
| Modificado | `src/features/player/components/Player.tsx`: motor, `syncPlayback`, final automático y controles |
| Modificado | `src/features/player/components/SelectedSong.tsx`: la navegación pasó a `PlaybackControls` |
| Modificado | `src/features/player/components/icons.tsx`: reproducir, pausar, volumen y silencio |
| Modificado | `src/features/player/playlistController.ts`, `usePlaylist.ts`: `currentId` |
| Modificado | `src/features/player/player.module.css`: controles, barras e indicadores; se retiraron `.navigation` y `.navButton` (sin uso); espaciado de la columna |
| Modificado | `src/app/globals.css`: `--visualizer-size` resta 30rem para dejar sitio a los controles |
| Modificado | `tests/Player.test.tsx`: la prueba que exigía que **no** hubiera controles de reproducción ahora comprueba que, sin canciones, los que no tienen función están deshabilitados (cambio de requisito) |
| Modificado | `tests/setup/canvas.ts`: *stubs* de `HTMLMediaElement` (`load`, `pause`, `play`) y `URL.createObjectURL`, solo en jsdom e identificados como simulación |
| Modificado | `CLAUDE.md`, `docs/progreso.md`, `docs/diseno-ui.md` |

No se instaló ni cambió ninguna dependencia.

### Pruebas (262 en 13 archivos)

Las 219 anteriores siguen pasando; solo se adaptó la prueba del estado inicial al nuevo requisito. Nuevas, todas con un elemento de audio **simulado**:

- **`AudioEngine.test.ts` (26, Node)**
  - Carga en pausa y un solo elemento.
  - Fuente inexistente.
  - "Reproduciendo" solo tras confirmarse `play()`.
  - Pausa y reanudación desde el mismo tiempo.
  - `NotAllowedError`, `NotSupportedError` y otros rechazos.
  - Play pendiente seguido de pausa, tanto si se rechaza como si se resuelve.
  - Desvincular antes de revocar y quitar los listeners.
  - **A → B → C** con respuestas tardías de A después de que C ya suena.
  - Un error antiguo que no toca la canción nueva.
  - Eventos tardíos de una fuente anterior.
  - `ended` con un solo aviso, y reproducir desde 0.
  - `seek` (valores no finitos, límites, duración precisa y estado conservado).
  - Volumen y silencio.
  - `unload` y `dispose`.
  - Errores del elemento, reintento tras error, espera de datos y pausa externa.
- **`Playback.test.tsx` (17, jsdom)**
  - Primera importación en pausa.
  - Reproducir, pausar y reanudar.
  - Bloqueo y reintento.
  - Siguiente mientras suena; cambio en pausa; misma canción.
  - Final automático hasta "Finalizada" y reproducir desde 0.
  - Eliminar la actual, eliminar otra e importar; diálogo abierto y cancelado; eliminar la única.
  - Barra (cambio y teclado), volumen y silencio.
  - **Strict Mode**: 1 elemento, 1 listener por evento, 1 `play()`.
  - Desmontaje y limpieza, y recarga al volver a una canción.

**Pruebas de mutación** (el motor se restauró después de cada una):
- Quitar la comprobación de versión en las respuestas de `play()` hace fallar 2 pruebas.
- Aceptar eventos sin comprobar la versión de la fuente hace fallar 1 prueba.

### Verificación real (navegador integrado, Chromium; MP3 reales generados)

**Cómo se entregaron los archivos:** los MP3 (tonos de 523, 440, 659 y 784 Hz) se asignaron al selector con `DataTransfer`, como en la fase 2A. Reproducir, pausar, la barra, Anterior, Siguiente, silencio, eliminar y el diálogo se pulsaron con **clics y teclas reales** del panel; los clics reales cuentan como gesto del usuario para la política de autoplay. El elemento del motor se localizó interceptando `document.createElement('audio')` en la página, sin código de depuración en la app.

**Desarrollo (`next dev`, Strict Mode activo) y producción (`next start`)**

| Comprobación | Resultado |
|--------------|-----------|
| Reproducción efectiva | `paused = false`. `currentTime` avanzó **2,51 s en 2,5 s** de reloj (dev) y **2,01 s en 2 s** (producción). `webkitAudioDecodedByteCount` subió de 5 015 a 45 139 bytes. Interfaz: "Cargando…" → "Reproduciendo" |
| Pausa y reanudación | En pausa, `currentTime` quedó fijo en 7,07 s durante 1,5 s; al reanudar siguió desde 7,13 hasta 8,09 |
| Barra | Clic real en el centro → exactamente la mitad (2,17/4,34 s y 4,57/9,14 s). Flecha izquierda → −5 s, limitado a 0. Siguió sonando |
| Cambio manual | Siguiente y Anterior mientras suena → la nueva canción desde 0, sonando. Fila en pausa o tras finalizar → pausa |
| Cambio automático | Do (12,6 s) → La (7,2 s) → Mi (4,3 s) sin intervención, y "Finalizada" al terminar la última, con la selección conservada. Reproducir empezó desde 0 |
| Eliminar durante la reproducción | Se detuvo (`load()` + `emptied` de la fuente anterior), la siguiente quedó "En pausa" y no hubo llamada a `play()` |
| Volumen y silencio | `element.volume` 1 → 0,8 → 0,4 con el teclado; `element.muted` cambió con el botón y se conservó entre canciones |
| Diálogo | Abrir y cerrar con Escape mientras suena no pausó ni reinició |
| Canvas | El mismo `<canvas>` en todo el recorrido, en dev y producción |
| Elementos de audio | 1 del motor, también con Strict Mode (los otros 3 eran de la lectura de metadatos, ya liberados) |
| Errores | 0 errores sin capturar (`error` y `unhandledrejection`) y 0 de hidratación; servidores sin errores |
| HTML del servidor | Sin `<audio>`; "Reproducir" y la barra deshabilitados; estado "Sin canción" |
| Escritorio 1366×800 | Esfera de 320 px; controles visibles sin desplazar con títulos de 1 o 2 líneas (36 px de margen) |
| Móvil 375×812 | Todos los controles en una fila (40–56 px de alto) y sin desbordamiento horizontal |

**Evidencia de la señal (grabación de la salida del elemento)**

- Con `element.captureStream()` + `MediaRecorder` se grabaron dos fragmentos webm/opus. Se decodificaron con `OfflineAudioContext.decodeAudioData`:

  | Archivo | Duración | RMS | Pico | Frecuencia |
  |---------|----------|-----|------|------------|
  | `fase3a-salida-elemento-tono-la-440hz.webm` | 2,9 s | 0,199 | 0,286 | ≈478 Hz (por cruces por cero, método aproximado) |
  | `fase3a-salida-elemento-tono-mi-659hz.webm` | 2,4 s | 0,199 | — | **657,5 Hz** por autocorrelación (659 Hz generados) |

- El RMS coincide con la amplitud de 0,3 con que se generaron los tonos (RMS teórico 0,212).
- **Qué demuestra:** el elemento decodifica y emite la señal real de cada MP3.
- **Qué no demuestra:** que se oiga por los altavoces. Nadie lo **escuchó** y el entorno no permite capturar el sonido del sistema.
- **Volumen:** las grabaciones a volumen 0,8 y 0,4 dieron el mismo RMS (0,194 frente a 0,201). En Chrome, `captureStream()` captura la señal **antes** del volumen del elemento, así que el efecto del volumen no se pudo medir ni escuchar; solo se verificaron `element.volume` y `element.muted`.

**Avisos en la consola de producción (no son errores)**
- `THREE.Clock … deprecated` (React Three Fiber, conocido desde la 2B).
- Un aviso del compilador de *shaders* de ANGLE/Direct3D: `warning X4122: … cannot be represented accurately in double precision`. Es una advertencia del controlador gráfico sobre los *shaders* de three o del postprocesado.

### Comprobaciones no realizadas o con límites

- **Audición:** no se escuchó el sonido; la evidencia es el estado del elemento, los bytes decodificados y la señal grabada del elemento.
- **Efecto del volumen en la salida:** no se pudo medir (ver arriba).
- **Selector nativo:** no se usó el selector de archivos del sistema (`DataTransfer`, como en la 2A).
- **Bloqueo de autoplay real:** no se reprodujo, porque los clics reales cuentan como gesto. El camino `NotAllowedError` está cubierto por las pruebas simuladas.
- **Otros entornos:** no se probó en dispositivos móviles físicos, Safari ni Firefox, ni con MP3 largos o con VBR.

---

## Fase 2B: esfera 3D real (2026-10-07)

### Antes de modificar

Se leyeron `CLAUDE.md`, `docs/progreso.md`, `docs/diseno-ui.md` y los componentes. La base estaba bien: **197/197** pruebas, typecheck y build correctos.

### Referencia técnica revisada

Del repositorio `github.com/franbz1/the-artifact` (rama `master`) se revisaron `ArtifactCanvas.tsx`, `ArtifactScene.tsx`, `ArtifactMesh.tsx`, `artifact.geometry.ts` y `artifact.constants.ts`. Se tomaron **ideas**, no código:

- Icosaedro subdividido + `mergeVertices`.
- Posiciones base guardadas y desplazamiento radial con ruido simplex.
- `MeshPhysicalMaterial` y Bloom.

**No se copió:**

- Su aplicación.
- Su paleta cálida (cobre y ámbar).
- Su `AudioProvider` y su playlist.
- Su cámara con zoom.
- Los "shivers" (ondas que la referencia lanza a intervalos aleatorios).

El ruido simplex se reescribió (algoritmo clásico de Perlin/Gustavson) y el cálculo de normales es propio.

### Implementado (`src/features/player/visualizer/`)

| Archivo | Función |
|---------|---------|
| `simplexNoise.ts` | Ruido simplex 3D propio, determinista, sin asignar memoria por llamada |
| `orbGeometry.ts` | `createOrbGeometry` (icosaedro + `mergeVertices`, normales suaves y `boundingSphere` fijo), `orbDisplacement`, `computeSmoothNormals` (normales propias) y `OrbDeformer` (deforma desde las direcciones base) |
| `orbAudio.ts` | Entrada de audio para la fase 3: `OrbAudioLevels`, `SILENT_AUDIO` (energía 0), `clamp01` y `smoothTowards` (suavizado que depende del tiempo) |
| `OrbMesh.tsx` | Malla + `meshPhysicalMaterial`; `useFrame` (prioridad 0) deforma y rota según el reloj; con movimiento reducido, forma fija |
| `OrbScene.tsx` | Entorno con `Environment` + `Lightformer` (sin HDR remoto), la malla y `EffectComposer` con Bloom moderado + `ToneMapping` ACES |
| `OrbCanvas.tsx` | `<Canvas>` con `dpr` limitado, fondo transparente, `pointer-events: none`, `frameloop="demand"` con movimiento reducido y aviso de `webglcontextlost` |
| `Visualizer.tsx` | Componente cliente `memo`: comprueba WebGL en un efecto, carga `OrbCanvas` con `next/dynamic` y `ssr: false`, muestra un marcador del mismo tamaño mientras carga y estados alternativos si falla |
| `SceneErrorBoundary.tsx` | Aísla los fallos de la escena (contexto WebGL o carga del módulo) |
| `webgl.ts` | `isWebGLAvailable()` y perfiles de calidad (escritorio y móvil) |
| `usePrefersReducedMotion.ts` | `useSyncExternalStore` sobre `prefers-reduced-motion`; el servidor asume `false` sin desajuste de hidratación |

### Geometría y animación

- **Malla:** `IcosahedronGeometry(1, detail)` sin `normal` ni `uv`, fusionada con `mergeVertices`, así cada punto es un único vértice. Al deformar no se abren grietas y las normales son suaves, sin facetas.
  - **Escritorio:** detalle 28 → 8 412 vértices.
  - **Móvil o táctil:** detalle 18 → 3 612 vértices.
- **Deformación:** se calcula siempre desde las direcciones base: `posición = dirección · (1 + d(dirección, t, energía))`. Nunca se suma sobre la posición anterior.
  - `d` combina dos capas de ruido simplex de baja frecuencia (0,78 y 1,5) con amplitud 0,12. El dominio se desplaza despacio en tres ejes (velocidad 0,09), lo que da pliegues amplios que cambian lento.
  - **Pendiente máxima medida** entre vértices vecinos: **0,605** (≈31°). Sin picos.
- **Normales:** `computeSmoothNormals` (promedio por área, sobre los arreglos tipados).
  - Da **exactamente** el mismo resultado que `computeVertexNormals` de three: diferencia 0.
  - Es unas 7 veces más rápida: 0,57 ms frente a 4,20 ms con 8 412 vértices.
- **Coste medido en Node:**

  | Perfil | Coste por fotograma |
  |--------|---------------------|
  | Escritorio | 2,35 ms |
  | Móvil | 1,06 ms |

  La primera versión (detalle 36 y normales de three) costaba 8 ms y se descartó.
- **Bucle sin estado de React:** `useFrame` usa refs y los buffers de la geometría. No crea geometrías, materiales ni arreglos por fotograma. El único `setState` es el aviso del primer fotograma, una sola vez.
- **Límites:** el `boundingSphere` es fijo (radio `1 + desplazamiento máximo`). No se recalcula y el objeto nunca se recorta.
- **Tiempo, no fotogramas:** la forma y la rotación dependen de `clock.elapsedTime`. Una prueba verifica que aplicar `t = 3 s` de una vez es idéntico a 180 pasos de 1/60 s.

### Material e iluminación

- **Material:** `MeshPhysicalMaterial` con:
  - Color `#041016` (casi negro azulado).
  - `metalness` 0,88: el color visible sale de los reflejos.
  - `roughness` 0,26: reflejos definidos que conservan el degradado de los pliegues.
  - `clearcoat` 0,55 y `clearcoatRoughness` 0,14.
  - `envMapIntensity` 1,7.
  - **Sin `emissive`:** la superficie no se ilumina de forma uniforme.
- **Entorno generado en la escena:** `<Environment resolution={256} frames={1}>` con `Lightformer`. Se renderiza una sola vez porque las luces no se mueven.

  | Lightformer | Efecto |
  |-------------|--------|
  | Dos paneles turquesa grandes a los lados | Reflejos turquesa amplios |
  | Tiras blancas arriba y al frente | Brillos blancos definidos |
  | Relleno turquesa muy tenue frontal | Se lee el volumen |
  | Anillo turquesa abajo | Reflejo inferior |

  El resto del entorno es negro, lo que deja zonas oscuras.
- **Postprocesado** (añadido **después** de verificar el material sin él; captura `fase2b-material-sin-postprocesado.png`):
  - `Bloom` con intensidad 0,6, umbral 0,55 y `mipmapBlur`: solo brillan los reflejos claros.
  - `ToneMapping` ACES explícito, porque con el compositor el renderer no aplica el tone mapping al final.
- **Orden del render:** el `EffectComposer` de `@react-three/postprocessing` registra su `useFrame` con prioridad 1 y pasa a hacer el render. La malla actualiza la forma con prioridad 0, antes. No hay otras prioridades positivas.

### Entrada de audio prevista (fase 3)

- `Visualizer` recibe `audio?: OrbAudioInput` (por defecto `SILENT_AUDIO_INPUT`, con energía 0) y lo pasa a la malla.
- En la fase 3, quien lea el `AnalyserNode` actualizará `audio.current` con `energy`, `bass` y `treble` normalizados a [0, 1], en su propio bucle y sin estado de React.
- La malla ya aplica a esos valores:
  - `clamp01`, que protege contra NaN o valores fuera de rango.
  - `smoothTowards`, un suavizado exponencial que depende del tiempo: sube rápido (12/s) y baja lento (3/s).
- Con esa energía se modificarán:
  - **La amplitud:** una capa de ruido adicional de frecuencia 2,3.
  - **El brillo:** `envMapIntensity` aumenta en hasta 0,6.
- Hoy la energía es **0**: no hay amplitudes inventadas ni golpes simulados.

### Integración con Next.js y distribución

- **Server Components:** `page.tsx` y `layout.tsx` siguen siéndolo.
- **Carga solo en el cliente:** `Visualizer` (cliente) carga `OrbCanvas` con `dynamic(() => import('./OrbCanvas'), { ssr: false })`.
  - El HTML del servidor trae el marcador "Cargando visualización 3D…" y ningún `<canvas>`.
  - three y la escena van en un *chunk* de 1,1 MB que **no** está entre los scripts iniciales.
- **Sin recreaciones:** `Visualizer` es `memo`, no recibe datos de la playlist y el Canvas no tiene `key`.
- **Tamaño fijo, solo por el *viewport*:**
  - `--visualizer-size: min(380px, max(200px, 100dvh − 26rem))` en escritorio y `min(100%, 340px)` en móvil.
  - La columna se alinea arriba: un título largo crece hacia abajo y el área principal se desplaza.
  - `scrollbar-gutter: stable` evita el desplazamiento horizontal de 7 px que causaba la barra de desplazamiento con títulos largos (defecto encontrado y corregido durante la verificación).
- **Marcador:** el borde y el texto se retiran cuando se dibuja el primer fotograma (`data-state="ready"`).

### Rendimiento y accesibilidad

- **Resolución limitada:** `dpr` máximo de 1,5 en escritorio y 1,25 en móvil.
- **Antialiasing:** MSAA del compositor con 4 muestras (2 en móvil).
- **Perfil de calidad:** se elige al montar.
- **Sin efectos extra:** no hay sombras, partículas, SSAO ni controles de cámara.
- **Liberación de recursos:** la geometría propia se libera en la limpieza del efecto, y React Three Fiber libera el renderer y la escena al desmontar.
- **Movimiento reducido:** con `prefers-reduced-motion: reduce`, la escena usa `frameloop="demand"` y muestra una forma orgánica fija (t = 6,5 s), sin rotación.
- **Sin interferencias:** el canvas tiene `pointer-events: none`, así que no bloquea el desplazamiento, los botones ni el diálogo.
- **Sin WebGL:** si no está disponible, falla la escena o se pierde el contexto, aparece un estado alternativo (`role="status"`) que explica que la playlist y la importación siguen funcionando. En los fallos hay un botón "Reintentar".

### Archivos

| Acción | Archivo |
|--------|---------|
| Creado | Los 10 archivos de `src/features/player/visualizer/` (tabla anterior) |
| Creado | `tests/orbGeometry.test.ts` (14 pruebas), `tests/Visualizer.test.tsx` (8 pruebas), `tests/setup/canvas.ts` |
| Creado | `docs/capturas/fase2b-*.jpg/png` y `fase2b-deformacion-timelapse.gif` |
| Modificado | `src/features/player/components/Player.tsx`: `<Visualizer />` en lugar de `<VisualizerSlot />` |
| Modificado | `src/features/player/player.module.css`: tamaño por *viewport*, columna alineada arriba, `scrollbar-gutter`, estados del marcador y estado alternativo |
| Modificado | `src/app/globals.css`: `--visualizer-size`, `--visualizer-min` (200 px) y `--visualizer-max-mobile` (340 px) |
| Modificado | `vitest.config.mts`: `setupFiles` (en jsdom, `getContext` devuelve `null`, como un navegador sin WebGL) |
| Modificado | `package.json` + `package-lock.json`: las 6 dependencias de la tabla de versiones |
| Modificado | `CLAUDE.md`, `docs/progreso.md`, `docs/diseno-ui.md` |
| Retirado | `src/features/player/components/VisualizerSlot.tsx` (sustituido por `Visualizer`) |

### Pruebas (219 en 11 archivos)

Las 197 anteriores siguen pasando **sin cambios**. Nuevas:

- **`orbGeometry.test.ts` (14, Node, sin WebGL)**
  - Ruido determinista, continuo y acotado.
  - Geometría indexada sin vértices duplicados y `boundingSphere` fijo.
  - Deformación sin acumulación (50 actualizaciones = una).
  - Dependencia del tiempo y no de los fotogramas.
  - Cambio continuo y pendiente máxima menor que 1.
  - Energía 0 = solo movimiento ambiental.
  - Normales unitarias e iguales a las de three.
  - `dispose`, `clamp01` y `smoothTowards` independiente de los fps.
- **`Visualizer.test.tsx` (8, jsdom)**
  - Sin WebGL, el estado alternativo con la importación y la navegación funcionando.
  - Con una escena **simulada** que cuenta montajes:
    - El marcador se mantiene hasta el primer fotograma.
    - El audio llega en silencio.
    - Importar, seleccionar, navegar, abrir el diálogo y eliminar → **1 montaje y 0 desmontajes**, con la selección intacta.
    - Un fallo de la escena da el estado alternativo, y Reintentar la recupera.
    - La pérdida de contexto da el estado alternativo.
    - Al desmontar se desmonta la escena.
    - `prefers-reduced-motion` llega a la escena.

**Las pruebas no renderizan WebGL:** la escena de `Visualizer.test.tsx` es simulada y no se presenta como evidencia de render. El render real se verificó en el navegador.

### Verificación en navegador con WebGL real

**Entorno:** navegador integrado (Chromium) con WebGL2 sobre «ANGLE (Intel UHD Graphics 630, Direct3D11)».

| Comprobación | Resultado |
|--------------|-----------|
| Objeto visible y con volumen | Sí: forma orgánica, oscura y brillante, con reflejos turquesa y blancos y zonas oscuras (`fase2b-escritorio-1366.jpg`) |
| Material sin postprocesado (antes del Bloom) | Verificado primero (`fase2b-material-sin-postprocesado.png`) |
| Movimiento y deformación continuos | Dos capturas consecutivas difieren en el 30 % de los bytes. *Timelapse* de 6 capturas reales (`fase2b-deformacion-timelapse.gif`) |
| Movimiento reducido | Con la preferencia forzada temporalmente en el código (el panel no puede emular la *media query*; el cambio se revirtió): dos capturas separadas 17 s son **idénticas** (0 bytes distintos de 207 936) |
| Importación, selección, navegación y eliminación | MP3 reales al final, al inicio y en la posición 2; seleccionar, Siguiente, Anterior y eliminar otra canción conservando la selección (`next dev` y `next start`) |
| El diálogo no reinicia la escena | El mismo elemento `<canvas>` durante todo el recorrido; 0 `webglcontextlost`; 0 eliminaciones de canvas (`MutationObserver`); 1 canvas en la página |
| Los títulos largos no cambian el tamaño | En producción, **un solo** rectángulo (658, 100, 380×380) en todas las operaciones, incluido el título de 96 caracteres |
| Escritorio 1366×800 | 380×380; escena lista; borde del marcador retirado |
| Móvil 375×812 | 309–310 px de lado, sin desbordamiento horizontal, canvas de 385 px (`dpr` 1,25); el canvas no recibe eventos (`elementFromPoint` devuelve el contenedor) |
| Hidratación y errores | Ningún error de hidratación ni sin capturar (escucha de `error` y `unhandledrejection`) en desarrollo y producción; servidores sin errores |
| Consola | Solo `THREE.Clock: This module has been deprecated` (aviso, no error), emitido por `@react-three/fiber` 9.8.1 con three ≥ r183 (`node_modules/@react-three/fiber/dist/events-*.js`). Nuestro código no usa `Clock` |

### Comprobaciones no realizadas o con límites

- **Grabación en tiempo real:** no fue posible. Con la ventana de la app oculta o minimizada, el panel no ejecuta `requestAnimationFrame` y `MediaRecorder` sobre el canvas grabó 0 bytes. El GIF entregado es un ***timelapse*** de 6 capturas reales separadas unos 3 s (450 ms por fotograma), no un video a velocidad real.
- **Fluidez:** no se midieron los fps reales en el navegador, por el mismo motivo. El coste de CPU por fotograma se midió en Node.
- **Emulación de `prefers-reduced-motion`:** el panel no la permite. El camino de render se comprobó forzando la preferencia en el código de forma temporal, y el cableado de la *media query* con una prueba unitaria.
- **Otros dispositivos y navegadores:** no se probó en GPU móviles reales, Safari ni Firefox.
- **Fallo real de WebGL:** el estado alternativo sin WebGL se verificó en jsdom, que no tiene WebGL, pero no en un navegador con WebGL desactivado.

---


## Fase 2A, revisión: importación de MP3 reales (2026-10-07)

### Antes de modificar

Se leyeron `CLAUDE.md`, `docs/progreso.md` y los archivos existentes. Ningún archivo había cambiado desde la sesión anterior (fechas de modificación revisadas). La base estaba bien: `npm test` **144/144**, `npm run typecheck` sin errores y `npm run build` correcto.

### Cambio de requisito

"Agregar canción" ahora **importa un archivo MP3 real** del dispositivo. Se retiraron los campos de duración manual (minutos y segundos) y el botón "Cargar ejemplo". Las cinco canciones ficticias pasaron a `tests/fixtures/sampleSongs.ts`, solo para pruebas del dominio.

### Implementado

**Dominio (TypeScript puro, sin `File`, `URL` ni APIs del navegador)**

- `Song.artist` pasa a ser `string | null`: vacío o ausente se guarda como `null`, sin inventar datos. La interfaz muestra «Artista no especificado».
- `validateSongInput` ya no exige artista.
- `Song.durationSeconds` mantiene su contrato: entero mayor que 0.
- `Playlist`, la lista enlazada y sus reglas de selección no cambian.

**Capa cliente de audio (`src/features/player/audio/`)**

- **`mp3Signature.ts`**
  - `isDeclaredMp3` exige extensión `.mp3` **o** tipo `audio/mpeg`/`audio/mp3`. Un `File.type` vacío no rechaza un `.mp3`.
  - `looksLikeMp3` revisa los primeros 4 KB: acepta una etiqueta ID3 o una cabecera de trama MPEG Layer III, y rechaza RIFF/WAV, Ogg, FLAC y MP4.
- **`readAudioMetadata.ts`**
  - **Validación previa:** rechaza los archivos vacíos y luego los que no se declaran MP3. Después revisa la firma y carga los metadatos con un `<audio>` silenciado (`preload="metadata"`) y una URL temporal.
  - **Duración:** exige un valor finito y mayor que 0. Si el navegador informa `Infinity`, mueve `currentTime` al final y espera `durationchange`.
  - **Errores con código:** `empty`, `not-mp3`, `read-error`, `unsupported`, `invalid-duration`, `timeout` (10 s) y `aborted`.
  - **Limpieza:** al terminar, fallar, agotar el tiempo o cancelarse (`AbortSignal`), quita listeners, cancela el temporizador, vacía `src` y revoca la URL.
  - **Sin reproducción:** nunca llama a `play()`.
  - **Pruebas:** el elemento de audio, las URLs y los temporizadores son inyectables.
- **`useAudioFileReader.ts`**
  - Estado del archivo: `empty`, `reading`, `ready` o `error`.
  - **Respuestas obsoletas:** cada selección cancela la lectura anterior y aumenta un contador de solicitudes. Una respuesta solo se aplica si coincide con la solicitud vigente y no está cancelada.
  - **Desmontaje:** al cerrar el diálogo cancela la lectura pendiente.
- **`sourceRegistry.ts` (`AudioSourceRegistry`)**
  - Guarda, por id de canción, el `File` real, el nombre original y la duración precisa.
  - No administra el orden ni la selección.

**Coordinación (`src/features/player/playlistController.ts`)**

- **Importación atómica:** crea y valida la canción, comprueba que el id no exista en la playlist ni en el registro, inserta en la `Playlist` (que no cambia si la posición es inválida) y solo entonces registra la fuente, paso que ya no puede fallar. Si algo falla, no queda ni un nodo sin archivo ni una fuente huérfana.
- **Eliminación:** al eliminar una canción se retira también su fuente.
- **Mismo archivo varias veces:** se puede importar el mismo `File` más de una vez; cada importación recibe un id distinto.
- **Reproducción futura:** `getSource(id)` entrega el archivo para la fase 3.

**Formulario (`songForm.ts`)**

- **Campos:** archivo, título (por defecto, el nombre sin `.mp3`), artista opcional y ubicación.
- **Duración:** no se escribe; sale del archivo.
- **Conversión al dominio:** `toDomainDurationSeconds` redondea **hacia arriba**. Así 0,4 s da 1 s (> 0) y la duración mostrada nunca es menor que la real. La duración precisa se guarda en el registro de fuentes.
- **Posición:** `toInternalIndex` y `toVisiblePosition` siguen siendo el único punto de conversión entre posición visible e índice interno.

**Interfaz**

- **Diálogo "Agregar canción":**
  - Selector de archivo (`accept=".mp3,audio/mpeg"`) con nombre y tamaño del archivo.
  - Título editable y prellenado. Si se elige otro archivo, el título automático se reemplaza, pero no uno escrito a mano.
  - Artista opcional, con la indicación de que vacío se mostrará «Artista no especificado».
  - Duración de solo lectura (por ejemplo, "0:08 (7,24 s)").
  - Ubicación con el campo de posición visible **solo** al elegir «En una posición». Escribir en él no cambia la opción.
  - Mientras lee: "Leyendo archivo…", "Agregar" deshabilitado y la playlist sin cambios.
  - Los errores del archivo, del título y de la posición se asocian a su campo (`aria-invalid` + `aria-describedby`). Se conservan los campos y el archivo válido.
- **Playlist:** títulos en hasta 2 líneas, sin ocultar duración ni el botón de eliminar. «Artista no especificado» en cursiva. Cada fila tiene `data-song-id`.
- **Área principal:** visualizador, detalles y navegación en una **misma columna centrada** de 380 px (texto alineado a la izquierda).
  - Ya no se recorta el título: se muestra completo.
  - La esfera cede espacio, con un mínimo de 160 px, o el área principal se desplaza. No se fija ninguna altura que oculte información.

### Defecto encontrado y corregido

Al elegir un segundo archivo, el título automático del primero **no** se reemplazaba. El actualizador de `setValues` se ejecuta en diferido y leía `autoTitleRef` cuando ya contenía el título nuevo. Ahora se captura el valor anterior antes de actualizar la ref. Lo detectaron dos pruebas nuevas de `Player.test.tsx` (cambio de archivo y "A no sobrescribe B").

### Investigación de la selección inesperada

**Revisión del código.** La selección solo puede cambiar por cuatro caminos:

| Camino | Origen |
|--------|--------|
| Clic en una fila | `Player.handleSelect` → `Playlist.select` |
| Anterior y Siguiente | `Player.handleStep` → `next`/`previous` |
| Primera inserción en una playlist vacía | `Playlist.add` |
| Eliminación de la canción actual | `Playlist.remove` |

Los efectos de `Player` (restaurar el foco al cerrar el diálogo, mover el foco tras eliminar y bloquear el desplazamiento) solo cambian el foco o los estilos, nunca la selección. Ningún temporizador, `onFocus` ni evento de redimensionado toca la playlist.

**Prueba en una pestaña nueva (`next dev`).** Se instaló un `MutationObserver` sobre `aria-current` y un registro de `pointerdown`, `click` y `keydown` con `isTrusted`. Luego se ejecutó:

1. Se importaron tres MP3 reales.
2. Se seleccionó la canción intermedia con un clic real.
3. La página quedó **30 s sin interacción**.
4. Se abrió y canceló el diálogo con clics reales.
5. Se importó otra canción al inicio.
6. Se eliminó una canción distinta de la actual.
7. Se redimensionó a 375×812, 1366×800, 768×1024 y 1366×800.

Resultado: el id seleccionado (`89eea865…`) fue el mismo en todos los pasos. El registro tiene **solo dos cambios de selección**, la primera inserción y el clic explícito, cada uno precedido por su evento. Durante la espera no hubo ningún evento.

**Repetición de las condiciones del incidente anterior (`next start`).** Se hizo un recorrido completo con clics programáticos al tamaño del panel, Escape, y luego redimensionado a 1366×800, quitar el foco, dos capturas y 5 s de espera. Resultado: **0 eventos y 0 cambios de selección** tras el redimensionado; el id se conservó; consola vacía y sin errores sin capturar.

**Conclusión: el defecto no se reprodujo.** No se identificó ninguna causa en el código ni se atribuye al usuario. Lo único comprobado del incidente original (sesión del 2026-10-06) es que la fila 2 quedó enfocada y seleccionada, lo que coincide con un clic sobre ella. Ese registro no incluía eventos, así que no hay evidencia de su origen. Se añadió una prueba automatizada que cubre la secuencia (espera, diálogo cancelado, importación previa, eliminación de otra canción y evento `resize`).

### Archivos

| Acción | Archivo |
|--------|---------|
| Creado | `src/features/player/audio/mp3Signature.ts` |
| Creado | `src/features/player/audio/readAudioMetadata.ts` |
| Creado | `src/features/player/audio/useAudioFileReader.ts` |
| Creado | `src/features/player/audio/sourceRegistry.ts` |
| Creado | `src/features/player/playlistController.ts` |
| Creado | `tests/readAudioMetadata.test.ts`, `tests/playlistController.test.ts` |
| Creado | `tests/fixtures/sampleSongs.ts` (antes `src/features/player/sampleSongs.ts`) |
| Creado | `docs/capturas/fase2a-mp3-*.jpg` (5 capturas) |
| Modificado | `src/domain/Song.ts`: artista opcional (`null`) y `validateSongInput` sin regla de artista |
| Modificado | `src/features/player/songForm.ts`: formulario de importación y `toDomainDurationSeconds` |
| Modificado | `src/features/player/format.ts`: `displayArtist`, `formatFileSize`, `formatPreciseSeconds` |
| Modificado | `src/features/player/usePlaylist.ts`: usa `PlaylistController`; sin "Cargar ejemplo" |
| Modificado | `src/features/player/components/AddSongDialog.tsx`: diálogo de importación |
| Modificado | `src/features/player/components/Player.tsx`: lector inyectable y columna centrada |
| Modificado | `PlaylistPanel.tsx` y `SelectedSong.tsx`: artista no especificado; `data-song-id` en las filas |
| Modificado | `src/features/player/player.module.css`, `src/app/globals.css`: columna centrada, títulos de 2 líneas, sin recorte del título y estilos del selector de archivo |
| Modificado | `tests/Song.test.ts`: dos casos que exigían artista se adaptaron al nuevo requisito y se añadieron 6 pruebas de artista opcional |
| Modificado | `tests/songForm.test.ts`: reescrito para el formulario de importación (se conservan los casos de posición, índice y formato) |
| Modificado | `tests/Player.test.tsx`: reescrito con un lector simulado y controlable |
| Modificado | `tests/Playlist.test.ts` (+1, usa las fixtures), `tests/domainBoundary.test.ts` (prohíbe `File`, `Blob`, `URL`, `HTMLAudioElement`… en el dominio) |
| Modificado | `CLAUDE.md`, `docs/progreso.md`, `docs/diseno-ui.md` |
| Retirado | `src/features/player/sampleSongs.ts` (movido a fixtures) |
| Movido | Capturas de la versión anterior a `docs/capturas/historico-formulario-manual/` |

**Pruebas existentes que cambiaron por el nuevo requisito** (no se eliminó ninguna prueba del dominio):
- `Song.test.ts`: el caso `artist: ''` dejó de ser inválido y la expectativa de `validateSongInput` ya no incluye `artist`.
- `songForm.test.ts` y `Player.test.tsx`: sus casos de minutos, segundos y "Cargar ejemplo" se reemplazaron porque esos controles ya no existen.

### Pruebas (197 en 9 archivos)

| Archivo | Pruebas | Cubre |
|---------|---------|-------|
| `DoublyLinkedList.test.ts` | 38 | Sin cambios (fase 1) |
| `Playlist.test.ts` | 32 | Reglas de selección y eliminación, más las fixtures ficticias |
| `Song.test.ts` | 17 | `createSong`, `validateSongInput` y artista opcional |
| `domainBoundary.test.ts` | 6 | El dominio sin React, Next, navegador, `File` ni `URL` |
| `idGenerator.test.ts` | 8 | Sin cambios |
| `playlistController.test.ts` | 14 | Asociación por id, duración entera/precisa, atomicidad sin huérfanas (posición, título e id inválidos), eliminación de la fuente, mismo archivo dos veces, selección y 200 operaciones aleatorias |
| `readAudioMetadata.test.ts` | 20 | Firma y tipo, vacío, no MP3, contenido falso, error de lectura, error al crear la URL, error de metadatos, duración inválida o `Infinity`, tiempo agotado (manual y con temporizadores falsos), cancelación, limpieza completa y sin `play()` |
| `songForm.test.ts` | 34 | Conversión de duración, título desde el nombre, validaciones sin pérdida de datos, sin duración manual, posiciones y formato |
| `Player.test.tsx` (jsdom) | 28 | Importación y lectura, campos, errores por código, respuestas obsoletas, cancelación y reapertura, desmontaje, fallo sin huérfanas, mismo archivo dos veces, foco, selección estable y una playlist por montaje |

**Simulaciones:** `readAudioMetadata.test.ts` usa un elemento de audio, URLs y temporizadores **simulados**, y `Player.test.tsx` usa un lector de metadatos **simulado**. La lectura de MP3 reales se comprobó por separado en el navegador.

**Pruebas de mutación** (los archivos se restauraron después de cada una):
- Desactivar el descarte de respuestas obsoletas en `useAudioFileReader` hace fallar 2 pruebas.
- Quitar `revokeObjectURL` en `readAudioMetadata` hace fallar 10 pruebas.

### Verificación (2026-10-07)

| Comprobación | Resultado |
|--------------|-----------|
| `npm test` | **197/197** en 9 archivos |
| `npm run typecheck` | Sin errores |
| `npm run build` | Correcto, sin avisos |
| `curl` al HTML de producción | HTTP 200, playlist vacía, **0 ids** y sin "Cargar ejemplo" |
| Consola al cargar (dev y producción) | Sin errores ni avisos de hidratación (en dev solo los mensajes informativos de React DevTools y HMR) |
| Importación real en `next dev` y `next start` | Ver "Evidencia de importación real" |
| Errores sin capturar | Escucha de `error` y `unhandledrejection` durante todo el recorrido de producción: **0** |
| Registros del servidor (dev y producción) | Sin errores |
| Escritorio 1366×800 | Playlist a la izquierda. Columna de 380 px con esfera, detalles y navegación alineados a la izquierda (x = 658). Título largo completo (la esfera cede hasta 272 px). Sin desbordamiento |
| Móvil 375×812 | Área principal arriba y playlist debajo. `scrollWidth` = 375. Diálogo con MP3 de 343 px de ancho |
| Zoom (emulado con *viewport* equivalente a 1366×800) | 125 % (1093×640): esfera en su mínimo (160 px), nada recortado. 150 % (911×533): la página se desplaza en vertical. 200 % (683×400): diseño móvil. Sin desbordamiento horizontal ni elementos recortados en ningún caso |
| Foco y teclado | Escape cierra y devuelve el foco a "Agregar canción"; foco inicial en el selector de archivo; Tab atrapado (pruebas) |

### Evidencia de importación real

**Archivos de prueba**

- Se generaron 4 MP3 reales con el codificador `@breezystack/lamejs` 1.2.7: tonos sinusoidales mono a 44,1 kHz y 128 kbps.
  - El codificador se instaló en el directorio temporal de la sesión, **no** en el proyecto.
  - Cabecera de trama `FF FB 90 C4`.
  - Tamaños entre 68 y 198 KB.
- También se crearon un archivo vacío, un texto renombrado a `.mp3` y un WAV real renombrado a `.mp3`.
- No se usaron archivos personales del usuario.

**Cómo llegaron al selector**

- Un servidor local con CORS sirvió los archivos.
- En la página se creó un `File` con los bytes reales, se asignó al `<input type="file">` con `DataTransfer` y se disparó `change`.
- El panel del navegador no puede abrir el selector nativo del sistema, así que **ese paso no se probó**.
- Todo lo demás lo hizo el navegador real (Chromium del panel) sobre el archivo real: firma, `<audio>`, `loadedmetadata` y duración.

**Resultados (en desarrollo y en producción)**

| Archivo | Duración generada | Detectada por el navegador | Mostrada |
|---------|-------------------|----------------------------|----------|
| Tono La 440 | 7,2 s | 7,24 s | 0:08 |
| Tono Do 523 | 12,6 s | 12,64 s | 0:13 |
| Tono Mi 659 (con `File.type` vacío) | 4,3 s | 4,34 s | 0:05 |
| Tono Sol 784 (nombre de 96 caracteres) | 9,1 s | 9,14 s | 0:10 |

La diferencia de unos 0,04 s es el relleno que añade el codificador.

- **Ubicaciones:** se importó al final, al inicio y en la posición 2, y se comprobó el orden resultante.
- **Selección:** la primera importación seleccionó; las demás conservaron el id.
- **Archivos inválidos reales:**
  - `vacio.mp3` → «El archivo está vacío.»
  - Texto renombrado → «El archivo no es un MP3 válido.»
  - WAV renombrado → «El archivo no es un MP3 válido.». Este caso lo frena la firma, aunque el navegador sí podría decodificarlo.
  - En los tres casos "Agregar" no inserta nada y el foco va al selector.
- **Lectura:** "Leyendo archivo…" visible y "Agregar" deshabilitado durante la lectura.
- **Cambio rápido real:** A (12 s) y luego B (4 s) sin esperar: quedó B. La lectura de A se canceló antes de crear su URL.
- **Limpieza real:** se contaron `URL.createObjectURL` y `revokeObjectURL`. Todas las URLs creadas se revocaron, incluida la de una lectura cancelada con su URL ya creada.
- **Cerrar durante la lectura:** no agrega nada, y al reabrir el diálogo empieza limpio.
- **Navegación con canciones reales:** seleccionar, Siguiente y Anterior correctos. Eliminar otra canción conserva la selección; eliminar la actual pasa a la siguiente.

### Comprobaciones no realizadas

- **Selector nativo:** no se abrió el selector de archivos del sistema; el panel no lo permite.
- **Zoom real:** no se usó el zoom del navegador; se emuló con tamaños de *viewport* equivalentes.
- **MP3 de terceros:** no se probaron MP3 de otras herramientas (VBR, con portada ID3 grande, de duración larga). La rama `Infinity` está cubierta solo por pruebas unitarias.
- **Otros entornos:** no se probó con lector de pantalla, ni en Safari o Firefox, ni en dispositivos físicos.
- **Ids en contexto no seguro:** no se probó la alternativa de ids en un contexto realmente no seguro (solo con pruebas unitarias).

---

## Fase 2A, versión inicial (2026-10-06, reemplazada)

Se conserva como registro. La primera versión de la 2A creó `Playlist`, `idGenerator`, `usePlaylist`, el diálogo con **duración manual** (minutos y segundos), el botón "Cargar ejemplo" con cinco canciones ficticias, la distribución oscura basada en el video y `VisualizerSlot`.

- **Verificación de entonces:** 144/144 pruebas, typecheck y build correctos, sin errores de hidratación.
- **Corrección de entonces:** `userEvent.setup({ delay: null })` para evitar pruebas lentas e inestables.
- **Capturas:** están en `docs/capturas/historico-formulario-manual/`.
- **Incidente de entonces:** en una pestaña de producción, la fila 2 apareció seleccionada sin que el script la tocara. En aquel momento se atribuyó a una posible interacción del usuario **sin evidencia**; esa atribución se retira. Ver "Investigación de la selección inesperada".

---

## Migración a Next.js (2026-10-06)

### Motivo y documentación consultada

El usuario decidió desarrollar el reproductor con Next.js + TypeScript y App Router. Se consultó la documentación local de Next 16.4.0 (`node_modules/next/dist/docs/`): instalación, migración desde Vite, TypeScript, `useTypeScriptCli`, `next typegen`, layout raíz, metadatos, Vitest y `turbopack.root`.

### Compatibilidad

- **TypeScript 7 sin API de JavaScript:** `next build` usa por defecto el `tsc` del proyecto (`experimental.useTypeScriptCli`), así que TS 7 funciona sin bajar de versión. Los errores salen con el formato nativo de `tsc`.
- **Vite** se queda porque Vitest 5 lo exige. **`@vitejs/plugin-react`** se retiró.
- **`turbopack.root`** es explícito porque hay un `package.json` y un `package-lock.json` ajenos en `C:\Users\Edwin Rueda`.
- **`allowJs: true`** lo añadió Next. No reduce comprobaciones.
- **Sin forzar dependencias:** no se usó `--force` ni `--legacy-peer-deps`.

### Archivos de la migración

- **Creados:** `src/app/layout.tsx` (`lang="es"`, metadatos), `src/app/page.tsx`, `src/app/globals.css`, `next.config.ts`, `vitest.config.mts`, `tsconfig.domain.json`, `tests/domainBoundary.test.ts` y `.claude/launch.json`.
- **Modificados:** `package.json`, `tsconfig.json` (conserva `strict`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`), `.gitignore` y `tests/assertListInvariants.ts`.
- **Retirados:** `index.html`, `src/main.tsx`, `src/App.tsx`, `vite.config.ts` y `dist/`.

### Corrección de prueba inestable (migración)

La prueba pseudoaleatoria de 500 operaciones superaba el límite de 5 s, por una llamada a `expect` por enlace. `assertListInvariants` hace ahora las mismas comprobaciones con comparaciones directas. No se quitó ninguna comprobación ni se subió el límite.

### Scripts

| Script | Comando |
|--------|---------|
| `dev` | `next dev` |
| `build` | `next build` (incluye la comprobación de tipos con `tsc`) |
| `start` | `next start` |
| `typecheck` | `next typegen && tsc --noEmit && tsc --noEmit -p tsconfig.domain.json` |
| `test` | `vitest run` |
| `test:watch` | `vitest` |

### Verificación de la migración

- **Pruebas y compilación:** 52/52, typecheck y build correctos.
- **Navegador:** `next start` respondió con HTTP 200 y 0 mensajes en consola.
- **Mutaciones:** romper `next.prev` en `remove` hace fallar 7 pruebas; usar `document` en el dominio hace fallar `tsc -p tsconfig.domain.json`.

---

## Decisiones tomadas

1. **Dominio independiente** en `src/domain/`: sin React, Next.js, `"use client"`, DOM, `File` ni `URL`. Lo vigilan `tsconfig.domain.json` y `tests/domainBoundary.test.ts`.
2. **Pertenencia de nodos:** cada lista guarda un `WeakSet` privado. `remove` rechaza, sin cambios, los nodos ajenos, falsificados o ya eliminados.
3. **Encapsulación:** `head`, `tail` y `size` son privados. Hacia afuera la lista entrega `ReadonlyNode<T>`.
4. **Índices:** desde 0 en el dominio y desde 1 en la interfaz. `insertAt` lanza `RangeError` antes de mutar.
5. **Song:** título obligatorio; artista opcional (`null`, nunca inventado); `durationSeconds` entero mayor que 0. La interfaz inyecta el generador de ids.
6. **Duración:** la duración precisa detectada se **redondea hacia arriba** para el dominio. La precisa se guarda en el registro de fuentes para la reproducción.
7. **Archivos reales:** el `File` vive en `AudioSourceRegistry` (capa cliente), asociado por id. El orden y la selección pertenecen solo a `Playlist`. `PlaylistController` garantiza que la importación sea atómica y que eliminar retire también la fuente.
8. **Validación de MP3 en capas:** extensión o MIME (un tipo vacío no bloquea), firma de los primeros bytes y metadatos reales del navegador con duración finita. No se confía solo en `accept`, la extensión o el MIME.
9. **Lectura asíncrona:** cada lectura tiene un número de solicitud y un `AbortController`. Las respuestas obsoletas se descartan y los recursos (URL, listeners y temporizador) se liberan en todos los casos.
10. **Arquitectura Next.js:**
    - `page.tsx` y `layout.tsx` son Server Components; `Player` es el único `"use client"`.
    - Hay una playlist y un registro por montaje; no existe instancia global.
    - React recibe snapshots con datos planos, sin `File` ni nodos.
11. **Modal propio** en lugar de `<dialog>`: permite controlar el foco, Escape e `inert`, y probarlos en jsdom.
12. **Sin `next/font`:** fuentes del sistema (sans serif), para no depender de la red durante el build.
13. **Sin controles falsos:** no hay play, pausa, progreso ni volumen hasta la fase 3. "Anterior" y "Siguiente" sí funcionan (mueven la selección por la lista).
14. **Esfera (2B):** la geometría es procedural (icosaedro fusionado y ruido simplex propio), sin GLB ni imágenes. La deformación parte siempre de la base. El material es `MeshPhysicalMaterial` oscuro y metálico, con reflejos de un entorno de `Lightformer` generado en la escena. El Bloom es moderado y el tone mapping, ACES explícito.
15. **Normales propias:** dan el mismo resultado que las de three y son unas 7 veces más rápidas. Así se puede usar más detalle sin pasar de unos 2,5 ms por fotograma en escritorio.
16. **Escena aislada:** `next/dynamic` con `ssr: false` dentro de un componente cliente `memo`, sin `key` ligada a la canción, con un marcador del mismo tamaño mientras carga y estados alternativos si falla.
17. **Entrada de audio de la esfera:** `OrbAudioInput`, un objeto estable con energía 0 por defecto, `clamp01` y un suavizado dependiente del tiempo. Nunca amplitudes inventadas.
18. **Motor de reproducción (3A):** `AudioEngine` en la capa cliente, con un solo `HTMLAudioElement` creado de forma diferida en el navegador. El orden y la selección siguen en `Playlist`; el motor solo sabe qué id cargó y obtiene el `File` del registro. Las versiones de fuente y de intención de reproducción descartan respuestas y eventos obsoletos.
19. **Decisión de autoplay en el reproductor, no en el motor:** `syncPlayback(autoplay)` se llama después de cada acción. La primera importación y la eliminación de la actual dejan la canción en pausa; el cambio manual sigue la intención previa; el final automático reproduce.
20. **Estado "reproduciendo" confirmado:** solo con la promesa de `play()` resuelta y `paused === false`.
21. **Sin temporizadores en el progreso:** el progreso sale de `currentTime` (`timeupdate`, unas 4 veces por segundo). No se usa `requestAnimationFrame` para suavizar: con canciones normales, cada paso del progreso es de menos de 1 px.
22. **Ruta de Web Audio propiedad del motor (3B):** contexto, fuente y analizador se crean al primer intento de reproducir, una vez por elemento, y se liberan con él. Ruta única fuente → analizador → destination; `resume()` antes de `play()` con las mismas versiones.
23. **Análisis en dBFS con rangos fijos (3B):** RMS para la energía y bandas de 40–250 Hz y 2–8 kHz con corrección de la ventana Blackman. Sin control automático de ganancia, para distinguir pasajes suaves y fuertes.
24. **Un solo suavizado (3B):** el `AnalyserNode` usa `smoothingTimeConstant = 0`; solo suaviza la esfera.
25. **Volumen (3B):** en Chromium el analizador ya recibe la señal atenuada por `volume`/`muted`; no se multiplica de nuevo ni se añade un `GainNode`.
26. **Persistencia en IndexedDB (4A):** un registro por canción con metadatos y archivo juntos, y un registro `library` con orden, selección y preferencias. Al restaurar se reconstruye la lista enlazada con sus APIs públicas.
27. **Guardado (4A):** una transacción a la vez, siempre con el estado más reciente y solo con lo necesario (los MP3 se escriben una vez). Preferencias agrupadas. Nunca se guarda durante la restauración.
28. **Datos dañados (4A):** se recupera lo válido y se informa; no se borran registros inválidos y se copia el registro original antes de reescribirlo.
29. **Continuidad (4A):** `AGENTS.md` con instrucciones estables para cualquier agente; el estado de cada sesión, en "Estado para retomar".
30. **Búsqueda solo de presentación (4B):** vive en `PlaylistPanel`; nunca toca la lista enlazada, la selección ni la persistencia, y las acciones usan ids.
31. **Repetición en `ended` (4B):** una función pura (`actionAfterEnd`) decide con el modo vigente; no se usa `loop`. Se guarda como campo opcional sin migrar la base.
32. **Vaciar (4B):** `engine.unload()` antes de vaciar la playlist y el registro; la persistencia borra todo en una transacción y conserva las preferencias.
33. **Barra fluida (4B):** `requestAnimationFrame` lee `currentTime` del elemento real y escribe en el DOM; sin estado de React por fotograma; el arrastre manda.
34. **Títulos largos (4B):** caja de 2 líneas (3 con 900 px de alto) desplazable y enfocable; la esfera y los controles no dependen del título.
35. **Esfera gobernada por la señal (5):** en reposo es una esfera perfecta (la deformación se multiplica por la intensidad real); con señal se deforma con su propio tiempo musical; sin reproducción vuelve a la esfera (~0,5–1 s) y se detiene. Nada de reloj absoluto ni movimiento ambiental.
36. **Aleatorio con ids (5):** historial y candidatos auxiliares; la selección siempre por `Playlist.select`; se guarda solo la preferencia.
37. **Botones de modo (5):** 44×44 px de área, solo icono; el texto del modo de repetición es su nombre accesible.

## Problemas pendientes y limitaciones

- ~~Recargar la página pierde la playlist y sus archivos~~ (resuelto en la 4A con IndexedDB).
- **Fase 4A, sin sincronización entre pestañas:** dos pestañas que editan a la vez pueden sobrescribirse (la última escritura gana). Los cambios de versión de la base se manejan sin dejar conexiones bloqueadas.
- **Fase 4A, almacenamiento del navegador:** depende del navegador y del origen, puede borrarse (limpieza de datos, presión de espacio) y no es una copia de seguridad permanente. No se pide `navigator.storage.persist()`.
- **Fase 4A, agrupación del volumen:** un cambio de volumen o silencio hecho menos de 400 ms antes de cerrar la pestaña puede no guardarse (no se usa `beforeunload`; al desmontar sí se escribe lo pendiente).
- **Fase 4A, fallos reales no reproducidos:** cuota agotada, transacción abortada y apertura bloqueada solo se probaron con IndexedDB simulado.
- **Fase 4A, registros inválidos conservados:** no se muestran ni se borran; ocupan espacio hasta que se decida cómo limpiarlos.
- **Sin etiquetas ID3:** no se extraen (título y artista no se leen del archivo).
- **Firma heurística:** la de MP3 es una heurística sobre los primeros 4 KB. Un MP3 con más de 4 KB de datos basura al inicio y sin ID3 sería rechazado, y un WAV con audio MP3 dentro (raro) también.
- **Duración redondeada hacia arriba:** 7,24 s se muestra como 0:08. La duración precisa se ve en el diálogo y se guarda en el registro.
- ~~Esfera más pequeña con títulos largos~~ (resuelto en la 2B): ahora el tamaño de la esfera depende solo del *viewport*; los títulos largos alargan la columna y el área principal se desplaza.
- **Fase 2B, aviso en consola:** `THREE.Clock: This module has been deprecated` lo emite `@react-three/fiber` 9.8.1 con three ≥ r183. Desaparecerá cuando Fiber use `THREE.Timer`. Bajar three por debajo de r183 lo evitaría, pero se prefirió la versión estable actual.
- **Fase 2B, sin grabación en tiempo real ni fps medidos:** la ventana oculta del panel impidió grabar y medir. Solo hay un *timelapse* de capturas reales.
- **Fase 2B, perfil de calidad fijo:** se elige al montar. Si la ventana pasa de escritorio a móvil, se conserva la geometría de escritorio (no se recrea).
- **Fase 2B, carga de 1,1 MB:** three y la escena ocupan un *chunk* de ese tamaño, que se carga después de la página.
- **Fase 2B, primer fotograma lento en desarrollo:** la compilación de *shaders* tarda unos segundos; el marcador cubre ese tiempo.
- ~~Fase 3A, título muy largo a 1366×800~~ (resuelto en la 4B: el título ocupa como mucho 2 líneas desplazables; con 10 líneas los controles quedan a la vista sin desplazar el área principal).
- **Fase 3A, sin evidencia audible:** se verificó el estado del elemento, los bytes decodificados y la señal grabada del propio elemento, pero no el sonido de los altavoces. Desde la 3B, el efecto del volumen se mide en el grafo, antes de `destination`.
- **Fase 3B, sin audición ni FPS:** la reacción se midió en el analizador y en los píxeles del canvas; nadie la escuchó ni se midió la fluidez.
- **Fase 3B, brillo no medido:** el efecto de los agudos en los reflejos no se pudo separar de la rotación en los píxeles; solo se verificó en el código.
- **Fase 3B, solo Chromium:** que `volume`/`muted` lleguen atenuados al analizador se midió solo ahí. Si otro navegador no los aplicara antes del nodo fuente, la esfera no seguiría al volumen.
- **Fase 3B, `prefers-reduced-motion` en vivo y fallos reales de Web Audio:** cubiertos con revisión del código y pruebas simuladas, no en el navegador.
- ~~Fase 3A, progreso a unas 4 actualizaciones por segundo~~ (resuelto en la 4B: una lectura del elemento por fotograma mientras suena).
- **Fase 4B, botón de repetición de 24 px de alto:** cumple el mínimo de 24×24 px de WCAG 2.2 (2.5.8), pero es menor que los 44 px de los demás botones principales.
- **Fase 4B, la búsqueda no se conserva** al recargar (es una decisión: solo es presentación).
- ~~Fase 4B, botón de repetición de 24 px~~ (resuelto en la fase 5: 44×44 px).
- **Fase 5, MP3 VBR sin cabecera Xing/VBRI:** la duración la estima el navegador con la primera trama (por ejemplo, 24,14 s para un archivo de 12 s). Suena entero y avanza al terminar, pero la barra muestra un total incorrecto. Los VBR de codificadores habituales incluyen cabecera Xing.
- **Fase 5, renderizado en pausa:** el canvas sigue dibujando la misma imagen en cada fotograma (`frameloop="always"`); la imagen es idéntica, pero la GPU sigue trabajando.
- **Fase 5, audición no verificada:** hay una comprobación manual en `README.md`.
- **Fase 3A, aviso de *shaders* en producción:** ANGLE/Direct3D muestra `warning X4122` (precisión numérica); no es un error de la app.
- **Fase 3A, el silencio se quita al mover el volumen:** es una decisión de diseño, documentada.
- **Cancelar descarta lo escrito:** cerrar el diálogo con "Cancelar" o Escape pierde los campos y el archivo elegido.
- **Orden del DOM:** primero el área principal y luego la playlist. No coincide con el orden visual de escritorio; se eligió así para que coincida en móvil.
- **Selección inesperada sin reproducir:** queda registrada sin causa identificada (ver la investigación).
- **Limitaciones de la lista enlazada:** `ReadonlyNode` solo protege los enlaces en TypeScript, y `data` del nodo es mutable.
- **Ids en contexto no seguro:** `createSong` sin generador sigue usando `crypto.randomUUID()`, que no existe en contextos no seguros. La interfaz siempre inyecta `createIdGenerator()`, que tiene una alternativa.
- **Opción experimental:** `experimental.useTypeScriptCli` lo es, y su comportamiento puede cambiar en futuras versiones de Next.
- **Archivos ajenos en el directorio personal:** el `package.json` y el `package-lock.json` de `C:\Users\Edwin Rueda` no son del proyecto; conviene que el usuario decida qué hacer con ellos.
- **Sin linter ni git:** no hay linter configurado y la carpeta no es un repositorio git.

## Próximo paso

**Fase 5: implementada, pendiente de revisión del usuario.** No hay otra fase autorizada. No se publica, despliega ni sube el proyecto a un repositorio.

---

## Historial: fase 1 original con Vite (2026-10-06)

La primera versión de la fase 1 se hizo con React + Vite (`index.html`, `src/main.tsx`, `src/App.tsx` y `vite.config.ts`), y esos archivos se retiraron en la migración.

- **Verificación de entonces:** 47/47 pruebas (la pseudoaleatoria, cerca del límite de tiempo), `tsc --noEmit` y `vite build` correctos.
- **Primer intento de entonces:** la prueba pseudoaleatoria superó el tiempo porque `toEqual` comparaba nodos en profundidad. Se cambió por comparación por identidad, pero el margen siguió siendo insuficiente.
