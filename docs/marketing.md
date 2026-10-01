# Marketing Architecture

> Documento de la capa de marketing del sistema. Coherente con
> `architecture-review.md` (§A, §H, §M), `decisions.md` (ADR-004, ADR-005, ADR-013,
> ADR-014) y `database.md`.
>
> **Principio rector:** el score de producto ordena la investigación; **la economía
> unitaria decide el lanzamiento** (ADR-013). Nada de este documento sustituye esa
> puerta.
>
> Estado: propuesta para aprobación. No hay código de aplicación escrito.

---

## 0. Las reglas no negociables de esta capa

Antes de detalle, las restricciones que gobiernan todo lo demás. Si algo de este
documento las contradice, gana la restricción.

| # | Regla | Dónde vive |
|---|---|---|
| 1 | **Puerta de selección**: `score >= umbral` **y** `confidence >= mínimo` **y** datos `REAL` suficientes. Si no se cumple, el producto queda en *investigar más*, **no se descarta** | §H.2, ADR-013 |
| 2 | **Puerta de economía**: `contribution_margin > 0` **y** `cac_estimado < contribution_margin`. Bloquea la generación de campaña con explicación | §H.2, ADR-013 |
| 3 | **Puerta de contenido**: revisión humana antes de publicar en `apps/site` | §H.2, ADR-005 |
| 4 | **Puerta de campaña**: `PENDING_APPROVAL → ACTIVE` exige `approval_id` válido | §H.3, ADR-005 |
| 5 | **Puerta de presupuesto**: cambios > `MAX_BUDGET_CHANGE_PERCENTAGE` exigen aprobación | §H.3 |
| 6 | **Puerta de costo IA**: presupuesto diario agotado → solo modelos locales o encolado | §G.5, ADR-007 |
| 7 | **Cada template declara su `kpi_primary`**. No existe KPI universal. Una campaña `LEAD_GENERATION` se juzga por coste por lead cualificado, no por ROAS | §H.4 |
| 8 | **Revenue, Profit, ROAS y ROI no son equivalentes** y se muestran siempre diferenciados, con su fórmula a un clic | §H.4, §M.1 (18) |
| 9 | **MVP sin automatización de gasto**: no se publica campaña, no se cambia presupuesto, no hay checkout propio, no se envía email/WhatsApp, no se generan imágenes/video (solo prompts), la atribución es solo first/last touch | §M.2 |

---

## 1. El pipeline completo del funnel

Reconstrucción operativa de §H.1 con las puertas de §H.2, campo por campo.

### 1.1 Tabla etapa por etapa

| # | Etapa | La produce | Se persiste en | La mide | Decide | Puerta en la flecha → |
|---|---|---|---|---|---|---|
| 1 | **Nicho** | Humano (asistente de investigación en `apps/web`) | `research_runs` (`niche`, `target_market`, `country`) | `products_discovered` | **Humano** (define el nicho) | — |
| 2 | **Descubrimiento de candidatos** | `ProductResearchAgent` + `MercadoLibreConnector` | `product_sources` (`raw_snapshot`, `external_id`), `products` (`status=CANDIDATE`) | `products_discovered` | **Agente** (propone) | — |
| 3 | **Métricas y evidencia** | Conectores + `ScoringEngine` | `product_metrics` (`provenance`, `confidence`, `method`, `observed_at`) | nº de métricas `REAL`, `confidence` media | **Sistema** | **Puerta de datos**: sin `provenance` no entra (constraint de DB) |
| 4 | **Scoring** | `ScoringEngine` | `product_scores` (`score`, `confidence`, `components`, `weights`, `model_version`, `status`) | `score`, `confidence` | **Agente produce · Humano interpreta** | **Puerta de selección**: `score >= umbral` **y** `confidence >= mínimo` **y** datos `REAL` suficientes |
| 5 | **Selección de producto** | Humano vía bandeja de aprobaciones | `approvals` (`type=SELECT_PRODUCT`), `research_run_candidates.decision`, `products.status=SELECTED` | decisión + rationale | **Humano** | **Puerta de economía** (ver §1.2) |
| 6 | **Economía unitaria** | Motor de economía (`packages/domain`, sin I/O) | `product_costs` (versionado), `product_economics_snapshot` | `contribution_margin`, `break_even_cac`, `break_even_roas` | **Sistema bloquea · Humano revisa** | **Puerta de economía**: `contribution_margin > 0` **y** `cac_estimado < contribution_margin` |
| 7 | **Estrategia** | `MarketingStrategyAgent` | `ai_memory` (`scope=PRODUCT`/`CAMPAIGN`), `content` (`type=AD_COPY`), `campaigns.audience_spec` | cobertura de personas/ángulos, coherencia con `brands` | **Agente** (propone) | **Puerta de costo IA**: presupuesto diario; si se agota → local o encolado |
| 8 | **Contenido y SEO** | `ContentAgent`, `SEOAgent`, `CreativeAgent` | `content` (`status=DRAFT/IN_REVIEW`), `creatives` (`status=PROPOSED`, `generation_prompt`), `content_briefs`, `keyword_clusters` | Brand Context aplicado, canibalización, duplicado | **Agente** | **Puerta de contenido**: revisión humana obligatoria |
| 9 | **Landing publicada** | Humano (aprobación) → `apps/site` (SSR/prerender) | `content` (`status=PUBLISHED`, `published_at`, `approved_by`), `seo_index_status` | indexación, impresiones, `avg_position`, CWV | **Humano** | — |
| 10 | **Campaña DRAFT** | `AdvertisingAgent` (solo borradores) | `campaigns` (`template`, `objective`, `kpi_primary`, `budget_total/daily`, `audience_spec`, `landing_content_id`), `ad_sets`, `ads`, `creatives` | completitud del borrador, coherencia con la landing | **Agente** | **Puerta de presupuesto** + **Puerta de campaña** |
| 11 | **Aprobación de campaña** | Humano | `approvals` (`type=PUBLISH_CAMPAIGN`, `proposed_payload`), `campaign_state_transitions`, `campaigns.approval_id` | `approval_id` presente y válido | **Humano** | **Puerta de campaña**: `ACTIVE` **exige** `approval_id` (ADR-005) |
| 12 | **Publicación** | Humano (MVP: manual en Meta/Google) | `campaign_platforms` (`external_campaign_id`, `account_id`) | estado en la plataforma | **Humano** | MVP: **no hay publicación automática** (§M.2) |
| 13 | **Tráfico y touchpoints** | `apps/site` (captura) + backend | `touchpoints` (append-only: `anonymous_id`, `utm_*`, `click_id`, `click_id_type`, `referrer`, `landing_url`, `occurred_at`) | sesiones, `is_first_touch`, `is_conversion_touch` | **Sistema** | — |
| 14 | **Lead** | Formulario / checkout → resolución de identidad | `identities`, `identity_links`, `leads`, `lead_stage_history`, `contacts` | `lead_count`, `leads.score`, `qualified` | **Humano** (CRM) · `CRMIntelligenceAgent` prioriza | — |
| 15 | **Venta** | Humano (ingreso manual de orden en el MVP) | `orders` (`total`, `total_cost`, `campaign_id`, `ad_id`, `creative_id`, `first/last_touchpoint_id`), `order_items` (`unit_cost`, `line_cost`, `line_margin`) | `orders_count`, `revenue`, `aov` | **Humano** | — |
| 16 | **Atribución** | **Job** sobre `touchpoints` crudos (ADR-014) | `order_attribution` (`model`, `credit`, `revenue_credit`, `margin_credit`) | `revenue_credit`, `margin_credit` por campaña | **Sistema** (recalculable) | — |
| 17 | **Analítica** | Job de rollup (no en la request) | `campaign_metrics_daily`, `campaign_financials_daily` | `cac`, `cpa`, `roas`, `roi`, `contribution_margin` | **Sistema** · `AnalyticsAgent` explica | — |
| 18 | **Aprendizaje / recalibración** | Job de recalibración | `product_scores` **nueva versión** (`model_version`, `weights`), `audit_logs` | error de predicción vs resultado real | **Sistema propone · Humano revisa** | **Puerta de muestra**: sin `n` mínimo no se recalibra (§8) |

### 1.2 Detalle de las puertas duras

**Puerta de selección (etapa 4→5).**
Condición: `product_scores.score >= SCORE_THRESHOLD` **y** `product_scores.confidence >= CONFIDENCE_MIN`
**y** existe un número mínimo de `product_metrics` con `provenance='REAL'` para los
componentes que más pesan. Si falla: `product_scores.status='INSUFFICIENT_DATA'` y el
candidato vuelve a la cola de investigación, **no a la papelera**. La UI muestra el
desglose: cuánto del score viene de `REAL` y cuánto de `ESTIMATED`/`AI_INFERENCE`.

**Puerta de economía (etapa 6→7).** Es la decisión real de lanzamiento.
Condición: `contribution_margin > 0` **y** `cac_estimado < contribution_margin`.
No es una advertencia: es un bloqueo que impide generar la estrategia y la campaña
para ese producto, con una explicación que dice cuál de las dos condiciones falló y
por cuánto. Justificación completa en ADR-013: 18 métricas de scoring, muchas
estimadas, producen falsa confianza; el score tiene datos inventados con formato de
dato. La economía usa datos que sí son observables (precio, costo, envío, comisiones,
impuestos).

**Puerta de contenido (etapa 8→9).** `content.status` no llega a `PUBLISHED` sin
`approved_by`/`approved_at`. El HTML generado por IA se sanitiza en servidor **al
guardar** (S2), no solo al renderizar.

**Puerta de campaña (etapa 11).** La transición `PENDING_APPROVAL → ACTIVE` valida en
el servicio de dominio que `campaigns.approval_id` apunta a una fila `approvals` con
`status='APPROVED'` y `subject_id` = la campaña. `PUBLISH_CAMPAIGN` **no se concede a
ningún agente** en el MVP: aunque el modelo lo intentara, el guard de permisos lo
rechaza (ADR-005).

**Puerta de presupuesto (etapa 10→11).** `MAX_DAILY_BUDGET`, `MAX_CAMPAIGN_BUDGET` y
`MAX_AUTOMATED_SPEND` son topes de validación. `MAX_BUDGET_CHANGE_PERCENTAGE` y
`BUDGET_COOLDOWN_HOURS` se implementan y testean ahora aunque la automatización no
exista: añadirla después será activar un flag, no rediseñar.

**Puerta de costo IA (etapas 7 y 10).** Si `DAILY_AI_BUDGET_USD` está agotado, el
`ModelRouter` degrada a modelos locales o encola la tarea. Degradación controlada, no
fallo. Toda llamada queda en `ai_runs` con `routing_reason` y en `ai_costs`.

---

## 2. Templates de campaña (datos, no código)

Los 9 templates son **filas** con `objective`, `kpi_primary`, `budget_strategy`,
`audience_strategy`, `creative_strategy`, `copy_strategy`, `success_metrics`. Añadir
uno es insertar una fila, no desplegar código. `campaigns.kpi_primary` **se copia del
template** en el momento de crear la campaña y es lo que la analítica usa para juzgarla.

Convención de KPI: el valor del `kpi_primary` se compara **siempre** contra un umbral
derivado de la economía del producto (§3), no contra un valor de la industria.

---

### 2.1 `PRODUCT_LAUNCH`

| Campo | Valor |
|---|---|
| `objective` | `SALES` |
| `kpi_primary` | `cpa` — coste por venta, con techo `cpa < break_even_cac` |
| `audience_strategy` | Frío amplio + intereses adyacentes al problema que resuelve el producto. Sin lookalike hasta tener ≥ 100 conversiones (no hay semilla). Excluir clientes existentes. |
| `budget_strategy` | Arranque con `budget_daily` = 3-5× el `break_even_cac` (≈ 3-5 pedidos/día de capacidad de aprendizaje). Fase de aprendizaje de 7 días sin tocar presupuesto ni creativos. Escalar +20% solo si `cpa < 0.7 × break_even_cac` durante 3 días. |
| `creative_strategy` | 3-5 creativos distintos por ángulo (problema, demostración, prueba social, oferta). Formato vertical 9:16 para Reels/Stories. En el MVP se generan **prompts** (`creatives.generation_prompt`), no imágenes reales. |
| `copy_strategy` | Hook en los primeros 3 segundos / 40 caracteres. Estructura problema → mecanismo → prueba → oferta → CTA. Un solo CTA por pieza. Sin superlativos no verificables. |
| `success_metrics` | `cpa` bajo el techo; `contribution_margin > 0` en `campaign_financials_daily`; CTR ≥ 1.0% en frío; hook rate ≥ 25% (retención a 3s). |
| **Cuándo usarlo** | Producto nuevo, sin audiencia propia, sin datos históricos de campaña. Es el primer template de un producto `SELECTED`. |
| **Señal de que va mal** | CTR < 0.6% (creativo o ángulo, no producto); `cpa` > `break_even_cac` a los 7 días con presupuesto suficiente para haber salido del aprendizaje; frecuencia > 2.5 en frío (audiencia saturada). |

---

### 2.2 `LEAD_GENERATION`

| Campo | Valor |
|---|---|
| `objective` | `LEADS` |
| `kpi_primary` | `cost_per_qualified_lead` (CPQL) — **no** `roas` |
| `audience_strategy` | Frío amplio con formulario nativo (instant form) o landing de captura. Intereses solo como señal, no como restricción dura. Excluir leads ya existentes por email/teléfono. |
| `budget_strategy` | `budget_daily` dimensionado al CPQL objetivo y a la capacidad de seguimiento: si solo puedes atender 20 leads/día, no compres 50. Pujar por lead con techo de coste, no por impresiones. |
| `creative_strategy` | Gancho educativo o de dolor concreto. Formato que explique el valor del contacto antes de pedir datos. Menos es más: cada campo del formulario baja la conversión. |
| `copy_strategy` | Vender el *siguiente paso*, no el producto. CTA de bajo compromiso ("Recibe la guía", "Agenda diagnóstico"). Cualificar dentro del formulario (presupuesto, plazo, necesidad) para subir lead quality. |
| `success_metrics` | `cost_per_qualified_lead` bajo el techo; ratio `qualified / total leads` ≥ 30%; luego, en el CRM, `lead → opportunity` ≥ 15%. |
| **Cuándo usarlo** | Ticket alto, ciclo de venta consultivo, o cuando la venta no se cierra en línea (el MVP registra órdenes manualmente). Es el template puente entre tráfico y venta cuando no hay checkout. |
| **Señal de que va mal** | Muchos leads a bajo coste pero `qualified/unqualified` < 15% (se compró volumen, no intención); CPQL barato que en el CRM nunca convierte a oportunidad; formulario tan abierto que el seguimiento es imposible. |

---

### 2.3 `TRAFFIC`

| Campo | Valor |
|---|---|
| `objective` | `TRAFFIC` |
| `kpi_primary` | `cpc` con techo, y `engaged_session_rate` como métrica de calidad |
| `audience_strategy` | Amplia por intereses de categoría. Sirve para llenar el pixel y capturar `anonymous_id` para futuros retargeting; no para vender directo. |
| `budget_strategy` | Bajo y acotado. Es una campaña de alimentación de audiencia; su presupuesto debe justificarse por el retargeting que habilita, no por su propio ROAS. |
| `creative_strategy` | Contenido editorial/entretenimiento con enlace a un artículo del blog (no a la landing de venta). Reels, carruseles informativos. |
| `copy_strategy` | Ángulo informacional. CTA de "leer/descubrir", sin presión comercial. |
| `success_metrics` | CPC bajo el techo; `engaged_session_rate` ≥ 40%; crecimiento de audiencia retargetable. **Su éxito se mide por el retargeting posterior, no por ventas atribuidas a esta campaña.** |
| **Cuándo usarlo** | Arranque en frío sin audiencia propia, o cuando hay que nutrir el `anonymous_id`/pixel antes de un `RETARGETING`. También para SEO+paid sobre contenido que aún no posiciona. |
| **Señal de que va mal** | Se está juzgando por `roas` (categoría equivocada); rebote > 70%; el tráfico llega pero nadie navega a producto. |

---

### 2.4 `SALES`

| Campo | Valor |
|---|---|
| `objective` | `SALES` |
| `kpi_primary` | `roas`, **comparado contra `break_even_roas`** del producto, no contra un 3.0 genérico |
| `audience_strategy` | Frío + tibio con intención de compra. Incluye retargeting de vistas de producto. Excluir compradores recientes. |
| `budget_strategy` | Escalado por tramos de 20% respetando `MAX_BUDGET_CHANGE_PERCENTAGE`, con 2-3 días de estabilización entre cambios. Cada escalado se valida contra `cpa` del tramo anterior. |
| `creative_strategy` | Creativo con el producto en uso, prueba social, garantía y oferta concreta. Variantes por ángulo; una sola oferta por creativo. |
| `copy_strategy` | Directo a conversión: beneficio, prueba, oferta, urgencia real (no fabricada), CTA imperativo. |
| `success_metrics` | `roas ≥ break_even_roas` **y** `roi > 0`; `cac < break_even_cac`; AOV estable o creciente. |
| **Cuándo usarlo** | Producto con economía validada y landing publicada. Es el template de venta directa por defecto cuando sí hay (o se simula) cierre. |
| **Señal de que va mal** | `roas` alto con `roi` negativo (margen insuficiente, trampa §5.4); `cac` subiendo tramo a tramo al escalar; la venta depende de descuentos crecientes. |

---

### 2.5 `RETARGETING`

| Campo | Valor |
|---|---|
| `objective` | `SALES` |
| `kpi_primary` | `cpa` sobre audiencia recalentada, con `roas` de control contra `break_even_roas` |
| `audience_strategy` | Excluyentes y por profundidad: view content 75%, add-to-cart, checkout abandonado, visitantes de la landing sin acción. Ventanas cortas (7/14/30 días) para no incluir tráfico ya muerto. **Excluir compradores.** |
| `budget_strategy` | Presupuesto pequeño: la audiencia se agota rápido. Regla de asignación: ≤ 20-25% del gasto total cuando hay campañas frías activas; si el retargeting acapara el gasto, está canibalizando conversiones que iban a ocurrir igual. |
| `creative_strategy` | Mensaje que responde a la objeción concreta de la etapa (precio, envío, dudas, comparación). Prueba social y devoluciones/garantía. |
| `copy_strategy` | Reconocer el contexto ("viste X"), resolver la duda, oferta de cierre. CTA directo. Sin saturar: límite de frecuencia. |
| `success_metrics` | `cpa` bajo `break_even_cac`; frecuencia controlada (< 4/semana); **margen incremental**, no solo last-click. |
| **Cuándo usarlo** | Cuando ya existe tráfico (viene después de `TRAFFIC`/`PRODUCT_LAUNCH`). No tiene sentido como primera campaña: no hay audiencia que retargetear. |
| **Señal de que va mal** | `roas` espectacular por last-click pero la campaña fría sigue igual (se está cobrando conversiones que ya iban a pasar); frecuencia alta con CTR cayendo; público demasiado pequeño y en burn-out. |

---

### 2.6 `AB_TEST`

| Campo | Valor |
|---|---|
| `objective` | Hereda el del template base (`SALES` o `TRAFFIC`) |
| `kpi_primary` | La métrica del experimento: `experiments.metric` (`ctr`, `cvr`, `cpa`, `hook_rate`…) |
| `audience_strategy` | Audiencia **idéntica** en ambas variantes; la aleatorización es la única diferencia. Misma ventana temporal para evitar estacionalidad. |
| `budget_strategy` | Presupuesto suficiente para alcanzar `experiments.required_sample_size` (§7) en un plazo razonable. Si no se puede, el experimento **no se lanza**: un test sin potencia no es un test. |
| `creative_strategy` | Una **sola** variable cambia (`variant_axis`: HOOK, IMAGE, VIDEO, CTA, AUDIENCE, LANDING, OFFER). Todo lo demás constante. |
| `copy_strategy` | Variante A vs B difieren solo en el eje. No se cambia hook y precio a la vez. |
| `success_metrics` | Diferencia estadísticamente significativa en `metric` al alcanzar la muestra; `experiments.result` con intervalo de confianza; `decision` ∈ {WINNER_A, WINNER_B, INCONCLUSIVE}. |
| **Cuándo usarlo** | Cuando ya hay volumen de tráfico y una pregunta concreta. Antes de eso, el "test" es ruido caro. |
| **Señal de que va mal** | Se declara ganador antes de la muestra (peeking); se miden 6 métricas y se elige la que salió mejor; las variantes corren en semanas distintas; no se alcanza la muestra y se decide igual. |

---

### 2.7 `UPSELL`

| Campo | Valor |
|---|---|
| `objective` | `RETENTION` |
| `kpi_primary` | `aov` incremental (y `attach_rate`) sobre clientes existentes |
| `audience_strategy` | **Solo compradores**. Segmento por producto comprado y fecha. Excluir a quien ya compró el ítem del upsell. |
| `budget_strategy` | Muy bajo: es venta a cliente propio (email/WhatsApp generado, no enviado en el MVP; o audiencia personalizada de compradores). El coste real es la IA, no el ad spend. |
| `creative_strategy` | El producto complementario en contexto de uso del producto original. Demostración de por qué juntos son mejores. |
| `copy_strategy` | Agradecer la compra, ofrecer la mejora de forma natural, beneficio claro, sin presión. CTA de mejora, no de urgencia. |
| `success_metrics` | `attach_rate` ≥ 10-15%; incremento de `aov`; `contribution_margin` incremental positivo; sin aumento de devoluciones. |
| **Cuándo usarlo** | Base de compradores existente, producto principal con complemento natural, y satisfacción razonable (devoluciones bajas). |
| **Señal de que va mal** | Suben las devoluciones del ítem original; `attach_rate` alto pero margen incremental nulo (el upsell canibaliza una compra mayor); se molesta a cliente reciente antes de que reciba el pedido. |

---

### 2.8 `CROSS_SELL`

| Campo | Valor |
|---|---|
| `objective` | `RETENTION` |
| `kpi_primary` | `attach_rate` y `contribution_margin` por cliente |
| `audience_strategy` | Compradores de una categoría a los que se les propone una categoría **distinta pero relacionada**. Segmentos por categoría de compra (`products.category_id`). |
| `budget_strategy` | Igual que `UPSELL`: bajo ad spend, foco en canales propios. En el MVP se genera el copy; el envío es manual. |
| `creative_strategy` | Contenido que conecta ambas categorías por un caso de uso, no por un catálogo genérico. |
| `copy_strategy` | Descubrimiento de una necesidad adyacente. CTA exploratorio con oferta de entrada. |
| `success_metrics` | `attach_rate`; nº de clientes que pasan a multicategoría; LTV a margen creciente (no a revenue). |
| **Cuándo usarlo** | Catálogo con al menos dos categorías relacionadas y base de clientes con historial. |
| **Señal de que va mal** | Se propone algo sin relación real (quema la lista); sube el coste de atención; el cliente compra una vez y no repite. |

---

### 2.9 `REACTIVATION`

| Campo | Valor |
|---|---|
| `objective` | `RETENTION` |
| `kpi_primary` | `reactivation_rate` y `cpa` **calculado solo sobre clientes reactivados** |
| `audience_strategy` | Clientes sin compra en N días (definir N por ciclo de recompra del producto). Excluir compradores recientes. Ventana de lapsed configurable. |
| `budget_strategy` | Bajo. Se justifica solo si el `cpa` sobre reactivados es menor que el `cac` de adquirir un cliente nuevo en frío. |
| `creative_strategy` | Mensaje de "te echamos de menos" con un motivo real (novedad, mejora, oferta). No un descuento indiscriminado: destruye margen y entrena al cliente a esperar rebajas. |
| `copy_strategy` | Personalizado por última compra. CTA de volver, con fricción mínima. |
| `success_metrics` | `reactivation_rate` ≥ 5-10%; `cpa` sobre reactivados < `break_even_cac`; margen positivo; sin canibalizar compras que iban a ocurrir. |
| **Cuándo usarlo** | Clientes con historial de recompra plausible y una base de lapsed significativa. |
| **Señal de que va mal** | Solo funciona con descuentos crecientes; los reactivados no vuelven a comprar (reactivación de una sola vez); el coste del descuento supera el margen. |

---

## 3. Economía unitaria

Es la puerta real de lanzamiento. Todo lo demás ordena; esto decide.

### 3.1 Los tres márgenes, sin ambigüedad

| Concepto | Definición en este proyecto | Qué incluye | Qué NO incluye |
|---|---|---|---|
| **Gross margin** (margen bruto) | `selling_price − unit_cost` | Solo el coste del producto (COGS) | envío, comisiones, impuestos, devoluciones, ad spend |
| **Contribution margin** (margen de contribución) | `selling_price − costes_variables_totales` | producto, envío, empaque, otros, comisión de pago, comisión de plataforma, impuestos, coste esperado de devoluciones | **ad spend** (es lo que queda para pagarlo), costes fijos |
| **Net profit** (beneficio neto) | `contribution_margin − ad_spend − costes_fijos` | todo lo anterior + publicidad + costes fijos (hosting, SaaS, etc.) | — |

La confusión clásica es vender "margen" refiriéndose a gross margin. Un producto con
gross margin del 68% puede tener contribution margin del 52% y quedarse en pérdidas
después de publicidad. El número que decide es el **contribution margin**, porque es
el techo del CAC.

### 3.2 Fórmula completa con campos reales

Campos de `product_costs` (versionado por `valid_from`/`valid_to`; nunca se sobrescribe):

```
P   = products.selling_price
C   = product_costs.unit_cost
S   = product_costs.shipping_cost
K   = product_costs.packaging_cost
O   = product_costs.other_cost
pf  = product_costs.payment_fee_pct
pff = product_costs.payment_fee_fixed
plf = product_costs.platform_fee_pct
tx  = product_costs.tax_pct
r   = product_costs.returns_rate          (ESTIMATED al inicio)
```

Cálculos intermedios:

```
payment_fee   = pf × P + pff
platform_fee  = plf × P
tax           = tx × P
gross_margin  = P − C

costes_variables_totales =
      C + S + K + O
    + payment_fee + platform_fee + tax
    + r × (C + S + K + O)          ← coste esperado de devolución
                                     (producto + logística, ida y vuelta, no recuperados)

contribution_margin = P − costes_variables_totales
```

Y las dos puertas derivadas:

```
break_even_cac  = contribution_margin
                  CAC máximo que mantiene la operación en cero.
                  Cualquier CAC por encima pierde dinero en cada venta.

break_even_roas = P / contribution_margin
                  ROAS mínimo para no perder dinero con publicidad.
                  Equivale a  1 / (contribution_margin / P).
```

La última igualdad es la que evita el error más común: **el ROAS de equilibrio no es
3.0 ni 2.0 "por convención"; sale del margen del producto.** Un producto con
`contribution_margin/P = 52%` necesita ROAS ≥ 1.92. Uno con 15% necesita ROAS ≥ 6.67.

### 3.3 Ejemplo numérico resuelto paso a paso

Producto: audífonos TWS. Moneda COP (default Colombia/LATAM, §O.3).

| Input | Valor |
|---|---|
| `selling_price` (P) | 120,000 |
| `unit_cost` (C) | 38,000 |
| `shipping_cost` (S) | 9,000 |
| `packaging_cost` (K) | 1,500 |
| `other_cost` (O) | 1,000 |
| `payment_fee_pct` (pf) | 3.49% |
| `payment_fee_fixed` (pff) | 900 |
| `platform_fee_pct` (plf) | 0% (venta en sitio propio) |
| `tax_pct` (tx) | 0% (configurable; si aplica IVA, entra aquí) |
| `returns_rate` (r) | 6% |

**Paso 1 — costes variables directos**

```
C + S + K + O = 38,000 + 9,000 + 1,500 + 1,000 = 49,500
```

**Paso 2 — comisiones e impuestos**

```
payment_fee  = 0.0349 × 120,000 + 900 = 4,188 + 900 = 5,088
platform_fee = 0 × 120,000 = 0
tax          = 0 × 120,000 = 0
```

**Paso 3 — coste esperado de devoluciones**

```
returns_cost = 0.06 × 49,500 = 2,970
```

**Paso 4 — márgenes**

```
gross_margin        = 120,000 − 38,000 = 82,000        (68.3% de P)
costes_variables    = 49,500 + 5,088 + 0 + 0 + 2,970 = 57,558
contribution_margin = 120,000 − 57,558 = 62,442        (52.0% de P)
```

**Paso 5 — puertas**

```
break_even_cac  = 62,442
break_even_roas = 120,000 / 62,442 = 1.92
```

**Lectura:** este producto puede pagar hasta 62,442 COP por cliente adquirido y
seguir en cero. Si el `cac_estimado` es 45,000, la puerta de economía **pasa**
(45,000 < 62,442) con colchón. Si es 70,000, **bloquea** la campaña con explicación.

### 3.4 Decisiones que se derivan

**(a) A qué precio vender.** Con `α = 1 − pf − plf − tx` (factor de retención) y
`β = (C+S+K+O)(1+r) + pff` (coste variable no proporcional al precio):

```
contribution_margin(P) = α·P − β

Con los datos del ejemplo:  α = 0.9651,  β = 49,500 × 1.06 + 900 = 53,370

Precio mínimo para sostener un CAC objetivo:
    P* = (CAC_objetivo + β) / α

Precio mínimo para sostener CAC + un margen neto objetivo m sobre precio:
    P* = (CAC_objetivo + β) / (α − m)
```

Aplicado:

| Objetivo | Cálculo | Precio mínimo |
|---|---|---|
| Cubrir CAC 40,000 | (40,000 + 53,370) / 0.9651 | **96,750** |
| Cubrir CAC 50,000 | (50,000 + 53,370) / 0.9651 | **107,100** |
| CAC 40,000 + 15% de margen neto sobre precio | (40,000 + 53,370) / (0.9651 − 0.15) | **114,550** |

A 120,000 COP se cubre un CAC de hasta 62,442 (o 40,000 con ~15% de margen neto
sobre precio). A 96,750 se cubre exactamente 40,000 y no queda nada.

**(b) Cuál es el CAC máximo.** `break_even_cac = contribution_margin`. Pero operar en
el break-even no es un negocio. Criterio de este proyecto:

```
CAC_objetivo = contribution_margin − margen_neto_objetivo × P
```

Con `margen_neto_objetivo = 0.20` sobre precio: `CAC_objetivo = 62,442 − 24,000 = 38,442`.
Ese es el CAC que el sistema persigue al optimizar campañas; `62,442` es la línea roja.

**(c) Cuál es el ROAS de equilibrio.** `break_even_roas = 1.92`. Cualquier campaña
de este producto con ROAS < 1.92 destruye margen. El dashboard compara el ROAS de la
campaña contra **el break_even_roas del producto de esa campaña**, no contra un
umbral global. Dos productos del mismo catálogo pueden requerir ROAS de 1.9 y 6.7.

**Nota de reproducibilidad:** `product_costs` está versionado por fecha y
`product_economics_snapshot` guarda `computed_with_cost_id`. Una decisión de hace seis
meses se puede recalcular exactamente con los costes de entonces.

---

## 4. Atribución

### 4.1 Captura

En `apps/site` (primera parte, sin delegar en píxeles de terceros):

```
anonymous_id          cookie/localStorage de primera parte. Identifica al visitante
                      aunque nunca rellene un formulario.
utm_source / medium / campaign / content / term
click_id              fbclid | gclid | ttclid
click_id_type         cuál de los tres es
referrer, landing_url, occurred_at
```

Todo se persiste **crudo, inmutable, append-only** en `touchpoints`. `ip_hash` y
`user_agent` se guardan (IP hasheada, no cruda — minimización de datos).

Además, si el click trae identificadores de plataforma, se resuelven
`touchpoints.campaign_id`, `ad_id`, `creative_id`.

### 4.2 Resolución de identidad anónimo → lead → cliente

```
Visita anónima      → identities(anonymous_id, first_seen_at)
Rellena formulario  → identities.email = ..., identity_links(reason='email_match')
                      leads(identity_id, first_touchpoint_id, last_touchpoint_id)
Compra              → identities.is_customer = true (job)
                      orders(identity_id, campaign_id, first/last_touchpoint_id)
Fusión posterior    → identity_links(from_identity_id → to_identity_id, confidence)
```

La resolución se **re-ejecuta** cuando llega información nueva (ADR-014 punto 4). Si
dos `anonymous_id` resultan ser la misma persona por email o teléfono, se insertan en
`identity_links` y se consolida. La fusión nunca borra: une.

Por qué esto importa: sin `anonymous_id` de primera parte, la mayoría del tráfico frío
(que no rellena formularios) no sería atribuible y la analítica arrancaría ciega.

### 4.3 El modelo se calcula en un job, no se guarda (ADR-014)

Flujo:

```
touchpoints crudos (append-only)
      ↓  job de atribución (BullMQ)
order_attribution:
  model = LAST_TOUCH   → credit 1.0, revenue_credit, margin_credit
  model = FIRST_TOUCH  → credit 1.0, revenue_credit, margin_credit
      ↓
agregación por campaign_id sobre MARGIN_CREDIT (no revenue)
```

**Por qué NO se guarda el modelo como campo fijo en `orders`.** Guardar
`orders.attribution = 'last_touch'` fija el modelo en el instante de la escritura:
mejorar el modelo obligaría a perder el histórico o a migrar datos. Almacenando
touchpoints crudos y calculando en un job, el día que se quiera atribución lineal,
position-based o data-driven es **un job nuevo** que inserta filas en
`order_attribution` (`UNIQUE(order_id, model, campaign_id, touchpoint_id)`), sin tocar
un solo dato histórico. Se comparan modelos en paralelo y se decide cuál usar.

`orders` guarda además `total_cost` (producto + envío + fees + impuestos) por línea en
`order_items.line_cost`. Sin eso, se podría agregar por revenue pero no por margen, y
la pregunta "¿qué campaña produjo mayor margen?" no tendría respuesta. Por eso la
economía unitaria (Fase 3) es prerequisito de la analítica (Fase 8).

### 4.4 Ejemplo real de cadena de touchpoints hasta la venta

Persona: `anonymous_id = anon_7f3a9c...`

| # | Día | Canal | Touchpoint | `campaign_id` | `is_first_touch` |
|---|---|---|---|---|---|
| 1 | Lun | Reel de Instagram (paid) | `utm_source=instagram`, `utm_medium=paid_social`, `utm_campaign=launch_tws`, `utm_content=reel_hook_a`, `fbclid=IwAR...` | **A** (PRODUCT_LAUNCH) | `true` |
| 2 | Mar | Búsqueda orgánica | `referrer=google.com`, sin UTM | null | `false` |
| 3 | Vie | Google Ads (retargeting) | `utm_source=google`, `utm_medium=cpc`, `utm_campaign=rt_viewcart`, `gclid=Cj0...` | **B** (RETARGETING) | `false` |
| 4 | Vie | Formulario / checkout | `is_conversion_touch=true`, resuelve `identity_id` | **B** | `false` |

Al registrarse la orden (`orders`):

```
identity_id            = ident_...  (anon_7f3a9c fusionado con email)
first_touchpoint_id    = tp_1   (campaña A)
last_touchpoint_id     = tp_3/tp_4   (campaña B)
campaign_id (resuelto) = B
total                  = 120,000
total_cost             = 57,558
```

El job genera:

| `model` | `campaign_id` | `credit` | `revenue_credit` | `margin_credit` |
|---|---|---|---|---|
| `FIRST_TOUCH` | A | 1.0 | 120,000 | 62,442 |
| `LAST_TOUCH` | B | 1.0 | 120,000 | 62,442 |

**"¿De dónde vino esta venta?"** — no se responde con un campo, se responde con la
cadena: `GET /api/v1/analytics/attribution/:orderId` devuelve los 4 touchpoints
ordenados, con marca de cuál fue el primero y cuál el de conversión, y las filas de
`order_attribution` por modelo. La UI muestra el recorrido completo, no solo el último
click.

**"¿Qué campaña produjo mayor margen?"** — se agrega `order_attribution.margin_credit`
por `campaign_id` (con `model='LAST_TOUCH'`, y se compara contra `FIRST_TOUCH`):

```sql
SELECT campaign_id,
       SUM(margin_credit) AS margen_atribuido,
       SUM(revenue_credit) AS revenue_atribuido
FROM order_attribution
WHERE model = 'LAST_TOUCH'
GROUP BY campaign_id
ORDER BY margen_atribuido DESC;
```

Ordenar por `revenue_credit` y por `margin_credit` da resultados distintos — y el que
decide dónde poner dinero es el de **margen**. La campaña A (la que trajo al usuario)
puede perder el crédito last-click frente a B (la que cerró), y eso solo se ve
comparando los dos modelos.

---

## 5. Métricas del dashboard

Cada KPI tiene **una sola definición** en el código; el dashboard consume la fórmula,
no la reinventa (regla de `campaign_metrics_daily`). Toda mutación de definición
sube versión y se documenta aquí.

### 5.1 Tabla de KPIs

| KPI | Fórmula exacta | Denominador | Interpretación |
|---|---|---|---|
| `revenue` | `SUM(orders.total)` con `status IN ('PAID','FULFILLED')` | — | Dinero facturado. **No es ganancia.** |
| `orders` | `COUNT(DISTINCT orders.id)` pagadas | — | Nº de transacciones. |
| `conversion_rate` (campaña) | `conversions / clicks` | clics | % de clics que convierten. `conversions` se define por el objetivo del template. |
| `conversion_rate` (sitio) | `orders / sessions` | sesiones | % de sesiones que compran. Sesiones ≠ usuarios ≠ clics. |
| `ad_spend` | `SUM(campaign_metrics_daily.spend)` | — | Inversión publicitaria del periodo. |
| `CAC` | `ad_spend / new_customers` | **clientes nuevos** | Coste de adquirir un cliente. Nunca sobre leads. |
| `CPA` | `ad_spend / conversions` | conversiones (definidas por objetivo) | Coste por acción. En `LEAD_GENERATION`, CPA = coste por lead. |
| `cost_per_qualified_lead` | `ad_spend / qualified_leads` | leads cualificados | KPI de `LEAD_GENERATION`. `qualified` viene del CRM, no del formulario. |
| `ROAS` | `revenue / ad_spend` | inversión | Retorno en **ingresos** por unidad monetaria invertida. Ignora el margen. |
| `ROI` | `(contribution_margin − ad_spend) / ad_spend` | inversión | Retorno en **margen** tras publicidad. Es lo que decide rentabilidad. |
| `gross_margin` | `revenue − product_cost` (Σ `line_total − line_cost`) | — | Margen bruto agregado. |
| `contribution_margin` | `revenue − product_cost − shipping_cost − fees − taxes + refunds_netos` | — | Margen que sostiene el CAC. Es lo que se agrega por campaña. |
| `net_profit` | `contribution_margin − ad_spend − costes_fijos` | — | Beneficio real del periodo. |
| `CTR` | `clicks / impressions` | impresiones | Calidad del creativo/audiencia. |
| `CPC` | `spend / clicks` | clics | Coste por clic. |
| `CPM` | `spend / impressions × 1000` | (por 1,000 impresiones) | Coste por mil impresiones. |
| `AOV` | `revenue / orders` | pedidos | Ticket medio. Sube con upsell, cross-sell y mix. |
| `LTV` | `contribution_margin_por_pedido × pedidos_por_cliente` (ventana definida, **a margen**) | — | Valor del cliente en **margen**, no en revenue. Ver §5.4. |
| `LTV:CAC` | `LTV / CAC` | CAC | Salud del modelo. Se calcula con LTV a margen. |

Umbral de referencia del proyecto: `LTV:CAC >= 3` **con LTV a margen**, y
`CAC < break_even_cac` del producto. Si `LTV:CAC` solo se cumple con LTV a revenue,
no se cumple.

### 5.2 Por qué ROAS y ROI dan números distintos

Con el producto del §3 (contribution margin por pedido = 62,442):

10 pedidos, `revenue = 1,200,000`, `ad_spend = 400,000`:

```
contribution_margin (antes de ads) = 10 × 62,442 = 624,420

ROAS = 1,200,000 / 400,000 = 3.00
ROI  = (624,420 − 400,000) / 400,000 = 224,420 / 400,000 = 0.561  → 56.1%
break_even_roas = 1.92
```

ROAS = 3.00 responde "por cada 1 de publicidad entraron 3 de ingresos". ROI = 56.1%
responde "por cada 1 de publicidad gané 0.56 de margen". Son preguntas distintas y el
segundo número es el que importa. ROAS por sí solo no dice si hay negocio.

### 5.3 Las tres trampas habituales

**Trampa 1 — ROAS alto con margen negativo.**
Mismo gasto (400,000) y mismo ROAS (3.00), pero un producto con contribution margin
del 20% (24,000/pedido):

```
contribution_margin = 10 × 24,000 = 240,000
ROI = (240,000 − 400,000) / 400,000 = −0.40  → −40%
break_even_roas = 120,000 / 24,000 = 5.0
```

ROAS 3.00 parece sano; el producto pierde dinero porque su break-even era 5.0, no 3.0.
Un dashboard que ordena campañas por ROAS presenta esta campaña como ganadora. Por eso
`campaign_financials_daily` guarda `contribution_margin` y `roi`, y la comparativa se
ordena por margen. El test de aceptación de Fase 8 lo exige explícitamente.

**Trampa 2 — CAC calculado sobre leads y no sobre clientes.**
400,000 de gasto, 30 leads, 10 compradores:

```
CAC sobre clientes = 400,000 / 10 = 40,000
"coste por lead"   = 400,000 / 30 = 13,333   ← no es CAC
```

Reportar 13,333 como CAC subestima el coste real por 3×. Con un `break_even_cac` de
35,000, el negocio pierde dinero (40,000 > 35,000) mientras el panel muestra 13,333 y
parece excelente. El CAC se calcula **siempre** sobre `new_customers`; el coste por
lead es otra métrica (`CPA`/`cost_per_qualified_lead`), con otro nombre.

**Trampa 3 — LTV medido sin margen.**
Cliente que compra 2.5 veces, AOV 120,000, CAC 40,000:

```
LTV (revenue) = 2.5 × 120,000 = 300,000   → LTV:CAC = 7.5   "excelente"
LTV (margen)  = 2.5 × 62,442  = 156,105   → LTV:CAC = 3.9   correcto
```

Medir LTV a revenue infla el ratio y justifica gastar de más. El LTV de este proyecto
se calcula sobre contribution margin por pedido, no sobre revenue.

### 5.4 Revenue, Profit, ROAS, ROI: cuatro cosas

- `revenue` = lo que entra. No es tuyo: pagaste producto, envío, comisiones.
- `profit` (net) = lo que queda tras todo, incluida la publicidad.
- `ROAS` = ingresos por unidad de inversión. Métrica de medios.
- `ROI` = margen por unidad de inversión. Métrica de negocio.

Se muestran siempre los cuatro, con la fórmula a un clic, y nunca se usa uno para
responder la pregunta de otro.

---

## 6. Social media engine

### 6.1 Qué genera el sistema

Salidas persistidas en `content` (`type=SOCIAL_POST`, `channel ∈ {instagram, facebook}`)
y en `creatives` (formato visual/propuesta):

| Pieza | `content.type` | `creatives.type` | Qué contiene |
|---|---|---|---|
| **Post de imagen** | `SOCIAL_POST` | `IMAGE` | Copy breve, gancho, CTA, concepto visual |
| **Concepto de reel** | `SOCIAL_POST` | `VIDEO` | Guion por escenas, hook 0-3s, texto en pantalla, audio sugerido, `generation_prompt` del video |
| **Story** | `SOCIAL_POST` | `IMAGE`/`VIDEO` | Secuencia de 1-3 frames, sticker/CTA, intención (encuesta, swipe, link) |
| **Carrusel** | `SOCIAL_POST` | `CAROUSEL` | Slide por slide: hook, desarrollo, prueba, oferta, CTA |
| **Caption** | `SOCIAL_POST` | `TEXT` | Texto de acompañamiento, primera línea como segundo gancho |
| **Hook** | (campo del copy) | — | Primera frase / primer segundo. Se generan 3-5 por pieza |
| **CTA** | (campo del copy) | — | Uno por pieza, alineado con el objetivo del template |
| **Hashtags** | (campo del copy) | — | Solo cuando aportan descubrimiento o contexto de comunidad; nunca relleno |

En el MVP, `creatives` solo se generan como **prompts** (`generation_prompt`,
`generation_provider`, `status='PROPOSED'`). **No se generan imágenes ni video reales**
(§M.2).

### 6.2 Formato del content calendar

```
DAY | CONTENT TYPE | PRODUCT | ANGLE | HOOK | COPY | CREATIVE | CTA | STATUS
```

| Columna | Origen | Valores |
|---|---|---|
| `DAY` | calendario | fecha / día relativo (D0 = lanzamiento) |
| `CONTENT TYPE` | `content.type` + formato | `POST` / `REEL` / `STORY` / `CAROUSEL` |
| `PRODUCT` | `content.product_id` | producto o `-` (contenido de marca) |
| `ANGLE` | estrategia (`MarketingStrategyAgent`) | problema / demostración / prueba social / oferta / educativo / detrás de cámaras |
| `HOOK` | copy | primera frase o primer segundo |
| `COPY` | `content.body_md` | texto completo |
| `CREATIVE` | `creatives.id` + `generation_prompt` | pieza propuesta |
| `CTA` | copy | uno solo por pieza |
| `STATUS` | `content.status` | `DRAFT` / `IN_REVIEW` / `APPROVED` / `PUBLISHED` |

Ejemplo de fila:

```
D-3 | REEL     | Audífonos TWS | problema      | "¿Se te caen los audífonos al correr?" |
      copy: ... | creatives: VIDEO (prompt: POV corriendo, vertical 9:16...) |
      CTA: "Míralos aquí" | STATUS: IN_REVIEW
D-1 | CAROUSEL | Audífonos TWS | prueba social | "4.8 estrellas con 1.200 reseñas" |
      ... | CTA: "Ver oferta" | STATUS: DRAFT
D0  | POST     | Audífonos TWS | oferta        | "Hoy lanzamos con envío gratis" |
      ... | CTA: "Comprar" | STATUS: DRAFT
```

### 6.3 Generar y aprobar, no publicar

En el MVP el sistema **genera y aprueba**; **no publica automáticamente** en
Instagram ni Facebook (§M.2). `content.status` llega a `PUBLISHED` cuando un humano lo
marca tras publicar manualmente (o cuando una integración Post-MVP lo haga con
aprobación). El copy generado también sirve para email/WhatsApp: se genera el texto,
**no se envía**. La bandeja de aprobaciones (`approvals`) es el punto de control.

---

## 7. Experimentation engine

### 7.1 Estructura de un experimento

Tabla `experiments` (esquema reservado, Fase 9):

| Campo | Contenido | Ejemplo |
|---|---|---|
| `hypothesis` | Afirmación falsable y direccional | "Un hook de dolor convierte mejor que uno de beneficio" |
| `variant_axis` | Variable única que cambia | `HOOK` (`IMAGE`/`VIDEO`/`CTA`/`AUDIENCE`/`LANDING`/`OFFER`) |
| `variant_a_id` / `variant_b_id` | Referencias a `creatives`/`content` | A = hook dolor, B = hook beneficio |
| `metric` | Métrica primaria **única** | `cvr` (o `ctr`, `cpa`, `hook_rate`) |
| `required_sample_size` | Calculado (§7.2) | 3,818 por variante |
| `status` | `PROPOSED`/`RUNNING`/`COMPLETED`/`STOPPED`/`INVALID` | `RUNNING` |
| `result` | `{a, b, delta, ci_low, ci_high, p_value, n}` | Δ +0.4 pp, IC [0.1, 0.7] |
| `decision` | `WINNER_A`/`WINNER_B`/`INCONCLUSIVE`/`STOPPED_EARLY`/`INVALID` | `INCONCLUSIVE` |
| `decided_at` | Fecha de la decisión | — |

### 7.2 Cómo se calcula el tamaño de muestra necesario

Test de dos proporciones (α = 0.05, potencia 80%):

```
n_por_variante = (Z_α/2 + Z_β)² × [p1(1−p1) + p2(1−p2)] / (p1 − p2)²

Z_α/2 = 1.96   Z_β = 0.84   →   (Z_α/2 + Z_β)² = 7.84
```

Ejemplo A — detectar una mejora relativa del 25% sobre una conversión base del 2.0%:

```
p1 = 0.020,  p2 = 0.025

numerator   = 7.84 × [0.020×0.980 + 0.025×0.975] = 7.84 × 0.043975 = 0.3448
denominator = (0.005)² = 0.000025
n           = 0.3448 / 0.000025 = 13,792 por variante  → 27,584 clics totales
```

A 400 clics/día son **~69 días**. No es viable: ese experimento no se lanza como está.

Ejemplo B — misma base, detectar un 50% relativo (2.0% → 3.0%):

```
numerator   = 7.84 × [0.020×0.980 + 0.030×0.970] = 7.84 × 0.0487 = 0.3818
denominator = (0.01)² = 0.0001
n           = 3,818 por variante  → 7,636 clics totales  (~19 días a 400/día)
```

Conclusión operativa: **buscar efectos pequeños exige muestras enormes.** Si el
presupuesto solo permite 7,000 clics, el experimento debe apuntar a un MDE del 50%,
no del 5%. El `ExperimentEngine` calcula `required_sample_size` **antes** de proponer
el test y, si el presupuesto no lo alcanza, lo marca como no viable en vez de lanzarlo
y sacar una conclusión falsa.

### 7.3 Trampas que invalidan un test

| Trampa | Por qué invalida | Cómo la evita el sistema |
|---|---|---|
| **Parar antes de tiempo (peeking)** | Mirar el resultado cada día e ir parando cuando "gana" infla los falsos positivos muy por encima del 5% | El test corre hasta `required_sample_size` o hasta la fecha fijada; no se evalúa antes. `decision='STOPPED_EARLY'` si se para |
| **Mirar muchas métricas** | Probar 6 métricas y elegir la que salió significativa es p-hacking | Una sola `metric` primaria declarada antes de lanzar. Las secundarias son descriptivas, no deciden |
| **Estacionalidad** | A y B en semanas distintas miden contextos distintos | Ambas variantes corren simultáneamente, mismo presupuesto repartido |
| **Presupuesto insuficiente** | Sin potencia estadística, cualquier diferencia es ruido | `required_sample_size` calculado antes; si no hay presupuesto, no se lanza |
| **Efecto novedad** | Un creativo nuevo rinde más al principio por curiosidad | Ventana mínima y, si es posible, comparar semanas 2+ |
| **Sample ratio mismatch** | Si el reparto A/B no es ~50/50, algo sesga la asignación | Se verifica el ratio de asignación como control de calidad |
| **Fase de aprendizaje** | Las plataformas reoptimizan durante días | Respetar la fase de aprendizaje antes de medir |

### 7.4 Cómo la IA propone hipótesis sin declarar ganador

El `AnalyticsAgent` (Fase 8) detecta anomalías y patrones y **propone hipótesis**
(escribir una fila `experiments` con `status='PROPOSED'`). El `ExperimentEngine`
calcula muestra y viabilidad. El `BudgetOptimizationAgent` (Fase 9) puede proponer
cerrar un test, pero **la decisión sobre resultados la aplica el framework, no el
modelo**:

- Si no hay significancia ni muestra suficiente → `decision='INCONCLUSIVE'`. La IA
  **no puede** escribir `WINNER_A`/`WINNER_B` sin `result.p_value < 0.05` y
  `n >= required_sample_size`.
- Toda `decision` queda en `experiments` y en `audit_logs` con `actor_type`.
- En el MVP, ejecutar el experimento es manual: se diseña y se registra, pero la
  campaña la publica y la controla un humano (§M.2: experimentación A/B automatizada
  **no** entra).

---

## 8. Cómo cierra el ciclo: recalibración del scoring

El punto 5 del éxito del MVP (§A.3): el scoring de la siguiente investigación usa los
resultados de la anterior. Sin esto, el sistema acumula datos pero no aprende.

### 8.1 Qué se compara contra qué

Job de recalibración (Fase 8/9) sobre `products JOIN campaigns JOIN
campaign_financials_daily`, con un mínimo de datos:

| Predicción (histórica) | Resultado real | Dónde vive el real | Qué se ajusta |
|---|---|---|---|
| `product_scores.score` / ranking | `contribution_margin` acumulado y paso o no del `break_even_cac` | `campaign_financials_daily.contribution_margin`, `roas`, `roi` | peso relativo de cada componente |
| `product_metrics.cac_estimated` (`AI_INFERENCE`) | `campaign_financials_daily.cac` | idem | sesgo y escala del componente de CAC |
| `product_metrics.roas_potential` | `campaign_financials_daily.roas` | idem | componente de ROAS potencial |
| `product_metrics.demand_proxy` (`ESTIMATED`) | `leads` / `conversions` reales por producto | `campaign_metrics_daily.conversions`, `orders` | componente de demanda |
| `product_metrics.content_potential` (`AI_INFERENCE`) | `campaign_metrics_daily.ctr`, hook rate | `campaign_metrics_daily.ctr` | componente de contenido |
| `product_scores.confidence` declarada | error absoluto de la predicción | calculado | calibración de la confianza |
| `leads.score` (lead score) | `lead → opportunity → cliente` en el CRM | `lead_stage_history`, `orders` | pesos del lead score |

### 8.2 Cómo se ajusta

1. **Correlación por componente.** Para cada componente (`demand`, `competition`,
   `content_potential`, `logistics_difficulty`, `cac_estimated`…), se calcula la
   correlación (Spearman) entre su valor normalizado y el resultado real (margen
   atribuido, o `cac` real). Un componente que no correlaciona está aportando ruido.
2. **Regla de ajuste documentada.** Los componentes con correlación positiva y bajo
   error suben peso; los de correlación nula o negativa bajan peso; ninguno se elimina
   sin registrarlo. El ajuste se limita por paso (`Δw` máximo) para evitar que un
   puñado de campañas mueva el modelo entero.
3. **Nueva versión, nunca sobrescritura.** El resultado se inserta como una fila nueva
   en `product_scores` con `model_version='scoring_v2'` y los `weights` explícitos. La
   versión anterior permanece: se puede responder "¿por qué este producto tenía score
   82 hace tres meses?" y comparar.
4. **Puerta de muestra.** Sin un mínimo de resultados reales (p. ej. `n >= 15`
   productos con campaña y venta suficiente) **no se recalibra**. Recalibrar con 3
   campañas es sobreajustar. Por debajo del mínimo, el job solo guarda el `report` y
   espera.
5. **Auditoría.** Cada recalibración escribe en `audit_logs` con `actor_type='SYSTEM'`,
   los pesos anteriores y los nuevos, y la razón. Es revisable por un humano.

### 8.3 Qué NO cambia con la recalibración

- La **puerta de economía** no se recalibra: `contribution_margin > 0` y
  `cac_estimado < contribution_margin` siguen decidiendo. Lo que mejora es la
  estimación de `cac_estimado`, que antes era `INSUFFICIENT_DATA` y ahora tiene base
  real (ADR-013 punto 6: `cpc_estimated`/`cac_estimated`/`roas_potential` solo se
  producen con datos de campañas propias).
- La **provenance** de cada métrica se mantiene: una `cac_estimated` sigue siendo
  `AI_INFERENCE` con su `confidence`, aunque ahora esté calibrada contra datos reales.
- El **score sigue ordenando, no decidiendo**. La recalibración mejora el orden en que
  se investiga; la economía sigue siendo la puerta de lanzamiento.

---

## 9. Resumen de coherencia

| Documento fuente | Decisiones que este documento respeta |
|---|---|
| `architecture-review.md` §A | Ciclo cerrado con feedback real; el punto 5 (recalibración) es la prueba de que cierra |
| `architecture-review.md` §H.1-§H.2 | Pipeline y puertas duras reproducidos etapa por etapa (§1) |
| `architecture-review.md` §H.3 | Máquina de estados y guardrails de presupuesto (§1.2) |
| `architecture-review.md` §H.4 | 9 templates como datos, `kpi_primary` por template (§2) |
| `architecture-review.md` §M.2 | Sin publicación automática, sin cambios automáticos de presupuesto, sin checkout propio, sin envío automático de email/WhatsApp, sin generación real de imagen/video, sin multi-touch (§0 regla 9, §6.3, §7.4) |
| `decisions.md` ADR-004 | Conectores API-first; datos `REAL` solo de fuentes aprobadas (§1, §8.1) |
| `decisions.md` ADR-005 | Human-in-the-loop como propiedad del `ToolRegistry`; `PUBLISH_CAMPAIGN` no concedido a agentes (§1.2) |
| `decisions.md` ADR-013 | Provenance obligatoria; el score ordena, la economía decide; recalibración obligatoria (§3, §8) |
| `decisions.md` ADR-014 | Touchpoints crudos; atribución calculada por job; sin modelo como campo fijo; margen y no revenue (§4) |
| `database.md` | Nombres de tablas y campos usados literalmente en todo el documento |

Documento sin código de aplicación. Nada aquí afirma que exista una implementación
todavía; describe las decisiones y las fórmulas que la implementación deberá cumplir.
