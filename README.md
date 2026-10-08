# Reproductor de música con lista doblemente enlazada

**Autor:** Juan José Rueda Viveros

Taller de TypeScript: un reproductor de música **real** cuya playlist es una **lista doblemente enlazada** propia. Importa archivos MP3 del dispositivo, los reproduce con sonido y muestra una **esfera 3D** que reacciona al audio que suena. La playlist, los archivos y las preferencias se conservan entre recargas.

## Funciones

- **Importar MP3** («Agregar canción»): al inicio, al final o en una posición. Valida tamaño, extensión o MIME, firma y metadatos reales; la duración se detecta del archivo. Título editable y artista opcional («Artista no especificado» si falta).
- **Playlist** (lista doblemente enlazada): seleccionar, eliminar, Anterior y Siguiente (enlaces `prev`/`next`). Títulos repetidos permitidos; ids únicos.
- **Reproducción real:** reproducir, pausar, barra de progreso fluida (ratón, tacto y teclado), volumen y silencio. Al terminar una canción se avanza a la siguiente.
- **Repetición:** sin repetición, repetir playlist o repetir canción.
- **Aleatorio:** elige al azar entre las canciones pendientes del ciclo, sin repetir, con historial para Anterior. No cambia el orden de la lista.
- **Búsqueda** por título y artista (sin distinguir mayúsculas ni acentos). Solo filtra lo que se muestra.
- **Vaciar playlist** con confirmación (no borra los archivos del dispositivo).
- **Esfera 3D** (Three.js, React Three Fiber, drei, postprocessing): en reposo es una **esfera redonda y quieta**; al reproducir se deforma **solo con la música real** (energía, graves y agudos de un `AnalyserNode`) y al pausar vuelve a la esfera. Respeta `prefers-reduced-motion`.
- **Persistencia** en IndexedDB: canciones con su archivo MP3, orden, selección, volumen, silencio, repetición y aleatorio. Restaurar nunca inicia la reproducción.

## Stack y versiones (instaladas)

| Herramienta | Versión |
|-------------|---------|
| Node.js / npm | 24.11.1 / 11.19.0 (Next 16 exige Node ≥ 20.9) |
| Next.js (App Router) | 16.4.0 |
| React / React DOM | 19.3.0 |
| TypeScript (estricto) | 7.0.2 |
| three / @react-three/fiber / @react-three/drei | 0.186.1 / 9.8.1 / 10.7.9 |
| postprocessing / @react-three/postprocessing | 6.39.5 / 3.1.3 |
| Vitest / jsdom / Testing Library (React) | 5.0.3 / 29.1.1 / 16.3.3 |

Web Audio API, IndexedDB y `HTMLAudioElement` son del navegador: no hay backend ni dependencias de audio o almacenamiento.

## Instalación y comandos

```bash
npm ci
```

| Tarea | Comando |
|-------|---------|
| Desarrollo (http://localhost:3000) | `npm run dev` |
| Pruebas (Vitest) | `npm test` |
| Comprobación de tipos (incluye el dominio sin DOM) | `npm run typecheck` |
| Compilación de producción | `npm run build` |
| Servidor de producción (después de `build`) | `npm start` |

No hay linter configurado.

## Estructura

| Carpeta | Contenido |
|---------|-----------|
| `src/domain/` | `DoublyLinkedNode`, `DoublyLinkedList`, `Playlist`, `Song`: TypeScript puro, sin React, Next ni APIs del navegador |
| `src/features/player/playlistController.ts` | Une la playlist y el registro de archivos (importación atómica, eliminación, vaciado, restauración) |
| `src/features/player/audio/` | Lectura de MP3, registro de fuentes, motor de audio (`AudioEngine`), ruta de Web Audio, análisis y medidor |
| `src/features/player/visualizer/` | Esfera 3D (geometría, movimiento gobernado por la señal, escena) |
| `src/features/player/persistence/` | IndexedDB: esquema, validación, adaptador y coordinador de guardado |
| `src/features/player/components/` | Interfaz (`Player` es el límite cliente) |
| `tests/` | Pruebas Vitest (las APIs del navegador se simulan y se identifican como tales) |
| `docs/` | Progreso, diseño, entrega y guion de sustentación |

## Uso

1. «Agregar canción» → elige un MP3, revisa título y artista, elige la ubicación y pulsa «Agregar».
2. Pulsa una fila para seleccionarla; ▶ para reproducir. La primera reproducción activa el audio (los navegadores exigen un gesto del usuario).
3. Botones junto al estado: **aleatorio** (cruce de flechas, `aria-pressed`) y **repetición** (cambia entre sin repetición, playlist y canción).
4. «Buscar canción» filtra la lista; × o Escape limpian la búsqueda.
5. «Vaciar playlist» pide confirmación.

## Persistencia y límites

- Se guarda en **IndexedDB del navegador y del origen** (por ejemplo, `localhost:3000`). Otro navegador u otro puerto tienen su propia biblioteca.
- **No es una copia de seguridad:** el navegador puede borrar los datos (limpieza, falta de espacio).
- No hay sincronización entre pestañas: si dos pestañas editan a la vez, gana la última escritura.
- No se guardan el segundo de reproducción, la búsqueda ni el historial del aleatorio.
- Si el almacenamiento falla, la sesión sigue en memoria, se muestra el error y se puede reintentar.

## Verificaciones

Resultados reales en `docs/progreso.md` ("Estado para retomar" y cada fase):

- Pruebas automáticas (Vitest), typecheck y build de producción.
- Verificaciones en navegador real (Chromium del panel integrado), en desarrollo y producción: importación, reproducción, análisis, esfera, persistencia, búsqueda, repetición, aleatorio, vaciado, escritorio de 1366×800 y móvil de 375 px.

**Las pruebas unitarias simulan** el elemento de audio, Web Audio, IndexedDB y WebGL. La evidencia real se tomó en el navegador midiendo el elemento, el analizador, los píxeles del canvas e IndexedDB.

## Pendientes y comprobación manual

- **Audición:** el entorno de desarrollo no permite escuchar ni grabar los altavoces. Comprobación manual sugerida: importa un MP3, pulsa ▶ y confirma que se oye; baja el volumen, silencia y verifica que el sonido cambia.
- Solo se probó en Chromium (no en Safari, Firefox ni dispositivos táctiles reales).
- Un MP3 de tasa variable **sin** cabecera Xing/VBRI puede mostrar una duración estimada incorrecta (la del navegador); suena entero y avanza bien.
- No se leen etiquetas ID3 (título y artista se escriben al importar).
- El aviso `THREE.Clock … deprecated` de la consola procede de `@react-three/fiber`.
