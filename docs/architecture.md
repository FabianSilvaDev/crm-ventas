# Arquitectura — contrato e invariantes

> **Qué es este documento.** No repite el razonamiento del diseño: eso está en
> [`architecture-review.md`](architecture-review.md) y en los ADR. Este documento es el **contrato
> estable** y el **mapa**: qué está congelado, qué no se puede romper nunca, quién manda cuando dos
> documentos se contradicen, y dónde vive cada tema. Es el documento que se consulta **mientras se
> escribe código**.
>
> Se mantiene corto a propósito. Un segundo documento de 1.400 líneas duplicando al review sería una
> segunda fuente de verdad, y una segunda fuente de verdad es la forma más fiable de que las dos se
> contradigan.

---

## 1. Autoridad documental

Cuando dos documentos discrepen —y discreparán— el orden es:

| Prioridad | Documento | Qué gobierna |
|---|---|---|
| 1 | [`decisions.md`](decisions.md) | Los ADR. **Autoridad final.** Una decisión, una vez aceptada, gana sobre cualquier prosa |
| 2 | **este documento** | Los invariantes y las fronteras. Si el código los viola, el código está mal |
| 3 | Los documentos de tema | El detalle de cada área (`database.md`, `api.md`, …) |
| 4 | [`architecture-review.md`](architecture-review.md) | **Fechado. No es autoridad.** Es el análisis que originó las decisiones, con sus preguntas abiertas de entonces |

**Regla práctica:** si `database.md` dice `vector(1536)` y `decisions.md` dice 768, gana 768 y hay
que corregir `database.md`. Ese caso ocurrió de verdad (ADR-019) y es exactamente el fallo que este
orden existe para prevenir.

**Estado:** 20 ADR aceptados (ADR-001 … ADR-020). No hay código de aplicación escrito.

---

## 2. Vista de componentes

Monolito modular, no microservicios. Dos procesos desplegables del backend, dos frontends.

```
                    ┌──────────────────┐        ┌──────────────────┐
   uso interno      │    apps/web      │        │    apps/site     │   público
   (CRM)            │  Angular SPA     │        │  Angular SSR +   │   (indexable)
                    │  noindex, auth   │        │  prerender       │
                    └────────┬─────────┘        └────────┬─────────┘
                             │                           │
                             │  cliente generado desde OpenAPI (Zod → OpenAPI → TS)
                             ▼                           ▼
                    ┌────────────────────────────────────────────────┐
                    │                apps/api (NestJS)               │
                    │   REST /api/v1 · guards · validación Zod       │
                    │   Application Services (módulos de dominio)    │
                    │            ↕  outbox transaccional             │
                    └───────┬────────────────────────────┬───────────┘
                            │                            │
                            ▼                            ▼
                    ┌───────────────┐            ┌───────────────┐
                    │  PostgreSQL   │            │ Redis + BullMQ│
                    │  + pgvector   │            │  (+ scheduler │
                    │               │            │    embebido)  │
                    └───────▲───────┘            └───────┬───────┘
                            │                            │
                            │                    ┌───────▼────────────┐
                            └────────────────────┤ apps/worker        │
                                                 │ (proceso aparte)   │
                                                 │ jobs · conectores  │
                                                 │ agentes IA         │
                                                 └───────┬────────────┘
                                                         │
                                          ┌──────────────┴──────────────┐
                                          ▼                             ▼
                                  ┌───────────────┐            ┌───────────────┐
                                  │ Ollama nativo │            │ Meta Ads /    │
                                  │ :11434 (host) │            │ WhatsApp /    │
                                  │  + LLM remoto │            │ Marketplaces  │
                                  └───────────────┘            └───────────────┘
```

**Por qué dos procesos y no uno.** El worker corre jobs largos (scraping, LLM, sincronización de
métricas). Si viviera dentro de `apps/api`, un job de 30 minutos competiría por el event loop con
las peticiones del CRM. Separarlo es una decisión de disponibilidad, no de escala: **no** son
microservicios, comparten el mismo código de dominio y la misma base de datos (ADR-001).

---

## 3. Invariantes

Estos son los puntos que **no se pueden romper** sin una decisión explícita que los sustituya. Cada
uno tiene un mecanismo que lo hace cumplir y un test que lo verifica. Si al implementar algo hay que
violar uno, eso no es un detalle de implementación: es un ADR nuevo.

### Aislamiento y autorización

| # | Invariante | Mecanismo | Dueño |
|---|---|---|---|
| **I1** | Los datos de una organización son inalcanzables desde una petición de otra | `organization_id` forzado en la capa de datos; nunca en la cláusula `WHERE` del desarrollador | ADR-011 |
| **I2** | Un actor nunca puede más que quien lo invoca: `effective = agente ∩ usuario` | Composición en el `ToolRegistry`, no en el prompt | ADR-005 |
| **I3** | Un run delegado hereda la **intersección**, no los permisos del agente destino | `permisos(run_delegado) = permisos(agente_delegado) ∩ permisos_efectivos(run_que_delega)`; `MAX_DELEGATION_DEPTH = 1` | **ADR-020** |
| **I4** | Una tool cuyo permiso exige aprobación **no puede** declarar lo contrario | `ToolRegistry` lo verifica **al arrancar** y aborta si falla | **ADR-020** |
| **I5** | Seis permisos no se conceden jamás a un agente | `MVP_FORBIDDEN_AGENT_PERMISSIONS` + test de invariante de configuración | **ADR-020** |

Los seis prohibidos para agentes: `PUBLISH_CAMPAIGN`, `CHANGE_BUDGET`, `DELETE_ANY`,
`MANAGE_AGENTS`, `MANAGE_SYSTEM`, `EXPORT_DATA`.

### IA y costo

| # | Invariante | Mecanismo | Dueño |
|---|---|---|---|
| **I6** | Un agente **no** puede emitir SQL, ni llamar a Prisma, ni leer una tabla | La capacidad no existe: solo invoca tools registradas | ADR-005 |
| **I7** | Toda llamada a un LLM pasa por el contador de costo, sin excepción | `AICostTracker` como **decorador del `LLMProvider`**, no como llamada que el código deba recordar | ADR-007 |
| **I8** | Ningún agente gasta dinero sin aprobación humana en el MVP | `MAX_AUTOMATED_SPEND = 0.00` | ADR-005 |
| **I9** | Toda métrica declara su procedencia | `REAL` / `ESTIMATED` / `AI_INFERENCE` obligatorio; un `REAL` sin `source_id` es inválido | ADR-013 |
| **I10** | El gasto publicitario lo decide la **economía unitaria**, no el score | La puerta es `contribution_margin > 0` **y** `cac_estimado < contribution_margin` | ADR-013 |

### Datos

| # | Invariante | Mecanismo | Dueño |
|---|---|---|---|
| **I11** | Toda columna vectorial es `vector(768)` y toda fila con vector registra su modelo | Esquema + `embedding_model` + job de re-embedding por `IS DISTINCT FROM` | **ADR-019** |
| **I12** | Un cambio de estado y su evento salen en la **misma transacción** | Outbox transaccional; el publisher es un job, no el service | ADR-009 — ⚠️ **incumplido a 2026-10-01**: `outbox_events` no existe y no hay consumidor. Deuda con fecha, en `decisions.md` |
| **I13** | El margen histórico es reproducible | `product_costs` versionado por fecha; nunca se sobrescribe | ADR-013 |
| **I14** | La atribución se calcula, no se guarda como campo fijo | Job sobre `touchpoints` append-only | ADR-014 |

### Contrato y proceso

| # | Invariante | Mecanismo | Dueño |
|---|---|---|---|
| **I15** | El contrato de API tiene **una** fuente | Zod en `packages/contracts` → OpenAPI → cliente generado. El CI **falla** si hay drift | ADR-012 |
| **I16** | Nada llega a producción sin aprobación humana | Job de deploy con aprobación manual obligatoria | §J |
| **I17** | Todo cambio de estado de campaña queda auditado | `campaign_state_transitions`, insert-only | ADR-005 |

---

## 4. Fronteras y reglas de dependencia

```
apps/api ─┐
apps/worker ─┤
apps/web ───┼──► packages/*        ← una sola dirección
apps/site ──┘
```

| Regla | Por qué |
|---|---|
| `apps/*` puede depender de `packages/*`; **nunca al revés** | Un paquete que importa una app no es un paquete |
| `packages/domain` **no hace I/O** | Es donde vive la economía unitaria y el scoring: lógica pura, testeable sin base de datos |
| `apps/web` y `apps/site` **no se importan entre sí** | Tienen ciclos de vida distintos; compartir código va en `packages/ui` |
| Un módulo de dominio no importa el repositorio de otro módulo | Se pasa por el servicio, no por la tabla |
| Los agentes **no** son un módulo de dominio más: solo hablan por tools | I6 |

---

## 5. Mapa de documentos

| Tema | Dueño |
|---|---|
| Análisis, alternativas y preguntas abiertas originales | [`architecture-review.md`](architecture-review.md) |
| Decisiones (autoridad final) | [`decisions.md`](decisions.md) |
| Fases, hitos, puertas de salida | [`roadmap.md`](roadmap.md) |
| Tablas, columnas, migraciones | [`database.md`](database.md) |
| Endpoints, errores, auth, idempotencia | [`api.md`](api.md) |
| Agentes, tools, memoria, observabilidad | [`ai-agents.md`](ai-agents.md) |
| Amenazas, RBAC, prompt injection, Ley 1581 | [`security.md`](security.md) |
| SSR, prerender, JSON-LD, content engine | [`seo.md`](seo.md) |
| Funnel, templates, economía unitaria, KPIs | [`marketing.md`](marketing.md) |
| Entorno, Compose, CI/CD, backups, runbook | [`deployment.md`](deployment.md) |

---

## 6. Lo que esta arquitectura **no** es

Exclusiones deliberadas. Si alguna vez se añaden, es un ADR, no una dependencia nueva.

| No hay | Por qué |
|---|---|
| Microservicios | Un desarrollador. El coste operativo no compra nada a esta escala (ADR-001) |
| Kafka / RabbitMQ | El outbox sobre Postgres ya da entrega fiable; un bus añade un sistema que mantener (ADR-009) |
| GraphQL / tRPC | REST + OpenAPI genera el cliente Angular y se puede inspeccionar con `curl` (ADR-012) |
| Base vectorial dedicada | 10k–100k vectores caben en Postgres, que ya está (ADR-008) |
| Kubernetes | Compose basta hasta el nivel 2 de escalado (ADR-015 / §L) |
| Checkout / pasarela de pago | El cierre es conversacional (ADR-016) |
| Servicio de scheduler aparte | `upsertJobScheduler()` de BullMQ (ADR-010) |
| Ollama en contenedor | Corre nativo en el host; contenedorizarlo le quitaría la GPU si algún día hay (ADR-015) |

---

## 7. Decisiones abiertas

Deuda consciente, con dueño y con el momento en que debe resolverse. No son olvidos.

| Abierta | Cuándo debe cerrarse | Impacto si se cierra tarde |
|---|---|---|
| **Modelo de abastecimiento y contra-entrega (COD)** | Antes de la puerta de economía unitaria (Fase 3) | Con COD la tasa de devolución pasa de ~5% a 15–30%: cambia el margen de contribución y puede invalidar productos que hoy "parecen" rentables |
| Dominio propio | Antes de la verificación de negocio de Meta | Bloquea el Hito 4 y Search Console |
| Proveedor de IA para tareas de calidad | Antes de la primera tarea Tier 3 en producción | No bloquea: la abstracción `LLMProvider` cubre local y remoto |
| Verificación del negocio en Meta | **Iniciar en el Sprint 1** | Es el plazo más largo del proyecto y bloquea el camino de ingresos |

---

## 8. Cómo se usa este documento

1. Antes de escribir código de una fase: lee los invariantes (§3) que toque esa fase.
2. Al terminar: comprueba que ninguno se ha violado. Si hay que violar uno, para y propón un ADR.
3. Los invariantes no son buenas intenciones: cada uno tiene un test en el CI. Un invariante sin test
   es un comentario.
