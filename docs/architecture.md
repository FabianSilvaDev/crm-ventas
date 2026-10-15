# Arquitectura

Documento de referencia del **AI Operations CMS**: un CMS para supervisar un sistema
multiagente de investigación, marketing, contenido, campañas, captación y ventas.

La primera versión funciona **de extremo a extremo con datos simulados**: no hay
modelos de lenguaje, ni plataformas publicitarias, ni base de datos. Los servicios y
los contratos están diseñados para sustituir los datos simulados por agentes y API
reales sin tocar el frontend.

---

## 1. Vista general

```text
ai-operations-cms/
├── backend/                 API REST simulada (Node.js + Express 5, ESM)
│   ├── src/
│   │   ├── server.js        Arranque, apagado ordenado
│   │   ├── app.js           Construccion de la app Express (CORS, middlewares, rutas)
│   │   ├── config.js        Configuracion por variables de entorno
│   │   ├── store.js         Estado en memoria (lo unico que cambia mientras vive el proceso)
│   │   ├── errors.js        AppError y factorias de error
│   │   ├── routes/          Tabla de rutas de /api/v1
│   │   ├── controllers/     Validacion de entrada + delegacion (finos)
│   │   ├── services/        Logica: metricas, simulacion, agregaciones
│   │   ├── mocks/           Datos de demostracion (estado INICIAL)
│   │   ├── middleware/      Contexto de peticion, 404, errores, rate limit
│   │   └── utils/           HTTP, validacion, fechas, aleatoriedad determinista
│   ├── support/             Utilidades de prueba (fuera de test/ a proposito)
│   └── test/                Pruebas de health, agentes y flujos (node:test)
├── frontend/                SPA Angular 22 (standalone, zoneless, signals)
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/        Modelos, servicios de API, layout, utilidades
│   │   │   ├── shared/      Componentes y tuberias reutilizables, motor de pixel art
│   │   │   └── features/    Una carpeta por seccion del CMS
│   │   ├── environments/    URL base de la API (dev / produccion)
│   │   └── styles.css       Sistema de diseno pixel art
│   └── tools/               check-sprites.mjs (validador de matrices de pixeles)
├── docs/                    Esta documentacion
└── package.json             Scripts para instalar y ejecutar ambos proyectos
```

## 2. Flujo de datos

```text
mocks/*.js            store.js                     services/*        controllers/     routes/
(estado inicial)  →   (estado mutable:         →   (agregan,      →  (validan)     →  /api/v1
                       agentes, actividad,          cruzan datos)
                       notificaciones, runs)
```

- `mocks/` describe cómo es la demostración **al arrancar**.
- `store.js` es lo único que cambia: estado de agentes, tareas, ejecuciones, actividad
  y notificaciones. Al reiniciar el proceso, todo vuelve al estado inicial.
- Los servicios **nunca** exponen los mocks en crudo: resuelven referencias
  (producto → oferta → landing → campaña) y calculan agregados en un único sitio
  (`services/metrics.js`), de modo que dos vistas no pueden mostrar cifras distintas.

### Determinismo

Los datos que deben ser estables entre vistas (leads, series, reparto de ingresos) se
generan con un generador pseudoaleatorio **sembrado** (`utils/random.js`). La misma
consulta devuelve siempre el mismo resultado. Las cifras narrativas (productos,
campañas, landings) están escritas a mano para que cuenten una historia coherente.

## 3. Backend

### Contratos de respuesta

Todas las respuestas comparten envoltura (ver `utils/http.js`):

```json
{
  "data": {},
  "meta": {
    "generatedAt": "2026-10-06T07:30:00.000Z",
    "apiVersion": "1.0.0",
    "demo": true,
    "demoReferenceDate": "2026-10-06T07:30:00.000Z",
    "pollIntervalMs": 1500
  }
}
```

Los listados añaden `total`, `page`, `pageSize` y `totalPages`. Los errores usan
`{ "error": { "code", "message", "details? }, "meta": {...} }`.

`demoReferenceDate` es la fecha a la que se refieren los datos simulados: la interfaz
la usa para mostrar tiempos relativos coherentes ("hace 4 min") aunque el proceso se
ejecute otro día.

### Validación y errores

- Los controladores validan toda la entrada con `utils/validate.js` y lanzan
  `AppError` (400/404/409 con `details`), nunca `Error` genéricos.
- `middleware/index.js` concentra el manejador de errores: es el único lugar que
  decide qué ve el cliente. Los errores no controlados se registran completos
  (con traza) y se responden en genérico, sin filtrar detalles internos.

### Simulación de flujos (`services/workflow-simulator.js`)

1. `POST /workflows/:id/run` crea la ejecución y responde **de inmediato** con su `runId`.
2. Cada ejecución tiene **un único temporizador** que avanza el progreso de la etapa
   en curso (`tickMs`) y la cierra al llegar a 1.
3. Al completar una etapa se copian su resultado previsto, se actualizan los agentes
   implicados, se registra actividad y, al terminar todo, se emite una notificación.
4. Pausar **cancela** el temporizador; reanudar lo recrea; reiniciar deja la ejecución
   en su estado inicial; reanudar tras un fallo **reintenta la etapa fallida**.
5. Los temporizadores se registran en `services/timers.js` para poder cancelarlos
   todos en el apagado ordenado del servidor. Se marcan con `unref()` para que
   ninguno impida que el proceso termine.

Sólo fallan las etapas declaradas en `FAILURE_PRONE_STAGES` (límites de presupuesto,
entrega de tráfico, verificación de rendimiento...), con probabilidad
`SIMULATION_FAILURE_RATE`. Así el ciclo completo puede terminar de verdad y el manejo
de errores se demuestra en un punto creíble.

## 4. Frontend

### Capas

| Capa | Responsabilidad |
| --- | --- |
| `core/models` | Contratos tipados que reflejan exactamente la API. |
| `core/services` | Un servicio por recurso. Sólo hablan con `ApiService`. |
| `core/layout` | Shell, sidebar, header y la lista de secciones (`nav-items.ts`). |
| `core/util` | `AsyncState` (datos/carga/error) y utilidades. |
| `shared/components` | Piezas reutilizables (paneles de estado, chips, gráficos). |
| `shared/pixel` | Motor de pixel art: matrices, paleta, render a SVG y a canvas. |
| `features/*` | Una vista por sección; carga diferida desde `app.routes.ts`. |

Reglas que se cumplen en todo el frontend:

- Ningún componente usa `HttpClient` directamente ni contiene datos simulados.
- Ninguna URL de API se escribe fuera de `environments/`.
- Todo estado vive en signals (`provideZonelessChangeDetection`), así que no hay
  zone.js y ninguna actualización se pierde.
- Cada vista cubre **carga, error, vacío y éxito** con `app-state-display`.
- Todo sondeo (ejecuciones, tareas, oficina) se cancela al completar, fallar o
  destruirse el componente (`takeUntilDestroyed`).

### Motor de pixel art

No hay imágenes: los sprites son **matrices de texto** en `shared/pixel/` donde cada
carácter es un píxel y su color sale de una paleta resuelta en tiempo de ejecución.

```text
'...ohhhhhhhho...'   o = contorno   h = pelo   s = piel
'...ohssssssho...'   A = acento del departamento   k = tela oscura
```

- `PixelIcon` convierte una matriz en un SVG en línea (iconos de la interfaz).
- `agent-sprites.ts` compone al personaje en tres capas: **cuerpo + peinado + accesorio**,
  de modo que 2 cuerpos × 3 peinados × 3 accesorios × 8 acentos × 4 pieles dan variedad
  suficiente para toda la plantilla sin dibujar un personaje por agente.
- `features/virtual-office/pixel/textures.ts` convierte esas mismas matrices en
  texturas de PixiJS (canvas de 1 píxel por celda, muestreo `nearest`), cacheadas por
  clave y liberadas al desmontar la vista.
- `assertMatrix` valida al cargar que ninguna matriz esté descuadrada; el
  comportamiento se puede revisar sin navegador con `npm --prefix frontend run check:sprites`.

La oficina usa **una sola instancia de `Application`** por vista y una única vista
(cenital para el suelo, frontal para personajes y muebles), mantenida en todo el
escenario.

### Gráficos

Los gráficos siguen un sistema propio documentado en `styles.css`:

- **Un solo eje por gráfico.** Ingreso y gasto comparten eje porque comparten unidad;
  nunca hay dos escalas en la misma figura.
- Las series usan una paleta categórica **validada** sobre la superficie real de las
  tarjetas (`#16202b`): banda de luminosidad, croma, separación para daltonismo
  (peor par adyacente ΔE 9.4), visión normal (24.6) y contraste ≥ 3:1.
- Los colores **neón** del pixel art se reservan para la interfaz (bordes, iconos,
  etiquetas), donde siempre acompañan a un texto que identifica el dato.
- Donde la magnitud por categoría basta (tareas por departamento, ingreso por canal)
  se usa **un solo tono** y el nombre como identidad: teñir ocho categorías de la
  misma medida sería codificar información inexistente.
- Los estados se comunican siempre con **glifo + texto + color**, nunca sólo color.
- Los gráficos de línea y de barras ofrecen **tabla de datos** alternativa.

## 5. Fuentes de datos (estudio de oportunidad)

`backend/src/sources/` es el **único** punto por el que el sistema habla con el
exterior. Cada fuente es un adaptador con la misma forma:

```js
collect({ keywords, geo, timeframe }) -> { signals, notes }
```

| Adaptador | Aporta | Requisitos | Estado verificado |
| --- | --- | --- | --- |
| `google-trends.source.js` | `demand`, `momentum` | ninguno | Autocompletado de temas: **funciona**. Serie de interés: Google responde 429 desde IP de servidor. |
| `alibaba-group.source.js` (perfil AliExpress) | `cost`/`price`, `competition`, `salesVolume` | `ALIEXPRESS_APP_KEY` + `SECRET` (app aprobada) | Endpoint vivo; sin credenciales devuelve `InvalidAppKey`. |
| `alibaba-group.source.js` (perfil Alibaba.com) | `cost`, `competition`, `salesVolume` | `ALIBABA_APP_KEY` + `SECRET` | Endpoint vivo; valida `app_key` y luego `timestamp`. |
| `simulated.source.js` | todas | ninguno | Coherente con el catálogo de la demo. |

### Reglas que cumple el registro (`sources/index.js`)

1. **Ninguna señal sale sin procedencia.** Los adaptadores devuelven señales parciales
   y el registro les sella `source` (`id`, `name`, `kind`, `mode`) y `collectedAt`.
   Es imposible que una cifra llegue a la interfaz sin decir de dónde sale.
2. **Un fallo no tumba la recogida.** Cada adaptador corre por separado con su propio
   estado (`live` / `unavailable` / `error`); si Google limita o faltan credenciales,
   el informe lo dice y el resto continúa.
3. **Nada inventado.** Si el modo es `live` y ninguna fuente responde, el estudio
   devuelve cero señales y el veredicto `sin datos suficientes`. El modo `auto` sólo
   completa con la demo si ésta va **marcada** como `simulated` y con confianza baja.

### Modos (`SOURCES_MODE`)

| Modo | Comportamiento |
| --- | --- |
| `auto` (por defecto) | Usa las fuentes reales disponibles y completa con la demo marcada. |
| `live` | Sólo fuentes reales: sin credenciales ni red, el estudio no devuelve datos. |
| `simulated` | No sale a la red; sirve para trabajar sin cuota ni claves. |

### Añadir una fuente

Un fichero que exporte `collect()` y `describe()`, y una entrada en `adapters()` de
`sources/index.js`. El resto del sistema (puntuación, fichas, procedencia, interfaz)
no se toca. Esto es lo que hace que un proveedor de pago para Trends, un CSV de
proveedor o una API de afiliados entren sin rediseñar nada.

### Firma de la Open Platform

AliExpress y Alibaba comparten el esquema TOP: parámetros ordenados por nombre,
concatenados como `clavevalor`, envueltos por el secreto y firmados con MD5 en
mayúsculas. Está implementado en `signTopMd5()` y cubierto por una prueba con un valor
calculado a mano, porque un error de firma en esta API se manifiesta como
`InvalidSignature` sin más pistas.

## 6. Sustituir los datos simulados por agentes reales

El diseño ya está preparado; el trabajo se concentra en el backend:

1. **Un proveedor de agentes** (`services/`): implementar una función que reciba la
   etapa y su contexto y devuelva el mismo `result` que hoy generan los mocks.
2. **Sustituir `buildTaskResult`** en `agents.service.js` y el resultado de etapa en
   `workflow-simulator.js` por la llamada real, manteniendo la forma del objeto.
3. **Integraciones**: la vista de configuración ya lista los puntos de conexión
   (modelos, publicidad, CRM, analítica, correo) como `disabled` o `simulated`.
4. **Persistencia**: `store.js` es el único módulo que habría que respaldar con una
   base de datos; los servicios leen de él, no de los ficheros de `mocks/`.

El frontend no cambia: consume contratos, no implementaciones.

## 7. Decisiones y limitaciones

| Decisión | Motivo |
| --- | --- |
| npm en los tres `package.json` | Lo pide la especificación; `concurrently` sólo aporta comodidad en la raíz. |
| Express 5 sin `*` sueltos | Express 5 cambió el analizador de rutas; los comodines requieren nombre. |
| Rutas agrupadas en `routes/index.js` | Permite leer la superficie completa de la API de una vez. |
| Ayudante de pruebas en `support/` | `node --test` trata todo fichero bajo `test/` como prueba. |
| Presupuestos de `angular.json` ampliados | El sistema de diseño global y PixiJS superan los límites por defecto del scaffold. |
| Datos y ejecuciones en memoria | Decisión explícita de la especificación para la primera versión. |
| Sin autenticación | Fuera del alcance de esta fase; el perfil del header es ficticio. |

Limitaciones conocidas: al reiniciar el backend se pierden las ejecuciones, las tareas
y la actividad generada; no hay persistencia ni multi-usuario.
