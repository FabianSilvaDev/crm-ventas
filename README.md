# CRM de Ventas + Plataforma de Marketing con IA

Plataforma interna de uso propio que cierra el ciclo comercial completo:

> nicho → investigación → productos → selección → estrategia → contenido → landing → SEO →
> campaña → publicidad → leads → ventas → analítica → optimización

**Estado actual: Hito 1 (Cimientos) en curso — Sprint 1, rebanada «webhook de Meta + pantalla de
leads» terminada.**
Ya hay código, y pasa las verificaciones: `tsc -b` en 0, typecheck en 0 y **193 tests en verde**.

| Ya existe | Contenido |
|---|---|
| `packages/contracts` | Catálogo de **43 errores** con `type`/`docs` derivados (no pueden divergir) y los esquemas Zod compartidos: identidad, leads y webhooks de Meta · 53 tests |
| `apps/api` | Esqueleto NestJS: `/health/live`, `/health/ready`, problem+json conforme a RFC 9457 con `traceId`, validación de entorno fail-fast y **webhook de Meta Lead Ads**: handshake, firma HMAC sobre el cuerpo crudo, rate limit por IP, cliente de Graph API sustituible por fixtures · 102 tests |
| `apps/web` | Angular 22 zoneless: «Estado del sistema» y **«Leads»** (tabla, enlace `wa.me`, estado honesto cuando el API aún no puede dar datos) · 38 tests |
| `apps/api/scripts` | `send-signed-webhook.mjs`: prueba el webhook de punta a punta sin cuenta de Meta |

**Lo que esta rebanada NO hace, dicho sin adornos: no produce un lead.** El webhook recibe, verifica
y valida, pero **no persiste** — no hay base de datos en esta máquina (`docker`, `psql`, `pg_ctl` y
el puerto 5432: nada disponible). `{received:true}` significa «el sobre pasó todas las puertas», no
«hay un lead guardado». La elección de Postgres es la puerta siguiente.
Ver [`docs/manual.md`](docs/manual.md) §9.

**Pendiente del hito:** ESLint + CI (con detección de drift del contrato), Prisma y migraciones, el
esqueleto de `apps/site`, y la instrumentación (pino + OTel).
Ver [`docs/roadmap.md`](docs/roadmap.md).

---

## Documentación

Toda la documentación vive en `docs/`. Orden de lectura recomendado:

| Documento | Contenido |
|---|---|
| [`docs/manual.md`](docs/manual.md) | **Empieza aquí para usarlo.** Instalación, arranque, comandos, la interfaz, diagnóstico y problemas conocidos |
| [`docs/architecture.md`](docs/architecture.md) | **El contrato.** Invariantes, fronteras, autoridad documental y mapa de documentos. El que se consulta mientras se escribe código |
| [`docs/architecture-review.md`](docs/architecture-review.md) | **Empieza aquí para el análisis.** Análisis arquitectónico completo A–O: visión, arquitectura, stack, estructura del repo, modelo de datos, API, IA, marketing, SEO, DevOps, seguridad, escalabilidad, MVP, roadmap, Sprint 1 y riesgos. Fechado: **no es autoridad** |
| [`docs/decisions.md`](docs/decisions.md) | 23 ADR con contexto, decisión, consecuencias y alternativas descartadas, más las enmiendas y la deuda registrada (I12). **Autoridad final** |
| [`docs/roadmap.md`](docs/roadmap.md) | 11 fases agrupadas en 5 hitos con puertas de salida y criterios de aceptación |
| [`docs/database.md`](docs/database.md) | Modelo de datos, provenance, orden de migración y qué NO se crea |
| [`docs/api.md`](docs/api.md) | Contratos REST, errores, auth, idempotencia, catálogo de endpoints |
| [`docs/ai-agents.md`](docs/ai-agents.md) | LLMProvider, ModelRouter, ToolRegistry, agentes, memoria, observabilidad |
| [`docs/security.md`](docs/security.md) | Modelo de amenazas, RBAC, prompt injection, guardrails, cumplimiento |
| [`docs/seo.md`](docs/seo.md) | SSR/prerender, checklist técnico, JSON-LD, Search Console, content engine |
| [`docs/marketing.md`](docs/marketing.md) | Funnel, templates, economía unitaria, atribución, KPIs, experimentación |
| [`docs/design-system.md`](docs/design-system.md) | Tokens, primitivas, reglas de accesibilidad y cómo se añade una pantalla |
| [`docs/deployment.md`](docs/deployment.md) | Entorno local, Compose, Dockerfiles, CI/CD, backups, runbook |

---

## Decisiones estructurales (resumen)

| Decisión | Elección |
|---|---|
| **Canal de venta** | **Meta Ads → lead capturado → cierre por WhatsApp** en Colombia. El cierre es conversacional, no hay checkout (ADR-016) |
| Arquitectura | Monolito modular NestJS + worker BullMQ separado |
| Frontend | **Dos apps Angular**: `apps/web` (CRM interno, SPA, noindex) y `apps/site` (público, SSR, indexable) |
| Monorepo | pnpm workspaces (sin Nx, sin Turborepo) |
| Base de datos | PostgreSQL + pgvector (sin base vectorial dedicada). Vectores a **768 dims** con modelo registrado por fila (ADR-019) |
| Colas | Redis + BullMQ con scheduler embebido (sin servicio aparte) |
| Eventos | Outbox transaccional (sin Kafka) |
| API | REST `/api/v1` + OpenAPI desde Zod + cliente Angular generado |
| IA | `LLMProvider` + `ModelRouter` con **routing híbrido**: Ollama local para volumen, modelos remotos para calidad |
| Human-in-the-loop | Propiedad del `ToolRegistry`, no instrucción al modelo |
| Métricas | Provenance obligatoria: `REAL` / `ESTIMATED` / `AI_INFERENCE` |

Razones completas de cada una en [`docs/decisions.md`](docs/decisions.md).

---

## Entorno verificado

| Recurso | Estado |
|---|---|
| Node.js | v24.19.0 ✅ |
| npm | 11.17.0 ✅ |
| Git | 2.52.0 ✅ |
| Ollama | 0.34.3, corriendo en `:11434` ✅ (gemma4:8b, gemma4:26b, qwen3.6:36b, modelos `:cloud`) |
| GPU | ❌ ninguna — inferencia local CPU-only, ~5-8 tok/s en 8B |
| CPU / RAM | i7-1255U (10C/12T) / 32 GB |
| pnpm | ❌ no global — se usa vía **`corepack pnpm`** (12.8.1, la de `packageManager`) ✅ |
| Docker / Compose | ❌ ausente |
| WSL2 | ❌ ausente (prerequisito de Docker Desktop, requiere admin + reinicio) |

Los prerequisitos pendientes son tareas del Sprint 1, no bloquean la escritura de código.
Ver [`docs/deployment.md`](docs/deployment.md).

---

## Principio central

```
DATA → INTELLIGENCE → DECISION → CONTENT → CAMPAIGN → TRAFFIC
     → LEAD → SALE → ANALYTICS → LEARNING → OPTIMIZATION
```

La parte que decide si esto vale o no es **LEARNING**: que las métricas reales de campaña
recalibren las estimaciones del scoring. Sin ese paso, el sistema acumula datos pero no
aprende, y el Product Scoring Engine es decoración. Está implementado como criterio de
aceptación del Hito 5, no como una intención.

---

## Principios de trabajo

1. Simplicidad antes que completitud.
2. Observabilidad antes que potencia.
3. Seguridad como arquitectura, no como instrucción al modelo.
4. Costos medidos desde la primera llamada a un LLM.
5. Automatización con aprobación humana hasta que los límites estén probados.
6. Ninguna tecnología por moda.

---

## Siguiente paso

**La puerta está cerrada y es una sola: elegir PostgreSQL.** No hay `docker`, ni `psql`, ni nada
escuchando en el 5432, y sin base de datos el proyecto no puede dar el paso que le falta:
**persistir el primer lead**. El webhook ya está construido hasta ese borde y esperándola.

La decisión es entre **Postgres nativo en el host** (sin Docker, instalable hoy, pero hay que
gestionarlo a mano) y **Postgres gestionado en la nube** (Neon, Supabase, RDS: sin administración,
pero es un servicio externo y de pago a partir de cierto uso). Las dos son válidas; lo que no es
válido es seguir sin elegir, porque bloquea el Hito 2 entero.

Con esa decisión tomada, el orden ya está escrito en
[`docs/database.md`](docs/database.md) §13: `prisma@~7.10.0` + `@prisma/client@~7.10.0` (**fijadas**:
`prisma@latest` resuelve a un release candidate y deja el CLI y el cliente en majors distintas),
`allowBuilds` en `pnpm-workspace.yaml`, las migraciones `0001_core_min` y `0002_lead_ingestion`, y la
ingesta real.

**En paralelo, y sin depender de nada de lo anterior:** iniciar los trámites con Meta (app,
verificación del negocio, permisos `leads_retrieval`/`ads_management`/`business_management`, número de
WhatsApp Business, plantillas). Tardan **semanas** y son el bloqueante de mayor plazo del proyecto.
El handshake del webhook ya está implementado y funcionando, que es exactamente lo que Meta pide para
validar el endpoint.

No se avanza de fase sin confirmación explícita.
