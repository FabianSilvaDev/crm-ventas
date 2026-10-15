# PROYECTO: AI OPERATIONS CMS — PIXEL ART AGENT WORKFLOW

## 1. Tu rol

Actúa como un equipo senior compuesto por:

- Software Architect.
- Senior Angular Developer.
- Senior Node.js / Express Developer.
- UI/UX Designer especializado en SaaS.
- Pixel Art Game UI Developer.
- Especialista en sistemas multiagente y automatización comercial.

Tu objetivo es construir desde cero una aplicación funcional para gestionar un sistema de agentes de inteligencia artificial enfocado en investigación de mercado, marketing, creación de contenido, publicidad, captación de clientes, ventas y analítica.

No quiero únicamente una propuesta, un prototipo estático ni una explicación. Quiero que construyas el proyecto, crees los archivos necesarios, instales las dependencias, levantes los servicios y verifiques que todo funciona.

## 2. Filosofía del proyecto

La aplicación debe ser sencilla, modular y fácil de desarrollar.

La primera versión utilizará exclusivamente respuestas simuladas mediante un backend local de Node.js y Express. No conectes todavía Ollama, OpenAI, Claude, bases de datos externas, plataformas publicitarias ni servicios de terceros.

Sin embargo, diseña los servicios y contratos para que posteriormente podamos sustituir los datos simulados por agentes y API reales sin reconstruir el frontend.

Prioridades:

1. Aplicación funcional de extremo a extremo.
2. Interfaz pixel art consistente y profesional.
3. Flujo completo de agentes, desde la investigación hasta la optimización.
4. CMS claro para supervisar y controlar la operación.
5. Código simple y mantenible.
6. Rendimiento y facilidad de extensión.

Evita la sobreingeniería, las arquitecturas innecesariamente complejas y las dependencias que no aporten valor inmediato.

## 3. Stack tecnológico obligatorio

### Frontend
- Angular con la versión estable compatible disponible en el entorno.
- TypeScript.
- Angular Router.
- Angular Signals o servicios Angular sencillos para el estado compartido.
- CSS propio y variables CSS.
- Componentes standalone si la versión elegida los soporta.
- PixiJS para el escenario de oficina 2D pixel art.

No uses React, Next.js, Vue ni frameworks adicionales de UI.

No instales librerías visuales pesadas si el diseño se puede implementar con CSS.

### Backend
- Node.js.
- Express.
- JavaScript con módulos ES.
- API REST.
- CORS configurado para el frontend local.
- Datos mock almacenados en archivos JavaScript o JSON.
- Simulación de operaciones asíncronas con retrasos controlados.

### Desarrollo
- npm.
- Scripts claros para ejecutar frontend y backend.
- Variables de entorno mediante `.env` cuando sean necesarias.
- Archivo `.env.example` si se utilizan variables de entorno.
- Sin Docker obligatorio.
- Sin base de datos en esta primera versión.
- Sin autenticación real en esta fase.

Usa versiones compatibles y estables. Evita instalar dependencias redundantes.

## 4. Estructura del proyecto

Crea un repositorio con una estructura sencilla similar a esta:

```text
ai-operations-cms/
├── frontend/
│   ├── src/
│   │   └── app/
│   │       ├── core/
│   │       │   ├── models/
│   │       │   ├── services/
│   │       │   └── layout/
│   │       ├── shared/
│   │       │   ├── components/
│   │       │   └── pipes/
│   │       ├── features/
│   │       │   ├── dashboard/
│   │       │   ├── virtual-office/
│   │       │   ├── agents/
│   │       │   ├── workflows/
│   │       │   ├── products/
│   │       │   ├── campaigns/
│   │       │   ├── leads/
│   │       │   ├── analytics/
│   │       │   └── settings/
│   │       ├── app.routes.ts
│   │       └── app.config.ts
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── app.js
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── mocks/
│   │   └── utils/
│   └── package.json
├── docs/
│   ├── architecture.md
│   └── api.md
├── package.json
└── README.md
```

Puedes ajustar la estructura cuando exista una justificación concreta, pero conserva la separación entre frontend, backend y datos simulados.

Crea un `package.json` en la raíz con scripts para instalar y ejecutar los dos proyectos cómodamente. Evita herramientas adicionales si npm puede resolverlo.

## 5. Concepto visual: Pixel Art AI Office

La interfaz debe combinar un CMS SaaS con una oficina virtual 2D inspirada en los simuladores de gestión y oficinas virtuales pixel art.

No utilices escenarios 3D, Three.js, WebGL 3D ni modelos tridimensionales.

### Dirección de arte

- Pixel art 2D auténtico.
- Vista isométrica 2D o vista superior con perspectiva de videojuego; elige una sola y mantenla consistente.
- Paleta moderna, con fondos oscuros o neutros y acentos verdes, cian, amarillos o naranjas.
- Tipografía legible para interfaces administrativas.
- Bordes definidos, sombras discretas y paneles bien organizados.
- Escritorios, computadores, plantas, salas, pizarras y puestos de trabajo.
- Avatares originales con apariencia de personajes de videojuego.
- Animaciones ligeras y deliberadas.
- Diseño adaptable a escritorio y portátil.

No conviertas toda la aplicación en un videojuego. La oficina aporta la representación visual de los agentes, mientras que las tablas, formularios, métricas y controles siguen teniendo apariencia de CMS profesional.

No dependas de imágenes remotas para representar elementos esenciales. Utiliza recursos locales, CSS y sprites originales. Si generas sprites, organízalos en una carpeta de assets con nombres y dimensiones documentados.

## 6. Layout principal del CMS

Implementa un layout global con:

### Sidebar
- Dashboard.
- Oficina virtual.
- Flujo de agentes.
- Agentes.
- Investigación de mercado.
- Productos y ofertas.
- Contenido y creatividades.
- Landing pages.
- Campañas.
- Leads y ventas.
- Analítica.
- Configuración.

### Header
- Nombre del proyecto.
- Indicador de conexión con la API.
- Cantidad de agentes activos.
- Notificaciones simuladas.
- Perfil de usuario ficticio.

### Área de contenido
Debe cambiar según la ruta seleccionada sin reconstruir todo el layout.

Utiliza Angular Router y lazy loading cuando resulte sencillo y beneficioso.

## 7. Dashboard

Construye un dashboard inicial con información simulada:

- Agentes totales.
- Agentes trabajando.
- Flujos en ejecución.
- Productos investigados.
- Campañas simuladas.
- Leads generados.
- Conversiones simuladas.
- Actividad reciente.
- Últimas tareas.
- Estado general de la operación.

Incluye gráficos sencillos únicamente donde aporten valor. No inventes datos en el frontend si deben venir de la API mock.

Todos los indicadores deben obtener sus datos a través de los servicios Angular conectados al backend Express.

## 8. Oficina virtual pixel art

La oficina será una vista interactiva de los agentes.

### Departamentos

1. Operations Center.
2. Research Lab.
3. Marketing Studio.
4. Creative Studio.
5. SEO & Web Lab.
6. Advertising Operations.
7. Sales Department.
8. Analytics & Optimization.

Cada departamento debe tener una zona visual diferenciada, con puestos, objetos y personajes.

### Personajes

Cada agente tendrá:

- ID.
- Nombre.
- Especialidad.
- Departamento.
- Avatar.
- Estado.
- Tarea actual.
- Progreso simulado.
- Última actividad.
- Resultado reciente.

### Estados

- Idle.
- Working.
- Thinking.
- Collaborating.
- Completed.
- Error.
- Offline.

Los estados deben proceder de los datos mock del backend.

### Interacciones

- Seleccionar un agente.
- Mostrar un panel lateral con su información.
- Ver la tarea actual.
- Consultar su historial reciente.
- Ejecutar una tarea simulada.
- Consultar resultados.
- Filtrar por departamento o estado.
- Buscar por nombre.
- Volver a la vista general.

Utiliza PixiJS para dibujar el escenario y sus personajes. Mantén los paneles, formularios y controles administrativos en Angular.

No crees una instancia de PixiJS por personaje. Utiliza un único escenario por vista y administra los recursos de forma centralizada.

Si todavía no dispones de sprites, comienza con personajes y objetos pixelados creados con CSS o sprites locales simples. No bloquees el funcionamiento del proyecto esperando recursos gráficos complejos.

## 9. Flujo completo de agentes

Esta es una de las funciones centrales del sistema.

Implementa un flujo visual de izquierda a derecha, con nodos conectados y estados visibles:

1. Opportunity.
2. Research.
3. Market Intelligence.
4. Competitor Analysis.
5. Product Validation.
6. Offer Creation.
7. Content Generation.
8. Creative Production.
9. Landing Page.
10. Campaign Setup.
11. Audience & Budget.
12. Lead Acquisition.
13. Lead Qualification.
14. Sales Follow-up.
15. Analytics.
16. Optimization.
17. Learning.

Cada etapa representa una tarea o grupo de tareas gestionado por uno o varios agentes.

### Comportamiento

- Mostrar etapas pendientes, ejecutándose, completadas y fallidas.
- Mostrar el agente responsable de cada etapa.
- Mostrar progreso y duración simulada.
- Permitir consultar los detalles de una etapa.
- Permitir iniciar un flujo de demostración.
- Permitir pausar o reanudar la simulación.
- Permitir reiniciar el flujo de demostración.
- Mostrar un panel de resultados al completar cada etapa.
- Permitir visualizar las dependencias entre etapas.

Cuando se inicie una demostración, el backend deberá simular el avance de las etapas y devolver resultados coherentes para cada una.

No basta con animar una barra de progreso en el frontend. El backend debe mantener el estado de la ejecución simulada y exponerlo mediante la API.

En esta versión no se requiere un motor genérico de workflows ni un sistema visual de programación de nodos. Implementa el flujo predefinido de forma sencilla y extensible.

## 10. Sistema de agentes

Crea agentes mock especializados en:

- Orquestación.
- Investigación de mercado.
- Inteligencia competitiva.
- Tendencias.
- Validación de productos.
- Ofertas.
- Copywriting.
- SEO.
- Redes sociales.
- Creatividades.
- Landing pages y CRO.
- Campañas y audiencias.
- Presupuestos publicitarios.
- Cualificación de leads.
- Seguimiento comercial.
- Analítica.
- Optimización.

Cada agente debe tener un identificador estable, especialidad, departamento y capacidades declaradas.

Implementa endpoints para consultar agentes, consultar un agente por ID y ejecutar una tarea simulada.

Las acciones del CMS deben modificar el estado del mock en el backend y devolver resultados consistentes.

## 11. Backend Express y API REST

Implementa una API funcional con rutas versionadas bajo `/api/v1`.

Incluye como mínimo:

### Health
- `GET /api/v1/health`

### Dashboard
- `GET /api/v1/dashboard`

### Agents
- `GET /api/v1/agents`
- `GET /api/v1/agents/:id`
- `POST /api/v1/agents/:id/run`

### Workflows
- `GET /api/v1/workflows`
- `GET /api/v1/workflows/:id`
- `POST /api/v1/workflows/:id/run`
- `GET /api/v1/workflows/runs/:runId`
- `POST /api/v1/workflows/runs/:runId/pause`
- `POST /api/v1/workflows/runs/:runId/resume`
- `POST /api/v1/workflows/runs/:runId/reset`

### Products
- `GET /api/v1/products`
- `GET /api/v1/products/:id`

### Campaigns
- `GET /api/v1/campaigns`

### Leads
- `GET /api/v1/leads`

### Activity
- `GET /api/v1/activity`

Añade endpoints adicionales solo si son necesarios.

Define contratos de respuesta consistentes, códigos HTTP correctos y un middleware centralizado para errores.

Los endpoints deben tener datos realistas para una demostración, pero todos los productos, campañas, presupuestos, leads y conversiones serán ficticios y estarán claramente identificados como datos de demostración.

## 12. Simulación realista de workflows

Implementa un servicio de simulación en Node.js.

Cuando se inicie un flujo:

1. Crea un ID de ejecución.
2. Inicializa sus etapas.
3. Devuelve inmediatamente el ID de ejecución.
4. Avanza las etapas en segundo plano con retrasos configurables.
5. Actualiza el estado de cada etapa.
6. Genera un resultado mock por etapa.
7. Registra eventos en el historial.
8. Permite consultar el estado actualizado mediante polling.
9. Respeta las acciones de pausa, reanudación y reinicio.
10. Maneja errores simulados de manera controlada.

Utiliza temporizadores del lado del servidor solo para administrar las simulaciones activas y límpialos correctamente al pausar, reiniciar o finalizar.

Mantén las ejecuciones en memoria. Explica en el README que los datos y las ejecuciones se pierden al reiniciar el servidor.

Evita una infraestructura de colas o una base de datos para esta primera versión.

## 13. Datos mock

Organiza los datos de demostración en módulos independientes.

Crea información coherente para:

- Agentes.
- Departamentos.
- Workflows.
- Etapas.
- Productos.
- Ofertas.
- Campañas.
- Leads.
- Actividad.
- Resultados de tareas.

Utiliza IDs estables, fechas ISO y estados tipados en el frontend.

Los resultados deben tener relación entre sí. Por ejemplo, un producto validado puede alimentar una oferta, que posteriormente se utiliza en una landing y en una campaña simulada.

Evita generar valores aleatorios diferentes cada vez que se consulta un endpoint si esto produce inconsistencias entre vistas.

## 14. Integración Angular

Crea servicios independientes para comunicarse con Express:

- `DashboardService`.
- `AgentsService`.
- `WorkflowsService`.
- `ProductsService`.
- `CampaignsService`.
- `LeadsService`.
- `ActivityService`.

Centraliza la URL base de la API mediante configuración de entorno.

Los componentes no deben acceder directamente a datos mock ni duplicar lógica de peticiones HTTP.

Implementa estados de carga, error, vacío y éxito.

El polling de una ejecución debe detenerse al completar, fallar o destruir el componente correspondiente.

## 15. Calidad y mantenibilidad

- Mantén componentes pequeños y enfocados.
- Separa los modelos de los servicios.
- Evita componentes gigantes.
- Evita duplicación de lógica.
- Usa tipado estricto en Angular cuando sea viable.
- Valida los parámetros recibidos por Express.
- No expongas errores internos al cliente.
- No utilices credenciales reales.
- No dejes botones sin funcionamiento.
- No uses datos hardcodeados en los componentes.
- Incluye un `.gitignore`.
- Documenta los comandos para instalar y ejecutar el proyecto.
- Añade pruebas básicas para health, agentes y ejecución de workflows si el entorno lo permite.

## 16. Orden obligatorio de construcción

### Fase 1: Scaffold
Crea la estructura del proyecto, instala dependencias y configura los scripts de ejecución.

### Fase 2: Backend
Implementa Express, datos mock, endpoints y simulación de workflows. Comprueba la API antes de conectar el frontend.

### Fase 3: CMS
Implementa layout, rutas, dashboard, agentes y páginas administrativas.

### Fase 4: Workflow
Implementa el flujo visual y conecta las etapas a las ejecuciones reales del servidor mock.

### Fase 5: Oficina pixel art
Implementa el escenario 2D, departamentos, personajes y paneles de detalle en pixelart.

### Fase 6: Integración y validación
Conecta todas las vistas, verifica las acciones y comprueba que el frontend y el backend funcionan simultáneamente.

No avances dejando módulos esenciales como simples placeholders si puedes implementarlos en esta versión.

## 17. Criterios de aceptación

La primera versión estará terminada cuando:

- El proyecto se instale desde cero siguiendo el README.
- El backend Express arranque y responda al health check.
- Angular arranque y se conecte al backend.
- El dashboard consuma datos desde la API.
- La lista de agentes funcione.
- La oficina pixel art permita seleccionar agentes.
- El flujo pueda iniciarse y avanzar por sus etapas.
- El estado se mantenga en el backend mientras la simulación esté activa.
- Pausar, reanudar y reiniciar funcionen.
- Las vistas muestren estados de carga y error.
- Los módulos principales no dependan de servicios externos.
- No existan botones principales sin implementar.
- La consola no tenga errores críticos.
- Las instrucciones de ejecución estén documentadas.

## Instrucción final

Empieza inspeccionando el entorno de trabajo y comprobando las versiones de Node.js, npm y Angular disponibles.

Después construye la aplicación directamente en el repositorio actual, creando una estructura nueva y limpia. Si existen archivos previos, identifica qué puede eliminarse o conservarse antes de modificarlo.

Toma decisiones técnicas razonables sin detenerte a preguntar por cada detalle. Si hay una limitación del entorno, resuélvela con la alternativa más sencilla y documenta la decisión.

Al terminar, entrega un resumen de la arquitectura, los módulos construidos, los comandos exactos para ejecutar frontend y backend, las pruebas realizadas y cualquier funcionalidad pendiente.

**Prioriza una aplicación pequeña que funcione de extremo a extremo sobre una arquitectura sofisticada que no llegue a ejecutarse.**