# CLAUDE.md

## Al iniciar una sesión

1. Lee `AGENTS.md`: contiene las **instrucciones comunes** del proyecto para cualquier agente (objetivo, arquitectura, contratos, comandos y flujo de trabajo). Este archivo añade el detalle específico para Claude Code; si algo parece contradecirse, se aplica la regla más estricta y se avisa al usuario.
2. Lee `docs/progreso.md` antes de modificar archivos, empezando por **"Estado para retomar"** (estado de continuidad: fase vigente, verificaciones, punto de interrupción y próximo paso). Ahí están también las decisiones tomadas.
3. El taller se desarrolla **por fases**. Trabaja solo en la fase indicada por el usuario y no avances a la siguiente sin su autorización.
4. Al completar un bloque de trabajo significativo, actualiza "Estado para retomar". Al terminar una fase, actualiza además su sección en `docs/progreso.md` (estado, archivos, comandos con sus resultados reales, decisiones, pendientes, próximo paso). Los resultados de sesión van en `docs/progreso.md`, no en `AGENTS.md`.

## Proyecto

**Reproductor de música real** en **Next.js (App Router) + TypeScript estricto**, con npm y CSS. Se migró desde Vite durante la fase 1 (ver `docs/progreso.md`).

- **Producto final:** reproduce archivos **MP3 reales** con sonido y muestra una **esfera 3D** que reacciona al audio que suena. Este requisito reemplaza la antigua "reproducción simulada".
- **Playlist:** usa una lista doblemente enlazada real (`src/domain/DoublyLinkedList.ts`). No la sustituyas por un arreglo y un índice: los arreglos solo se usan para mostrar o serializar datos.

Fases:

| Fase | Contenido |
|------|-----------|
| 1 | Estructura de datos |
| 2A | Playlist, interfaz e importación de MP3 |
| 2B | Esfera 3D |
| 3A | Reproducción real y controles |
| 3B | Análisis del audio y reacción de la esfera |
| 4A | Persistencia (IndexedDB: playlist, archivos y preferencias) |
| 4B | Funciones adicionales y ajustes (búsqueda, repetición, vaciar, progreso fluido, títulos largos) |
| 5 | Esfera estática y aleatorio; revisión y entrega |

Estructura:

- `src/app/`: App Router (`layout.tsx`, `page.tsx` y `globals.css` con los tokens de diseño). `page.tsx` es Server Component y solo monta `<Player />`.
- `src/domain/`: dominio en TypeScript puro (`Song`, `validateSongInput`, `DoublyLinkedNode`, `DoublyLinkedList`, `Playlist`).
  - No usa React, Next.js, `"use client"`, DOM, `File`, `Blob`, `URL` ni APIs del navegador. Lo vigilan `tsconfig.domain.json` (sin `lib` DOM) y `tests/domainBoundary.test.ts`.
  - `Song.artist` es `string | null`: nunca se inventa un artista; la interfaz muestra «Artista no especificado».
  - `Song.durationSeconds` es entero: la interfaz redondea hacia arriba la duración detectada.
- `src/lib/idGenerator.ts`: generador de ids con alternativa cuando no existe `crypto.randomUUID`. La interfaz siempre lo inyecta en `createSong`.
- `src/features/player/`: interfaz del reproductor.
  - `audio/readAudioMetadata.ts`: valida el MP3 (tamaño, extensión o MIME, firma y metadatos reales) y lee la duración con un `<audio>` y una URL temporal que siempre se liberan.
  - `audio/useAudioFileReader.ts`: descarta respuestas obsoletas y cancela al desmontar.
  - `audio/sourceRegistry.ts`: `File` real por id de canción. No maneja orden ni selección.
  - `playlistController.ts`: `Playlist` + registro, con importación atómica y eliminación que retira la fuente. `currentId` lee la selección de `Playlist` en el momento. `restore` reconstruye la lista enlazada con `add`/`select` (solo sobre una playlist vacía).
  - `persistence/` (fase 4A, solo navegador): IndexedDB `reproductor-musica` v1.
    - `songs` guarda un registro por canción con metadatos **y el `File`/`Blob` real**; `meta`/`library` guarda orden (ids), selección, volumen, silencio, `schemaVersion` y `revision`.
    - `librarySchema.ts` valida y recupera lo válido; `indexedDbStorage.ts` usa una transacción por guardado; `LibraryPersistence.ts` restaura una sola vez y guarda en cola (una transacción a la vez, siempre el estado más reciente, preferencias agrupadas); `useLibraryPersistence.ts` la crea por montaje.
    - Restaurar nunca llama a `play()` ni crea el `AudioContext`. Mientras restaura, no se guarda nada y «Agregar canción», volumen y silencio están deshabilitados.
    - Estados visibles en `components/PersistenceStatus.tsx` (panel de la playlist).
  - `audio/AudioEngine.ts` (fase 3A): motor de reproducción sin React.
    - Un solo `HTMLAudioElement` por instancia, creado de forma diferida en el navegador.
    - **No** guarda orden ni selección: carga el id y el `File` que le pasan y avisa de `ended`.
    - Versiones de fuente y de intención de reproducción: las respuestas de `play()` y los eventos obsoletos se descartan. Listeners por fuente.
    - Al sustituir la fuente, desvincula antes de revocar la URL.
    - "Reproduciendo" solo con la promesa de `play()` resuelta y `paused === false`.
    - Es dueño de la ruta de Web Audio (fase 3B, `audio/audioGraph.ts`): `AudioContext`, `MediaElementAudioSourceNode` y `AnalyserNode` se crean al primer intento de reproducir, **una vez por elemento**, y se liberan con él en `dispose()`. Ruta única: fuente → analizador → destination.
    - Si el contexto no está `running`, espera `resume()` antes de `play()`, con las mismas versiones: una respuesta antigua no reproduce.
    - Sin Web Audio usa la ruta convencional. Si falla después de redirigir el elemento, muestra un error `'output'` recuperable y, al reproducir, sustituye el elemento.
  - `audio/audioAnalysis.ts` (3B): RMS y bandas (graves 40–250 Hz, agudos 2–8 kHz) en dBFS con rangos fijos, normalizados a [0, 1]. Sin React ni DOM; buffers reutilizados.
  - `audio/AudioLevelsMeter.ts` (3B): **único** bucle de análisis (`requestAnimationFrame`), solo mientras suena. Escribe en un `OrbAudioInput` estable; en pausa, final, error, cambio de fuente o sin canción escribe 0.
  - `audio/usePlayback.ts`: un motor y un medidor por montaje (`useState`), estado con `useSyncExternalStore`, `audioInput` para la esfera y limpieza al desmontar (segura con Strict Mode).
  - `components/PlaybackControls.tsx`: estado, repetición, barra con tiempos (ratón, tacto y teclado), Anterior, Reproducir/Pausar, Siguiente, silencio y volumen.
    - `SeekBar` (4B): mientras suena, `requestAnimationFrame` lee `currentTime` del elemento real (`readCurrentTime`) y escribe directamente en el DOM, sin estado de React por fotograma. El rango no es controlado y el arrastre manda sobre las lecturas.
  - `songSearch.ts` (4B): búsqueda sin mayúsculas ni acentos por título y artista. Solo presentación (estado de `PlaylistPanel`): no toca la lista enlazada, la selección ni la persistencia; las filas conservan su posición real y las acciones usan ids.
  - `repeatMode.ts` (4B): `'off' | 'all' | 'one'` y `actionAfterEnd`. `Player` lo aplica en el manejador de `ended` (nunca con `loop`); Anterior y Siguiente no lo consultan. Se guarda como campo opcional `repeatMode` de `library` (sin migración: ausente o inválido = `'off'`).
  - `shuffle.ts` (5): `ShuffleNavigator` con historial y candidatos (solo ids) y generador inyectable. `Player` lo usa en Anterior, Siguiente y `ended` cuando el aleatorio está activo; la selección siempre es `Playlist.select` y el orden no cambia. «Repetir canción» tiene prioridad al terminar; con «Repetir playlist», `newCycle` al agotar. Se guarda solo la preferencia `shuffle` (opcional; ausente o inválida = desactivado).
  - `components/ClearPlaylistDialog.tsx` (4B): confirmación de «Vaciar playlist». Al confirmar, `engine.unload()` y después `actions.clearAll()`; la persistencia guarda el estado vacío en una transacción y conserva volumen, silencio y repetición.
  - `Player`: después de cada acción llama a `syncPlayback(autoplay)`, que carga en el motor la selección actual de `Playlist` si cambió.
    - La primera importación y la eliminación de la actual dejan la canción en pausa.
    - Fila, Anterior y Siguiente siguen la intención previa.
    - `ended` → `actions.next()` y reproducción.
    - La misma canción no se recarga.
  - `usePlaylist`: un controlador por montaje y snapshots nuevos.
  - `songForm`: validación del formulario y **único** punto de conversión entre posición visible e índice interno.
  - `components/` (`Player` es el único `"use client"` de la interfaz) y `player.module.css`.
  - `visualizer/`: esfera 3D, con su propio límite cliente.
    - **Geometría:** icosaedro fusionado; `OrbDeformer` deforma desde la base con ruido simplex propio, y `computeSmoothNormals` da normales iguales a las de three pero más rápidas.
    - **Escena:** `MeshPhysicalMaterial` oscuro, entorno de `Lightformer`, Bloom y tone mapping ACES.
    - **Bucle:** el `useFrame` de la malla usa prioridad 0; el `EffectComposer` renderiza con prioridad 1. No añadas prioridades positivas sin revisar quién hace el render.
    - **Rendimiento:** no actualices estado de React por fotograma ni crees objetos en el bucle.
    - **Audio:** `orbAudio.ts` define la entrada (`OrbAudioInput`, con `active`). `Player` pasa la del medidor. `orbMotion.ts` (`OrbAnimator`) aplica el **único** suavizado (`ORB_AUDIO_SMOOTHING`) y el tiempo musical: energía → capa de ruido, graves → pliegues y pulsación, agudos → reflejos. Pendiente máxima < 1 con todo al máximo (prueba).
    - **Sin movimiento ambiental (fase 5, ajustado):** en reposo es una **esfera perfecta** (`orbIntensity`: la deformación se multiplica por la intensidad real). Con `active: false` (antes de reproducir, pausa, carga, error, final o sin canciones) vuelve suavemente a la esfera y se detiene; con movimiento reducido, esfera quieta. El ruido evoluciona con un tiempo musical que solo avanza con la señal; nunca con el reloj absoluto.
    - **Fallos y accesibilidad:** sin WebGL o si la escena falla, hay un estado alternativo. Se respeta `prefers-reduced-motion`.
- `tests/`: pruebas con Vitest (`vitest.config.mts`, separado de Next).
  - Por defecto se ejecutan en entorno Node. Las de componentes (`*.test.tsx`) declaran `// @vitest-environment jsdom` y usan `userEvent.setup({ delay: null })`.
  - `assertListInvariants` verifica los enlaces en ambos sentidos.
  - `tests/fixtures/` guarda canciones ficticias **solo para pruebas**.
  - `tests/setup/canvas.ts`: en jsdom no hay WebGL (`getContext` devuelve `null`) y `HTMLMediaElement.load/pause/play` son *stubs*. Las pruebas de la esfera simulan `OrbCanvas`: no son evidencia de render; el render real se verifica en un navegador con WebGL.
  - `tests/fakes/fakeMedia.ts`: elemento de audio **simulado** y controlable para `AudioEngine.test.ts` y `Playback.test.tsx`. `play()` queda pendiente hasta que la prueba lo resuelve; `pause()` o el cambio de `src` lo rechazan con `AbortError`. Por defecto, sin Web Audio (`createAudioContext` devuelve `null`).
  - `tests/fakes/fakeAudioContext.ts`: `AudioContext`, nodo fuente y `AnalyserNode` **simulados** (fase 3B): `resume()` controlable, una fuente por elemento, registro de conexiones y señal fijada por la prueba.
  - `tests/fakes/fakeLibraryStorage.ts` (almacenamiento **simulado** en memoria, todo o nada, con fallos y esperas controlados) y `tests/fakes/fakeIndexedDB.ts` (IndexedDB **simulado** y mínimo para el adaptador). IndexedDB real se verifica en el navegador.
  - Las APIs multimedia se simulan en pruebas unitarias. Identifica siempre esas simulaciones y no las presentes como comprobación real.
- `docs/diseno-ui.md`: decisiones visuales, paleta, comportamiento móvil y espacio de la esfera.
- Índices internos desde 0; la interfaz muestra posiciones desde 1.

## Reglas para Next.js

- Las páginas y layouts son Server Components por defecto. Las interacciones (estado, eventos, reproducción) van en **Client Components** con `"use client"`, lo más abajo posible en el árbol.
- **No crees una playlist mutable global** a nivel de módulo: en el servidor se compartiría entre solicitudes. La instancia de la playlist vive dentro del límite cliente (por ejemplo, en un hook o contexto de un Client Component).
- `localStorage`, `Audio`/Web Audio y demás APIs del navegador solo se usan en el cliente (en efectos o manejadores de eventos), nunca durante el render del servidor.
- La escena WebGL (Three.js / React Three Fiber / drei / postprocessing, fase 2B) irá aislada en su propio componente cliente, cargado sin SSR.
- Esta versión de Next.js trae documentación en `node_modules/next/dist/docs/`: consúltala antes de usar APIs de Next.
- El primer render del servidor y del cliente debe coincidir: la playlist empieza vacía y no se generan ids ni datos aleatorios durante el render.
- No pases instancias de clases, nodos ni `File` a través del límite servidor-cliente; React solo recibe snapshots con datos planos.
- La esfera 3D (fase 2B) vive en `src/features/player/visualizer/`. `Visualizer` (cliente, `memo`) carga `OrbCanvas` con `next/dynamic` y `ssr: false`. No le pases datos de la playlist ni le pongas una `key` ligada a la canción: cambiar de canción, abrir el diálogo o editar la playlist no debe recrear la escena.
- Su tamaño depende solo del *viewport* (`--visualizer-size`), nunca del título o del artista.

## Reglas de audio y persistencia (fases 3A a 5 implementadas; detalle en `docs/progreso.md`)

- Reproducción con `HTMLAudioElement` a partir del `File` del registro de fuentes. Play, pausa, volumen y progreso controlan el **audio real**.
- El progreso y la duración salen del elemento de audio. **No** avances el progreso con un temporizador que lo sustituya.
- La barra de progreso permite cambiar `currentTime`.
- `ended` avanza al nodo `next` de la lista enlazada y reproduce esa canción. Anterior y Siguiente usan `prev` y `next`.
- La esfera se anima **solo** con datos reales de un `AnalyserNode` (Web Audio API), con suavizado. **Nunca** uses pulsaciones aleatorias ni amplitudes inventadas. Sin reproducción confirmada con señal real (pausa, carga, final, sin canciones) es una **esfera redonda y quieta**: al pausar vuelve a esa forma; no hay movimiento ambiental (fase 5).
- Maneja con estados visibles los errores de carga, de reproducción y las restricciones de autoplay.
- La persistencia conserva también los archivos de audio en IndexedDB (fase 4A); guardar solo nombres y duraciones no basta. No guardes `File`, audio en base64 ni URLs `blob:` en `localStorage`, ni el segundo de reproducción.
- No guardes nada antes de terminar la restauración. Cada guardado es una transacción completa; no reescribas los MP3 al cambiar solo selección o preferencias; no dependas de `beforeunload`.
- Datos dañados: recupera lo válido, informa lo demás y no borres ni sobrescribas en silencio los datos originales (se guarda una copia del registro `library` antes de reescribirlo).
- Mientras una fase esté incompleta, no muestres controles sin implementar como si funcionaran.
- No crees un segundo `HTMLAudioElement` ni un índice de reproducción paralelo: el motor es el único dueño del elemento y `Playlist` de la selección.
- Web Audio (3B): `createMediaElementSource` **una sola vez por elemento**, dentro de `AudioEngine`, con la ruta única fuente → analizador → destination. El `AudioContext` se crea o reanuda tras un gesto del usuario. No cambies la ruta del sonido de otra forma ni añadas otra conexión a `destination`.
- El analizador usa `smoothingTimeConstant = 0`: el único suavizado es el de la esfera. En Chromium recibe la señal ya atenuada por `volume`/`muted`: no multipliques de nuevo por el volumen.
- El aleatorio no reordena la lista ni el guardado: solo propone ids (`shuffle.ts`) y la selección se hace con `Playlist`.
- La repetición se decide en `ended` (no uses `HTMLAudioElement.loop`). El progreso fluido lee `currentTime` del elemento; nunca sumes intervalos.
- Distingue siempre entre el estado del elemento, las pruebas simuladas y la evidencia audible. No afirmes haber escuchado algo si el entorno no lo permite.

## Comandos

- `npm run dev`: servidor de desarrollo.
- `npm run build`: compilación de producción (incluye la comprobación de tipos con el `tsc` del proyecto).
- `npm start`: servidor de producción (después de `build`).
- `npm run typecheck`: `next typegen` + `tsc --noEmit` + comprobación del dominio sin DOM.
- `npm test`: pruebas (Vitest, sin modo interactivo).
- `npm run test:watch`: pruebas en modo observación.

No uses `--force` ni `--legacy-peer-deps`. No declares aprobada una verificación que no ejecutaste.
