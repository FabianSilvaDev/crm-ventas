# FRONTEND RESTRUCTURING — AI SALES & GROWTH CRM

## CONTEXTO

Estoy construyendo un CRM de ventas y plataforma interna de Growth/Marketing con IA.

El backend, la lógica de negocio, APIs, modelos, agentes y funcionalidades principales YA SE ESTÁN DESARROLLANDO.

NO quiero reconstruir la lógica del proyecto.

NO quiero modificar innecesariamente:

* backend
* APIs
* servicios
* modelos
* lógica de negocio
* agentes de IA
* base de datos
* integraciones
* procesos existentes

El objetivo de esta tarea es realizar una **reestructuración profunda exclusivamente del FRONTEND**.

La aplicación está construida con:

* Angular
* TypeScript

Debes trabajar sobre el frontend existente y adaptarlo a una nueva experiencia de producto.

---

# REFERENCIA DE DISEÑO

Quiero tomar como referencia conceptual la experiencia de usuario de Nu / Nubank.

NO quiero clonar Nubank.

NO quiero copiar:

* logos
* textos
* branding
* iconografía propietaria
* componentes propietarios
* código
* assets
* identidad visual exacta

Quiero estudiar y aplicar sus PRINCIPIOS de diseño de producto.

Especialmente:

* simplicidad
* claridad
* jerarquía visual
* reducción de carga cognitiva
* navegación basada en modelos mentales
* información contextual
* acciones rápidas
* superficies modulares
* consistencia
* accesibilidad
* diseño basado en sistemas
* experiencia mobile-first
* progressive disclosure
* interfaces que priorizan lo importante

Nu ha evolucionado su aplicación para organizar funcionalidades según cómo las personas piensan y qué quieren hacer, en lugar de simplemente reflejar la estructura interna de la empresa. Ese principio debe trasladarse a nuestro CRM.

---

# OBJETIVO

Transformar el frontend actual de:

"CRM administrativo tradicional"

a:

"Business Growth Control Center"

La aplicación debe sentirse como un producto moderno de tecnología financiera / SaaS premium.

No debe parecer:

* ERP
* sistema administrativo antiguo
* dashboard lleno de widgets
* plantilla de Bootstrap
* panel genérico de Tailwind
* aplicación empresarial sobrecargada

Debe sentirse:

* limpia
* rápida
* moderna
* confiable
* intuitiva
* visual
* inteligente
* minimalista
* orientada a acciones

---

# PRINCIPIO FUNDAMENTAL

NO diseñes la aplicación pensando:

"¿Cómo están organizadas nuestras tablas?"

Diseña pensando:

"¿Qué quiere lograr el usuario?"

La arquitectura visual debe responder a modelos mentales.

Ejemplo:

Un usuario no piensa:

"Quiero acceder a la tabla campaigns."

Piensa:

"Quiero saber cómo están funcionando mis campañas."

Por lo tanto:

CAMPAIGNS

debe convertirse visualmente en algo como:

MARKETING
→ campañas activas
→ rendimiento
→ oportunidades
→ acciones recomendadas

---

# NUEVA ARQUITECTURA DE INFORMACIÓN

Propón y posteriormente implementa una navegación principal basada en estas áreas:

## 1. HOME

La pantalla principal NO debe ser un dashboard tradicional lleno de gráficos.

Debe funcionar como:

"Business Overview"

Debe responder rápidamente:

* ¿Cómo está funcionando el negocio?
* ¿Qué está pasando?
* ¿Qué necesita mi atención?
* ¿Qué oportunidades existen?
* ¿Qué está haciendo la IA?
* ¿Qué puedo hacer ahora?

Elementos posibles:

Revenue
Orders
Conversion
Profit
Ad Spend
ROAS
Active Leads
AI Recommendations

Pero deben mostrarse con jerarquía.

No mostrar 20 métricas al mismo nivel.

---

# 2. GROWTH

Esta debe ser una sección principal.

Dentro:

* Overview
* Campaigns
* Ads
* Creatives
* Audiences
* Experiments
* Content
* SEO

Pero la interfaz debe presentarlo como un ecosistema de crecimiento.

Ejemplo conceptual:

GROWTH

Campaigns
"3 campaigns active"

Creatives
"12 creatives running"

SEO
"8 opportunities"

Experiments
"2 tests awaiting review"

AI Recommendations
"4 actions suggested"

---

# 3. SALES

Sección orientada a ventas.

Incluye:

* Leads
* Customers
* Opportunities
* Pipeline
* Orders
* Follow-ups

El usuario debe poder entender el estado comercial rápidamente.

---

# 4. PRODUCTS

Sección orientada al catálogo y Product Intelligence.

Incluye:

* Products
* Product Discovery
* Market Research
* Product Score
* Competitors
* Trends

Esta sección debe mostrar claramente:

DISCOVER
→ ANALYZE
→ SCORE
→ SELECT
→ SELL

---

# 5. AI

La IA debe tener una presencia visible dentro de la aplicación.

No quiero esconder la IA en una pantalla de configuración.

Crear una experiencia:

"AI Center"

Mostrar:

* Agents
* Tasks
* Recommendations
* Activity
* Automations
* AI usage
* Costs

Pero evitar convertirlo en un simple listado técnico.

Debe sentirse como el "cerebro operativo" de la plataforma.

---

# 6. ANALYTICS

Debe responder:

"What is working?"

Mostrar:

* Revenue
* Profit
* Conversion
* CAC
* CPA
* ROAS
* ROI
* AOV
* LTV

Permitir:

* period selector
* comparison
* campaign filters
* product filters
* source filters

Los gráficos deben ser simples y legibles.

---

# 7. SETTINGS

Configuración de:

* Workspace
* Users
* Permissions
* Integrations
* AI Providers
* Notifications
* Branding
* Billing si posteriormente aplica

Settings no debe contaminar la navegación principal.

---

# MODELO DE NAVEGACIÓN

Investiga y aplica el principio de navegación de Nu:

la navegación debe representar modelos mentales del usuario y no la estructura interna de la compañía.

Quiero evaluar una estructura basada en:

HOME
GROWTH
SALES
PRODUCTS
AI
ANALYTICS

y utilizar navegación secundaria/contextual cuando sea necesario.

NO crear un sidebar gigante con 30 opciones.

---

# EXPERIENCIA DE HOME

La Home debe tener una jerarquía visual fuerte.

Ejemplo conceptual:

---

Good morning, Fabian

Your business is generating
$12.4M this month

↑ 18.4%

---

ATTENTION

Campaign "Summer Sale"
CPA increased 24%

[Review campaign]

---

AI RECOMMENDATIONS

"Product X is showing unusual demand."

[Analyze product]

---

PERFORMANCE

Revenue
Profit
Orders
Conversion

---

ACTIVE WORK

Campaigns
Leads
AI Tasks

---

No es necesario copiar esta estructura literalmente.

Diseña una experiencia mejor basada en esta filosofía.

---

# DISEÑO DE CARDS

Evitar exceso de cards.

Una card debe existir porque ayuda a:

* entender
* decidir
* actuar

No crear cards solamente para decorar.

Las cards deben tener:

* jerarquía
* contexto
* acción
* estado

Ejemplo:

Campaign

Summer Sale

$420K spent
$1.8M revenue
ROAS 4.28

↑ performing above target

[View campaign]

---

# ACTION-ORIENTED UI

La interfaz debe responder:

"¿Qué puedo hacer ahora?"

Por ejemplo:

AI Recommendation

"Your product X has increased demand."

Actions:

[Analyze]
[Create campaign]
[Ignore]

No solamente:

"Product X increased demand."

---

# CONTEXTUAL ACTIONS

No colocar todos los botones posibles permanentemente.

Usar progressive disclosure.

Ejemplo:

Product

Product X

Score
87

Demand
High

Competition
Medium

Margin
32%

Primary action:

[Explore opportunity]

Después:

Analyze
Create campaign
Generate content
Create landing
Add to catalog

---

# AI UX

Cuando una IA recomienda algo:

NO mostrar únicamente texto.

Mostrar:

WHAT
WHY
CONFIDENCE
DATA
ACTION

Ejemplo:

AI RECOMMENDATION

"Increase campaign budget"

WHY

CTR increased 31%
CPA decreased 18%

CONFIDENCE

82%

EXPECTED IMPACT

Potentially more conversions

[Review]

---

# HUMAN APPROVAL

Todas las acciones sensibles deben tener una UX clara.

Ejemplo:

AI wants to:

Increase campaign budget

From:
$50,000/day

To:
$65,000/day

Reason:
CPA improved 18%

Buttons:

[Approve]
[Edit]
[Reject]

Debe quedar claro:

AI RECOMMENDED

pero:

USER APPROVED

---

# DESIGN SYSTEM

Crear o reorganizar el frontend utilizando un pequeño Design System propio.

Definir:

Colors
Typography
Spacing
Radius
Shadows
Elevation
Motion
Icons
Buttons
Inputs
Cards
Badges
Tables
Charts
Dialogs
Drawers
Navigation
Empty states
Loading states
Error states

Utilizar design tokens.

Ejemplo:

--color-primary
--color-background
--color-surface
--color-text
--color-text-secondary
--color-success
--color-warning
--color-danger

Spacing:

4
8
12
16
24
32
48
64

No utilizar valores arbitrarios constantemente.

---

# VISUAL LANGUAGE

Quiero explorar una estética inspirada en productos digitales premium.

Características:

* mucho espacio negativo
* superficies limpias
* bordes suaves
* sombras muy sutiles
* tipografía fuerte
* números grandes cuando corresponda
* iconografía simple
* microinteracciones
* animaciones discretas

Evitar:

* gradientes excesivos
* glassmorphism excesivo
* sombras fuertes
* bordes por todas partes
* colores saturados sin propósito
* dashboards con demasiados elementos

---

# COLOR

NO copiar directamente el purple de Nubank.

Crear una identidad propia.

Usar un color principal de marca y una escala neutral.

La interfaz debe sentirse:

premium
moderna
tecnológica

El color debe utilizarse principalmente para:

* acciones
* estados
* énfasis
* navegación
* información importante

No pintar toda la aplicación.

---

# TIPOGRAFÍA

Seleccionar una tipografía moderna y altamente legible.

Debe funcionar:

* desktop
* tablet
* mobile

Crear jerarquía:

Display
Heading
Title
Body
Caption
Label

Los números financieros deben tener excelente legibilidad.

---

# MOBILE FIRST

Aunque inicialmente el sistema pueda utilizarse principalmente en desktop, diseñar el sistema para funcionar correctamente en:

Mobile
Tablet
Desktop

No crear simplemente:

"desktop que se rompe en mobile".

Diseñar responsive desde la arquitectura.

---

# RESPONSIVE NAVIGATION

Desktop:

Navigation
→ lateral o híbrida

Mobile:

Bottom navigation / contextual navigation

Evaluar qué patrón funciona mejor según cantidad de secciones.

No intentar meter todas las funcionalidades en mobile.

---

# COMPONENT ARCHITECTURE

Angular debe organizarse por features.

Evitar:

components/
services/
models/

con cientos de archivos mezclados.

Preferir:

features/
├── home/
├── growth/
├── sales/
├── products/
├── ai/
├── analytics/
└── settings/

Cada feature debe poder evolucionar independientemente.

---

# COMPONENTES GLOBALES

Crear:

core/
shared/
ui/

Ejemplo:

ui/
├── button
├── card
├── badge
├── avatar
├── metric
├── chart
├── table
├── modal
├── drawer
├── dropdown
├── tabs
├── empty-state
├── loading-state
├── notification
└── ai-recommendation

No crear componentes duplicados.

---

# DOMAIN COMPONENTS

Además de componentes visuales genéricos, crear componentes especializados:

CampaignCard
ProductOpportunityCard
LeadCard
AIRecommendation
MetricCard
CampaignPerformance
ProductScore
AIActivity
SalesPipeline

Estos deben consumir datos reales del backend existente.

---

# ESTADOS DE UI

Todos los módulos deben contemplar:

Loading
Loaded
Empty
Error
Partial
Disabled
Permission denied

No dejar pantallas vacías durante loading.

---

# SKELETONS

Utilizar skeleton loading para:

* dashboard
* tables
* cards
* analytics
* product research

Evitar spinners genéricos cuando exista una estructura conocida.

---

# MOTION DESIGN

Implementar microinteracciones discretas.

Ejemplos:

* cards
* hover
* navigation
* transitions
* drawers
* modals
* loading
* AI thinking
* successful actions

Las animaciones deben tener propósito.

NO utilizar animaciones solamente porque "se ven bonitas".

---

# AI ACTIVITY

Crear una pequeña experiencia de actividad:

AI ACTIVITY

Product Research Agent
Analyzing 24 products

SEO Agent
Generated 4 opportunities

Marketing Agent
Drafted campaign

Analytics Agent
Detected CPA anomaly

Debe sentirse como un sistema vivo, pero sin convertirse en ruido visual.

---

# DASHBOARD INTELLIGENCE

La Home debe ser dinámica.

Si no existen campañas:

mostrar:

"Start your first campaign"

Si existen campañas:

mostrar:

"Campaign performance"

Si existe una anomalía:

mostrarla.

Si existe una recomendación de IA:

priorizarla.

La interfaz debe reaccionar al contexto del negocio.

---

# EMPTY STATES

No utilizar:

"No data"

Crear empty states accionables.

Ejemplo:

"No campaigns yet"

"Launch your first experiment and start learning what converts."

[Create campaign]

---

# TABLES

No convertir toda la aplicación en tablas.

Utilizar tablas solamente cuando:

* comparación
* búsqueda
* administración
* datos masivos

Cuando sea posible, utilizar:

cards
lists
metrics
visual summaries

---

# PRODUCT EXPERIENCE

Quiero que el usuario pueda entrar a un producto y sentir que está entrando a una oportunidad comercial.

Ejemplo:

PRODUCT

Wireless Headphones

---

Opportunity Score
87

Demand
HIGH

Competition
MEDIUM

Margin
32%

Trend
↑ 24%

---

AI INSIGHT

"Demand is increasing while competition remains moderate."

---

ACTIONS

Analyze
Create campaign
Generate content
Create landing page

---

# CAMPAIGN EXPERIENCE

Una campaña debe sentirse como un producto.

Ejemplo:

CAMPAIGN

Summer Sale

Status
ACTIVE

---

Performance

Revenue
$1.8M

Spend
$420K

ROAS
4.28

---

AI INSIGHT

"CPA decreased 18% during the last 7 days."

---

CREATIVES

Creative 1
Creative 2
Creative 3

---

ACTIONS

Review
Optimize
Duplicate
Pause

---

# CRM EXPERIENCE

El CRM no debe sentirse como software administrativo.

Lead:

Juan Pérez

Potential customer

---

Source
Instagram

Interest
Product X

Score
82

---

NEXT ACTION

"Follow up today"

[Open conversation]

El sistema debe sugerir acciones relevantes.

---

# ACCESSIBILITY

Aplicar:

WCAG principles
Keyboard navigation
Focus states
Contrast
Semantic HTML
ARIA cuando corresponda
Screen reader support

No utilizar color como único indicador de estado.

---

# PERFORMANCE

La reestructuración debe mejorar la experiencia sin crear una aplicación pesada.

Aplicar:

Lazy loading
Route-level code splitting
Image optimization
OnPush/change detection strategy cuando aplique
Signals cuando aporte valor
Virtual scrolling en listas grandes
Caching donde corresponda

No optimizar prematuramente.

Medir antes y después.

---

# SEO

Aunque esto sea principalmente un CRM autenticado, mantener correctamente separadas:

PUBLIC PAGES

de

AUTHENTICATED APP

Las páginas públicas deben estar preparadas para:

SEO
SSR/SSG
metadata
canonical
Open Graph
structured data

La aplicación privada no debe intentar indexarse.

---

# NO TOCAR BACKEND

Regla crítica:

NO cambiar backend solamente para hacer que el frontend sea más cómodo.

Primero trabajar con:

APIs existentes
DTOs existentes
models existentes

Si falta información:

documentar:

FRONTEND DATA GAP

y proponer el cambio mínimo necesario.

No inventar endpoints.

---

# MIGRATION STRATEGY

NO borrar inmediatamente el frontend actual.

Primero:

1. Analizar estructura actual.
2. Identificar rutas.
3. Identificar componentes.
4. Identificar servicios.
5. Identificar estado.
6. Identificar APIs.
7. Identificar componentes reutilizables.
8. Identificar deuda técnica.
9. Crear nuevo Design System.
10. Migrar feature por feature.

La aplicación debe seguir funcionando durante la migración siempre que sea posible.

---

# PRIORIDAD DE MIGRACIÓN

Orden recomendado:

1. Design System
2. App Shell
3. Navigation
4. Home
5. Products
6. Growth
7. Sales / CRM
8. AI Center
9. Analytics
10. Settings

Pero revisa el proyecto antes de asumir este orden.

---

# APP SHELL

Crear una estructura global consistente:

┌─────────────────────────────────────────┐
│ Header                                  │
├──────────┬──────────────────────────────┤
│          │                              │
│ Nav      │ Main content                 │
│          │                              │
│          │                              │
│          │                              │
└──────────┴──────────────────────────────┘

Pero no asumir que un sidebar permanente es necesariamente la mejor solución.

Analiza:

sidebar
top navigation
hybrid navigation

y selecciona la mejor alternativa para nuestro producto.

---

# USER PROFILE

Siguiendo la filosofía de interfaces simples:

El usuario debe tener acceso fácil a:

Profile
Workspace
Settings
Notifications
AI activity

Sin ocupar espacio excesivo en la navegación principal.

---

# NOTIFICATIONS

No convertir notificaciones en un centro de spam.

Priorizar:

Critical
Action required
Insights
System

Ejemplo:

"Campaign CPA increased 24%"

[Review]

---

# SEARCH

Implementar búsqueda global cuando tenga sentido.

Debe poder buscar:

Products
Customers
Leads
Campaigns
Orders

Posteriormente:

AI-powered search.

---

# COMMAND CENTER

Evaluar una interfaz tipo command/search:

Search
"Find campaign..."

o posteriormente:

"Show campaigns with ROAS below 2"

No implementarlo si agrega complejidad innecesaria al MVP.

---

# DESIGN INSPIRATION

Investiga la filosofía pública de diseño de Nu, especialmente:

* NuDS
* mental models
* tabs/navigation
* contextual information
* accessibility
* modular UI
* consistency
* scalable design systems

Utiliza estas referencias para entender principios.

NO copies la identidad visual.

---

# CRITICAL RULE

Quiero que primero analices TODO EL FRONTEND EXISTENTE.

Antes de modificar código:

1. Detecta arquitectura actual.
2. Detecta routing.
3. Detecta componentes.
4. Detecta servicios.
5. Detecta estado.
6. Detecta design system actual.
7. Detecta librerías UI.
8. Detecta problemas UX.
9. Detecta duplicaciones.
10. Detecta deuda técnica.

Después crea:

FRONTEND_RESTRUCTURE_PLAN.md

con:

Current Architecture
Problems
Target Architecture
Migration Strategy
Design System
Navigation Model
Component Strategy
Responsive Strategy
Performance Strategy
Accessibility Strategy
Implementation Roadmap

---

# FORMA DE TRABAJO

NO hagas un rewrite completo inmediatamente.

Trabaja incrementalmente.

Cada fase debe:

* mantener funcionalidad existente
* reutilizar lógica existente
* minimizar regresiones
* mejorar UX
* mejorar arquitectura

Antes de modificar una feature:

analízala.

Después:

refactoriza.

Después:

verifica.

---

# CRITERIOS DE ÉXITO

Al finalizar la reestructuración:

La aplicación debe sentirse como:

"un producto de tecnología moderno"

y NO como:

"un CRM administrativo".

Debe ser:

Simple
Contextual
Accionable
Visual
Rápido
Escalable
Consistente
Responsive
Accesible

Y la lógica existente debe seguir funcionando.

---

# PRIMERA TAREA

NO escribas código todavía.

Primero analiza el frontend existente.

Entrega únicamente:

## 1. CURRENT FRONTEND AUDIT

## 2. CURRENT ROUTES

## 3. CURRENT COMPONENT ARCHITECTURE

## 4. CURRENT STATE MANAGEMENT

## 5. CURRENT DESIGN SYSTEM

## 6. UX PROBLEMS

## 7. TECHNICAL DEBT

## 8. TARGET INFORMATION ARCHITECTURE

## 9. TARGET APP SHELL

## 10. TARGET DESIGN SYSTEM

## 11. MIGRATION PLAN

## 12. PRIORITY ORDER

## 13. FIRST IMPLEMENTATION TASK

Después de mi aprobación comenzaremos la implementación.

IMPORTANTE:

NO modifiques backend.

NO reconstruyas lógica de negocio.

NO cambies APIs sin justificarlo.

NO hagas un rewrite innecesario.

El objetivo es transformar la experiencia y arquitectura del FRONTEND existente manteniendo intacto el producto que ya funciona.
