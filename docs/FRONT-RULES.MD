# FRONTEND RESTRUCTURE — AI ACQUISITION & GROWTH PLATFORM

## CONTEXTO DEL PROYECTO

Estoy construyendo una plataforma interna de adquisición, ventas y Growth impulsada por IA.

El proyecto YA ESTÁ EN DESARROLLO.

La lógica de negocio, backend, APIs, modelos, agentes y funcionalidades principales ya se están levantando.

En esta etapa NO quiero reconstruir el sistema.

Quiero hacer una REESTRUCTURACIÓN PROFUNDA DEL FRONTEND.

Stack frontend actual:

- Angular
- TypeScript

La prioridad ahora es transformar la experiencia de usuario para que el producto se sienta como una plataforma moderna de Growth/Business Intelligence y NO como un CRM administrativo tradicional.

---

# REGLA PRINCIPAL

NO reconstruyas el backend.

NO reescribas la lógica de negocio.

NO inventes APIs.

NO cambies modelos existentes sin necesidad.

NO reemplaces servicios existentes solamente por razones visuales.

NO hagas un rewrite completo del proyecto.

Debes trabajar sobre el frontend existente y reutilizar:

- APIs
- servicios
- modelos
- interfaces
- autenticación
- lógica existente
- agentes existentes
- funcionalidades existentes

Si encuentras una limitación del backend para soportar una experiencia concreta:

DOCUMENTA:

FRONTEND DATA GAP

y propone el cambio mínimo necesario.

---

# OBJETIVO

Quiero transformar el frontend actual en:

# AI ACQUISITION & GROWTH CONTROL CENTER

La aplicación debe permitir visualizar y operar un proceso completo:

OPPORTUNITY
↓
INTELLIGENCE
↓
VALIDATION
↓
OFFER
↓
CONTENT
↓
CREATIVE
↓
LANDING
↓
CAMPAIGN
↓
SALES
↓
ANALYTICS
↓
OPTIMIZATION
↓
LEARNING
↓
NUEVO CICLO

Este proceso debe estar representado visualmente en el frontend.

---

# REFERENCIA DE UX

Utiliza como referencia conceptual los principios de diseño de productos digitales de Nu/Nubank.

NO copies:

- branding
- logo
- colores exactos
- identidad visual
- componentes propietarios
- código
- assets
- textos

Quiero aplicar principios como:

- simplicidad
- claridad
- jerarquía
- reducción de carga cognitiva
- navegación basada en modelos mentales
- progressive disclosure
- contextual actions
- interfaces accionables
- consistencia
- accesibilidad
- diseño modular
- responsive design
- experiencia premium

La aplicación debe sentirse como un producto moderno de tecnología.

NO debe parecer:

- ERP
- CRM antiguo
- dashboard genérico
- plantilla Bootstrap
- panel administrativo sobrecargado

---

# PRINCIPIO DE PRODUCTO

El usuario NO debería pensar:

"Voy a abrir el módulo ProductResearchAgent."

Debe pensar:

"Quiero encontrar una oportunidad."

La IA debe encargarse internamente de utilizar los agentes necesarios.

El frontend debe mostrar:

QUÉ está pasando
POR QUÉ está pasando
QUÉ recomienda la IA
QUÉ puede hacer el usuario

No debe obligar al usuario a entender la arquitectura interna de agentes.

---

# ARQUITECTURA CONCEPTUAL

El sistema debe tener un:

# ORCHESTRATOR AGENT

Este agente coordina los demás agentes.

Conceptualmente:

USER
↓
ORCHESTRATOR AGENT
↓
SPECIALIZED AGENTS
↓
TOOLS
↓
DATA
↓
RESULT
↓
ORCHESTRATOR
↓
USER

El usuario no debería tener que seleccionar manualmente todos los agentes.

---

# AGENTES

El sistema debe contemplar conceptualmente agentes como:

## Opportunity Agent

Responsable de:

- entender la oportunidad
- identificar información faltante
- definir contexto
- preparar investigación

---

## Product Research Agent

Responsable de:

- investigar productos
- consultar fuentes
- analizar productos
- detectar oportunidades

---

## Market Intelligence Agent

Responsable de:

- analizar mercado
- demanda
- precios
- competencia
- tendencias

---

## Competitor Agent

Responsable de:

- analizar competidores
- ofertas
- precios
- posicionamiento
- saturación

---

## Trend Agent

Responsable de:

- tendencias
- crecimiento
- señales de mercado
- comportamiento

---

## Decision Agent

Responsable de:

- consolidar resultados
- calcular/interpretar opportunity score
- recomendar:

GO
TEST
NO-GO

---

## Offer Strategy Agent

Responsable de:

- propuesta de valor
- oferta
- diferenciadores
- bundles
- argumentos de venta
- CTA

---

## Pricing Agent

Responsable de:

- análisis de precio
- margen
- pricing strategy
- escenarios

---

## Buyer Persona Agent

Responsable de:

- audiencia
- segmentos
- pain points
- necesidades
- objeciones

---

## Content Agent

Responsable de:

- copy
- posts
- reels
- blogs
- emails
- contenido comercial

---

## SEO Agent

Responsable de:

- keywords
- search intent
- metadata
- content structure
- technical SEO
- internal linking

---

## Social Media Agent

Responsable de:

- Instagram
- Facebook
- contenido social
- calendario
- hooks
- CTA

---

## Creative Agent

Responsable de:

- estrategia creativa
- conceptos
- variantes
- A/B testing

---

## Image Agent

Responsable de:

- generación de imágenes
- variantes
- prompts
- formatos publicitarios

---

## Video Agent

Responsable de:

- conceptos de video
- scripts
- reels
- variantes

---

## Landing Page Agent

Responsable de:

- estructura
- copy
- CTA
- conversión
- SEO

---

## CRO Agent

Responsable de:

- conversion rate optimization
- UX
- CTA
- formularios
- hipótesis de mejora

---

## Campaign Strategy Agent

Responsable de:

- estrategia de campaña
- objetivo
- canales
- estructura

---

## Audience Agent

Responsable de:

- segmentación
- audiencias
- retargeting
- lookalikes cuando aplique

---

## Advertising Agent

Responsable de:

- Meta
- Instagram
- Google
- ads
- campaign structures

---

## Budget Agent

Responsable de:

- presupuesto
- distribución
- recomendaciones
- límites

---

## Lead Qualification Agent

Responsable de:

- scoring
- clasificación
- intención
- priorización

---

## CRM Agent

Responsable de:

- clientes
- leads
- oportunidades
- seguimiento

---

## Follow-up Agent

Responsable de:

- próximos pasos
- seguimiento
- reactivación

---

## Analytics Agent

Responsable de:

- métricas
- rendimiento
- anomalías
- análisis

---

## Attribution Agent

Responsable de:

- origen de ventas
- campañas
- canales
- atribución

---

## Optimization Agent

Responsable de:

- detectar oportunidades
- detectar problemas
- recomendar acciones
- optimizar campañas
- generar experimentos

---

# IMPORTANTE SOBRE LOS AGENTES

El frontend NO debe convertirse en un panel técnico de agentes.

No quiero que la pantalla principal muestre:

"15 agentes disponibles"

Quiero que muestre:

"Tu oportunidad está siendo analizada."

Y debajo:

AI ACTIVITY

✓ Product Research
✓ Competitor Analysis
⟳ Trend Analysis

Esto permite transparencia sin aumentar la carga cognitiva.

---

# ACQUISITION JOURNEY

Este es el flujo principal de negocio.

Debe convertirse en un concepto central del frontend.

--------------------------------------------------

01 · OPPORTUNITY

Producto
Servicio
Nicho
Tendencia

↓

02 · INTELLIGENCE

Market Research
Product Research
Competitors
Trends

↓

03 · VALIDATION

Opportunity Score
Demand
Competition
Margin
Trend

Resultado:

GO
TEST
NO-GO

↓

04 · OFFER

Value Proposition
Pricing
Bundle
Buyer Persona
CTA
Objections

↓

05 · CONTENT

Copy
SEO
Social
Blog
Reels
Email

+

06 · CREATIVE

Images
Video
Carousel
Ads
A/B Variants

↓

07 · LANDING

Landing Page
Conversion
SEO
Tracking

↓

08 · CAMPAIGN

Meta
Instagram
Google

Audience
Budget
Creative
Bid
Objective

↓

09 · SALES

Visitors
Leads
Prospects
Customers
Orders

↓

10 · ANALYTICS

Revenue
Profit
CAC
CPA
ROAS
ROI
AOV
LTV

↓

11 · OPTIMIZATION

Scale
Reduce
Pause
Change Creative
Change Audience
Create Experiment

↓

LEARNING

↓

NUEVO CICLO

--------------------------------------------------

# ETAPA 01 — OPPORTUNITY

La primera pantalla debe permitir iniciar una oportunidad.

Opciones:

"I have a product"

"I have a service"

"I want to find a product"

"I want to explore a niche"

"I found a trend"

La UI debe ser sencilla.

Después:

Opportunity Agent

debe preparar el contexto.

---

# ETAPA 02 — INTELLIGENCE

Esta etapa debe mostrar el trabajo de los agentes.

Ejemplo:

INTELLIGENCE

Product Research Agent
✓ Completed

Competitor Agent
✓ Completed

Trend Agent
⟳ Analyzing

Market Agent
Waiting

No mostrar logs técnicos innecesarios.

Mostrar:

WHAT
WHY
SOURCE
RESULT

---

# ETAPA 03 — VALIDATION

Mostrar:

Opportunity Score

87 / 100

Demand
HIGH

Competition
MEDIUM

Margin
HIGH

Trend
HIGH

Además:

AI DECISION

GO

o:

TEST

o:

NO-GO

Debe existir una explicación.

Ejemplo:

"Demand is increasing while competition remains moderate."

Acciones:

[Review analysis]

[Continue]

---

# ETAPA 04 — OFFER

El usuario debe poder revisar:

Value Proposition
Price
Margin
Bundle
Audience
CTA
Objections

AI debe generar una propuesta.

Mostrar:

AI GENERATED

y permitir:

Edit
Approve
Regenerate

---

# ETAPA 05 — CONTENT

Mostrar contenido generado.

Ejemplos:

Instagram Post
Facebook Post
Reel Script
Blog
Email
SEO Content

Cada contenido debe permitir:

Preview
Edit
Regenerate
Approve

---

# ETAPA 06 — CREATIVE

Mostrar:

Images
Videos
Carousels
Ad Creatives

Permitir:

Generate
Regenerate
Compare
Approve

A/B variants deben ser visibles.

---

# ETAPA 07 — LANDING

La IA debe poder generar una landing.

Mostrar:

Preview

SEO

Conversion elements

CTA

Tracking

Acciones:

Edit
Preview
Publish

---

# ETAPA 08 — CAMPAIGN

La campaña debe tener una experiencia propia.

Mostrar:

Campaign Name
Objective
Platform
Audience
Budget
Creatives
Conversion Event

Ejemplo:

CAMPAIGN

Summer Product Test

Objective:
Sales

Platform:
Meta

Daily Budget:
$80,000

ROAS Target:
3.0

---

# HUMAN APPROVAL

Las acciones sensibles deben tener aprobación humana.

Ejemplo:

AI RECOMMENDATION

Increase budget

$50,000/day
→
$65,000/day

Reason:

CPA decreased 18%.

Expected impact:

More conversions.

Actions:

[Approve]

[Edit]

[Reject]

El sistema debe dejar claro:

AI RECOMMENDED

USER APPROVED

---

# ETAPA 09 — SALES

Mostrar el funnel:

VISITORS
↓
LEADS
↓
PROSPECTS
↓
CUSTOMERS
↓
ORDERS

Y permitir acceder al CRM.

No convertir esta pantalla en una tabla gigantesca.

Priorizar:

- estado
- siguiente acción
- valor
- score
- fuente

---

# ETAPA 10 — ANALYTICS

Mostrar:

Revenue
Profit
Ad Spend
CAC
CPA
ROAS
ROI
AOV
LTV
Conversion Rate

Permitir filtros:

Date
Product
Campaign
Channel
Audience

No mostrar todas las métricas con igual jerarquía.

Las métricas principales deben destacar.

---

# ETAPA 11 — OPTIMIZATION

Esta etapa es crítica.

La IA debe analizar los resultados y producir recomendaciones.

Ejemplo:

AI INSIGHT

"Creative B is generating 34% more conversions than Creative A."

RECOMMENDATION

"Increase Creative B exposure."

Actions:

[Apply]

[Create experiment]

[Ignore]

---

# FEEDBACK LOOP

Analytics NO es el final.

Debe existir un ciclo:

CAMPAIGN
↓
SALES
↓
ANALYTICS
↓
OPTIMIZATION
↓
LEARNING
↓
INTELLIGENCE
↓
NEW DECISION

La interfaz debe representar visualmente que el sistema aprende de cada campaña.

---

# AI MEMORY

La plataforma debe conceptualmente almacenar aprendizajes como:

Product Memory
Campaign Memory
Creative Memory
Audience Memory
Market Memory

Ejemplo:

"Video creatives outperform static images for this audience."

Este aprendizaje podrá utilizarse posteriormente por otros agentes.

---

# FRONTEND INFORMATION ARCHITECTURE

La navegación principal NO debe reflejar la estructura de la base de datos.

Debe reflejar las necesidades del usuario.

Propuesta:

HOME

GROWTH

SALES

PRODUCTS

AI

ANALYTICS

SETTINGS

---

# HOME

Debe responder:

¿Cómo está el negocio?

¿Qué necesita atención?

¿Qué recomienda la IA?

¿Qué está funcionando?

¿Qué puedo hacer ahora?

Mostrar:

Revenue
Profit
Sales
Campaigns
AI Recommendations
Active Opportunities

---

# GROWTH

Contendrá:

Campaigns
Content
Creatives
Audiences
Experiments
SEO

---

# SALES

Contendrá:

Leads
Customers
Pipeline
Orders
Follow-ups

---

# PRODUCTS

Contendrá:

Products
Discovery
Market Intelligence
Competitors
Trends
Opportunity Scores

---

# AI

No debe ser un simple listado de agentes.

Debe mostrar:

AI Activity
Recommendations
Tasks
Automations
Agents
AI Usage
AI Costs

---

# ANALYTICS

Performance
Attribution
Profitability
Campaign Analytics
Product Analytics

---

# DESIGN PRINCIPLES

Aplicar:

- minimalismo
- mucho espacio negativo
- jerarquía visual
- tipografía clara
- superficies limpias
- pocos colores
- acciones contextuales
- progressive disclosure
- microinteractions
- responsive
- accesibilidad

Evitar:

- exceso de cards
- exceso de gráficos
- sidebar con 30 opciones
- colores saturados
- dashboards saturados
- botones innecesarios
- información técnica innecesaria

---

# CARD PRINCIPLE

Una card debe responder al menos una de estas preguntas:

¿QUÉ ESTÁ PASANDO?

¿POR QUÉ?

¿QUÉ DEBO HACER?

Si no responde ninguna:

NO crear la card.

---

# AI RECOMMENDATION COMPONENT

Crear un componente reutilizable:

AIRecommendation

Debe mostrar:

Title
Explanation
Evidence
Confidence
Expected Impact
Actions

Ejemplo:

AI RECOMMENDATION

"Increase campaign budget"

Evidence:
CPA -18%
CTR +22%

Confidence:
82%

Expected Impact:
+12% estimated conversions

[Review]

---

# AI ACTIVITY COMPONENT

Crear:

AIActivity

Debe mostrar:

Agent
Status
Task
Time
Result

Ejemplo:

✓ Product Research
Completed

✓ Competitor Analysis
Completed

⟳ Trend Analysis
Running

---

# AI TRANSPARENCY

El usuario siempre debe poder entender:

qué hizo la IA
por qué
con qué información
qué recomienda

Pero la interfaz no debe mostrar complejidad técnica innecesaria.

---

# DESIGN SYSTEM

Crear un Design System propio.

Definir:

Colors
Typography
Spacing
Radius
Elevation
Motion
Icons

Componentes:

Button
Input
Card
Metric
Badge
Tabs
Table
Drawer
Dialog
Toast
Chart
Empty State
Skeleton
AI Recommendation
AI Activity
Score
Timeline
Status

Utilizar Design Tokens.

No utilizar valores arbitrarios constantemente.

---

# ANGULAR ARCHITECTURE

Reestructurar por features:

src/app/

core/

shared/

ui/

features/

├── home/
├── growth/
├── sales/
├── products/
├── ai/
├── analytics/
└── settings/

Evitar una arquitectura donde todos los componentes estén mezclados.

---

# PERFORMANCE

Aplicar cuando corresponda:

Lazy Loading
Signals
Standalone Components
Route-level code splitting
Optimized images
Caching
Virtual scrolling
Efficient change detection

No realizar optimizaciones innecesarias.

---

# RESPONSIVE

Diseñar:

Mobile
Tablet
Desktop

No hacer solamente desktop y después "adaptarlo".

Mobile debe tener una navegación específica si es necesario.

---

# ACCESSIBILITY

Aplicar:

WCAG
Keyboard navigation
Focus states
Semantic HTML
ARIA cuando corresponda
Color contrast

---

# MIGRATION STRATEGY

NO borrar todo el frontend actual.

Primero:

1. Audit
2. Design System
3. App Shell
4. Navigation
5. Home
6. Products
7. Growth
8. Sales
9. AI
10. Analytics
11. Settings

Pero antes de asumir este orden:

ANALIZA EL PROYECTO.

---

# FRONTEND AUDIT

Antes de modificar código, analiza:

- estructura
- routes
- components
- services
- state management
- API integrations
- models
- UI libraries
- styles
- duplicated components
- technical debt
- responsive issues
- accessibility issues

Genera:

FRONTEND_RESTRUCTURE_PLAN.md

Debe contener:

CURRENT ARCHITECTURE

CURRENT ROUTES

CURRENT COMPONENTS

CURRENT DESIGN SYSTEM

UX PROBLEMS

TECHNICAL DEBT

TARGET ARCHITECTURE

TARGET INFORMATION ARCHITECTURE

ACQUISITION JOURNEY

AGENT INTEGRATION

DESIGN SYSTEM

MIGRATION STRATEGY

PERFORMANCE STRATEGY

ACCESSIBILITY STRATEGY

IMPLEMENTATION ROADMAP

---

# REGLA PARA LOS AGENTES

Cada etapa del Acquisition Journey debe definir:

1. Qué agentes participan.
2. Qué herramientas utilizan.
3. Qué datos necesitan.
4. Qué resultado producen.
5. Qué criterio permite avanzar.
6. Qué acciones requieren aprobación humana.

Ejemplo:

VALIDATION

Agents:

Product Research Agent
Competitor Agent
Trend Agent
Decision Agent

Inputs:

Product
Market
Country

Outputs:

Demand
Competition
Margin
Trend
Opportunity Score
Recommendation

Next Step:

GO
TEST
NO-GO

---

# FRONTEND + AGENTS

El frontend debe representar el estado de los agentes.

Estados posibles:

IDLE
QUEUED
RUNNING
WAITING
COMPLETED
FAILED
REQUIRES_APPROVAL

Ejemplo:

┌─────────────────────────────┐
│ AI ACTIVITY                 │
│                             │
│ ✓ Product Research         │
│ ✓ Competitor Analysis      │
│ ⟳ Trend Analysis           │
│ ! Approval required        │
└─────────────────────────────┘

---

# NO EXPONER COMPLEJIDAD

El usuario NO debe tener que saber:

qué modelo está usando
qué prompt se ejecutó
qué framework utiliza el agente
qué proveedor LLM está activo

Eso puede estar disponible en AI Activity / Debug / Admin.

La experiencia principal debe estar enfocada en:

BUSINESS OUTCOME.

---

# ADMIN AI VIEW

En una sección avanzada sí se podrá visualizar:

Agent
Model
Provider
Tokens
Cost
Execution time
Tools
Errors

Pero NO debe formar parte de la experiencia principal.

---

# HUMAN-IN-THE-LOOP

Durante el MVP:

AI RECOMMENDS

↓

USER REVIEWS

↓

USER APPROVES

↓

SYSTEM EXECUTES

Nunca:

AI
↓
gasta dinero automáticamente

sin límites o aprobación.

---

# OBJECTIVE

La aplicación debe conseguir que el usuario pueda pensar:

"Yo le digo qué oportunidad quiero explorar y el sistema me ayuda a llevarla desde la investigación hasta la venta."

No quiero construir simplemente:

"otro CRM."

Quiero construir:

"un sistema operativo de adquisición y crecimiento asistido por IA."

---

# PRIMERA TAREA

NO IMPLEMENTES TODAVÍA.

Primero analiza el frontend existente.

Después entrega:

1. Current Frontend Audit
2. Current Architecture
3. Current Routes
4. Current Components
5. Current State Management
6. Current API Integration
7. Current Design System
8. UX Problems
9. Technical Debt
10. Target Architecture
11. Target Navigation
12. Acquisition Journey
13. Agent-to-Frontend Mapping
14. Design System
15. Migration Plan
16. First Sprint

NO cambies código hasta terminar este análisis.

Después de mi aprobación:

implementaremos únicamente el primer sprint.

---

# REGLA FINAL

Actúa como:

Senior Angular Architect
+
Product Designer
+
UX Architect
+
AI Product Architect

Sé crítico.

Si una decisión actual del frontend es mala:

explícala.

Si una parte del flujo no tiene sentido:

propón una alternativa.

Si una funcionalidad debe eliminarse:

justifica por qué.

No quiero solamente que hagas que la aplicación "se vea bonita".

Quiero que la arquitectura del frontend represente correctamente:

OPPORTUNITY
→ INTELLIGENCE
→ VALIDATION
→ OFFER
→ CONTENT
→ CREATIVE
→ LANDING
→ CAMPAIGN
→ SALES
→ ANALYTICS
→ OPTIMIZATION
→ LEARNING

Y que detrás de cada etapa exista una arquitectura multiagente capaz de ejecutar y coordinar el trabajo necesario.