# AGENTS.md

Instrucciones comunes para cualquier agente que trabaje en este proyecto (Claude Code, Codex u otro). Son estables: el estado de cada sesión, los resultados y las tareas pendientes van en `docs/progreso.md`, no aquí.

## A. Objetivo y requisitos

Taller de TypeScript: un **reproductor de música real** cuya playlist es una **lista doblemente enlazada** propia.

- El usuario importa **archivos MP3 reales** de su dispositivo y los oye con sonido real.
- Inserción **al inicio, al final y en una posición** elegida (la interfaz muestra posiciones desde 1; internamente, índices desde 0).
- **Eliminar**, **seleccionar** y **navegar** (Anterior/Siguiente siguen los enlaces `prev`/`next`; al terminar una canción se avanza a `next`).
- Una **esfera 3D** (Three.js, React Three Fiber, drei y postprocessing) que **reacciona al audio real** que suena (energía, graves y agudos de un `AnalyserNode`) es una **esfera redonda y quieta** sin reproducción (al pausar vuelve a esa forma).
- Repetición (sin, playlist, canción), **aleatorio** con historial, búsqueda y vaciado.
- Diseño acordado en `docs/diseno-ui.md`: interfaz clara en blanco y rojo, nombre **the protoype**, playlist lateral y esfera con reflejos rojos y blancos (cambio autorizado por el usuario el 2026-10-07). **Sin fotografía del artista** (ni carátulas): el artista es texto y, si falta, se muestra «Artista no especificado».

## B. Arquitectura

Next.js (App Router) + TypeScript estricto, npm y CSS Modules. Pruebas con Vitest.

| Pieza | Ubicación | Responsabilidad |
|-------|-----------|-----------------|
| Dominio | `src/domain/` | `Song`, `validateSongInput`, `createSong`, `DoublyLinkedNode`, `DoublyLinkedList`, `Playlist`. TypeScript puro |
| Ids | `src/lib/idGenerator.ts` | Ids únicos con alternativa si no existe `crypto.randomUUID` |
| Controlador | `src/features/player/playlistController.ts` | Une `Playlist` y el registro de fuentes: importación atómica, eliminación que retira la fuente, restauración |
| Registro de fuentes | `src/features/player/audio/sourceRegistry.ts` | id de canción → `File` real, nombre y duración precisa. Sin orden ni selección |
| Lectura de MP3 | `src/features/player/audio/readAudioMetadata.ts`, `mp3Signature.ts`, `useAudioFileReader.ts` | Validación (tamaño, extensión o MIME, firma, metadatos reales) y duración |
| Motor de audio | `src/features/player/audio/AudioEngine.ts`, `usePlayback.ts` | Un `HTMLAudioElement` por instancia; reproducción, progreso, volumen, silencio; dueño de la ruta de Web Audio |
| Ruta de Web Audio | `src/features/player/audio/audioGraph.ts` | `AudioContext` → `MediaElementAudioSourceNode` → `AnalyserNode` → `destination` |
| Analizador | `src/features/player/audio/audioAnalysis.ts`, `AudioLevelsMeter.ts` | RMS y bandas en dBFS normalizados a [0, 1]; un solo bucle `requestAnimationFrame` mientras suena |
| Visualizador | `src/features/player/visualizer/` | `Visualizer` (cliente, `memo`) carga `OrbCanvas` con `next/dynamic` y `ssr: false`; `OrbMesh` aplica el único suavizado |
| Persistencia | `src/features/player/persistence/` | IndexedDB (fase 4A): canciones con su archivo, orden, selección, volumen, silencio y modo de repetición |
| Búsqueda, repetición y aleatorio | `src/features/player/songSearch.ts`, `repeatMode.ts`, `shuffle.ts` | Lógica pura: filtro de presentación (4B), decisión al terminar (4B) e historial y candidatos de ids para el aleatorio (5) |
| Interfaz | `src/features/player/components/`, `player.module.css`, `src/app/` | `page.tsx` y `layout.tsx` son Server Components; `Player` es el límite cliente |

- **Fuente de verdad:** `Playlist` (lista doblemente enlazada) decide el **orden y la selección**. Ningún otro módulo guarda un índice paralelo. Los arreglos solo se usan para mostrar o serializar (por ejemplo, la lista de ids que se guarda).
- **Archivos separados del dominio:** el dominio no conoce `File`, `Blob` ni `URL`. Los archivos viven en el registro de fuentes y se relacionan con las canciones **por id**.
- **Servidor y navegador:** el servidor solo renderiza el estado inicial vacío. `HTMLAudioElement`, Web Audio, WebGL, IndexedDB y `URL.createObjectURL` se usan solo en el cliente (efectos o manejadores de eventos), nunca durante el render. El primer render del servidor y del cliente coincide. No se pasan instancias de clases, nodos ni `File` por el límite servidor-cliente.

## C. Contratos que deben conservarse

- **Dominio puro:** sin React, Next.js, `"use client"`, DOM ni APIs del navegador (`File`, `Blob`, `URL`, `HTMLAudioElement`…). Lo vigilan `tsconfig.domain.json` y `tests/domainBoundary.test.ts`.
- **Lista enlazada real:** las inserciones, eliminaciones y la navegación usan `DoublyLinkedList`/`Playlist` y sus APIs públicas. No escribir `head`, `tail`, `prev` ni `next` desde fuera. No sustituirla por un arreglo y un índice.
- **Ids únicos; títulos repetidos permitidos.** `Playlist` rechaza ids duplicados.
- **Un elemento de audio y un grafo por instancia activa** del reproductor. `createMediaElementSource` una sola vez por elemento. La única excepción es la recuperación controlada de errores de `AudioEngine` (sustituye el elemento si la ruta de Web Audio deja de sonar).
- **Ruta de sonido única:** fuente → analizador → `destination`. No añadir otra conexión a `destination`. El `AudioContext` se crea o reanuda tras un gesto del usuario.
- **Protecciones contra respuestas antiguas:** versiones de fuente y de intención en el motor (`play()`, `resume()`, eventos), números de solicitud en la lectura de archivos y en la persistencia. Una respuesta obsoleta no cambia el estado vigente.
- **Limpieza:** URLs `blob:` revocadas después de desvincularlas, listeners quitados, nodos desconectados, `AudioContext` cerrado, fotogramas cancelados y conexiones de IndexedDB cerradas al desmontar. Todo seguro con Strict Mode.
- **Búsqueda solo de presentación:** filtrar no cambia el orden, la selección, el audio ni lo guardado; seleccionar y eliminar desde resultados usan ids y las posiciones mostradas son las de la playlist completa.
- **Repetición en `ended`:** se decide con el modo vigente al terminar, sin `HTMLAudioElement.loop`; Anterior y Siguiente no la consultan. Restaurar el modo nunca reproduce.
- **Progreso real:** la barra lee `currentTime` del elemento (también por fotograma mientras suena), nunca un contador propio.
- **Canvas estable:** cambiar de canción, reproducir, pausar, buscar, abrir el diálogo o editar la playlist no recrea la escena. Su tamaño depende solo del *viewport*.
- **Sin estado de React por fotograma** y sin crear objetos en los bucles de render o de análisis.
- **Esfera sin movimiento ambiental:** en reposo es una esfera perfecta; solo se deforma con reproducción confirmada y señal real (`active`). En pausa, carga, error, final o sin canciones vuelve suavemente a la esfera y queda quieta, y reanuda sin saltos (tiempo musical propio, nunca el reloj absoluto).
- **`prefers-reduced-motion`:** forma fija, sin pulsaciones ni cambios de brillo; el audio sigue funcionando.
- **Aleatorio sin reordenar:** solo ids auxiliares (historial y candidatos); la selección efectiva es `Playlist.select` y el orden guardado no cambia. Solo se guarda la preferencia.
- **Nada simulado en la aplicación:** reproducción y amplitudes reales. Prohibido usar pulsaciones aleatorias, temporizadores o la posición de reproducción como si fueran señal. Las simulaciones solo existen en `tests/` y se identifican como tales.
- **Persistencia:** los archivos se guardan como `Blob`/`File` en IndexedDB. Nunca en `localStorage`, base64 ni URLs `blob:`.
  - Restaurar nunca llama a `play()` ni crea el `AudioContext`, y la restauración ocurre una sola vez (también en Strict Mode).
  - Nada se guarda antes de terminar la restauración.
  - Cada guardado es una transacción completa con el estado más reciente; una escritura antigua no pisa una nueva.
  - Los datos dañados se recuperan en lo posible y se informan; no se borran ni se sobrescriben en silencio.

## D. Comandos

La documentación de entrega está en `README.md`, `docs/entrega.md` y `docs/sustentacion.md`.

Entorno usado en el proyecto: Node.js 24.11.1 y npm 11.19.0 (Next 16 exige Node ≥ 20.9). Los scripts salen de `package.json`.

| Tarea | Comando |
|-------|---------|
| Instalar dependencias (respetando `package-lock.json`) | `npm ci` (o `npm install` si se cambia una dependencia de forma autorizada) |
| Servidor de desarrollo | `npm run dev` (puerto 3000 por defecto; `-- -p <puerto>` para otro) |
| Pruebas (Vitest, sin modo interactivo) | `npm test` |
| Pruebas en modo observación | `npm run test:watch` |
| Comprobación de tipos | `npm run typecheck` (`next typegen` + `tsc --noEmit` + dominio sin DOM) |
| Compilación de producción | `npm run build` |
| Servidor de producción (después de `build`) | `npm start` |

`.claude/launch.json` define `next-dev` (puerto 3101) y `next-start` (puerto 3100) para el panel de vista previa. No usar `--force` ni `--legacy-peer-deps`.

## E. Flujo de trabajo

1. Leer este archivo y `docs/progreso.md` (sobre todo "Estado para retomar") antes de cambiar nada. `CLAUDE.md` tiene además instrucciones específicas de Claude Code; `docs/diseno-ui.md`, las decisiones visuales.
2. Antes de modificar un directorio, buscar instrucciones adicionales (`AGENTS.md` u otras) dentro de él y en sus padres.
3. Respetar los cambios del usuario y los archivos ajenos: no revertir lo que no se entiende; preguntar si algo parece incorrecto.
4. Trabajar **solo en la fase autorizada** por el usuario. No empezar la siguiente sin su autorización explícita.
5. No actualizar ni añadir dependencias, ni cambiar la arquitectura, sin una necesidad comprobada y justificada.
6. Ejecutar las verificaciones apropiadas (`npm test`, `npm run typecheck`, `npm run build` y, si cambia algo visible, el navegador) y registrar los **resultados reales**. Si una verificación no se ejecutó, escribir "no ejecutada" y el motivo.
7. Distinguir siempre las pruebas con APIs simuladas (elemento de audio, `AudioContext`, IndexedDB, WebGL) de las verificaciones en un navegador real.
8. No afirmar que se escuchó audio, que se midieron FPS o que algo se vio en movimiento si no ocurrió.
9. No detener servidores ni procesos que no se iniciaron en la sesión, y no modificar archivos fuera del proyecto.
10. Al terminar un bloque de trabajo significativo, actualizar "Estado para retomar" en `docs/progreso.md`; al terminar una fase, también la sección de esa fase.

## F. Cómo retomar

1. Leer "Estado para retomar" en `docs/progreso.md`: fase vigente, estado, punto de interrupción y próximo paso.
2. Revisar los cambios locales y el código antes de dar una tarea por terminada (la carpeta **no** es un repositorio git: comparar fechas de modificación y contenido con lo descrito).
3. Ejecutar `npm test` y `npm run typecheck` para conocer el estado real; no copiar resultados anteriores como si fueran nuevos.
4. Continuar desde el siguiente paso pendiente de la fase autorizada, sin reconstruir lo que ya funciona.
5. Los servidores que figuren como activos pueden no seguir activos en otra sesión: comprobarlo antes de usarlos.
6. No avanzar a otra fase sin autorización del usuario.
