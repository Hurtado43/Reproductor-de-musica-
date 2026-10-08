# Diseño de la interfaz (fase 2A)

## Dirección vigente: the protoype (2026-10-07)

Por petición del usuario, el nombre visible y el título de la pestaña son **the protoype** (con esa escritura exacta). La interfaz pasa a una paleta clara de blanco y rojo. Esta decisión sustituye la paleta oscura y los reflejos turquesa de la referencia histórica que se describe más abajo; se conserva la distribución, la lista enlazada y el comportamiento del audio y de la esfera.

| Uso | Color |
|-----|-------|
| Fondo exterior | Blanco cálido `#f6f3f0` |
| Área principal y playlist | Blanco `#fffdfb` |
| Diálogos | Blanco `#ffffff` |
| Entradas | Blanco cálido `#f6f2ef` |
| Texto principal / secundario / auxiliar | `#2b2023` / `#65585c` / `#74686a` |
| Acción y reproducción / hover | Carmín `#c62f3b` / `#aa2330` |
| Selección y modos activos | Rojo tenue `#fbe9e8`, con acento carmín |
| Errores y acción destructiva | Rojo oscuro `#b42332`, texto blanco en botón |

- `color-scheme: light`, independiente de la preferencia del sistema.
- Rojo reservado para acciones, selección, foco y estados; fondos planos y sombras suaves.
- Nombre en minúsculas, 1,1 rem / peso 700; se conserva la tipografía del sistema y la escala de los demás elementos.
- Playlist y área principal comparten superficie, separadas por un borde tenue (horizontal en móvil).
- Esfera metálica con base granate `#24090e` y reflejos rojos y blancos. La geometría, la reactividad al audio real, el reposo y el movimiento reducido conservan su comportamiento.

## Referencia histórica

## Referencia

La dirección visual sale del video que entregó el usuario (`Grabación de pantalla 2026-10-06 225032.mp4`, 7,4 s, 938×660). Muestra un reproductor con:

- Fondo exterior azul oscuro.
- Contenedor amplio con esquinas muy redondeadas.
- Playlist lateral azul marino a la izquierda.
- Área principal azul grisácea con un objeto 3D turquesa (un *blob* brillante).
- Título y controles debajo del objeto.

Se extrajeron fotogramas (0,3 s; 4,5 s; 7,3 s) y se muestrearon colores directamente de los píxeles. El fotograma no se guardó en el repositorio porque incluye la fotografía de un artista real.

**No se toma de la referencia:**

- **La fotografía del artista y su espacio.** El artista queda como texto y, si no se indica, se muestra «Artista no especificado».
- **Las carátulas de las filas.**
- **La búsqueda.**
- ~~La barra de progreso, el volumen y reproducir/pausa~~: **desde la fase 3A sí se incluyen**, adaptados a la columna del área principal y controlando el **audio real** (`HTMLAudioElement`). Ver "Controles de reproducción".

La referencia técnica para la esfera (`github.com/franbz1/the-artifact`) se revisó en la fase 2B. Se adaptaron sus ideas (icosaedro fusionado, deformación desde la base, material físico y Bloom) sin copiar su aplicación, su paleta cálida, su `AudioProvider` ni su playlist.

## Paleta

Los colores son variables CSS definidas en `src/app/globals.css`.

| Token | Valor | Origen en el video |
|-------|-------|--------------------|
| `--color-page` → `--color-page-edge` | `#1a2533` → `#2a3c52` | Fondo exterior (`#273542`–`#324762`), un poco más oscuro |
| `--color-sidebar` | `#021a2f` | Playlist lateral (`#021a2f`) |
| `--color-selected` | `#1c2e4b` | Fila seleccionada (`#1c2e4b`) |
| `--color-main-deep` → `--color-main` | `#2a3448` → `#2e4561` | Área principal (`#2c3244` arriba, `#34506b` abajo) |
| `--color-accent` | `#49fffc` | Centro del objeto turquesa (`#49fffc`) |
| `--color-accent-muted` | `#569eb0` | Acento lateral de la fila en el video (`#569eb0`) |
| `--color-text` | `#e8f0f7` | Texto claro de las filas (`#d1e0ed`), un poco más claro |
| `--color-text-muted` | `#b9c9d8` | Texto secundario; contraste ≥ 4,5:1 sobre el área principal |
| `--color-danger` | `#ffb4be` | Errores de formulario (no está en el video) |

Además hay tokens de:

- **Espaciado:** `--space-1` a `--space-7` y `--gutter`.
- **Radios:** `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-shell` (32 px) y `--radius-pill`.
- **Medidas:**
  - `--sidebar-width`: 28 %.
  - `--stage-column-width`: 380 px.
  - `--visualizer-max`: 380 px.
  - `--visualizer-min`: 200 px.
  - `--visualizer-max-mobile`: 340 px.
  - `--visualizer-size`: `min(380px, max(200px, 100dvh − 30rem))` (solo depende del *viewport*; desde la 3A resta también el espacio de los controles).

La interfaz es oscura por diseño (`color-scheme: dark`), sin variante clara.

## Tipografía

- Se usan las fuentes del sistema (`system-ui`, Segoe UI, Roboto…), que son sans serif. No se usa `next/font`, para no depender de la red durante el build.
- Las etiquetas van en versalitas con espaciado amplio: "REPRODUCTOR DE MÚSICA", "PLAYLIST", "CANCIÓN SELECCIONADA".
- El título de la canción seleccionada es grande y en negrita (`clamp(1.5rem, 3vw, 2.25rem)`), **sin recorte**: se muestra completo.
- Las duraciones y posiciones usan números tabulares.

## Distribución en escritorio (≥ 768 px)

```
┌──────────────────────── contenedor (máx. 1180 × 760, radio 32 px) ─────────────────────────┐
│ PLAYLIST (28 %)            │ REPRODUCTOR DE MÚSICA                                          │
│ 3 canciones · 0:31         │                  ┌── columna centrada (380 px) ──┐             │
│ [+ Agregar canción]        │                  │ ┌───────────────────────────┐ │             │
│ ────────────────────────── │                  │ │ Esfera 3D (WebGL)         │ │             │
│ 1  Título que ocupa   0:10 ×│                 │ │ cuadrado, 200–380 px      │ │             │
│    hasta dos líneas…        │                 │ └───────────────────────────┘ │             │
│    Artista no especificado  │                 │ CANCIÓN SELECCIONADA          │             │
│ ▌2 Título            0:08 × │                 │ Título completo               │             │
│ 3  Título            0:13 × │                 │ Artista                       │             │
│ …  (desplazamiento propio)  │                 │ Posición 2 de 3 · 0:08        │             │
│                             │                 │ Reproduciendo                 │             │
│                             │                 │ ━━━━━━━●─────── 0:04 / 0:13   │             │
│                             │                 │ (←) (▶/❚❚) (→)   🔈 ━━━━━━    │             │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Playlist:** ocupa `minmax(260px, 28%)` a la izquierda (medido: 28,0 %). Su lista tiene desplazamiento propio.
- **Columna centrada:** el visualizador, los detalles y la navegación están en una misma columna de `min(100%, 380px)`, centrada en el área principal.
  - El texto queda alineado a la izquierda de la columna. A 1366×800, columna, detalles y navegación empiezan en x = 658.
  - La columna tiene dos filas, alineadas arriba: la esfera (tamaño fijo según el *viewport*) y los detalles (alto mínimo de 14,5 rem, sin máximo).
- **Contenedor:** su alto es `min(760px, 100dvh − márgenes)`, con un mínimo de 560 px. El área principal tiene `overflow-y: auto`: si algo no cabe, se desplaza en vez de ocultarse.

## Esfera 3D (fase 2B)

`src/features/player/visualizer/` (detalle técnico en `docs/progreso.md`, "Fase 2B")

**Aspecto, según el video de referencia:**

- **Forma:** casi esférica, irregular y orgánica, con pliegues amplios y superficie lisa (sin facetas ni picos).
- **Material:** oscuro y brillante (`MeshPhysicalMaterial` casi negro, metálico y con clearcoat), sin `emissive`.
- **Reflejos:**
  - Turquesa amplios, de dos paneles laterales del entorno.
  - Brillos blancos definidos, de tiras blancas.
  - Zonas oscuras entre unos y otros (entorno negro).
- **Volumen:** un relleno turquesa muy tenue desde el frente.
- **Bloom moderado:** solo sobre los reflejos claros. El objeto conserva su volumen y no se convierte en una mancha luminosa.
- ~~Movimiento ambiental lento~~ (eliminado en la fase 5): la esfera solo se mueve con la música real; sin ella queda inmóvil.
- **Sin audio (pausa, final, error o sin canción):** la entrada musical es 0 y, desde la fase 5, la esfera vuelve a la forma redonda y queda quieta. No se simulan golpes.

**Reacción a la música (fase 3B):** con datos reales de un `AnalyserNode` (detalle en `docs/progreso.md`, "Fase 3B").

| Señal | Efecto visual | Intensidad máxima |
|-------|---------------|-------------------|
| Energía global (RMS) | Deformación moderada: una capa de ruido de baja frecuencia | 4,5 % del radio |
| Graves (40–250 Hz) | Pliegues amplios más marcados y una pulsación sutil del tamaño | +20 % de los pliegues y +3 % del radio |
| Agudos (2–8 kHz) | Reflejos turquesa y blancos algo más intensos (`envMapIntensity`) | +0,45 sobre 1,7 (+0,15 más por energía) |

- **Sin cambios de aspecto:** el material oscuro y metálico, el entorno, el Bloom y el tone mapping son los de la 2B. No se añade emisión ni destellos.
- **Forma orgánica:** pendiente máxima entre vértices vecinos de 0,895 con todo al máximo (sin picos). La deformación se calcula desde la base y no se acumula.
- **Suavizado único y rápido:** sube en unos 55–100 ms y baja en 200–330 ms. Los golpes de bajo se notan y la vuelta al reposo no salta.
- **Medido con una canción real (Chromium):** a volumen 1, energía media ≈ 0,74 (máx. 0,96), graves ≈ 0,54 y agudos ≈ 0,60; a volumen 0,45, ≈ 0,5; 0,38 y 0,29. No queda fija al máximo.
- **Volumen y silencio:** la reacción acompaña al nivel de salida. Con silencio o volumen 0 la entrada es 0; al restaurarlo, vuelve.
- **Movimiento reducido:** forma fija, sin pulsaciones ni cambios de brillo, también si la preferencia cambia durante la sesión. La música sigue sonando.

**Tamaño y posición:**

- **Depende solo del *viewport*:**
  - `--visualizer-size: min(380px, max(200px, 100dvh − 30rem))` en escritorio: 380 px a partir de unos 860 px de alto y 320 px a 1366×800. Desde la 3A deja sitio a los controles.
  - `min(100%, 340px)` en móvil.
- **No cambia con el contenido ni con el audio:** el título y el artista no cambian ni el tamaño ni la posición de la esfera. La pulsación de los graves ocurre dentro del canvas: el límite fijo de la forma (radio 1,271) cabe en el encuadre (≈ 1,41). Medido en producción: (658, 100, 380×380) durante todo el recorrido, incluido el título de 96 caracteres.
- **Títulos largos:** alargan la columna hacia abajo y el área principal se desplaza (`scrollbar-gutter: stable` evita que la barra de desplazamiento mueva la columna).
- **Estados (`data-state`):**
  - `checking` y `loading`: borde discontinuo y "Cargando visualización 3D…", del mismo tamaño que la escena.
  - `ready`: el borde se vuelve transparente y el texto desaparece.
  - `unsupported` o `failed`: mensaje alternativo (`role="status"`), "La playlist y la importación de canciones siguen funcionando." y, si falló, botón "Reintentar".
- **Interacción:** el canvas tiene `pointer-events: none` y no hay controles de cámara, así que no captura clics ni el desplazamiento táctil.
- **Movimiento reducido:** con `prefers-reduced-motion: reduce`, forma orgánica fija, sin rotación ni animación (`frameloop="demand"`).

| Viewport | Tamaño de la esfera |
|----------|---------------------|
| 1366×900 (cualquier título) | 380 px |
| 1366×800 (cualquier título) | 320 px (desde la 3A) |
| 375×812 (móvil) | 309–310 px (ancho disponible) |
| Alto del viewport ≤ 680 px (escritorio) | 200 px (mínimo) |

## Controles de reproducción (fase 3A)

`src/features/player/components/PlaybackControls.tsx`, debajo de los detalles, en la misma columna centrada:

1. **Estado** (`role="status"`, `aria-live="polite"`):

   | Estado | Aspecto |
   |--------|---------|
   | "Sin canción", "Cargando…", "En pausa", "Esperando datos…", "Finalizada" | Gris claro |
   | "Reproduciendo" | Turquesa |
   | "Error: …" | Rosa |
   | Bloqueo del navegador | «… Pulsa Reproducir para empezar.» |

2. **Progreso:** barra (`<input type="range" step="any">`) con la pista dibujada.
   - La parte recorrida es turquesa (`--progress`).
   - Zona táctil de 24 px y pista de 6 px.
   - Debajo, tiempo transcurrido y total. El total se redondea hacia arriba, como en la lista.
   - Teclado: ← → ±5 s, RePág/AvPág ±10 %, Inicio/Fin.
   - `aria-valuetext`: "0:12 de 0:30".
3. **Fila de transporte y volumen**
   - **Transporte:** Anterior y Siguiente (círculos de 44 px con `aria-label`) y Reproducir/Pausar (círculo turquesa de 56 px con `aria-label` "Reproducir" o "Pausar").
   - **Volumen:** botón "Silenciar" (`aria-pressed`; el icono cambia a altavoz tachado) y barra (`aria-valuetext` "80 %, silenciado").
   - En escritorio y en móvil a 375 px, todo cabe en una fila.

**Comportamiento**

- **Sin canciones:** Reproducir y la barra están deshabilitados; Anterior y Siguiente tienen `aria-disabled`. El volumen sigue activo porque es una preferencia.
- **Botón Reproducir/Pausar:** muestra "Pausar" en cuanto el usuario pide reproducir, mientras el estado dice "Cargando…" hasta que el navegador lo confirma.
- **La esfera no cambia:** su tamaño y su posición no dependen de los controles ni del título. Actualizar tiempos o estados no vuelve a renderizar el canvas.
- **A 1366×800:** con títulos de 1 o 2 líneas todo se ve sin desplazar (36 px de margen). Con un título de 5 líneas, el área principal se desplaza 88 px.

## Fase 5: esfera inmóvil sin música, aleatorio y botones de modo

**Esfera:** el movimiento ambiental se eliminó (cambio de requisito).
- **En reposo es una esfera redonda** (oscura, metálica, con reflejos turquesa). Antes de reproducir, en pausa, carga, espera, error, final o sin canciones no se mueve. Al pausar, **vuelve suavemente a la esfera** (~0,5 s medidos) y después queda quieta (ajuste pedido por el usuario sobre la versión que congelaba la forma).
- Al pulsar Reproducir no se mueve hasta que el motor confirma el sonido y llegan datos reales (unos 7 fotogramas después).
- Con música: energía → deformación, graves → pliegues y pulsación, agudos → reflejos. La velocidad de evolución también la marca la señal.
- Con silencio real, volumen 0 o mute se detiene en ~1 s. Con `prefers-reduced-motion` nunca se mueve.
- Medido con píxeles reales: silueta circular en reposo (variación de 1–1,5 px a 160 px), 8–9 px reproduciendo y 0 valores distintos una vez de vuelta en la esfera.

**Botones de modo** (a la derecha del estado, sobre la barra de progreso):

| Botón | Icono | Inactivo | Activo | Accesibilidad |
|-------|-------|----------|--------|---------------|
| Aleatorio | Flechas cruzadas | Gris, sin fondo | Turquesa, fondo `rgba(73,255,252,0.12)` y borde `--color-accent-muted` | `aria-label` «Aleatorio», `aria-pressed` |
| Repetición | Flechas en bucle («1» en canción) | Gris («Sin repetición») | Turquesa con fondo y borde («Repetir playlist» o «Repetir canción») | Nombre accesible = modo (texto visualmente oculto) y descripción del ciclo |

- **Área táctil:** 44×44 px con icono de 18 px y foco visible (anillo turquesa).
- **Sin altura extra:** los botones ocupan la separación de 8 px que ya había arriba y abajo de la línea de estado, así que la columna no crece ni se solapan con la barra.
- **Medidas:**
  - A 1366×800, con títulos de 1 a 10 líneas, la esfera queda en (688, 84) con 320 px y el área principal no se desplaza.
  - A 375×812, los botones quedan en (250, 556) y (298, 556), sin desbordamiento.
- **Aleatorio:** no cambia el orden visual. Anterior y Siguiente se deshabilitan (`aria-disabled`) cuando no hay historial anterior o no quedan canciones en el ciclo.

## Fase 4B: búsqueda, repetición, vaciado, progreso y títulos largos

**Panel de la playlist** (de arriba abajo): título, resumen y estado de guardado; fila «Agregar canción» (primario) + «Vaciar playlist» (texto secundario con papelera, gris que pasa a rosa al pasar el ratón); campo «Buscar canción» (píldora con lupa y botón × «Limpiar búsqueda»); línea «N de M canciones» solo al filtrar; lista.

- **Búsqueda:** sin distinguir mayúsculas ni acentos, por título y artista. Las filas conservan su número real. Sin resultados: «Ninguna canción coincide con «…».» + «La búsqueda revisa el título y el artista.» + botón «Limpiar búsqueda». Si la seleccionada no coincide, la línea de resultados lo dice y la canción sigue en el área principal.
- **Vaciar:** diálogo `alertdialog` de 26 rem con «¿Vaciar la playlist?», cuántas canciones se quitan y que los archivos del dispositivo no se eliminan; botones «Cancelar» (secundario, con el foco inicial) y «Vaciar» (botón rosa `--color-danger`, texto oscuro). En móvil mide 343×292 px a 375×812 y sus botones se reparten el ancho.

**Línea de estado del reproductor:** el estado («En pausa», «Reproduciendo»…) a la izquierda y, a la derecha, los botones de modo (desde la fase 5: aleatorio y repetición de 44×44 px solo con icono; ver «Fase 5»). No añade altura a la columna.

**Barra de progreso:** el mismo aspecto; mientras suena se mueve en cada fotograma (medido: saltos de 1,3–1,7 px a 380–559 px de ancho, frente a ~12 px antes con un tono de 8 s).

**Título de la canción seleccionada:**
- Caja de 2 líneas (3 si el viewport mide al menos 900 px de alto) con el tamaño de letra de siempre.
- Si no cabe: barra de desplazamiento fina, degradado inferior que indica que sigue el texto, foco por teclado (anillo turquesa; el degradado desaparece al enfocar) y el título completo en `title`. Sin marquesinas.
- A 1366×800 con un título de 10 líneas: esfera en (688, 84) de 320 px, igual que con un título corto; el área principal no se desplaza y los controles terminan 28 px antes del borde inferior.
- En escritorio con poca altura (≤ 860 px), la separación entre «REPRODUCTOR DE MÚSICA» y la columna es de 16 px en lugar de 24 px.

**Móvil 375×812:** sin desbordamiento horizontal; esfera de 310 px; «Vaciar playlist» pasa debajo de «Agregar canción»; el canvas sigue sin capturar gestos.

## Estado de la persistencia (fase 4A)

`components/PersistenceStatus.tsx`, en el encabezado de la playlist, debajo del resumen («4 canciones · 0:32»).

| Estado | Texto | Aspecto |
|--------|-------|---------|
| Restaurando | «Restaurando la biblioteca guardada…» | Gris claro, 0,75 rem |
| Restaurada | «Biblioteca restaurada de este navegador» | Gris claro |
| Vacía, lista | «Se guardará en este navegador» | Gris claro |
| Guardando | «Guardando…» | Gris claro |
| Guardado | «Guardado en este navegador» (solo tras completar la transacción) | Gris claro |
| Error | Mensaje + «… podrían perderse al recargar» y botón «Reintentar» (píldora pequeña) cuando corresponde | Rosa (`--color-danger`) |
| Desactivado | Sin almacenamiento o versión incompatible: explica que los cambios no se guardarán | Rosa |

- **Accesibilidad:** el texto es una región `role="status"` (`aria-live="polite"`). Si la restauración descarta datos dañados, aparece debajo un recuadro `role="alert"` con la lista de lo no recuperado y el botón «Entendido».
- **Mientras restaura:** «Agregar canción», el volumen y el silencio están deshabilitados (`disabled`).
- **Sin desplazar la esfera:** la línea tiene una altura mínima reservada (1,25 rem) y vive en el panel de la playlist: en escritorio, en la columna lateral; en móvil, debajo de los controles.
  - Medido a 375×812: esfera de 310 px en (33, 84), como en la 2B, y estado en y = 763, por debajo de los controles (que terminan en y = 666). Sin desbordamiento horizontal.
- **Restauración visible:** la playlist aparece con su orden y la canción seleccionada destacada; el reproductor muestra «En pausa» en 0:00 y el volumen y el silencio guardados.

## Playlist

- **Botones por fila:** cada fila tiene dos botones independientes.
  - **Seleccionar:**
    - Muestra posición (desde 1), título, artista y duración.
    - El **título ocupa hasta 2 líneas** (`-webkit-line-clamp: 2`); el texto completo está en `title` y en el nombre accesible.
    - El artista va en 1 línea y, si falta, se muestra «Artista no especificado» en cursiva.
    - La duración y el botón de eliminar se ven siempre.
  - **Eliminar:** botón "×" con nombre accesible "Eliminar N. Título".
  - Como los botones no están anidados, eliminar no selecciona por accidente.
- **Selección:** se distingue por el fondo `--color-selected`, una barra lateral turquesa de 3 px, la posición en turquesa y `aria-current="true"`.
- **Identificador:** cada fila tiene `data-song-id`, que sirve para comprobar que la selección conserva el mismo id.
- **Resumen:** cantidad de canciones y duración total ("3 canciones · 0:31").
- **Lista vacía:** "La playlist está vacía. Usa «Agregar canción» para importar archivos MP3 de tu dispositivo." No hay canciones de ejemplo.

## Diálogo "Agregar canción" (importación de MP3)

- **Tipo de modal:** propio (`role="dialog"`, `aria-modal="true"`). El resto de la interfaz recibe `inert` y el `body` no se desplaza.
- **Foco:**
  - Al abrir, va al selector de archivo.
  - Tab y Shift+Tab quedan dentro del diálogo.
  - Escape, "Cancelar" y "Cerrar" lo cierran y devuelven el foco al botón que lo abrió.
- **Campos, en orden:**
  1. **Archivo MP3:**
     - Selector nativo (`accept=".mp3,audio/mpeg"`) con el botón del sistema estilizado.
     - Debajo, el nombre y el tamaño ("Tono La 440 - 7 segundos.mp3 · 113,1 KB") y, mientras lee, "Leyendo archivo…".
  2. **Título:** se prellena con el nombre del archivo sin `.mp3`. Si se elige otro archivo, el título automático se reemplaza, pero no uno escrito a mano.
  3. **Artista (opcional):** con la indicación «Si lo dejas vacío se mostrará "Artista no especificado"».
  4. **Duración (detectada del archivo):** de solo lectura y con borde discontinuo.
     - Antes de elegir: "Se detecta al elegir el archivo".
     - Mientras lee: "Leyendo archivo…".
     - Lista: "0:08 (7,24 s)", con la duración redondeada hacia arriba y la precisa.
     - Con error: "No disponible".
  5. **Ubicación:** al inicio, al final o en una posición. El campo **Posición (de 1 a N)** solo aparece al elegir «En una posición». Escribir en él no cambia la opción.
- **Mientras se lee el archivo:** "Agregar" está deshabilitado y la playlist no cambia.
- **Errores:**
  - Los del archivo, el título y la posición aparecen bajo su campo, con `aria-invalid` y `aria-describedby`, y el foco va al primero.
  - Se conservan los campos y el archivo válido.
  - Un fallo al insertar (por ejemplo, un id repetido) se muestra con `role="alert"`.
- **No hay reproducción:** el diálogo no reproduce el audio.

## Comportamiento móvil (< 768 px)

- **Una columna:** área principal arriba y playlist debajo (`grid-template-areas: 'stage' 'playlist'`).
- **Alto:** el contenedor ocupa el alto de su contenido y la página se desplaza en vertical. La lista no tiene desplazamiento propio.
- **Columna del área principal:** ocupa todo el ancho. La esfera mide `min(100%, 340px)` (309–310 px a 375 px de ancho).
- **Navegación:** "Anterior" y "Siguiente" se reparten en dos columnas iguales.
- **Diálogo:** ocupa el ancho disponible menos el margen (343 px a 375 px), con desplazamiento propio y los botones de acción repartidos.
- **Comprobado a 375×812:** sin desbordamiento horizontal (`scrollWidth` = 375), con un título de 96 caracteres y con el diálogo abierto con un MP3 real.

## Zoom

Se emuló con tamaños de *viewport* equivalentes a 1366×800, porque el panel del navegador no admite el atajo de zoom:

| Zoom | Viewport equivalente | Resultado |
|------|----------------------|-----------|
| 125 % | 1093×640 | Escritorio; nada recortado (medido en la 2A; desde la 2B la esfera mide 224 px a esa altura y no depende del título) |
| 150 % | 911×533 | Escritorio; la página se desplaza en vertical (el contenedor mide como mínimo 560 px) |
| 200 % | 683×400 | Diseño móvil |

En ningún caso hay desbordamiento horizontal ni texto recortado fuera de los títulos de fila, que se limitan a 2 líneas a propósito.

## Accesibilidad

- **Etiquetas:** todos los campos tienen `<label>` y la Ubicación es un `<fieldset>` con `<legend>`.
- **Foco visible:** anillo turquesa de 2 px (`--focus-ring`); dentro de las filas, borde interior.
- **Botones deshabilitados:**
  - "Anterior" y "Siguiente" usan `aria-disabled` en lugar de `disabled`, para que el foco no se pierda en los extremos.
  - "Agregar" usa `disabled` solo mientras se lee el archivo.
- **Anuncios:** una región `role="status"` anuncia las operaciones. El nombre del archivo y "Leyendo archivo…" también están en una región `role="status"`.
- **Foco tras eliminar:** pasa a la fila siguiente o a la anterior, sin seleccionarla. Si la lista queda vacía, pasa al encabezado "Playlist".
- **Tamaño de los controles:** los botones principales miden al menos 44 px de alto.
- **Movimiento:** con `prefers-reduced-motion` se desactivan las transiciones.

## Capturas finales (2026-10-07)

Están en `docs/capturas/`, todas con MP3 reales generados para la prueba.

| Archivo | Contenido |
|---------|-----------|
| `fase2a-mp3-escritorio-1366.jpg` | Producción, 1366×800: playlist importada, columna centrada y título de 96 caracteres completo |
| `fase2a-mp3-dialogo-escritorio-1366.jpg` | Desarrollo, 1366×800: diálogo con un MP3 real (nombre, tamaño, título prellenado, duración "0:10 (9,14 s)", ubicación "Al inicio") |
| `fase2a-mp3-movil-375.jpg` | Producción, 375×812: área principal arriba |
| `fase2a-mp3-movil-375-playlist.jpg` | Desarrollo, 375×812: playlist con títulos de 2 líneas y «Artista no especificado» |
| `fase2a-mp3-dialogo-movil-375.jpg` | Producción, 375×812: diálogo con MP3, duración "0:08 (7,24 s)" y el campo de posición visible |

Las capturas de la versión anterior (formulario manual) están en `docs/capturas/historico-formulario-manual/` como registro.

### Fase 5: esfera y modos

| Archivo | Contenido |
|---------|-----------|
| `fase5-esfera-reposo.jpg` | Desarrollo, 1366×800: esfera redonda en reposo (en pausa) |
| `fase5-esfera-reproduciendo.jpg` | Desarrollo, 1366×800: la misma esfera deformada al ritmo del ritmo de prueba |
| `fase5-escritorio-1366x800-modos.jpg` | Desarrollo, 1366×800: aleatorio y «Repetir playlist» activos (turquesa), título largo en su caja y la esfera en reposo (en pausa) |
| `fase5-movil-375.jpg` | Desarrollo, 375×812: botones de modo de 44×44 junto al estado, controles en una fila y sin desbordamiento |

### Fase 4B: funciones adicionales y ajustes

| Archivo | Contenido |
|---------|-----------|
| `fase4b-produccion-escritorio-busqueda.jpg` | Producción, 1366×800: búsqueda «cort» (2 de 3), «Vaciar playlist», repetición «Repetir canción» en la línea de estado |
| `fase4b-escritorio-1366x800-titulo-largo.jpg` | Desarrollo, 1366×800: título de 10 líneas en su caja de 2 líneas con degradado; la esfera y los controles en su sitio |
| `fase4b-movil-375.jpg` | Desarrollo, 375×812: título largo, repetición y controles en una fila, sin desbordamiento |

### Fase 4A: persistencia

| Archivo | Contenido |
|---------|-----------|
| `fase4a-dev-guardado.jpg` | Desarrollo, 800×600: cuatro MP3 importados (uno en la posición 2) y «Guardado en este navegador» bajo el resumen. La esfera aún mostraba "Cargando visualización 3D…" porque el panel estaba oculto mientras se importaba |
| `fase4a-movil-375-restaurada.jpg` | Desarrollo, 375×812: playlist restaurada tras recargar, «En pausa» en 0:00, volumen guardado y el estado «Biblioteca restaurada…» en el panel, debajo de los controles |

### Fase 3B: esfera reactiva (música real)

| Archivo | Contenido |
|---------|-----------|
| `fase3b-dev-musica-reproduciendo.jpg` | Desarrollo, 800×586: canción real sonando a volumen 1; la esfera deformada dentro de su espacio. El indicador "1 Issue" corresponde al servidor de archivos de la prueba, no a la app |
| `fase3b-produccion-musica-reproduciendo.jpg` | Producción, 800×588: pasaje fuerte (1:27) de la canción real; reflejos turquesa y forma orgánica |

Son instantes aislados: no prueban la fluidez ni el movimiento continuo (ver `docs/progreso.md`).

### Fase 3A: controles con reproducción real

| Archivo | Contenido |
|---------|-----------|
| `fase3a-escritorio-1366x800-reproduciendo.jpg` | Producción, 1366×800: "Reproduciendo" con progreso 0:04 / 0:13; esfera de 320 px |
| `fase3a-escritorio-1366x900-reproduciendo.jpg` | Producción, 1366×900: esfera de 380 px con los controles debajo |
| `fase3a-movil-375-controles.jpg` | Producción, 375×812: controles en una fila, reproduciendo |
| `fase3a-salida-elemento-tono-la-440hz.webm`, `fase3a-salida-elemento-tono-mi-659hz.webm` | Grabación de la **salida del elemento de audio** (`captureStream`), no del altavoz (ver `docs/progreso.md`) |

### Fase 2B: esfera 3D (WebGL real, Chromium con Intel UHD 630)

| Archivo | Contenido |
|---------|-----------|
| `fase2b-escritorio-1366.jpg` | Producción, 1366×800: esfera de 380×380 con canciones importadas y título corto |
| `fase2b-escritorio-titulo-largo.jpg` | Producción, 1366×800: el mismo tamaño y la misma posición de la esfera con el título de 96 caracteres; el área principal se desplaza |
| `fase2b-movil-375.jpg` | Producción, 375×812: esfera de 310 px de lado, sin desbordamiento |
| `fase2b-material-sin-postprocesado.png` | Desarrollo: material e iluminación antes de añadir el Bloom (revisión previa) |
| `fase2b-movimiento-reducido.png` | Desarrollo: forma fija con movimiento reducido (idéntica a otra captura tomada 17 s después) |
| `fase2b-deformacion-timelapse.gif` | ***Timelapse*** de 6 capturas reales separadas unos 3 s (no es video en tiempo real; ver `docs/progreso.md`) |
