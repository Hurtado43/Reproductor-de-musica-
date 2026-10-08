# Entrega: requisitos, implementación y evidencia

**Proyecto:** reproductor de música con lista doblemente enlazada · **Autor:** Juan José Rueda Viveros

Cada fila enlaza el requisito con el código real y con la evidencia disponible. «Simulada» significa una prueba automática con APIs del navegador simuladas; «real» significa una verificación en el navegador (Chromium del panel integrado). Los resultados detallados están en `docs/progreso.md`.

## Taller de estructuras de datos

| Requisito | Implementación | Archivos | Evidencia |
|-----------|----------------|----------|-----------|
| Lista doblemente enlazada propia | Nodo con `data`, `prev` y `next`; la lista mantiene `head`, `tail`, `size` y la pertenencia de cada nodo (`WeakSet`) | `src/domain/DoublyLinkedNode.ts`, `src/domain/DoublyLinkedList.ts` | `tests/DoublyLinkedList.test.ts` (invariantes en ambos sentidos con `tests/assertListInvariants.ts`) |
| Insertar al inicio, al final y en posición | `insertFirst`, `insertLast`, `insertAt` (valida antes de modificar); `Playlist.add` con `{first | last | at}` | `src/domain/DoublyLinkedList.ts`, `src/domain/Playlist.ts`, `src/features/player/songForm.ts` (posición visible ↔ índice) | Pruebas de dominio; real: importación al final, al inicio y en la posición 2 (fases 4A, 4B y 5) |
| Eliminar | `remove(nodo)` O(1); `Playlist.remove(id)` conserva o recoloca la selección | `src/domain/Playlist.ts`, `src/features/player/playlistController.ts` | `tests/Playlist.test.ts`, `tests/playlistController.test.ts`; real: eliminar con y sin filtro |
| Navegar (anterior y siguiente) | `Playlist.next/previous` siguen `next`/`prev` | `src/domain/Playlist.ts`, `components/Player.tsx` | Pruebas de dominio y de componentes; real: Anterior, Siguiente y avance automático en orden |
| Dominio sin dependencias de interfaz | TypeScript puro; comprobación sin `lib` DOM | `src/domain/`, `tsconfig.domain.json`, `tests/domainBoundary.test.ts` | `npm run typecheck` (incluye el dominio) |
| La lista es la fuente de verdad del orden y la selección | Sin índice paralelo; el motor de audio solo sabe qué id cargó; el aleatorio solo propone ids y selecciona con `Playlist.select` | `components/Player.tsx`, `src/features/player/shuffle.ts` | `tests/PlayerShuffle.test.tsx` (el orden visual y el guardado no cambian); real: orden visual idéntico con aleatorio |

## Reproductor

| Requisito | Implementación | Archivos | Evidencia |
|-----------|----------------|----------|-----------|
| Importar MP3 reales | Validación (tamaño, extensión o MIME, firma, metadatos) y duración con un `<audio>` temporal | `audio/readAudioMetadata.ts`, `audio/mp3Signature.ts`, `components/AddSongDialog.tsx` | `tests/readAudioMetadata.test.ts` (simulada); real: tonos, música autorizada (fase 3B), 4 minutos, 22,05/32/48 kHz, ID3 con portada de 1,6 MB |
| Reproducción con sonido y controles | Un `HTMLAudioElement` por motor; versiones contra respuestas antiguas; progreso, volumen y silencio | `audio/AudioEngine.ts`, `audio/usePlayback.ts`, `components/PlaybackControls.tsx` | `tests/AudioEngine.test.ts`, `tests/Playback.test.tsx` (simuladas); real: avance de `currentTime`, pausa, seek, volumen y silencio medidos en el analizador |
| Barra de progreso fluida | `requestAnimationFrame` lee `currentTime` del elemento y escribe en el DOM | `components/PlaybackControls.tsx` (`SeekBar`) | `tests/PlayerFeatures4B.test.tsx`; real: 121/121 fotogramas actualizados, salto máximo 1,3–1,7 px |
| Repetición (sin, playlist, canción) | Decisión en `ended` (sin `loop`) | `src/features/player/repeatMode.ts`, `components/Player.tsx` | `tests/repeatMode.test.ts`, `tests/PlayerFeatures4B.test.tsx`; real: los tres modos con archivos cortos |
| Aleatorio | Candidatos e historial de ids; selección uniforme con generador inyectable; nuevo ciclo solo en el avance automático con «Repetir playlist» | `src/features/player/shuffle.ts`, `components/Player.tsx` | `tests/shuffle.test.ts`, `tests/PlayerShuffle.test.tsx` (deterministas); real: ciclos sin repetir, historial, prioridad de «Repetir canción» |
| Búsqueda | Normalización sin mayúsculas ni acentos; solo presentación | `src/features/player/songSearch.ts`, `components/PlaylistPanel.tsx` | `tests/songSearch.test.ts`, `tests/PlayerFeatures4B.test.tsx`; real: «ALVAREZ» → «José Álvarez» |
| Vaciar playlist | Confirmación accesible; `engine.unload()` y vaciado; guardado en una transacción | `components/ClearPlaylistDialog.tsx`, `components/Player.tsx` | `tests/PlayerFeatures4B.test.tsx`, `tests/PlayerShuffle.test.tsx`; real: cancelar mientras suena y confirmar con recarga |

## Audio y esfera

| Requisito | Implementación | Archivos | Evidencia |
|-----------|----------------|----------|-----------|
| Análisis real del audio | Ruta única fuente → `AnalyserNode` → destination; RMS y bandas (40–250 Hz, 2–8 kHz) en dBFS | `audio/audioGraph.ts`, `audio/audioAnalysis.ts`, `audio/AudioLevelsMeter.ts` | `tests/audioAnalysis.test.ts`, `tests/audioGraph.test.ts`, `tests/AudioLevelsMeter.test.ts` (simuladas); real: −13,9 dBFS con tonos de amplitud 0,3, graves y agudos separados |
| Esfera 3D reactiva | Malla deformada desde la base; energía → deformación, graves → pliegues y pulsación, agudos → reflejos | `visualizer/orbGeometry.ts`, `visualizer/orbMotion.ts`, `visualizer/OrbMesh.tsx`, `visualizer/OrbScene.tsx` | `tests/orbGeometry.test.ts`, `tests/orbMotion.test.ts`; real: el canvas cambia ~10 000–20 000 valores por muestra con música |
| Esfera redonda en reposo, deformada con música (fase 5, ajustada) | Deformación multiplicada por la intensidad real (`orbIntensity`); entrada `active` solo con reproducción confirmada; sin ella, vuelve a la esfera y se detiene | `visualizer/orbGeometry.ts`, `visualizer/orbMotion.ts`, `audio/AudioLevelsMeter.ts` | `tests/orbMotion.test.ts`, `tests/orbGeometry.test.ts`; real: silueta circular en reposo, deformada reproduciendo, vuelta a la esfera en ~0,5 s al pausar y luego 0 píxeles distintos |
| Sin salto al reanudar | El tiempo musical no avanza en pausa; delta recortado | `visualizer/orbMotion.ts` | Prueba de 10 min de pausa; real: tras 35 s en pausa, cambios por fotograma del mismo orden que antes |
| `prefers-reduced-motion` | Esfera quieta aunque suene | `visualizer/usePrefersReducedMotion.ts`, `visualizer/orbMotion.ts` | `tests/orbMotion.test.ts`, `tests/Visualizer.test.tsx`; no emulado en el navegador (limitación del panel) |
| Canvas estable | `Visualizer` en `memo`, sin `key` ligada a la canción | `visualizer/Visualizer.tsx` | `tests/Visualizer.test.tsx`; real: el mismo `<canvas>` en todos los recorridos |
| Sin fotografía del artista | Artista como texto | `components/SelectedSong.tsx`, `docs/diseno-ui.md` | Capturas en `docs/capturas/` |

## Persistencia

| Requisito | Implementación | Archivos | Evidencia |
|-----------|----------------|----------|-----------|
| Conservar playlist y archivos | IndexedDB v1: `songs` (metadatos + `File`) y `meta/library` (orden, selección y preferencias) | `persistence/librarySchema.ts`, `persistence/indexedDbStorage.ts`, `persistence/LibraryPersistence.ts` | `tests/librarySchema.test.ts`, `tests/indexedDbStorage.test.ts` (IndexedDB simulado), `tests/LibraryPersistence.test.ts`, `tests/PlayerPersistence.test.tsx`; real: SHA-256 iguales, recargas en desarrollo y producción |
| Sin escrituras antiguas ni estados parciales | Una transacción a la vez con el estado más reciente; todo o nada | `persistence/LibraryPersistence.ts` | Pruebas de escrituras rápidas y fallos con reintento |
| Preferencias (volumen, silencio, repetición, aleatorio) | Campos opcionales sin migración; inválidos = valor por defecto | `persistence/librarySchema.ts` | Pruebas de compatibilidad; real: preferencias restauradas sin reproducir |

## Verificaciones finales (fase 5)

- `npm test`, `npm run typecheck` y `npm run build`: ver "Estado para retomar" en `docs/progreso.md` (resultados reales y fecha).
- Secuencia final en producción: importación, reproducción, pausa, seek, volumen, silencio, búsqueda, navegación, repetición, aleatorio, eliminación, restauración y vaciado. Consola sin errores de la app ni de hidratación.
- Pendientes: audición en altavoces (comprobación manual), otros navegadores, dispositivos táctiles reales y emulación de `prefers-reduced-motion`.
