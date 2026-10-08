# Guion de sustentación (5 minutos)

**Autor:** Juan José Rueda Viveros

## 0:00–0:30 · Objetivo

- Taller de TypeScript: una **lista doblemente enlazada** propia usada de verdad como playlist de un reproductor.
- Es un reproductor **real**: importa MP3 del dispositivo, suena, analiza el audio y una esfera 3D reacciona a la música.
- Next.js + TypeScript estricto; el dominio es TypeScript puro y está probado por separado.

## 0:30–1:15 · El nodo y sus enlaces

- `src/domain/DoublyLinkedNode.ts`: un nodo tiene `data`, `prev` y `next`. Hacia afuera se entrega como `ReadonlyNode` (no se pueden reasignar los enlaces).
- `src/domain/DoublyLinkedList.ts`: guarda `head`, `tail` y `size`, y un `WeakSet` con sus nodos. Así `remove` rechaza nodos ajenos o ya eliminados.
- Invariantes que comprueban las pruebas: `head.prev` y `tail.next` son `null`, y en cada nodo `x.next.prev === x` y `x.prev.next === x`.

## 1:15–2:00 · Inserción, eliminación y navegación (complejidades del código)

| Operación | Método | Complejidad |
|-----------|--------|-------------|
| Insertar al inicio / al final | `insertFirst` / `insertLast` | O(1) |
| Insertar en posición `i` | `insertAt` (recorre desde el extremo más cercano) | O(min(i, n − i)) |
| Eliminar un nodo conocido | `remove(nodo)` (re-enlaza vecinos) | O(1) |
| Eliminar o seleccionar por id | `Playlist.remove(id)` / `select(id)` (busca el nodo) | O(n) |
| Anterior / siguiente | `Playlist.previous` / `next` (siguen `prev` / `next`) | O(1) |
| Recorrer para mostrar | `snapshot()` | O(n) |

- La interfaz muestra posiciones desde 1; el dominio usa índices desde 0 (`songForm.ts` es el único punto de conversión).
- Una inserción inválida lanza un error **antes** de modificar la lista.

## 2:00–2:40 · Separación entre dominio, archivos y audio

- El **dominio** no conoce `File`, `Blob` ni el navegador (lo verifica `tsconfig.domain.json`).
- El **registro de fuentes** asocia id → `File` real. `PlaylistController` mantiene sincronizados la lista y el registro: la importación es atómica y eliminar retira también el archivo.
- El **motor de audio** tiene un único `HTMLAudioElement`, carga el id seleccionado y descarta respuestas y eventos antiguos mediante versiones. No guarda el orden: el orden es la lista.

## 2:40–3:20 · Análisis y esfera

- Ruta única: elemento → `MediaElementAudioSourceNode` → `AnalyserNode` → altavoces. Se crea al primer clic en Reproducir.
- Se calculan RMS (energía) y bandas de graves (40–250 Hz) y agudos (2–8 kHz) en dBFS con rangos fijos.
- La esfera usa ruido simplex para la forma orgánica, pero su **tiempo** y su **intensidad** dependen de la señal. En reposo es una **esfera redonda**: la deformación se multiplica por la intensidad real. Al pausar vuelve a la esfera y se detiene; con silencio real también.

## 3:20–3:50 · Persistencia

- IndexedDB: cada canción con su archivo MP3 real en el mismo registro, más un registro con el **orden como lista de ids**, la selección y las preferencias.
- Al recargar se **reconstruye la lista enlazada** con `add` y `select`. No se guardan nodos.
- Una transacción a la vez y siempre con el estado más reciente: nada parcial ni escrituras antiguas. Restaurar nunca reproduce.

## 3:50–4:20 · Aleatorio sin sustituir la lista enlazada

- `src/features/player/shuffle.ts` guarda solo **ids**: los candidatos pendientes del ciclo y un historial con cursor.
- Siguiente elige al azar (de forma uniforme) entre los candidatos y **luego selecciona en la `Playlist`**. El orden de la lista y el guardado no cambian.
- Anterior recorre el historial. Con «Repetir playlist», al agotar los candidatos empieza otro ciclo sin repetir la última. «Repetir canción» tiene prioridad.

## 4:20–5:00 · Demostración sugerida

1. Importar tres MP3: al final, al inicio y en la posición 2. Mostrar los números de posición.
2. Reproducir: la esfera redonda empieza a deformarse con la música. Pausar: vuelve a la esfera.
3. Siguiente y Anterior; eliminar la canción actual (queda una alternativa en pausa).
4. Activar aleatorio: Siguiente salta sin repetir y la lista no cambia de orden. Anterior vuelve por el historial.
5. Buscar por artista sin acentos.
6. Recargar la página: la playlist, los archivos y las preferencias vuelven, en pausa.
7. (Si hay tiempo) Vaciar la playlist con confirmación.
