# Roadmap

Las 11 fases del prompt se conservan como **taxonomía de trabajo**, agrupadas en **5 hitos**
con puertas de salida verificables (ver `architecture-review.md` §N.1 y ADR-001/002).

Regla de avance: **no se salta una puerta**. Si se salta, se registra en `docs/decisions.md`
con la razón y el riesgo aceptado.

---

## Vista general

| Hito | Fases | Duración est. | Puerta de salida |
|---|---|---|---|
| **1. Cimientos** | 0-1 | ~3 semanas | `pnpm dev` levanta todo; login end-to-end; auditoría y outbox funcionando |
| **2. El negocio** | 2-3 | ~4 semanas | Registro un lead y sé si un producto puede ser rentable |
| **3. La inteligencia** | 4-5 | ~5 semanas | De "nicho" a "productos priorizados con evidencia" en < 30 min |
| **4. La comercialización** ★ | 5-bis, 6-7 | ~6 semanas | Lead entrando desde Meta + venta cerrada por WhatsApp reportada a Meta + atribución → **se puede vender** |
| **5. El aprendizaje** ★ | 8-10 | ~4 semanas | Las métricas reales recalibran el scoring → **el ciclo cierra** |
| **Post-MVP** | 11+ | continuo | Escala, más conectores, generación de imagen/video, automatización acotada |

★ = los dos hitos que convierten esto en un negocio en marcha.

> Las duraciones son estimaciones de esfuerzo para 1 desarrollador a tiempo parcial y deben
> tratarse como orden de magnitud, no como compromiso. La métrica útil no es la fecha sino
> **cuántas puertas se han pasado con criterios verificados**.

---

# FASE 0 — Architecture ✅

**Entregado en este sprint de planificación.**

- `docs/architecture-review.md` — análisis completo A-O
- `docs/decisions.md` — ADR-001 a ADR-015
- `docs/database.md` — modelo de datos y orden de migración
- `docs/roadmap.md` — este documento

**Pendiente de tu aprobación:** los 6 cambios propuestos (§0.2) y las 5 decisiones de §O.3.

---

# HITO 1 — CIMIENTOS

## FASE 1 — Foundation

**Objetivo.** Que exista un esqueleto que arranque, autentique, audite y no haya que
rediseñar después.

> **Estado real a 2026-10-01.** Esta fase está **a medias, y con una parte adelantada de la Fase
> 5-BIS**. Hecho: validación de entorno fail-fast, `/health/live` y `/health/ready`, filtro
> problem+json con `traceId`, `apps/web` con dos pantallas, `packages/contracts` con 43 errores y los
> esquemas de identidad, leads y webhooks — y el **webhook de Meta Lead Ads** completo hasta el borde
> de la persistencia (handshake, firma HMAC, rate limit, cliente de Graph API con fixtures), más la
> pantalla de leads.
>
> **No hecho, de esta fase:** nada de auth, nada de Prisma, nada del worker, nada de `apps/site`,
> nada de observabilidad (pino/OTel), nada de ESLint ni CI, y el rate limit es en memoria.
>
> **Por qué se adelantó lo de la Fase 5-BIS:** la verificación del *handshake* con Meta es lo que la
> app de Meta necesita para dar por bueno el endpoint, **no necesita base de datos**, y los trámites
> con Meta son el bloqueante de mayor plazo del proyecto (ver el bloque de abajo). Construirlo ahora
> no retrasa nada y quita semanas del camino crítico.
>
> **El orden de esta fase no cambia:** la **persistencia es lo siguiente**, y sin ella el webhook no
> produce un lead. La elección de Postgres —nativo o gestionado— sigue siendo la puerta.

**Entidades:** `organizations`, `users`, `refresh_tokens`, `audit_logs`, `outbox_events`.

**Backend (`apps/api`)**
- NestJS + **Express 5** (el adaptador instalado; `decisions.md` ADR-003 aún dice Fastify y la
  divergencia está registrada allí), config validada con Zod, logger pino con `request_id`/`trace_id`
- Filtro global de errores RFC 9457
- OpenTelemetry (HTTP, Prisma, Redis)
- `/health/live`, `/health/ready` (verifican DB y Redis de verdad)
- Prisma + migración `001_core`
- `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`
- argon2id + rotación de refresh con detección de reuso por familia
- `PermissionsGuard` + `@RequirePermission()` + enum `Permission`
- Throttler con store en Redis, Helmet, CORS estricto, validación Zod global
- `EventBus` + escritura transaccional al outbox
- Interceptor de auditoría en toda mutación autenticada

**Worker (`apps/worker`)**
- NestJS standalone + BullMQ; colas `io`, `ai`, `compute`, `seo`
- Consumidor de outbox → publica en colas
- Job repetible: limpieza de refresh tokens expirados

**Frontend (`apps/web`)**
- `ng new` standalone + signals + Tailwind; layout, guards funcionales, interceptor de auth
- Página de login funcional contra la API real
- Esqueleto de navegación de features (vacías)

**Frontend (`apps/site`)**
- `ng new` con SSR + prerender
- `robots.txt`, `sitemap.xml`, home con metadata + JSON-LD + canonical

**Paquetes**
- `packages/contracts` (Zod → OpenAPI → cliente generado)
- `packages/domain` (sin I/O), `packages/config`, `packages/ui` (4 componentes base)

**Docker:** Compose con postgres+pgvector, redis, api, worker, web, site, adminer.
Ollama nativo (ADR-015) alcanzable vía `host.docker.internal`.

**Tests**
- Unit: hashing, generación/validación de JWT, permisos
- Integración: login ok / password mal / refresh válido / **reuso rechazado**
- Integración: outbox → cola → consumidor
- Integración: `/health/ready` devuelve 503 con DB caída
- Contract: el cliente generado coincide con el OpenAPI

**Trámites externos con plazo de semanas — iniciar en el Sprint 1, no cuando se necesiten**

Estos trámites no requieren código, tardan semanas y **bloquean el Hito 4**. Se arrancan ya:

- [ ] Crear la app en Meta for Developers y el portafolio de negocio
- [ ] **Verificación del negocio en Meta** (requiere política de privacidad pública y, normalmente, un dominio verificado — hoy no hay dominio: es el primer argumento para registrar uno)
- [ ] Solicitar permisos `leads_retrieval`, `ads_management`, `business_management`
- [ ] Alta del número en WhatsApp Business Platform; verificar el número de teléfono comercial
- [ ] Enviar plantillas de WhatsApp a aprobación (empiezan en `PENDING`)
- [ ] Decidir y registrar el dominio (§O.3 pregunta 5)

**Por qué ahora:** con un solo desarrollador, el camino crítico del Hito 4 no es el código —
es la aprobación de Meta. Empezar el trámite en la Fase 1 y tenerlo listo en la Fase 5-BIS es la
diferencia entre 6 semanas y 3 meses.

**CI:** quality · contract · build. Pre-commit con lint + tests afectados.

**Criterios de aceptación**
- [ ] `pnpm install && pnpm bootstrap && pnpm dev` levanta todo, documentado
- [ ] Login end-to-end desde `apps/web`
- [ ] Refresh reusado → familia revocada (test que lo prueba)
- [ ] Error de login devuelve RFC 9457 con `traceId`
- [ ] HTML prerenderizado de `apps/site` contiene title, meta, canonical y JSON-LD
- [ ] `apps/web` bloqueado en `robots.txt` y con `noindex`
- [ ] Toda mutación autenticada deja fila en `audit_logs`
- [ ] CI en verde; y **falla** si se provoca divergencia OpenAPI↔cliente

---

# HITO 2 — EL NEGOCIO

## FASE 2 — CRM

**Objetivo.** Trazabilidad real desde el visitante anónimo hasta la oportunidad, sin
duplicar personas.

**Entidades:** `identities`, `identity_links`, `touchpoints`, `leads`, `lead_stage_history`,
`contacts`, `opportunities`, `activities`.

**Backend**
- CRUD de leads/contactos/oportunidades/actividades con validación Zod
- Resolución de identidad: `anonymous_id` → email/teléfono/checkout, con `identity_links`
- Captura de touchpoints (endpoint público, rate-limited, en `apps/site`)
- Máquina de estados del lead con historial append-only
- Conversión lead → opportunity → cliente (idempotente, con `Idempotency-Key`)
- Endpoint de ingesta de formularios con consentimiento (base legal + retención)
- Eventos: `LeadCreated`, `LeadConverted`, `OpportunityStageChanged`

**Frontend (`apps/web`)**
- Pipeline kanban de oportunidades (drag & drop con transición validada en servidor)
- Lista y ficha de lead con **timeline unificado** (touchpoints + actividades + cambios de estado)
- CRUD de actividades con vencimientos; vista "mis tareas de hoy"
- Búsqueda de leads con `pg_trgm`

**Datos personales (S6):** minimización, cifrado en reposo, retención configurable,
registro de acceso, checkbox de consentimiento, política de privacidad en `apps/site`.

**Tests**
- Fusión de identidades no crea duplicados (mismo email, distinto `anonymous_id`)
- Conversión repetida con la misma `Idempotency-Key` no duplica oportunidad
- Transición inválida de estado es rechazada con 409
- Atribución de touchpoint a lead tras identificación

**Criterios de aceptación**
- [ ] Un visitante anónimo que rellena un formulario aparece como **una sola** identidad
- [ ] El timeline de un lead muestra todos sus touchpoints en orden
- [ ] Transición inválida rechazada en servidor (probado por API directa, no por UI)
- [ ] Eliminar un lead es soft-delete y queda en `audit_logs`

---

## FASE 3 — Products + Economía + Conectores + Scoring

**Objetivo.** Saber si un producto puede ser rentable, con datos que se pueden defender.

**Entidades:** `categories`, `products`, `product_costs`, `product_economics_snapshot`,
`connectors_registry`, `product_sources`, `product_metrics`, `product_scores`.

**Backend**
- CRUD de productos y categorías; slug único para URL pública
- `product_costs` versionado por fecha (nunca sobrescribir: el margen histórico se reproduce)
- **Motor de economía unitaria**: `gross_margin`, `contribution_margin`, `break_even_cac`, `break_even_roas` con tests de casos límite
- `MarketplaceConnector` (interfaz) + `MercadoLibreConnector` (API oficial, OAuth)
- **`connectors_registry` con ficha de compliance obligatoria** (ADR-004): sin ficha aprobada el conector no se instancia
- Rate limit por dominio en Redis + presupuesto de requests/día + circuit breaker + kill switch
- `StorageProvider` (disco local, abstraído)
- Deduplicación de productos con `pg_trgm` + embeddings (pgvector)
- **ScoringEngine v1** con provenance, confidence, componentes, versión, rationale, riesgos y missing_data
- Estado `INSUFFICIENT_DATA` cuando la confianza agregada es baja (ADR-013)

**Frontend (`apps/web`)**
- CRUD de productos con editor de costos y **vista de economía unitaria en vivo**
- Vista de conectores: estado, cuota consumida, última sync, errores, kill switch
- Ficha de producto con métricas, **separadas visualmente por provenance** (REAL / ESTIMATED / AI_INFERENCE)
- Vista de score con desglose por componente y pesos

**Tests (críticos)**
- Cálculo de margen de contribución con casos límite (comisión %, fija, impuestos, devoluciones)
- Un conector sin ficha aprobada **no se instancia** (test que lo prueba)
- El rate limiter bloquea al superar el presupuesto y el circuit breaker abre tras N fallos
- Toda métrica insertada lleva provenance y confidence (constraint en DB + test)
- Un score con confianza baja sale como `INSUFFICIENT_DATA`, no como oportunidad

**Criterios de aceptación**
- [ ] Dado un producto y sus costos, el sistema dice si `contribution_margin > 0` y cuál es el CAC de equilibrio
- [ ] Una sync real contra MercadoLibre trae productos con métricas marcadas `REAL`
- [ ] Intentar activar un conector sin compliance falla y queda auditado
- [ ] Un producto duplicado entre dos listings se detecta y se agrupa
- [ ] La ficha de producto permite ver qué parte del score viene de datos reales

---

# HITO 3 — LA INTELIGENCIA

## FASE 4 — AI Infrastructure

**Objetivo.** Que la IA sea un componente del sistema con permisos, costos, límites y
auditoría — no un script con un prompt.

**Entidades:** `ai_agents`, `ai_tasks`, `ai_runs`, `ai_tool_calls`, `ai_costs`,
`ai_budgets`, `ai_memory`, `ai_embeddings`.

**Backend (`packages/ai`)**
- `LLMProvider` + `OllamaProvider` (API compatible OpenAI), `baseUrl` configurable
- Descarga/verificación del modelo de embeddings
- `ModelRouter` con la tabla de tiers de ADR-007 + `routing_reason` persistido
- `AICostTracker` como interceptor del provider: **ninguna llamada puede evadirlo**
- `ai_budgets` con límites diario/mensual y umbral de alerta al 80%
- Degradación controlada: presupuesto agotado → solo modelos locales; o encolar
- `ToolRegistry`: permisos, input/output schema, validación, timeout, retry con backoff,
  rate limit por (tool, agente), y **`requiresApproval` interceptado antes de ejecutar**
- `AgentRuntime`: bucle con límites de pasos, tokens, tiempo y ejecuciones/día
- `ai_embeddings` con índice HNSW y servicio de búsqueda semántica
- **Contenido externo marcado como `untrusted`** en el contexto del modelo (S1)
- Cola `ai` con concurrencia 1 para Ollama local (ADR-010)

**Agentes**
- `OrchestratorAgent` (enrutado y encadenamiento)
- `MarketingStrategyAgent`: buyer persona, propuesta de valor, ángulos, hooks, mensajes, CTA, estructura de landing
- `ContentAgent`: contenido por canal con **Brand Context aplicado** (tono, palabras prohibidas/preferidas, audiencia)

**Frontend (`apps/web`)**
- **AI Control Center**: agentes, tareas en curso, runs recientes
- Detalle de run: modelo usado, `routing_reason`, tokens, costo, latencia, tools invocadas, resultado, errores
- Vista de uso y costos con presupuestos y consumo actual
- Editor de Brand Context

**Tests**
- Tool sin permiso → `TOOL_DENIED` y run auditado
- Tool con `requiresApproval` → **no ejecuta**, crea `approvals(PENDING)` (test explícito)
- Exceder `MAX_TOKENS_PER_TASK` corta la ejecución y se registra
- Presupuesto agotado → el router degrada a local, no falla
- `AICostTracker` registra costo en una llamada hecha por código nuevo (test de no-evasión)
- El router elige el tier correcto por clase de tarea y respeta la criticidad

**Criterios de aceptación**
- [ ] Ninguna llamada a un LLM ocurre sin fila en `ai_costs`
- [ ] Puedo ver en una pantalla qué agente hizo qué, con qué modelo, cuánto costó y con qué resultado
- [ ] Un agente no puede ejecutar una tool sin permiso, verificado por test
- [ ] El Brand Context cambia de forma medible el contenido generado (tono y palabras)

---

## FASE 5 — Product Research

**Objetivo.** De un nicho a una lista priorizada con evidencia, en menos de 30 minutos.

**Entidades:** `research_runs`, `research_run_candidates` (+ uso intensivo de las de Fase 3).

**Backend**
- `ProductResearchAgent` con tools: buscar en conectores, normalizar, agrupar duplicados, calcular métricas, puntuar
- `research_runs` asíncrono: `POST` → 202 + taskId; progreso observable
- **Informe estructurado obligatorio**: datos encontrados, señales detectadas, supuestos realizados,
  riesgos, información faltante, y por qué la oportunidad es interesante (requisito §4 del prompt)
- El agente **no puede** afirmar un dato sin provenance asociada: el output schema lo exige
- Snapshot histórico para poder calcular `review_growth_30d` a partir de la segunda ejecución

**Frontend (`apps/web`)**
- Asistente de investigación: nicho, país, presupuesto → lanzar run
- Vista de progreso (SSE o polling con backoff)
- Tabla de candidatos ordenable por score, con **badge de provenance** y nivel de confianza
- Ficha de candidato: razón, riesgo, datos faltantes, evidencia por métrica
- Acciones: seleccionar / rechazar / pedir más investigación, con auditoría

**Tests**
- El output de un run sin provenance en alguna métrica es rechazado por el schema
- Un run con el conector caído completa con datos parciales y lo declara (degradación)
- Un run cancelado a mitad deja estado consistente (sin candidatos huérfanos)
- Re-ejecutar el mismo nicho a los 30 días produce `review_growth_30d` ESTIMATED

**Criterios de aceptación**
- [ ] Introduzco un nicho y obtengo candidatos priorizados en < 30 min
- [ ] Cada afirmación del informe tiene evidencia asociada o está marcada como inferencia
- [ ] Puedo ver explícitamente **qué información falta**
- [ ] Seleccionar un candidato crea el producto y dispara la Fase 6

---

# HITO 4 — LA COMERCIALIZACIÓN ★

> **Reordenado el 2026-10-01** tras la decisión de canal (ADR-016). El camino real de ingresos es
> **anuncio en Meta → lead → conversación de WhatsApp → venta**, no un e-commerce con checkout.
> La FASE 5-BIS entra primero porque es la que produce dinero; Content + SEO pasa a ser el canal
> de mediano plazo y se ejecuta después, sin perder su especificación (`docs/seo.md`).

## FASE 5-BIS — Meta (Lead Ads + Conversions API) + WhatsApp

**Objetivo.** Que un lead entre al CRM desde un anuncio de Meta, que la conversación de cierre
viva en el CRM, y que la venta vuelva a Meta como conversión para que el algoritmo optimice hacia
ventas y no hacia leads baratos.

**Entidades:** `messaging_channels`, `conversations`, `conversation_messages`,
`whatsapp_templates`, `meta_lead_submissions`, `conversion_events`
(migración `011_messaging`, §15 de `database.md`).

**Backend**
- Webhook de Meta Lead Ads: recibir `leadgen_id`, verificar firma, consultar la Graph API, crear `meta_lead_submissions` → identidad + lead + touchpoint con atribución exacta (`campaign_id`, `ad_id`, `form_id`)
- **Idempotencia por `meta_lead_id`** y job de reconciliación que recupera leads perdidos desde la Graph API
- Capa de mensajería **detrás de una interfaz** (`MessagingProvider`), con `WhatsAppCloudProvider` primero (mismo patrón que `LLMProvider` y `MarketplaceConnector`)
- Webhook entrante de WhatsApp/Messenger: recibir mensajes, crear/actualizar `conversations`, gestionar la **ventana de 24 h** (`window_expires_at`)
- Envío de mensajes: libre dentro de ventana; **solo plantilla aprobada** fuera de ella
- Ciclo de vida de plantillas: crear → `PENDING` → `APPROVED`/`REJECTED` con su categoría y costo
- `MessagingProvider` respeta `quality_rating` y `messaging_limit_tier`; un envío fallido no se pierde (estado + reintento)
- **Consentimiento (Ley 1581)**: sin opt-in registrado, un mensaje de marketing **no se envía**
- **Conversions API**: eventos `Lead` y `Purchase` encolados en el outbox, con `event_id` para deduplicar contra el píxel, y `_fbp`/`_fbc` cuando existan
- Guardar `_fbp`/`_fbc` en `touchpoints` y en `conversion_events.match_keys` (hasheados para PII)
- Registro de la venta desde la conversación: crea `order` con `closed_via`, `payment_method`, `is_cod`
- Métricas conversacionales: tiempo hasta primera respuesta, tasa conversación → venta, tasa por canal

**Frontend (`apps/web`)**
- **Bandeja de conversaciones** unificada (WhatsApp / Messenger / IG Direct) con asignación, estado y vínculo al lead
- Panel lateral con la ficha de la identidad, la **campaña y el anuncio que la originaron**, y la economía del producto
- **Cerrar venta desde la conversación**: formulario rápido que crea la orden con canal y método de pago
- Indicadores de ventana de 24 h y de plantillas disponibles en la conversación
- Vista de plantillas con su estado de aprobación en Meta
- Panel de la conexión de Meta: estado, calidad, límites, errores de webhook

**Trámite (bloqueante, iniciado en Fase 1):** app de Meta, verificación del negocio, permisos
`leads_retrieval`/`ads_management`/`business_management`, número de WhatsApp verificado, plantillas
aprobadas. **Túnel HTTPS para desarrollo** (`cloudflared`/`ngrok`): los webhooks necesitan endpoint público.

**Tests**
- Webhook con firma inválida → rechazado y auditado
- El mismo `leadgen_id` recibido dos veces → **un solo lead** (idempotencia)
- Un lead de Lead Ads llega con `campaign_id` y `ad_id` correctos, **sin cookies ni UTMs**
- Fuera de la ventana de 24 h, un envío de texto libre es **bloqueado**; con plantilla aprobada, permitido
- Un envío de marketing sin opt-in registrado es **bloqueado** (`SKIPPED_NO_CONSENT`)
- `Purchase` no se envía a Meta sin consentimiento, y sí se envía con él
- Deduplicación: mismo `event_id` desde píxel y CAPI cuenta una vez
- Un envío fallido a WhatsApp queda en estado reintentable y no se pierde
- Job de reconciliación recupera un lead cuyo webhook se perdió

**Criterios de aceptación**
- [ ] Publico un anuncio con formulario instantáneo y **el lead aparece en el CRM en segundos con su campaña y anuncio**
- [ ] Cierro una venta desde la conversación de WhatsApp y **la orden queda con canal, método de pago y margen**
- [ ] La conversión `Purchase` llega a Meta (verificado en Events Manager)
- [ ] Ningún mensaje de marketing sale sin consentimiento ni sin plantilla aprobada
- [ ] Puedo ver el tiempo hasta primera respuesta y la tasa conversación → venta por campaña
- [ ] **★ Aquí el sistema puede generar ventas reales con el canal que realmente usas**

---

## FASE 6 — Content + SEO (canal de mediano plazo)

**Objetivo.** Construir el canal orgánico, que no produce ventas la primera semana pero compone.
Se ejecuta **después** de la 5-BIS, porque el dinero ya entra por Meta + WhatsApp.

**Alcance recortado respecto al plan original:** `apps/site` se limita en esta fase a landing de
producto, página de gracias y políticas (privacidad, tratamiento de datos — **la política pública
también es un requisito del trámite de Meta**). El blog, los clusters de keywords y el resto del
SEO Content Engine se implementan aquí, pero ya no son el camino crítico de ingresos.

**Entidades:** `brands`, `brand_assets`, `content`, `content_links`, `keywords`,
`keyword_clusters`, `keyword_cluster_members`, `content_briefs`, `seo_index_status`.

**Backend**
- CMS: CRUD de contenido con estados `DRAFT → IN_REVIEW → APPROVED → PUBLISHED`
- **Sanitización de HTML en servidor al guardar** con allowlist (S2) — no solo al renderizar
- Pipeline SEO: keywords → clustering por embeddings (pgvector) → intent → brief → contenido
- **Detección de canibalización** antes de publicar (target_keyword + similitud semántica)
- Detección de contenido duplicado por embedding
- Generación de sitemap.xml por job (solo contenido publicado)
- Integración Search Console → `seo_index_status`
- `SEOAgent` con tools: investigar keywords, clusterizar, brief, metadata, JSON-LD, enlaces internos

**Generación de imagen/video:** en esta fase solo se generan **prompts** (`creatives.generation_prompt`).
La generación real es Post-MVP (`ImageGenerationProvider` / `VideoGenerationProvider`).

**Frontend (`apps/web`)**
- CMS con editor, preview, estados y aprobación
- Vista de cluster: keywords, briefs, contenidos, huecos
- Vista SEO: indexación, posiciones, alertas de caída
- Vista de canibalización con acción de consolidación

**Frontend (`apps/site`)** — aquí está el SEO que importa
- Render de landings y blog con SSR/prerender
- JSON-LD (Organization, WebSite, BreadcrumbList, Product+Offer, Article, FAQPage)
- canonical autorreferencial, OG, Twitter cards, HTML semántico, un solo h1
- 404 real (HTTP 404), 301 para URLs cambiadas, paginación con canonical propio
- `NgOptimizedImage`, fuentes autohospedadas, CSS crítico
- **Presupuesto de Core Web Vitals verificado en CI**
- Consentimiento y política de privacidad

**Tests**
- El HTML prerenderizado contiene title único, meta, canonical, OG y JSON-LD válido (schema.org)
- `/robots.txt` y `/sitemap.xml` se sirven correctamente y no caen al fallback de SPA
- Una URL inexistente devuelve **HTTP 404** (no 200)
- Contenido con HTML malicioso generado por IA queda sanitizado al guardarse
- Dos contenidos compitiendo por la misma keyword disparan alerta de canibalización

**Criterios de aceptación**
- [ ] Publico una landing y su HTML prerenderizado pasa la validación de structured data
- [ ] `sitemap.xml` incluye la landing y excluye borradores
- [ ] `apps/site` cumple el presupuesto de CWV en CI
- [ ] Search Console conectado y mostrando estado de indexación
- [ ] El contenido generado respeta el Brand Context

---

## FASE 7 — Campaign Engine + Attribution + Approvals

**Objetivo.** Preparar una campaña lista para ejecutar y saber de dónde vino cada venta.

**Entidades:** `campaigns`, `campaign_state_transitions`, `campaign_platforms`, `ad_sets`,
`ads`, `creatives`, `approvals`, `orders`, `order_items`, `order_attribution`.

**Backend**
- Campaign Engine con **máquina de estados validada en el dominio** y transiciones auditadas
- `POST /campaigns/:id/transition` con precondiciones, actor y `approval_id` obligatorio para `ACTIVE`
- **Templates de campaña como datos** con `kpi_primary` por template (§H.4)
- **Guardrails de presupuesto implementados y testeados ahora**, aunque la automatización no exista (ADR-005)
- `AdvertisingAgent` (solo borradores): propone campaña, ad set, audiencia, creativos, copy, presupuesto, bid strategy, objetivo, evento de conversión y experimento
- `approvals`: crear, aprobar, rechazar, modificar; **revalidación del payload contra el schema de la tool al ejecutar**
- Captura de UTM + click_id (`fbclid`/`gclid`/`ttclid`) en `apps/site`
- Ingreso de órdenes (manual en el MVP) con `total_cost` por línea
- Job de atribución: `LAST_TOUCH` + `FIRST_TOUCH` sobre touchpoints crudos (ADR-014)
- Stubs de conectores Meta/Google Ads (sin publicar), listos para Fase Post-MVP

**Frontend (`apps/web`)**
- Wizard de campaña guiado por template, con validación en cada paso
- Editor de borradores con vista previa de anuncios
- **Bandeja de aprobaciones** con la propuesta exacta, la razón del agente y el riesgo evaluado
- Vista de campaña con estado, historial de transiciones y motivo de cada cambio
- Pantalla "¿de dónde vino esta venta?" con la cadena completa de touchpoints

**Tests**
- Transición `DRAFT → ACTIVE` sin `approval_id` falla
- Transición inválida (`ARCHIVED → ACTIVE`) rechazada con 409
- Un cambio de presupuesto que excede `MAX_BUDGET_CHANGE_PERCENTAGE` se bloquea aunque venga del humano (requiere confirmación explícita)
- Aprobar una propuesta con payload alterado no la ejecuta (revalidación de schema)
- Atribución: venta con 3 touchpoints genera filas `LAST_TOUCH` y `FIRST_TOUCH` correctas
- El mismo webhook procesado dos veces no duplica orden (idempotencia)

**Criterios de aceptación**
- [ ] Puedo crear una campaña completa en modo DRAFT a partir de un producto y una landing
- [ ] Ninguna campaña llega a `ACTIVE` sin aprobación humana registrada
- [ ] Los guardrails de presupuesto están probados aunque la automatización no exista
- [ ] Puedo responder "¿de dónde vino esta venta?" con la cadena de touchpoints
- [ ] **★ Aquí el sistema puede empezar a generar ventas reales**

---

# HITO 5 — EL APRENDIZAJE ★

## FASE 8 — Analytics

**Objetivo.** Decidir dónde poner dinero, con margen y no solo con revenue.

**Entidades:** `campaign_metrics_daily`, `campaign_financials_daily`, `jobs_audit`, `webhook_events`, `feature_flags`.

**Backend**
- Ingesta y normalización de métricas (carga manual en el MVP; APIs en Post-MVP)
- Rollups por job (no cálculo en la request del dashboard)
- **Definición única y documentada de cada métrica** (CTR, CPC, CPM, CPA, CAC, ROAS, ROI, AOV, LTV).
  El dashboard consume la fórmula, no la reinventa
- `campaign_financials_daily` con margen de contribución real
- `AnalyticsAgent`: detecta anomalías, explica variaciones, propone hipótesis
- `CRMIntelligenceAgent`: prioriza leads, sugiere siguiente acción
- Centro de control: agentes, jobs, colas, errores, costos de IA, salud del sistema, conectores

**Frontend (`apps/web`)**
- Dashboard: revenue, órdenes, conversión, **margen de contribución**, ad spend, CAC, CPA, ROAS, ROI, AOV, LTV
- **Revenue / Profit / ROAS / ROI visualmente diferenciados, con su fórmula a un clic** (§33)
- Comparativa de campañas ordenable por margen, no solo por revenue
- Embudo con conversión entre cada etapa y punto de fuga
- Centro de control del sistema

**Tests**
- Los agregados del rollup cuadran con el cálculo desde órdenes crudas (test de consistencia)
- ROAS y ROI dan resultados distintos con los mismos datos (test que fija las fórmulas correctas)
- El margen por campaña resta envío, fees, impuestos y devoluciones
- Una campaña con revenue alto y margen negativo aparece como tal, no como "ganadora"

**Criterios de aceptación**
- [ ] Puedo ver **margen de contribución** por campaña, no solo revenue
- [ ] Cada KPI del dashboard muestra su fórmula
- [ ] El embudo muestra dónde se pierden más leads
- [ ] El centro de control muestra el estado y el costo de todo el sistema

---

## FASE 9 — Automation

**Objetivo.** Automatizar dentro de límites probados, con aprobación humana por defecto.

**Entidades:** `experiments`, `feature_flags`, `ai_budgets` (extendida).

**Backend**
- Motor de automatizaciones: `IF condición THEN acción`, declaradas como datos, con `feature_flag` para activar
- `BudgetOptimizationAgent`: analiza spend, CPC, CPM, CTR, conversión, CPA, CAC, ROAS, revenue, margen, profit → propone aumentar/reducir/pausar/ajustar audiencia/creativo/copy/experimento
- **Toda propuesta de gasto pasa por `approvals`** (ADR-005)
- `BudgetGuard` como capa de validación del dominio: `MAX_DAILY_BUDGET`, `MAX_CAMPAIGN_BUDGET`, `MAX_AUTOMATED_SPEND`, `MAX_BUDGET_CHANGE_PERCENTAGE`, `BUDGET_COOLDOWN_HOURS`
- `ExperimentEngine`: hipótesis, variantes, métrica, tamaño de muestra, resultado, decisión
- Automatizaciones iniciales: `product_score > umbral → crear revisión`, `CPA > umbral → alerta`, `lead_created → tarea de seguimiento`, `order_paid → flujo post-compra (propuesta)`

**Frontend (`apps/web`)**
- Constructor de automatizaciones con simulador ("qué habría pasado con estos datos")
- Panel de experimentos con estado y resultado
- Panel de guardrails: límites actuales y consumo

**Tests**
- Ninguna automatización puede superar un límite, ni con datos manipulados
- Un cambio de presupuesto automático dentro del cooldown es rechazado
- Simulador de automatización no ejecuta acciones reales (test explícito)
- El sistema degrada correctamente si el proveedor de IA falla a mitad de una propuesta

**Criterios de aceptación**
- [ ] Puedo activar una automatización con una feature flag y verla proponer acciones
- [ ] Ningún cambio de gasto ocurre sin aprobación
- [ ] Los guardrails están probados con intentos de exceso
- [ ] El simulador predice sobre datos históricos sin efectos reales

---

## FASE 10 — Production Infrastructure

**Objetivo.** Que esto corra sin que estés mirando.

- VPS o cloud con Compose; Ollama en el host o proveedor remoto
- Backups automáticos de Postgres **con restauración probada** (no basta con tener backups)
- CDN para `apps/site`; TLS; dominios; Search Console verificado
- Observabilidad productiva: métricas, alertas, Sentry, dashboards
- CI/CD completo: staging automático, producción con aprobación
- Runbook: qué hacer si cae Postgres / Redis / un conector / Ollama
- Hardening de seguridad: headers, CSP, revisión de permisos, rotación de secretos
- Alertas de costo de IA y de presupuesto agotado

**Criterios de aceptación**
- [ ] Restauro un backup en un entorno limpio y verifico integridad (ejercicio real, documentado)
- [ ] Una caída de Ollama degrada el sistema sin tumbar el CRM
- [ ] Un deploy a producción tiene rollback probado
- [ ] Recibo alerta si el costo de IA o el gasto superan umbrales

---

## FASE 11 — Scaling (Post-MVP)

Sin fecha. Se aborda cuando el cuello de botella sea real, no anticipado.

- Conectores adicionales (Amazon PA-API cuando cualifique, AliExpress, feeds de tiendas)
- `ImageGenerationProvider` / `VideoGenerationProvider` reales con abstracción de proveedor
- Automatización dentro de límites con `feature_flag` por capacidad
- Multi-organización si aparece un segundo inquilino
- Modelos de atribución multi-touch
- ClickHouse **solo** para eventos si superan decenas de millones de filas
- Particionado de `touchpoints`, `audit_logs`, `outbox_events` por fecha
- Réplicas de lectura; separar el worker a su propio host
- Migración a servicios gestionados (RDS, Redis gestionado, S3)

---

## Riesgos por hito

| Hito | Riesgo principal | Mitigación |
|---|---|---|
| 1 | Docker/WSL2 no instalado; fricción de entorno en Windows | Tarea explícita con tiempo; el código se escribe sin Docker, la integración espera |
| 2 | Modelo de identidad mal diseñado → duplicados irrecuperables | Resolver `anonymous_id` + fusión **antes** de tener datos reales |
| 3 | Score con datos mayoritariamente estimados genera falsa confianza | ADR-013: provenance obligatoria + puerta de economía + `INSUFFICIENT_DATA` |
| 3 | Un solo conector disponible (MercadoLibre) | Diseñar el pipeline para funcionar con una fuente; fallback manual documentado |
| 4 | **Saltarse la puerta y publicar sin SEO correcto** | Checklist SEO en CI, no en la cabeza |
| 4 | Publicación accidental de campaña | ADR-005: el permiso no existe para agentes |
| 5 | Confundir revenue con profit | Fórmulas únicas centralizadas + test que las fija |
| 5 | El scoring nunca se recalibra → el ciclo no cierra | La recalibración es un criterio de aceptación del Hito 5, no un extra |
| Todos | Sobreingeniería por el volumen del prompt | ADR-002/009/010/012 y el alcance negativo de §M.2 |
