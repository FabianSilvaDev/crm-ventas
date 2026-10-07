# Frontend Restructure Plan

> **AI Acquisition & Growth Control Center**
>
> Audit completo del frontend de `apps/web` y plan de migración para transformar el CRM administrativo en un centro de control de adquisición y crecimiento asistido por IA. No se reconstruye backend; solo se reorganiza, consolida y da coherencia a la capa de presentación.
>
> - Ámbito: `apps/web`
> - Stack: Angular 22 · zoneless change detection · signals · ESM
> - Estado: **Pendiente de aprobación**
> - Generado para revisión antes de implementar

---

## Contenido

1. [Current Frontend Audit](#1-current-frontend-audit)
2. [Current Architecture](#2-current-architecture)
3. [Current Routes](#3-current-routes)
4. [Current Components](#4-current-components)
5. [Current State Management](#5-current-state-management)
6. [Current API Integration](#6-current-api-integration)
7. [Current Design System](#7-current-design-system)
8. [UX Problems](#8-ux-problems)
9. [Technical Debt](#9-technical-debt)
10. [Target Architecture](#10-target-architecture)
11. [Target Navigation](#11-target-navigation)
12. [Acquisition Journey](#12-acquisition-journey)
13. [Agent-to-Frontend Mapping](#13-agent-to-frontend-mapping)
14. [Design System](#14-design-system)
15. [Migration Plan](#15-migration-plan)
16. [First Sprint](#16-first-sprint)

---

## 1. Current Frontend Audit

El frontend ya ha sido parcialmente modernizado. Existe un shell responsive, un design system basado en tokens CSS, componentes UI primitivos y una navegación orientada a modelos mentales. Sin embargo, la mayoría de las pantallas de negocio aún muestran datos de demostración o secciones vacías documentadas como `FRONTEND DATA GAP`. El backend permanece intacto y no se inventarán APIs.

### Lo que ya funciona

- Shell con topbar, navegación principal, bottom nav en móvil, drawers de "Más" y búsqueda.
- Autenticación real con access token en memoria y refresh en cookie `HttpOnly`.
- Leads reales desde `/api/v1/leads`.
- Health checks reales.
- Design system con tokens, foco visible, alto contraste y `prefers-reduced-motion`.

### Lo que aún es simulado

Revenue, órdenes, ROAS, pipelines de ventas, campañas, creativos, audiencias, experimentos, recomendaciones de IA, actividad de agentes, funnel, cohortes, atribución, configuraciones de workspace e integraciones. Todo está etiquetado como demo o gap.

### Estado por área funcional

| Área | Ruta | Datos | Observación |
|------|------|-------|-------------|
| Home | `/home` | `reales` leads, health | Mix real/demo. Métricas financieras y tareas AI simuladas. |
| Leads | `/leads` | `reales` | Lista completa con estados, canales, consentimiento y enlaces. |
| Sales | `/sales` | `demo` | Leads reales, pero pipeline, clientes, órdenes y seguimientos son mock. |
| Products | `/products` | `demo` | Oportunidades de producto con scoring simulado. |
| Growth | `/growth` | `demo` | Campañas, creativos, audiencias y experimentos simulados; SEO vacío. |
| AI | `/ai` | `gap` | Recomendaciones y agentes demo; costos y automatizaciones vacíos. |
| Analytics | `/analytics` | `demo` | Métricas, funnel y canales demo; atribución y export vacíos. |
| Settings | `/settings`, `/settings/users` | `gap` | Secciones estáticas; usuarios real pero resto de gaps. |
| System Status | `/sistema` | `reales` | Tabla de dependencias reales desde `/health`. |

---

## 2. Current Architecture

El frontend es una SPA Angular 22 dentro del monorepo `crm-ventas`. Usa componentes standalone, carga perezosa por ruta y change detection sin zonas. No hay NgRx ni otro store global: el estado vive en servicios inyectables con `signal()`.

### Capas actuales

1. **Shell** (`app/shell/layout.ts`): layout global, navegación desktop/mobile, drawers, menú de usuario y banner de demo.
2. **Core** (`app/core/`): servicios de autenticación, sesión, leads y health. Aquí vive el patrón de respuesta `ok | problem | unreachable`.
3. **Features** (`app/features/`): una carpeta por módulo mental (home, sales, products, growth, ai, analytics, settings, leads, system-status).
4. **UI primitives** (`app/ui/`): componentes reutilizables mínimos (button, card, badge, icon, metric) exportados desde `index.ts`.
5. **Styles** (`src/styles/`): tokens CSS y primitivas globales compartidas entre pantallas.
6. **Contracts** (`@crm/contracts`): tipos compartidos; se usa solo como referencia de tipos para no arrastrar Zod al bundle.

### Decisiones arquitectónicas vigentes

- Standalone components y `loadComponent` en rutas.
- Access token solo en memoria; refresh token en cookie `__Host-crm_rt`.
- Validación de formularios manual para evitar dependencias pesadas.
- Respuestas API modeladas con tres desenlaces: `ok`, `problem`, `unreachable`.

---

## 3. Current Routes

Las rutas activas reflejan la nueva navegación mental. Aún existen rutas legacy redirigidas hacia las nuevas pantallas y componentes antiguos vacíos que no se borraron.

| Ruta | Componente | Estado | Notas |
|------|------------|--------|-------|
| `/setup` | `setup.ts` | activo | Configuración inicial de workspace. |
| `/entrar` | `login.ts` | activo | Acceso con email/contraseña; refresh en cookie. |
| `/home` | `features/home/home.ts` | activo/demo | Centro de control parcial. |
| `/growth` | `features/growth/growth.ts` | activo/demo | Pipeline de crecimiento con datos simulados. |
| `/sales` | `features/sales/sales.ts` | activo/demo | Pipeline comercial con datos simulados. |
| `/products` | `features/products/products.ts` | activo/demo | Descubrimiento de oportunidades de producto. |
| `/ai` | `features/ai/ai.ts` | activo/gap | Copiloto de IA con recomendaciones estáticas. |
| `/analytics` | `features/analytics/analytics.ts` | activo/demo | Dashboard analítico con datos simulados. |
| `/settings`, `/settings/users` | `features/settings/settings.ts` | activo/gap | Configuración estática excepto usuarios. |
| `/leads` | `features/leads/leads.ts` | activo | Listado de leads con datos reales. |
| `/sistema` | `features/system-status/system-status.ts` | activo | Estado de servicios reales. |
| `/dashboard`, `/research`, `/strategy`, `/acquisition`, `/crm` | — | legacy redirect | Redirigen a `/home`, `/products`, `/growth`, `/sales` o `/analytics`. |

---

## 4. Current Components

Hay dos familias de componentes: primitivas globales reutilizables y componentes de feature que suelen mezclar presentación con datos demo.

### UI primitives

| Componente | Archivo | Uso |
|------------|---------|-----|
| Button | `ui/button.ts` | Acciones primarias, secundarias y de icono. |
| Card | `ui/card/card.ts` | Contenedores elevados de contenido. |
| Badge | `ui/badge.ts` | Etiquetas de contexto como "Uso interno". |
| Icon | `ui/icon.ts` | SVG inline con selectores configurables. |
| Metric | `ui/metric.ts` | Cifra grande + etiqueta. |

### Componentes de feature

- `features/home/home.ts`: centro de control con métricas, recomendaciones AI, trabajo activo y leads recientes.
- `features/products/products.ts`: pipeline Discover → Analyze → Score → Select → Sell.
- `features/growth/growth.ts`: pipeline Atraer → Enganchar → Convertir → Retener → Optimizar.
- `features/sales/sales.ts`: leads, pipeline, oportunidades, clientes, seguimientos y órdenes.
- `features/ai/ai.ts`: recomendaciones, agentes, actividad y uso/costos.
- `features/analytics/analytics.ts`: métricas, funnel, canales, cohortes y atribución.
- `features/settings/settings.ts`: workspace, usuarios, integraciones, proveedores IA, notificaciones, seguridad.

### Componentes legacy

Existen componentes vacíos o estáticos en `features/dashboard/`, `research.ts`, `strategy.ts`, `acquisition.ts` y `crm.ts`. Deben eliminarse una vez consolidadas las redirecciones.

---

## 5. Current State Management

La aplicación usa `signal()` como primitiva de estado obligatoria. No hay store central; cada servicio expone signals privadas y computadas públicas. Eso funciona para el alcance actual, pero dificulta compartir el estado del *Acquisition Journey* entre Home, Growth, Sales, Products y AI.

### Servicios con estado real

- `core/session.ts`: usuario, demo mode, token de acceso en memoria, lógica de refresh.
- `core/auth-api.ts`: estado de login/signup/recover y manejo de `Retry-After`.
- `core/leads-api.ts`: lista de leads y estado de carga/error.
- `core/health.ts`: probes de live/ready.

### Servicios de estado simulado

Cada feature page declara su propio mock inline: oportunidades de producto, campañas, recomendaciones, funnel, etc. Esto genera duplicación y hace imposible mantener coherencia narrativa entre Home y el resto del journey.

---

## 6. Current API Integration

La integración con backend sigue un patrón propio de tres desenlaces. La validación es superficial y manual para no incluir Zod en el bundle del frontend.

### Clientes existentes

| Cliente | Endpoint | Uso |
|---------|----------|-----|
| `auth-api.ts` | `/api/v1/auth/*` | Login, signup, recover, refresh, logout. |
| `leads-api.ts` | `/api/v1/leads` | Listado paginado de leads. |
| `health.ts` | `/health/live`, `/health/ready` | Estado del sistema y dependencias. |

### Patrones vigentes

- **ok**: respuesta exitosa con datos tipados.
- **problem**: error estructurado RFC 9457 con `title`, `code`, `detail`, `traceId`.
- **unreachable**: backend no disponible; se muestra UI de estado caído.

---

## 7. Current Design System

El design system está documentado en `docs/design-system.md` e implementado a través de `styles/tokens.css` y `styles/components.css`. La base es sólida: tokens semánticos, primitivas globales, foco visible, alto contraste forzado y respeto a `prefers-reduced-motion`.

### Hallazgos de auditoría

#### Inconsistencia de tokens

`styles/components.css` mezcla dos sistemas de tokens. En la sección "Primitivas de navegación y paneles" y "Business Overview/Dashboard" aparecen tokens antiguos como `--space-2`, `--radius-md`, `--color-primary` y `--color-text-secondary`, que no existen en `tokens.css` (donde el namespace es `--s-*`, `--r-*`, `--c-*`). Esto puede provocar visual bugs silenciosos.

#### Doble definición de `.metric-grid`

La clase `.metric-grid` se define dos veces en `components.css` con reglas distintas (`auto-fit minmax(180px,1fr)` vs. `2 columns fixed`). La segunda definición puede anular intencionalmente la primera o generar cascadas impredecibles.

### Fortalezas

- No se usa Tailwind ni librerías de componentes con estilos propios.
- Separación por elevación en lugar de bordes.
- El color de marca se usa con moderación.
- Reglas de accesibilidad explícitas (`:focus-visible`, `forced-colors`, `prefers-reduced-motion`).

---

## 8. UX Problems

La experiencia actual funciona como un conjunto de pantallas aisladas en lugar ofrecer un flujo de adquisición continuo. Esto contradice el modelo mental del "AI Acquisition & Growth Control Center".

- **Datos demo sin distinción clara**: aunque muchas pantallas declaran el origen de los datos, las recomendaciones AI y las métricas simuladas no siempre se presentan como acciones pendientes de aprobación.
- **No hay centro de control unificado**: Home muestra un resumen, pero no conecta visualmente las fases del journey ni indica dónde requiere intervención humana.
- **Human-in-the-loop invisible**: el patrón AI recommend → user review → user approve → system execute no tiene una representación UI coherente.
- **AI como catálogo estático**: la pantalla `/ai` lista agentes y recomendaciones, pero no actúa como copiloto contextual dentro de Sales, Growth o Products.
- **Navegación deprecada residual**: `nav-items.ts` aún conserva `NAV_GROUPS` legacy que confunde la estructura mental.
- **Páginas con muchos gaps vacíos**: mostrar secciones enteramente vacías (SEO, usage/costs, attribution, export) sin una acción clara genera la sensación de producto inacabado.

---

## 9. Technical Debt

1. **Tokens CSS duplicados/inconsistentes.** Dos namespaces conviven en `components.css`; hay clases duplicadas.
2. **Componentes legacy sin borrar.** Dashboard, research, strategy, acquisition, crm siguen en el árbol aunque redirigidos.
3. **Rutas legacy.** Las redirecciones resuelven URLs antiguas pero mantienen deuda semántica.
4. **Mocks dispersos.** Datos demo repetidos en cada feature; no hay una fuente única de verdad para el estado del journey.
5. **Falta de modelo de dominio compartido.** No existe un tipo/estado unificado para `Opportunity`, `JourneyStage`, `Recommendation` o `Approval`.
6. **Cobertura de tests desconocida.** Vitest 5 está configurado, pero no se observan tests de los componentes nuevos.

---

## 10. Target Architecture

El objetivo es que el frontend se sienta como un solo centro de control: el usuario llega a Home, ve el estado del ciclo de adquisición, recibe recomendaciones de IA con acciones contextuales, y puede navegar a cualquier fase del journey sin perder el contexto.

### Principios de la arquitectura objetivo

- **Home como centro de gravedad**: todo empieza y vuelve a Home.
- **Journey como lenguaje común**: cada módulo representa una fase del Acquisition Journey.
- **AI como copiloto, no como pantalla aparte**: las recomendaciones aparecen donde se necesitan.
- **Human-in-the-loop visible**: cualquier acción propuesta por IA requiere aprobación explícita.
- **Datos con origen explícito**: real, estimado, inferencia AI o declarado.

### Nuevas capas conceptuales

#### Domain state

Servicios de dominio para `Opportunity`, `JourneyStage`, `Recommendation`, `Campaign`, `Approval`. Viven como signals y se consumen desde cualquier feature.

#### AI presentation layer

Componentes de recomendación, aprobación y actividad de agentes reutilizables en Home, Growth, Sales, Products y AI.

---

## 11. Target Navigation

La navegación se mantiene casi igual en superficie, pero cada ítem adquiere un significado de fase del journey. Se eliminan los grupos deprecados.

| Ítem | Ruta | Rol en el journey |
|------|------|-------------------|
| Home | `/home` | Centro de control y resumen del ciclo. |
| Growth | `/growth` | Atraer, Enganchar, Convertir, Retener, Optimizar. |
| Sales | `/sales` | Pipeline comercial y cierre. |
| Products | `/products` | Discover, Analyze, Score, Select, Sell. |
| AI | `/ai` | Copiloto, agentes, costos y aprobaciones pendientes. |
| Analytics | `/analytics` | Retrospectiva: funnel, canales, cohortes, atribución. |
| Settings | `/settings` | Workspace, usuarios, integraciones, proveedores IA. |

---

## 12. Acquisition Journey

El journey de adquisición es el modelo mental que unifica el producto. Cada fase se mapea a una pantalla o a una acción dentro de una pantalla. El ciclo termina en aprendizaje que alimenta la siguiente iteración.

```text
Opportunity → Intelligence → Validation → Offer → Content → Creative → Landing → Campaign → Sales → Analytics → Optimization → Learning → (Opportunity)
```

### Descripción de fases

| Fase | Responsable principal | Representación en frontend |
|------|----------------------|---------------------------|
| Opportunity | Products / AI product_research | Lista de oportunidades de producto con score. |
| Intelligence | AI marketing_strategy | Resumen de mercado, audiencias y mensajes en Home / AI. |
| Validation | AI + human review | Cards de aprobación con evidencia y acciones. |
| Offer | Sales / Products | Propuesta de valor y pricing en Sales. |
| Content | AI content | Borradores de copy, emails, posts en Growth / AI. |
| Creative | AI creative | Variantes de creativos pendientes de aprobación. |
| Landing | Growth | Páginas de captura y experimentos en Growth. |
| Campaign | Growth | Campañas activas, presupuesto, ROAS. |
| Sales | Sales | Leads, pipeline, oportunidades, órdenes. |
| Analytics | Analytics | Métricas, funnel, canales, cohortes. |
| Optimization | AI + Analytics | Recomendaciones de mejora en Home / AI. |
| Learning | AI + human | Insights del ciclo cerrado que alimentan Opportunity. |

---

## 13. Agent-to-Frontend Mapping

La capa de IA define nueve agentes especializados y un orquestador. A continuación se mapea cada agente a las pantallas que consumirán sus recomendaciones.

| Agente | Entrega al frontend | Pantallas consumidoras | Estado actual |
|--------|--------------------|------------------------|---------------|
| orchestrator | Plan de acción, priorización, resumen | Home, AI | gap |
| product_research | Oportunidades, scoring, demanda, competencia | Products, Home | demo |
| marketing_strategy | Audiencias, mensajes, canales, presupuesto | Growth, AI | demo |
| content | Copy, emails, posts, variantes de mensaje | Growth, AI | gap |
| creative | Variantes creativas, briefs | Growth, AI | gap |
| landing_optimizer | Sugerencias de landing, experimentos | Growth | gap |
| campaign_manager | Campañas, presupuesto, ROAS, alertas | Growth, Analytics | demo |
| sales_assistant | Siguiente acción sobre leads, follow-ups | Sales, Home | gap |
| analytics_insights | Insights, cohortes, atribución | Analytics, AI | demo |

---

## 14. Design System

El design system debe consolidar tokens, eliminar duplicados y extenderse con patrones propios del control center. Se mantiene la filosofía Nubank: simplicidad, jerarquía por elevación, disclosure progresiva y acciones contextuales.

### Acciones de consolidación

1. Elegir un único namespace de tokens y migrar todas las referencias antiguas.
2. Eliminar la doble definición de `.metric-grid` y otras clases duplicadas.
3. Documentar regla de decisión: primitiva global si la necesitan dos o más pantallas.

### Nuevos componentes y patrones

- **Journey-stage card**: muestra el estado de una fase, indicador de atención y acción principal.
- **Recommendation card**: propuesta de IA con contexto, riesgo, evidencia y botones Aprobar / Descartar / Ver más.
- **Approval timeline**: historial de decisiones human-in-the-loop.
- **Data-origin tag**: real / estimado / inferencia IA / declarado.
- **Copiloto ribbon**: barra contextual de IA dentro de Sales, Growth y Products.

---

## 15. Migration Plan

La migración se divide en cinco fases. Cada fase entrega valor de usuario visible y no requiere cambios en el backend. Los datos demo se mantienen documentados hasta que el backend exponga el endpoint correspondiente.

### Fase 0 — Foundation

Consolidar tokens CSS, eliminar componentes legacy, limpiar rutas redirigidas y establecer servicios de dominio vacíos pero tipados.

### Fase 1 — Home Control Center

Transformar `/home` en el centro de gravedad: estado del journey, feed de recomendaciones con aprobación y trabajo activo. **Es el primer sprint.**

### Fase 2 — Journeys

Reestructurar Growth, Sales y Products como pipelines del Acquisition Journey con datos demo coherentes entre sí.

### Fase 3 — AI Copiloto

Introducir copiloto contextual en las pantallas de negocio y mejorar `/ai` como panel de agentes, aprobaciones y costos.

### Fase 4 — Analytics & Polish

Completar Analytics con funnel, atribución y export; pulir responsive, a11y y tests.

### Criterios de éxito generales

- El usuario puede entender el estado del ciclo de adquisición desde Home.
- Toda recomendación de IA muestra su origen y requiere aprobación explícita.
- Ninguna pantalla muestra un gap vacío sin una acción clara de cómo llenarlo.
- El design system tiene un único namespace de tokens y pasa auditoría visual.

---

## 16. First Sprint

El primer sprint convierte `/home` en un centro de control funcional: muestra el estado del Acquisition Journey, presenta recomendaciones de IA con acciones de aprobación y lista el trabajo activo. Todo con datos demo documentados; no se toca backend.

> **Regla de oro del sprint:** no implementar APIs nuevas. Cualquier dato que aún no venga del backend se representa como demo o gap con el tag de origen correspondiente, siguiendo el patrón `FRONTEND DATA GAP`.

### Tareas del sprint

1. **Consolidar design tokens**
   - Elegir namespace `--s-*`, `--r-*`, `--c-*` y migrar todas las referencias antiguas en `components.css`.
   - Eliminar doble definición de `.metric-grid`.
   - Verificar visualmente shell, drawers y bottom nav.

2. **Crear servicios de dominio en `app/domain/`**
   - `journey-store.ts`: signals de `JourneyStage` con estado, indicador de atención y acción.
   - `recommendation-store.ts`: lista de recomendaciones con estados `pending`, `approved`, `dismissed`.
   - `active-work-store.ts`: tareas en curso del ciclo de adquisición.

3. **Implementar cards de estado del journey**
   - Grid de 5-6 fases del journey en Home (Opportunity, Intelligence, Content/Creative, Campaign, Sales, Optimization).
   - Cada card muestra: nombre, estado, contador clave, acción principal.

4. **Implementar feed de recomendaciones AI**
   - Lista de recomendaciones con agente origen, impacto, evidencia breve.
   - Botones Aprobar, Descartar, Ver más.
   - Al aprobar, la recomendación se convierte en trabajo activo.

5. **Implementar panel de trabajo activo**
   - Tareas derivadas de recomendaciones aprobadas o del estado actual del journey.
   - Indicador de progreso y acción contextual.

6. **Origen de datos visible**
   - Cada sección de Home declara si sus datos son reales, demo o gap.
   - Reutilizar componente `DataOrigin` existente.

7. **Tests**
   - Tests unitarios para los stores de dominio con Vitest.
   - Tests de renderizado básico para las nuevas cards de Home.

### Rutas y archivos afectados

- `apps/web/src/app/features/home/home.ts` y `home.html`
- `apps/web/src/app/domain/journey-store.ts` (nuevo)
- `apps/web/src/app/domain/recommendation-store.ts` (nuevo)
- `apps/web/src/app/domain/active-work-store.ts` (nuevo)
- `apps/web/src/app/ui/recommendation-card/` (nuevo)
- `apps/web/src/app/ui/journey-stage-card/` (nuevo)
- `apps/web/src/styles/components.css`

### Criterios de aceptación

- [ ] Home muestra el estado del Acquisition Journey sin salir de la pantalla.
- [ ] El usuario puede aprobar o descartar al menos tres recomendaciones demo.
- [ ] Las recomendaciones aprobadas aparecen en el panel de trabajo activo.
- [ ] Todos los datos demo llevan etiqueta de origen.
- [ ] Los tests de los stores pasan.
- [ ] No se introduce ninguna dependencia nueva ni se toca backend.

### Entregable del sprint

Un PR que transforma `/home` en el centro de control de adquisición, consolidando tokens y sentando las bases del dominio `Journey / Recommendation / ActiveWork`. El resto de pantallas permanecen inalteradas salvo correcciones de tokens globales.
