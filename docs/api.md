# API REST

Base: `http://localhost:3000/api/v1` · Todas las respuestas son JSON.

> Todos los datos son **simulados y ficticios**. La API lo declara en cada respuesta
> con `meta.demo: true`.

---

## Convenciones

### Envoltura de éxito

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

Los listados añaden `total`, `page`, `pageSize` y `totalPages`, y algunos recursos
publican información extra en `meta` (por ejemplo `grid` en departamentos o `unread`
en notificaciones).

### Envoltura de error

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "El parametro \"page\" debe ser un entero entre 1 y 9007199254740991.",
    "details": { "field": "page", "min": 1 }
  },
  "meta": { "generatedAt": "...", "apiVersion": "1.0.0", "demo": true, "requestId": "..." }
}
```

| Código HTTP | `code` | Cuándo |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | Parámetro inválido o fuera de rango. `details` indica el campo. |
| 403 | `CORS_REJECTED` | El origen de la petición no está permitido. |
| 404 | `NOT_FOUND` | Recurso o ruta inexistente. |
| 409 | `CONFLICT` | Acción no válida para el estado actual (pausar dos veces, exceder el límite de ejecuciones). |
| 429 | `RATE_LIMITED` | Se superó el límite de peticiones por ventana. |
| 500 | `INTERNAL_ERROR` | Error no controlado. Nunca incluye traza ni detalles internos. |

### Cabeceras

| Cabecera | Dirección | Descripción |
| --- | --- | --- |
| `x-request-id` | respuesta | Identificador de la petición; se propaga al log. |
| `x-demo-data` | respuesta | Siempre `true`: los datos son de demostración. |
| `x-ratelimit-limit` / `x-ratelimit-remaining` | respuesta | Límite por ventana (600 peticiones/minuto por defecto). |

### Paginación y orden

Todos los listados aceptan `page` (desde 1) y `pageSize` (1-200, por defecto 25).
Los valores vacíos se ignoran: `?status=` equivale a no filtrar. `sort` acepta sólo
los valores publicados en `meta.filters.sorts` de cada recurso.

### Índice

`GET /` devuelve la lista de recursos disponibles con su descripción.

---

## Health

### `GET /health`

Estado del servicio y de la simulación.

```json
{
  "data": {
    "status": "ok",
    "service": "ai-operations-cms-backend",
    "version": "1.0.0",
    "nodeEnv": "development",
    "node": "v24.19.0",
    "demoMode": true,
    "uptimeSeconds": 42,
    "simulation": { "stepMs": 4200, "taskMs": 2600, "failureRate": 0.03, "pollIntervalMs": 1500 },
    "inMemory": { "agents": 20, "activityEvents": 27, "runs": 1, "agentTasks": 3, "timers": 1 },
    "memoryUsageMb": 78.4
  }
}
```

## Dashboard

### `GET /dashboard`

Indicadores agregados de toda la operación.

- `kpis`: agentes, flujos, productos, campañas, leads, conversiones e ingreso simulado.
- `operationHealth`: puntuación 0-100, etiqueta y lista de `signals` con enlace a la
  sección donde se puede comprobar cada señal.
- `charts`: series de leads e ingresos (14 días), carga por departamento, ranking de
  campañas y embudo de leads.
- `recentActivity` y `latestTasks`: actividad y últimas tareas (de agente y de etapa).
- `demo.simulation`: parámetros vigentes.

## Agentes

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/agents` | Listado. Filtros: `departmentId`, `status`, `search`, `sort` (`name`,`level`,`status`,`tasks`). |
| GET | `/agents/summary` | Recuento por estado (alimenta el header y el sidebar). |
| GET | `/agents/search?q=&limit=` | Búsqueda rápida por nombre, rol o especialidad. |
| GET | `/agents/tasks` | Tareas ejecutadas. Filtros: `agentId`, `status`. |
| GET | `/agents/tasks/:taskId` | Estado de una tarea concreta (polling). |
| GET | `/agents/:id` | Ficha completa: departamento, avatar, capacidades, tarea actual, resultado reciente. |
| POST | `/agents/:id/run` | **202** Lanza una tarea simulada. |

Cuerpo de `POST /agents/:id/run` (todos los campos opcionales):

```json
{ "title": "Programar la semana 42", "stageKey": "content-generation", "forceFailure": false }
```

Devuelve la tarea en estado `running`; su avance se consulta con
`GET /agents/tasks/:taskId` hasta que pasa a `completed` o `error`:

```json
{
  "data": {
    "id": "tsk-1001",
    "agentId": "agt-008",
    "title": "Programar la semana 42",
    "status": "running",
    "progress": 0.35,
    "startedAt": "...",
    "etaMs": 2600,
    "result": null,
    "error": null
  }
}
```

Al terminar, `result` incluye `summary`, `metrics` y `artifacts` (referencias
enlazables a producto, oferta, campaña...), y el agente pasa a `completed` con ese
resultado en su historial.

## Departamentos

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/departments` | Los 8 departamentos con su carga de trabajo, su responsable y la posición de su sala. La rejilla del escenario llega en `meta.grid`. |
| GET | `/departments/:id` | Un departamento con su plantilla. |

## Flujos

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/workflows` | Los 4 flujos disponibles. |
| GET | `/workflows/stages` | Catálogo de las **17 etapas** con agentes, entradas, entregables y resultado previsto. |
| GET | `/workflows/runs` | Ejecuciones guardadas. Filtros: `workflowId`, `status`. |
| GET | `/workflows/runs/:runId` | Estado completo de una ejecución (**polling**). |
| POST | `/workflows/runs/:runId/pause` | Pausa (409 si no está en curso). |
| POST | `/workflows/runs/:runId/resume` | Reanuda; tras un fallo **reintenta la etapa fallida**. 409 si la ejecución espera una decisión. |
| POST | `/workflows/runs/:runId/reset` | Devuelve la ejecución a su estado inicial y la relanza (las puertas vuelven a cerrarse). |
| POST | `/workflows/runs/:runId/approve` | Aprueba la puerta abierta: el flujo continúa. 409 si no hay ninguna. |
| POST | `/workflows/runs/:runId/reject` | Rechaza la puerta (cuerpo opcional `{ "reason": "..." }`, mínimo 3 caracteres): el ciclo se detiene. Si la ejecución venía de una oportunidad, **se descarta con ese motivo**. |
| GET | `/workflows/:id` | Un flujo con sus etapas expandidas. |
| POST | `/workflows/:id/run` | **202** Crea una ejecución y responde con su `runId`. |

Objeto de ejecución (`data` de `GET /workflows/runs/:runId`):

```json
{
  "runId": "run-…",
  "workflowId": "wf-full-cycle",
  "workflowName": "Ciclo completo: oportunidad a aprendizaje",
  "status": "running",
  "currentStageKey": "landing-page",
  "stepMs": 4200,
  "stages": [
    {
      "key": "research",
      "order": 2,
      "name": "Research",
      "dependsOn": ["opportunity"],
      "department": { "id": "research-lab", "name": "Research Lab", "accent": "cyan" },
      "agents": [{ "id": "agt-002", "name": "SCOUT", "status": "working" }],
      "status": "completed",
      "progress": 1,
      "durationMs": 4210,
      "result": { "summary": "...", "metrics": [{ "label": "TAM estimado", "value": "148 M EUR" }], "artifacts": [] },
      "error": null
    }
  ],
  "events": [{ "id": "rev-0003", "at": "...", "type": "stage_completed", "message": "...", "stageKey": "research" }],
  "summary": {
    "totalStages": 17, "completed": 4, "failed": 0, "running": 1, "pending": 12,
    "progress": 0.24, "elapsedMs": 21000, "estimatedRemainingMs": 54600
  }
}
```

Estados de etapa: `pending`, `running`, `completed`, `failed`, `skipped` (no se ejecutó
porque el ciclo se detuvo) y `blocked` (esperando una decisión).
Estados de ejecución: `running`, `paused`, `awaiting_approval`, `completed`, `failed` y
`rejected` (el operador detuvo el ciclo en una puerta).

### Puertas de decisión

Tres etapas del catálogo llevan una puerta declarada, y el flujo **se detiene** al
llegar a ellas:

| Etapa | Tipo | Qué pregunta |
| --- | --- | --- |
| `product-validation` | `kill` | ¿Seguimos adelante con esta oportunidad? (el punto más barato para descartarla) |
| `campaign-setup` | `launch` | ¿Publicamos la campaña? |
| `audience-budget` | `budget` | ¿Autorizas el reparto de presupuesto? |

Al abrirse una puerta, la ejecución queda así:

```json
{
  "status": "awaiting_approval",
  "gate": {
    "stageKey": "product-validation",
    "stageName": "Product Validation",
    "kind": "kill",
    "question": "La validacion ha terminado. ¿Seguimos adelante con esta oportunidad?",
    "detail": "Todavia no se ha comprometido presupuesto ni produccion...",
    "approveLabel": "Seguir adelante",
    "rejectLabel": "Descartar oportunidad",
    "openedAt": "2026-10-15T20:44:00.000Z",
    "preview": null
  },
  "summary": { "completed": 3, "blocked": 1, "skipped": 0 }
}
```

- **Aprobar** (`approve`) añade la etapa a `approvedGates`, cierra la puerta y reanuda el
  flujo. La ejecución no vuelve a detenerse en esa etapa.
- **Rechazar** (`reject`) termina la ejecución con estado `rejected`: la etapa de la
  puerta y todas las pendientes pasan a `skipped` (el trabajo ya hecho se conserva), y el
  motivo queda en `rejection`. Si la ejecución venía de una oportunidad, la respuesta
  añade `discardedOpportunityId` y **la oportunidad se descarta con ese motivo**.
- Detenerse a propósito **no es un fallo**: `summary.failed` sigue en 0.
- Reiniciar la ejecución vuelve a cerrar todas las puertas.
- Con `SIMULATION_GATES=off` el flujo recorre el ciclo del tirón (demostraciones
  desatendidas).

## Productos y ofertas

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/products` | Filtros: `status`, `category`, `search`, `sort` (`revenue`,`score`,`margin`,`name`,`updated`). |
| GET | `/products/highlights` | Tres productos y tres ofertas activas. |
| GET | `/products/:id` | Detalle: validación, investigación de origen, oferta, campañas, landings, leads y línea temporal. |
| GET | `/offers` | Filtros: `status`, `productId`, `search`. |
| GET | `/offers/:id` | Detalle: niveles, campañas, landings e ingresos. |

## Campañas

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/campaigns` | Filtros: `status`, `channel`, `search`, `sort`. Cada campaña trae métricas derivadas (CTR, CPC, CPL, CPA, ROAS) y su ritmo de presupuesto. |
| GET | `/campaigns/summary` | Totales, atribución por canal, ranking y reparto por estado. |
| GET | `/campaigns/:id` | Detalle: creatividades, landing, agentes y muestra de leads. |

## Leads

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/leads` | Filtros: `status`, `origin`, `priority`, `campaignId`, `offerId`, `minScore`, `search`, `sort`. |
| GET | `/leads/summary` | Embudo, origen, prioridad y mejores oportunidades abiertas. |
| GET | `/leads/:id` | Detalle con la traza completa (`timeline`) y el agente responsable. |

## Contenido y creatividades

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/content` | Filtros: `type`, `status`, `channel`, `search`, `sort`. |
| GET | `/content/summary` | Totales, reparto por tipo y mejores piezas. |
| GET | `/content/:id` | Una pieza con su rendimiento. |
| GET | `/creatives` | Filtros: `format`, `status`, `campaignId`, `search`, `sort`. |
| GET | `/creatives/:id` | Una creatividad con autor, revisor y rendimiento. |

## Landing pages

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/landing-pages` | Filtros: `status`, `template`, `search`, `sort` (`visitors`,`conversionRate`,`seo`,`recent`,`title`). |
| GET | `/landing-pages/summary` | Totales, experimentos y salud técnica. |
| GET | `/landing-pages/:id` | Detalle: variantes A/B, campañas, experimento y leads. |

## Investigación

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/research` | Filtros: `type` (`market`,`trends`,`competitors`,`validation`), `status`, `productId`, `search`. Cada informe declara su `origin`: `demo` o `run`. |
| GET | `/research/summary` | Totales (incluye cuántos son `generated`), reparto por tipo y productos pendientes de decisión. |
| GET | `/research/:id` | Detalle: hallazgos, fuentes, competidores, series y —en los generados— **la procedencia completa de cada señal** (`signals`). |

Los informes con `origin: "run"` los crea la **etapa Research** de un flujo atado a una
oportunidad: consulta las fuentes (`conductResearch`) y registra el informe con sus
métricas, hallazgos, fuentes y `limitations`. Su identificador empieza por `rsc-1` para no
confundirlo con los de la demo (`rsc-000X`).

## Estudio de oportunidad y fuentes de datos

El primer paso del intake: convertir señales de mercado en candidatas puntuadas. Cada
dato viaja con **su fuente, su fecha y su confianza**; los datos de demostración van
marcados como `simulated`, de modo que es imposible confundirlos con datos reales.

### `GET /sources`

Estado real de cada fuente: capacidades, si está configurada y, cuando no lo está, qué
falta y cómo conseguirlo.

```json
{
  "data": {
    "mode": "auto",
    "sources": [
      {
        "id": "google-trends",
        "name": "Google Trends",
        "kind": "public",
        "capabilities": ["demand", "momentum"],
        "requiresCredentials": false,
        "available": true,
        "mode": "live",
        "limitations": "Endpoints publicos no documentados. Google limita las IP de servidor (429)..."
      },
      {
        "id": "aliexpress",
        "name": "AliExpress",
        "requiresCredentials": true,
        "available": false,
        "mode": "live",
        "unavailableReason": "Faltan ALIEXPRESS_APP_KEY y ALIEXPRESS_APP_SECRET.",
        "setupHint": "Crea una aplicacion en la Open Platform de AliExpress..."
      }
    ]
  }
}
```

### `POST /intake/scan`

Ejecuta un estudio. Consulta fuentes externas, así que es una operación supervisada.

```json
{
  "keywords": ["teclado mecanico", "soporte de monitor"],
  "mode": "auto",
  "geo": "ES",
  "timeframe": "today 12-m",
  "constraints": {
    "minMargin": 0.25,
    "maxCost": 80,
    "maxCompetition": 500,
    "expectedSalePrice": { "teclado mecanico": 109 }
  }
}
```

| Campo | Notas |
| --- | --- |
| `keywords` | 1 a 8 términos; se deduplican. |
| `mode` | `auto` (solo fuentes reales, **sin relleno**), `live` (igual) o `simulated` (datos de demostración, solo si se piden). |
| `constraints.minMargin` | Proporción 0-1. |
| `constraints.expectedSalePrice` | Número o mapa por término. Es la forma de calcular margen cuando ninguna fuente aporta el precio de venta de tu mercado. |

Respuesta (recortada):

```json
{
  "data": {
    "mode": "simulated",
    "collectedAt": "2026-10-15T19:58:00.000Z",
    "candidates": [
      {
        "keyword": "teclado mecanico",
        "score": 73,
        "coverage": 1,
        "confidence": 0.18,
        "verdict": "cumple",
        "components": [
          {
            "metric": "demand",
            "metricLabel": "Demanda",
            "value": 81,
            "unit": "indice 0-100",
            "normalized": 0.81,
            "weight": 0.3,
            "confidence": 0.2,
            "source": { "id": "simulated", "name": "Datos de demostracion", "mode": "simulated" },
            "collectedAt": "2026-10-15T19:58:00.000Z",
            "evidence": { "note": "Valores tomados del producto \"Teclado mecanico Aurora 75%\"..." }
          }
        ],
        "missing": [],
        "economics": { "cost": 48, "marketPrice": 109, "margin": 0.56, "marginAssumed": false },
        "checks": [{ "constraint": "minMargin", "passed": true, "detail": "Margen 56.0% frente al minimo 25%." }]
      }
    ],
    "sources": [{ "id": "google-trends", "mode": "live", "signals": 0 }],
    "notes": [
      { "level": "info", "message": "Trends resuelve \"teclado mecanico\" a 5 temas, sin coincidencia exacta de nombre.", "topics": [] },
      { "level": "warning", "message": "Sin serie de interes para \"teclado mecanico\": La fuente respondio 429." }
    ]
  }
}
```

**Cómo leer el resultado**

- `score` es la puntuación ponderada de las métricas **disponibles**; `coverage` dice
  qué proporción del total se pudo usar. Un 80 con `coverage: 0.35` vale mucho menos
  que un 80 con `coverage: 1`, y por eso ambos campos van juntos.
- `missing` enumera lo que falta y por qué. Si no hay coste, no hay margen: el campo
  queda `null` en lugar de rellenarse con una estimación.
- `confidence` es la media de la confianza de los datos usados (0.2 en modo demo,
  hasta ~0.65 con fuentes reales).
- `evidence.source` y `evidence.note` explican de dónde sale cada cifra.
- `notes` documenta lo que **no** se pudo obtener: la ausencia de un dato también es
  información para quien decide.

### `GET /intake/discover`

Términos que están subiendo ahora mismo (feed de tendencias de Google Trends).

```json
{
  "data": {
    "geo": "ES",
    "collectedAt": "2026-10-15T20:20:00.000Z",
    "source": { "id": "google-trends", "name": "Google Trends", "kind": "public", "mode": "live" },
    "terms": [
      { "title": "silla ergonomica", "traffic": "2.000+", "trafficValue": 2000, "newsSource": "Diario", "newsTitles": ["..."] }
    ],
    "caveat": "El feed de tendencias del dia recoge lo que sube hoy: su contenido es de actualidad, no de demanda comercial...",
    "error": null
  }
}
```

Si el feed no responde, la respuesta sigue siendo 200 con `terms: []` y `error` relleno: es
un aviso, no un fallo del estudio. Parámetros: `geo` (dos letras), `limit` (1-25).

## Cola de oportunidades

Lo que Yanca registra, con su evidencia y la decisión del operador.

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/opportunities` | Cola ordenada por puntuación. Filtros: `status`, `origin`, `minScore`, `search`, `sort` (`score`,`recent`,`coverage`,`keyword`,`status`). |
| GET | `/opportunities/summary` | Totales por estado, puntuación media, reparto por cobertura y últimas decisiones. |
| GET | `/opportunities/:id` | Detalle: componentes con su fuente, datos ausentes, comprobaciones e historial de estudios. |
| POST | `/opportunities/:id/product` | Aclara **qué producto es** sin aprobar (`productId`, `productName` o `asCategory`). Es el paso previo del filtro. |
| POST | `/opportunities/:id/approve` | Aprueba (cuerpo opcional `{ "reason": "...", "productId": ..., "productName": ..., "asCategory": ... }`). **No se puede aprobar sin producto resuelto:** si solo se reconoció una categoría, responde 409 con la situación. |
| POST | `/opportunities/:id/discard` | Descarta, guardando el motivo. |
| POST | `/opportunities/:id/run` | **202** Lanza el flujo atado a la oportunidad (cuerpo opcional `{ "workflowId": "..." }`). **Solo funciona si está aprobada**: si no, responde 409 con su estado. |

### Producto de la oportunidad

Aprobar una oportunidad sin saber **qué producto es** no es una decisión. Por eso cada
oportunidad lleva su hipótesis de producto:

```json
{
  "productHypothesis": {
    "status": "proposed",
    "productId": "prd-002",
    "name": "Teclado mecanico Aurora 75%",
    "basis": "categoria",
    "confidence": "baja",
    "note": "«perifericos gamer» es una categoria (Perifericos) con 2 producto(s) en el catalogo. El propuesto es solo un ejemplo: confirma cual quieres antes de aprobar."
  }
}
```

| Campo | Significado |
| --- | --- |
| `status` | `proposed` (lo propone el sistema), `confirmed` (lo ha decidido el operador), `category` (se aprueba la categoría a propósito) o `none`. |
| `basis` | En qué se basa: `nombre del catalogo`, `palabras en comun`, `categoria` u `operador`. |
| `confidence` | `alta` solo cuando hay un producto concreto identificado. Con `baja` el producto es un ejemplo de la categoría. |

**Reglas**

- Con `confidence: "baja"` o `status: "none"`, `approve` responde **409** con
  `details.field = "productHypothesis"` y `details.situation` explicando el caso. Hay que
  indicar el producto (`productId`/`productName`) o aprobar la categoría (`asCategory: true`).
- El enlace con el catálogo (`catalogLink`) **solo** se crea con confianza alta o con un
  producto confirmado por el operador: si el sistema solo reconoció una categoría, no se
  enlaza la cadena comercial de un producto que nadie ha elegido (el flujo producirá
  artefactos derivados).
- Un estudio posterior **no pisa** un producto ya confirmado por el operador.

### Ejecuciones ligadas a una oportunidad

Una ejecución puede nacer de una oportunidad aprobada, y entonces **cambia lo que
produce**:

- `POST /opportunities/:id/run` — la lanza y devuelve la ejecución.
- `POST /workflows/:id/run` con `{ "opportunityId": "opp-0004" }` — lo mismo desde el flujo.
- `POST /workflows/:id/run` **sin** cuerpo — demostración pura, sin cambios.

La ejecución pasa a llevar contexto:

```json
{
  "runId": "run-...",
  "workflowId": "wf-full-cycle",
  "context": {
    "opportunityId": "opp-0004",
    "keyword": "grapadora de sobremesa",
    "slug": "grapadora-de-sobremesa",
    "catalogLink": null
  },
  "stages": [
    {
      "key": "opportunity",
      "result": {
        "summary": "Oportunidad «grapadora de sobremesa» registrada y priorizada para investigacion.",
        "metrics": [
          { "label": "Puntuacion", "value": "48" },
          { "label": "Cobertura del estudio", "value": "95.0%" },
          { "label": "Margen estimado", "value": "21.0%" }
        ],
        "artifacts": [{ "type": "opportunity", "id": "opp-0004", "label": "grapadora de sobremesa", "derived": false }]
      }
    },
    {
      "key": "research",
      "result": {
        "summary": "Informe de mercado de «grapadora de sobremesa» a partir de datos de demostracion.",
        "metrics": [{ "label": "Demanda", "value": "46" }, { "label": "Competencia (ofertas)", "value": "35" }],
        "artifacts": [{ "type": "research", "id": "opp-0004:research", "label": "Informe de mercado: grapadora de sobremesa", "derived": true }]
      }
    }
  ]
}
```

**Cómo leer los artefactos**

| `derived` | Significado |
| --- | --- |
| `false` | El artefacto **existe**: es la propia oportunidad o un registro del catálogo (`prd-001`, `off-0001`, `lp-0001`, `cmp-0001`) cuando el término corresponde a un producto que ya está en el catálogo. |
| `true` | Es una **propuesta** construida desde el estudio de esa oportunidad. No está en el catálogo y la interfaz lo muestra como propuesto, no como registro. |

Las métricas de cada etapa salen del **estudio registrado de esa oportunidad**, y lo que
no se sabe se declara: si el estudio no trajo precio de mercado, la etapa de análisis
competitivo devuelve `Precio de mercado = sin dato` en lugar de un número.

Sin contexto, la ejecución recorre el caso previsto de la plantilla (`rsc-0001`,
`prd-001`, `off-0001`...), que es el comportamiento de demostración.

### Objeto de oportunidad

```json
{
  "id": "opp-0004",
  "keyword": "perforadora de escritorio",
  "status": "approved",
  "origin": "estudio",
  "revision": 1,
  "studyCount": 1,
  "firstSeenAt": "...",
  "lastScanAt": "...",
  "decidedAt": "...",
  "decidedBy": "operadora de demostracion",
  "decisionReason": "Margen por encima del minimo y poca competencia.",
  "latest": {
    "score": 69,
    "coverage": 1,
    "verdict": "cumple",
    "economics": { "cost": 87.3, "marketPrice": 214, "margin": 0.59, "marginAssumed": false },
    "components": [
      {
        "metric": "demand",
        "metricLabel": "Demanda",
        "value": 62,
        "unit": "indice 0-100",
        "normalized": 0.62,
        "weight": 0.3,
        "confidence": 0.2,
        "source": { "id": "simulated", "name": "Datos de demostracion", "mode": "simulated" },
        "collectedAt": "...",
        "evidence": { "note": "Valores tomados del producto ..." }
      }
    ],
    "missing": [],
    "checks": [{ "constraint": "minMargin", "passed": true, "detail": "Margen 59.5% frente al minimo 30%." }],
    "sourceMode": "auto",
    "geo": "ES"
  },
  "revisions": [{ "revision": 1, "at": "...", "score": 69, "coverage": 1, "verdict": "cumple", "margin": 0.59 }]
}
```

**Reglas de la cola**

- Cada oportunidad guarda **su último estudio** y el **historial de revisiones**: se ve
  cómo cambia la valoración entre estudios.
- Volver a estudiar una oportunidad **sube la revisión pero no reescribe la decisión**:
  si la descartaste, sigue descartada. Un estudio no resucita nada en silencio.
- Los datos de demostración van siempre con `source.mode: "simulated"`, así que se
  distinguen de un dato real de un vistazo.

## Analítica

### `GET /analytics?range=7|14|30`

Agrega embudo, atribución por canal, evolución temporal (ingreso/gasto y leads),
rankings de producto y campaña, experimentos A/B, carga de agentes e `insights`
derivados de los propios datos.

## Actividad y notificaciones

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/activity` | Filtros: `type`, `severity`, `agentId`, `departmentId`, `search`. |
| GET | `/activity/types` | Tipos de evento disponibles (para el filtro). |
| GET | `/notifications` | Parámetros: `unreadOnly`, `limit`. `meta.unread` trae el contador. |
| POST | `/notifications/:id/read` | Marca una como leída. |
| POST | `/notifications/read-all` | Marca todas como leídas. |

## Configuración

### `GET /settings`

Workspace, perfil ficticio, parámetros de simulación, política de datos,
integraciones (**todas** `disabled` o `simulated`), banderas de funcionalidad y
estado de ejecución (`runtime`).

---

## Ejemplos

```powershell
# Arrancar un flujo completo y seguirlo
$run = Invoke-RestMethod -Method Post http://localhost:3000/api/v1/workflows/wf-full-cycle/run
$run.data.runId

Invoke-RestMethod "http://localhost:3000/api/v1/workflows/runs/$($run.data.runId)" |
  Select-Object -ExpandProperty data |
  Select-Object status, currentStageKey, @{n='progreso';e={$_.summary.progress}}

# Pausar, reanudar y reiniciar
Invoke-RestMethod -Method Post "http://localhost:3000/api/v1/workflows/runs/$($run.data.runId)/pause"
Invoke-RestMethod -Method Post "http://localhost:3000/api/v1/workflows/runs/$($run.data.runId)/resume"
Invoke-RestMethod -Method Post "http://localhost:3000/api/v1/workflows/runs/$($run.data.runId)/reset"

# Ejecutar una tarea sobre un agente y consultarla
$task = Invoke-RestMethod -Method Post http://localhost:3000/api/v1/agents/agt-008/run `
  -ContentType 'application/json' -Body '{"title":"Programar la semana 42"}'
Invoke-RestMethod "http://localhost:3000/api/v1/agents/tasks/$($task.data.id)"
```

```bash
# Con curl
curl -s http://localhost:3000/api/v1/health | jq .data.status
curl -s -X POST http://localhost:3000/api/v1/workflows/wf-market-research/run | jq .data.runId
curl -s "http://localhost:3000/api/v1/leads?status=qualified&sort=value&pageSize=5" | jq '.meta.total'
```
