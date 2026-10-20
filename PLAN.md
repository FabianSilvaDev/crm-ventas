# PLAN - AI Operations CMS (construccion desde cero)

Especificacion de referencia: `claude.md/instruccions.md`.
Repositorio git existente reutilizado; el arbol anterior se elimino por decision del usuario.

Estado: **las seis fases estan terminadas y verificadas**.

## Entorno verificado

| Componente | Version |
| --- | --- |
| Node.js | v24.19.0 |
| npm | 11.17.0 |
| Angular CLI / core | 22.2.2 / 22.2.3 |
| PixiJS | 8.22.0 |
| Express | 5.3.0 |
| TypeScript | 6.0.3 |

## Fases (orden obligatorio de la seccion 16)

- [x] **Fase 1: Scaffold.** Estructura `backend/`, `frontend/`, `docs/` y `package.json` raiz
      con scripts de instalacion y ejecucion. Dependencias instaladas en los tres proyectos.
- [x] **Fase 2: Backend.** Express 5, 13 modulos de datos simulados, 61 endpoints bajo
      `/api/v1`, simulador de flujos con temporizadores y 81 pruebas automatizadas.
      Comprobada la API antes de conectar el frontend.
- [x] **Fase 3: CMS.** Layout (sidebar + header), 12 secciones con carga diferida,
      dashboard, agentes, investigacion, productos y ofertas, contenido y creatividades,
      landing pages, campanas, leads y ventas, analitica y configuracion.
- [x] **Fase 4: Workflow.** Flujo de 17 etapas de izquierda a derecha, dependencias
      dibujadas, detalle por etapa con resultados, y control real (iniciar, pausar,
      reanudar, reiniciar) sobre el estado del backend por polling.
- [x] **Fase 5: Oficina pixel art.** Escenario PixiJS con 8 salas, 20 agentes, camara
      (arrastrar, zoom, encaje), filtros, leyenda de estados y panel lateral con
      ejecucion de tareas simuladas.
- [x] **Fase 6: Integracion y validacion.** Build de produccion correcto, ambos servicios
      arrancando a la vez, API verificada de extremo a extremo (lecturas, ejecuciones,
      pausa/reanudacion/reinicio, fallos controlados y contratos de error).

## Verificacion realizada

| Comprobacion | Resultado |
| --- | --- |
| `npm --prefix backend test` | 81/81 correctas |
| `npm --prefix frontend test` | 16/16 correctas |
| `npm run build` | exit 0 · inicial 331 kB · chunk diferido `office` de 375 kB (PixiJS) |
| `npm --prefix frontend run check:sprites` | 44 matrices revisadas, 0 descuadradas |
| API `:3000` | health, los 61 endpoints y ciclo completo de ejecucion verificados |
| Frontend `:4300` | `index.html` y `main.js` servidos correctamente |
| CORS | origen permitido → 200; origen ajeno → 403 `CORS_REJECTED` |
| Contratos de error | 400 / 403 / 404 / 409 verificados con el `code` esperado |
| Fuentes externas | Google Trends, AliExpress y Alibaba sondeados de verdad (ver abajo) |
| Cola de oportunidades | descubrir → estudiar → aprobar → lanzar, verificado de extremo a extremo |
| Ejecucion con contexto | `opp-0004` produce metricas y artefactos propios; sin contexto se mantiene el caso de demo |

## Trabajo posterior a las seis fases

Ordenado por peticion del usuario, paso a paso:

1. **Yanca (intake de oportunidades).** Nueva agente `agt-020`, detectora de
   oportunidades, responsable de la etapa `Opportunity`. Se eligio una agente dedicada
   en lugar de renombrar a NEXUS para no perder el papel de orquestador.
   *Hecho.*
2. **Fuentes de datos reales.** Capa `backend/src/sources/` con adaptadores para Google
   Trends, AliExpress y Alibaba, señales con procedencia y fecha, y estudio de
   oportunidad puntuado (`POST /intake/scan`). *Hecho.*
3. **Oportunidades como entidad.** Cola persistente en memoria, con la evidencia de cada
   cifra, historial de revisiones y decision del operador (aprobar/descartar con motivo).
   Vista `/opportunities` con descubrimiento, estudio y decision. *Hecho.*
4. **Ejecucion atada a la oportunidad.** `run.context` con la oportunidad, lanzamiento
   desde la cola (`POST /opportunities/:id/run`, solo si esta aprobada) y resolucion del
   resultado de cada etapa a partir de su estudio: metricas propias y artefactos reales
   o marcados como derivados. *Hecho.*
5. **Puertas de decision.** Tres etapas con puerta declarada (`product-validation`,
   `campaign-setup`, `audience-budget`): el flujo se detiene en `awaiting_approval`, con
   aprobar/rechazar desde el panel, aviso en el header y, al rechazar, descarte de la
   oportunidad con el motivo. *Hecho.*

La hoja de ruta por pasos esta completa. Siguientes pasos naturales, cuando toque:
persistencia real (hoy todo vive en memoria), credenciales de AliExpress/Alibaba para
datos de mercado reales, y un proveedor de pago para la serie de interes de Google Trends.

## Aclaracion del producto en el primer filtro

Detectado al usar la cola: se podia aprobar «perifericos gamer» sin saber que producto
era, y el sistema lo enlazaba en silencio con un producto concreto (comparaba etiquetas
sueltas). Ahora:

- Cada oportunidad lleva `productHypothesis` (`proposed`/`confirmed`/`category`/`none`)
  con su `basis` y su `confidence`.
- La coincidencia se hace por nombre, por palabras en comun o por categoria, y **solo la
  de nombre/palabras es fiable**. Con categoria, el producto es un ejemplo.
- **Aprobar exige producto resuelto**: si no lo esta, 409 con la situacion explicada.
  El operador indica el producto (del catalogo o escrito) o decide que aprueba la
  categoria.
- El `catalogLink` solo se crea con confianza alta o producto confirmado, asi que el flujo
  nunca produce los artefactos reales de un producto que nadie eligio.
- Un estudio posterior no pisa el producto confirmado.

## Investigacion real en la etapa Research

Antes: los informes de `/research` eran 7 documentos escritos a mano y la etapa Research
del flujo solo copiaba cifras del estudio de la oportunidad. **No se investigaba nada.**

Ahora, cuando un flujo atado a una oportunidad llega a Research:

- el backend consulta las fuentes de verdad (`conductResearch` → registro de fuentes) y
  escribe un informe con las cifras obtenidas, cada una con su fuente y su modo;
- el informe lleva hallazgos derivados de esos datos y **limitaciones explicitas** (fuente
  caida, sin datos reales, margen no contrastable);
- se guarda en `store.researchReports` con identificador `rsc-1XXX` y `origin: 'run'`, y
  aparece en `/research` con una etiqueta que lo distingue de los de demostracion;
- la etapa del flujo enlaza el informe como artefacto **real** (existe y se puede abrir).

La consulta corre en paralelo a la duracion simulada de la etapa: si no termina a tiempo, la
etapa se completa con lo que ya se sabia y lo dice en su resumen, pero el informe queda
registrado igualmente.

## Revision del pixel art (posterior)

- **Personajes de 24x32** (antes 16x16): proporcion de personaje de simulador, con tres
  tonos de piel, dos de pelo, mangas marcadas, ojos y boca de un pixel, cuatro peinados y
  cinco accesorios (incluida la taza de cafe).
- **Salas con planta de oficina real**: cuatro puestos con cubiculo (panel lateral, mesa,
  monitor de espaldas, teclado), zona de descanso con sofa, mesa baja y planta, ventanas en
  la pared, y mobiliario propio de cada departamento.
- **Los agentes se dibujan sentados tras su mesa** mediante el orden de capas
  (sala -> agentes -> mesas); los puestos libres muestran la silla vacia.
- **Herramienta nueva**: `npm --prefix frontend run preview` genera un PNG con los
  personajes, el mobiliario y la planta de una sala, para revisar el pixel art sin
  navegador. Fue lo que permitio ver y corregir los ojos, los brazos y el color de la planta.

### Estado de las fuentes externas (sondeado, no supuesto)

| Fuente | Hallazgo |
| --- | --- |
| Google Trends `/trends/api/autocomplete` | Funciona: devuelve temas reales con sus identificadores `/g/`. |
| Google Trends `/trends/api/explore` + `widgetdata` | Existe, pero Google responde **429** desde IP de servidor: puede fallar de forma intermitente. |
| Google Trends `/trends/api/dailytrends` | 404: ese endpoint ya no existe. |
| AliExpress `api-sg.aliexpress.com/sync` | Vivo: sin credenciales responde `InvalidAppKey`. |
| Alibaba `openapi-api.alibaba.com/rest` | Vivo: valida `app_key` y luego `timestamp` (parametros en `snake_case`). |

## Decisiones tecnicas

1. **npm** en los tres `package.json` (lo exige la especificacion). `concurrently` en la
   raiz permite `npm run dev`; `dev:backend` y `dev:frontend` funcionan por separado.
2. **Backend en JavaScript ESM** con Express 5. Las rutas no usan wildcards sueltos
   porque Express 5 cambio el analizador de rutas.
3. **Datos simulados en modulos independientes** (`backend/src/mocks/`) con IDs estables;
   el estado mutable vive en `src/store.js`. Lo que debe ser estable se genera con
   semillas fijas para que dos vistas nunca muestren cifras distintas.
4. **Simulacion en memoria** con un unico temporizador por ejecucion, registrado en
   `services/timers.js` y marcado con `unref()`; se cancela al pausar, reiniciar,
   finalizar o apagar el servidor.
5. **Angular 22 standalone + signals, sin zone.js.** Estado asincrono con `AsyncState`
   (carga, error, vacio) y cancelacion de todo sondeo al destruir el componente.
6. **Pixel art top-down** (suelo cenital, personajes y muebles frontales) como unica
   vista, mantenida en todo el escenario. Sprites **procedurales** en matrices de
   pixeles: cero imagenes remotas y cero binarios en el repositorio.
7. **PixiJS solo en la oficina**, con un unico `Application` por vista y el resto de las
   vistas en Angular + CSS/SVG. El chunk de PixiJS queda fuera de la carga inicial.
8. **Graficos con un sistema propio**: un solo eje por figura, paleta de series validada
   sobre la superficie real de las tarjetas, un tono cuando la medida es unica, estados
   con glifo + texto + color, y tabla de datos alternativa.

## Limitaciones del entorno encontradas

- **El puerto 4200 estaba ocupado** por otra aplicacion de la maquina, asi que la
  verificacion del frontend se hizo en el 4300
  (`npm start -- --port 4300` anadiendo ese origen a `CORS_ORIGINS`). El README explica
  como cambiar de puerto.
- **`corepack enable` falla con EPERM** en este equipo, pero el proyecto usa `npm`, asi
  que no afecta.
- El escenario de PixiJS necesita WebGL: no se puede probar en jsdom, por lo que la
  oficina se valido por build y comprobacion de tipos, con manejo explicito del error en
  pantalla si el navegador no ofrece WebGL.
