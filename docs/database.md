# Database Model

**Estado actual (Fase 1):** motor relacional **MySQL 8.0+**, ORM Prisma, migraciones versionadas.
Ver ADR-026 (`docs/decisions.md`) para la justificación del cambio respecto al diseño original
PostgreSQL.

> El diseño detallado más abajo sigue usando tipos PostgreSQL porque describe el modelo a largo
> plazo. Las entidades que entran en la Fase 1 (`organizations`, `users`, `refresh_tokens`,
> `identities`, `leads`) se implementan ahora en MySQL con tipos equivalentes (ver
> `apps/api/prisma/schema.prisma`).

> Convenciones: `id` es `uuid` (v7 ordenable por tiempo en el diseño; v4 mientras Prisma no lo
> genere nativamente) salvo donde se indique.
> `created_at`/`updated_at` en toda tabla. `organization_id` en toda tabla de negocio.
> Borrado: **soft delete** (`deleted_at`) en entidades de negocio; **nunca** hard delete desde la IA.

---

## 1. Principios de diseño

1. **Una sola fuente de verdad relacional.** Sin Mongo, sin ClickHouse, sin tabla de analytics genérica.
2. **`organization_id` desde el día 1** (ADR-011), forzado por middleware de Prisma.
3. **Provenance obligatoria** en todo dato de inteligencia (ADR-013).
4. **Hechos append-only** para eventos y touchpoints; derivados en rollups.
5. **Normalizado pero pragmático**: sin tablas puente por dogma, sin JSON blob para todo. JSONB solo para payloads que no se consultan por campo (snapshots crudos, propuestas de aprobación).
6. **Nada de `analytics` como tabla comodín.** Los hechos van a tablas tipadas; las métricas derivadas a rollups con ventana temporal explícita.

---

## 2. Núcleo y tenencia

### `organizations`
| columna | tipo | notas |
|---|---|---|
| id | uuid PK | |
| name | text | |
| slug | citext UNIQUE | |
| settings | jsonb | límites de IA, guardrails de presupuesto, KPIs por defecto |
| created_at / updated_at | timestamptz | |

### `users`
| columna | tipo | notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK → organizations | |
| email | citext UNIQUE | |
| password_hash | text | argon2id |
| role | text | `OWNER` en el MVP |
| status | text | `ACTIVE` / `SUSPENDED` |
| last_login_at | timestamptz | |
| failed_attempts | int | |
| locked_until | timestamptz | |

Índices: `UNIQUE(email)`, `(organization_id)`.

### `refresh_tokens`
| columna | tipo | notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| token_hash | text UNIQUE | se guarda el hash, nunca el token |
| family_id | uuid | rotación: misma familia, detección de reuso |
| expires_at | timestamptz | |
| revoked_at | timestamptz NULL | |
| replaced_by_id | uuid NULL FK → self | |
| user_agent / ip | text / inet | |

Índices: `UNIQUE(token_hash)`, `(user_id)`, `(family_id)`, `(expires_at)` donde `revoked_at IS NULL`.

**Detección de reuso:** si llega un token ya revocado, se revoca la **familia completa**
(`family_id`) y se registra un evento de seguridad.

---

## 3. Identidad y trazabilidad

El requisito `VISITANTE → LEAD → PROSPECTO → OPORTUNIDAD → CLIENTE → COMPRA → RECOMPRA`
se modela como **una identidad con historial**, no como tablas separadas por etapa (ADR-014).

### `identities`
| columna | tipo | notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| anonymous_id | text UNIQUE NULL | cookie de primera parte en `apps/site` |
| email | citext NULL | |
| phone | text NULL | normalizado E.164 |
| first_seen_at | timestamptz | |
| last_seen_at | timestamptz | |
| merged_into_id | uuid NULL FK → self | fusión de identidades |
| is_customer | boolean | derivado, mantenido por job |

Índices: `UNIQUE(anonymous_id)`, `(organization_id, email)`, `(merged_into_id)`.
Unicidad parcial: `UNIQUE(organization_id, lower(email)) WHERE email IS NOT NULL`.

### `identity_links`
Fusiones y procedencia de la unión. Append-only.
| columna | tipo |
|---|---|
| id / organization_id | uuid |
| from_identity_id → identities | uuid |
| to_identity_id → identities | uuid |
| reason | text (`email_match` / `phone_match` / `checkout` / `manual`) |
| confidence | numeric(3,2) |
| created_at | timestamptz |

### `touchpoints` (append-only, particionable por fecha)
| columna | tipo | notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| identity_id | uuid FK NULL | puede llegar antes de identificar |
| anonymous_id | text | presente siempre |
| occurred_at | timestamptz | **clave de particionado futura** |
| landing_url / referrer | text | |
| utm_source / medium / campaign / content / term | text | |
| click_id | text | fbclid / gclid / ttclid (guardar cuál en `click_id_type`) |
| click_id_type | text | |
| campaign_id / ad_id / creative_id | uuid NULL FK | resueltos si el click trae identificadores |
| ip_hash / user_agent | text | hash, no IP cruda (minimización de datos) |
| is_first_touch | boolean | derivado |
| is_conversion_touch | boolean | derivado |

Índices: `(organization_id, anonymous_id, occurred_at)`, `(identity_id, occurred_at)`, `(campaign_id, occurred_at)`.

> **Diferida — no entra en la migración de ingesta.** Un lead que llega por el webhook de Meta
> Instant Form **no tiene `anonymous_id`**: no hubo navegador nuestro, ni cookie, ni UTM, ni
> `fbclid` —el click ocurrió dentro de Facebook—. Con `anonymous_id` como `NOT NULL` y
> `campaign_id`/`ad_id` como FK a `campaigns` (tabla que aún no existe), `touchpoints` no puede
> recibir la fila de ese lead. Crearla igual obligaría a inventar un `anonymous_id` de relleno, y un
> identificador inventado en una tabla de atribución es peor que su ausencia: parece un dato.
>
> Consecuencia aceptada: **la atribución del lead de Meta se conserva cruda en
> `meta_lead_submissions`** (`form_id`, `ad_id`, `adset_id`, `campaign_id` y el `raw_payload`
> completo), que es donde está el dato sin transformar. Cuando `campaigns` exista, se rellenan los
> touchpoints desde ahí y no se pierde nada, porque nada se descartó. Esto es una **enmienda a
> ADR-017**, que describe la ingesta como «identidad + lead + touchpoint»: hoy son identidad + lead.
> Se registra como desviación con fecha, no como detalle implícito.

### `leads`
| columna | tipo | notas |
|---|---|---|
| id / organization_id | uuid | |
| identity_id | uuid FK → identities | |
| status | text | `NEW`/`CONTACTED`/`QUALIFIED`/`UNQUALIFIED`/`CONVERTED`/`LOST` |
| source | text | `organic` / `paid` / `referral` / `manual` / `social` |
| channel | text | **canal de origen**: `META_LEAD_FORM` / `LANDING_FORM` / `WHATSAPP_CLICK` / `MESSENGER` / `ORGANIC` / `MANUAL` (ADR-016) |
| meta_lead_id | text NULL UNIQUE | `leadgen_id` del formulario instantáneo de Meta (ADR-017) |
| meta_form_id | text NULL | formulario que lo capturó |
| consent | jsonb NULL | **testimonio de consentimiento** (Ley 1581): texto exacto, fecha, canal, finalidades autorizadas |
| first_touchpoint_id | uuid FK NULL | |
| last_touchpoint_id | uuid FK NULL | |
| score | int NULL | lead score (distinto del product score) |
| owner_user_id | uuid FK NULL | |
| first_response_at | timestamptz NULL | **métrica clave**: tiempo hasta primera respuesta |
| converted_at | timestamptz NULL | |
| closed_via | text NULL | `WHATSAPP` / `MESSENGER` / `INSTAGRAM_DM` / `PHONE` / `SITE` / `PRESENCIAL` |

### `lead_stage_history` (append-only)
`id, lead_id, from_status, to_status, reason, actor_user_id, actor_agent_id, created_at`

### `contacts`
Datos de contacto normalizados y verificables: `id, organization_id, identity_id, type (email|phone|whatsapp|other), value, is_primary, verified_at`.

### `opportunities`
| columna | tipo | notas |
|---|---|---|
| id / organization_id | uuid | |
| identity_id / lead_id | uuid FK | |
| title / amount / currency | text / numeric(14,2) / char(3) | |
| stage | text | pipeline configurable |
| probability | numeric(3,2) | |
| expected_close_at | timestamptz | |
| product_id | uuid FK NULL | |
| campaign_id | uuid FK NULL | origen |
| won_at / lost_at / lost_reason | timestamptz / timestamptz / text | |

### `activities`
Polimórfica y explícita sobre qué cuelga:
`id, organization_id, type (TASK|NOTE|CALL|EMAIL|MEETING|FOLLOW_UP), subject_type, subject_id, title, body, due_at, completed_at, assigned_user_id, created_by_agent_run_id NULL`

Índice: `(organization_id, subject_type, subject_id)`, `(assigned_user_id, due_at) WHERE completed_at IS NULL`.

---

## 4. Catálogo y economía unitaria

### `products`
| columna | tipo | notas |
|---|---|---|
| id / organization_id | uuid | |
| sku | citext NULL UNIQUE por org | |
| name / slug | text | slug para URL pública |
| description | text | |
| category_id | uuid FK NULL | |
| status | text | `CANDIDATE`/`RESEARCHING`/`SELECTED`/`ACTIVE`/`ARCHIVED`/`REJECTED` |
| currency | char(3) | |
| selling_price | numeric(14,2) | |
| primary_source_id | uuid FK NULL → product_sources | |
| embedding | vector(768) NULL | deduplicación y similitud (ADR-008, ADR-019) |
| embedding_model | text NULL | modelo que generó el vector; permite detectar obsoletos tras un cambio |

### `product_costs` (versionado por fecha)
Nunca sobrescribir: el margen histórico debe ser reproducible.
| columna | tipo | notas |
|---|---|---|
| id / organization_id / product_id | uuid | |
| valid_from / valid_to | timestamptz | |
| unit_cost | numeric(14,2) | |
| shipping_cost | numeric(14,2) | |
| payment_fee_pct / payment_fee_fixed | numeric / numeric | |
| platform_fee_pct | numeric | |
| tax_pct | numeric | |
| returns_rate | numeric(5,4) | ESTIMATED al inicio |
| packaging_cost | numeric(14,2) | |
| other_cost | numeric(14,2) | |
| created_by / created_at | uuid / timestamptz | |

Índice: `(product_id, valid_from DESC)`.

**Campos derivados** (calculados, no almacenados como verdad — se recalculan siempre):
`gross_margin`, `contribution_margin`, `break_even_cac`, `break_even_roas`.
Se materializan en `product_economics_snapshot` solo para reporting histórico.

### `product_economics_snapshot`
Foto periódica de la economía calculada, para poder comparar decisiones pasadas:
`id, product_id, as_of, selling_price, unit_cost, total_variable_cost, gross_margin, contribution_margin, break_even_cac, break_even_roas, computed_with_cost_id`

### `categories`
`id, organization_id, parent_id, name, slug, seo_fields jsonb`

---

## 5. Inteligencia de producto

### `connectors_registry` (la ficha de compliance — ADR-004)
| columna | tipo |
|---|---|
| id / organization_id | uuid |
| marketplace | text |
| base_url | text |
| method | text (`API_OFICIAL`/`API_PARTNER`/`FEED`/`SCRAPING_PERMITIDO`/`NO_PERMITIDO`) |
| robots_txt_reviewed_at / robots_txt_result | timestamptz / text |
| tos_reviewed_at / tos_conclusion | timestamptz / text |
| documented_rate_limit | text |
| auth_method | text |
| cost_model | text |
| legal_risk | text (`BAJO`/`MEDIO`/`ALTO`) |
| block_risk | text |
| requests_per_day_budget | int |
| approved_by / approved_at | uuid / timestamptz |
| enabled | boolean |
| kill_switch | boolean |
| last_sync_at / last_error | timestamptz / text |

**Regla de runtime:** el `ConnectorFactory` no instancia un conector si
`approved_at IS NULL` o `kill_switch = true`.

### `product_sources`
| columna | tipo | notas |
|---|---|---|
| id / organization_id | uuid | |
| product_id | uuid FK NULL | puede existir antes de asociarse |
| connector_id | uuid FK → connectors_registry | |
| external_id | text | id en el marketplace |
| url | text | |
| title / brand / category_path | text | |
| price / currency | numeric / char(3) | |
| raw_snapshot | jsonb | respuesta cruda de la API |
| fetched_at | timestamptz | |

Índices: `UNIQUE(connector_id, external_id)`, `(product_id)`, GIN sobre `raw_snapshot` si hace falta.

### `product_metrics` (el corazón del provenance — ADR-013)
| columna | tipo | notas |
|---|---|---|
| id / organization_id | uuid | |
| product_id | uuid FK | |
| source_id | uuid FK NULL → product_sources | |
| metric_key | text | ver tabla de métricas abajo |
| value_numeric | numeric(18,4) NULL | |
| value_json | jsonb NULL | |
| provenance | text | **`REAL` / `ESTIMATED` / `AI_INFERENCE`** |
| confidence | numeric(3,2) | 0.00–1.00 |
| method | text | `ml_api` / `derived_from_reviews` / `llm_inference_v3` … |
| observed_at | timestamptz | cuándo se observó el hecho |
| captured_at | timestamptz | cuándo lo registramos |

Índices: `(product_id, metric_key, observed_at DESC)`, `(organization_id, metric_key, provenance)`.

**Catálogo de métricas del MVP, con su procedencia real:**

| metric_key | Procedencia MVP | Cómo |
|---|---|---|
| `price_min` / `price_avg` / `price_max` | **REAL** | API del marketplace |
| `listing_count` | **REAL** | nº de resultados |
| `seller_count` | **REAL** | vendedores únicos en la búsqueda |
| `review_count` | **REAL** | reseñas del listing |
| `rating_avg` | **REAL** | rating del listing |
| `availability` | **REAL** | si el listing está activo |
| `review_growth_30d` | **ESTIMATED** | derivado de snapshots propios (requiere ≥ 2 snapshots separados ≥ 30 días) |
| `price_volatility` | **ESTIMATED** | derivado de snapshots |
| `trend_index` | **ESTIMATED** | sin API oficial de Trends (ADR-004): solo si hay proveedor de datos contratado |
| `demand_proxy` | **ESTIMATED** | compuesto de `review_count` + `listing_count` |
| `competition_proxy` | **ESTIMATED** | compuesto de `seller_count` + concentración de reseñas |
| `content_potential` | **AI_INFERENCE** | evaluación del modelo sobre título, categoría, imagenes |
| `repurchase_potential` | **AI_INFERENCE** | evaluación del modelo sobre la categoría |
| `logistics_difficulty` | **AI_INFERENCE** | evaluación del modelo (peso/volumen cuando esté disponible: REAL) |
| `cpc_estimated` / `cac_estimated` / `roas_potential` | **AI_INFERENCE** | **y solo con datos reales de campañas propias** (ADR-013 punto 6). Antes de tener campañas, **estos valores no se producen**: se marca `INSUFFICIENT_DATA` |

Las tres últimas filas son deliberadas: son las métricas que el prompt pide pero que **no se
pueden saber** antes de haber anunciado. Producirlas por inferencia sería exactamente el
"inventar métricas" que el prompt prohíbe.

### `product_scores`
| columna | tipo | notas |
|---|---|---|
| id / organization_id / product_id | uuid | |
| score | numeric(5,2) | 0–100 |
| confidence | numeric(3,2) | confianza agregada |
| status | text | `SCORED` / `INSUFFICIENT_DATA` |
| components | jsonb | `{ demand: {raw, normalized, weight, provenance} ... }` |
| model_version | text | p. ej. `scoring_v1` |
| weights | jsonb | los pesos exactos usados |
| rationale | text | explicación en lenguaje natural |
| risks | jsonb | riesgos detectados |
| missing_data | jsonb | qué falta y cómo conseguirlo |
| computed_at | timestamptz | |

Índices: `(product_id, computed_at DESC)`, `(organization_id, score DESC, computed_at DESC)`.

**`product_scores` nunca se actualiza: se inserta una versión nueva.** Es lo que permite
responder "¿por qué este producto tenía score 82 hace tres meses?" y comparar scoring
histórico contra resultados reales (mecanismo de recalibración).

### `research_runs`
| columna | tipo |
|---|---|
| id / organization_id | uuid |
| niche / target_market / country | text |
| input_params | jsonb |
| status | text (`QUEUED`/`RUNNING`/`COMPLETED`/`FAILED`/`CANCELLED`) |
| connectors_used | uuid[] |
| products_discovered / products_scored | int |
| started_at / finished_at | timestamptz |
| agent_run_id | uuid FK → ai_runs |
| error | text |
| report | jsonb |

### `research_run_candidates`
`id, research_run_id, product_id, rank, score_id, rationale, decision (PENDING|SELECTED|REJECTED), decided_by, decided_at`

---

## 6. Contenido, marca y SEO

### `brands`
`id, organization_id, name, tone, values jsonb, forbidden_words text[], preferred_words text[], communication_style, color_palette jsonb, audience jsonb, embedding vector NULL`

### `brand_assets`
`id, brand_id, type, url, alt, metadata` — logos, tipografías, paletas.

### `content`
| columna | tipo | notas |
|---|---|---|
| id / organization_id | uuid | |
| type | text | `LANDING`/`BLOG_POST`/`SOCIAL_POST`/`EMAIL`/`AD_COPY`/`PRODUCT_PAGE` |
| channel | text | `site`/`instagram`/`facebook`/`whatsapp`/`email`/`google_ads`/`meta_ads` |
| status | text | `DRAFT`/`IN_REVIEW`/`APPROVED`/`PUBLISHED`/`ARCHIVED` |
| title / slug | text | slug UNIQUE por org para rutas públicas |
| body_html | text | **sanitizado en servidor al guardar** (S2) |
| body_md | text | fuente editable |
| excerpt / meta_title / meta_description | text | |
| canonical_url | text | |
| og_image_url | text | |
| json_ld | jsonb | structured data |
| target_keyword / cluster_id | text / uuid FK NULL | |
| brand_id / product_id / campaign_id | uuid FK NULL | |
| generated_by_agent_run_id | uuid FK NULL | trazabilidad IA |
| approved_by / approved_at | uuid / timestamptz | |
| published_at | timestamptz | |
| content_embedding | vector NULL | detección de duplicado |

Índices: `UNIQUE(organization_id, slug)`, `(status, published_at)`, `(cluster_id)`.

### `keywords`
`id, organization_id, term citext, country, language, search_volume (provenance), difficulty (provenance), intent (INFORMATIONAL|NAVIGATIONAL|COMMERCIAL|TRANSACTIONAL), provenance, confidence, source, captured_at`

Índices: `UNIQUE(organization_id, term, country, language)`, índice GIN trigram sobre `term`.

### `keyword_clusters`
`id, organization_id, name, topic, intent, pillar_content_id, embedding vector NULL, keyword_count`

### `keyword_cluster_members`
`cluster_id, keyword_id, similarity`

### `content_briefs`
`id, organization_id, cluster_id, target_keyword, secondary_keywords text[], outline jsonb, entities text[], questions text[], internal_links jsonb, status, assigned_agent_run_id`

### `seo_index_status`
Resultado de la integración con Search Console:
`id, organization_id, content_id NULL, url, coverage_state, indexed_at, last_crawled_at, impressions, clicks, avg_position, checked_at`

### `content_links`
Internal linking + detección de huérfanas:
`id, organization_id, from_content_id, to_content_id, anchor_text, is_internal`

### `content_redirects`
Sin esta tabla el requisito "301 para URLs cambiadas" no tiene dónde vivir.
`id, organization_id, from_path (UNIQUE por org), to_content_id NULL, to_path NULL, status_code (301|308|410), reason, hits_count, created_by, created_at, last_hit_at`

---

## 7. Campañas y publicidad

### `campaigns`
| columna | tipo | notas |
|---|---|---|
| id / organization_id | uuid | |
| name | text | |
| objective | text | `AWARENESS`/`TRAFFIC`/`LEADS`/`SALES`/`RETENTION` |
| template | text | `PRODUCT_LAUNCH`/`LEAD_GEN`/... (§H.4) |
| kpi_primary | text | **definido por template, no universal** |
| status | text | `DRAFT`/`READY`/`PENDING_APPROVAL`/`ACTIVE`/`PAUSED`/`COMPLETED`/`ARCHIVED`/`BLOCKED` |
| product_id / brand_id | uuid FK NULL | |
| budget_total / budget_daily | numeric(14,2) | |
| currency | char(3) | |
| start_date / end_date | date | |
| audience_spec | jsonb | |
| landing_content_id | uuid FK NULL | |
| approval_id | uuid FK NULL → approvals | **obligatorio para salir de PENDING_APPROVAL** |
| created_by / created_by_agent_run_id | uuid / uuid NULL | |
| published_at / published_by | timestamptz / uuid | |

Índices: `(organization_id, status)`, `(product_id)`, `(start_date)`.

### `campaign_state_transitions` (append-only)
`id, campaign_id, from_status, to_status, reason, actor_user_id NULL, actor_agent_run_id NULL, approval_id NULL, created_at`

### `campaign_platforms`
`id, campaign_id, platform (META|GOOGLE), external_campaign_id, account_id, status, last_sync_at, sync_error`

### `ad_sets`
`id, campaign_id, platform, external_id, name, audience_spec jsonb, budget, bid_strategy, optimization_goal, status`

### `ads`
`id, ad_set_id, creative_id, external_id, status, destination_url, metrics_summary jsonb`

### `creatives`
| columna | tipo | notas |
|---|---|---|
| id / organization_id | uuid | |
| type | text | `IMAGE`/`VIDEO`/`CAROUSEL`/`TEXT` |
| content_id | uuid FK NULL | el copy asociado |
| asset_url | text NULL | |
| generation_prompt | text NULL | prompt usado (o propuesto) |
| generation_provider | text NULL | |
| generated_by_agent_run_id | uuid FK NULL | |
| status | text | `PROPOSED`/`GENERATED`/`APPROVED`/`REJECTED` |

### `campaign_metrics_daily` (rollup, poblado por job)
`id, campaign_id, ad_set_id NULL, ad_id NULL, date, platform, impressions, clicks, spend, conversions, revenue, lead_count, ctr, cpc, cpm, cpa, roas`

`UNIQUE(campaign_id, ad_id, date)`.
Nota: `cpc`/`ctr`/`cpa`/`roas` se guardan **calculados y con la fórmula documentada**; el
dashboard nunca los recalcula a su manera. Una sola definición de cada métrica.

### `campaign_financials_daily` (rollup con margen — lo que permite "mayor margen", no "mayor revenue")
`id, campaign_id, date, revenue, product_cost, shipping_cost, fees, taxes, refunds, ad_spend, contribution_margin, orders_count, aov, cac, roas, roi`

### `experiments` (Fase 9, esquema reservado)
`id, campaign_id, hypothesis, variant_axis (HOOK|IMAGE|VIDEO|CTA|AUDIENCE|LANDING|OFFER), variant_a_id, variant_b_id, metric, required_sample_size, status, result jsonb, decision, decided_at`

---

## 8. Ventas

### `orders`
| columna | tipo | notas |
|---|---|---|
| id / organization_id | uuid | |
| order_number | text UNIQUE por org | |
| identity_id | uuid FK | |
| lead_id / opportunity_id | uuid FK NULL | |
| status | text | `PENDING`/`PAID`/`FULFILLED`/`CANCELLED`/`REFUNDED` |
| currency | char(3) | |
| subtotal / shipping_total / discount_total / tax_total / total | numeric(14,2) | |
| **total_cost** | numeric(14,2) | coste de lo vendido — requisito para margen (ADR-014) |
| campaign_id / ad_id / creative_id | uuid FK NULL | atribución resuelta |
| first_touchpoint_id / last_touchpoint_id | uuid FK NULL | |
| conversation_id | uuid FK NULL → conversations | **la conversación donde se cerró** (ADR-016) |
| closed_via | text | `WHATSAPP` / `MESSENGER` / `INSTAGRAM_DM` / `PHONE` / `SITE` / `PRESENCIAL` |
| payment_method | text | `TRANSFERENCIA` / `NEQUI` / `DAVIPLATA` / `CONTRA_ENTREGA` / `EFECTIVO` / `TARJETA` / `OTRO` |
| is_cod | boolean | contra-entrega: **dispara un tratamiento distinto de la tasa de devolución** (§P.3) |
| delivered_at / returned_at | timestamptz NULL | para medir devoluciones reales de COD |
| conversion_reported_at | timestamptz NULL | cuándo se envió `Purchase` a Meta por CAPI (ADR-017); NULL = pendiente |
| placed_at / paid_at / fulfilled_at | timestamptz | |

### `order_items`
`id, order_id, product_id, variant, quantity, unit_price, unit_cost, line_total, line_cost, line_margin`

### `order_attribution` (calculado por job, recalculable — ADR-014)
| columna | tipo | notas |
|---|---|---|
| id / order_id | uuid | |
| model | text | `LAST_TOUCH` / `FIRST_TOUCH` / `LINEAR` / `POSITION_BASED` |
| campaign_id / ad_id / creative_id | uuid NULL | |
| touchpoint_id | uuid NULL | |
| credit | numeric(5,4) | peso de la atribución (1.0 en single-touch) |
| revenue_credit / margin_credit | numeric(14,2) | |
| computed_at | timestamptz | |

`UNIQUE(order_id, model, campaign_id, touchpoint_id)`.
Recalcular con un modelo nuevo **inserta filas**, no sobrescribe: se comparan modelos.

### `payments` — **Fase 7, solo si se decide vender en línea** (§O.3)
`id, order_id, provider, external_id, status, amount, currency, fee, paid_at, raw_payload`

---

## 9. Aprobaciones y auditoría

### `approvals` (human-in-the-loop — ADR-005)
| columna | tipo | notas |
|---|---|---|
| id / organization_id | uuid | |
| type | text | `PUBLISH_CAMPAIGN`/`CHANGE_BUDGET`/`PUBLISH_CONTENT`/`SELECT_PRODUCT`/`SPEND` |
| subject_type / subject_id | text / uuid | qué se propone |
| proposed_payload | jsonb | **la propuesta exacta, reproducible** |
| proposed_by_agent_run_id | uuid FK NULL | |
| rationale | text | por qué lo propone |
| risk_assessment | jsonb | |
| status | text | `PENDING`/`APPROVED`/`REJECTED`/`MODIFIED`/`EXPIRED` |
| decided_by | uuid FK NULL → users | |
| decided_at | timestamptz | |
| decision_note | text | |
| modified_payload | jsonb NULL | si se aprobó con cambios |
| executed_at | timestamptz NULL | |
| execution_result | jsonb NULL | |

Índice: `(organization_id, status, created_at DESC)`.

### `audit_logs` (append-only, nunca se borra)
| columna | tipo | notas |
|---|---|---|
| id | bigserial PK | alto volumen |
| organization_id | uuid | |
| actor_type | text | `USER` / `AGENT` / `SYSTEM` |
| actor_user_id / actor_agent_run_id | uuid NULL | |
| action | text | `campaign.transition` / `product.update` … |
| subject_type / subject_id | text / uuid | |
| before / after | jsonb | diff (datos sensibles redactados) |
| ip / user_agent / trace_id | inet / text / text | |
| created_at | timestamptz | índice de particionado futuro |

Índices: `(organization_id, created_at DESC)`, `(subject_type, subject_id, created_at DESC)`, `(actor_agent_run_id)`.

### `outbox_events`
| columna | tipo | notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid | |
| type | text | `LeadCreated`/`CampaignStarted`/`OrderPaid`/`BudgetThresholdReached` … |
| payload | jsonb | |
| status | text | `PENDING`/`DISPATCHED`/`FAILED` |
| attempts | int | |
| available_at | timestamptz | para backoff |
| created_at / dispatched_at | timestamptz | |

Índices: `(status, available_at) WHERE status = 'PENDING'`, `(type, created_at)`.

---

## 10. Capa de IA

### `ai_agents`
`id, organization_id, key (orchestrator|product_research|marketing_strategy|content|seo|advertising|analytics|budget_optimization|crm_intelligence), name, description, system_prompt, model_tier_default, permissions text[], enabled, max_tokens_per_task, max_executions_per_day, created_at`

### `ai_tasks`
`id / organization_id, agent_id, type, input jsonb, status (QUEUED|RUNNING|COMPLETED|FAILED|CANCELLED), priority, queued_at, started_at, finished_at, run_id NULL, error`

### `ai_runs` (la unidad de observabilidad)
| columna | tipo | notas |
|---|---|---|
| id / organization_id / agent_id / task_id | uuid | |
| status | text | |
| model_used / provider | text | |
| routing_reason | text | **por qué se eligió ese modelo** |
| prompt_tokens / completion_tokens / cached_tokens | int | |
| cost_usd | numeric(12,6) | |
| latency_ms | int | |
| steps | jsonb | plan y pasos del agente |
| result | jsonb | |
| error | jsonb NULL | |
| trace_id | text | correlación con OTel |
| started_at / finished_at | timestamptz | |

Índices: `(agent_id, started_at DESC)`, `(organization_id, started_at DESC)`, `(trace_id)`.

### `ai_tool_calls`
| columna | tipo | notas |
|---|---|---|
| id / organization_id / run_id | uuid | |
| tool_name | text | |
| permission_used | text | |
| input | jsonb | redactado si contiene secretos |
| output | jsonb NULL | |
| status | text | `OK`/`TOOL_PENDING_APPROVAL`/`TOOL_DENIED`/`TOOL_INVALID`/`TOOL_THROTTLED`/`TOOL_BLOCKED`/`TOOL_BAD_OUTPUT`/`TOOL_TIMEOUT`/`TOOL_ERROR` |
| duration_ms | int | |
| attempt | int | |
| approval_id | uuid NULL FK | si la tool requería aprobación |
| created_at | timestamptz | |

### `ai_costs` (agregable y consultable; ver §G.5)
`id, organization_id, provider, model, tokens_input, tokens_output, cached_tokens, estimated_cost_usd, task_type, agent_id, run_id, created_at`

### `ai_budgets`
`id, organization_id, scope (GLOBAL|AGENT|TASK_TYPE), scope_ref, period (DAILY|MONTHLY), limit_usd, alert_threshold_pct, current_spend_usd, period_start, reset_at`

### `ai_memory`
Memoria de largo plazo **destilada**, no transcripciones:
`id, organization_id, agent_id NULL, scope (LONG_TERM|BUSINESS|CAMPAIGN|PRODUCT|CUSTOMER), scope_ref uuid NULL, key, value jsonb, summary text, importance numeric(3,2), embedding vector(768) NULL, embedding_model text NULL, expires_at NULL, created_at, updated_at`

Índice: `UNIQUE(organization_id, scope, scope_ref, key)`, `(expires_at) WHERE expires_at IS NOT NULL`.

### `ai_embeddings`
Para búsqueda semántica transversal (contenido, productos, keywords):
`id, organization_id, entity_type, entity_id, chunk_index, chunk_text, embedding vector(768), model, created_at`
Índice HNSW sobre `embedding` (cosine).

> **Dimensión única y versionada (ADR-019).** Toda columna vectorial del esquema declara
> **`vector(768)`** — la dimensión de `nomic-embed-text`, el modelo local por defecto. Dos reglas
> duras:
>
> 1. `EMBEDDING_DIMENSIONS` del entorno debe ser **exactamente** la dimensión declarada aquí. Una
>    discrepancia no falla siempre de forma ruidosa: rompe el índice y las búsquedas por similitud.
> 2. **`embedding_model` (o `model`) se escribe siempre junto al vector.** Sin él, cambiar de modelo
>    mezcla en silencio dos espacios vectoriales distintos y la similitud devuelve resultados sin
>    sentido **sin lanzar ningún error**. El job de re-embedding se define entonces como
>    `WHERE embedding_model IS DISTINCT FROM :modelo_actual`.
>
> **Qué vive en cada sitio.** `ai_embeddings` guarda texto troceado (varios chunks por entidad) para
> RAG y búsqueda transversal. Las columnas inline (`products.embedding`, `ai_memory.embedding`)
> guardan **un vector por entidad** para similitud directa con filtros relacionales en la misma
> consulta. No son redundantes: responden a preguntas distintas.

---

## 11. Sistema

### `jobs_audit`
`id, queue, job_id, name, status, attempts, error, duration_ms, created_at` — historial más allá del TTL de BullMQ.

### `webhook_events`
`id, organization_id, source, external_id, event_type, payload jsonb, signature_valid boolean, processed_at, status, error`
Índice: `UNIQUE(source, external_id)` para idempotencia de webhooks.

### `feature_flags`
`id, organization_id, key, enabled, payload jsonb` — para activar automatización por fases.

---

## 12. Relaciones principales

```
organizations 1─┬─* users
                ├─* identities 1─┬─* touchpoints
                │                ├─1 leads 1─* lead_stage_history
                │                │        └─1 opportunities
                │                ├─* contacts
                │                └─* orders 1─* order_items
                │                           └─1 order_attribution
                ├─* products 1─┬─* product_sources *─1 connectors_registry
                │              ├─* product_metrics     (provenance + confidence)
                │              ├─* product_scores      (versionado)
                │              └─1─* product_costs     (versionado por fecha)
                ├─* campaigns 1─┬─* campaign_platforms
                │               ├─* ad_sets 1─* ads *─1 creatives
                │               ├─* campaign_metrics_daily
                │               ├─* campaign_financials_daily
                │               ├─* campaign_state_transitions
                │               └─1─* experiments
                ├─* content 1─┬─* content_links
                │             └─1 keyword_clusters 1─* keyword_cluster_members *─1 keywords
                ├─* approvals
                ├─* audit_logs
                ├─* ai_agents 1─┬─* ai_tasks 1─1 ai_runs 1─* ai_tool_calls
                │               └─* ai_memory
                └─* outbox_events
```

---

## 13. Orden de migración

Se migra por fase, nunca todo de golpe. Cada migración es reversible y se prueba con datos.

| Migración | Fase | Tablas |
|---|---|---|
| `001_core` | 1 | organizations, users, refresh_tokens, audit_logs, outbox_events |
| `002_identities` | 2 | identities, identity_links, touchpoints, leads, lead_stage_history, contacts, opportunities, activities |
| `003_catalog` | 3 | categories, products, product_costs, product_economics_snapshot |
| `004_intelligence` | 3 | connectors_registry (con ficha de compliance), product_sources, product_metrics, product_scores, research_runs, research_run_candidates |
| `005_ai` | 4 | ai_agents, ai_tasks, ai_runs, ai_tool_calls, ai_costs, ai_budgets, ai_memory, ai_embeddings |
| `006_content_seo` | 6 | brands, brand_assets, content, content_links, keywords, keyword_clusters, keyword_cluster_members, content_briefs, seo_index_status |
| `007_campaigns` | 7 | campaigns, campaign_state_transitions, campaign_platforms, ad_sets, ads, creatives, approvals |
| `008_orders` | 7 | orders, order_items, order_attribution (+ payments solo si aplica) |
| `009_metrics` | 8 | campaign_metrics_daily, campaign_financials_daily, jobs_audit, webhook_events, feature_flags |
| `010_experiments` | 9 | experiments |
| `011_messaging` | 4-bis | messaging_channels, conversations, conversation_messages, whatsapp_templates, meta_lead_submissions, conversion_events (ADR-016/017/018) |

**Estado real (2026-10-01): ninguna migración existe todavía.** No hay Prisma instalado, ni
`prisma/schema.prisma`, ni carpeta `migrations/`. El orden de la tabla es el objetivo, no un
registro de lo hecho.

La **primera** migración real no seguirá esta tabla tal cual, y conviene tenerlo escrito antes de
escribirla. El webhook de Meta ya está implementado hasta el borde de la ingesta, así que lo primero
que hace falta persistir es su camino:

| Migración real propuesta | Sustituye a | Contenido |
|---|---|---|
| `0001_core_min` | parte de `001_core` | `organizations`, `audit_logs` y las extensiones `citext` y `pg_trgm` — lo mínimo para poder auditar |
| `0002_lead_ingestion` | parte de `002_identities` + `meta_lead_submissions` de `011_messaging` | `identities`, `leads`, `lead_stage_history`, `meta_lead_submissions` |

Dos desviaciones respecto de la tabla de arriba, ambas por el mismo motivo —se migra lo que el
código ya necesita, no lo que el modelo completo prevé—:

- **`002_lead_ingestion` subsume parte de `002_identities`**: `identity_links`, `touchpoints`,
  `contacts`, `opportunities` y `activities` **no entran**. `touchpoints` por lo dicho en §3; el
  resto porque nada los consume aún.
- **`meta_lead_submissions` se adelanta desde `011_messaging`** (Fase 4-bis) a la migración de
  ingesta: es la bandeja de deduplicación del único emisor que existe (`api.md` §8.3).

Tampoco entran `users` ni `refresh_tokens` (`001_core`): sin autenticación no hay quien los use, y
`leads.owner_user_id` puede quedar `NULL` mientras tanto. `outbox_events` queda fuera por la deuda
I12 descrita en `decisions.md`, y `webhook_events` porque no hay emisor que use el esquema genérico.

---

## 14. Lo que deliberadamente NO se crea (y por qué)

| No se crea | Motivo |
|---|---|
| `analytics` como tabla genérica | Antipatrón: se convierte en vertedero sin esquema. Hechos en tablas tipadas, derivados en rollups. |
| Base vectorial externa | ADR-008: pgvector cubre los 3 casos de uso reales. |
| Almacén de eventos separado (ClickHouse) | Volumen del MVP cabe en Postgres. Se añade solo cuando las tablas de eventos pasen de decenas de millones de filas. |
| `payments` en el MVP | **Decidido** (§O.3, ADR-016): no hay checkout propio. El cobro ocurre fuera (transferencia, Nequi, Daviplata, contra-entrega) y se registra con `orders.payment_method`. `payments` se crea solo si algún día se añade una pasarela. |
| Tablas de multi-tenant avanzado | Sin segundo inquilino. `organization_id` ya está en su sitio. |
| `ai_memory` como blob único | La memoria se tipa por `scope`; un blob indistinguible no se puede consultar ni expirar selectivamente. |
| Tablas de sesión propias | El refresh token rotativo cubre la necesidad; sin tabla de sesiones hasta que se necesite revocación por dispositivo. |

---

## 15. Mensajería y adquisición (WhatsApp, Messenger, Meta Lead Ads)

> Añadido tras la decisión de canal del 2026-10-01 (ADR-016, ADR-017, ADR-018).
> Es el módulo que sostiene el camino real de ingresos: **anuncio → lead → conversación → venta**.

### `messaging_channels`
Una fila por cuenta conectada. Sin esto no hay envío ni recepción.
| columna | tipo | notas |
|---|---|---|
| id / organization_id | uuid | |
| provider | text | `WHATSAPP_CLOUD` / `MESSENGER` / `INSTAGRAM_DM` |
| external_account_id | text | phone_number_id / page_id / ig_user_id |
| display_name | text | |
| status | text | `CONNECTED` / `NEEDS_REAUTH` / `RESTRICTED` / `DISCONNECTED` |
| access_token_ref | text | **referencia al secreto, no el token en claro** (§K.3) |
| token_expires_at | timestamptz | |
| webhook_verified_at | timestamptz | |
| quality_rating | text NULL | rating de calidad de Meta (afecta a los límites de envío) |
| messaging_limit_tier | text NULL | límite diario de conversaciones iniciadas |
| last_inbound_at | timestamptz | |

Índice: `UNIQUE(provider, external_account_id)`.

### `conversations`
| columna | tipo | notas |
|---|---|---|
| id / organization_id | uuid | |
| channel_id | uuid FK → messaging_channels | |
| external_thread_id | text | id de la conversación en el proveedor |
| identity_id / lead_id / opportunity_id | uuid FK | vínculo con el CRM |
| campaign_id / ad_id | uuid FK NULL | **la campaña que originó el contacto** (ADR-017) |
| status | text | `OPEN` / `PENDING_AGENT` / `CLOSED_WON` / `CLOSED_LOST` / `EXPIRED` |
| assigned_user_id | uuid FK NULL | |
| window_expires_at | timestamptz | **fin de la ventana de 24 h** (ADR-018): después, solo plantilla |
| first_inbound_at / first_response_at | timestamptz | base de la métrica de tiempo de respuesta |
| last_message_at | timestamptz | |
| closed_at | timestamptz NULL | |
| order_id | uuid FK NULL → orders | si la conversación terminó en venta |

Índices: `UNIQUE(channel_id, external_thread_id)`, `(organization_id, status, last_message_at DESC)`, `(campaign_id)`, `(assigned_user_id) WHERE status = 'OPEN'`.

### `conversation_messages`
| columna | tipo | notas |
|---|---|---|
| id / organization_id / conversation_id | uuid | |
| direction | text | `INBOUND` / `OUTBOUND` |
| external_message_id | text | para idempotencia del webhook |
| sender_type | text | `CUSTOMER` / `USER` / `AGENT` / `SYSTEM` |
| sender_user_id / sender_agent_run_id | uuid NULL | **trazabilidad**: si lo escribió un agente, se sabe |
| message_type | text | `TEXT` / `IMAGE` / `AUDIO` / `VIDEO` / `DOCUMENT` / `INTERACTIVE` / `TEMPLATE` |
| body_text | text NULL | |
| media_ref | text NULL | referencia a `StorageProvider`, no binario en la tabla |
| template_id | uuid FK NULL → whatsapp_templates | si fue plantilla |
| generated_by_agent_run_id | uuid FK NULL | si el texto lo propuso la IA |
| sent_by_agent_after_approval_id | uuid FK NULL → approvals | **un envío automático debe poder rastrearse hasta su aprobación** |
| delivery_status | text NULL | `SENT`/`DELIVERED`/`READ`/`FAILED` |
| sent_at / received_at | timestamptz | |

Índices: `UNIQUE(external_message_id)` (idempotencia), `(conversation_id, sent_at)`.

**Nota:** el contenido de las conversaciones son **datos personales sensibles**. Aplican
minimización, cifrado y retención configurable (§K.1 amenaza 10). Retención por defecto
sugerida: 24 meses desde el último mensaje, configurable.

### `whatsapp_templates`
Las plantillas son de Meta y deben aprobarse: el sistema no puede inventarlas y enviarlas.
| columna | tipo | notas |
|---|---|---|
| id / organization_id | uuid | |
| channel_id | uuid FK | |
| name / language | text | |
| category | text | `MARKETING` / `UTILITY` / `AUTHENTICATION` — **determina el costo** |
| body_text / variables | text / jsonb | |
| status | text | `LOCAL_DRAFT` / `PENDING` / `APPROVED` / `REJECTED` / `PAUSED` |
| rejection_reason | text NULL | |
| external_template_id | text NULL | |
| quality_rating | text NULL | |
| submitted_at / approved_at | timestamptz | |

Índice: `UNIQUE(channel_id, name, language)`.

### `meta_lead_submissions`
Payload crudo del webhook, para idempotencia y para poder reprocesar si el parseo cambia.
| columna | tipo | notas |
|---|---|---|
| id / organization_id | uuid | |
| meta_lead_id | text UNIQUE | `leadgen_id` |
| form_id / page_id | text | |
| campaign_id / ad_id / adset_id | uuid NULL FK / text | resueltos desde Meta |
| raw_payload | jsonb | respuesta de la Graph API |
| processed_at | timestamptz NULL | |
| status | text | `PENDING` / `PROCESSED` / `FAILED` / `DUPLICATE` |
| error | text NULL | |
| received_at | timestamptz | |

Índice: `UNIQUE(meta_lead_id)`, `(status, received_at) WHERE status = 'PENDING'`.

**Reconciliación:** un job repetible consulta los leads de los últimos N días en la Graph API y
crea las submissions que falten. Un webhook perdido no debe ser un lead perdido.

**Es la única bandeja de deduplicación de Meta** (`api.md` §8.3). `webhook_events` no se usa para
este emisor: dos tablas con el mismo `UNIQUE` para el mismo evento acaban divergiendo.

Detalles que cambian al escribir la migración real:

| Columna | Ajuste | Por qué |
|---|---|---|
| `campaign_id` | **`text NULL`, sin FK** por ahora | `campaigns` no existe; un FK a una tabla inexistente no se puede crear. El valor de Meta se guarda igual, y el FK se añade cuando exista la tabla |
| `status`, `error` | Se quedan, pero `status` **nunca vale `DUPLICATE`** | La deduplicación es `ON CONFLICT (meta_lead_id) DO NOTHING`: un duplicado no inserta fila, así que no hay dónde marcarla. Se responde `200 {duplicate:true}` sin tocar la base |
| `raw_payload` | Obligatorio, y se guarda **antes** de interpretar | Es lo que permite reprocesar si el parseo cambia y lo que hace recuperable una ingesta fallida. Un payload descartado no se puede recuperar de Meta cuando el lead ya no está accesible |

### `conversion_events`
Eventos salientes hacia Meta (CAPI) y otros destinos. Es un efecto externo: va por el outbox.
| columna | tipo | notas |
|---|---|---|
| id / organization_id | uuid | |
| event_name | text | `Lead` / `QualifiedLead` / `Purchase` |
| event_id | text UNIQUE | **deduplicación con el píxel** (ADR-017) |
| event_time | timestamptz | |
| destination | text | `META_CAPI` |
| subject_type / subject_id | text / uuid | lead u orden |
| value / currency | numeric(14,2) / char(3) | en `Purchase`, **con el valor real** |
| match_keys | jsonb | `_fbp`, `_fbc`, `em`/`ph` hasheados con SHA-256 |
| campaign_id / ad_id | uuid NULL | |
| status | text | `PENDING` / `SENT` / `FAILED` / `SKIPPED_NO_CONSENT` |
| attempts / last_error | int / text | |
| sent_at | timestamptz NULL | |

Índice: `UNIQUE(event_id)`, `(status, event_time) WHERE status = 'PENDING'`.

**Regla dura:** si `SKIPPED_NO_CONSENT`, el evento **no se envía**. El consentimiento es un
requisito de Ley 1581, no un detalle de optimización.

### Impacto en el embudo de atribución

```
Meta Ad  ─┬─► Lead Ads (Instant Form)  ──► webhook leadgen_id ──► meta_lead_submissions
          │                                                        └─► identity + lead
          │                                                            (campaign_id/ad_id exactos, sin cookies)
          └─► Landing en apps/site ──► formulario ──► touchpoint (utm, fbclid, anonymous_id)
                                                          └─► identity + lead
                        ↓
              conversation (WhatsApp / Messenger / IG)
                        ↓
                  order (closed_via, payment_method, is_cod)
                        ↓
        conversion_events: Purchase → CAPI → Meta optimiza hacia VENTAS
```

Las dos vías de captura **convergen en el mismo `identities` + `leads`**, y desde ahí el resto del
sistema funciona igual. La diferencia es la calidad del dato de origen: la de Lead Ads es exacta;
la de landing depende de cookies y UTMs.
