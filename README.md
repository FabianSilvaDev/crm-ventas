# AI Operations CMS

CMS para supervisar un sistema multiagente de inteligencia artificial dedicado a
investigación de mercado, marketing, contenido, publicidad, captación de clientes,
ventas y analítica.

Incluye una **oficina virtual en pixel art** donde los agentes trabajan por
departamento, un **flujo de 17 etapas** que se ejecuta de verdad en el backend, y las
vistas administrativas para revisar productos, ofertas, campañas, leads y resultados.

> **Todos los datos son simulados y ficticios.** No hay modelos de lenguaje,
> plataformas publicitarias, servicios de terceros ni base de datos: esta primera
> versión funciona de extremo a extremo con un backend Express que genera respuestas
> realistas. Los servicios y los contratos están preparados para sustituir esos datos
> por agentes y APIs reales sin tocar el frontend
> (ver [docs/architecture.md](docs/architecture.md#5-sustituir-los-datos-simulados-por-agentes-reales)).

---

## Requisitos

| Herramienta | Versión verificada |
| --- | --- |
| Node.js | v24.19.0 (mínimo 20.6, por `--env-file-if-exists`) |
| npm | 11.x |

No hace falta Docker, base de datos ni ninguna otra herramienta.

## Instalación

```bash
git clone <url-del-repositorio>
cd "crm ventas"

# Instala backend y frontend, y las herramientas de la raiz
npm install
npm run install:all
```

`npm install` en la raíz sólo instala `concurrently` (para levantar ambos servicios
con un comando); las dependencias reales viven en `backend/` y `frontend/`.

## Ejecución

### Opción A: un solo comando

```bash
npm run dev
```

Levanta el backend en `http://localhost:3000` y el frontend en
`http://localhost:4200` con salida etiquetada por servicio.

### Opción B: dos terminales

```bash
# Terminal 1 — API
npm run dev:backend

# Terminal 2 — interfaz
npm run dev:frontend
```

Después abre **http://localhost:4200**.

### Si el puerto 4200 o el 3000 están ocupados

```bash
# Interfaz en otro puerto
npm run dev:frontend -- --port 4300

# API en otro puerto (y avisando al frontend del origen nuevo)
CORS_ORIGINS=http://localhost:4200,http://localhost:4300 PORT=3100 npm run dev:backend
```

Si cambias el puerto de la interfaz, añádelo a `CORS_ORIGINS` (o el navegador bloqueará
las peticiones) y ajusta `apiBaseUrl` en `frontend/src/environments/environment.ts` si
mueves la API.

### Scripts disponibles

| Comando | Qué hace |
| --- | --- |
| `npm run install:all` | Instala las dependencias del backend y del frontend. |
| `npm run dev` | Backend + frontend a la vez. |
| `npm run dev:backend` | Sólo la API, con recarga automática. |
| `npm run dev:frontend` | Sólo la interfaz Angular. |
| `npm run build` | Compila el frontend en `frontend/dist`. |
| `npm test` | Pruebas de la API (health, agentes y flujos). |
| `npm --prefix frontend run check:sprites` | Valida las matrices de pixel art. |

## Variables de entorno

Son **opcionales**: el backend arranca con valores por defecto razonables. Para
cambiarlas, copia `.env.example` a `backend/.env`:

```bash
cp .env.example backend/.env          # Linux/macOS
Copy-Item .env.example backend/.env   # Windows PowerShell
```

| Variable | Por defecto | Para qué sirve |
| --- | --- | --- |
| `PORT` | `3000` | Puerto de la API. |
| `CORS_ORIGINS` | `http://localhost:4200,http://127.0.0.1:4200` | Orígenes permitidos. |
| `SIMULATION_STEP_MS` | `4200` | Duración de cada etapa de un flujo. |
| `SIMULATION_TASK_MS` | `2600` | Duración de una tarea de agente. |
| `SIMULATION_FAILURE_RATE` | `0.03` | Probabilidad de fallo controlado. Ponlo a `0` para que la demo no se detenga nunca por un error simulado. |
| `POLL_INTERVAL_MS` | `1500` | Cadencia de polling que la API anuncia al frontend. |

La URL de la API en el frontend se configura en
`frontend/src/environments/environment.ts`.

## Qué se puede hacer

- **Dashboard**: indicadores, salud de la operación, series temporales, embudo,
  actividad reciente y últimas tareas.
- **Oficina virtual** (`/office`): escenario pixel art con 8 salas y 20 agentes.
  Arrastra para mover la vista, usa la rueda para acercar, filtra por departamento,
  estado o nombre, y pulsa un agente para ver su ficha y **ejecutar una tarea
  simulada** cuyo avance se sigue por polling.
- **Flujo de agentes** (`/workflows`): las 17 etapas de izquierda a derecha con sus
  dependencias dibujadas. **Iniciar demostración** hace que el backend recorra el
  flujo; se puede **pausar**, **reanudar**, **reiniciar** y consultar el resultado y
  las métricas de cada etapa.
- **Agentes**, **Investigación**, **Productos y ofertas**, **Contenido y
  creatividades**, **Landing pages**, **Campañas**, **Leads y ventas**,
  **Analítica** y **Configuración**: vistas conectadas a la API con filtros,
  detalle y estados de carga, error y vacío.

## Comprobar que funciona

```bash
# 1. La API responde
curl -s http://localhost:3000/api/v1/health

# 2. Pruebas automatizadas de la API (23 comprobaciones)
npm test

# 3. El frontend compila
npm run build

# 4. El pixel art no tiene matrices descuadradas
npm --prefix frontend run check:sprites
```

En la interfaz, el indicador del header debe mostrar **API conectada** en verde. Si
aparece en rojo, el backend no está arrancado o `apiBaseUrl` no apunta al puerto
correcto; el propio header permite reintentar la conexión.

## Estructura

```text
crm ventas/
├── backend/     API REST simulada (Express 5, JavaScript ESM, datos en memoria)
├── frontend/    SPA Angular 22 (standalone, zoneless, signals, PixiJS)
├── docs/        architecture.md y api.md
└── package.json Scripts de instalación y ejecución
```

Detalle completo en [docs/architecture.md](docs/architecture.md) y referencia de
endpoints en [docs/api.md](docs/api.md).

## Fuentes de datos (estudio de oportunidad)

El intake puede trabajar con fuentes reales o sólo con la demo. Lo controla
`SOURCES_MODE` (`auto` por defecto) y el estado se consulta en `GET /api/v1/sources`.

```powershell
# Que fuentes hay y cuales estan configuradas
Invoke-RestMethod http://localhost:3000/api/v1/sources | ConvertTo-Json -Depth 4

# Un estudio, sin salir a la red (funciona siempre)
Invoke-RestMethod -Method Post http://localhost:3000/api/v1/intake/scan `
  -ContentType 'application/json' `
  -Body '{"keywords":["teclado mecanico","soporte de monitor"],"mode":"simulated","constraints":{"minMargin":0.25}}'
```

| Fuente | Necesita | Estado comprobado |
| --- | --- | --- |
| **Google Trends** | nada | El autocompletado de temas responde; la serie de interés devuelve **429** desde IP de servidor (Google limita), así que puede fallar de forma intermitente |
| **AliExpress** | `ALIEXPRESS_APP_KEY` + `SECRET` | Endpoint vivo; sin credenciales responde `InvalidAppKey` |
| **Alibaba.com** | `ALIBABA_APP_KEY` + `SECRET` | Endpoint vivo; hay que confirmar el método aprobado para tu app |
| **Datos de demostración** | nada | Siempre disponible, siempre marcada como `simulated` |

Lo importante de cómo está montado: **cada cifra viaja con su fuente, su fecha y su
confianza**, y un dato que falta se declara ausente en lugar de rellenarse. Si pides un
estudio en modo `live` sin credenciales, la respuesta no trae números inventados: trae
cero señales, el motivo de cada fuente y el veredicto `sin datos suficientes`.

Para trabajar con datos reales: copia `.env.example` a `backend/.env`, rellena las
claves y pon `SOURCES_MODE=live`. Detalles y límites en
[docs/architecture.md](docs/architecture.md#5-fuentes-de-datos-estudio-de-oportunidad).

## Oportunidades: cómo se elige qué perseguir

La sección **Oportunidades** es donde arranca todo. El recorrido es el de un caso real:

1. **Descubrir.** El botón *Qué está subiendo* lee el feed de tendencias de Google Trends
   y trae los términos que suben ahora en tu país, con su volumen aproximado.
2. **Estudiar.** Escribes los términos a valorar (o usas los descubiertos), fijas tus
   restricciones —margen mínimo, coste máximo, competencia asumible— y lanzas el estudio.
   Yanca consulta las fuentes y **registra las candidatas en la cola**.
3. **Decidir.** La cola ordena por puntuación. Cada fila muestra su **cobertura** (cuánto
   del estudio se pudo completar) y sus **datos ausentes**: un 75 sobre dos métricas no es
   lo mismo que un 75 sobre seis. Al abrir una, ves **cada cifra con su fuente**, las
   comprobaciones de tus restricciones y el historial de estudios.
4. **Aprobar** la oportunidad, con motivo. Solo las aprobadas se pueden ejecutar.
5. **Lanzar el flujo con ella.** Desde la ficha, *Lanzar el flujo* arranca la ejecución
   atada a esa oportunidad y te lleva al flujo a seguirla. Y ahí está la diferencia:

   | Ejecución | Qué produce |
   | --- | --- |
   | **Con** oportunidad | Las métricas de cada etapa salen del estudio de *esa* oportunidad, y los artefactos son suyos: los registros reales si el término corresponde a un producto del catálogo, o propuestas marcadas como *propuesto* si no existe todavía. |
   | **Sin** oportunidad (demostración) | Recorre siempre el caso previsto de la plantilla (`rsc-0001`, `prd-001`, `off-0001`...), sea cual sea el término. |

```powershell
# Que esta subiendo ahora (dato real de Google Trends)
Invoke-RestMethod "http://localhost:3000/api/v1/intake/discover?geo=ES" | ConvertTo-Json -Depth 4

# Estudio de dos terminos, con tus restricciones, y registro en la cola
Invoke-RestMethod -Method Post http://localhost:3000/api/v1/intake/scan -ContentType 'application/json' `
  -Body '{"keywords":["perforadora de escritorio","soporte de portatil"],"mode":"auto","constraints":{"minMargin":0.3,"maxCost":120}}'

# La cola y una decision
Invoke-RestMethod http://localhost:3000/api/v1/opportunities | ConvertTo-Json -Depth 4
Invoke-RestMethod -Method Post http://localhost:3000/api/v1/opportunities/opp-0004/approve `
  -ContentType 'application/json' -Body '{"reason":"Margen alto y poca competencia."}'
```

**Estado real de Google Trends** (comprobado, no supuesto): la resolución de términos
y el feed de tendencias **funcionan**; la serie de interés responde **429** desde IP de
servidor, así que en este equipo la demanda la aportan los datos de demostración,
marcados como `simulated` en cada cifra. La vista lo dice en la barra superior:
"*N fuentes reales · modo auto*".

## Puertas de decisión: dónde se para el flujo

El flujo no corre del tirón. **Se detiene en tres puntos** y espera tu decisión, porque
son los momentos en los que seguir tiene un coste:

| Etapa | Qué te pregunta |
| --- | --- |
| **Validación de producto** | ¿Seguimos adelante con esta oportunidad? Es el punto más barato para descartarla. |
| **Configuración de campaña** | ¿Publicamos la campaña? |
| **Audiencia y presupuesto** | ¿Autorizas el reparto? A partir de aquí se gasta. |

Mientras espera, la ejecución está en `awaiting_approval`: la etapa aparece marcada como
*Esperando decisión*, el contador de **Flujo de agentes** del menú se pone en ámbar y el
header muestra **«N esperando tu decisión»** con acceso directo. Cuando abres esa
ejecución, el panel de la puerta te da la pregunta, el contexto y los dos botones.

- **Aprobar** continúa el flujo por donde iba (y no vuelve a preguntar por esa etapa).
- **Rechazar** detiene el ciclo: lo ya hecho se conserva, lo pendiente queda omitido, y
  detenerse a propósito **no cuenta como fallo**. Si el ciclo venía de una oportunidad,
  **esa oportunidad se descarta con tu motivo** — decidir que no en el flujo se refleja en
  la cola, en lugar de dejarla ahí para que alguien la reintente.

Para demostraciones desatendidas: `SIMULATION_GATES=off` en `backend/.env`.

## Datos y persistencia

**Los datos y las ejecuciones viven en memoria.** Al detener el backend se pierden
las ejecuciones de flujo, las tareas lanzadas, la actividad generada y las
notificaciones leídas; al arrancar de nuevo todo vuelve al estado inicial de la
demostración. Es una decisión consciente de esta primera versión (sin base de datos).

El estado inicial de la demostración (`backend/src/mocks/`) está fechado el
**6 de octubre de 2026**, y los datos que deben ser estables se generan con semillas
fijas: la misma consulta devuelve siempre el mismo resultado, así que dos vistas no
pueden mostrar cifras contradictorias.

## Limitaciones conocidas

- No hay agentes reales: los resultados son plantillas coherentes por etapa.
- No hay base de datos ni persistencia; no hay autenticación (el perfil del header es
  ficticio).
- El escenario pixel art se dibuja con un máximo de ~20 agentes por vista; no está
  pensado para cientos.
- La oficina necesita **WebGL** (PixiJS 8). Si el navegador no lo ofrece, la vista lo
  indica en pantalla en lugar de quedarse en blanco.
