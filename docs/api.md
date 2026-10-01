# API — Contrato HTTP

> Documento de contrato del API de la plataforma. Versión 1.0 — 2026-10-01.
> Congela las decisiones de `architecture-review.md` §F, ADR-012 y ADR-005.
> Fuente única de verdad del contrato: los esquemas **Zod** de `packages/contracts`.
> Este documento describe el contrato; no lo sustituye. Si hay divergencia, manda el código.

---

## Índice

1. [Convenciones generales](#1-convenciones-generales)
2. [Errores: RFC 9457 y códigos de dominio](#2-errores-rfc-9457-y-códigos-de-dominio)
3. [Autenticación](#3-autenticación)
4. [Autorización](#4-autorización)
5. [Rate limiting](#5-rate-limiting)
6. [Idempotencia](#6-idempotencia)
7. [Patrón de tarea asíncrona](#7-patrón-de-tarea-asíncrona)
8. [Webhooks entrantes](#8-webhooks-entrantes)
9. [Catálogo de endpoints del MVP](#9-catálogo-de-endpoints-del-mvp)
10. [Ejemplos completos](#10-ejemplos-completos)
11. [Contratos de tools de agente](#11-contratos-de-tools-de-agente)
12. [Política de evolución del API](#12-política-de-evolución-del-api)
13. [Testing de contrato y detección de drift](#13-testing-de-contrato-y-detección-de-drift)

---

## 1. Convenciones generales

### 1.1 Estilo y versionado

| Aspecto | Decisión |
|---|---|
| Estilo | **REST** sobre HTTP/1.1 y HTTP/2. Sin GraphQL, sin tRPC (ADR-012) |
| Prefijo | `/api/v1` — la versión vive en la **ruta**, no en una cabecera |
| Generación | OpenAPI 3.1 generado desde Zod (`packages/contracts`), cliente Angular generado con `openapi-typescript` |
| Content-Type | `application/json; charset=utf-8` en request y response |
| Content-Type de error | `application/problem+json` (RFC 9457) |
| Endpoints de infra | `/health/live`, `/health/ready`, `/metrics` — **fuera** de `/api/v1`, sin versionar |
| Endpoints públicos | `/api/v1/public/*` — consumidos por `apps/site`, sin autenticación, rate-limited |
| Lógica de negocio | Nunca en controllers: `Controller → Service → Domain → Repository` (§F.2) |

Un cambio incompatible **no** se hace dentro de `/api/v1`. Se crea `/api/v2` (§12).

### 1.2 Formato de respuesta

Recurso individual:

```json
{
  "id": "0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77",
  "name": "Audífonos Bluetooth TWS Pro",
  "status": "CANDIDATE",
  "createdAt": "2026-09-28T09:14:03.117Z",
  "updatedAt": "2026-10-01T14:22:31.482Z"
}
```

Listado paginado (cursor, §1.5):

```json
{
  "items": [
    {
      "id": "0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77",
      "status": "NEW",
      "source": "paid",
      "createdAt": "2026-10-01T14:22:31.482Z"
    }
  ],
  "pageInfo": {
    "nextCursor": "eyJrIjpbIjIwMjYtMTAtMDFUMTQ6MjI6MzEuNDgyWiIsIjAxOThmMmMxIl19",
    "hasNextPage": true
  }
}
```

Reglas:

- **No** se envuelve el recurso en `{ "data": … }`. El payload es el recurso o el listado.
- Los campos con valor nulo se **omiten** salvo que el nulo sea semánticamente distinto de la ausencia (p. ej. `decided_at` en `approvals`). En ese caso se envía `null` explícito.
- Las mutaciones devuelven el recurso resultante, no un `{ "success": true }`.
- `201 Created` incluye cabecera `Location` con la URL del recurso.
- `204 No Content` solo para operaciones sin cuerpo de respuesta (`logout`, algunos `PATCH` de estado).
- Todo response incluye `X-Trace-Id` (el mismo `traceId` que aparece en los errores).

### 1.3 Nombres

| Contexto | Convención | Ejemplo |
|---|---|---|
| Ruta | kebab-case, sustantivo plural | `/research-runs`, `/seo/index-status` |
| Query params | kebab-case | `?created-after=…&sort=-created-at` |
| Campos JSON (body y response) | camelCase | `targetMarket`, `contributionMargin` |
| Columnas en la DB | snake_case | `target_market`, `contribution_margin` |
| Valores de enum | UPPER_SNAKE_CASE, idénticos a la DB | `PENDING_APPROVAL`, `INSUFFICIENT_DATA`, `AI_INFERENCE` |
| Cabeceras | PascalCase con prefijo propio cuando aplica | `Idempotency-Key`, `X-Trace-Id`, `X-Request-Id` |
| IDs | UUID v7 (ordenable por tiempo) | `0198f2c1-4a3e-7c91-…` |

La traducción `snake_case` ↔ `camelCase` es responsabilidad de la capa de contrato (Zod + Prisma), no de los servicios.

### 1.4 Fechas y horas

| Tipo de dato | Formato | Ejemplo |
|---|---|---|
| Timestamp (`timestamptz`) | ISO 8601, **UTC**, con milisegundos y `Z` | `2026-10-01T14:22:31.482Z` |
| Fecha sin hora (`date`) | ISO 8601 `YYYY-MM-DD` | `2026-10-15` |
| Duración / ventana | ISO 8601 de duración cuando aplica | `PT30M`, `P7D` |

- **Siempre UTC en el transporte.** La conversión a zona horaria es del cliente (`apps/web`).
- Campos `date` que existen en la DB como tales: `campaigns.start_date`, `campaigns.end_date`, `campaign_metrics_daily.date`, `campaign_financials_daily.date`.
- Las ventanas de consulta usan `from`/`to` inclusivos-exclusivos: `?from=…&to=…` con `to` **exclusivo**, para no solapar agregaciones diarias.
- Un timestamp sin `Z` o sin offset se rechaza con `VALIDATION_FAILED`.

### 1.5 Dinero, porcentajes y confianza

El dinero **nunca** se transporta como número de coma flotante. La DB lo guarda como
`numeric(14,2)` / `numeric(18,4)` (`database.md` §4), y el API lo expone como **string decimal**
con un código de moneda ISO 4217 (`char(3)`).

```json
{
  "budgetTotal": { "amount": "1250000.00", "currency": "COP" },
  "budgetDaily": { "amount": "80000.00", "currency": "COP" }
}
```

| Concepto | Representación | Ejemplo |
|---|---|---|
| Monto | objeto `Money` `{ amount: string, currency: string }` | `{"amount":"1250000.00","currency":"COP"}` |
| Moneda | ISO 4217, 3 letras mayúsculas | `COP`, `USD`, `MXN` |
| Porcentaje / tasa | número entre `0` y `1`, con la precisión de la DB (`numeric(3,2)`) | `payment_fee_pct` → `0.0329` |
| Confianza (`confidence`) | número entre `0` y `1` (`numeric(3,2)`) | `0.72` |
| Puntaje (`score`) | número `0–100` (`numeric(5,2)`) | `82.50` |
| Crédito de atribución (`credit`) | número `0`–`1` (`numeric(5,4)`) | `1.0` |

Regla: un campo `Money` siempre lleva `amount` y `currency` juntos. Nunca se deduce la moneda
de la organización en el cliente.

### 1.6 Paginación

**Cursor (keyset)** para todo listado que pueda crecer: `leads`, `orders`, `touchpoints`,
`products`, `product_metrics`, `content`, `campaigns`, `audit_logs`, `ai_runs`, `ai_tool_calls`.

```
GET /api/v1/leads?limit=25&cursor=eyJrIjpb…
```

| Param | Tipo | Default | Límite |
|---|---|---|---|
| `limit` | int | `25` | `1–100` |
| `cursor` | string opaco | — | Se devuelve tal cual en `pageInfo.nextCursor` |

- El cursor es **opaco** (base64url de `[created_at, id]` o de la clave de orden) y el cliente **no** lo interpreta.
- El orden por defecto es `-created_at` y es estable (desempata por `id`).
- `hasNextPage: false` con `nextCursor: null` significa fin de la página.
- **Offset** (`?offset=&limit=`) solo en tablas pequeñas y acotadas de UI: `campaigns/templates`, `categories`, `admin/feature-flags`. Nunca en tablas de hechos.

### 1.7 Filtros, orden y campos

- Filtros: query params validados por el mismo Zod schema del endpoint. Listas separadas por coma: `?status=NEW,QUALIFIED`, `?provenance=REAL,ESTIMATED`.
- Rangos: sufijos `-gte`, `-lte`, `-after`, `-before` (`?score-gte=70&captured-after=2026-09-01`).
- Orden: `?sort=-score,created_at` (`-` = descendente). Campos ordenables declarados por endpoint; el resto se rechaza con `VALIDATION_FAILED`.
- Búsqueda de texto: `?q=` sobre los campos declarados por endpoint (`leads` y `products` usan `pg_trgm`).
- Campos: `?fields=id,name,status` (sparse fieldset). No aplicable a endpoints de escritura. Siempre se devuelven `id` y `updatedAt` aunque no se pidan.

### 1.8 Concurrencia optimista (ETag)

Todo `GET` de recurso mutable devuelve `ETag` (hash de `id + updated_at`). Toda escritura sobre
ese recurso exige `If-Match`:

- Sin `If-Match` → `428 Precondition Required`, `code: PRECONDITION_REQUIRED`.
- `If-Match` desactualizado → `412 Precondition Failed`, `code: PRECONDITION_FAILED` (el cliente relee y reintenta).
- `If-Match: *` solo se acepta en operaciones idempotentes por naturaleza.

Aplica a: `PATCH /leads/:id`, `PATCH /opportunities/:id/stage`, `PATCH /products/:id`,
`PATCH /content/:id`, `PATCH /campaigns/:id`, `POST /campaigns/:id/transition`.

### 1.9 Correlación

| Cabecera | Dirección | Uso |
|---|---|---|
| `X-Request-Id` | entrada (opcional) | El cliente puede enviar su id; si no, el servidor genera un UUID v7 |
| `X-Trace-Id` | salida | `trace_id` de OpenTelemetry; coincide con `audit_logs.trace_id` y `ai_runs.trace_id` |
| `traceId` | cuerpo de error | Mismo valor, para pegar en un reporte sin mirar cabeceras |

`traceId` es el hex de 32 caracteres del span raíz de OpenTelemetry (§C.6 del review). Es la
unión entre un error HTTP, la fila de `audit_logs`, el `ai_run` y los logs de pino.

---

## 2. Errores: RFC 9457 y códigos de dominio

### 2.1 Forma base

Todos los errores usan `application/problem+json` (RFC 9457). **Ningún** error devuelve
`{ "message": "…" }` suelto, ni un array de strings, ni un HTML.

```json
{
  "type": "https://errors.crm-ventas.internal/problems/campaign-invalid-transition",
  "title": "Transición de campaña inválida",
  "status": 409,
  "detail": "No se puede pasar de ARCHIVED a ACTIVE. Transiciones permitidas desde ARCHIVED: ninguna.",
  "instance": "/api/v1/campaigns/0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77/transition",
  "code": "CAMPAIGN_INVALID_TRANSITION",
  "traceId": "7c1f9a4e2b8d3f6a0c5e9b2d4a7f1c3e",
  "timestamp": "2026-10-01T14:22:31.482Z",
  "retryable": false,
  "docs": "https://docs.crm-ventas.internal/api/errors/campaign-invalid-transition",
  "context": {
    "campaignId": "0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77",
    "from": "ARCHIVED",
    "to": "ACTIVE",
    "allowedTransitions": []
  }
}
```

| Miembro | Obligatorio | Descripción |
|---|---|---|
| `type` | sí | URI que identifica el **tipo** de problema. Estable. |
| `title` | sí | Resumen humano corto, en español. No cambia entre instancias. |
| `status` | sí | Código HTTP, repetido en el cuerpo. |
| `detail` | sí | Explicación específica de esta ocurrencia. |
| `instance` | sí | Ruta (`path`) de la request que falló. |
| `code` | sí | **Código propio del dominio** (§2.3). Es la clave estable que el cliente y los tests usan, no `title`. |
| `traceId` | sí | Correlación (§1.9). |
| `timestamp` | sí | UTC ISO 8601. |
| `retryable` | sí | `true` si reintentar la **misma** request puede tener éxito tras el backoff indicado. |
| `docs` | no | Enlace a la ficha del código. |
| `context` | no | Datos estructurados del fallo. **No** contiene PII ni secretos. |
| `errors` | no | Array de errores de validación por campo (§2.2). |

Cuando `type` no aplica a un tipo documentado, se usa `about:blank` y `code: INTERNAL_ERROR`.

### 2.2 Errores de validación

`422 Unprocessable Entity` con `code: VALIDATION_FAILED`. Los campos inválidos van en `errors`,
derivados directamente de `ZodError.issues` — un `path` por issue, en camelCase.

```json
{
  "type": "https://errors.crm-ventas.internal/problems/validation-failed",
  "title": "Validación fallida",
  "status": 422,
  "detail": "1 campo no supera la validación de entrada.",
  "instance": "/api/v1/leads",
  "code": "VALIDATION_FAILED",
  "traceId": "3f9c1d7a6e2b4c8f0a5d9e1b3c7f2a4d",
  "timestamp": "2026-10-01T14:22:31.482Z",
  "retryable": false,
  "errors": [
    {
      "path": "identity.email",
      "code": "invalid_string",
      "message": "Debe ser un email válido.",
      "received": "ana@@ejemplo.com"
    }
  ]
}
```

Regla dura: **nunca** se refleja el valor recibido si el campo es de tipo secreto o personal
(`password`, `token`, teléfono completo, email). En esos casos `received` se omite y
`message` describe el formato esperado.

### 2.3 Códigos de error del dominio

Códigos con nombre propio del proyecto. El prefijo del enum es estable y forma parte del
contrato: el cliente generado los expone como unión discriminada.

| `code` | HTTP | Cuándo | `retryable` |
|---|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | Email o password incorrectos | no |
| `AUTH_TOKEN_EXPIRED` | 401 | Access JWT expirado | sí (`POST /auth/refresh`) |
| `AUTH_TOKEN_INVALID` | 401 | Firma o `aud` inválidos | no |
| `AUTH_ACCOUNT_LOCKED` | 423 | `users.locked_until` en el futuro | sí (tras `Retry-After`) |
| `REFRESH_TOKEN_INVALID` | 401 | Token inexistente o revocado | no |
| `REFRESH_TOKEN_REUSE_DETECTED` | 401 | Reuso de un token ya rotado → **familia revocada** | no |
| `FORBIDDEN_PERMISSION` | 403 | Falta el `Permission` exigido por `@RequirePermission()` | no |
| `RESOURCE_NOT_FOUND` | 404 | No existe, o existe en otra `organization_id` (no se distingue) | no |
| `VALIDATION_FAILED` | 422 | Entrada no valida contra el Zod schema | no |
| `PRECONDITION_REQUIRED` | 428 | Falta `If-Match` en escritura sobre recurso versionado | no |
| `PRECONDITION_FAILED` | 412 | `If-Match` no coincide con el `ETag` actual | sí (releer) |
| `STATE_CONFLICT` | 409 | Conflicto de estado genérico no cubierto por otro código | no |
| `CAMPAIGN_INVALID_TRANSITION` | 409 | Transición no permitida por la máquina de estados (§H.3) | no |
| `APPROVAL_REQUIRED` | 428 | La transición a `ACTIVE` exige `approvalId` válido (ADR-005) | no |
| `APPROVAL_PAYLOAD_CHANGED` | 409 | El payload difiere del aprobado; no se ejecuta | no |
| `APPROVAL_EXPIRED` | 410 | La aprobación expiró antes de ejecutarse | no |
| `BUDGET_GUARDRAIL_EXCEEDED` | 422 | Supera `MAX_DAILY_BUDGET` o `MAX_CAMPAIGN_BUDGET` | no |
| `BUDGET_CHANGE_REQUIRES_APPROVAL` | 428 | Cambio > `MAX_BUDGET_CHANGE_PERCENTAGE` | no |
| `CONNECTOR_NOT_APPROVED` | 403 | `connectors_registry.approved_at IS NULL` (ADR-004) | no |
| `CONNECTOR_DISABLED` | 409 | `enabled = false` o `kill_switch = true` | no |
| `CONNECTOR_RATE_LIMITED` | 429 | Supera el rate limit documentado del marketplace | sí |
| `CONNECTOR_QUOTA_EXCEEDED` | 429 | Supera `requests_per_day_budget` | sí (mañana) |
| `INSUFFICIENT_DATA` | 422 | Score o informe con `confidence` agregada bajo el mínimo (ADR-013) | no |
| `PROVENANCE_MISSING` | 422 | Métrica o afirmación sin `provenance` | no |
| `ECONOMICS_GATE_FAILED` | 422 | `contribution_margin <= 0` o `CAC_estimado >= contribution_margin` | no |
| `IDEMPOTENCY_CONFLICT` | 409 | Misma `Idempotency-Key`, payload distinto | no |
| `IDEMPOTENCY_IN_PROGRESS` | 409 | La primera request con esa key sigue en vuelo | sí |
| `TOOL_DENIED` | 403 | El agente no tiene el permiso de la tool (auditado) | no |
| `TOOL_INVALID` | 422 | El input de la tool no valida contra `inputSchema` | no |
| `TOOL_THROTTLED` | 429 | Rate limit por `(tool, agent)` excedido | sí |
| `TOOL_BLOCKED` | 403 | SSRF guard / allowlist de dominio | no |
| `TOOL_BAD_OUTPUT` | 502 | El output de la tool no valida contra `outputSchema` | sí |
| `TOOL_TIMEOUT` | 504 | La tool excedió `timeoutMs` | sí |
| `AGENT_DISABLED` | 409 | `ai_agents.enabled = false` | no |
| `AI_BUDGET_EXCEEDED` | 429 | `ai_budgets` agotado; degradación a local o encolado | sí |
| `WEBHOOK_SIGNATURE_INVALID` | 401 | Firma HMAC no verifica (§8) | no |
| `CONTENT_CANNIBALIZATION` | 409 | `target_keyword` + similitud contra el corpus (§I.4) | no |
| `CONTENT_SANITIZATION_REJECTED` | 422 | `body_html` no pasa la allowlist al guardar (S2) | no |
| `SLUG_TAKEN` | 409 | `UNIQUE(organization_id, slug)` violado | no |
| `IDENTITY_CONFLICT` | 409 | La fusión produce un ciclo o une identidades incompatibles | no |
| `RATE_LIMIT_EXCEEDED` | 429 | Throttler global (§5) | sí |
| `DEPENDENCY_UNAVAILABLE` | 503 | Postgres, Redis o el proveedor de LLM no responden | sí |
| `INTERNAL_ERROR` | 500 | Fallo no clasificado; siempre con `traceId` | sí |

Regla de evolución: **añadir** un código es cambio compatible; **renombrar o eliminar** un
código es cambio de versión mayor (§12).

### 2.4 Códigos HTTP usados

| HTTP | Significado en este API |
|---|---|
| 200 | Lectura o mutación con cuerpo |
| 201 | Recurso creado (`Location` presente) |
| 202 | Trabajo aceptado y encolado (§7) |
| 204 | Mutación sin cuerpo (`logout`, `complete`) |
| 400 | Request malformada (JSON inválido, cabecera ilegible) |
| 401 | No autenticado o token inválido |
| 403 | Autenticado pero sin permiso, o conector/tool bloqueados |
| 404 | No existe o no pertenece a la organización |
| 409 | Conflicto de estado o de idempotencia |
| 410 | Recurso que existió y ya no aplica (aprobación expirada) |
| 412 | Precondición `If-Match` fallida |
| 422 | Entrada semánticamente inválida |
| 423 | Cuenta bloqueada |
| 428 | Falta precondición (`If-Match` o `approvalId`) |
| 429 | Rate limit o cuota |
| 500 | Error interno |
| 502 | Dependencia devolvió algo inválido (output de tool) |
| 503 | Dependencia caída; incluye `Retry-After` |
| 504 | Timeout de una dependencia |

`400` se reserva para JSON malformado; una entrada JSON válida que no cumple el schema es
siempre `422`.

---

## 3. Autenticación

Decisiones de `architecture-review.md` §K.2 y `database.md` §2 (`users`, `refresh_tokens`).
MVP de un solo usuario con rol `OWNER`; sin SSO/OAuth (la puerta queda abierta, no se implementa).

### 3.1 Resumen del flujo

```
                    ┌────────────────────────────────────────────┐
  POST /auth/login  │  verifica argon2id                         │
  ────────────────► │  crea family_id + refresh token #1         │
                    │  Set-Cookie: __Host-crm_rt (httpOnly)      │
                    │  body: { accessToken, expiresIn, user }    │
                    └────────────────────────────────────────────┘
                                     │  access JWT (15 min) en MEMORIA del cliente
                                     ▼
  request autenticada   Authorization: Bearer <access JWT>
  ────────────────────►  guard de permisos → servicio
                                     │  al expirar (401 AUTH_TOKEN_EXPIRED)
                                     ▼
                    ┌────────────────────────────────────────────┐
  POST /auth/refresh│  lee cookie __Host-crm_rt                  │
  ────────────────► │  rota: revoca el presentado, emite uno nuevo│
                    │  replaced_by_id = nuevo                    │
                    │  Set-Cookie nuevo token                    │
                    └────────────────────────────────────────────┘
                                     │  si llega un token YA revocado
                                     ▼
                           REFRESH_TOKEN_REUSE_DETECTED
                           → revoca la familia completa + audit_log
```

| Token | Formato | Vida | Dónde vive | Revocable |
|---|---|---|---|---|
| Access | JWT, HS256 | 15 min | Memoria del cliente (señal Angular) | No (vida corta) |
| Refresh | 32 bytes aleatorios, opaco | 30 días | Cookie `httpOnly` | Sí, por `family_id` |

El access token **no** se guarda en `localStorage` ni en `sessionStorage`. Al recargar la SPA,
el cliente llama a `/auth/refresh` con la cookie y recupera un access token nuevo.

### 3.2 `POST /api/v1/auth/login`

- Autenticación: ninguna. Rate limit estricto (§5.2).
- Cuerpo:

```json
{
  "email": "owner@crm-ventas.local",
  "password": "…",
  "rememberDevice": false
}
```

- Éxito `200 OK`:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "0198f0aa-1b2c-7d3e-9f40-5a6b7c8d9e01",
    "email": "owner@crm-ventas.local",
    "role": "OWNER",
    "status": "ACTIVE",
    "organizationId": "0198f000-0000-7000-8000-000000000001",
    "permissions": ["READ_PRODUCTS", "WRITE_PRODUCTS", "…"]
  }
}
```

- Cabeceras de respuesta:

```http
Set-Cookie: __Host-crm_rt=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
Cache-Control: no-store
```

- Errores: `401 AUTH_INVALID_CREDENTIALS`, `423 AUTH_ACCOUNT_LOCKED`,
  `429 RATE_LIMIT_EXCEEDED`, `422 VALIDATION_FAILED`.

**Bloqueo por intentos.** Cada fallo incrementa `users.failed_attempts`. Al superar
`MAX_FAILED_ATTEMPTS` (config, default 5) se fija `users.locked_until = now() + backoff`
(exponencial: 15 min, 30 min, 60 min, tope 24 h) y se devuelve `423` con `Retry-After`.
Un login correcto reinicia `failed_attempts` y `locked_until` y actualiza `last_login_at`.

### 3.3 Claims del access token

```json
{
  "sub": "0198f0aa-1b2c-7d3e-9f40-5a6b7c8d9e01",
  "org": "0198f000-0000-7000-8000-000000000001",
  "role": "OWNER",
  "permissions": ["READ_PRODUCTS", "WRITE_PRODUCTS", "READ_CAMPAIGNS", "…"],
  "jti": "0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77",
  "iat": 1759324951,
  "exp": 1759325851,
  "iss": "crm-ventas.api",
  "aud": "crm-ventas.web"
}
```

- `org` es la `organization_id` que el middleware de Prisma fuerza en **todas** las consultas (ADR-011).
- `permissions` lleva el conjunto efectivo del **usuario**; el de un agente se compone aparte (§4.3).
- `exp` es absoluto; no hay tokens con vida deslizante. La rotación ocurre en el refresh, no renovando el access.
- El `jti` se registra en el log de la request para poder correlacionar una sesión concreta.

### 3.4 `POST /api/v1/auth/refresh`

- Autenticación: cookie `__Host-crm_rt` + verificación de `Origin` contra la allowlist (§3.7).
- Cuerpo: **vacío**.
- Rota el token en cada llamada:

```
1. hash = sha256(cookie)
2. fila = SELECT * FROM refresh_tokens WHERE token_hash = hash
3. si no existe                    → 401 REFRESH_TOKEN_INVALID
4. si revoked_at IS NOT NULL       → 401 REFRESH_TOKEN_REUSE_DETECTED
                                     + UPDATE refresh_tokens SET revoked_at = now()
                                       WHERE family_id = fila.family_id
                                     + audit_logs(action='auth.refresh_reuse', actor_type='SYSTEM')
5. si expires_at < now()           → 401 REFRESH_TOKEN_INVALID
6. INSERT refresh_tokens (family_id = fila.family_id, …)  ← token nuevo
   UPDATE refresh_tokens SET revoked_at = now(), replaced_by_id = <nuevo> WHERE id = fila.id
7. Set-Cookie con el token nuevo; body con accessToken nuevo
```

- Éxito `200 OK`: mismo cuerpo que `/login` sin el bloque `user` completo (solo `id` y `permissions` para refrescar el estado de la UI).
- La respuesta incluye `Cache-Control: no-store`.
- Cuando se detecta reuso, **todas** las sesiones de esa familia (`family_id`) quedan invalidadas,
  incluidas las que estaban activas: es la respuesta correcta a un robo de token.

### 3.5 `POST /api/v1/auth/logout`

- Autenticación: cookie `__Host-crm_rt`.
- Revoca la familia completa del token presentado y limpia la cookie.

```http
POST /api/v1/auth/logout
Cookie: __Host-crm_rt=<token>

→ 204 No Content
Set-Cookie: __Host-crm_rt=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0
```

- Es idempotente: llamarlo dos veces devuelve `204` las dos veces. No exige `Idempotency-Key`.

### 3.6 `GET /api/v1/auth/me`

- Requiere access token. No exige `@RequirePermission` (solo autenticación).
- Devuelve el usuario, su organización y el **conjunto efectivo de permisos del usuario**:

```json
{
  "id": "0198f0aa-1b2c-7d3e-9f40-5a6b7c8d9e01",
  "email": "owner@crm-ventas.local",
  "role": "OWNER",
  "organization": {
    "id": "0198f000-0000-7000-8000-000000000001",
    "name": "Operación principal",
    "slug": "principal"
  },
  "permissions": ["READ_PRODUCTS", "WRITE_PRODUCTS", "…"],
  "lastLoginAt": "2026-10-01T13:58:07.221Z"
}
```

### 3.7 Notas de seguridad

| Tema | Decisión |
|---|---|
| Hashing de password | **argon2id**, parámetros revisados al arrancar; nunca bcrypt (ADR/§K.2) |
| Cookie de refresh | `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, prefijo `__Host-` |
| Por qué `Path=/` y no un `Path` acotado | El prefijo `__Host-` **exige** `Path=/` y ausencia de `Domain`: un navegador **descarta** la cookie si no se cumple (RFC 6265bis). Acotar el `Path` era una idea razonable pero **incompatible con el prefijo**, y el prefijo protege más: impide que un subdominio comprometido inyecte una cookie que el API leería. Al ser host-only, la cookie no viaja fuera del host del API |
| CSRF | `SameSite=Lax` + verificación de `Origin`/`Referer` contra allowlist en `/refresh` y `/logout` |
| Rotación | Un refresh = un token nuevo; el anterior queda `revoked_at` con `replaced_by_id` |
| Detección de reuso | Token revocado presentado → familia completa revocada + evento de seguridad auditado |
| Access token | En memoria; nunca en almacenamiento persistente del navegador |
| Almacenamiento | `refresh_tokens.token_hash` guarda **sha256 del token**, nunca el token |
| Limpieza | Job repetible (worker) purga filas con `expires_at < now() - retention` |
| `user_agent` / `ip` | Se guardan por sesión para poder revocar por dispositivo en el futuro |
| Logs | Passwords, tokens y cookies nunca se loguean; pino con redacción por lista de claves |
| Errores | `AUTH_INVALID_CREDENTIALS` no distingue email inexistente de password incorrecta |
| CORS | Allowlist explícita de orígenes (`apps/web`); `credentials: true`; sin `*` |

### 3.8 Fuera del MVP (explícito)

- SSO / OAuth de terceros — descartado en §M.2.
- Recuperación de password por email — no hay proveedor de email; se resetea por CLI con auditoría.
- MFA / TOTP — no previsto en el MVP.
- Revocación por dispositivo desde la UI — el modelo (`family_id`, `user_agent`, `ip`) ya lo permite.

---

## 4. Autorización

### 4.1 El enum `Permission`

`Permission` vive en `packages/contracts` y es la fuente única. Los 15 valores de
`architecture-review.md` §K.2 son el **núcleo**; el catálogo de endpoints (§9) exige siete
adicionales, que se añaden al mismo enum en la migración `001_core`. La extensión se marca
explícitamente para que quede claro qué es núcleo y qué se añadió por necesidad del catálogo.

```ts
// packages/contracts/src/auth/permissions.ts
export enum Permission {
  // ── Núcleo (§K.2) ─────────────────────────────────────────────
  READ_PRODUCTS          = 'READ_PRODUCTS',
  WRITE_PRODUCTS         = 'WRITE_PRODUCTS',
  READ_CAMPAIGNS         = 'READ_CAMPAIGNS',
  CREATE_CAMPAIGN        = 'CREATE_CAMPAIGN',
  PUBLISH_CAMPAIGN       = 'PUBLISH_CAMPAIGN',   // nunca a un agente en el MVP
  CHANGE_BUDGET          = 'CHANGE_BUDGET',      // nunca a un agente en el MVP
  READ_METRICS           = 'READ_METRICS',
  GENERATE_CONTENT       = 'GENERATE_CONTENT',
  PUBLISH_CONTENT        = 'PUBLISH_CONTENT',
  READ_CUSTOMER_DATA     = 'READ_CUSTOMER_DATA',
  EXPORT_DATA            = 'EXPORT_DATA',
  MANAGE_AGENTS          = 'MANAGE_AGENTS',
  READ_AUDIT             = 'READ_AUDIT',
  MANAGE_CONNECTORS      = 'MANAGE_CONNECTORS',
  DELETE_ANY             = 'DELETE_ANY',         // nunca a un agente en el MVP

  // ── Extensión MVP exigida por el catálogo de §9 ───────────────
  WRITE_CUSTOMER_DATA    = 'WRITE_CUSTOMER_DATA', // leads, contacts, opportunities, activities
  WRITE_CAMPAIGN         = 'WRITE_CAMPAIGN',      // editar borradores y transicionar
  READ_CONTENT           = 'READ_CONTENT',
  WRITE_CONTENT          = 'WRITE_CONTENT',
  MANAGE_BRAND           = 'MANAGE_BRAND',
  MANAGE_SEO             = 'MANAGE_SEO',
  WRITE_ORDERS           = 'WRITE_ORDERS',
  EXECUTE_AGENT          = 'EXECUTE_AGENT',       // el HUMANO lanza ai_tasks y research_runs
  MANAGE_SYSTEM          = 'MANAGE_SYSTEM',       // admin: jobs, outbox, feature flags

  // ── Orquestación (ADR-020) ────────────────────────────────────
  // Más estrecho que MANAGE_AGENTS: permite DELEGAR tareas en otros agentes, no reconfigurarlos.
  ORCHESTRATE_AGENTS     = 'ORCHESTRATE_AGENTS',
}
```

Invariantes que el código debe mantener (test de contrato, no convención):

1. **Seis permisos no aparecen nunca en `ai_agents.permissions`**: `PUBLISH_CAMPAIGN`,
   `CHANGE_BUDGET`, `DELETE_ANY`, `MANAGE_AGENTS`, `MANAGE_SYSTEM` y `EXPORT_DATA`
   (`MVP_FORBIDDEN_AGENT_PERMISSIONS`, ADR-020).
2. **`PUBLISH_CONTENT` sí se concede** (a `content` y `seo`), pero pertenece a
   `APPROVAL_REQUIRED_PERMISSIONS`: el `ToolRegistry` **aborta el arranque** si una tool con ese
   permiso no declara `requiresApproval: true`.
3. Toda ruta bajo `/api/v1` (excepto `/auth/*`, `/public/*` y `/webhooks/*`) declara `@RequirePermission()`.
   Esto lo verifica Spectral en CI (§13): una operación sin `x-permission` falla el build.

### 4.2 `@RequirePermission()`

```ts
// apps/api/src/common/guards/permissions.guard.ts
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(REQUIRE_PERMISSION_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const { permissions } = ctx.switchToHttp().getRequest().auth; // del access JWT o del ToolContext
    const ok = required.every((p) => permissions.includes(p));
    if (!ok) throw new ForbiddenPermissionException({ required, granted: permissions });
    return true;
  }
}
```

```ts
@Post(':id/transition')
@RequirePermission(Permission.WRITE_CAMPAIGN)
@Idempotent()
async transition(@Param('id') id: string, @Body() body: TransitionDto) { … }
```

| Aspecto | Regla |
|---|---|
| Aplicación | Por handler o por controller; el decorador de handler gana |
| Semántica | `@RequirePermission(A, B)` exige **todos** (AND) |
| Alternativa | `@RequireAnyPermission(A, B)` exige al menos uno (OR) — usado solo en `approvals` |
| Sin decorador | Si la ruta está bajo `/api/v1` y no es `auth`/`public`/`webhooks` → **falla el build**, no el runtime |
| Respuesta al denegar | `403 FORBIDDEN_PERMISSION` con `context.required` y `context.granted` (nunca la lista completa de permisos del sistema) |
| Alcance | El guard valida **permiso**, no propiedad. La comprobación de pertenencia a la organización y de visibilidad del recurso vive en el servicio |
| Cross-org | Acceder a un recurso de otra `organization_id` devuelve `404 RESOURCE_NOT_FOUND`, no `403`, para no filtrar existencia |

El guard no consulta la DB: los permisos vienen firmados en el JWT. Como el JWT vive 15 min,
una revocación de permisos tarda como máximo ese tiempo en propagarse; para acciones críticas
(`PUBLISH_CAMPAIGN`, `CHANGE_BUDGET`, `DELETE_ANY`) el servicio **revalida** contra
`users.role`/config antes de ejecutar.

### 4.3 Composición con agentes

Un agente es un actor **distinto** de la persona que lo invoca, con su propio conjunto de
permisos en `ai_agents.permissions text[]` (`database.md` §10). La regla es (ADR-011):

```
effective_permissions = agent.permissions ∩ user.permissions
```

| Paso | Quién lo aplica | Efecto |
|---|---|---|
| 1 | Guard HTTP | El endpoint `POST /api/v1/ai/tasks` exige `EXECUTE_AGENT` al **usuario**; sin él, `403` |
| 2 | `AgentRuntime` al crear el run | Calcula `effective_permissions` y lo persiste en el contexto del run |
| 3 | `ToolRegistry` al invocar cada tool | Si `tool.permission ∉ effective_permissions` → **no ejecuta**, `ai_tool_calls.status = 'TOOL_DENIED'` y `ai_runs` auditado |
| 4 | `ToolRegistry` | Si `tool.requiresApproval` → no ejecuta; crea `approvals(PENDING)` y devuelve `{ status: 'PENDING_APPROVAL', approvalId }` (ADR-005) |
| 5 | `POST /approvals/:id/approve` | **Revalida** que el usuario que aprueba tenga el permiso del subject (`approvals.type`) antes de ejecutar |

Consecuencia práctica: un `ContentAgent` con `[READ_PRODUCTS, GENERATE_CONTENT, WRITE_CONTENT]`
invocado por un `OWNER` con todos los permisos sigue teniendo exactamente esos tres. Nunca
puede `PUBLISH_CONTENT`, `PUBLISH_CAMPAIGN` ni `DELETE_ANY`, aunque el modelo lo intente y
aunque el prompt se lo pida: la capacidad no existe para ese run.

### 4.4 Permisos de decisión sobre aprobaciones

`POST /api/v1/approvals/:id/approve|reject|modify` no exige un permiso fijo: exige **el permiso
del `approvals.type`**. Esto ata la decisión al mismo poder que ejecutaría la acción.

| `approvals.type` | Permiso exigido para decidir |
|---|---|
| `PUBLISH_CAMPAIGN` | `PUBLISH_CAMPAIGN` |
| `PUBLISH_CONTENT` | `PUBLISH_CONTENT` |
| `CHANGE_BUDGET` | `CHANGE_BUDGET` |
| `SPEND` | `CHANGE_BUDGET` |
| `SELECT_PRODUCT` | `WRITE_PRODUCTS` |

Leer (`GET /approvals`, `GET /approvals/:id`) solo exige autenticación y alcance de organización:
la bandeja es una vista de trabajo, no un dato sensible por sí misma.

---

## 5. Rate limiting

Store en **Redis** (compartido entre instancias de `api` y consumido también por el worker
para los conectores y las tools). Implementación: `@nestjs/throttler` con store Redis + un
limiter propio por conector (§5.3) y por tool (§5.4).

> **Esto es el diseño objetivo, no el estado del código.** Hoy no hay Redis ni throttler: existe un
> limiter **en memoria** y de un solo bucket. Lo que se puede y no se puede afirmar con él está en
> §5.6, y conviene leerlo antes de dar por hecho cualquier límite de esta sección.

### 5.1 Buckets por endpoint

| Bucket | Ámbito | Límite | Ventana | Ventana de burst |
|---|---|---|---|---|
| `global` | Por usuario autenticado (`sub`) | 600 req | 1 min | — |
| `global-anon` | Por IP (rutas `/public/*` y `/auth/*`) | 120 req | 1 min | — |
| `auth-login` | Por IP **+** email normalizado | 10 req | 15 min | 3 / 1 min |
| `auth-refresh` | Por `family_id` (cookie) | 30 req | 15 min | 5 / 1 min |
| `read-heavy` | Por usuario en `GET /analytics/*`, `GET /admin/audit`, `GET /ai/runs/:id` | 120 req | 1 min | — |
| `write` | Por usuario en `POST`/`PATCH`/`PUT` | 120 req | 1 min | 30 / 10 s |
| `async-launch` | Por usuario en `POST /research-runs`, `POST /ai/tasks`, `POST /ai/tasks/:id/stream` | 10 req | 10 min | — |
| `export` | Por usuario en endpoints con `EXPORT_DATA` | 5 req | 1 h | — |
| `public-touchpoint` | Por IP en `POST /public/touchpoints` | 60 req | 1 min | 20 / 10 s |
| `public-form` | Por IP en `POST /public/forms/:formKey/submissions` | 20 req | 10 min | — |
| `webhook` | Por `source` (meta, google-ads, stripe) | 300 req | 1 min | 100 / 10 s |

El bucket se selecciona por decorador (`@ThrottleBucket('public-form')`), no por convención de ruta.
Los buckets son configuración (`RATE_LIMIT_*`), no constantes en código.

### 5.2 Reglas específicas

- **Login**: se limita por `(IP, email)`. Un ataque de credential stuffing contra muchos emails
  distintos no evita el límite por IP del bucket `global-anon`. Un ataque contra un solo email
  desde muchas IPs se frena con el bloqueo de cuenta (`users.failed_attempts` / `locked_until`, §3.2).
  Son dos defensas con ámbitos distintos, y se aplican las dos.
- **Refresh**: además del bucket, un reuso de token revoca la familia (§3.4). El rate limit no
  sustituye esa detección.
- **Lanzamiento de trabajo asíncrono**: `async-launch` es deliberadamente bajo. Lanzar 50
  research runs no acelera nada (la cola `ai` corre con concurrencia 1 en local, ADR-010) y
  satura Ollama. El límite protege la máquina, no el servidor.
- **Exports**: limitados a 5/h porque un export completo de `audit_logs` o de `orders` es una
  operación de volumen y un vector de exfiltración; además queda en `audit_logs` con `EXPORT_DATA`.
- **Webhooks**: el límite es generoso porque el emisor es externo y no se puede espaciar; la
  protección real es la firma (§8) y la idempotencia de `webhook_events`.

### 5.3 Rate limit por conector

Dos capas, y ninguna es del API HTTP: viven en el worker y en `packages/connectors`.

| Capa | Mecanismo | Fuente del límite |
|---|---|---|
| Cuota diaria | Contador Redis `connector:{id}:requests:{yyyymmdd}` con TTL hasta fin de día | `connectors_registry.requests_per_day_budget` |
| Ritmo por dominio | Token bucket Redis `rl:domain:{host}` | `connectors_registry.documented_rate_limit` |
| Cortacircuitos | Tras N fallos consecutivos → estado abierto durante `COOLDOWN` | Config por conector |
| Kill switch | `connectors_registry.kill_switch = true` → `ConnectorFactory` no instancia (ADR-004) | Humano, desde `PATCH /connectors/:id` |

Al agotar la cuota diaria se devuelve/registra `CONNECTOR_QUOTA_EXCEEDED` y el research run
**continúa con datos parciales**, declarándolo en su informe (criterio de aceptación de Fase 5).
No se aborta el run.

### 5.4 Rate limit por tool de agente

Cada `AgentTool` declara `rateLimit: { perMinute, perAgent? }` (§G.2). El `ToolRegistry` lo
aplica en Redis con clave `rl:tool:{tool}:{agentId}` y, al exceder, **no** ejecuta: registra
`ai_tool_calls.status = 'TOOL_THROTTLED'` y devuelve `TOOL_THROTTLED` al bucle del agente.
El agente puede reintentar o degradar el plan; el run no falla por esto por sí solo.

### 5.5 Cabeceras de respuesta

En toda respuesta se informa del bucket aplicado:

```http
RateLimit-Limit: 600
RateLimit-Remaining: 583
RateLimit-Reset: 42
RateLimit-Policy: 600;w=60
```

| Cabecera | Significado |
|---|---|
| `RateLimit-Limit` | Cuota del bucket en la ventana |
| `RateLimit-Remaining` | Peticiones restantes en la ventana actual |
| `RateLimit-Reset` | Segundos hasta el reinicio de la ventana |
| `RateLimit-Policy` | Cuota y ventana (`600;w=60`, `w` en segundos) |

Al exceder (`429`):

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 37
RateLimit-Limit: 10
RateLimit-Remaining: 0
RateLimit-Reset: 37
Content-Type: application/problem+json
```

```json
{
  "type": "https://errors.crm-ventas.internal/problems/rate-limit-exceeded",
  "title": "Límite de peticiones excedido",
  "status": 429,
  "detail": "Se superó el límite del bucket 'async-launch': 10 lanzamientos cada 10 minutos.",
  "instance": "/api/v1/research-runs",
  "code": "RATE_LIMIT_EXCEEDED",
  "traceId": "9d2a7f1c4e0b3a8d6f5c2e9b1a4d7f30",
  "timestamp": "2026-10-01T14:22:31.482Z",
  "retryable": true,
  "context": { "bucket": "async-launch", "retryAfterSeconds": 37 }
}
```

Cabeceras adoptadas del estándar IETF de campos de rate limit (`RateLimit-*`); `Retry-After`
es la cabecera estable que **todo** cliente debe respetar, incluidas las versiones antiguas.

### 5.6 Estado real: limiter en memoria (no hay Redis todavía)

**Nada de lo anterior está implementado con Redis.** Lo que existe hoy es un limiter **en memoria**
(`apps/api/src/common/rate-limit/`), escrito a mano detrás de una interfaz, y se aplica solo a las
rutas del webhook de Meta (§8.1). Esta sección dice qué se puede y qué no se puede afirmar con él:

| Aspecto | En memoria | Consecuencia |
|---|---|---|
| Ámbito | **Por proceso.** Cada réplica cuenta lo suyo | Con N réplicas el límite efectivo es **N × el configurado** |
| Persistencia | Se pierde al reiniciar | Un atacante paciente puede esperar un despliegue |
| Claves | `Map` con barrido al pasar de 1 000 claves | Una IP distinta por petición no se frena: es un `Map`, no una defensa contra rotación de IPs |
| Claves nuevas con el mapa lleno | **Fail-closed**: se rechaza la clave nueva | Preferimos denegar tráfico legítimo a admitir ilimitado; es una decisión, no un descuido |

**Consecuencia operativa, dicha sin rodeos: el despliegue multi-réplica queda bloqueado** hasta que
exista el store compartido. Con una sola instancia esto protege de un bucle y de un scrape casual;
no protege de un ataque distribuido, y por eso el límite por IP **no sustituye** a la firma (§8.2),
que es la autorización real de estas rutas.

Los buckets de §5.1, las cabeceras `RateLimit-*` de §5.5 y los límites por conector y por tool
(§5.3, §5.4) siguen siendo el diseño objetivo; hoy no existen. El único bucket implementado es uno
por IP con `PUBLIC_RATE_LIMIT_PER_MINUTE` (default 120) sobre el webhook.

---

## 6. Idempotencia

### 6.1 Mecánica

El cliente envía `Idempotency-Key` en los `POST` marcados como obligatorios. El servidor
garantiza que **la misma key con el mismo payload produce un único efecto**, aunque la request
se reintente N veces.

```
Fingerprint = SHA-256( método + path + JSON canónico del body )
Clave Redis = idem:{organization_id}:{método}:{path}:{Idempotency-Key}

1. GET clave
   ├─ no existe
   │    SET clave { state: IN_PROGRESS, fingerprint } NX EX 60
   │    ├─ si el NX falla (otra request ganó la carrera) → tratar como IN_PROGRESS
   │    ├─ ejecutar el caso de uso (SIN la transacción de la respuesta)
   │    └─ SET clave { state: COMPLETED, fingerprint, status, headers, bodyHash, body, resourceId } EX 86400
   │
   ├─ state = IN_PROGRESS
   │    └─ 409 IDEMPOTENCY_IN_PROGRESS   (Retry-After: 1)
   │
   └─ state = COMPLETED
        ├─ fingerprint igual   → replay: devolver status/body guardados + Idempotency-Replayed: true
        └─ fingerprint distinto → 409 IDEMPOTENCY_CONFLICT
```

Detalles que importan:

- **El lock se suelta a los 60 s** para no bloquear permanentemente si el proceso muere. Si el
  caso de uso tarda más (no debería: los lentos son asíncronos), el lock expira y una segunda
  request lo reintenta; la garantía durable la dan las restricciones de la DB (§6.4).
- **JSON canónico**: claves ordenadas y sin espacios. Un body con las mismas claves en otro
  orden es el mismo fingerprint; un body con un campo distinto es conflicto.
- **El replay devuelve el mismo `status`** (`201`, `202`, `200`), no un `200` genérico.
- La cabecera `Idempotency-Replayed: true` permite al cliente distinguir un replay de una
  creación real. El cliente generado la expone.
- La key **nunca** se registra en claro en logs si el body contiene PII; se registra su hash.

### 6.2 Endpoints que la requieren

Los `POST` con creación de recursos o efectos externos. La obligatoriedad está declarada en el
Zod schema (`x-idempotency-required: true` en OpenAPI) y Spectral la verifica (§13).

| Endpoint | Motivo |
|---|---|
| `POST /leads` | Crea `identities` y `leads`; un reintento no puede duplicar la persona |
| `POST /leads/:id/convert` | Crea `contacts` + `opportunities` y transiciona el lead |
| `POST /identities/merge` | Reejecutar una fusión no puede crear `identity_links` duplicados |
| `POST /contacts` | Reintento de red no puede duplicar el contacto |
| `POST /opportunities` | Ídem |
| `POST /activities` | Ídem |
| `POST /public/forms/:formKey/submissions` | El doble clic del formulario no puede crear dos leads |
| `POST /products` | Ídem |
| `POST /categories` | Ídem |
| `POST /research-runs` | Un reintento no puede lanzar dos investigaciones de pago |
| `POST /research-runs/:id/candidates/:productId/decision` | Seleccionar/rechazar dos veces no puede duplicar `approvals` |
| `POST /products/:id/score` | Un reintento no puede insertar dos versiones del mismo score |
| `POST /connectors/:id/approve` | Reejecutar no puede re-firmar la ficha de compliance |
| `POST /connectors/:id/sync` | Un reintento no puede disparar dos syncs y consumir cuota doble |
| `POST /content`, `POST /content/:id/submit-approval`, `POST /content/:id/publish` | Publicar dos veces no puede duplicar revisiones ni landings |
| `POST /keywords`, `POST /clusters`, `POST /clusters/rebuild`, `POST /briefs` | Ídem |
| `POST /seo/index-status/refresh`, `POST /seo/sitemap/rebuild` | Ídem |
| `POST /campaigns`, `POST /campaigns/:id/transition`, `POST /campaigns/:id/submit-approval` | Una transición duplicada cambiaría el estado con dos `campaign_state_transitions` |
| `POST /campaigns/:id/budget` | Un cambio de presupuesto duplicado mueve dinero dos veces |
| `POST /creatives` | Ídem |
| `POST /approvals/:id/approve` | Aprobar dos veces no puede ejecutar la acción dos veces |
| `POST /approvals/:id/modify` | Ídem |
| `POST /orders` | Duplicar una venta corrompe margen y atribución |
| `POST /analytics/attribution/recompute` | Reintento no debe encolar dos jobs idénticos |
| `POST /ai/agents`, `POST /ai/tasks` | Un reintento no puede lanzar dos ejecuciones del mismo agente |
| `POST /admin/outbox/:id/redispatch` | Reintento no puede publicar el evento dos veces |

No la requieren: `PUT /products/:id/costs` (idempotente por `(product_id, valid_from)`),
`PATCH` (gobernado por `If-Match`), los `DELETE` lógicos y `GET`.

### 6.3 Cabeceras

| Cabecera | Dirección | Obligatoria |
|---|---|---|
| `Idempotency-Key` | request | Sí en los endpoints de §6.2 |
| `Idempotency-Replayed` | response | Presente (`true`) cuando la respuesta es un replay |

Formato de la key: string opaco de 16 a 255 caracteres (`A–Z a–z 0–9 _ - . :`). Se recomienda
UUID v4 o v7. Fuera de ese rango → `422 VALIDATION_FAILED`. Ausente en un endpoint que la
exige → `428 PRECONDITION_REQUIRED` con `code: IDEMPOTENCY_KEY_REQUIRED`.

### 6.4 Ventana de retención y garantía durable

| Nivel | Mecanismo | Retención |
|---|---|---|
| Lock en vuelo | Redis `idem:*` con `state=IN_PROGRESS` | 60 s |
| Caché de respuesta | Redis `idem:*` con `state=COMPLETED` (status + body + hash) | **24 h** (`IDEMPOTENCY_TTL_HOURS=24`) |
| Garantía durable | Restricciones únicas en Postgres | Permanente |

La caché de 24 h cubre los reintentos reales de un cliente HTTP (timeout, 503, recarga de la
SPA). Pasada la ventana, el mismo `Idempotency-Key` se trata como una request nueva — por eso
la garantía **no** puede depender solo de Redis:

| Tabla | Restricción | Protege |
|---|---|---|
| `orders` | `UNIQUE(organization_id, order_number)` | Ventas |
| `webhook_events` | `UNIQUE(source, external_id)` | Webhooks (§8) |
| `product_costs` | `UNIQUE(product_id, valid_from)` | Versionado de costos |
| `refresh_tokens` | `UNIQUE(token_hash)` | Sesiones |
| `identities` | `UNIQUE(anonymous_id)` + `UNIQUE(organization_id, lower(email))` parcial | Personas |
| `product_sources` | `UNIQUE(connector_id, external_id)` | Orígenes de producto |
| `research_run_candidates` | `UNIQUE(research_run_id, product_id)` | Candidatos |

`IDEMPOTENCY_TTL_HOURS` es configuración. Subirlo a 72 h es razonable si aparece un cliente
que reintente a lo largo de varios días; el coste es memoria en Redis, no corrección.

> **Evolución anotada (no MVP).** Si en producción apareciera la necesidad de garantía durable
> dentro de la ventana (Redis perdido entre el efecto y el guardado de la respuesta), el camino
> es una tabla de sistema `idempotency_keys` en Postgres, análoga a `webhook_events`. No se crea
> ahora porque la restricción única de cada tabla ya cubre el caso de negocio y una tabla más
> sería complejidad sin necesidad demostrada.

---

## 7. Patrón de tarea asíncrona

Todo lo largo es asíncrono desde el inicio (§F.4): scraping, inferencia, generación de
contenido, clustering, sync de conectores, reconciliación de métricas. **Nunca** se bloquea una
request HTTP esperando a un LLM o a un marketplace.

### 7.1 Envelope de aceptación (202)

```http
POST /api/v1/research-runs
→ HTTP/1.1 202 Accepted
Location: /api/v1/research-runs/0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77
Retry-After: 5
Content-Type: application/json
```

```json
{
  "taskId": "0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77",
  "status": "QUEUED",
  "resourceType": "research_run",
  "resourceId": "0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77",
  "pollUrl": "/api/v1/research-runs/0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77",
  "streamUrl": "/api/v1/ai/tasks/0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77/stream",
  "estimatedDurationSeconds": 900,
  "createdAt": "2026-10-01T14:22:31.482Z"
}
```

| Campo | Descripción |
|---|---|
| `taskId` | Identificador de la unidad de trabajo. Es el `id` de `ai_tasks` cuando la tarea la ejecuta un agente; es el `id` del recurso cuando la tarea es de dominio |
| `status` | `QUEUED` \| `RUNNING` \| `COMPLETED` \| `FAILED` \| `CANCELLED` — mismos valores que `ai_tasks.status` / `research_runs.status` |
| `resourceType` | `research_run` \| `ai_task` \| `connector_sync` \| `score` \| `sitemap` \| `attribution_recompute` |
| `resourceId` | Id del recurso de dominio afectado (si aplica) |
| `pollUrl` | Ruta a consultar. Apunta al **recurso de dominio** cuando existe (`/research-runs/:id`), porque trae más contexto que un estado genérico |
| `streamUrl` | SSE (§7.4). Presente solo cuando el recurso soporta streaming |
| `estimatedDurationSeconds` | Estimación honesta; puede ser `null` |
| `createdAt` | Timestamp de encolado |

Reglas:

- `202` **siempre** lleva `Location` y un `Retry-After` inicial sugerido.
- Si el mismo trabajo se relanza con la misma `Idempotency-Key`, se devuelve el **mismo**
  envelope con `Idempotency-Replayed: true` (§6), no un `202` con un `taskId` nuevo.
- Ningún `202` implica que el trabajo vaya a tener éxito. El éxito se lee en el `status` final.

### 7.2 Consulta de estado

`GET {pollUrl}` devuelve el recurso con su estado y, cuando aplica, el progreso:

```json
{
  "id": "0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77",
  "niche": "accesorios para mascotas",
  "targetMarket": "CO",
  "country": "CO",
  "status": "RUNNING",
  "progress": {
    "percent": 42,
    "stage": "scoring",
    "message": "Puntuando 18 de 43 candidatos",
    "counters": { "productsDiscovered": 43, "productsScored": 18 }
  },
  "connectorsUsed": ["0198f0cc-2a11-7b02-9c33-aa11bb22cc33"],
  "startedAt": "2026-10-01T14:22:36.004Z",
  "finishedAt": null,
  "agentRunId": "0198f2c2-5b4f-7d01-9e12-7a8b9c0d1e2f",
  "error": null,
  "report": null
}
```

`progress` es un campo de presentación, **derivado**, no una columna del dominio: se construye
desde el estado del job en BullMQ y los contadores del recurso. No se persiste como verdad.

Estado terminal con error:

```json
{
  "id": "0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77",
  "status": "FAILED",
  "error": {
    "code": "CONNECTOR_QUOTA_EXCEEDED",
    "message": "Se agotó la cuota diaria de MercadoLibre antes de completar el scoring.",
    "partialResults": true,
    "traceId": "9d2a7f1c4e0b3a8d6f5c2e9b1a4d7f30"
  },
  "report": {
    "summary": "Se puntuaron 12 candidatos con datos REAL antes de agotar la cuota.",
    "missingData": ["review_growth_30d", "trend_index"],
    "confidence": 0.61
  },
  "finishedAt": "2026-10-01T14:31:02.887Z"
}
```

Una ejecución que degrada **no** miente: `partialResults: true` y `missingData` declaran lo que
faltó (criterio de aceptación de Fase 5). Un fallo total devuelve `error` sin `report`.

### 7.3 Polling con backoff

El cliente generado incluye un helper de polling. La política es fija y no configurable por
endpoint, para que el comportamiento sea predecible:

```
intento 1:  inmediato
intento n:  delay = min(30s, 1s × 2^(n-2))  ± 20% de jitter
```

| Intento | Delay base |
|---|---|
| 1 | 0 s |
| 2 | 1 s |
| 3 | 2 s |
| 4 | 4 s |
| 5 | 8 s |
| 6 | 16 s |
| 7+ | 30 s (tope) |

Reglas:

- Respetar siempre `Retry-After` si la respuesta lo trae; tiene prioridad sobre la tabla.
- Detener el polling en `COMPLETED`, `FAILED` o `CANCELLED`.
- Un `404 RESOURCE_NOT_FOUND` inmediatamente después de un `202` es **lag de replicación**:
  reintentar con el mismo backoff hasta 3 veces antes de fallar.
- Un `429` no consume un intento: se espera `Retry-After` y se continúa.
- Tope global de polling: `POLL_MAX_DURATION` (config, default 60 min). Al superarlo, el
  cliente deja de consultar y muestra un enlace al recurso, en vez de girar indefinidamente.

### 7.4 SSE opcional (Fase 4)

Cuando se necesita progreso en vivo (research run, generación de contenido larga, streaming de
un `ai_run`), se usa **SSE**, no WebSockets (§F.4): unidireccional, más simple y atraviesa
proxies mejor.

```
GET /api/v1/ai/tasks/:id/stream
Accept: text/event-stream
Last-Event-ID: 42            ← reanudación tras reconexión
```

```
event: task.status
id: 41
data: {"status":"RUNNING"}

event: task.progress
id: 42
data: {"percent":67,"stage":"generating_content","message":"Generando 3 de 5 piezas"}

event: task.log
id: 43
data: {"level":"warn","message":"Conector degradado: se usa caché de hace 6 h"}

event: task.result
id: 44
data: {"resourceId":"0198f2c1-…","status":"COMPLETED"}

: heartbeat
```

| Evento | Contenido |
|---|---|
| `task.status` | Cambio de estado (`QUEUED` → `RUNNING` → terminal) |
| `task.progress` | `percent`, `stage`, `message`, `counters` |
| `task.log` | Mensajes de nivel del run (no logs internos de infraestructura) |
| `task.result` | Payload final o referencia al recurso; cierra el stream |
| `task.error` | Error terminal con `code` y `traceId`; cierra el stream |
| `heartbeat` | Comentario cada 15 s para mantener viva la conexión |

- **Autenticación**: `EventSource` del navegador no permite enviar `Authorization`. Se usa un
  `streamToken` de un solo uso y vida corta (60 s) obtenido con
  `POST /api/v1/ai/tasks/:id/stream-token`, que se pasa como `?token=`. Alternativa
  equivalente: consumir el stream con `fetch` y `ReadableStream`, enviando la cabecera. El
  contrato soporta ambas; el cliente generado usa `fetch`.
- **Reconexión**: el servidor guarda los últimos `N` eventos por tarea en Redis durante la vida
  del run; `Last-Event-ID` reanuda. Si el buffer expiró, el cliente recibe `task.status` con el
  estado actual y continúa.
- **Cierre**: el stream se cierra solo en estado terminal o por `AbortController` del cliente.
- SSE es **opcional**: todo lo que se puede hacer por SSE se puede hacer por polling. El
  polling es el camino por defecto y el que no depende de proxies intermedios.

### 7.5 Cancelación

Los recursos cancelables exponen `POST {pollUrl}/cancel` (`research-runs`, `ai/tasks`).
Cancela el job en BullMQ si aún no ha empezado y marca el recurso `CANCELLED`. Un run cancelado
a mitad **no deja candidatos huérfanos** (criterio de aceptación de Fase 5): la cancelación es
una transición de dominio, no un `kill` del proceso.

---

## 8. Webhooks entrantes

Los emisores externos (Meta Ads, Google Ads, Stripe, marketplaces) son REST por definición
(ADR-012). Esta sección define cómo se **reciben** y verifican. Los webhooks **salientes**
(la plataforma notificando a un tercero) no existen en el MVP.

> Recordatorio de alcance: en el MVP no se publican campañas ni se cobra. Los webhooks de
> Meta/Google existen para recibir eventos de las campañas que se ejecutan manualmente fuera de
> la plataforma; el de Stripe queda **fuera del MVP** porque no hay `payments` (§M.2 y §O.3).

### 8.1 Rutas

| Ruta | `source` | Fase | Estado |
|---|---|---|---|
| `GET /api/v1/webhooks/meta` | — | 2 | **Implementado.** Handshake `hub.mode=subscribe`; `200 text/plain` con el challenge, `403 FORBIDDEN_PERMISSION` si el token no cuadra |
| `POST /api/v1/webhooks/meta` | `meta` | 2 | **Implementado** hasta el borde de la ingesta: firma + validación del sobre + rate limit. La ingestión real (persistir el lead) espera a la base de datos |
| `POST /api/v1/webhooks/google-ads` | `google_ads` | 7 | Stub de recepción |
| `POST /api/v1/webhooks/stripe` | `stripe` | Post-MVP | No implementado (sin pagos) |

Estas rutas son las únicas bajo `/api/v1` que no exigen `@RequirePermission`: la autorización
es la firma criptográfica. Sí están sujetas a rate limit por IP (§5.6) —el esquema por `source` de
§5.1 no está implementado—.

**El handshake es `GET` y no lleva firma.** Meta lo pide sin `X-Hub-Signature-256`: se autoriza con
`hub.verify_token` comparado en tiempo constante contra `META_VERIFY_TOKEN`. El challenge se
devuelve **en crudo** y como `text/plain` —no como JSON— porque el protocolo lo exige así, y ese
`Content-Type` evita además un XSS reflejado si alguien apunta a esta ruta con un challenge que
parezca HTML. El cuerpo se trunca a 256 caracteres: es un valor que reflejamos, y reflejar sin
tope es regalar un amplificador.

### 8.2 Verificación de firma (HMAC)

La firma se calcula sobre el **cuerpo crudo** (bytes tal cual llegan), no sobre el JSON
re-serializado. Esto obliga a montar el parser de body en modo `raw` para estas rutas y a
verificar antes de parsear: `NestFactory.create(AppModule, { rawBody: true })` y `@RawBody()`.
Un `HMAC` sobre `JSON.stringify(req.body)` **no coincide** con el que envió el emisor, y el error
es silencioso —la firma falla y el diagnóstico apunta al secreto en vez de al parseo—, así que
la regla se enuncia aquí y se prueba con un test que firma un cuerpo y envía otro.

Existen **dos esquemas**, y confundirlos fue un error de este documento en su primera versión:

#### a) Esquema de Meta (el único implementado hoy)

```http
POST /api/v1/webhooks/meta
Content-Type: application/json
X-Hub-Signature-256: sha256=6f2a9c4e1b8d3f70a5e2c9b4d1f8a3c60e7b2d9541a8c3f6…
```

```
firma_esperada = "sha256=" + hex( HMAC_SHA256( META_APP_SECRET, raw_body ) )
```

| Comprobación | Regla | Fallo |
|---|---|---|
| Algoritmo | HMAC-SHA256, comparación en **tiempo constante** (`crypto.timingSafeEqual`) | `401 WEBHOOK_SIGNATURE_INVALID` |
| Cabecera | `X-Hub-Signature-256`, prefijo `sha256=` obligatorio | `401` |
| Longitud | El hexadecimal debe medir 64 caracteres, comprobado **antes** de `timingSafeEqual` (esa función **lanza** si los buffers difieren, y una excepción aquí sería un `500` con reintento eterno de Meta) | `401` |
| Secreto | `META_APP_SECRET`, en entorno, **nunca** en la DB ni en el contexto del modelo | — |
| Cuerpo | Se verifica sobre el crudo; un body re-serializado invalida la firma | `401` |
| Método | Solo `POST` | `405` |

**Meta no envía timestamp.** No hay `t=`, ni ventana de tolerancia, ni `WEBHOOK_TOLERANCE_SECONDS`.
Eso deja sin protección anti-replay por reloj, y es aceptable **porque el replay no es el riesgo
real aquí**: reenviar un evento ya visto no duplica nada si la deduplicación está en la base de
datos, que es donde tiene que estar (§8.3). Añadir un reloj propio solo daría la apariencia de una
defensa que la firma de Meta no sostiene.

#### b) Esquema genérico (previsto, **no implementado**)

Para emisores que sí lo admitan —un futuro conector propio— el esquema con marca de tiempo, que
**no** es el de Meta:

```http
X-Webhook-Signature: t=1759324951,v1=6f2a9c4e1b8d3f70a5e2c9b4d1f8a3c60e7b2d9541a8c3f6
X-Webhook-Id: evt_0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77
```

```
firma_esperada = HMAC_SHA256( WEBHOOK_SECRET_{SOURCE}, "{t}.{raw_body}" )
```

Con tolerancia `abs(now() - t) <= WEBHOOK_TOLERANCE_SECONDS` (default 300) y esquema admitido `t`,
`v1`. **Ninguna de estas dos cosas existe en el código todavía**: se documentan aquí para que quien
lea no las dé por hechas. `WEBHOOK_SECRET_{SOURCE}` tampoco existe como variable; hoy solo hay
`META_APP_SECRET`.

#### Auditoría

Un fallo de firma se registra en `audit_logs` (`action='webhook.signature_invalid'`,
`actor_type='SYSTEM'`) y **no** se procesa nada. Es un evento de seguridad, no ruido. La fila se
escribe **sin el cuerpo**, que lleva PII: se registra el origen, la IP del emisor y el `trace_id`,
que es lo que permite investigar sin duplicar datos personales en una tabla de auditoría.

### 8.3 Idempotencia: una sola bandeja por emisor

Los emisores reintentan. La misma entrega puede llegar 3 veces. **Regla: un emisor tiene exactamente
una tabla de deduplicación.** Dos tablas con el mismo `UNIQUE` para el mismo evento son dos verdades
que acaban divergiendo, y la que se consulte deja de ser la buena sin que nadie lo note.

| Emisor | Bandeja de deduplicación | Clave única | Estado |
|---|---|---|---|
| Meta Lead Ads | `meta_lead_submissions` (`database.md` §15) | `UNIQUE(meta_lead_id)` | Prevista — es la bandeja de Meta |
| Genérico (`webhook_events`) | `webhook_events` (`database.md` §11) | `UNIQUE(source, external_id)` | **No implementada**; ver nota |

**Corrección respecto a la primera versión de este documento.** Aquí figuraba `webhook_events`
como la bandeja de *todos* los webhooks, Meta incluido. Pero `meta_lead_submissions` ya existe en el
modelo con su propio `UNIQUE(meta_lead_id)` y su `raw_payload`, así que Meta tendría **dos** bandejas.
Se usa la que ya existe. `webhook_events` queda como bandeja del esquema genérico (§8.2b) para
emisores que no tengan tabla propia; hoy no está creada y no hay emisor que la necesite.

Flujo de una entrega de Meta:

```
1. Verificar firma (§8.2). Si falla → 401, fin.
2. Extraer el leadgen_id del payload (la clave de deduplicación de Meta).
3. INSERT INTO meta_lead_submissions (meta_lead_id, raw_payload, …)
       ON CONFLICT (meta_lead_id) DO NOTHING RETURNING id
4. Si NO se insertó  → ya procesado: responder 200 {duplicate:true}. NO reprocesar.
5. Si se insertó      → procesar la ingesta y responder 200 {received:true}.
```

| Nota | Por qué |
|---|---|
| La deduplicación es de la **base de datos**, no del proceso | Dos réplicas del API atendiendo el mismo reintento en paralelo no pueden deduplicar en memoria; el `UNIQUE` sí |
| Sin `webhook_events` no hay columna `status` que consultar | El estado del procesamiento lo lleva el propio lead (`meta_lead_submissions` → `leads`). Una tabla de estado intermedia solo hace falta cuando el efecto es asíncrono y encolado (§7), y la ingesta de un lead no lo es |
| `signature_valid` | No se almacena: la firma se verifica **antes** de tocar la tabla, y una firma inválida termina en `401` sin insertar fila. Guardar `signature_valid = true` en todas las filas sería una columna con un solo valor |

### 8.4 Respuesta al emisor

| Situación | HTTP | Cuerpo |
|---|---|---|
| Firma inválida | `401` | `application/problem+json` con `WEBHOOK_SIGNATURE_INVALID` |
| Entrega nueva aceptada (efecto inmediato) | `200` | `{ "received": true }` |
| Entrega nueva encolada | `202` | `{ "received": true, "taskId": "…" }` |
| Entrega duplicada (`UNIQUE` violado) | `200` | `{ "received": true, "duplicate": true }` |
| Payload correctamente firmado pero desconocido | `200` | `{ "received": true, "ignored": true }` |

**Regla clave:** un duplicado responde `200`, nunca `409`. Responder error a un duplicado hace
que el emisor reintente indefinidamente un evento que ya está procesado. El webhook debe
confirmar rápido (< 5 s): si el efecto es lento, se encola (`202`) y se procesa en el worker.

### 8.5 Seguridad adicional

- **Allowlist de IPs** del emisor cuando el proveedor publica sus rangos, además de la firma.
  La firma es la garantía; la IP es defensa en profundidad.
- El payload de un webhook es contenido **externo**: entra al contexto de un agente marcado
  como `untrusted` (S1, §K.1). Un webhook no puede provocar una llamada a red del agente.
- Los secretos de webhook se rotan; se admiten **dos secretos activos** durante una ventana de
  rotación y se acepta la firma que valide contra cualquiera de los dos.
- El cuerpo de un webhook nunca se loguea completo si contiene datos personales (Stripe:
  metadatos de pago); se loguea `event_type`, `external_id` y un hash.

---

## 9. Catálogo de endpoints del MVP

Recursos y rutas base de `architecture-review.md` §F.3, ampliados de forma coherente con las
entidades de `database.md`. Columnas:

- **Permiso**: `Permission` exigido por `@RequirePermission()`.
- **Async**: `202` + `taskId` (§7).
- **Idem**: requiere `Idempotency-Key` (§6.2).
- **Fase**: hito/fase en que se implementa; `Post-MVP` = fuera del MVP.

Todas las rutas llevan el prefijo `/api/v1` (omitido en la tabla por legibilidad).

### 9.1 auth

| Método | Ruta | Permiso | Async | Idem | Fase | Notas |
|---|---|---|---|---|---|---|
| POST | `/auth/login` | — (público) | No | No | 1 | Rate limit `auth-login`; argon2id |
| POST | `/auth/refresh` | — (cookie) | No | No | 1 | Rotación + detección de reuso |
| POST | `/auth/logout` | — (cookie) | No | No | 1 | Idempotente; revoca la familia |
| GET | `/auth/me` | autenticado | No | — | 1 | Usuario + permisos efectivos |

### 9.2 crm

| Método | Ruta | Permiso | Async | Idem | Fase | Notas |
|---|---|---|---|---|---|---|
| GET | `/leads` | `READ_CUSTOMER_DATA` | No | — | 2 | Cursor; `status`, `source`, `owner-user-id`, `score-gte`, `q` |
| POST | `/leads` | `WRITE_CUSTOMER_DATA` | No | **Sí** | 2 | Crea o adjunta `identity` |
| GET | `/leads/:id` | `READ_CUSTOMER_DATA` | No | — | 2 | `ETag` |
| PATCH | `/leads/:id` | `WRITE_CUSTOMER_DATA` | No | No | 2 | `If-Match` |
| POST | `/leads/:id/convert` | `WRITE_CUSTOMER_DATA` | No | **Sí** | 2 | Crea `contacts` + `opportunities`, escribe `lead_stage_history`, emite `LeadConverted` |
| GET | `/leads/:id/timeline` | `READ_CUSTOMER_DATA` | No | — | 2 | `touchpoints` + `activities` + `lead_stage_history` fusionados por fecha |
| GET | `/identities/:id` | `READ_CUSTOMER_DATA` | No | — | 2 | Incluye `identity_links` |
| POST | `/identities/merge` | `WRITE_CUSTOMER_DATA` | No | **Sí** | 2 | Fusión `anon → lead`; detecta ciclos (`IDENTITY_CONFLICT`) |
| GET | `/contacts` | `READ_CUSTOMER_DATA` | No | — | 2 | Cursor |
| POST | `/contacts` | `WRITE_CUSTOMER_DATA` | No | **Sí** | 2 | |
| GET | `/opportunities` | `READ_CUSTOMER_DATA` | No | — | 2 | Filtro `stage`; cursor |
| POST | `/opportunities` | `WRITE_CUSTOMER_DATA` | No | **Sí** | 2 | |
| GET | `/opportunities/:id` | `READ_CUSTOMER_DATA` | No | — | 2 | |
| PATCH | `/opportunities/:id/stage` | `WRITE_CUSTOMER_DATA` | No | No | 2 | `If-Match`; valida el pipeline |
| GET | `/activities` | `READ_CUSTOMER_DATA` | No | — | 2 | Filtro `subject-type`+`subject-id`, `due-before`, `completed` |
| POST | `/activities` | `WRITE_CUSTOMER_DATA` | No | **Sí** | 2 | |
| PATCH | `/activities/:id/complete` | `WRITE_CUSTOMER_DATA` | No | No | 2 | Devuelve `204` |
| POST | `/public/touchpoints` | — (público) | No | Opcional | 2 | Rate limit `public-touchpoint`; append-only |
| POST | `/public/forms/:formKey/submissions` | — (público) | No | **Sí** | 2 | Consentimiento obligatorio; crea `identities`+`leads` |

**`POST /leads/:id/first-response` — por definir, y a propósito.** Marca `leads.first_response_at`,
que es el dato con el que se mide el tiempo de primera respuesta (un KPI del negocio: un lead de
Meta sin contestar en la primera hora se enfría). El contrato ya tiene la forma de entrada
(`firstResponseRequestSchema` en `@crm/contracts`), pero el **endpoint no se especifica todavía**
porque el diseño depende de una decisión que aún no se ha tomado: si la primera respuesta se marca
**sola** al abrir el enlace `wa.me` (barato, pero solo prueba que se abrió un enlace, no que se
contestó) o **a mano** desde el CRM (fiable, pero se olvida). Elegir mal aquí produce un KPI que
miente, y un KPI que miente es peor que no tenerlo. Se decide cuando exista la pantalla de detalle
del lead. Entre tanto, la tabla de `GET /leads` muestra «sin responder» sin inventar un estado.

**`GET /leads` existe en el cliente y no en el servidor.** `apps/web` ya llama a esta ruta (§9.2,
Fase 2) y recibe `404 RESOURCE_NOT_FOUND`, que la pantalla traduce a «el listado todavía no está
implementado» en vez de a un error. Cuando se implemente, el acceso llevará un **token estático de
desarrollo** en `.env`, exigido solo fuera de producción y **fail-closed**: sin token configurado la
ruta no responde, en lugar de responder sin exigirlo. Es un apaño declarado para poder ver la
pantalla antes de que exista autenticación (`@RequirePermission` es de Fase 1), y no puede llegar a
producción: el arranque falla si `NODE_ENV=production` y el modo no es el real.

### 9.3 catalog

| Método | Ruta | Permiso | Async | Idem | Fase | Notas |
|---|---|---|---|---|---|---|
| GET | `/products` | `READ_PRODUCTS` | No | — | 3 | Cursor; `status`, `category-id`, `score-gte`, `q` (`pg_trgm`) |
| POST | `/products` | `WRITE_PRODUCTS` | No | **Sí** | 3 | Emite `ProductCreated` |
| GET | `/products/:id` | `READ_PRODUCTS` | No | — | 3 | `ETag` |
| PATCH | `/products/:id` | `WRITE_PRODUCTS` | No | No | 3 | `If-Match` |
| PUT | `/products/:id/costs` | `WRITE_PRODUCTS` | No | No | 3 | **Versiona**: inserta fila nueva en `product_costs`; idempotente por `(product_id, valid_from)` |
| GET | `/products/:id/economics` | `READ_PRODUCTS` | No | — | 3 | `contribution_margin`, `break_even_cac`, `break_even_roas` calculados |
| GET | `/products/:id/economics/history` | `READ_PRODUCTS` | No | — | 3 | `product_economics_snapshot` |
| GET | `/products/:id/metrics` | `READ_PRODUCTS` | No | — | 3 | Cada métrica con `provenance` + `confidence` + `method` |
| GET | `/products/:id/sources` | `READ_PRODUCTS` | No | — | 3 | `product_sources` + conector de origen |
| GET | `/products/:id/duplicates` | `READ_PRODUCTS` | No | — | 3 | Similitud `pg_trgm` + embedding (ADR-008) |
| GET | `/categories` | `READ_PRODUCTS` | No | — | 3 | Offset permitido (tabla pequeña) |
| POST | `/categories` | `WRITE_PRODUCTS` | No | **Sí** | 3 | |

### 9.4 intelligence

| Método | Ruta | Permiso | Async | Idem | Fase | Notas |
|---|---|---|---|---|---|---|
| GET | `/research-runs` | `EXECUTE_AGENT` | No | — | 5 | Cursor; `status`, `niche` |
| POST | `/research-runs` | `EXECUTE_AGENT` | **Sí (202)** | **Sí** | 5 | Cola `ai`; rate limit `async-launch` |
| GET | `/research-runs/:id` | `EXECUTE_AGENT` | No | — | 5 | Estado + `progress` (§7.2) |
| POST | `/research-runs/:id/cancel` | `EXECUTE_AGENT` | No | No | 5 | No deja candidatos huérfanos |
| GET | `/research-runs/:id/candidates` | `EXECUTE_AGENT` | No | — | 5 | Orden por `rank`/`score`; filtro `decision`, `provenance` |
| POST | `/research-runs/:id/candidates/:productId/decision` | `WRITE_PRODUCTS` | No | **Sí** | 5 | `SELECTED` crea `approvals(SELECT_PRODUCT)` |
| POST | `/products/:id/score` | `WRITE_PRODUCTS` | **Sí (202)** | **Sí** | 3 | Cola `compute`; `refreshSources:true` re-consulta conectores |
| GET | `/products/:id/scores` | `READ_PRODUCTS` | No | — | 3 | Historial versionado (`product_scores` no se actualiza) |
| GET | `/connectors` | `MANAGE_CONNECTORS` | No | — | 3 | Estado, cuota consumida, última sync, `last_error` |
| GET | `/connectors/:id` | `MANAGE_CONNECTORS` | No | — | 3 | Ficha de compliance completa |
| PATCH | `/connectors/:id` | `MANAGE_CONNECTORS` | No | No | 3 | `enabled`, `kill_switch` |
| POST | `/connectors/:id/approve` | `MANAGE_CONNECTORS` | No | **Sí** | 3 | Firma la ficha (`approved_by`, `approved_at`); solo humano |
| POST | `/connectors/:id/sync` | `MANAGE_CONNECTORS` | **Sí (202)** | **Sí** | 3 | Cola `io`; consume cuota real |

### 9.5 content y seo

| Método | Ruta | Permiso | Async | Idem | Fase | Notas |
|---|---|---|---|---|---|---|
| GET | `/content` | `READ_CONTENT` | No | — | 6 | Cursor; `type`, `channel`, `status`, `cluster-id` |
| POST | `/content` | `WRITE_CONTENT` | No | **Sí** | 6 | Sanitiza `body_html` al guardar (S2) |
| GET | `/content/:id` | `READ_CONTENT` | No | — | 6 | `ETag` |
| PATCH | `/content/:id` | `WRITE_CONTENT` | No | No | 6 | `If-Match`; sanitización en servidor |
| POST | `/content/:id/submit-approval` | `WRITE_CONTENT` | No | **Sí** | 6 | Crea `approvals(PUBLISH_CONTENT)` |
| POST | `/content/:id/publish` | `PUBLISH_CONTENT` | No | **Sí** | 6 | Exige `approvalId` aprobado; valida canibalización |
| POST | `/content/:id/unpublish` | `PUBLISH_CONTENT` | No | No | 6 | |
| GET | `/content/:id/links` | `READ_CONTENT` | No | — | 6 | `content_links` |
| POST | `/content/:id/links` | `WRITE_CONTENT` | No | No | 6 | Internal linking |
| GET | `/brands` | `READ_CONTENT` | No | — | 6 | Brand context |
| PUT | `/brands/:id` | `MANAGE_BRAND` | No | No | 6 | Tono, palabras prohibidas/preferidas, audiencia |
| GET | `/keywords` | `MANAGE_SEO` | No | — | 6 | Cursor; `intent`, `country`, `q` (trigram) |
| POST | `/keywords` | `MANAGE_SEO` | No | **Sí** | 6 | `provenance` obligatoria |
| GET | `/clusters` | `MANAGE_SEO` | No | — | 6 | |
| POST | `/clusters` | `MANAGE_SEO` | No | **Sí** | 6 | |
| POST | `/clusters/rebuild` | `MANAGE_SEO` | **Sí (202)** | **Sí** | 6 | Clustering por embeddings (pgvector) |
| GET | `/briefs` | `MANAGE_SEO` | No | — | 6 | |
| POST | `/briefs` | `MANAGE_SEO` | No | **Sí** | 6 | |
| GET | `/seo/index-status` | `MANAGE_SEO` | No | — | 6 | `seo_index_status` (Search Console) |
| POST | `/seo/index-status/refresh` | `MANAGE_SEO` | **Sí (202)** | **Sí** | 6 | Consulta Search Console |
| POST | `/seo/sitemap/rebuild` | `MANAGE_SEO` | **Sí (202)** | **Sí** | 6 | Cola `seo`; solo contenido `PUBLISHED` |

### 9.6 campaigns, creatives y approvals

| Método | Ruta | Permiso | Async | Idem | Fase | Notas |
|---|---|---|---|---|---|---|
| GET | `/campaigns` | `READ_CAMPAIGNS` | No | — | 7 | Cursor; `status`, `product-id`, `template` |
| POST | `/campaigns` | `CREATE_CAMPAIGN` | No | **Sí** | 7 | Nace en `DRAFT` |
| GET | `/campaigns/templates` | `READ_CAMPAIGNS` | No | — | 7 | Datos, no código (§H.4); `kpi_primary` por template |
| GET | `/campaigns/:id` | `READ_CAMPAIGNS` | No | — | 7 | `ETag` |
| PATCH | `/campaigns/:id` | `WRITE_CAMPAIGN` | No | No | 7 | `If-Match`; solo en `DRAFT`/`READY` |
| POST | `/campaigns/:id/transition` | `WRITE_CAMPAIGN` | No | **Sí** | 7 | Máquina de estados; `approvalId` para `ACTIVE`; `If-Match` |
| POST | `/campaigns/:id/submit-approval` | `WRITE_CAMPAIGN` | No | **Sí** | 7 | Crea `approvals(PUBLISH_CAMPAIGN)` |
| POST | `/campaigns/:id/budget` | `CHANGE_BUDGET` | No | **Sí** | 7 | Guardrails; `428` si supera `MAX_BUDGET_CHANGE_PERCENTAGE` |
| GET | `/campaigns/:id/metrics` | `READ_METRICS` | No | — | 8 | `campaign_metrics_daily` |
| GET | `/campaigns/:id/transitions` | `READ_CAMPAIGNS` | No | — | 7 | `campaign_state_transitions` (append-only) |
| GET | `/campaigns/:id/ads` | `READ_CAMPAIGNS` | No | — | 7 | `ad_sets` → `ads` → `creatives` |
| GET | `/creatives` | `READ_CAMPAIGNS` | No | — | 6 | `status`, `type`, `campaign-id` |
| POST | `/creatives` | `GENERATE_CONTENT` | No | **Sí** | 6 | Solo `generation_prompt` en el MVP (sin imagen/video) |
| GET | `/approvals` | autenticado | No | — | 7 | Cursor; `status`, `type` |
| GET | `/approvals/:id` | autenticado | No | — | 7 | Incluye `proposed_payload` y `rationale` |
| POST | `/approvals/:id/approve` | permiso del `type` (§4.4) | No | **Sí** | 7 | Revalida payload contra schema de la tool |
| POST | `/approvals/:id/reject` | permiso del `type` | No | No | 7 | Devuelve el subject a su estado previo |
| POST | `/approvals/:id/modify` | permiso del `type` | No | **Sí** | 7 | `modified_payload`; ejecuta lo modificado |

### 9.7 analytics y órdenes

| Método | Ruta | Permiso | Async | Idem | Fase | Notas |
|---|---|---|---|---|---|---|
| GET | `/analytics/overview` | `READ_METRICS` | No | — | 8 | KPIs con definición explícita; `from`/`to` |
| GET | `/analytics/campaigns` | `READ_METRICS` | No | — | 8 | Orden por `contribution_margin` por defecto, no por revenue |
| GET | `/analytics/funnel` | `READ_METRICS` | No | — | 8 | Embudo con conversión por etapa y punto de fuga |
| GET | `/analytics/attribution/:orderId` | `READ_METRICS` | No | — | 7 | Cadena completa de touchpoints de la venta |
| POST | `/analytics/attribution/recompute` | `WRITE_ORDERS` | **Sí (202)** | **Sí** | 7 | Recalcula `order_attribution` para un modelo dado |
| GET | `/analytics/metrics/definitions` | `READ_METRICS` | No | — | 8 | Fórmula única de CTR/CPC/CPA/ROAS/ROI/CAC/AOV (§8, roadmap) |
| GET | `/orders` | `READ_CUSTOMER_DATA` | No | — | 7 | Cursor; `status`, `campaign-id`, `placed-after` |
| POST | `/orders` | `WRITE_ORDERS` | No | **Sí** | 7 | Carga manual en el MVP; `total_cost` por línea obligatorio |
| GET | `/orders/:id` | `READ_CUSTOMER_DATA` | No | — | 7 | Incluye `order_items` y `order_attribution` |
| PATCH | `/orders/:id` | `WRITE_ORDERS` | No | No | 7 | `status`; `If-Match` |

### 9.8 ai

El API `/ai/*` es el **plano de control humano**. Los agentes **no** usan HTTP: acceden por
tools in-process vía `ToolRegistry` (§11). Estas rutas existen para lanzar, observar, limitar y
auditar la IA.

| Método | Ruta | Permiso | Async | Idem | Fase | Notas |
|---|---|---|---|---|---|---|
| GET | `/ai/agents` | `MANAGE_AGENTS` | No | — | 4 | `ai_agents` con `permissions`, `enabled`, límites |
| POST | `/ai/agents` | `MANAGE_AGENTS` | No | **Sí** | 4 | Registrar agente |
| PATCH | `/ai/agents/:id` | `MANAGE_AGENTS` | No | No | 4 | `permissions`, `enabled`, `max_tokens_per_task` |
| GET | `/ai/agents/:id/runs` | `MANAGE_AGENTS` | No | — | 4 | Cursor |
| POST | `/ai/tasks` | `EXECUTE_AGENT` | **Sí (202)** | **Sí** | 4 | Ejecuta un agente; rate limit `async-launch` |
| GET | `/ai/tasks/:id` | `EXECUTE_AGENT` | No | — | 4 | Estado del `ai_task` |
| POST | `/ai/tasks/:id/cancel` | `EXECUTE_AGENT` | No | No | 4 | |
| POST | `/ai/tasks/:id/stream-token` | `EXECUTE_AGENT` | No | No | 4 | Token de un solo uso para SSE (§7.4) |
| GET | `/ai/tasks/:id/stream` | `EXECUTE_AGENT` | **SSE** | — | 4 | `text/event-stream`; opcional |
| GET | `/ai/runs/:id` | `MANAGE_AGENTS` | No | — | 4 | Modelo, `routing_reason`, tokens, costo, latencia, `result` |
| GET | `/ai/runs/:id/tool-calls` | `MANAGE_AGENTS` | No | — | 4 | `ai_tool_calls` con estado y `approval_id` |
| GET | `/ai/costs/summary` | `MANAGE_AGENTS` | No | — | 4 | `ai_costs` agregado por proveedor/modelo/agente |
| GET | `/ai/budgets` | `MANAGE_AGENTS` | No | — | 4 | `ai_budgets` con consumo actual |
| PATCH | `/ai/budgets/:id` | `MANAGE_AGENTS` | No | No | 4 | `limit_usd`, `alert_threshold_pct` |
| GET | `/ai/memory` | `MANAGE_AGENTS` | No | — | 4 | Memoria destilada por `scope` (solo lectura en el MVP) |

### 9.9 admin

| Método | Ruta | Permiso | Async | Idem | Fase | Notas |
|---|---|---|---|---|---|---|
| GET | `/admin/health` | `MANAGE_SYSTEM` | No | — | 1 | Estado de DB, Redis, worker, LLM, conectores |
| GET | `/admin/jobs` | `MANAGE_SYSTEM` | No | — | 4 | Colas BullMQ + `jobs_audit` |
| GET | `/admin/audit` | `READ_AUDIT` | No | — | 1 | Cursor sobre `audit_logs` |
| GET | `/admin/costs` | `MANAGE_SYSTEM` | No | — | 4 | Costo de IA + consumo de cuota de conectores |
| GET | `/admin/outbox` | `MANAGE_SYSTEM` | No | — | 1 | `outbox_events` por estado |
| POST | `/admin/outbox/:id/redispatch` | `MANAGE_SYSTEM` | No | **Sí** | 1 | Republica un evento `FAILED` |
| GET | `/admin/feature-flags` | `MANAGE_SYSTEM` | No | — | 9 | Offset permitido |
| PATCH | `/admin/feature-flags/:key` | `MANAGE_SYSTEM` | No | No | 9 | Activa automatización por capacidad |

### 9.10 webhooks entrantes

| Método | Ruta | Autorización | Async | Idem | Fase |
|---|---|---|---|---|---|
| POST | `/webhooks/meta` | Firma HMAC (§8) | Según efecto | `webhook_events` UNIQUE | 7 |
| POST | `/webhooks/google-ads` | Firma HMAC (§8) | Según efecto | `webhook_events` UNIQUE | 7 |
| POST | `/webhooks/stripe` | Firma HMAC (§8) | — | — | **Post-MVP** (sin `payments`) |

### 9.11 Fuera del MVP

| Endpoint | Motivo |
|---|---|
| Publicación de campañas en Meta/Google (`POST /campaigns/:id/publish`) | §M.2: la ejecución es manual |
| Cambios automáticos de presupuesto sin aprobación | §M.2 y ADR-005 |
| Generación real de imagen/video (`POST /creatives/generate`) | Post-MVP; en el MVP solo `generation_prompt` |
| Checkout / pasarela de pago (`POST /payments/*`) | Sin `payments` en el MVP (§O.3) |
| Envío de email/WhatsApp (`POST /messages/send`) | Se genera el texto, no se envía |
| Webhooks salientes (suscripciones de terceros) | Un solo consumidor interno |
| Multi-organización (`POST /organizations/*`, invitaciones, roles) | Sin segundo inquilino (ADR-011) |
| OAuth propio para terceros | Sin API pública en el MVP |

---

## 10. Ejemplos completos

### 10.1 Crear lead — `POST /api/v1/leads`

Recurso: `leads` + `identities` (`database.md` §3). Síncrono, con `Idempotency-Key`.

**Request**

```http
POST /api/v1/leads HTTP/1.1
Host: api.crm-ventas.internal
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…
Idempotency-Key: 5b1e0c9a-3f47-4a2e-8d61-7c0b9e2a4d33
Content-Type: application/json
If-None-Match: *
```

```json
{
  "identity": {
    "anonymousId": "anon_7f3c2a91d4e8b0f5",
    "email": "ana.gomez@ejemplo.com",
    "phone": "+573001112233"
  },
  "status": "NEW",
  "source": "paid",
  "ownerUserId": "0198f0aa-1b2c-7d3e-9f40-5a6b7c8d9e01",
  "firstTouchpointId": "0198f1b2-3c4d-7e5f-8a90-1b2c3d4e5f60",
  "lastTouchpointId": "0198f1b2-9a8b-7c6d-5e4f-3a2b1c0d9e8f",
  "notes": "Descargó la guía de comparativa; pidió precio por WhatsApp.",
  "consent": {
    "granted": true,
    "basis": "consent",
    "textVersion": "privacy-v3",
    "capturedAt": "2026-10-01T14:19:55.003Z"
  },
  "tags": ["high-intent", "whatsapp"]
}
```

Reglas del caso de uso:

1. Se resuelve la identidad por `anonymous_id` → email → teléfono. Si no existe, se crea una fila
   en `identities`; si existe, se **completa** (no se duplica). El `UNIQUE(anonymous_id)` y el
   `UNIQUE(organization_id, lower(email))` parcial son la garantía durable.
2. `first_touchpoint_id` / `last_touchpoint_id` se validan contra `touchpoints` de la misma
   organización; si no pertenecen, `422 VALIDATION_FAILED`.
3. `consent` es **obligatorio** si `source = 'paid'` o el lead llega desde un formulario público
   (minimización y base legal, riesgo S6).
4. Se escribe `audit_logs` (`action='lead.create'`, `actor_type='USER'`) y se emite
   `LeadCreated` al `outbox_events` en la misma transacción (ADR-009).

**Response `201 Created`**

```http
HTTP/1.1 201 Created
Location: /api/v1/leads/0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77
ETag: "7f3c2a91d4e8b0f5"
X-Trace-Id: 7c1f9a4e2b8d3f6a0c5e9b2d4a7f1c3e
```

```json
{
  "id": "0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77",
  "organizationId": "0198f000-0000-7000-8000-000000000001",
  "identityId": "0198f2c0-9d8e-7f6a-5b4c-3d2e1f0a9b8c",
  "identity": {
    "id": "0198f2c0-9d8e-7f6a-5b4c-3d2e1f0a9b8c",
    "anonymousId": "anon_7f3c2a91d4e8b0f5",
    "email": "ana.gomez@ejemplo.com",
    "phone": "+573001112233",
    "isCustomer": false,
    "firstSeenAt": "2026-09-19T08:03:12.440Z"
  },
  "status": "NEW",
  "source": "paid",
  "score": null,
  "ownerUserId": "0198f0aa-1b2c-7d3e-9f40-5a6b7c8d9e01",
  "firstTouchpointId": "0198f1b2-3c4d-7e5f-8a90-1b2c3d4e5f60",
  "lastTouchpointId": "0198f1b2-9a8b-7c6d-5e4f-3a2b1c0d9e8f",
  "convertedAt": null,
  "createdAt": "2026-10-01T14:22:31.482Z",
  "updatedAt": "2026-10-01T14:22:31.482Z"
}
```

**Replay** (misma `Idempotency-Key`, mismo payload), dentro de la ventana de 24 h:

```http
HTTP/1.1 201 Created
Idempotency-Replayed: true
Location: /api/v1/leads/0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77
```

El cuerpo es idéntico al de la creación real. **No** se crea una segunda identidad ni un segundo lead.

**Misma key, payload distinto** (p. ej. otro email):

```json
{
  "type": "https://errors.crm-ventas.internal/problems/idempotency-conflict",
  "title": "Conflicto de idempotencia",
  "status": 409,
  "detail": "La Idempotency-Key '5b1e0c9a-…' se usó con un payload distinto. Usa una key nueva para una petición diferente.",
  "instance": "/api/v1/leads",
  "code": "IDEMPOTENCY_CONFLICT",
  "traceId": "1a2b3c4d5e6f708192a3b4c5d6e7f809",
  "timestamp": "2026-10-01T14:23:02.117Z",
  "retryable": false,
  "context": { "resourceId": "0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77" }
}
```

### 10.2 Lanzar research run — `POST /api/v1/research-runs` (asíncrono)

Recurso: `research_runs` (`database.md` §5). Asíncrono con `202` + `taskId`; ejecuta el
`ProductResearchAgent` (Fase 5). Consume conectores y presupuesto de IA: requiere idempotencia.

**Request**

```http
POST /api/v1/research-runs HTTP/1.1
Host: api.crm-ventas.internal
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…
Idempotency-Key: 9f8e7d6c-5b4a-4938-8271-6a5b4c3d2e1f
Content-Type: application/json
```

```json
{
  "niche": "accesorios para mascotas",
  "targetMarket": "CO",
  "country": "CO",
  "connectorIds": ["0198f0cc-2a11-7b02-9c33-aa11bb22cc33"],
  "budgetHint": { "amount": "2000000.00", "currency": "COP" },
  "maxCandidates": 30,
  "minConfidence": 0.5,
  "refreshSources": true
}
```

Validaciones de entrada antes de encolar:

- `connectorIds` deben existir y tener `approved_at IS NOT NULL` y `kill_switch = false`.
  Si no → `403 CONNECTOR_NOT_APPROVED` / `409 CONNECTOR_DISABLED`.
- `niche` no vacío, 3–120 caracteres. `country` ISO 3166-1 alpha-2.
- `minConfidence` en `[0,1]`; `maxCandidates` en `[1,100]`.
- El usuario debe tener `EXECUTE_AGENT` (§4.1).

**Response `202 Accepted`**

```http
HTTP/1.1 202 Accepted
Location: /api/v1/research-runs/0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77
Retry-After: 5
X-Trace-Id: 2b3c4d5e6f708192a3b4c5d6e7f8091a
```

```json
{
  "taskId": "0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77",
  "status": "QUEUED",
  "resourceType": "research_run",
  "resourceId": "0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77",
  "pollUrl": "/api/v1/research-runs/0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77",
  "streamUrl": "/api/v1/ai/tasks/0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77/stream",
  "estimatedDurationSeconds": 900,
  "createdAt": "2026-10-01T14:22:31.482Z"
}
```

**Polling intermedio** — `GET /api/v1/research-runs/0198f2c1-…`:

```json
{
  "id": "0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77",
  "niche": "accesorios para mascotas",
  "targetMarket": "CO",
  "country": "CO",
  "status": "RUNNING",
  "progress": {
    "percent": 55,
    "stage": "scoring",
    "message": "Puntuando 22 de 41 candidatos",
    "counters": { "productsDiscovered": 41, "productsScored": 22 }
  },
  "connectorsUsed": ["0198f0cc-2a11-7b02-9c33-aa11bb22cc33"],
  "startedAt": "2026-10-01T14:22:36.004Z",
  "finishedAt": null,
  "agentRunId": "0198f2c2-5b4f-7d01-9e12-7a8b9c0d1e2f",
  "error": null,
  "report": null
}
```

**Resultado final** — `status: "COMPLETED"` con informe estructurado obligatorio
(datos, señales, supuestos, riesgos, información faltante y por qué interesa; requisito §4 del
prompt original):

```json
{
  "id": "0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77",
  "status": "COMPLETED",
  "productsDiscovered": 41,
  "productsScored": 27,
  "connectorsUsed": ["0198f0cc-2a11-7b02-9c33-aa11bb22cc33"],
  "startedAt": "2026-10-01T14:22:36.004Z",
  "finishedAt": "2026-10-01T14:36:58.221Z",
  "agentRunId": "0198f2c2-5b4f-7d01-9e12-7a8b9c0d1e2f",
  "error": null,
  "report": {
    "summary": "41 listings, 27 candidatos puntuados. 3 con datos REAL suficientes para pasar la puerta de economía.",
    "signals": [
      { "metricKey": "demand_proxy", "provenance": "ESTIMATED", "confidence": 0.68 },
      { "metricKey": "seller_count", "provenance": "REAL", "confidence": 1.0 },
      { "metricKey": "price_avg", "provenance": "REAL", "confidence": 1.0 }
    ],
    "assumptions": [
      "El costo de envío se asumió por rango de peso de la categoría (no observado).",
      "La tasa de devolución se tomó del default de la organización (ESTIMATED)."
    ],
    "risks": [
      "Concentración alta: un vendedor agrupa el 43% de las reseñas del nicho.",
      "Sin histórico de campañas propias, no hay CPC/CAC/ROAS (se marca INSUFFICIENT_DATA)."
    ],
    "missingData": ["review_growth_30d", "trend_index", "cpc_estimated", "cac_estimated"],
    "confidence": 0.61,
    "candidatesAboveThreshold": 3
  }
}
```

**Fallo con degradación** — `status: "FAILED"` con `partialResults: true` (§7.2). El run **no**
inventa el dato que no pudo obtener: lo declara en `missingData`.

**Listado de candidatos** — `GET /api/v1/research-runs/:id/candidates?sort=-score&provenance=REAL`:

```json
{
  "items": [
    {
      "id": "0198f2d0-1a2b-7c3d-9e4f-5a6b7c8d9e0f",
      "researchRunId": "0198f2c1-4a3e-7c91-8b2d-6f0e1a9c4d77",
      "productId": "0198f2c8-7d6e-7f5a-4b3c-2d1e0f9a8b7c",
      "rank": 1,
      "scoreId": "0198f2c9-8e7f-7a6b-5c4d-3e2f1a0b9c8d",
      "score": 82.5,
      "confidence": 0.74,
      "status": "SCORED",
      "rationale": "Demanda REAL alta con competencia moderada y economía unitaria positiva a precio observado.",
      "decision": "PENDING",
      "decidedBy": null,
      "decidedAt": null
    }
  ],
  "pageInfo": { "nextCursor": "eyJrIjpbODIuNSwiMDE5OGYyZDA…", "hasNextPage": true }
}
```

### 10.3 Transicionar campaña — `POST /api/v1/campaigns/:id/transition`

Recurso: `campaigns` + `campaign_state_transitions` (`database.md` §7), máquina de estados de
`§H.3`. Es el endpoint que materializa ADR-005: **`ACTIVE` exige aprobación humana**.

**Máquina de estados y precondiciones**

| Desde | Hacia | Precondiciones | `approvalId` |
|---|---|---|---|
| `DRAFT` | `READY` | `product_id`, `budget_total > 0`, `landing_content_id` publicado, `currency`, fechas coherentes | No |
| `DRAFT` | `ARCHIVED` | — | No |
| `READY` | `DRAFT` | — | No |
| `READY` | `PENDING_APPROVAL` | Existe `approvals(PUBLISH_CAMPAIGN, PENDING)` para la campaña | No (la crea `submit-approval`) |
| `PENDING_APPROVAL` | `ACTIVE` | `approval_id` **APROBADO** y no expirado; guardrails de presupuesto OK | **Sí** |
| `PENDING_APPROVAL` | `DRAFT` | Rechazo registrado (`decision_note`) | No |
| `ACTIVE` | `PAUSED` | — | No |
| `PAUSED` | `ACTIVE` | Guardrails de presupuesto OK | No |
| `ACTIVE` | `BLOCKED` | Se superó un techo de presupuesto | No (automático) |
| `BLOCKED` | `ACTIVE` | El humano sube el techo explícitamente | **Sí** |
| `ACTIVE` | `COMPLETED` | `end_date` alcanzada o acción manual | No |
| `COMPLETED` | `ARCHIVED` | — | No |
| Cualquiera no terminal | `ARCHIVED` | Solo si no está `ACTIVE` | No |

`ARCHIVED` es terminal: **ninguna** transición sale de él.

**Request A — `DRAFT → READY`** (síncrona, sin aprobación)

```http
POST /api/v1/campaigns/0198f2e0-3c4d-7e5f-8a90-1b2c3d4e5f60/transition HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…
Idempotency-Key: c1d2e3f4-a5b6-4978-8091-2a3b4c5d6e7f
If-Match: "3f2a1b0c9d8e7f65"
Content-Type: application/json
```

```json
{
  "to": "READY",
  "reason": "Brief de estrategia aprobado y landing publicada."
}
```

**Response `200 OK`**

```json
{
  "id": "0198f2e0-3c4d-7e5f-8a90-1b2c3d4e5f60",
  "name": "Lanzamiento Audífonos TWS — Octubre",
  "objective": "SALES",
  "template": "PRODUCT_LAUNCH",
  "kpiPrimary": "contribution_margin_per_campaign",
  "status": "READY",
  "productId": "0198f2c8-7d6e-7f5a-4b3c-2d1e0f9a8b7c",
  "budgetTotal": { "amount": "1250000.00", "currency": "COP" },
  "budgetDaily": { "amount": "80000.00", "currency": "COP" },
  "landingContentId": "0198f2d8-6c5b-4a39-8271-0e1d2c3b4a59",
  "approvalId": null,
  "startDate": "2026-10-05",
  "endDate": "2026-10-31",
  "updatedAt": "2026-10-01T14:40:12.003Z"
}
```

Efectos de la transición, en una sola transacción de base de datos (ADR-009): fila en
`campaign_state_transitions` (`from_status='DRAFT'`, `to_status='READY'`, `reason`,
`actor_user_id`), fila en `audit_logs` (`action='campaign.transition'`) y evento `CampaignReady`
en `outbox_events`.

**Request B — `PENDING_APPROVAL → ACTIVE`** (síncrona, exige `approvalId`)

```json
{
  "to": "ACTIVE",
  "approvalId": "0198f2f1-5b4a-4938-8271-6a5b4c3d2e1f",
  "reason": "Aprobación registrada; se activa la campaña.",
  "effectiveAt": "2026-10-05T00:00:00.000Z"
}
```

Precondiciones que el servicio valida **en este orden** (el primer fallo gana):

1. `If-Match` correcto → si no, `412 PRECONDITION_FAILED`.
2. Transición permitida por la máquina de estados → si no, `409 CAMPAIGN_INVALID_TRANSITION`.
3. `approvalId` presente → si no, `428 APPROVAL_REQUIRED`.
4. La aprobación existe, es de tipo `PUBLISH_CAMPAIGN`, apunta a **esta** campaña y está
   `APPROVED` → si no: `409 STATE_CONFLICT` o `410 APPROVAL_EXPIRED`.
5. El `modified_payload` de la aprobación (si lo hay) se revalida contra el schema de la tool →
   si no, `409 APPROVAL_PAYLOAD_CHANGED`.
6. Guardrails de presupuesto: `budget_daily ≤ MAX_DAILY_BUDGET`,
   `budget_total ≤ MAX_CAMPAIGN_BUDGET` → si no, `422 BUDGET_GUARDRAIL_EXCEEDED`.

**Response `200 OK`**

```json
{
  "id": "0198f2e0-3c4d-7e5f-8a90-1b2c3d4e5f60",
  "status": "ACTIVE",
  "approvalId": "0198f2f1-5b4a-4938-8271-6a5b4c3d2e1f",
  "publishedAt": "2026-10-01T14:42:07.551Z",
  "publishedBy": "0198f0aa-1b2c-7d3e-9f40-5a6b7c8d9e01",
  "updatedAt": "2026-10-01T14:42:07.551Z"
}
```

**Error — falta `approvalId`**

```json
{
  "type": "https://errors.crm-ventas.internal/problems/approval-required",
  "title": "Aprobación requerida",
  "status": 428,
  "detail": "La transición a ACTIVE exige un approvalId aprobado. Ninguna aprobación cubre esta campaña.",
  "instance": "/api/v1/campaigns/0198f2e0-3c4d-7e5f-8a90-1b2c3d4e5f60/transition",
  "code": "APPROVAL_REQUIRED",
  "traceId": "4d5e6f708192a3b4c5d6e7f8091a2b3c",
  "timestamp": "2026-10-01T14:41:02.884Z",
  "retryable": false,
  "docs": "https://docs.crm-ventas.internal/api/errors/approval-required",
  "context": {
    "campaignId": "0198f2e0-3c4d-7e5f-8a90-1b2c3d4e5f60",
    "from": "PENDING_APPROVAL",
    "to": "ACTIVE",
    "nextAction": "POST /api/v1/campaigns/0198f2e0-…/submit-approval"
  }
}
```

**Error — transición inválida**

```json
{
  "type": "https://errors.crm-ventas.internal/problems/campaign-invalid-transition",
  "title": "Transición de campaña inválida",
  "status": 409,
  "detail": "No se puede pasar de ARCHIVED a ACTIVE. ARCHIVED es un estado terminal.",
  "instance": "/api/v1/campaigns/0198f2e0-3c4d-7e5f-8a90-1b2c3d4e5f60/transition",
  "code": "CAMPAIGN_INVALID_TRANSITION",
  "traceId": "5e6f708192a3b4c5d6e7f8091a2b3c4d",
  "timestamp": "2026-10-01T14:43:19.220Z",
  "retryable": false,
  "context": {
    "campaignId": "0198f2e0-3c4d-7e5f-8a90-1b2c3d4e5f60",
    "from": "ARCHIVED",
    "to": "ACTIVE",
    "allowedTransitions": []
  }
}
```

**Error — guardrail de presupuesto**

```json
{
  "type": "https://errors.crm-ventas.internal/problems/budget-guardrail-exceeded",
  "title": "Guardrail de presupuesto excedido",
  "status": 422,
  "detail": "budgetDaily (150000.00 COP) supera MAX_DAILY_BUDGET (100000.00 COP).",
  "instance": "/api/v1/campaigns/0198f2e0-3c4d-7e5f-8a90-1b2c3d4e5f60/transition",
  "code": "BUDGET_GUARDRAIL_EXCEEDED",
  "traceId": "6f708192a3b4c5d6e7f8091a2b3c4d5e",
  "timestamp": "2026-10-01T14:44:01.660Z",
  "retryable": false,
  "context": {
    "guardrail": "MAX_DAILY_BUDGET",
    "limit": { "amount": "100000.00", "currency": "COP" },
    "attempted": { "amount": "150000.00", "currency": "COP" }
  }
}
```

Nota de alcance: llegar a `ACTIVE` **no** publica nada en Meta/Google. La campaña queda lista
para ejecución manual (§M.2). `campaign_platforms.external_campaign_id` permanece `null` hasta
que el humano la cree fuera de la plataforma y la sincronice a mano.

---

## 11. Contratos de tools de agente

> Este documento **no duplica** los contratos de tools. La fuente canónica es
> **`docs/ai-agents.md`**, junto con los Zod schemas en `packages/ai/src/tools/*` y
> `packages/contracts/src/ai-tools/`. Aquí solo se fija cómo se relacionan con el API HTTP.

### 11.1 Regla de acceso

```
                    ┌──────────────────────────────────────────────┐
   Humano / apps/web│  HTTP  /api/v1/ai/*   ← plano de CONTROL     │
   ────────────────►│  lanzar, observar, limitar, auditar          │
                    └──────────────────────────────────────────────┘

                    ┌──────────────────────────────────────────────┐
   Agente           │  ToolRegistry  ← plano de EJECUCIÓN         │
   ────────────────►│  permisos · schemas · timeout · aprobación   │
                    │  → Application Services → PostgreSQL         │
                    └──────────────────────────────────────────────┘
```

- Un agente **no** llama a `/api/v1/*` por HTTP. Sería un salto de proceso innecesario, obligaría
  a duplicar autorización y rompería la frontera de módulos.
- Toda capacidad del agente es una tool registrada que invoca un **application service** del
  módulo correspondiente (`crm`, `catalog`, `content`, `campaigns`, …). La frontera de módulos
  se respeta igual que en un controller.
- Un agente **no** tiene tool de SQL, ni de shell, ni un `fetch` genérico (§G.1, §K.3). Las tools
  de red tienen allowlist de dominios y pasan por el SSRF guard.

### 11.2 Relación entre `Permission` de tool y de endpoint

El mismo enum `Permission` gobierna ambos planos (§4.1). Una tool de escritura sobre productos
declara `permission: WRITE_PRODUCTS`; el endpoint `POST /products` exige `@RequirePermission(WRITE_PRODUCTS)`.
Así, un permiso concedido o revocado tiene un significado único en el sistema.

Cuando una tool es sensible, `requiresApproval: true` **no** la convierte en un endpoint HTTP:
sigue sin poder llamarse desde fuera. Lo que ocurre es que el `ToolRegistry` no la ejecuta y
crea una fila en `approvals`; el humano la decide vía `POST /approvals/:id/approve`, que
revalida el `proposed_payload` contra el `inputSchema` de la tool antes de ejecutarla (ADR-005).

### 11.3 Inventario de tools por agente

El inventario canónico de tools —nombre, permiso, `sideEffects`, `requiresApproval` y límites por
agente— vive en **[`ai-agents.md`](ai-agents.md) §7**, el documento que define los agentes.

**Aquí no se reproduce, y la razón es concreta.** Este documento mantenía una tabla de referencia
con estos mismos datos, escrita a mano. Al cruzar los documentos resultó estar en contradicción con
`ai-agents.md` en más de una docena de celdas: nombres de tool distintos (`listAgents` frente a
`getAvailableAgents`; `dispatchAgentTask` frente a `createAgentTask`) y, sobre todo, **permisos
distintos que habrían dejado a los agentes `content` y `seo` sin poder ejecutar nada** — la tabla
les exigía `MANAGE_SEO` y `WRITE_CONTENT` mientras los agentes declaran `GENERATE_CONTENT`. Es la
misma clase de fallo que dejaba inoperable al `orchestrator`, duplicada en 33 filas.

Dos listas de lo mismo mantenidas a mano divergen; una se elimina. Cuando los agentes existan como
código, el inventario real será el **registro de tools** (§11.4) y el test de contrato verificará
que los permisos declarados coinciden con los del registro. Una tabla escrita a mano no puede
competir con eso.

**Lo único que este documento necesita afirmar sobre las tools de agentes:** una tool **no** es un
endpoint HTTP. `requiresApproval: true` no la expone; el `ToolRegistry` no la ejecuta, crea una fila
en `approvals`, y el humano decide vía `POST /approvals/:id/approve` (§11.2, ADR-005).

Y el detalle con valor de trazabilidad cruzada: las tools `publishCampaign` y `changeCampaignBudget`
(`advertising`) y `proposeBudgetChange` (`budget_optimization`) existen en la forma del contrato
pero están **bloqueadas** en el MVP — `PUBLISH_CAMPAIGN` y `CHANGE_BUDGET` están en
`MVP_FORBIDDEN_AGENT_PERMISSIONS` y en `APPROVAL_REQUIRED_PERMISSIONS` (ADR-020).

### 11.4 Contrato de la tool

La interfaz `AgentTool<In, Out>` es la de `architecture-review.md` §G.2. Invariantes que el
`ToolRegistry` **hace cumplir** (test obligatorio en Fase 4):

| Invariante | Verificación |
|---|---|
| `inputSchema` valida antes de ejecutar | `TOOL_INVALID` si no |
| `outputSchema` valida después de ejecutar | `TOOL_BAD_OUTPUT` si no |
| `permission ∈ effective_permissions` | `TOOL_DENIED` si no |
| `requiresApproval` intercepta antes de ejecutar | Crea `approvals(PENDING)`; nunca ejecuta |
| `rateLimit.perMinute` por `(tool, agentId)` | `TOOL_THROTTLED` si excede |
| `timeoutMs` respetado | `TOOL_TIMEOUT` si excede |
| Todo intento queda en `ai_tool_calls` | `status`, `duration_ms`, `attempt`, `approval_id` |
| Contenido externo marcado `untrusted` | Nunca entra como instrucción |

### 11.5 Trazabilidad HTTP ↔ IA

| Endpoint | Qué se puede ver |
|---|---|
| `GET /ai/runs/:id` | `model_used`, `provider`, `routing_reason`, tokens, `cost_usd`, `latency_ms`, `result` |
| `GET /ai/runs/:id/tool-calls` | Cada `ai_tool_calls` con su estado y, si aplica, `approval_id` |
| `GET /approvals/:id` | La propuesta exacta (`proposed_payload`) que interceptó el registry |
| `GET /admin/audit` | `audit_logs` con `actor_agent_run_id`, enlazando la acción con el run |

La cadena `traceId` → `audit_logs.trace_id` → `ai_runs.trace_id` → logs de pino es la que
permite responder "¿por qué se hizo esto?" sin ambigüedad.

---

## 12. Política de evolución del API

### 12.1 Qué rompe versión y qué no

| Cambio | ¿Rompe? | Acción |
|---|---|---|
| Añadir un campo opcional a un response | No | Publicar en `/api/v1` |
| Añadir un endpoint nuevo | No | Publicar en `/api/v1` |
| Añadir un valor nuevo a un enum | **No**, con condición | El cliente debe tolerar valores desconocidos (§12.3) |
| Añadir un query param opcional | No | Publicar en `/api/v1` |
| Añadir un código de error nuevo al enum | No | Publicar en `/api/v1` |
| Añadir un `Permission` al enum | No | Publicar en `/api/v1`; registrar en `decisions.md` si cambia el modelo |
| Hacer obligatorio un param que era opcional | **Sí** | `/api/v2` |
| Quitar o renombrar un campo | **Sí** | `/api/v2` (o deprecación, §12.2) |
| Quitar un valor de enum | **Sí** | `/api/v2` |
| Cambiar el tipo de un campo (`string` → `number`) | **Sí** | `/api/v2` |
| Cambiar la semántica de un campo sin cambiar el tipo | **Sí** | `/api/v2` |
| Endurecer la validación de un campo existente | **Sí** | `/api/v2` |
| Cambiar el default de un query param | **Sí** (si altera resultados) | `/api/v2` |
| Cambiar un código de error por otro | **Sí** | `/api/v2` |
| Cambiar el formato de una fecha o de `Money` | **Sí** | `/api/v2` |

Regla: `code`, `Permission`, valores de enum y la forma de `Money`/fechas son **contrato
público**. Su evolución es la de los datos, no la del código.

### 12.2 Deprecación dentro de `v1`

Un campo o endpoint se puede deprecar **sin** romper, si se trata como un proceso con plazos:

```
1. Anuncio      El change note del PR y el CHANGELOG declaran la deprecación y la fecha de retirada.
2. Cabeceras    La respuesta empieza a incluir:
                  Deprecation: @1759324951              ← fecha (RFC 9745)
                  Sunset: Tue, 30 Dec 2026 23:59:59 GMT ← retirada (RFC 8594)
                  Link: </api/v2/leads>; rel="successor-version"
3. OpenAPI      La operación o el campo se marcan x-deprecated: true y x-sunset con la fecha.
4. Cliente      openapi-typescript genera el tipo marcado @deprecated: el editor avisa sin romper el build.
5. Telemetría   Cada llamada a un símbolo deprecado incrementa una métrica (endpoint + cliente).
6. Retirada     Solo cuando la métrica de uso llega a 0 durante N días (o vence el Sunset).
```

| Plazo mínimo de `Sunset` | Aplica a |
|---|---|
| **90 días** | Endpoints y campos consumidos por clientes fuera del monorepo (webhooks entrantes, integraciones) |
| **30 días** | Endpoints consumidos solo por `apps/web` / `apps/site` (el cliente generado se regenera en el mismo PR) |
| **0 días** | Símbolos que nunca se han usado en producción (`usage = 0` desde el primer día) |

Como el MVP tiene **un** consumidor interno, el plazo real es el de 30 días, y la mayoría de
deprecaciones se resuelven en un solo PR que regenera el cliente. El plazo de 90 días existe
para no tener que inventarlo el día que aparezca un consumidor externo.

### 12.3 Tolerancia a valores desconocidos

Obligación del cliente generado, declarada una vez y verificada por test:

- Un valor de enum desconocido en un response **no** debe lanzar: se mapea a un caso `UNKNOWN`
  y se muestra el valor crudo. Añadir un estado nuevo a `campaigns.status` no puede romper
  una versión antigua de `apps/web`.
- Un campo nuevo en un response se ignora si no se conoce.
- Un código de error desconocido se muestra con `title` y `detail`, sin lógica específica.

Esto es lo que permite que **añadir** sea siempre compatible sin publicar `v2`.

### 12.4 Cabeceras de evolución

| Cabecera | RFC | Uso |
|---|---|---|
| `Deprecation` | RFC 9745 | Cuándo pasó a deprecado (fecha, formato `@timestamp` o `date`) |
| `Sunset` | RFC 8594 | Cuándo deja de funcionar |
| `Link` | RFC 8288 | `rel="successor-version"` apuntando al reemplazo |
| `Warning` | RFC 9111 | Mensaje humano corto, además de las anteriores |

Ejemplo de una respuesta de un endpoint deprecado:

```http
HTTP/1.1 200 OK
Deprecation: @1759324951
Sunset: Tue, 30 Dec 2026 23:59:59 GMT
Link: </api/v2/research-runs>; rel="successor-version"
Warning: 299 - "Deprecado desde 2026-10-01. Usa /api/v2/research-runs. Retirada: 2026-12-30."
```

### 12.5 Creación de `/api/v2`

```
1. ADR en decisions.md: qué rompe, por qué, qué se gana, qué se pierde.
2. Implementar v2 junto a v1 en el mismo apps/api, compartiendo servicios de dominio.
   El controller v2 adapta; el dominio no se duplica.
3. OpenAPI con dos servers/secciones; el cliente se genera para la versión que consume el front.
4. v1 pasa a mantenimiento: solo bugs, sin features. Cabeceras Sunset en todas sus respuestas.
5. Retirada de v1 tras el Sunset, con telemetría de uso en 0.
6. El prefijo viejo devuelve 410 Gone con un problem+json que apunta a v2.
```

El coste de mantener dos versiones en un monolito modular es bajo precisamente porque la lógica
está en los servicios: `v1` y `v2` son dos capas de adaptación sobre el mismo dominio.

### 12.6 Fuera de alcance

- Versionado por cabecera (`Accept: application/vnd.crm.v2+json`): descartado; la ruta es más
  visible, cacheable y depurable.
- GraphQL como alternativa de evolución: descartado por ADR-012.
- Versionado por campo (`?api-version=`): descartado; fragmenta el contrato sin necesidad.

---

## 13. Testing de contrato y detección de drift

### 13.1 La cadena de contrato

```
packages/contracts/src/**/*.ts    ← Zod schemas: FUENTE ÚNICA DE VERDAD
        │
        ├─ build ─► packages/contracts/openapi.json     (generado, versionado en git)
        │
        └─ generate ─► packages/contracts/src/generated/  (openapi-typescript)
                            │
                            ├─► apps/api   (valida request/response contra los Zod schemas)
                            ├─► apps/web   (cliente tipado)
                            └─► apps/site  (cliente tipado para /public/*)
```

El drift —cliente generado que ya no coincide con el OpenAPI, o OpenAPI que ya no coincide con
el código que valida— es el bug más común de un monorepo con contrato generado. Se detecta en CI,
nunca en producción.

### 13.2 Job `contract` de CI

```yaml
# .github/workflows/ci.yml (extracto)
contract:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - run: pnpm install --frozen-lockfile

    # 1. Genera el OpenAPI desde los Zod schemas (determinista: claves ordenadas, sin timestamps)
    - run: pnpm --filter @crm/contracts build:openapi

    # 2. El artefacto generado debe estar commiteado y coincidir
    - run: git diff --exit-code packages/contracts/openapi.json

    # 3. Regenera el cliente y comprueba que no cambia
    - run: pnpm --filter @crm/contracts generate:client
    - run: git diff --exit-code packages/contracts/src/generated

    # 4. El OpenAPI es válido y no introduce cambios incompatibles frente a la rama base
    - run: pnpm openapi:validate          # valida contra el meta-schema 3.1
    - run: pnpm exec oasdiff breaking --base origin/main:packages/contracts/openapi.json \
                                       --revision packages/contracts/openapi.json --fail-on ERR

    # 5. Reglas propias del proyecto
    - run: pnpm exec spectral lint packages/contracts/openapi.json --ruleset .spectral.yaml

    # 6. Los frontends siguen compilando contra el cliente regenerado
    - run: pnpm --filter @crm/web typecheck
    - run: pnpm --filter @crm/site typecheck
```

El paso 1 es determinista a propósito: si el generador metiera un timestamp o un orden no
estable, el `git diff` daría falsos positivos y el job se volvería inútil.

### 13.3 Reglas Spectral (`.spectral.yaml`)

Reglas que convierten convenciones de este documento en fallos de build:

| Regla | Aplica a | Exige |
|---|---|---|
| `crm-paths-versioned` | `paths` | Toda ruta bajo `/api/v1` (salvo `/health/*`, `/metrics`) |
| `crm-operation-permission` | `operation` | `x-permission` presente, salvo `auth`/`public`/`webhooks` |
| `crm-operation-id` | `operation` | `operationId` en formato `{módulo}.{acción}` (`crm.createLead`) |
| `crm-tags` | `operation` | Un tag por módulo, de la lista cerrada |
| `crm-idempotency` | `operation` | `POST` con `x-side-effects: true` ⇒ `x-idempotency-required: true` |
| `crm-async-shape` | `operation` | Si `x-async: true`, la respuesta `202` referencia el schema `AsyncAccepted` |
| `crm-problem-json` | `operation` | Todo `4xx`/`5xx` referencia el schema `Problem` |
| `crm-money-shape` | `schema` | Todo campo de dinero referencia `Money`, nunca `number` |
| `crm-datetime-format` | `schema` | Todo timestamp usa `format: date-time`; toda fecha usa `format: date` |
| `crm-cursor-pagination` | `operation` | Todo listado paginado referencia `CursorPage`; sin `offset` fuera de la allowlist |
| `crm-security` | `operation` | `bearerAuth` presente salvo en `public`/`webhooks`/`auth` |
| `crm-phase` | `operation` | `x-phase` presente, para saber qué es MVP y qué no |

El resultado es que una PR que añada, por ejemplo, un `POST /products/import` sin `Idempotency-Key`
**no pasa CI**, sin que nadie tenga que revisarlo a mano.

### 13.4 Extensiones `x-` del OpenAPI

| Extensión | Valores | Significado |
|---|---|---|
| `x-permission` | `Permission` | Permiso exigido por `@RequirePermission()` |
| `x-async` | `true` \| `false` | Devuelve `202` con `AsyncAccepted` |
| `x-idempotency-required` | `true` \| `false` | Exige `Idempotency-Key` |
| `x-side-effects` | `none` \| `write` \| `external` \| `spend` | Efecto del endpoint |
| `x-rate-limit-bucket` | string | Bucket de §5.1 |
| `x-phase` | número \| `"post-mvp"` | Fase del roadmap |
| `x-deprecated` / `x-sunset` | booleano / fecha | Deprecación (§12.2) |

### 13.5 Validación en runtime y en tests

| Nivel | Qué se prueba | Herramienta |
|---|---|---|
| Unit | Los Zod schemas aceptan ejemplos válidos y rechazan inválidos | Vitest |
| Unit | Los schemas de `packages/domain` (máquina de estados, margen) sin I/O | Vitest |
| Integración | Cada endpoint valida request y response contra su schema (el servidor no puede devolver algo fuera de contrato) | Vitest + Fastify inject + AJV |
| Integración | `POST` con `If-Match` desactualizado → `412`; sin `If-Match` → `428` | Vitest |
| Integración | Reuso de refresh → familia revocada | Vitest |
| Integración | Misma `Idempotency-Key` + mismo payload → un solo recurso; payload distinto → `409` | Vitest |
| Integración | `202` devuelve `Location` y `AsyncAccepted` bien formado | Vitest |
| Integración | Webhook con firma inválida → `401`; duplicado → `200` sin reprocesar | Vitest |
| Contrato | El OpenAPI es válido, estable y sin cambios incompatibles | Spectral + oasdiff |
| Contrato | El cliente generado compila en `apps/web` y `apps/site` | `tsc --noEmit` |
| E2E | Flujo login → crear lead → convertir → oportunidad, contra Postgres+Redis efímeros | Playwright + API |

Los **fixtures** de webhooks y de payloads de ejemplo viven en `packages/testing` y se validan
contra los mismos schemas. Un fixture que deje de validar rompe CI: es la forma de detectar que
un cambio de contrato afectó a un ejemplo documentado.

### 13.6 Regla dura

> Si el `openapi.json` o el cliente generado no coinciden con lo commiteado, **el build falla**.
> Y si un cambio introduce una ruptura sin subir la versión, **el build también falla**.

Esta regla está verificada en el criterio de aceptación del Sprint 1 (`architecture-review.md`
§O.2): *"El CI pasa en verde y **falla** si el OpenAPI y el cliente divergen (provocado a
propósito una vez)"*. Se provoca **una vez** de forma deliberada en el Sprint 1 para comprobar
que el mecanismo funciona; a partir de ahí, el job protege solo.

---

## Apéndice A — Resumen de cabeceras

| Cabecera | Dirección | Dónde | Obligatoria |
|---|---|---|---|
| `Authorization: Bearer` | request | Todo salvo `auth`/`public`/`webhooks` | Sí |
| `Content-Type` | request | Con body | Sí |
| `Idempotency-Key` | request | §6.2 | Sí en esos endpoints |
| `If-Match` | request | Escrituras sobre recurso versionado | Sí |
| `If-None-Match` | request | `GET` con caché | No |
| `X-Request-Id` | request | Cualquiera | No |
| `Accept: text/event-stream` | request | SSE (§7.4) | Sí en el stream |
| `Location` | response | `201`, `202` | Sí |
| `ETag` | response | `GET` de recurso mutable | Sí |
| `Retry-After` | response | `202`, `429`, `503` | Sí |
| `RateLimit-*` | response | Todas | Sí |
| `X-Trace-Id` | response | Todas | Sí |
| `Idempotency-Replayed` | response | Replay de idempotencia | Solo si aplica |
| `Cache-Control: no-store` | response | `auth/*` | Sí |
| `Deprecation` / `Sunset` / `Link` | response | Símbolo deprecado | Solo si aplica |

## Apéndice B — Variables de configuración citadas

| Variable | Default | Sección |
|---|---|---|
| `API_VERSION_PREFIX` | `/api/v1` | §1.1 |
| `IDEMPOTENCY_TTL_HOURS` | `24` | §6.4 |
| `POLL_MAX_DURATION` | `60m` | §7.3 |
| `MAX_FAILED_ATTEMPTS` | `5` | §3.2 |
| `ACCESS_TOKEN_TTL` | `15m` | §3.1 |
| `REFRESH_TOKEN_TTL` | `30d` | §3.1 |
| `WEBHOOK_TOLERANCE_SECONDS` | `300` | §8.2 |
| `WEBHOOK_SECRET_{SOURCE}` | — | §8.2 |
| `RATE_LIMIT_*` | §5.1 | §5.1 |
| `MAX_DAILY_BUDGET` / `MAX_CAMPAIGN_BUDGET` | — | §H.3, §10.3 |
| `MAX_BUDGET_CHANGE_PERCENTAGE` | `20` | §H.3, §10.3 |
| `DAILY_AI_BUDGET_USD` / `MONTHLY_AI_BUDGET_USD` | — | §G.5 |
| `CORS_ALLOWED_ORIGINS` | orígenes de `apps/web` | §3.7 |

## Apéndice C — Documentos relacionados

| Documento | Qué contiene |
|---|---|
| `docs/architecture-review.md` §F | Estilo REST, convenciones, endpoints iniciales, contrato asíncrono |
| `docs/architecture-review.md` §K | Autenticación, RBAC, permisos de agente, reglas duras |
| `docs/decisions.md` ADR-005, 011, 012, 013, 014 | Human-in-the-loop, RBAC, REST, provenance, atribución |
| `docs/database.md` | Entidades, columnas, índices y orden de migración |
| `docs/roadmap.md` | Fase de cada endpoint y criterios de aceptación |
| `docs/ai-agents.md` | Contratos completos de tools por agente, schemas Zod de entrada/salida y prompts (§11 no los duplica) |
| `docs/deployment.md` | Entorno, variables de configuración, Compose y procedimiento de arranque |

