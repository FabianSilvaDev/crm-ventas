# PROYECTO: CRM DE VENTAS + PLATAFORMA AUTÓNOMA DE MARKETING CON IA

Quiero construir desde cero una plataforma propia de ventas y marketing inicialmente para uso interno.

NO quiero comercializar este CRM inicialmente.

El objetivo de la primera versión es que la plataforma sea capaz de ayudarme a encontrar oportunidades comerciales, seleccionar productos potencialmente rentables, generar contenido, crear campañas publicitarias, administrar leads y ventas, medir resultados y utilizar esos resultados para optimizar progresivamente las campañas.

Soy programador y el desarrollo de software no es mi principal dificultad. Necesito que actúes como un equipo multidisciplinario y me ayudes a diseñar y construir correctamente la plataforma desde la arquitectura hasta el despliegue.

---

# TU ROL

Actúa simultáneamente como:

1. Software Architect
2. Senior Angular Engineer
3. Backend Architect
4. DevOps Engineer
5. Cloud / Infrastructure Architect
6. Database Architect
7. AI Engineer
8. AI Agent Architect
9. LLM Engineer
10. Automation Engineer
11. Performance Engineer
12. Security Engineer
13. Technical SEO Specialist
14. SEO Strategist
15. Digital Marketing Specialist
16. Meta Ads Specialist
17. Google Ads Specialist
18. Social Media Strategist
19. E-commerce Growth Specialist
20. Data Analyst
21. Product Manager

Tu objetivo NO es solamente escribir código.

Tu objetivo es ayudarme a diseñar una plataforma técnicamente sólida que pueda comenzar como un MVP/piloto y posteriormente escalar sin tener que reconstruir completamente la arquitectura.

---

# OBJETIVO DEL PRODUCTO

La plataforma tendrá inicialmente estos grandes módulos:

## 1. CRM

Debe administrar:

* Leads
* Clientes
* Prospectos
* Contactos
* Oportunidades
* Embudos
* Actividades
* Tareas
* Notas
* Seguimientos
* Estados
* Fuentes de adquisición
* Campañas
* Productos
* Pedidos
* Ventas
* Conversiones
* Métricas

Debe existir trazabilidad completa:

VISITANTE
↓
LEAD
↓
PROSPECTO
↓
OPORTUNIDAD
↓
CLIENTE
↓
COMPRA
↓
RECOMPRA

---

# 2. PRODUCT INTELLIGENCE

Quiero incorporar dentro del CMS un sistema que permita investigar productos y nichos.

La plataforma debe poder recopilar información pública disponible de diferentes marketplaces y fuentes permitidas, por ejemplo:

* Mercado Libre
* Amazon
* AliExpress
* Tiendas online
* Google Trends
* Redes sociales
* Otras fuentes públicas relevantes

IMPORTANTE:

No quiero implementar scraping de forma irresponsable.

Antes de implementar cada scraper:

* revisar robots.txt
* términos de servicio
* restricciones técnicas
* límites de requests
* mecanismos oficiales/API disponibles
* riesgo legal
* riesgo de bloqueo
* rate limiting

Cuando exista una API oficial, priorizarla sobre scraping.

El sistema debe tener una arquitectura de conectores:

MarketplaceConnector
├── MercadoLibreConnector
├── AmazonConnector
├── AliExpressConnector
├── GoogleTrendsConnector
└── FutureConnector

No quiero que la lógica de cada plataforma quede mezclada con el dominio principal.

---

# 3. PRODUCT SCORING ENGINE

Quiero que la plataforma pueda analizar productos y asignar un score basado en diferentes variables.

Ejemplos:

* Demanda
* Tendencia
* Competencia
* Precio promedio
* Margen estimado
* Número de vendedores
* Volumen de reseñas
* Crecimiento de reseñas
* Engagement
* Disponibilidad
* Saturación publicitaria
* Potencial de contenido
* Potencial de recompra
* CPC estimado
* CAC estimado
* ROAS potencial
* Ticket promedio
* Dificultad logística

NO inventes métricas que no podamos obtener.

Cuando una métrica sea estimada:

marcarla explícitamente como ESTIMATED.

El sistema debe separar:

REAL DATA
ESTIMATED DATA
AI INFERENCE

Quiero poder saber exactamente qué parte de una recomendación viene de datos reales y cuál de inferencias de IA.

---

# 4. AI PRODUCT RESEARCH AGENT

Crear un agente especializado:

ProductResearchAgent

Responsabilidades:

1. Investigar un nicho.
2. Recopilar productos.
3. Normalizar información.
4. Detectar tendencias.
5. Comparar competencia.
6. Detectar oportunidades.
7. Calcular métricas.
8. Generar un ranking interno de oportunidades.

NO quiero que simplemente diga:

"Este producto es bueno".

Debe explicar:

* Qué datos encontró.
* Qué señales detectó.
* Qué supuestos realizó.
* Qué riesgos existen.
* Qué información falta.
* Por qué considera interesante la oportunidad.

---

# 5. AI MARKETING AGENT

Crear:

MarketingStrategyAgent

Debe recibir:

* Producto
* Nicho
* Público objetivo
* Precio
* Margen
* País
* Presupuesto
* Objetivo comercial

Y generar:

* Buyer personas
* Propuesta de valor
* Ángulos de venta
* Hooks
* Mensajes
* CTA
* Conceptos creativos
* Ideas de anuncios
* Landing page structure
* SEO keywords
* Contenido para redes
* Campañas
* Experimentos A/B

---

# 6. AI CREATIVE AGENT

Crear:

CreativeAgent

Debe generar conceptos para:

* Imágenes
* Videos
* Reels
* Stories
* Carruseles
* Banners
* Anuncios
* Landing pages

Debe poder generar prompts para modelos de generación de imágenes/video.

La arquitectura debe permitir posteriormente conectar proveedores como:

* modelos locales
* APIs externas
* modelos de imagen
* modelos de video

No acoples el sistema a un único proveedor.

Crear una interfaz abstracta:

ImageGenerationProvider
VideoGenerationProvider
TextGenerationProvider

---

# 7. AI CONTENT AGENT

Debe generar contenido para:

* Instagram
* Facebook
* Blog
* Landing pages
* SEO
* Email
* WhatsApp
* anuncios

Debe mantener consistencia de:

* tono
* branding
* propuesta de valor
* producto
* audiencia

Crear un sistema de Brand Context.

Ejemplo:

Brand
├── name
├── tone
├── colors
├── audience
├── values
├── forbidden_words
├── preferred_words
├── product_catalog
└── communication_style

---

# 8. AI ADVERTISING AGENT

Crear:

AdvertisingAgent

Debe encargarse de preparar campañas para:

## META

* Facebook Ads
* Instagram Ads

## GOOGLE

* Google Ads
* Search
* Display
* YouTube cuando aplique

El agente debe poder proponer:

* Campaign
* Ad Set
* Audience
* Creative
* Copy
* Budget
* Bid strategy
* Objective
* Conversion event
* Experiment

IMPORTANTE:

No quiero que inicialmente ejecute automáticamente campañas reales.

Primero debe existir:

DRAFT
↓
SIMULATION
↓
HUMAN APPROVAL
↓
PUBLISH

La ejecución automática debe ser una capacidad futura y debe incluir límites de seguridad.

---

# 9. BUDGET OPTIMIZATION AGENT

Crear:

BudgetOptimizationAgent

Debe analizar:

* Spend
* CPC
* CPM
* CTR
* Conversion Rate
* CPA
* CAC
* ROAS
* Revenue
* Margin
* Profit

Y proponer:

* aumentar presupuesto
* reducir presupuesto
* pausar campaña
* modificar audiencia
* modificar creativo
* modificar copy
* crear experimento

IMPORTANTE:

Durante el MVP NO permitir que la IA aumente presupuesto ilimitadamente.

Crear:

MAX_DAILY_BUDGET
MAX_CAMPAIGN_BUDGET
MAX_AUTOMATED_SPEND
MAX_BUDGET_CHANGE_PERCENTAGE

Todo cambio importante debe requerir aprobación humana inicialmente.

---

# 10. CAMPAIGN ENGINE

Diseñar un Campaign Engine.

Entidad conceptual:

Campaign

Debe tener:

* campaign_id
* name
* objective
* platform
* budget
* status
* start_date
* end_date
* audience
* product
* creatives
* ads
* metrics
* attribution
* experiments

Estados:

DRAFT
READY
PENDING_APPROVAL
ACTIVE
PAUSED
COMPLETED
ARCHIVED

---

# 11. MARKETING FUNNEL

Implementar conceptualmente:

TRAFFIC
↓
LANDING PAGE
↓
LEAD
↓
QUALIFICATION
↓
OFFER
↓
CHECKOUT
↓
SALE
↓
UPSELL
↓
REPEAT PURCHASE

El CRM debe poder medir conversiones entre cada etapa.

---

# 12. ATTRIBUTION

Diseñar un sistema inicial de attribution.

Debe soportar:

* UTM source
* UTM medium
* UTM campaign
* UTM content
* UTM term
* click_id cuando corresponda
* campaign_id
* ad_id
* creative_id

Quiero poder responder:

"¿De dónde vino esta venta?"

Y posteriormente:

"¿Qué campaña produjo mayor margen?"

No solamente mayor revenue.

---

# 13. CMS

El sistema tendrá un CMS interno para administrar:

* Productos
* Categorías
* Landing Pages
* Blogs
* Banners
* Creativos
* Campañas
* Audiencias
* Promociones
* SEO
* Metadata
* Contenido generado por IA

La IA debe poder trabajar sobre el CMS mediante herramientas controladas.

Ejemplo:

AI Agent
↓
Tool
↓
CMS API
↓
Database

NO permitir que los agentes tengan acceso directo e ilimitado a la base de datos.

---

# 14. AI AGENT ARCHITECTURE

Quiero arquitectura basada en agentes.

Inicialmente:

OrchestratorAgent

que pueda delegar:

ProductResearchAgent
MarketingStrategyAgent
ContentAgent
CreativeAgent
SEOAgent
AdvertisingAgent
AnalyticsAgent
BudgetOptimizationAgent
CRMIntelligenceAgent

Diseña una arquitectura que permita agregar agentes posteriormente.

Cada agente debe tener:

* system prompt
* tools
* permissions
* input schema
* output schema
* memory/context
* logs
* audit trail
* token limits
* execution limits

---

# 15. OLLAMA

Quiero integrar inicialmente Ollama para ejecutar modelos localmente.

Crear una abstracción:

LLMProvider

Implementación inicial:

OllamaProvider

Arquitectura futura:

OllamaProvider
OpenAIProvider
AnthropicProvider
GeminiProvider
OtherProvider

No quiero que todo el código dependa directamente de Ollama.

La aplicación debe poder cambiar de proveedor.

---

# 16. MODEL ROUTING

Diseñar un sistema para decidir qué modelo utilizar dependiendo de la tarea.

Ejemplo:

TASK
↓
MODEL ROUTER
↓
Cheap Model / Local Model / Powerful Model

Por ejemplo:

Clasificación
→ modelo pequeño

Extracción
→ modelo pequeño

Generación de contenido
→ modelo medio

Estrategia
→ modelo avanzado

Análisis complejo
→ modelo avanzado

Quiero evitar gastar recursos innecesariamente.

---

# 17. AI MEMORY

Diseñar memoria para los agentes.

Separar:

SHORT_TERM_MEMORY
LONG_TERM_MEMORY
BUSINESS_MEMORY
CAMPAIGN_MEMORY
PRODUCT_MEMORY
CUSTOMER_MEMORY

Evaluar cuándo usar:

* PostgreSQL
* Redis
* Vector Database

No agregues una base vectorial solamente porque "es IA".

Justifica técnicamente si realmente es necesaria.

---

# 18. FRONTEND

Quiero utilizar:

Angular

Diseñar una arquitectura moderna y escalable.

Evaluar:

* Angular standalone components
* Signals
* Lazy loading
* Route guards
* Interceptors
* State management
* Feature-based architecture
* Shared components
* Design system

Estructura conceptual:

src/
├── app/
│   ├── core/
│   ├── shared/
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── crm/
│   │   ├── products/
│   │   ├── campaigns/
│   │   ├── analytics/
│   │   ├── ai/
│   │   ├── content/
│   │   └── settings/
│   └── layout/

No crear un monolito de componentes.

---

# 19. BACKEND

Propón la tecnología backend más apropiada.

Compara brevemente:

Node.js / NestJS
Python / FastAPI

Considerando:

* IA
* scraping
* APIs
* background jobs
* agentes
* performance
* escalabilidad
* mantenimiento

Después selecciona una arquitectura y explica por qué.

---

# 20. DATABASE

Diseñar inicialmente sobre PostgreSQL.

Entidades iniciales:

users
organizations
customers
leads
contacts
opportunities
products
product_sources
product_metrics
campaigns
campaign_platforms
ad_sets
ads
creatives
content
landing_pages
orders
order_items
payments
events
analytics
ai_agents
ai_runs
ai_tasks
ai_memory
audit_logs

No crear tablas innecesarias.

Quiero un modelo normalizado pero pragmático.

---

# 21. BACKGROUND JOBS

Muchas operaciones no deben ejecutarse dentro de una request HTTP.

Diseñar workers para:

* scraping
* sincronización
* análisis de productos
* generación de contenido
* generación de imágenes
* generación de videos
* procesamiento de métricas
* envío de campañas
* SEO crawling
* analytics

Evaluar:

Redis + BullMQ

u otra alternativa.

Explica la decisión.

---

# 22. EVENT-DRIVEN ARCHITECTURE

Quiero que el sistema pueda evolucionar hacia una arquitectura orientada a eventos.

Ejemplos:

LeadCreated
ProductDiscovered
CampaignCreated
CampaignStarted
AdClicked
LeadConverted
OrderCreated
OrderPaid
CampaignMetricUpdated
BudgetThresholdReached

Diseña inicialmente algo simple, pero que pueda evolucionar.

---

# 23. SECURITY

Implementar desde el inicio:

* Authentication
* Authorization
* RBAC
* JWT/session strategy
* Secrets management
* Rate limiting
* Input validation
* API security
* Audit logs
* Encryption
* CORS
* CSRF cuando aplique
* Secure headers
* SQL injection protection
* SSRF protection
* scraping abuse protection

Especial atención:

Los agentes de IA NO deben tener acceso irrestricto al sistema.

Implementar permissions:

READ_PRODUCTS
WRITE_PRODUCTS
CREATE_CAMPAIGN
PUBLISH_CAMPAIGN
CHANGE_BUDGET
GENERATE_CONTENT
PUBLISH_CONTENT
etc.

---

# 24. OBSERVABILITY

Diseñar:

Logs
Metrics
Tracing
Health checks
Error tracking

Quiero poder saber:

* qué agente ejecutó una acción
* cuándo
* con qué input
* qué modelo utilizó
* cuánto tardó
* cuántos tokens utilizó
* qué tools utilizó
* qué resultado produjo
* si hubo error

Crear AI audit logs.

---

# 25. DEVOPS

Diseñar:

LOCAL
↓
DEVELOPMENT
↓
STAGING
↓
PRODUCTION

Inicialmente quiero poder levantar todo localmente.

Evaluar Docker Compose.

Servicios potenciales:

frontend
backend
postgres
redis
ollama
worker
scheduler

Posteriormente poder migrar a:

AWS / GCP / Azure / VPS

sin reconstruir todo.

---

# 26. CI/CD

Diseñar pipeline para:

* lint
* unit tests
* integration tests
* build
* security scan
* docker build
* migrations
* deploy

Separar:

development
staging
production

---

# 27. SEO TECHNICAL ARCHITECTURE

Esto es MUY importante.

Desde el primer commit quiero que la plataforma tenga una estrategia SEO correcta.

Diseñar SEO técnico desde el principio.

Necesito:

* robots.txt
* sitemap.xml
* canonical URLs
* metadata
* Open Graph
* Twitter/X cards
* structured data
* JSON-LD
* semantic HTML
* heading hierarchy
* clean URLs
* redirects
* 404
* 301
* hreflang si posteriormente aplica
* pagination SEO
* image optimization
* Core Web Vitals
* SSR/SSG cuando sea necesario

IMPORTANTE:

Angular normalmente requiere evaluar cuidadosamente SSR/SSG para SEO.

Analiza Angular SSR y/o prerendering.

No quiero descubrir después que Google no puede interpretar correctamente las páginas.

---

# 28. SEO CONTENT ENGINE

Crear:

SEOAgent

Debe poder:

* investigar keywords
* clusterizar keywords
* crear topic clusters
* detectar search intent
* generar briefs
* generar metadata
* generar contenido
* detectar cannibalization
* detectar contenido duplicado
* sugerir internal linking
* crear schema markup
* generar sitemap entries

Crear una estructura:

Keyword
↓
Search Intent
↓
Topic Cluster
↓
Content Brief
↓
Content
↓
Optimization
↓
Publish
↓
Indexation
↓
Analytics

---

# 29. GOOGLE INDEXING

Quiero que desde el primer archivo generado se considere indexabilidad.

Crear:

robots.txt

sitemap.xml

manifest cuando aplique

favicon

metadata base

OpenGraph

JSON-LD

canonical

Google Search Console integration preparada.

NO prometer indexación inmediata.

La aplicación debe estar técnicamente preparada para que Google pueda rastrearla correctamente.

---

# 30. SOCIAL MEDIA ENGINE

Crear módulo para:

Instagram
Facebook

Inicialmente generar:

* Posts
* Reels concepts
* Stories
* Carousels
* Captions
* Hooks
* CTAs
* Hashtags cuando tengan sentido
* Content calendar

El sistema debe poder generar un calendario:

DAY
CONTENT TYPE
PRODUCT
ANGLE
HOOK
COPY
CREATIVE
CTA
STATUS

---

# 31. CAMPAIGN TEMPLATES

Crear inicialmente plantillas de campañas.

Ejemplos:

PRODUCT_LAUNCH
LEAD_GENERATION
TRAFFIC
SALES
RETARGETING
AB_TEST
UPSELL
CROSS_SELL
REACTIVATION

Cada plantilla debe tener:

Objective
Audience
Creative strategy
Copy strategy
Budget strategy
Measurement
Success metrics

No asumir que una métrica determinada es universalmente "éxito".

Definir KPIs según objetivo.

---

# 32. EXPERIMENTATION ENGINE

Quiero que la plataforma pueda experimentar.

Ejemplo:

Campaign A
vs
Campaign B

Variaciones:

* Hook
* Image
* Video
* CTA
* Audience
* Landing page
* Offer

Guardar:

hypothesis
variant
metric
sample_size
result
decision

La IA debe ayudar a generar hipótesis.

---

# 33. ANALYTICS

Dashboard inicial:

Revenue
Orders
Conversion Rate
CAC
CPA
ROAS
ROI
Gross Margin
Net Profit
Ad Spend
CTR
CPC
CPM
AOV
LTV

IMPORTANTE:

Distinguir:

Revenue
Profit
ROAS
ROI

No tratarlos como equivalentes.

---

# 34. UNIT ECONOMICS

Crear módulo de economía del producto.

Por producto:

selling_price
cost
shipping
payment_fee
platform_fee
advertising_cost
returns
taxes
gross_margin
contribution_margin
estimated_CAC
estimated_LTV

Quiero poder determinar si vender un producto realmente tiene sentido económicamente.

---

# 35. AUTOMATION ENGINE

Crear automatizaciones como:

IF product_score > threshold
THEN create_product_review

IF campaign_CPA > threshold
THEN alert

IF campaign_ROAS > threshold
THEN recommend_budget_increase

IF lead_created
THEN create_follow_up_task

IF customer_purchased
THEN trigger_post_purchase_flow

Inicialmente:

AI recommends
Human approves

Posteriormente:

AI executes within predefined limits.

---

# 36. HUMAN-IN-THE-LOOP

Esto es obligatorio.

Toda acción sensible debe pasar por aprobación durante el MVP.

Ejemplo:

IA propone:

"Incrementar presupuesto de campaña X de $50.000 a $70.000 diarios."

Sistema:

PENDING APPROVAL

Usuario:

APPROVE
REJECT
MODIFY

Guardar audit log.

---

# 37. ADMIN / CONTROL CENTER

Crear dashboard administrativo.

Debe mostrar:

AI agents
Running tasks
Campaigns
Products
Revenue
Costs
AI usage
LLM usage
Errors
Scraping jobs
System health

Quiero poder ver qué está haciendo el sistema.

---

# 38. COST CONTROL

La IA puede convertirse rápidamente en el mayor costo del sistema.

Crear:

AI_COST_TRACKING

Registrar:

provider
model
tokens_input
tokens_output
estimated_cost
task
agent
timestamp

Crear límites:

DAILY_AI_BUDGET
MONTHLY_AI_BUDGET
MAX_AGENT_EXECUTIONS
MAX_TOKENS_PER_TASK

---

# 39. PROJECT PHASES

NO intentes construir todo de una vez.

Divide el proyecto.

FASE 0
Architecture

FASE 1
Foundation

FASE 2
CRM

FASE 3
Products

FASE 4
AI infrastructure

FASE 5
Product research

FASE 6
Content + SEO

FASE 7
Campaign engine

FASE 8
Analytics

FASE 9
Automation

FASE 10
Production infrastructure

FASE 11
Scaling

Para cada fase quiero:

* objetivo
* funcionalidades
* arquitectura
* entidades
* APIs
* frontend
* backend
* tests
* Docker
* criterios de aceptación

---

# 40. REGLA FUNDAMENTAL DE DESARROLLO

NO quiero que generes miles de líneas de código sin planificación.

Primero:

1. Analiza.
2. Propón arquitectura.
3. Detecta riesgos.
4. Propón estructura de carpetas.
5. Define entidades.
6. Define contratos API.
7. Define dependencias.
8. Define roadmap.
9. Define MVP.
10. Después comienza a implementar.

Cuando implementes:

* código limpio
* SOLID cuando aplique
* DRY
* separación de responsabilidades
* TypeScript strict
* validaciones
* tests
* documentación mínima necesaria

---

# 41. DOCUMENTACIÓN

Crear desde el principio:

/docs

architecture.md
database.md
api.md
ai-agents.md
seo.md
marketing.md
deployment.md
security.md
roadmap.md
decisions.md

Crear también:

ADR

Architecture Decision Records

para decisiones importantes.

---

# 42. MONOREPO

Evalúa si conviene:

Nx
Turborepo
pnpm workspaces

o una estructura diferente.

Quiero una recomendación basada en:

* Angular
* backend
* workers
* shared types
* AI agents
* crecimiento futuro

No adoptes una herramienta solamente porque sea popular.

---

# 43. API CONTRACTS

Quiero contratos claros entre frontend y backend.

Evaluar:

REST
GraphQL
tRPC

Para este proyecto, selecciona la alternativa más apropiada y explica por qué.

---

# 44. INITIAL PROJECT STRUCTURE

Antes de escribir código quiero que propongas una estructura similar a:

/apps
/packages
/services
/infrastructure
/docs
/scripts

pero puedes modificarla si existe una arquitectura mejor.

---

# 45. MVP REAL

Quiero que seas estricto.

El MVP NO debe intentar automatizar todo.

El MVP mínimo debería permitir:

1. Login
2. Dashboard
3. CRM básico
4. Productos
5. Investigación de productos
6. Product scoring
7. Ollama
8. AI Agent básico
9. Generación de contenido
10. SEO básico
11. Crear campaña en modo Draft
12. Métricas básicas
13. Human approval
14. Audit logs

Después evolucionaremos.

---

# 46. PRIMER OBJETIVO

NO empieces generando toda la aplicación.

Primero quiero que hagas un análisis arquitectónico completo.

Entrega:

## A. Product Vision

Explica exactamente qué estamos construyendo.

## B. Architecture

Presenta arquitectura general.

## C. Technology Stack

Frontend
Backend
Database
Cache
Queue
AI
Storage
Infrastructure
Monitoring

## D. Repository Structure

Propón estructura real.

## E. Database Model

Entidades principales y relaciones.

## F. API Architecture

Endpoints iniciales.

## G. AI Architecture

Agentes, tools, memory y model routing.

## H. Marketing Architecture

Productos → contenido → campañas → conversiones → analytics.

## I. SEO Architecture

Cómo hacer que el proyecto sea técnicamente indexable desde el inicio.

## J. DevOps

Docker + CI/CD + environments.

## K. Security

Amenazas y mitigaciones.

## L. Scalability

Cómo pasar de:

1 usuario
→ 10
→ 100
→ 1.000
→ 10.000+

sin rediseñar completamente el sistema.

## M. MVP

Define exactamente qué entra y qué NO entra.

## N. Roadmap

Orden exacto de implementación.

## O. First Sprint

Define las primeras tareas concretas que debemos ejecutar.

---

# 47. FORMA DE TRABAJO

Después del análisis arquitectónico, quiero trabajar contigo como si fueras mi CTO.

Cuando te diga:

"implementemos la Fase 1"

debes:

1. Revisar arquitectura.
2. Identificar archivos necesarios.
3. Crear/editar código.
4. Explicar cambios.
5. Ejecutar o proponer tests.
6. Verificar que no rompamos arquitectura.
7. Actualizar documentación.

No avances automáticamente a la siguiente fase.

Espera mi confirmación.

---

# 48. REGLAS PARA IA

Nunca permitas que una IA:

* publique campañas sin autorización durante el MVP
* gaste dinero sin límites
* elimine información
* modifique producción directamente
* ejecute comandos arbitrarios
* acceda directamente a la base de datos
* exponga secretos
* ejecute scraping ilimitado

Toda herramienta debe tener:

permission
input schema
output schema
validation
logging
timeout
retry policy
rate limit

---

# 49. PRINCIPIO CENTRAL DEL PRODUCTO

La plataforma debe funcionar conceptualmente como:

DATA
↓
INTELLIGENCE
↓
DECISION
↓
CONTENT
↓
CAMPAIGN
↓
TRAFFIC
↓
LEAD
↓
SALE
↓
ANALYTICS
↓
LEARNING
↓
OPTIMIZATION

El sistema debe cerrar ese ciclo.

La información obtenida de las campañas debe volver al sistema para mejorar futuras decisiones.

---

# 50. OBJETIVO FINAL

La visión de largo plazo es construir una plataforma interna donde yo pueda introducir:

"Nicho X"

y el sistema pueda ayudarme a ejecutar un proceso como:

NICHO
↓
INVESTIGACIÓN
↓
PRODUCTOS
↓
PRODUCT SCORING
↓
SELECCIÓN
↓
ESTRATEGIA
↓
CONTENIDO
↓
LANDING
↓
SEO
↓
CAMPAÑA
↓
PUBLICIDAD
↓
LEADS
↓
VENTAS
↓
ANALYTICS
↓
OPTIMIZACIÓN

Pero la primera versión debe ser controlada, observable y con aprobación humana.

---

# INSTRUCCIÓN FINAL

Comienza únicamente con el:

"ARCHITECTURE & MVP REVIEW"

No escribas todavía toda la aplicación.

Quiero primero:

1. Arquitectura propuesta.
2. Stack tecnológico recomendado.
3. Diagrama lógico de componentes.
4. Estructura del repositorio.
5. Modelo de datos inicial.
6. Arquitectura de agentes.
7. Arquitectura de scraping/connectors.
8. Arquitectura SEO.
9. Arquitectura de campañas.
10. Arquitectura DevOps.
11. Riesgos técnicos.
12. Riesgos de seguridad.
13. Riesgos de costos.
14. Roadmap por fases.
15. Sprint 1 detallado.

Sé crítico.

Si alguna de mis ideas es técnicamente mala, costosa, innecesaria o genera deuda técnica, dilo claramente y propón una alternativa.

No agregues tecnologías por moda.

Prioriza:

Simplicidad
Observabilidad
Seguridad
Mantenibilidad
Costos
Escalabilidad
Automatización controlada

La prioridad inicial es conseguir un MVP funcional que pueda utilizarse para generar ventas reales, no construir una plataforma empresarial sobredimensionada.
