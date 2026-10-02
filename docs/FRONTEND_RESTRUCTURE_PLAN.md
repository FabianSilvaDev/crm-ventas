# FRONTEND RESTRUCTURE PLAN — AI SALES & GROWTH CRM

> Basado en el audit de `apps/web` al día de hoy.
> Objetivo: transformar la experiencia de "CRM administrativo tradicional" a "Business Growth Control Center" sin tocar backend, APIs, modelos, agentes ni lógica de negocio.

---

## 1. CURRENT FRONTEND AUDIT

### Proyecto y toolchain

* `apps/web` es una **SPA Angular 22.2.0** standalone, **zoneless**, compilada con `@angular/build:application`.
* TypeScript 6.0.2, `module: preserve`, `target: ES2022`.
* `@angular/cdk` declarado como dependencia pero **no se usa todavía** en el código.
* Vitest + jsdom para tests; Angular CDK testing no presente.
* Sin SSR/SSG (CSR puro). Está documentado como intencional: `apps/site` será el frontend público SEO/SSR.
* `packageManager: pnpm@12.8.1`; en esta máquina hay que usar `corepack pnpm`.

### Estructura de carpetas actual

```
apps/web/src/
  styles/
    tokens.css        ← design tokens centralizados
    components.css    ← primitivas globales
  app/
    app.ts/.html/.css/.routes.ts/.config.ts
    nav-items.ts
    core/
      auth-api.ts
      session.ts
      navigation.ts
      leads-api.ts
      health.ts
    shell/
      layout.ts/.html/.css
      auth.guard.ts
    features/
      login/
      dashboard/
      leads/
      research/
      strategy/
      acquisition/
      crm/
      analytics/
      system-status/
```

### Estado de las pantallas

* **Login** (`/entrar`): completo visualmente, honesto sobre el estado del backend (Hito 2), sin `@angular/forms`, con sesión de demostración doble-candado.
* **Dashboard** (`/panel`): estructura visual, datos estáticos/marcados como vacíos, basado en módulos del ciclo comercial.
* **Leads** (`/leads`): única pantalla con datos reales del backend; consume `GET /api/v1/leads` vía `LeadsApi`. Es la landing por defecto hoy (`INICIO = '/leads'`).
* **Research / Strategy / Acquisition / CRM / Analytics**: solo estructura visual con cards vacías y tags `Vacío`.
* **System Status** (`/sistema`): datos reales de `/health/live` y `/health/ready`.

### Buenas prácticas ya presentes

* Uso masivo de **Angular Signals** (zoneless).
* Lazy loading de rutas vía `loadComponent`.
* Separación de shell como ruta padre para permitir `/entrar` fuera del layout.
* Design tokens centralizados en `tokens.css`.
* Primitivas compartidas en `components.css`.
* A11y: skip-link, focus visible, ARIA, `aria-describedby`, contrastes medidos.
* Tests unitarios extensos (auth, session, leads, login, rutas, shell, system-status).

---

## 2. CURRENT ROUTES

| Ruta | Componente | Estado |
|---|---|---|
| `/entrar` | `Login` | Funcional (sin backend real) |
| `/` | redirect → `/panel` |  |
| `/panel` | `Dashboard` | Estructura visual vacía |
| `/leads` | `Leads` | Con datos reales |
| `/investigacion` | `Research` | Vacía |
| `/estrategia` | `Strategy` | Vacía |
| `/adquisicion` | `Acquisition` | Vacía |
| `/ventas` | `Crm` | Vacía |
| `/aprendizaje` | `Analytics` | Vacía |
| `/sistema` | `SystemStatus` | Con datos reales |
| `**` | redirect → `/leads` |  |

Observaciones:

* Las rutas reflejan la **estructura interna del ciclo comercial** (Investigación → Estrategia → Adquisición → Ventas → Aprendizaje), no los modelos mentales del usuario.
* No existe una sección de **AI Center** ni de **Settings**.
* No hay sub-rutas dentro de cada feature.

---

## 3. CURRENT COMPONENT ARCHITECTURE

* **Standalone components** en todas las features.
* Cada feature es un único componente monolítico: `dashboard.ts`, `research.ts`, etc.
* No hay sub-componentes especializados de dominio (`CampaignCard`, `MetricCard`, `AIRecommendation`, etc.).
* No existe una carpeta `shared/` ni `ui/` aún: las primitivas están en CSS global (`components.css`).
* `nav-items.ts` centraliza ítems + iconos SVG inline, con 14 etapas del flujo.
* `core/` contiene solo servicios de acceso a API, no estado de UI ni componentes.
* `shell/` contiene `Layout`, `authGuard`.

Duplicaciones detectadas:

* Cada feature vacía (`research`, `strategy`, `acquisition`, `crm`, `analytics`) repite el mismo patrón de `module-header` + `module-grid` + `module-card` + `origin`.
* La lógica de mapeo de estados/tonos se repite entre `leads.ts` y `system-status.ts` (`Tone`, `StatusView`).
* Iconos SVG inline se repiten en `nav-items.ts` y en cada feature vacía.

---

## 4. CURRENT STATE MANAGEMENT

* **Sin NgRx, Redux ni store externo.**
* Estado local en cada componente con `signal()` y `computed()`.
* `SessionService` (`core/session.ts`) actúa como state global:
  * `#accessToken` privado,
  * `#identity`, `#origin`, `#status` signals,
  * `authorizationHeader()` para futuros servicios,
  * `ensureRestored()` idempotente usado por el guard.
* `AuthApi`, `LeadsApi`, `HealthService` son thin clients HTTP con shape-checking manual (sin Zod en bundle, intencional).
* No hay un servicio de **navegación contextual**, **notificaciones**, **búsqueda global**, **historial de AI activity**.

---

## 5. CURRENT DESIGN SYSTEM

* **CSS custom properties** centralizadas en `src/styles/tokens.css`:
  * Colores: fondo `#f5f1fa`, superficie `#ffffff`, marca morada `#820ad1`, navegación oscura `#1f0e33`, estados ok/warn/bad/idle.
  * Espaciado: escala de 4 (4, 8, 12, 16, 24, 32, 48, 64 px).
  * Radios: 8, 12, 20, 28, 36, pill, circle.
  * Tipografía: system-ui stack, 10px–40px.
  * Sombras: 3 niveles con tinte morado.
* **Primitivas en `components.css`**: `.btn`, `.card`, `.status`, `.tag`, `.badge`, `.table`, `.note`, `.alert`, `.problem`, `.stat`, `.module-card`, `.module-header`, `.origin`, `.field`, `.nav-icon`, etc.
* Sin sistema tipográfico formal de Display/Heading/Title/Body/Caption/Label.
* Sin componentes Angular encapsulados; todo es CSS + HTML en plantillas.
* No hay tokens para **motion** más allá de `--t-fast` y `--t-base`.
* Sin componentes de skeleton, empty state reusable, chart, drawer, modal, tabs, dropdown, command-palette.

---

## 6. UX PROBLEMS

### Navegación basada en estructura interna, no modelos mentales

* Los grupos del sidebar son: General, Investigación, Estrategia, Adquisición, Ventas, Aprendizaje, Sistema.
* Un usuario no piensa "quiero ir a Investigación", piensa "quiero saber qué producto vender" o "quiero lanzar una campaña".

### Demasiados ítems pendientes visibles

* `nav-items.ts` muestra 14 etapas, muchas con tag "pendiente" y sin ruta. Crea ruido cognitivo y reduce la confianza en el menú.

### Dashboard no es un "Business Overview"

* La Home actual (`/panel`) lista "Módulos del ciclo comercial" como cards vacías con guiones.
* No responde a: ¿cómo va el negocio?, ¿qué necesita mi atención?, ¿qué dice la IA?
* Los KPIs son estáticos y genéricos.

### Pantallas vacías repetitivas

* 5 features comparten el mismo patrón " Vacío / Próximamente " sin acciones.
* No hay empty states accionables según el documento de reestructuración.

### Falta de acciones contextuales

* En Leads, la única acción visible es "Volver a consultar".
* No hay "contactar", "cualificar", "convertir", "asignar".
* En dashboard, no hay acciones rápidas orientadas a objetivos.

### No hay presencia visible de IA

* No existe AI Center.
* No hay tarjetas de recomendación con WHAT/WHY/CONFIDENCE/DATA/ACTION.
* No hay AI Activity feed.

### Perfil y notificaciones ausentes

* Topbar solo muestra "Uso interno" y una nota de `noindex`.
* No hay acceso a perfil, workspace, notificaciones, configuración.

### Settings no existe

* No hay ruta ni sección de configuración.

### Tables como presentación dominante

* Leads es una tabla plana; es funcional pero no ayuda a priorizar.
* No hay vistas alternativas (cards, pipeline, kanban).

### Responsive limitado

* El sidebar se oculta en < 900px con un botón "Menú".
* No hay bottom nav ni command palette para mobile.
* Las tablas usan scroll horizontal, aceptable pero no ideal.

---

## 7. TECHNICAL DEBT

* **Componentes monolíticos**: cada feature debería dividirse en sub-componentes.
* **CSS global creciente**: `components.css` ya tiene ~900 líneas. Es correcto para primitivas, pero falta encapsular componentes de dominio en Angular.
* **No hay `OnPush` explícito**: aunque zoneless hace que todo sea OnPush implícitamente, conviene documentar la estrategia.
* **Duplicación de iconos SVG**: centralizar en un `IconComponent` o sprite.
* **Duplicación de tipos `Tone`/`StatusView`**: extraer a `shared/types/ui.ts`.
* **No hay manejo de permisos en UI**: `SessionService` trae `permissions` pero nadie los usa aún.
* **Tests de features vacías inexistentes**: `research.spec.ts`, `strategy.spec.ts`, etc. no existen.
* **No hay DTOs de frontend** para transformar contratos a view-models: `leads.ts` mezcla vista y mapeo.
* **Rutas en español** (`/investigacion`, `/ventas`) complican futura internacionalización; no es urgente pero es deuda.
* **`@angular/cdk` sin usar**: podría aportar a11y (FocusTrap, LiveAnnouncer, Overlay), virtual scroll, drag-drop.
* **No hay interceptores HTTP** para refresh automático ni manejo centralizado de 401.
* **No hay charts**: cuando Analytics requiera gráficos, se necesitará una librería ligera (ej. `@observablehq/plot` o una solución SVG propia).
* **No hay command palette / búsqueda global**: requiere índice de entidades y debounce.

---

## 8. TARGET INFORMATION ARCHITECTURE

Reorganizar la navegación principal en **6 áreas mentales**, con sub-navegación contextual.

| Área | Sub-secciones | Basado en lo que existe |
|---|---|---|
| **Home** | Business Overview | Renombrar/rewrite de `Dashboard` |
| **Growth** | Overview, Campaigns, Ads, Creatives, Audiences, Experiments, Content, SEO | Nuevo; parcialmente `Acquisition` + `Strategy` + `Research` |
| **Sales** | Leads, Customers, Opportunities, Pipeline, Orders, Follow-ups | `Leads` + `Crm` |
| **Products** | Products, Product Discovery, Market Research, Product Score, Competitors, Trends | Nuevo; parcialmente `Research` |
| **AI** | Agents, Tasks, Recommendations, Activity, Automations, Usage, Costs | Nuevo |
| **Analytics** | Revenue, Profit, Conversion, CAC, CPA, ROAS, ROI, AOV, LTV | `Analytics` actual |
| **Settings** | Workspace, Users, Permissions, Integrations, AI Providers, Notifications, Branding | Nuevo |

Rutas propuestas (manteniendo las actuales donde existen datos reales):

```
/                     → /home
/home                 → Home (reemplaza /panel)
/growth               → Growth overview
/growth/campaigns     → Campañas
/growth/ads
/growth/creatives
/growth/audiences
/growth/experiments
/growth/content
/growth/seo
/sales                → Sales overview
/sales/leads          → Leads (reemplaza /leads)
/sales/customers
/sales/opportunities
/sales/pipeline
/sales/orders
/sales/follow-ups
/products             → Products overview
/products/discovery
/products/score
/products/competitors
/products/trends
/ai                   → AI Center overview
/ai/agents
/ai/tasks
/ai/recommendations
/ai/activity
/ai/automations
/ai/usage
/analytics            → Analytics overview (reemplaza /aprendizaje)
/analytics/revenue
/analytics/profit
/settings             → Settings
/settings/workspace
/settings/users
/settings/integrations
/settings/ai-providers
/entrar               → Login (sin cambio)
/sistema              → System Status (mantener; mover a Settings o AI si aplica)
```

Migración de rutas existentes:

* `/panel` → redirect a `/home`
* `/leads` → redirect a `/sales/leads`
* `/adquisicion` → redirect a `/growth`
* `/investigacion` → redirect a `/products/discovery` (o `/products`)
* `/estrategia` → redirect a `/growth`
* `/ventas` → redirect a `/sales`
* `/aprendizaje` → redirect a `/analytics`

---

## 9. TARGET APP SHELL

### Desktop

* **Top navigation híbrida** en lugar de sidebar permanente:
  * Barra superior fija con: Brand / Search global / Main nav (Home, Growth, Sales, Products, AI, Analytics) / Notifications / User menu.
  * Sidebar colapsable solo cuando una sección lo requiera (ej. Settings con muchas opciones).
* Área de contenido amplia, sin topbar informativo `noindex` visible permanentemente (puede ir en footer o meta).

### Mobile

* **Bottom navigation** con 5 ítems principales: Home, Growth, Sales, AI, Analytics.
* Products accesible desde Home/Growth o menú "More".
* Drawer para notificaciones y perfil.
* Search como primera acción en top bar.

### Elementos globales

* Skip-link persistente.
* Toast/notification center (no spam; priorizado: Critical, Action required, Insights, System).
* User menu: Profile, Workspace, Settings, Notifications, AI activity, Logout.
* Command palette (opt-in; MVP: búsqueda simple de entidades).

---

## 10. TARGET DESIGN SYSTEM

### Tokens a añadir/refinar

```css
/* Color refinado: identidad propia, no copiar purple de Nubank */
--color-primary: #4f46e5;        /* indigo premium */
--color-primary-hover: #4338ca;
--color-primary-soft: #eef2ff;
--color-background: #fafafa;      /* neutro, no tintado */
--color-surface: #ffffff;
--color-surface-elevated: #ffffff;
--color-surface-sunken: #f3f4f6;
--color-border: #e5e7eb;
--color-border-strong: #d1d5db;
--color-text: #111827;
--color-text-secondary: #4b5563;
--color-text-tertiary: #6b7280;
--color-success: #10b981;
--color-warning: #f59e0b;
--color-danger: #ef4444;
--color-info: #3b82f6;

/* Spacing */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
--space-7: 48px;
--space-8: 64px;

/* Typography */
--font-sans: 'Inter', system-ui, sans-serif;  /* optar por webfont */
--font-mono: ui-monospace, monospace;
--font-display: ... ;  /* para números grandes */

--text-2xs: 10px;
--text-xs: 12px;
--text-sm: 14px;
--text-base: 16px;
--text-lg: 18px;
--text-xl: 20px;
--text-2xl: 24px;
--text-3xl: 30px;
--text-4xl: 36px;
--text-5xl: 48px;

/* Radius */
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 16px;
--radius-xl: 24px;
--radius-2xl: 32px;
--radius-full: 999px;

/* Shadows sutiles */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
--shadow-md: 0 4px 12px rgba(0,0,0,0.06);
--shadow-lg: 0 12px 32px rgba(0,0,0,0.08);

/* Motion */
--duration-fast: 120ms;
--duration-base: 200ms;
--duration-slow: 300ms;
--ease: cubic-bezier(0.4, 0, 0.2, 1);
```

### Componentes globales (`ui/`)

```
ui/
  button/
  card/
  badge/
  avatar/
  metric/
  stat/
  chart/
  table/
  modal/
  drawer/
  dropdown/
  tabs/
  empty-state/
  loading-state/
  skeleton/
  notification/
  command-palette/
  ai-recommendation/
  ai-activity/
  search/
```

### Componentes de dominio (`features/*/components/`)

```
features/shared/  (o domain/)
  campaign-card/
  product-opportunity-card/
  lead-card/
  ai-recommendation/
  metric-card/
  campaign-performance/
  product-score/
  ai-activity/
  sales-pipeline/
```

---

## 11. MIGRATION PLAN

### Fase 0 — Fundamentos (no tocar features aún)

1. **Auditoría completada** (este documento).
2. **Tests de regresión**: asegurar que `app.routes.spec.ts`, `auth.guard.spec.ts`, `layout.spec.ts`, `session.spec.ts`, `login.spec.ts`, `leads.spec.ts`, `system-status.spec.ts` pasen antes de mover nada.
3. **Refinar design tokens** en `tokens.css` y crear componentes `ui/*` encapsulados.
4. **Crear `ui/icon`** para centralizar SVGs y eliminar duplicación.
5. **Crear primitivas de estado**: `SkeletonComponent`, `EmptyStateComponent`, `LoadingStateComponent`, `ErrorStateComponent`.
6. **Crear `ui/metric-card`**, `ui/badge`, `ui/button` como Angular components con inputs/outputs.

### Fase 1 — App Shell y Navegación

1. Crear nuevo `shell/layout` con top nav híbrida y bottom nav mobile.
2. Reemplazar `nav-items.ts` por modelo mental: Home, Growth, Sales, Products, AI, Analytics, Settings.
3. Actualizar rutas en `app.routes.ts` con redirects desde las rutas viejas.
4. Actualizar `app.routes.spec.ts` y `layout.spec.ts`.
5. Crear `core/notifications.ts` (mock inicial, sin backend).

### Fase 2 — Home (Business Overview) ✅ Completada

1. ✅ Reescribir `features/dashboard` → `features/home`.
2. ✅ Diseñar jerarquía:
   * Saludo + métrica principal (lead count real como proxy hasta revenue).
   * Sección "Attention": anomalías y acciones requeridas (sistema / leads).
   * Sección "AI Recommendations": 2 cards con WHAT/WHY/CONFIDENCE/ACTION, etiquetadas `Demo`.
   * Sección "Performance": grid de 4 métricas secundarias.
   * Sección "Active Work": leads recientes, campañas, AI tasks.
3. ✅ Conectar con `HealthService` y `LeadsApi` para datos reales disponibles.
4. ✅ Usar skeletons mientras carga.
5. ✅ Añadir tests `home.spec.ts`.
6. ✅ Documentar `FRONTEND DATA GAP` en el componente y en la UI.
7. ✅ Promover primitivas reutilizables a `components.css` (`metric-grid`, `dashboard-grid`, `attention-card`, `lead-list`, `origin-box`, etc.) para respetar el budget `anyComponentStyle`.

### Fase 3 — Products ✅ Completada

1. ✅ Reescribir `features/products` como Product Intelligence overview.
2. ✅ Diseñar pipeline mental: Discover → Analyze → Score → Select → Sell.
3. ✅ Crear `ProductScoreComponent` (score 0–100 con nivel Alta/Media/Baja y barra accesible).
4. ✅ Crear `ProductOpportunityCardComponent` con métricas de demanda, competencia, margen, tendencia, insight AI y acciones contextuales.
5. ✅ Datos de oportunidades de demostración etiquetados con `Demo` y nota explicativa.
6. ✅ Empty states accionables para tendencias y competidores.
7. ✅ Documentar `FRONTEND DATA GAP` en la UI y en el componente.
8. ✅ Añadir primitivas `.section-title--sm` a `components.css`.
9. ✅ Tests `product-score.spec.ts`, `product-opportunity-card.spec.ts`, `products.spec.ts`.

### Fase 4 — Growth ✅ Completada

1. ✅ Reescribir `features/growth` como ecosistema de crecimiento.
2. ✅ Diseñar pipeline mental: Atraer → Enganchar → Convertir → Retener → Optimizar.
3. ✅ Crear `CampaignCardComponent` con estado, métricas, ROAS, CTR y barra de gasto.
4. ✅ Crear `CreativeCardComponent` con formato, impresiones y CTR.
5. ✅ Crear `AudienceListComponent` con tamaño, conversión y canal.
6. ✅ Crear `ExperimentListComponent` con variantes, estado y lift del ganador.
7. ✅ Datos de campañas, creativos, audiencias y experimentos de demostración etiquetados con `Demo`.
8. ✅ Empty state accionable para SEO y contenido.
9. ✅ Añadir iconos `flask` y `target`; tokens `--color-success` y `--color-success-soft`.
10. ✅ Documentar `FRONTEND DATA GAP` en la UI y en el componente.
11. ✅ Tests `campaign-card.spec.ts`, `creative-card.spec.ts`, `audience-list.spec.ts`, `experiment-list.spec.ts`, `growth.spec.ts`.

### Fase 5 — Sales / CRM ✅ Completada

1. ✅ Reescribir `features/sales` como centro comercial.
2. ✅ Conectar con `LeadsApi` para datos reales de leads, conteos y tasa de respuesta.
3. ✅ Diseñar pipeline visual: Nuevo → Contactado → Cualificado → Propuesta → Cerrado.
4. ✅ Crear `LeadCardComponent` con acciones contextuales: contactar, cualificar, convertir, archivar.
5. ✅ Crear `OpportunityCardComponent` con valor, probabilidad, etapa y próxima acción.
6. ✅ Crear `CustomerCardComponent` con LTV, último contacto y salud de relación.
7. ✅ Crear `FollowUpListComponent` para tareas de seguimiento.
8. ✅ Datos de pipeline, oportunidades, clientes y seguimientos de demostración etiquetados con `Demo`.
9. ✅ Empty state para órdenes/pedidos.
10. ✅ Añadir iconos `phone`, `mail`, `checkCircle`, `clock`, `money`, `calendar`.
11. ✅ Documentar `FRONTEND DATA GAP` en la UI y en el componente.
12. ✅ Tests `lead-card.spec.ts`, `opportunity-card.spec.ts`, `customer-card.spec.ts`, `follow-up-list.spec.ts`, `sales.spec.ts`.

Nota: `/leads` se mantiene activo como ruta legado con datos reales; la reubicación física a `features/sales/leads` queda para la Fase 9 (Polish) si se aprueba deprecar la ruta vieja.

### Fase 6 — AI Center ✅ Completada

1. ✅ Reescribir `features/ai` como centro de inteligencia artificial.
2. ✅ Crear `AiRecommendationCardComponent` con estructura WHAT/WHY/CONFIDENCE/ACTION.
3. ✅ Crear `AiActivityItemComponent` para eventos de agentes (insight, tarea, automatización, alerta).
4. ✅ Crear `AgentCardComponent` con estado, tareas y tasa de éxito.
5. ✅ Datos de recomendaciones, actividad y agentes de demostración etiquetados con `Demo`.
6. ✅ Empty state para uso y costos.
7. ✅ Documentar `FRONTEND DATA GAP` en la UI y en el componente.
8. ✅ Tests `ai-recommendation-card.spec.ts`, `ai-activity-item.spec.ts`, `agent-card.spec.ts`, `ai.spec.ts`.

### Fase 7 — Analytics ✅ Completada

1. ✅ Reescribir `features/analytics` como centro de inteligencia comercial.
2. ✅ Diseñar period selector, funnel de conversión, rendimiento por canal, cohortes de retención y atribución.
3. ✅ Crear `MetricTrendCardComponent` con valor, comparación y tendencia (up/down/flat).
4. ✅ Crear `ChannelPerformanceTableComponent` con spend, leads, customers, revenue y ROAS.
5. ✅ Crear `CohortGridComponent` para retención semanal por cohorte.
6. ✅ Datos de tendencias, canales y cohortes de demostración etiquetados con `Demo`.
7. ✅ Empty state para atribución (backend no expone modelo de atribución aún).
8. ✅ Añadir icono `download` para acción de exportar.
9. ✅ Documentar `FRONTEND DATA GAP` en la UI y en el componente.
10. ✅ Tests `metric-trend-card.spec.ts`, `channel-performance-table.spec.ts`, `cohort-grid.spec.ts`, `analytics.spec.ts`.

### Fase 8 — Settings ✅ Completada

1. ✅ Reescribir `features/settings` como centro de configuración del workspace.
2. ✅ Crear `SettingsCardComponent` con icono, título, descripción, estado y acciones contextuales.
3. ✅ Diseñar secciones: Workspace, Usuarios y permisos, Integraciones, Proveedores de IA, Notificaciones, Seguridad.
4. ✅ Datos de demostración con badge `Configuración` y nota `FRONTEND DATA GAP`.
5. ✅ Empty state accionable para facturación/suscripción.
6. ✅ Añadir icono `users` al catálogo central.
7. ✅ Tests `settings-card.spec.ts`, `settings.spec.ts`.

### Fase 9 — Polish

1. Refinar motion design.
2. Mejorar responsive y mobile-first.
3. Virtual scroll en listas grandes.
4. Accessibility audit.
5. Performance budgets (ya configurados en `angular.json`).
6. Limpiar redirects y deprecar rutas viejas si el usuario lo aprueba.

---

## 12. PRIORITY ORDER

| Orden | Tarea | Por qué primero |
|---|---|---|
| 1 | Design System (tokens + ui primitives) | Todo lo demás se construye encima |
| 2 | App Shell + Navigation | Define la arquitectura visual global |
| 3 | Home / Business Overview | Es la primera impresión del producto |
| 4 | Products | Muestra el nuevo modelo mental "Discover → Sell" |
| 5 | Growth | Conecta con campañas reales futuras |
| 6 | Sales / CRM | Protege y mejora la única feature con datos reales |
| 7 | AI Center | Diferenciador del producto |
| 8 | Analytics | Profundiza en datos |
| 9 | Settings | Necesario pero no crítico para el MVP visual |

---

## 13. FIRST IMPLEMENTATION TASK

### Tarea: "Design System Foundation + New App Shell"

Entregables:

1. **Refactor de `tokens.css`**:
   * Renombrar/adaptar tokens al nuevo lenguaje visual premium (ver sección 10).
   * Mantener compatibilidad temporal con tokens antiguos para no romper features existentes.
   * Documentar cada token en `docs/design-system.md`.

2. **Crear componentes base en `app/ui/`**:
   * `ui/icon` — iconos SVG parametrizables desde un catálogo central.
   * `ui/button` — variantes: primary, secondary, ghost, danger, sizes.
   * `ui/card` — contenedor con slots.
   * `ui/badge` — variantes de estado.
   * `ui/metric` — label + value + trend.
   * `ui/skeleton` — block/text/circle.
   * `ui/empty-state` — title + text + action.
   * `ui/loading-state`.
   * `ui/error-state`.

3. **Nuevo `shell/layout`**:
   * Top nav híbrida con: brand, search, main nav (Home, Growth, Sales, Products, AI, Analytics), notifications, user menu.
   * Bottom nav para mobile.
   * Drawer para notificaciones.
   * Mantener skip-link y ARIA.

4. **Actualizar `app.routes.ts`**:
   * Añadir `/home` que reemplace `/panel`.
   * Añadir redirects: `/panel` → `/home`, `/leads` → `/sales/leads` (temporalmente), `/adquisicion` → `/growth`, etc.
   * Mantener `/entrar` fuera del shell.

5. **Tests actualizados**:
   * `app.routes.spec.ts` para nuevas rutas.
   * `layout.spec.ts` para nuevo shell.
   * Tests para cada nuevo componente `ui/*`.

### Criterios de aceptación de la primera tarea

* `corepack pnpm --filter @crm/web test` pasa.
* `corepack pnpm --filter @crm/web typecheck` pasa.
* Build de producción dentro de budgets (`initial < 500 kB`, `anyComponentStyle < 4 kB`).
* Navegación desktop y mobile funcionan.
* No se rompe `/entrar`, `/leads` ni `/sistema`.
* No se modifica backend.

---

## Notas

* Todo el trabajo será incremental; cada fase mantiene funcionalidad existente.
* Cada cambio de API requerirá un `FRONTEND DATA GAP` documentado antes de tocar backend.
* No se clona Nubank: solo se aplican principios (simplicidad, jerarquía, acciones rápidas, progressive disclosure, mobile-first).
