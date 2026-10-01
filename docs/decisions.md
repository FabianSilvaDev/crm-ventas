# Architecture Decision Records

Formato: **Contexto · Decisión · Consecuencias · Alternativas descartadas**.
Un ADR se marca `SUPERSEDED` cuando cambia; no se borra.

---

## ADR-001 — Monolito modular con worker separado

**Estado:** aceptado

**Contexto.** El sistema tiene un dominio fuertemente acoplado (un lead, una campaña, una
orden y una atribución se consultan juntos constantemente) y un volumen de trabajo
mayoritariamente de I/O. También tiene cargas de ejecución muy distintas: peticiones HTTP
cortas y procesos largos (scraping, inferencia, generación de contenido) que deben sobrevivir
a reinicios y no bloquear requests. Se evaluó separar en microservicios por módulo.

**Decisión.** Un solo despliegue `apps/api` (HTTP) y un solo despliegue `apps/worker`
(consumidores BullMQ), compartiendo `packages/*`. Fronteras de módulo estrictas dentro de
`api`: cada módulo expone una fachada pública y no accede a las tablas de otro módulo
directamente. Fronteras reforzadas con ESLint, no con disciplina.

**Consecuencias.**
- (+) Un despliegue, un modelo mental, transacciones ACID entre módulos, sin consistencia distribuida.
- (+) La separación api/worker resuelve el 90% del problema real (perfil de ejecución) con 0% del coste operativo de los microservicios.
- (+) Las fronteras de módulo existentes son exactamente donde se insertarían eventos si algún día un módulo se extrae a servicio.
- (−) El worker escala junto con el api hasta que se separan los hosts (Hito 5, Nivel 2 de §L).
- (−) Requiere disciplina de fronteras; mitigado con lint.

**Alternativas descartadas.**
- *Microservicios por módulo*: latencia, trazabilidad distribuida, consistencia eventual y orquestación para un desarrollador. Resuelve un problema de escala organizativa que no existe.
- *Monolito sin worker*: los procesos largos no se pueden ejecutar en una request HTTP de forma fiable (timeouts, reinicios, concurrencia).
- *Serverless por función*: el modelo de datos es relacional y transaccional; las colas y los timeouts de funciones complican sin beneficio.

---

## ADR-002 — Dos frontends Angular · pnpm workspaces

**Estado:** aceptado

**Contexto.** El prompt pide evaluar SSR: "no quiero descubrir después que Google no puede
interpretar correctamente las páginas". Pero la mayor parte de la aplicación es un CRM interno
detrás de autenticación, que no debe indexarse. Y se pide evaluar Nx / Turborepo / pnpm.

**Decisión.**
1. **Dos aplicaciones:** `apps/web` (CRM, SPA pura, `noindex`, detrás de auth) y `apps/site` (público, SSR + prerender, indexable). Comparten `packages/ui` y `packages/contracts`, no shell ni layout.
2. **pnpm workspaces** como único gestor del monorepo. Sin Nx, sin Turborepo.

**Consecuencias.**
- (+) El sitio público se optimiza para SEO sin arrastrar la complejidad del CRM al servidor de render.
- (+) El CRM no expone datos de usuario a renderizado en servidor ni a riesgo de caché cruzada entre sesiones.
- (+) Un solo lockfile, resolución estricta de dependencias (pnpm no hace hoisting plano → imports no declarados fallan en vez de funcionar por accidente).
- (−) Dos builds y dos deploys de frontend.
- (−) Duplicación de configuración de build entre ambos; mitigado por `packages/config`.

**Alternativas descartadas.**
- *SSR en toda la aplicación*: render en servidor de vistas autenticadas, superficie de ataque mayor, un proceso Node más, y ningún beneficio SEO porque `/app` está bloqueado en `robots.txt`.
- *Un frontend con SSR condicional por ruta*: SSR y SPA en la misma app crea dos modos de ejecución con distintas reglas de datos y de caché. Es la fuente clásica de "funciona en dev y falla en prod".
- *Nx*: su valor (affected graph, caché remota, generadores) aparece con 10+ desarrolladores y cientos de proyectos. Aquí son 8 paquetes y 1-2 desarrolladores. Coste: concepto de configuración adicional y acoplamiento a su ecosistema. Reevaluar si los builds pasan de 10 min.
- *Turborepo*: alternativa razonable, pero sin necesidad real todavía. Migrar desde pnpm workspaces es añadir un archivo, no reescribir.
- *Next.js/Remix para el público*: introduciría un segundo framework de frontend en un proyecto donde Angular ya está decidido. Dos frameworks, dos modelos mentales, un desarrollador.

---

## ADR-003 — NestJS como backend único

**Estado:** aceptado

**Contexto.** El prompt pide comparar Node/NestJS contra Python/FastAPI considerando IA,
scraping, APIs, background jobs, agentes, performance, escalabilidad y mantenimiento.
Entorno verificado: Node 24 instalado; Python 3.14 (demasiado nuevo para muchas librerías) sin
`python` en PATH.

**Decisión.** NestJS (Node.js) como backend único. Python entra solo si aparece una necesidad
real, como **servicio acotado** invocado por el worker (HTTP o CLI), nunca como backend
principal.

**Consecuencias.**
- (+) Contratos TypeScript compartidos entre frontend, backend y agentes: `Zod schema → OpenAPI → cliente Angular`. Elimina una clase entera de bugs de integración.
- (+) Un lenguaje, un toolchain, un CI, un modelo mental. Con un desarrollador esto vale más que cualquier ventaja marginal de rendimiento.
- (+) BullMQ es maduro y encaja con la arquitectura de colas.
- (+) Los SDKs de todos los proveedores de LLM relevantes existen en TypeScript.
- (−) El ecosistema de cómputo numérico/estadístico es inferior al de Python. Aceptado: la inferencia la hace Ollama o una API, no nosotros.
- (−) El scraping con Playwright/Crawlee es algo menos ergonómico que BeautifulSoup. Aceptado por la estrategia API-first (ADR-004).

**Alternativas descartadas.**
- *FastAPI*: excelente framework, pero con un solo desarrollador obliga a mantener dos lenguajes, dos gestores de dependencias, dos pipelines y un puente de tipos entre frontend y backend. El beneficio no se materializa porque el cómputo pesado lo delega igualmente a un runtime de inferencia.
- *Backend dividido (Node + Python)*: duplica la superficie operativa desde el día 1 para un beneficio hipotético. Si más adelante hace falta, ADR-003 ya contempla el servicio acotado.
- *Express/Fastify sin framework*: menos estructura y menos opiniones, pero también menos guards, interceptores, DI y validación ya resueltos. Se adopta NestJS con adaptador Fastify para no pagar el coste de Express.

> **Nota (2026-10-01) — el adaptador instalado es Express, no Fastify.** `apps/api` declara
> `@nestjs/platform-express` 12.1.2 y **no** hay Fastify entre las dependencias. La frase «se adopta
> NestJS con adaptador Fastify» describe una intención que el código no siguió, y la divergencia ya
> tuvo un coste concreto: NestJS 12 monta **Express 5** (path-to-regexp 8), donde `forRoutes('*')`
> dejó de ser válido y obligó a reescribir el middleware de `traceId`
> (`apps/api/src/common/trace-id.middleware.ts`).
>
> No se cambia el adaptador por iniciativa propia: migrar a Fastify ahora significaría revisar la
> firma del middleware, el `rawBody` del webhook y los guards, a cambio de rendimiento que no es el
> cuello de botella (el volumen del MVP no lo justifica, y §48/ADR-004 ya dicen que el coste real
> está en las llamadas externas). **Queda como decisión abierta del usuario**: o se adopta Fastify de
> verdad, o esta línea se corrige para decir Express. Lo que no puede quedarse es como está —una
> documentación que describe un adaptador que no existe hace perder tiempo a quien la lea.

---

## ADR-004 — Conectores API-first con registro de compliance

**Estado:** aceptado

**Contexto.** El prompt pide recopilar datos de MercadoLibre, Amazon, AliExpress, Google
Trends, tiendas online y redes sociales, y pide explícitamente no hacer scraping
irresponsable. Es el área de mayor riesgo legal y de mayor fragilidad técnica del sistema.

**Decisión.** Toda fuente externa se implementa detrás de `MarketplaceConnector`, y **ninguna
fuente se implementa sin pasar antes por una ficha de compliance** que se registra en
`connectors_registry`:

```
marketplace, base_url, método (API_OFICIAL | API_PARTNER | FEED | SCRAPING_PERMITIDO | NO_PERMITIDO),
robots_txt_revision (fecha, resultado), tos_revision (fecha, conclusión),
rate_limit_documentado, autenticación, coste, restricciones_de_uso,
riesgo_legal (BAJO|MEDIO|ALTO), riesgo_de_bloqueo, fallback, aprobado_por, aprobado_en
```

Regla dura: sin ficha aprobada, el conector **no se activa** (el registry lo rechaza en
runtime, no solo en revisión).

**Evaluación inicial de las fuentes mencionadas:**

| Fuente | Vía recomendada | Realidad |
|---|---|---|
| MercadoLibre | **API oficial** (`api.mercadolibre.com`) | Requiere registrar aplicación y OAuth. Prioridad 1 del MVP |
| Amazon | **PA-API oficial** | Requiere cuenta de Associates con ventas cualificadas. **Bloqueante hoy** — no prometer en el MVP |
| AliExpress | API de afiliados oficial | Requiere alta en el programa de afiliación |
| Google Trends | **Sin API oficial.** Alternativa: proveedor de datos de pago (SerpAPI/DataForSEO) o `pytrends` (no oficial, frágil y con riesgo de bloqueo) | En el MVP: no implementar. Usar señales indirectas o carga manual |
| Tiendas online | RSS/feeds públicos, sitemaps, APIs propias | Caso por caso; el usuario introduce la URL → validación SSRF obligatoria |
| Redes sociales | APIs oficiales de plataforma | Límites muy restrictivos; en el MVP no aporta al ciclo |

**Consecuencias.**
- (+) Un conector nuevo es una clase + una ficha; no toca el dominio.
- (+) El riesgo legal queda explícito y auditado en vez de implícito en el código.
- (+) La caída de una fuente no rompe el sistema (circuit breaker + caché + degradación).
- (−) Menos fuentes disponibles al inicio de lo que el prompt sugiere. **Es la realidad, no una limitación de diseño**: Amazon PA-API y Trends simplemente no están disponibles de forma legítima e inmediata.
- (−) El pipeline de investigación debe funcionar aceptablemente **con una sola fuente** (MercadoLibre) en el MVP.

**Alternativas descartadas.**
- *Scraping directo de todos los marketplaces*: viola términos de servicio de la mayoría, genera riesgo de bloqueo de IP y de acciones legales, y es frágil (cualquier cambio de HTML rompe el sistema). Descartado por decisión del propio prompt.
- *Comprar un dataset de productos*: gasto sin validación del ciclo. Se reconsidera cuando el ROI sea demostrable.
- *Solo carga manual de productos*: elimina el riesgo y también el valor del módulo de investigación. Se usa como **fallback** del conector, no como estrategia.

---

## ADR-005 — Human-in-the-loop como propiedad del sistema, no como instrucción

**Estado:** aceptado

**Contexto.** El prompt exige aprobación humana obligatoria en el MVP para acciones sensibles
(§36) y prohíbe a la IA publicar campañas, gastar, borrar y acceder a la DB (§48). Un prompt
de sistema que diga "no publiques campañas" es una sugerencia: un modelo puede ignorarla, y un
cambio de modelo puede alterar el comportamiento. La seguridad no puede depender de la
obediencia del modelo.

**Decisión.** La aprobación es una propiedad declarada de cada tool y aplicada por el
`ToolRegistry`, no una regla de prompt:

```ts
{ name: 'publishCampaign', permission: 'PUBLISH_CAMPAIGN',
  requiresApproval: true, sideEffects: 'external', ... }
```

Cuando el registry ve `requiresApproval: true`, **no ejecuta**: crea una fila en `approvals`
con la propuesta serializada y devuelve al agente `{ status: 'PENDING_APPROVAL', approvalId }`.
La ejecución real ocurre cuando un humano llama a `POST /approvals/:id/approve`, que revalida
el payload contra el schema de la tool antes de ejecutar. Además, `PUBLISH_CAMPAIGN`,
`CHANGE_BUDGET` y `DELETE_ANY` **no se conceden a ningún agente** en el MVP: aunque el modelo
decidiera intentarlo, el guard de permisos lo rechaza.

**Consecuencias.**
- (+) La garantía es de arquitectura. Cambiar de modelo, de prompt o de proveedor no la altera.
- (+) Toda propuesta queda auditada con su payload exacto: se puede reproducir y comparar la decisión humana.
- (+) Añadir automatización futura es cambiar `requiresApproval` a `false` en tools concretas, con guardrails en la capa de validación.
- (−) Toda tool sensible necesita doble camino (propuesta / ejecución). Coste de ~1 archivo por tool.
- (−) Un humano debe estar disponible para que las acciones sensibles ocurran. Es exactamente lo buscado en el MVP.

**Alternativas descartadas.**
- *Instrucciones en el system prompt*: no verificable, no auditable, y frágil ante cambios de modelo.
- *"Modo seguro" global con flag*: un flag global no distingue entre una tool de lectura y una que publica. El permiso y la aprobación deben ser por tool.
- *Aprobación solo en el frontend*: una llamada directa a la API la saltaría.

---

## ADR-006 — Node-first; Python acotado si se justifica

**Estado:** aceptado

**Contexto.** `py` reporta Python 3.14.3 (lanzamiento reciente) y `python` no está en PATH.
3.14 es demasiado nuevo para muchas librerías de scraping y de datos, que suelen ir por
detrás de la versión estable anterior.

**Decisión.** Node/TypeScript como lenguaje único del proyecto. Si aparece una necesidad real
de cómputo estadístico o ML propio, se añade un servicio Python **con versión fijada a 3.12 o
3.13 en un entorno aislado**, invocado por el worker. Ver ADR-003.

**Consecuencias.**
- (+) Un solo toolchain y CI. No hay que resolver entornos de Python en Windows.
- (+) Se evita el escenario clásico de "la librería X no soporta 3.14 todavía".
- (−) Si se necesita análisis estadístico serio más adelante, hay que añadir el servicio. Aceptado y ya previsto.

**Alternativas descartadas.**
- *Python 3.14 como base*: versión demasiado reciente para el ecosistema de scraping/datos.
- *Python 3.12 desde el inicio*: viable, pero implica mantener dos lenguajes sin necesidad demostrada.

---

## ADR-007 — Routing híbrido de LLM (local para volumen, remoto para calidad)

**Estado:** aceptado

**Contexto.** Entorno verificado: **sin GPU**, CPU i7-1255U (12 hilos, ultrabook), 32 GB RAM.
Medido contra los modelos ya instalados en Ollama:

| Modelo | Tamaño | Velocidad esperada (CPU) | Veredicto |
|---|---|---|---|
| `gemma4:8b` Q4 | 9.6 GB | ~5-8 tok/s | Usable |
| `gemma4:26b` Q4 | 17 GB | ~2-3 tok/s | Solo batch nocturno |
| `qwen3.6:36b` MoE Q4 | 23 GB | ~3-5 tok/s, presión de RAM | Batch puntual |

Un artículo de blog de 1.500 palabras son ~2.000 tokens de salida: a 6 tok/s son **~5,5
minutos** por artículo en local, con la CPU saturada. Y la calidad de copy en español de un 8B
frente a un modelo frontera es notablemente inferior — precisamente en la parte del sistema que
genera valor comercial (el texto que ve un cliente).

**Decisión.** `LLMProvider` como abstracción, `ModelRouter` por clase de tarea, y **routing
híbrido** con esta asignación por defecto:

| Clase de tarea | Tier | Destino por defecto | Motivo |
|---|---|---|---|
| Clasificación, routing, etiquetado | 1 | `gemma4:8b` local | Volumen alto, respuesta corta, tolera latencia |
| Extracción de campos / normalización | 1 | `gemma4:8b` local | Mismo perfil |
| Embeddings | 1 | modelo de embeddings local | Volumen alto, sin necesidad de calidad generativa |
| Generación de contenido de cara al cliente | 3 | modelo remoto | Es el texto que ve el comprador |
| Estrategia, análisis, planificación | 3 | modelo remoto | Cadena de razonamiento larga |
| Resúmenes internos, borradores de trabajo | 2 | remoto barato o 26B en batch | No lo ve el cliente |

El `ModelRouter` respeta, en orden: presupuesto diario → clase de tarea → criticidad →
disponibilidad → fallback. Cada decisión se registra en `ai_runs.routing_reason`.

**Consecuencias.**
- (+) Las tareas de volumen corren gratis y sin límite de cuota en tu máquina.
- (+) La calidad donde importa se compra de forma explícita y medida.
- (+) La abstracción permite cambiar cualquier asignación sin tocar agentes.
- (−) El sistema depende de una conexión a internet para la parte de calidad. Aceptado: el ad spend y las APIs de marketplace ya la requieren.
- (−) Hay coste variable por tokens en la nube. Mitigado con `AICostTracker` desde Fase 4 (ADR y §G.5).

**Alternativas descartadas.**
- *100% local*: el hardware no lo soporta para las tareas que generan valor. Sería lento y de calidad insuficiente justo en el contenido que ve el cliente.
- *100% remoto*: tira el hardware que ya tienes y paga por tareas triviales (clasificar 500 títulos de producto no requiere un modelo frontera).
- *Ollama local primero y decidir después*: es lo que propone el prompt. El problema es que la validación de calidad llegaría en la Fase 6, después de haber construido los agentes sobre una base que no rinde. El routing se decide ahora (§T1).

---

## ADR-008 — pgvector dentro de PostgreSQL, sin base vectorial dedicada

**Estado:** aceptado

**Contexto.** El prompt pide evaluar PostgreSQL, Redis y base vectorial, y advierte
explícitamente: "no agregues una base vectorial solamente porque es IA. Justifica técnicamente
si realmente es necesaria".

**Decisión.** Usar **pgvector** en la instancia de Postgres existente. Sin Qdrant, Weaviate,
Chroma ni Pinecone.

**Justificación (los tres casos de uso reales, ninguno hipotético):**
1. **Deduplicación de productos entre marketplaces.** El mismo producto aparece con títulos distintos ("Audífonos Bluetooth TWS Pro" vs "Earbuds inalámbricos estuche carga"). Con `pg_trgm` se llega a ~70% de acierto; con embeddings, a ~90%+. Esto impacta directamente la precisión del scoring (un producto duplicado infla artificialmente las señales de demanda).
2. **RAG sobre brand context y contenido previo.** Necesario para que el `ContentAgent` mantenga consistencia de tono y no repita ángulos ya usados. Es un requisito explícito del §7.
3. **Clustering semántico de keywords** para el `SEOAgent` (§28). Sin similitud semántica, el clustering es agrupación por cadena de texto, que produce clusters malos.

Dimensiones y volumen: decenas de miles de vectores a **768 dims** (ADR-019). Postgres resuelve esto
con un índice HNSW sin despeinarse: la latencia se mide en milisegundos y el conjunto de datos
cabe holgadamente en memoria.

**Consecuencias.**
- (+) Los embeddings se unen por `JOIN` a los datos relacionales que los acompañan. En una base vectorial externa, cada búsqueda semántica requiere una consulta remota y luego un `IN (...)` contra Postgres para traer el contexto.
- (+) Un backup cubre todo. Una transacción cubre todo. Un motor que versionar y mantener: **cero** adicionales.
- (+) `pgvector` es una extensión oficial y estable, en producción en muchos sistemas.
- (−) Búsqueda vectorial aproximada algo más lenta que un motor dedicado a gran escala. Irrelevante a esta escala.
- (−) Si en el futuro hay cientos de millones de vectores, habría que migrar. Ese escenario requiere antes un equipo, no una decisión técnica.

**Alternativas descartadas.**
- *Qdrant/Weaviate/Chroma*: añaden un servicio, un backup, un esquema y un modo de fallo adicional, para resolver un problema que ya está resuelto en el motor que ya tienes. La justificación de "rendimiento" no aplica a 10k-100k vectores.
- *Pinecone*: coste recurrente y dependencia de proveedor para un volumen que cabe en 200 MB de Postgres.
- *Sin búsqueda vectorial (solo `pg_trgm`)*: descartado porque los tres casos de uso existen y `pg_trgm` no los cubre bien.
- *Búsqueda vectorial en memoria (FAISS)*: no persiste, no se puede unir con SQL y hay que reconstruir el índice en cada arranque.

---

## ADR-009 — Outbox transaccional + BullMQ, sin bus de eventos externo

**Estado:** aceptado

**Contexto.** El prompt pide evolucionar hacia arquitectura orientada a eventos con una lista
de eventos concretos, y pide "diseñar inicialmente algo simple, pero que pueda evolucionar".

**Decisión.** Patrón **outbox transaccional** en Postgres + **BullMQ** sobre Redis como
transporte. Sin Kafka, sin RabbitMQ, sin NATS.

Funcionamiento: el servicio de dominio escribe el cambio de estado y el evento en `outbox_events`
**dentro de la misma transacción**. Un proceso del worker sondea la tabla (o usa
`LISTEN/NOTIFY`) y publica en BullMQ, marcando `DISPATCHED`. Los consumidores son idempotentes
con clave de deduplicación = `event_id`.

**Consecuencias.**
- (+) **No se pierden eventos**: el evento es parte del cambio de estado, no un efecto posterior. Si Redis cae entre el commit y el publish, el evento sigue en la tabla y se publica al recuperar.
- (+) Los consumidores son idempotentes y reintentables: BullMQ ya da reintentos con backoff.
- (+) Los eventos quedan como registro histórico consultable en SQL — útil para depurar y para alimentar el `AnalyticsAgent`.
- (+) El catálogo de eventos del §22 (`LeadCreated`, `ProductDiscovered`, `CampaignStarted`, `OrderPaid`, `BudgetThresholdReached`, ...) es simplemente el dominio del campo `type` — añadir uno es añadir un enum, no infraestructura.
- (−) Publicación con latencia de sondeo (configurable a < 1s). Aceptado: ningún caso de uso necesita tiempo real duro.
- (−) Una tabla que crece; se limpia con un job de retención.

**Alternativas descartadas.**
- *Publicar a Redis directamente desde el servicio*: si Redis falla tras el COMMIT, el evento se pierde y el sistema queda inconsistente **sin señal**. Es el bug silencioso clásico de los sistemas event-driven inmaduros.
- *Kafka*: resuelve throughput de millones de eventos, retención por tiempo, replay y múltiples consumidores independientes. Ninguno de esos problemas existe aquí. Su coste operativo (un cluster, Zookeeper/KRaft, schema registry, monitorización) es desproporcionado.
- *RabbitMQ*: mejor encaje que Kafka, pero BullMQ ya da lo necesario y Redis ya está en la pila.
- *Event sourcing completo*: obliga a modelar todo cambio como evento inmutable y a mantener proyecciones para cada lectura. Es una decisión irreversible y muy costosa en complejidad; el outbox da el beneficio de auditoría sin el coste.

---

## ADR-010 — BullMQ con scheduler embebido

**Estado:** aceptado

**Contexto.** El prompt lista `frontend, backend, postgres, redis, ollama, worker, scheduler`
como servicios potenciales y pide evaluar Redis + BullMQ u otra alternativa.

**Decisión.** BullMQ sobre Redis. El `scheduler` **no es un servicio**:
`upsertJobScheduler()` de BullMQ (jobs repetibles/cron) dentro del proceso worker. Sin `node-cron`,
sin proceso aparte, sin Celery Beat.

**Consecuencias.**
- (+) Un servicio menos que desplegar, monitorizar y reiniciar.
- (+) Los jobs programados entran por la misma cola con el mismo sistema de reintentos, timeouts, deduplicación y observabilidad que el resto.
- (+) El scheduler es *distribuido* de forma natural: si dos workers corren, el job no se duplica.
- (−) Menos control fino de calendarios que un cron dedicado. Irrelevante para las necesidades reales (sync de conectores, reconciliación de métricas, sitemap, limpiezas).

**Alternativas descartadas.**
- *Servicio scheduler separado*: añade un proceso, un Dockerfile, un healthcheck y un modo de fallo, para ejecutar `upsertJobScheduler` que ya existe.
- *`node-cron` en el proceso api*: los jobs se pierden en cada reinicio del api, no hay historial, no hay retry y compiten con el tráfico HTTP.
- *Celery Beat / Temporal*: otro ecosistema o una plataforma de workflows completa para un requisito de "ejecuta esto cada hora".

**Nota sobre concurrencia:** cada cola tiene concurrencia configurable. La cola `ai` corre con
**concurrencia 1** cuando el destino es Ollama local — en CPU, dos generaciones simultáneas no
van más rápido, van más lento (compiten por los mismos hilos y por la memoria).

---

## ADR-011 — `organization_id` y RBAC desde el día 1

**Estado:** aceptado

**Contexto.** El sistema es de uso interno y de un solo usuario. Añadir multitenencia después
exigiría migrar todas las tablas de negocio, todos los índices y todas las consultas, además de
auditar cada query para asegurar el filtrado.

**Decisión.** Toda tabla de negocio lleva `organization_id` (FK obligatoria, indexada, parte de
los índices compuestos) desde la primera migración. Existe un modelo de permisos (`Permission`
enum) y un `PermissionsGuard` desde el sprint 1, con un solo rol `OWNER`. Los agentes tienen
conjuntos de permisos explícitos, más restrictivos que los de la persona que los invoca
(`effective = agent.permissions ∩ user.permissions`).

**Consecuencias.**
- (+) Multitenencia futura sin migración masiva: es añadir filas y roles, no columnas.
- (+) El hábito de filtrar por `organization_id` en cada consulta queda establecido desde el inicio y se enforcea con un middleware de Prisma.
- (+) La autorización de agentes existe antes de que exista el primer agente: no hay ventana de exposición.
- (−) Una columna y un filtro constantes que hoy no aportan valor funcional. Coste: mínimo.

**Alternativas descartadas.**
- *Sin `organization_id`*: el coste de introducirlo después crece de forma no lineal con el número de tablas y queries.
- *Multitenencia completa ahora* (invitaciones, roles por org, panel de administración de orgs): funcionalidad que nadie usa, que se puede pagar cuando exista un segundo inquilino.

---

## ADR-012 — REST + OpenAPI + cliente generado

**Estado:** aceptado

**Contexto.** El prompt pide evaluar REST, GraphQL y tRPC y elegir el más apropiado.

**Decisión.** **REST** versionado (`/api/v1`) con **OpenAPI** generado desde esquemas **Zod**
que son la fuente única de verdad en `packages/contracts`. El cliente tipado de Angular se
genera con `openapi-typescript`. Un job de CI falla el build si el cliente generado y el
OpenAPI divergen.

**Consecuencias.**
- (+) Tipos compartidos de extremo a extremo sin acoplamiento entre frontend y backend: el contrato es el archivo OpenAPI, no el código del otro lado.
- (+) Webhooks entrantes de Meta, Google, Stripe y marketplaces son REST por definición; GraphQL no aporta nada ahí.
- (+) Caché HTTP, códigos de estado, CDN y proxy estándar funcionan sin inventar nada.
- (+) Un contrato consumible por terceros si algún día hace falta (integración, API pública interna).
- (+) El drift entre frontend y backend se detecta en CI, no en producción.
- (−) Over-fetching en algunas pantallas. Irrelevante en una red local o en un VPS con pocos usuarios.
- (−) Zod es menos ergonómico que `class-validator` dentro de NestJS; se resuelve con decoradores de Zod para DTOs.

**Alternativas descartadas.**
- *GraphQL*: introduce N+1, límites de profundidad, caché compleja, autorización por campo y persistencia de queries. Resuelve el problema de "muchos clientes con necesidades distintas de datos" — aquí hay **un** cliente. El coste es real, el beneficio hipotético.
- *tRPC*: tipos compartidos excelentes, pero acopla el cliente al servidor (sin contrato neutral), no produce artefacto consumible por terceros ni por webhooks, y complica el versionado del API.
- *Solo OpenAPI escrito a mano*: drift garantizado con el paso del tiempo. Zod como fuente hace que el contrato se derive del código que realmente valida.

---

## ADR-013 — Provenance obligatoria y puerta de economía unitaria

**Estado:** aceptado

**Contexto.** El prompt pide un scoring con ~18 métricas (demanda, tendencia, saturación
publicitaria, CPC estimado, CAC estimado, ROAS potencial...) y a la vez advierte: "NO inventes
métricas que no podamos obtener" y "marcar explícitamente como ESTIMATED". Hay una tensión real
en el requisito: muchas de esas 18 variables **no son medibles** con las fuentes disponibles en
el MVP (CPC/CAC/ROAS de un producto que nunca se ha anunciado, saturación publicitaria de un
nicho, engagement de redes que no controlas).

**Riesgo identificado.** Un score que parece preciso pero se compone mayoritariamente de valores
estimados por el propio modelo crea **falsa confianza** y lleva a invertir en productos que no
pueden ser rentables. Es peor que no tener score: al menos sin score la decisión es explícitamente humana.

**Decisión.**
1. Toda métrica en `product_metrics` lleva `provenance ∈ {REAL, ESTIMATED, AI_INFERENCE}`, `confidence` (0-1), `source_id`, `observed_at` y `method`. No hay métrica sin provenance.
2. `product_scores` guarda la versión del modelo de scoring, los pesos usados y el desglose por componente. Todo score es reproducible: se puede recalcular y comparar.
3. **El score ordena la investigación; no decide el lanzamiento.** La puerta de decisión es la **economía unitaria con datos REAL**: `contribution_margin > 0` y `CAC_estimado < contribution_margin`.
4. Un score con `confidence` agregada por debajo de un mínimo se marca `INSUFFICIENT_DATA` y no se presenta como oportunidad, sino como "requiere más investigación".
5. La UI muestra siempre la composición del score: cuánto viene de datos reales y cuánto de inferencia. Es un requisito del §3 del prompt y es la razón de ser del sistema.
6. **Recalibración obligatoria:** cuando existan resultados reales de campaña y ventas, se comparan contra los scores históricos y se ajustan los pesos. Este es el mecanismo concreto por el que el ciclo de §49 cierra. Sin este paso, el sistema no aprende — solo acumula datos.

**Consecuencias.**
- (+) El sistema no puede "inventar" una oportunidad sin dejar rastro de que lo hizo.
- (+) Es explicable ante ti mismo seis meses después: por qué se eligió un producto y con qué evidencia.
- (+) Los pesos del scoring se pueden mejorar con datos reales en vez de con intuición.
- (−) Más trabajo por métrica: hay que declarar procedencia y calcular confianza. Es precisamente el trabajo que da valor.
- (−) El MVP tendrá pocas métricas REAL. Es la respuesta honesta: mejor cinco métricas verificables que dieciocho inventadas.

**Alternativas descartadas.**
- *Score único sin desglose*: opaco, no auditable, imposible de recalibrar. Es el enfoque que produce los "productos ganadores" que luego no venden.
- *Marcar todo como ESTIMATED*: cumple la letra del requisito y destruye su propósito. Si todo es estimado, la marca no informa.
- *Dejar que el LLM produzca el score directamente*: un número generado por un modelo sin datos verificables detrás es una opinión con formato de dato. La inferencia puede **proponer** un valor; no puede **ser** la fuente.

---

## ADR-014 — Atribución calculada en job sobre touchpoints crudos

**Estado:** aceptado

**Contexto.** El prompt pide responder "¿de dónde vino esta venta?" y, más adelante, "¿qué
campaña produjo mayor margen?". Y pide una captura de UTM completo más `click_id`, `campaign_id`,
`ad_id`, `creative_id`.

**Decisión.**
1. Los **touchpoints se almacenan crudos e inmutables** (append-only): `anonymous_id`, utm_*, `fbclid`/`gclid`/`ttclid`, referrer, landing_url, timestamp.
2. La **atribución se calcula en un job**, no en el momento de la captura ni como campo fijo en `orders`. El modelo de atribución en el MVP es `last_touch` con `first_touch` almacenado en paralelo.
3. `orders` guarda además `total_cost` por línea (producto + envío + fees + impuestos), requisito para poder agregar por **margen** y no solo por revenue (§12 y §33).
4. La resolución de identidad (`anonymous_id` → lead → cliente) se hace vía `identities` + `identity_links`, y se re-ejecuta cuando llega nueva información que permite unir identidades.

**Consecuencias.**
- (+) Cambiar a atribución lineal, position-based o data-driven es **un job nuevo**, no una migración de datos históricos.
- (+) Se puede responder "¿de dónde vino esta venta?" con la cadena completa de touchpoints, no solo con el último.
- (+) El revenue y el margen por campaña son comparables y auditables.
- (−) Un job más y una tabla de hechos que crece; se particiona por fecha cuando haga falta.
- (−) La atribución no es instantánea (corre por job). Aceptado: no es un requisito del negocio.

**Alternativas descartadas.**
- *Guardar `attribution_model` como campo en `orders`*: fija el modelo en el momento de la escritura. Mejorar el modelo obliga a perder el histórico o a migrar. Es exactamente el error que este ADR evita.
- *Solo `last_touch` en el momento de la venta*: pierde la trazabilidad completa que pide el §1 (VISITANTE → ... → RECOMPRA) y no permite ver el recorrido real.
- *Píxel de terceros / atribución delegada a la plataforma*: cada plataforma se atribuye el mérito; la comparación entre canales se vuelve imposible. Necesitas tu propia fuente de verdad.
- *Identidad solo por email*: no permites atribuir a quien nunca rellenó un formulario, que es la mayoría del tráfico frío.

---

## ADR-015 — Ollama nativo en el host, no en contenedor

**Estado:** aceptado

**Contexto.** El prompt lista `ollama` como servicio de Docker Compose. Entorno verificado:
Ollama 0.34.3 ya instalado y corriendo nativamente en `:11434`, sin GPU.

**Decisión.** Ollama corre **nativo en Windows**. Los contenedores lo alcanzan vía
`host.docker.internal:11434`. La `baseUrl` es configuración del `OllamaProvider`, no una
constante.

**Consecuencias.**
- (+) Sin GPU, la virtualización solo añade latencia y consume RAM que necesita el propio modelo (los pesos se cargan en RAM del host; en contenedor habría dos capas de gestión de memoria).
- (+) Cambiar de modelo o de versión no requiere reconstruir una imagen ni mover decenas de GB.
- (+) El modelo vive en el almacén de Ollama del usuario, ya poblado (gemma4, qwen3.6, modelos cloud).
- (+) La configuración es portable: en un host Linux con GPU, la misma variable apunta a otro sitio.
- (−) El entorno no es 100% reproducible por Compose: hay un prerequisito manual documentado (Ollama instalado y con los modelos descargados). Se resuelve con un script de verificación y un mensaje claro en el bootstrap, no con un contenedor.
- (−) En un despliegue en VPS, Ollama va instalado en el host de todas formas — no cambia.

**Alternativas descartadas.**
- *Ollama en Compose*: imagen adicional, modelos en volúmenes, RAM duplicada en tránsito, y ninguna ventaja en un host sin GPU.
- *Ollama en un host aparte desde el inicio*: obliga a exponer el servicio y a gestionar autenticación antes de que exista una necesidad real de escala.
- *Servicio de inferencia propio*: construir un servidor de inferencia cuando Ollama ya expone una API compatible con OpenAI es trabajo sin valor.

---

## ADR-016 — El cierre es conversacional (WhatsApp), no transaccional

**Estado:** aceptado (decidido por el usuario el 2026-10-01)

**Contexto.** El modelo de negocio real es: **campaña en Facebook/Instagram → captura del lead →
cierre por WhatsApp** (y, cuando se pueda, dentro del propio entorno de Meta). Mercado: Colombia.
Dominio: todavía no hay, el desarrollo empieza en local.

Esto contradice dos supuestos con los que estaba diseñado el roadmap:

1. El plan asumía una **tienda en línea con checkout** como punto de conversión (§H.1 terminaba en
   `CHECKOUT → SALE`). Si la venta se cierra conversando por WhatsApp, **no hay checkout**, y por
   tanto no hay pasarela de pago en el MVP (el cobro ocurre por fuera: transferencia, Nequi,
   Daviplata, contra-entrega).
2. El plan asumía que **`apps/site` con SEO** era el camino principal a la venta (Hito 4). Si la
   adquisición es publicidad pagada en Meta y el cierre es por WhatsApp, **el sitio público deja de
   ser el camino crítico de ingresos**. La landing sigue sirviendo (credibilidad, catálogo,
   segundo toque), pero no es por donde entra el dinero.

**Decisión.**

1. **El CRM incorpora un módulo de mensajería** como ciudadano de primera clase, no como campo de
   texto en una actividad: `conversations` + `conversation_messages`, con canal
   (`WHATSAPP` / `MESSENGER` / `INSTAGRAM_DM`), estado, asignación y vínculo a identidad, lead,
   oportunidad y campaña.
2. **`apps/site` se reduce en el MVP** a: landing del producto, página de gracias, y las políticas
   (privacidad, tratamiento de datos). SSR/prerender y todo el checklist SEO de `docs/seo.md` se
   **conservan como especificación** pero se implementan en la fase que corresponda al canal SEO,
   no en el Hito 4.
3. **No hay checkout propio ni pasarela en el MVP.** La venta se registra en el CRM (manual o desde
   la conversación) con `closed_via` y `payment_method`. El módulo de economía unitaria funciona
   igual, porque solo necesita precio y costos.
4. **`closed_via` es un dato de primera clase** en `orders` y `leads`: `WHATSAPP`, `MESSENGER`,
   `INSTAGRAM_DM`, `PHONE`, `SITE`, `PRESENCIAL`. Se mide qué canal cierra mejor y con qué margen.
5. El embudo se reescribe (§H.1 de `architecture-review.md`) para reflejar la realidad: la
   conversación es una **etapa medible del funnel**, con su propia métrica (tiempo hasta primera
   respuesta, tasa de conversación → venta).

**Consecuencias.**
- (+) El sistema modela el negocio real, no un e-commerce ideal que no existe en este mercado.
- (+) Aparece la métrica que de verdad importa en venta conversacional: **lead → conversación → venta**, con su tasa y su tiempo.
- (+) Atribución sigue funcionando: la campaña, el anuncio y el formulario que originaron el lead se conocen con exactitud (ADR-017), incluso sin cookie.
- (−) Un módulo nuevo (mensajería) que no estaba en el plan y que hay que construir.
- (−) **Se difiere el trabajo de SEO** en el que el prompt insistía. Es una decisión consciente y la más dolorosa del proyecto: el SEO es un canal de mediano plazo que no produce ventas la primera semana, y con un solo desarrollador competir por el camino crítico de ingresos es lo correcto. El checklist de `docs/seo.md` no se pierde: se ejecuta cuando el ciclo de venta ya funcione.
- (−) El negocio depende de una plataforma externa (Meta) para adquirir y de otra (WhatsApp) para cerrar. Riesgo de plataforma (§P.2, nuevo riesgo S9).

**Alternativas descartadas.**
- *Construir checkout en línea primero*: nadie lo pidió y no es como se vende en el canal elegido. Habría sido trabajo caro para un flujo sin uso.
- *WhatsApp informal (solo `wa.me` click-to-chat, sin API)*: es lo que ya se hace a mano. No deja mensajes en el CRM, no permite medir tiempo de respuesta, ni automatizar seguimientos, ni atribuir la conversación a la campaña. Se puede usar como **fallback inmediato** mientras la API está en trámite, pero no es la arquitectura.
- *Solo Messenger/IG Direct y renunciar a WhatsApp*: WhatsApp es el canal dominante de cierre comercial en Colombia. Renunciar a él sería diseñar contra el mercado.
- *Tratar la conversación como una `activity` más*: se pierde el historial de mensajes, los tiempos de respuesta y la tasa de conversión conversacional. Un canal de cierre merece su propio modelo.

---

## ADR-017 — Ingesta de leads por Meta Lead Ads y conversión de vuelta por CAPI

**Estado:** aceptado

**Contexto.** Con el canal de ADR-016, el lead entra por un **formulario instantáneo de Meta**
(Lead Ads) o por una landing. El formulario instantáneo tiene una propiedad valiosa: el lead llega
ya asociado a `campaign_id`, `ad_id` y `form_id` **sin depender de cookies ni de UTMs**, porque Meta
es quien lo captura. Y el anuncio solo mejora si el resultado real (venta) regresa a Meta: sin eso,
el algoritmo optimiza hacia "lead barato" en vez de hacia "cliente que compra".

**Decisión.**

1. **Webhook de Meta Lead Ads** como vía de ingesta principal: Meta notifica `leadgen_id` →
   se consulta el lead por Graph API → se crea identidad + lead + touchpoint con atribución exacta
   (`campaign_id`, `ad_id`, `form_id`, `platform=meta`).
2. **Conversions API (CAPI) server-side** para enviar de vuelta a Meta los eventos que sí importan:
   `Lead` (al capturar) y **`Purchase` con valor y moneda** (al cerrar la venta), más
   `QualifiedLead` si se define. Se envían desde el backend, no desde el navegador.
3. **Deduplicación obligatoria por `event_id`** entre el píxel del navegador y CAPI, más
   `_fbp`/`_fbc` cuando existan, para maximizar el *event match quality*.
4. **Los eventos de conversión se encolan en el outbox** (ADR-009): enviarlos a Meta es un efecto
   externo que debe ser reintentable e idempotente, y no puede perderse si Meta está caído.
5. **Registro de consentimiento explícito** (Ley 1581): qué autorizó el lead, en qué formulario y
   con qué texto exacto. Sin esto no se puede hacer seguimiento comercial ni enviar plantillas de
   WhatsApp.
6. La ingesta de leads **no depende de `apps/site`**: es un webhook, y debe funcionar aunque el
   sitio público no exista todavía.

**Consecuencias.**
- (+) Atribución de alta calidad sin cookies ni `anonymous_id`: la campaña que originó cada lead es un hecho, no una inferencia.
- (+) Meta optimiza hacia las ventas reales, no hacia leads. Esto es lo que hace rentable la inversión publicitaria.
- (+) El lead entra al CRM en segundos, antes de que se enfríe.
- (−) **Requiere endpoint público HTTPS.** En desarrollo local hace falta un túnel (`cloudflared`/`ngrok`). Es un prerequisito real del Sprint correspondiente y hay que resolverlo antes.
- (−) Requiere **revisión de la app en Meta** (`leads_retrieval`, `ads_management`, `business_management`) y **verificación del negocio**. Es un trámite de semanas, con requisitos propios (dominio verificado, política de privacidad pública). **Es el bloqueante de mayor plazo del proyecto y debe iniciarse mucho antes de necesitarlo.**
- (−) Meta puede cambiar precios, políticas o permisos. Riesgo de plataforma real.
- (−) Dependencia del `leadgen_id` y de la disponibilidad de la Graph API; requiere reintentos y reconciliación.

**Alternativas descartadas.**
- *Solo landing propia con formulario*: se pierde la atribución limpia de Lead Ads y se depende de cookies y UTMs, con peor calidad de dato y más fricción para el usuario.
- *Exportar leads a CSV desde Meta y cargarlos a mano*: funciona un día, no es un sistema. Se admite como contingencia temporal, no como diseño.
- *Píxel del navegador como única vía de conversión*: pierde eventos por bloqueo de cookies y por navegador; para ventas cerradas en WhatsApp **no existe evento de navegador posible**. CAPI es la única vía realista.
- *Enviar conversiones desde el frontend*: expone el token y no cubre ventas que ocurren fuera del navegador (justo el caso de WhatsApp).

---

## ADR-018 — WhatsApp Business Platform (Cloud API) como canal de cierre, con sus restricciones

**Estado:** aceptado

**Contexto.** ADR-016 decide que el cierre es por WhatsApp. Hay dos formas de operarlo:
`wa.me` click-to-chat (gratis, sin API, sin registro en el CRM) o la **WhatsApp Business Platform
(Cloud API)** oficial de Meta. La segunda permite recibir y enviar mensajes con webhooks, pero
impone reglas estrictas que cambian el diseño de las automatizaciones.

**Decisión.** WhatsApp Business Platform (Cloud API) como canal de mensajería del CRM, con
`wa.me` como fallback inmediato mientras el número y la plantilla estén en trámite.

Restricciones que el diseño debe respetar (son reglas de Meta, no preferencias):

| Restricción | Implicación en el sistema |
|---|---|
| **Ventana de servicio de 24 h**: solo se puede responder libremente dentro de las 24 h siguientes al último mensaje del cliente | Las respuestas a un mensaje entrante se envían sin plantilla. Pasadas 24 h, **obligatorio usar plantilla aprobada** |
| **Las plantillas deben ser aprobadas por Meta** antes de usarse | Las plantillas viven en `whatsapp_templates` con su estado (`PENDING`/`APPROVED`/`REJECTED`) y su categoría (`MARKETING`/`UTILITY`/`AUTHENTICATION`). El sistema **no puede inventar y enviar** una plantilla nueva: primero se registra, espera aprobación, y luego se usa |
| **Categoría de la plantilla determina el costo** | `ai_costs`/costos de canal deben registrar también el costo de mensajería, no solo el de LLM |
| **El opt-in es obligatorio** para mensajes de marketing | `consent` en la identidad: qué autorizó, cuándo, con qué texto. Sin opt-in, no se envía plantilla de marketing |
| **Número dedicado y verificación del negocio** | Prerequisito de infraestructura, con plazo de trámite |

**Consecuencias.**
- (+) Todas las conversaciones de venta quedan en el CRM, vinculadas a la identidad, el lead y la campaña: se puede medir tiempo hasta primera respuesta y tasa conversación → venta.
- (+) Los seguimientos se pueden automatizar **dentro** de las reglas (plantilla aprobada + opt-in), con aprobación humana en el MVP.
- (+) El mismo modelo de mensajería sirve para Messenger e Instagram Direct, que comparten patrón.
- (−) **El seguimiento automático agresivo no es posible ni legal**: la ventana de 24 h y las plantillas aprobadas limitan la automatización. Hay que diseñar el flujo comercial dentro de esas reglas, no contra ellas.
- (−) Costo variable por conversación/plantilla que hay que medir y presupuestar (§P.3).
- (−) Otro trámite con plazo de semanas (verificación del negocio, número, plantillas). Refuerza que las gestiones con Meta deben iniciarse de inmediato.

**Alternativas descartadas.**
- *Solo `wa.me` click-to-chat*: cero costo y cero trámite, pero el CRM queda ciego — no hay historial, ni métricas de respuesta, ni atribución de la conversación a la campaña, ni seguimiento. Sirve para arrancar, no como arquitectura.
- *Proveedor intermediario (Twilio, 360dialog, Gupshup)*: válido y a veces más simple para empezar, pero añade un tercero, otro costo y otro modelo de datos. Se mantiene la puerta abierta: la capa de mensajería se diseña detrás de una interfaz — igual que los conectores de marketplace y los proveedores de LLM — para no quedar acoplado a Meta ni a un intermediario.
- *WhatsApp Web automatizado (no oficial)*: viola los términos de Meta, riesgo de bloqueo del número y del negocio. Descartado.

---

## ADR-019 — Dimensión de embeddings única, decidida y versionada (768 / `nomic-embed-text`)

**Estado:** aceptado

**Contexto.** `database.md` congeló las columnas vectoriales como `vector(1536)`, que es la
dimensión de `text-embedding-3-small` de OpenAI. Al escribir `deployment.md` apareció la
contradicción: **un modelo local de Ollama nunca emite 1536 dimensiones** — emite 768
(`nomic-embed-text`) o 1024 (`mxbai-embed-large`). Y ADR-007 enruta los embeddings precisamente a
Ollama local, por ser una operación de volumen. El esquema congelado contradecía al ADR que lo
gobierna.

Dos defectos adicionales, más graves que el número:

1. **Ninguna tabla registraba qué modelo generó cada vector.** Cambiar de modelo de embeddings no
   falla: mezcla en silencio dos espacios vectoriales distintos y la similitud devuelve resultados
   sin sentido **sin lanzar un error**. Es un fallo silencioso, la peor clase.
2. **`ai_memory.embedding` estaba declarada sin dimensión (`vector` a secas).** `pgvector` no puede
   construir un índice HNSW sobre una columna sin typmod, así que esa columna no era indexable.

**Decisión.** Dimensión **única y global: `vector(768)`**, correspondiente a
**`nomic-embed-text`**. Toda columna vectorial del esquema usa esa dimensión. Además, **cada fila
con vector escribe el modelo que lo produjo** (`embedding_model` en `products` y `ai_memory`;
`model` ya existía en `ai_embeddings`). El job de re-embedding se define como
`WHERE embedding_model IS DISTINCT FROM :modelo_actual`, de forma que un cambio de modelo sea
detectable y reparable en vez de silencioso.

**Justificación.**
- **1536 (OpenAI) descartado:** obliga a que *cada* embedding pase por una llamada remota de pago,
  lo que contradice ADR-007 (local para volumen) y añade costo recurrente proporcional al catálogo.
  Sin GPU, no hay ninguna ventaja que lo compense.
- **1024 (`mxbai-embed-large`) descartado para el MVP:** ~2,4× parámetros y ~2× tamaño de índice,
  en hardware CPU-only. Los tres casos de uso de ADR-008 (deduplicación, RAG sobre brand context,
  clustering de keywords) son de **recall**, no de precisión fina: un top-k algo peor se compensa
  con `pg_trgm` y filtros exactos. 768 es lo más barato que resuelve el problema.
- El costo de equivocarse es bajo y está acotado: cambiar de modelo es un job de re-embedding sobre
  un corpus de decenas de miles de filas. Por eso conviene elegir el más barato primero.

**Consecuencias.**
- (+) La dimensión queda decidida **antes de la Fase 3**, no antes de la Fase 5 como indicaba
  `deployment.md`. `products.embedding` nace en `003_catalog` (Fase 3), así que el valor debe estar
  congelado **antes** de esa migración. Es gratis ahora; con datos cargados, no.
- (+) Un cambio de modelo es detectable (`embedding_model`) y reparable por job, en lugar de
  degradar la calidad en silencio.
- (+) `ai_memory.embedding` pasa a ser indexable.
- (−) `nomic-embed-text` espera prefijos de tarea (`search_document:` para indexar, `search_query:`
  para consultar). El `OllamaProvider` debe añadirlos; olvidarlos no rompe nada visible, solo
  empeora los resultados. Queda como caso de prueba en el proveedor.
- (−) Si algún día se necesita calidad de 1024 o 1536, hay que migrar dimensión **y** recalcular
  todos los vectores. Documentado, no sorpresivo.

**Alternativas descartadas.**
- *Dejar `vector(1536)` y usar OpenAI para embeddings:* contradice ADR-007 y convierte una operación
  de volumen local en un costo variable remoto.
- *Dejar la dimensión "como configuración" en lugar de como constante del esquema:* es lo que hizo
  `deployment.md` para no contradecir el documento congelado, y es exactamente lo que produce el
  fallo silencioso. La dimensión de una columna `vector(N)` **es** parte del esquema; fingir que es
  configuración no la hace configurable.
- *Una sola tabla de vectores (todo en `ai_embeddings`, sin columnas inline):* se evaluó y se
  descartó. Una búsqueda filtrada ("productos similares a X, de la categoría Y, con margen > Z")
  obligaría a buscar en el índice vectorial y **luego** filtrar, con sobre-lectura y resultados
  perdidos. Las columnas inline permiten similitud y filtros relacionales en la misma consulta.
  La distinción queda escrita en `database.md` §10.
- *Índices IVFFlat en lugar de HNSW:* HNSW da mejor recall/latencia a esta escala y no requiere
  reentrenamiento al insertar. Descartado.

---

## ADR-020 — Modelo de permisos consolidado, permiso de orquestación y regla de delegación

**Estado:** aceptado

**Contexto.** §K.2 congeló un enum de **15** permisos. Al cruzar los documentos derivados entre sí
aparecieron tres problemas que ninguno había detectado por separado:

1. **El enum no cubría el catálogo de endpoints.** `api.md` documenta ~90 endpoints; las escrituras
   de CRM (`POST /leads`, `/opportunities`), contenido/SEO, órdenes y administración no tenían
   permiso que las nombrara. Su autor documentó 9 extensiones marcadas como "exigidas por el
   catálogo", pero quedaron sin formalizar: existían en un documento y no en la autoridad.
2. **Dos agentes tenían tools que nunca podían ejecutarse.** `content` y `seo` declaran
   `GENERATE_CONTENT, READ_PRODUCTS` pero usan `publishContent`, que exige `PUBLISH_CONTENT` →
   `TOOL_DENIED` siempre. Y el `orchestrator` declara `READ_PRODUCTS, READ_CAMPAIGNS, READ_METRICS`
   mientras `getAvailableAgents` exigía `MANAGE_AGENTS` y `createAgentTask` exigía `CREATE_CAMPAIGN`:
   sus dos tools principales, denegadas siempre. El orquestador era inoperable.
3. **`MANAGE_AGENTS` estaba a punto de concederse a un agente.** Es el permiso que permite
   reconfigurar agentes y sus permisos: concederlo a un agente es darle la capacidad de ampliarse a
   sí mismo. La escalada más directa del sistema.

Los dos primeros son *fail-closed* (la tool se deniega), así que no son vulnerabilidades: son
funcionalidad rota. El tercero sí habría sido una vulnerabilidad.

**Decisión.**

1. **Un solo enum canónico, de 25 permisos**: los 15 del núcleo + 9 de extensión del catálogo de API
   + `ORCHESTRATE_AGENTS`.
2. **Seis permisos no se conceden a ningún agente en el MVP**: `PUBLISH_CAMPAIGN`, `CHANGE_BUDGET`,
   `DELETE_ANY`, `MANAGE_AGENTS`, `MANAGE_SYSTEM`, `EXPORT_DATA`.
3. **`PUBLISH_CONTENT` sí se concede** (a `content` y `seo`), y se añade un invariante **de carga**:
   `APPROVAL_REQUIRED_PERMISSIONS = [PUBLISH_CAMPAIGN, CHANGE_BUDGET, PUBLISH_CONTENT]`, verificado
   por el `ToolRegistry` **al arrancar**. Toda tool cuyo permiso esté en esa lista debe declarar
   `requiresApproval: true`, o el arranque **aborta**.
4. **`ORCHESTRATE_AGENTS` sustituye los dos permisos mal asignados** del orquestador. Es más
   estrecho que `MANAGE_AGENTS`: permite **delegar** tareas, no reconfigurar agentes.
5. **Invariante de delegación**:
   `permisos_efectivos(run_delegado) = permisos(agente_delegado) ∩ permisos_efectivos(run_que_delega)`,
   con `MAX_DELEGATION_DEPTH = 1`.

**Justificación.** El punto 3 no es "conceder un permiso": es mover la garantía del *runtime* a la
*carga*. Confiar en que cada tool declare bien `requiresApproval` es confiar en que nadie se
equivoque nunca, y ese error es **invisible** — la tool funciona, simplemente publica sin preguntar.
Verificarlo al arrancar convierte un error de declaración en un fallo de despliegue, que se ve.

El punto 5 cierra algo que el diseño original no había visto: **el orquestador es el único agente
que invoca a otros, así que sin esta regla es un vector de escalada de privilegios.** Podría delegar
en un agente más privilegiado lo que él no puede hacer, y el efecto sería idéntico a hacerlo él. La
intersección lo vuelve inútil para eso: es el mismo principio `∩` que ya rige usuario→agente,
aplicado agente→agente.

`MANAGE_SYSTEM` queda fuera de los agentes por una razón concreta: gobierna `feature_flags`, y los
flags son los que habilitan la automatización. Un agente que los cambia se abre la puerta a sí
mismo, en silencio. `EXPORT_DATA` queda fuera porque es capacidad de exfiltración masiva, no de
trabajo, con Ley 1581 de por medio.

**Consecuencias.**
- (+) El enum deja de ser un subconjunto y pasa a ser autoridad única: `api.md`, `ai-agents.md` y
  `security.md` referencian el mismo conjunto de 25.
- (+) Dos agentes que estaban rotos (contenido/SEO y orquestador) quedan operativos.
- (+) La delegación deja de ser un agujero y pasa a ser una capacidad acotada y auditable.
- (−) Un permiso más que mantener (25). Es el precio de que un agente pueda delegar sin escalar.
- (−) `APPROVAL_REQUIRED_PERMISSIONS` obliga a que cualquier tool futura que publique contenido nazca
  con aprobación. Es intencional: la fricción está donde debe estar.

**Alternativas descartadas.**
- *Conceder `MANAGE_AGENTS` al orquestador:* resuelve la funcionalidad con el peor permiso posible —
  un agente que reconfigura agentes puede concederse `CHANGE_BUDGET` a sí mismo. Descartado.
- *Mantener `CREATE_CAMPAIGN` en `createAgentTask`* (lo que había): confunde crear una `ai_task` con
  crear una campaña y le da al orquestador un permiso que no necesita. La tool no toca `campaigns`.
- *No conceder `PUBLISH_CONTENT` y quitar `publishContent` de los agentes:* sería coherente, pero
  deja el producto sin publicación de contenido asistida, que es requisito explícito (§7, §27). Se
  conserva la capacidad y se cierra con aprobación.
- *Confiar en que cada tool declare `requiresApproval` correctamente:* es lo que ya se hacía, y el
  fallo resultante es silencioso.
- *Delegación en profundidad arbitraria:* sin límite, dos agentes mal configurados pueden delegarse
  en bucle y cada salto multiplica el consumo. `MAX_DELEGATION_DEPTH = 1` lo corta.

---

## ADR-021 — Toolchain verificado: TypeScript 6.0.3, monorepo ESM por exigencia de NestJS 12, y Zod 4

**Estado:** aceptado

**Contexto.** El review eligió stack sobre el papel. Al instalar de verdad (Hito 1, Sprint 1) el
registro resolvió a versiones que no son las que el review tenía en la cabeza, y **cinco de esos
cambios rompen el diseño tal como estaba escrito**. Los cinco se comprobaron ejecutando, no
leyendo documentación:

| Componente | Resuelto | Qué implicaba |
|---|---|---|
| TypeScript | **7.0.2** (nativo, en Go) → hoy **6.0.3** | Elimina `moduleResolution: node10` → **TS5108**. El paso a 6.0.3 está en la **enmienda** al final |
| NestJS | **12.1.2** | `@nestjs/common` es `"type": "module"`: **es ESM** |
| Express | **5.2.1** | `forRoutes('*')` deja de ser un comodín válido |
| Zod | **4.6.5** | Los issues **ya no llevan el valor recibido**; trae locales, incluido `es` |
| pnpm | **12.8.1** | `onlyBuiltDependencies` fue eliminado en pnpm 11 |
| Node | 24.19.0 | — |

1. **`node10` ya no existe.** `tsconfig.base.json` lo declaraba. El build no arrancaba.
2. **NestJS 12 es ESM-only.** Un proyecto CommonJS no puede importarlo: TS1479, en cada archivo.
3. **`onlyBuiltDependencies` se ignora en silencio.** Tras migrar a pnpm 11+, `pnpm config get
   onlyBuiltDependencies` **devuelve la lista**, así que la configuración *parece* correcta, y aun así
   `pnpm install` falla con `ERR_PNPM_IGNORED_BUILDS` — también en CI. El sustituto es el mapa
   `allowBuilds`.
4. **TypeScript 7 no expone la API programática del compilador.** Sólo queda el binario `tsc`. Su
   `exports["."]` apunta a `lib/version.cjs`, tres líneas que exportan `version` y
   `versionMajorMinor`: `import * as ts from 'typescript'` devuelve **cuatro claves** y nada más. No
   hay `createProgram`, `sys`, `createWatchCompilerHost`, `getParsedCommandLineOfConfigFile` ni
   `ModuleKind`. Cualquier herramienta que compile *invocando la API* en vez de ejecutar el binario
   deja de funcionar — y falla de formas que parecen otra cosa (ver decisión 6).

**Decisión.**

1. **TypeScript 6.0.3, con `module`/`moduleResolution` en `node16` y `target: ES2023`.** `node16` no
   es preferencia: es el modelo de resolución de Node, y con el `type: module` de nuestros paquetes
   produce ESM. La versión va fijada con `~` porque **Angular 22 exige `typescript >=6.0 <6.1`**:
   subir a 6.1 rompería `apps/web` sin que nada avise en el backend. El porqué del 6.0.3 y no del 7
   está en la enmienda al final.
2. **El monorepo entero es ESM.** `"type": "module"` en `apps/api` y en `packages/contracts`, y los
   imports relativos **con extensión `.js`** (`./errors.js`), porque en ESM Node no resuelve sin ella.
   Esto alinea los tres: lo que compila, lo que ejecuta `node`, y lo que el editor entiende.
3. **Los tests no se emiten.** `tsconfig.json` excluye `src/**/*.test.ts`; `tsconfig.test.json`
   (`noEmit`) los tipa. Sin esa separación `dist/` publicaba `errors.test.js`.
4. **`z.config(z.locales.es())` vive en `@crm/contracts`.** El idioma de los mensajes de validación
   es una propiedad del contrato, no de cada proceso: si se dejara a cada app, el API y el worker
   podrían responder en idiomas distintos ante el mismo payload.
5. **`allowBuilds` en `pnpm-workspace.yaml`, y en ningún otro sitio.** No se vuelve a escribir
   `onlyBuiltDependencies`.
6. **El bucle de desarrollo es `tsc -b --watch` + `node --watch`, orquestados con `concurrently`.**
   Un solo comando (`corepack pnpm dev`), y **el mismo compilador en dev y en producción**. Los dos
   scripts quedan expuestos por separado (`dev:build`, `dev:serve`) para poder correrlos en dos
   terminales. Los scripts del repo invocan **`corepack pnpm`**, nunca `pnpm` pelado, porque en esta
   máquina pnpm no está en el `PATH`.

**Justificación.** Los puntos 1 y 2 no son elecciones estéticas, son restricciones del entorno real;
la alternativa era escribir código que no compila. El punto 4 existe porque `errors[].message` viaja
al cliente: un CRM en español devolviendo `"Invalid input: expected number, received string"` está
incumpliendo su propio contrato de idioma. El punto 6 existe porque dev y producción **no pueden
usar compiladores distintos**: dos artefactos con el mismo nombre y semántica diferente fallan en
producción, no en el portátil, y para entonces ya nadie relaciona el fallo con el runner de dev.

**Consecuencias.**
- (+) `tsc -b` con `composite` y **project references funciona** bajo TS7: verificado, no supuesto.
  (Era el riesgo real del compilador nativo, que en sus primeras versiones no soportaba references.)
- (+) `emitDecoratorMetadata` **sí** emite `__metadata("design:paramtypes", …)` en TS7, así que la
  inyección de dependencias de NestJS funciona. Se compiló un decorador real para comprobarlo.
- (+) Mensajes de validación en español, sin tabla de traducciones que mantener.
- (+) `allowBuilds` deja `pnpm install` en exit 0, que es lo que necesita el CI.
- (−) Los imports relativos llevan `.js` aunque el archivo sea `.ts`. Es ruido visual, y a cambio no
  hay ninguna capa de traducción entre fuente, artefacto y runtime.
- (−) Todo el monorepo queda en ESM, incluidas las herramientas. Aceptable: es una dirección, no una
  dualidad.
- (+) El bucle de dev **reproduce el build de producción**: mismo `tsc`, misma configuración, misma
  metadata de decoradores. Se verificó con un proveedor inyectado por tipo que `tsx` habría roto, y
  con una edición en caliente que reinició el proceso sola.
- (−) El stack va por delante de lo que el ecosistema NestJS suele documentar (TS 5.x). El riesgo no
  es de hoy —todo lo anterior está verificado— sino de un paquete de terceros que aún no publique ESM.

**Alternativas descartadas.**
- *Fijar TypeScript 5.9.3* (existe en el registro) para no depender del compilador nativo: era lo
  prudente **antes** de medir. Una vez comprobado que `tsc -b`, `composite` y `emitDecoratorMetadata`
  funcionan, fijar una versión anterior es renunciar a velocidad de build sin ganar nada.
- *Dejar `apps/api` en CommonJS e importar NestJS con `import()` dinámico:* TS lo sugiere en el propio
  mensaje de error (TS1479). Sería un `await import()` en cada archivo, y contradice a NestJS: si el
  framework es ESM, el proyecto es ESM.
- *`moduleResolution: "bundler"`* para poder escribir imports sin extensión: no vale, porque el
  runtime es `node dist/main.js` sin bundler. Las extensiones son obligatorias de verdad, y ocultarlas
  solo traslada el fallo al arranque en producción.
- *Reconstruir `received` leyendo `req.body` según el `path`:* Zod 4 dejó de adjuntar el valor
  recibido a sus issues, así que la respuesta no lo trae. Reconstruirlo significaría reenviar datos
  del cliente según una heurística por nombre de campo, y un solo campo mal nombrado convierte eso en
  una fuga de credenciales. Se acepta la pérdida de detalle: la alternativa es peor (§48).
- *Configurar el locale en `main.ts` de cada app:* se olvida en el worker, y el olvido no se nota
  hasta que un usuario ve un mensaje en inglés.
- *`tsx watch src/main.ts` como runner de dev* (era el elegido al principio): **medido**, no
  supuesto. `tsx` no emite `__metadata("design:paramtypes", …)` —el mismo archivo da `null` bajo
  `tsx` y `["Dep"]` bajo `tsc`—, así que NestJS no puede resolver inyecciones por tipo. Arrancaba
  igualmente porque `HealthController` inyecta con `@Inject(READINESS_INDICATORS)`, un token; habría
  reventado con *"Nest can't resolve dependencies"* en el primer proveedor inyectado por tipo, muy
  lejos ya de la causa. Un runner que funciona sólo hasta que escribes código normal no es un runner.
- *`nest start --watch` de `@nestjs/cli` 12:* **no es posible con TS 7.** El CLI compila invocando la
  API programática (`tsBinary.sys`, `createIncrementalProgram`, `getPreEmitDiagnostics`) y se protege
  con un guard explícito, `assertProgrammaticApiIsSupported`, que exige
  `getParsedCommandLineOfConfigFile` — que TS 7 no tiene. Lanzaría `UNSUPPORTED_TYPESCRIPT_VERSION`.
  La variante `--builder swc` esquiva la API de TS, pero obliga a **dos compiladores** (SWC en dev,
  `tsc` en build), sigue necesitando `tsc -b` para `@crm/contracts` porque SWC sólo compila `src`, y
  hereda un bug latente: `resolveSwcModuleType` compara contra `ts.ModuleKind.ES2015`, que es
  `undefined` en TS 7, así que acierta por accidente. Se descarta: cuatro dependencias nuevas
  (una de ellas binaria) a cambio de una terminal.

### Enmienda — de TypeScript 7.0.2 a 6.0.3

**Estado:** aceptado (2026-10-01).

**Qué pasó.** Al añadir `apps/web` (Angular 22), su peer `typescript >=6.0 <6.1` hizo imposible
compilar la UI con 7.0.2 instalado. En vez de dejar el monorepo con dos versiones de TypeScript
—que es justo lo que `tsconfig.base.json` existe para evitar— se estandarizó todo en **6.0.3**.

**Lo que esto restaura, y que hay que decir en voz alta porque arriba se afirma lo contrario.**
Medido sobre el paquete resuelto, no deducido:

```
require('./node_modules/typescript/package.json').version  →  6.0.3
createProgram / sys / createWatchCompilerHost /
getParsedCommandLineOfConfigFile / ModuleKind              →  todos presentes
```

El **punto 4** de arriba y la alternativa *«`nest start --watch`»* describen una limitación **de
TS 7**. Con 6.0.3 esa limitación no existe: `assertProgrammaticApiIsSupported` pasa, así que
`nest start --watch` vuelve a ser técnicamente viable. Consecuencias:

- La **decisión 6 no cambia**, pero su justificación sí. `tsx` sigue descartado y su motivo real es
  **esbuild, no TypeScript**: esbuild no implementa `emitDecoratorMetadata`, así que
  `design:paramtypes` sale `null` con cualquier versión de TS. La medición de esa alternativa sigue
  siendo válida, y por esa razón, no por la versión del compilador.
- `nest start --watch` (sin `--builder swc`) sigue sin resolver `@crm/contracts`: compila **un**
  tsconfig y no sigue las project references, así que necesitaría `tsc -b` igualmente. Se mantiene
  el bucle actual además porque **reproduce exactamente el build de producción** — mismo `tsc`,
  misma configuración, misma metadata de decoradores —, algo que un runner aparte no garantiza.
  Queda como opción abierta, no como imposible: si se prefiere, es una decisión de gusto, no una
  restricción del entorno.

**Lo que no cambia.** `module`/`moduleResolution: node16`, el monorepo ESM, los imports relativos
con `.js`, `target: ES2023`, los tests fuera de `dist/`, el locale de Zod y `allowBuilds`. Ninguna
de esas decisiones dependía de la versión 7.

**Lo que se pierde.** La velocidad del compilador nativo en Go. A cambio, **una sola** versión de
TypeScript en todo el repo, que era el motivo por el que existe `tsconfig.base.json`.

**Consecuencia para el futuro.** El rango `~6.0.3` es deliberado y está comentado en
`tsconfig.base.json`. Cuando Angular admita 6.1+, subir es una línea. Volver a 7 exige comprobar
antes que `apps/web` lo acepta — y que las herramientas que invocan la API programática del
compilador (no el binario) siguen funcionando, que fue el problema real que este ADR documentó.

---

## ADR-022 — Sistema de diseño propio en CSS, sin Tailwind y sin biblioteca de componentes

**Estado:** aceptado

**Contexto.** `apps/web` arranca con Angular 22. La pregunta no era "cómo se ve" sino **dónde vive
la verdad visual del CRM**: en los componentes, en un framework de utilidades, o en un archivo de
tokens.

Las restricciones reales de este proyecto son tres:

1. Es un **CRM operativo**, no una landing: densidad de datos, tablas y uso intensivo de teclado.
2. Hay **dos frontends con públicos opuestos** (`apps/web` interno, `apps/site` público). Compartir
   la identidad no puede significar compartir el CSS entero.
3. Toda decisión de UI arrastra accesibilidad, y la accesibilidad no se puede añadir después.

**Decisión.**

1. **Los valores viven en `apps/web/src/styles/tokens.css`** — custom properties de CSS: color,
   espaciado, tipografía, radios, sombras, medidas de layout. Ningún componente escribe un `#hex`,
   un `padding` en píxeles ni un `font-family`. Si un componente necesita un valor que no existe,
   se añade al archivo de tokens y se documenta; no se escribe suelto.
2. **Tres capas, y cada cosa en la suya:** `tokens.css` (valores) → `styles/components.css`
   (primitivas compartidas: tarjeta, píldora de estado, aviso, alerta, `problem+json`, clave/valor,
   botón, etiqueta) → `features/*/**.css` (solo layout propio de esa pantalla). La prueba para
   decidir es **«¿lo va a necesitar una segunda pantalla?»**.
3. **Tipografía del sistema, no webfont.** `system-ui` con pila de respaldo. Cero peticiones de red,
   cero FOUT, funciona sin conexión.
4. **Iconos como SVG en línea.** Nada de fuente de iconos ni de emoji.
5. **El color nunca comunica solo.** Todo estado va con color **+ texto**, y con `.visually-hidden`
   cuando hace falta para lectores de pantalla.
6. **`prefers-reduced-motion` desactiva todo movimiento**, globalmente, en `styles.css`.

**Justificación.**

- El punto 1 existe porque ya sabemos cómo termina lo contrario: tres copias del mismo verde en tres
  componentes, y a la cuarta alguien cambia una y las otras tres mienten. Es la misma clase de
  divergencia silenciosa que el catálogo de errores de `@crm/contracts` está diseñado para impedir.
- El punto 2 se descubrió **por un aviso del build**, no por intuición: `system-status.css` superó el
  presupuesto de 4 kB de Angular. Subir el límite habría silenciado la señal, y la señal era
  correcta — esas primitivas no eran de esa pantalla. Moverlas a la capa global bajó el chunk del
  componente de 14,10 kB a 10,16 kB y evita que cada pantalla siguiente las redeclare.
- El punto 3 es una decisión de producto: una herramienta interna que arranca pidiendo una fuente a
  un CDN ajeno añade un punto de fallo y una dependencia externa a cambio de una ganancia estética
  que nadie pidió. Es coherente con §48: nada que no controlemos en la ruta crítica.
- El punto 5 es la regla que más se incumple en interfaces de estado: un punto verde sin la palabra
  «Operativa» es invisible para quien no distingue verde de rojo (≈8 % de los hombres). En una
  pantalla cuyo único trabajo es decir si algo funciona, eso no es un detalle.

**Consecuencias.**
- (+) Un solo sitio donde cambiar la marca: cambiar `--c-accent` cambia toda la aplicación.
- (+) `apps/site` puede reutilizar lo que le sirva sin heredar el CSS del CRM: los tokens son datos,
  no un framework.
- (+) El contraste está **anotado en el archivo de tokens**, valor por valor (17.3:1, 5.5:1, 4.8:1…).
  Quien añada un color ve de inmediato el listón que tiene que cumplir.
- (−) Hay que mantener una capa a mano. Se acepta: son ~150 líneas de custom properties, y a cambio
  no hay build step de CSS, ni configuración de Tailwind, ni un framework que actualizar.
- (−) Sin biblioteca de componentes hay que escribir las tablas, los modales y los menús que Material
  o PrimeNG darían hechos. Se acepta **solo en la medida en que aparece la necesidad real**:
  `@angular/cdk` está instalado precisamente para las piezas que no conviene improvisar (overlay,
  a11y, portal, virtual scroll), porque esas no son estética, son comportamiento difícil de hacer bien.

**Alternativas descartadas.**
- *Tailwind CSS.* Es la opción por defecto del skill de diseño que se evaluó, y no es una mala
  herramienta — es que aquí el problema no es escribir CSS rápido. En un CRM con dos frontends y
  contratos compartidos, la verdad visual debe ser un artefacto versionado y auditable, no utilidades
  repartidas por las plantillas. Añadiría además un build step y una configuración para un beneficio
  que no es el cuello de botella.
- *Angular Material / PrimeNG.* Traen una identidad ajena, un sistema de theming propio (que
  competiría con `tokens.css` por el mismo puesto) y un coste de bundle que en `apps/web` no se
  justifica. Se descarta la biblioteca completa; se conserva **CDK**, que son primitivas de
  comportamiento sin estilos. Es la separación que interesa: la apariencia es nuestra, el
  comportamiento difícil lo resuelve quien ya lo ha depurado.
- *Instalar el skill `ui-ux-pro-max` de nextlevelbuilder* (que fue el punto de partida del usuario).
  Se evaluó en serio y se decidió **replicar sus principios sin instalarlo**: su valor real es la
  disciplina que impone (checklist de entrega, tokens como fuente única, contraste verificado), y eso
  está incorporado en esta decisión. Lo que no encaja es el catálogo: 79 estilos, 192 paletas y 34
  patrones de landing están pensados para **captar**, y este CRM existe para **operar** — aplicar sus
  paletas y patrones lo empeoraría. Tampoco soporta Angular (genera HTML + Tailwind) y requiere
  Python 3 para su búsqueda BM25, que sería una dependencia nueva a cambio de nada que no tengamos ya.

---

## ADR-023 — El esquema de firma de los webhooks de Meta es el de Meta, no el genérico de `api.md`

**Estado:** aceptado (2026-10-01)

**Contexto.** Al implementar el webhook de Meta Lead Ads apareció una contradicción entre lo que
documentaba `api.md` §8.2 y lo que Meta envía de verdad:

| `api.md` §8.2 decía | Meta envía |
|---|---|
| `X-Webhook-Signature: t=…,v1=…` | `X-Hub-Signature-256: sha256=<hex>` |
| HMAC sobre `{t}.{raw_body}` | HMAC sobre `raw_body` a secas |
| Tolerancia de reloj con `WEBHOOK_TOLERANCE_SECONDS` | **Sin timestamp** |

No es un matiz de formato: el esquema documentado no puede verificar una petición real de Meta, así
que implementar lo documentado habría producido un webhook que **rechaza el 100 % del tráfico
legítimo** —y que, además, parecería correcto en los tests, porque los tests habrían firmado con
nuestro propio esquema inventado.

**Decisión.**

1. **Se implementa el esquema real de Meta**: `X-Hub-Signature-256`, prefijo `sha256=` obligatorio,
   HMAC-SHA256 del **cuerpo crudo** con `META_APP_SECRET`, comparación en tiempo constante y longitud
   del hexadecimal comprobada **antes** de `timingSafeEqual` (esa función lanza si los buffers
   difieren, y una excepción aquí sería un `500` que Meta reintentaría indefinidamente).
2. **No se inventa un timestamp.** Sin reloj no hay protección anti-replay por tiempo, y añadir uno
   propio daría la apariencia de una defensa que la firma de Meta no sostiene. La idempotencia recae
   donde corresponde: en el `UNIQUE(meta_lead_id)` de la base de datos (`database.md` §15).
3. **El esquema genérico con `t`/`v1` no se borra, se marca como no implementado.** Se conserva
   documentado para un futuro emisor propio, con la advertencia explícita de que
   `WEBHOOK_SECRET_{SOURCE}` y `WEBHOOK_TOLERANCE_SECONDS` **no existen** como variables.
4. **La verificación es una función pura y sin HTTP** (`meta-signature.ts`), y **el script de
   desarrollo llama a esa misma función** en vez de reimplementar el HMAC. Un script que firma con
   su propia copia del algoritmo prueba que el script funciona, no que el servidor verifica bien.

**Consecuencias.**
- (+) El handshake y la recepción de Meta se pueden probar **hoy**, sin cuenta de Meta y sin túnel:
  firmando el payload con el mismo código que lo verifica.
- (+) La verificación sobre el cuerpo crudo obliga a `rawBody: true` en la fábrica de la app. Es la
  decisión que hace imposible el bug silencioso de firmar `JSON.stringify(req.body)`, que produciría
  un `401` en producción con el diagnóstico apuntando al secreto.
- (−) El esquema con timestamp queda como deuda documental: si algún día se añade un emisor que lo
  use, habrá que implementarlo de cero. Coste aceptado: hoy no hay tal emisor.
- (−) **No hay protección anti-replay criptográfica.** Con la firma de Meta no se puede tener. Se
  compensa con la deduplicación en base de datos, que es la que realmente impide el doble efecto.

**Alternativas descartadas.**
- *Implementar el esquema documentado*: era el camino directo a un webhook que no acepta nada de Meta.
- *Aceptar ambos esquemas*: dos caminos de verificación es el doble de superficie para el mismo
  resultado, y el genérico no tiene emisor. Cuando lo haya, se añade con su propio ADR.
- *Re-serializar el cuerpo y firmar eso*: invalida la firma, y el error se manifiesta como «secreto
  incorrecto», que es el diagnóstico equivocado más caro de depurar.

---

## Enmienda a ADR-017 — La ingesta de Meta no crea `touchpoint` (2026-10-01)

**Estado:** aceptado

ADR-017 describe la ingesta como «se crea **identidad + lead + touchpoint** con atribución exacta».
Implementarlo hoy es imposible por dos motivos concretos, no por falta de tiempo:

1. `touchpoints.anonymous_id` es **`NOT NULL`** (`database.md` §3) y un lead de Instant Form **no
   tiene `anonymous_id`**: no hubo navegador nuestro, ni cookie, ni clic, ni UTM. El clic ocurrió
   dentro de Facebook.
2. `touchpoints.campaign_id` y `ad_id` son **FK a `campaigns`**, tabla que no existe (Fase 7).

Rellenar `anonymous_id` con un valor inventado sería peor que no crear la fila: un identificador
falso en una tabla de atribución **parece un dato** y nadie lo va a cuestionar más adelante.

**Decisión:** la ingesta de esta fase crea **identidad + lead**, y la atribución de Meta se conserva
**cruda y completa** en `meta_lead_submissions` (`form_id`, `ad_id`, `adset_id`, `campaign_id` y el
`raw_payload` íntegro de la Graph API). Cuando `campaigns` exista, los touchpoints se derivan de ahí:
**no se descartó nada**, así que no hay pérdida. `touchpoints` se difiere a la migración que cree
`campaigns`.

**Consecuencia inmediata:** la atribución por touchpoint (ADR-014) y los informes que dependen de
`first_touchpoint_id` / `last_touchpoint_id` **no pueden funcionar** hasta entonces. Queda registrado
como desviación con fecha en vez de quedar implícito, que es la diferencia entre una deuda conocida y
una sorpresa.

---

## Deuda registrada — I12 (outbox transaccional) incumplido a 2026-10-01

**Estado:** deuda aceptada, con fecha de apertura.

El invariante **I12** (`architecture.md` §Invariantes) exige que un cambio de estado y su evento
salgan en la **misma transacción**, con `outbox_events` como mecanismo. **Hoy no se cumple, y no se
puede cumplir**: `outbox_events` no está creada, no hay base de datos, y no existe ningún consumidor
de eventos —ni worker— porque `apps/worker` todavía no existe.

Se registra aquí, explícitamente, por tres motivos:

1. **Es un invariante de integridad, no un detalle.** Su violación significa que un estado puede
   cambiar sin que su evento salga, o al revés. Mientras no haya consumidores, el efecto es nulo;
   en cuanto lo haya, la ventana existe.
2. **La primera escritura real del sistema será un lead.** Es exactamente el caso donde «crear el
   lead» y «emitir `LeadCreated`» tienen que ser atómicos, porque el evento alimenta CAPI
   (`conversion_events`, ADR-017) — y un `Lead` perdido hacia Meta es dinero y aprendizaje del
   algoritmo perdidos, sin que nada falle visiblemente.
3. **Una deuda sin fecha se convierte en un supuesto.** Con fecha, se puede decidir cuándo pagarla;
   sin ella, se descubre en producción.

**Cuándo se paga:** en la misma migración que introduzca el primer consumidor de eventos. El
`outbox_events` entra en `001_core` (`database.md` §13) **cuando exista el worker que lo despacha**,
no antes: crear la tabla y no tener publisher sería la misma deuda con más código.

**Qué NO se hace mientras tanto:** declarar §48 o ADR-009 cumplidos. Un mecanismo que no existe no
protege de nada, y anotarlo como hecho es la forma más rápida de que nadie lo implemente.
