/**
 * Investigacion de mercado: informes que alimentan la validacion de producto.
 * `rsc-000x` es referenciado desde `products.js`, de modo que cada producto tiene
 * su informe de origen.
 */
import { isoDaysAgo } from '../utils/time.js';

export const RESEARCH_TYPES = ['market', 'trends', 'competitors', 'validation'];

export const researchReports = [
  {
    id: 'rsc-0001',
    productId: 'prd-001',
    type: 'market',
    title: 'Mercado de perifericos para estudio en casa',
    summary:
      'Segmento en crecimiento moderado con demanda estable y estacionalidad marcada en septiembre y enero. El tramo medio carece de propuestas con servicio postventa claro.',
    status: 'published',
    authorAgentId: 'agt-002',
    publishedAt: isoDaysAgo(36),
    metrics: [
      { label: 'TAM', value: '148 M EUR' },
      { label: 'SAM', value: '22 M EUR' },
      { label: 'SOM 12 meses', value: '1,4 M EUR' },
      { label: 'Crecimiento anual', value: '6%' },
    ],
    findings: [
      'La demanda se concentra en el tramo de 100 a 180 EUR, justo donde hay menos oferta diferenciada.',
      'El 62% de las busquedas incluyen terminos de servicio o garantia, no solo de precio.',
      'La estacionalidad empuja el volumen un 23% por encima de la media en septiembre.',
    ],
    sources: [
      { title: 'Panel de busquedas agregado (simulado)', type: 'panel' },
      { title: 'Encuesta a 480 profesionales remotos', type: 'encuesta' },
      { title: 'Catalogo publico de 12 distribuidores', type: 'catalogo' },
    ],
    series: [
      { label: 'May', value: 42 },
      { label: 'Jun', value: 47 },
      { label: 'Jul', value: 51 },
      { label: 'Ago', value: 58 },
      { label: 'Sep', value: 74 },
      { label: 'Oct', value: 69 },
    ],
  },
  {
    id: 'rsc-0002',
    productId: 'prd-002',
    type: 'trends',
    title: 'Tendencias en teclados compactos 75%',
    summary:
      'La preferencia por formatos compactos crece entre perfiles tecnicos, con el ruido de pulsacion como principal freno en oficinas compartidas.',
    status: 'published',
    authorAgentId: 'agt-004',
    publishedAt: isoDaysAgo(27),
    metrics: [
      { label: 'Crecimiento consultas', value: '+14% T/T' },
      { label: 'Intencion de compra', value: '38%' },
      { label: 'Precio percibido justo', value: '95-125 EUR' },
    ],
    findings: [
      'El formato 75% gana cuota frente al 60% por conservar teclas de funcion.',
      'El ruido de pulsacion es el primer motivo de descarte en oficinas compartidas.',
      'Los compradores valoran poder cambiar switches sin soldar.',
    ],
    sources: [
      { title: 'Serie de consultas normalizada (simulada)', type: 'panel' },
      { title: 'Analisis de 900 resenas publicas', type: 'resenas' },
    ],
    series: [
      { label: 'May', value: 30 },
      { label: 'Jun', value: 34 },
      { label: 'Jul', value: 39 },
      { label: 'Ago', value: 46 },
      { label: 'Sep', value: 55 },
      { label: 'Oct', value: 61 },
    ],
  },
  {
    id: 'rsc-0003',
    productId: 'prd-001',
    type: 'competitors',
    title: 'Matriz competitiva de soportes de monitor',
    summary:
      'Doce competidores analizados. Tres dominan el tramo premium y el tramo medio queda sin propuesta clara de servicio y garantia.',
    status: 'published',
    authorAgentId: 'agt-003',
    publishedAt: isoDaysAgo(33),
    metrics: [
      { label: 'Competidores', value: '12' },
      { label: 'Precio medio', value: '96 EUR' },
      { label: 'Huecos detectados', value: '3' },
    ],
    findings: [
      'Ningun competidor del tramo medio ofrece garantia superior a 2 anos.',
      'El tiempo de entrega medio del sector es de 6 dias; por debajo de 3 es diferencial.',
      'La comunicacion del sector se centra en especificaciones, no en resultado.',
    ],
    sources: [{ title: 'Analisis de 12 fichas de producto publicas', type: 'benchmark' }],
    competitors: [
      { name: 'Marca Alfa', price: 119, strength: 'Distribucion', gap: 'Sin garantia extendida' },
      { name: 'Marca Beta', price: 89, strength: 'Precio', gap: 'Servicio postventa lento' },
      { name: 'Marca Gamma', price: 149, strength: 'Marca', gap: 'Entrega de 8 dias' },
      { name: 'Marca Delta', price: 79, strength: 'Volumen', gap: 'Materiales fragiles' },
    ],
    series: [
      { label: 'Marca Alfa', value: 119 },
      { label: 'Marca Beta', value: 89 },
      { label: 'Marca Gamma', value: 149 },
      { label: 'Marca Delta', value: 79 },
      { label: 'Nuestra oferta', value: 129 },
    ],
  },
  {
    id: 'rsc-0004',
    productId: 'prd-003',
    type: 'validation',
    title: 'Validacion de silla ergonomica Norte',
    summary:
      'Score 86/100. El mejor margen del trimestre con riesgo de suministro medio por dependencia de un unico fabricante.',
    status: 'published',
    authorAgentId: 'agt-005',
    publishedAt: isoDaysAgo(34),
    metrics: [
      { label: 'Score', value: '86/100' },
      { label: 'Margen', value: '36%' },
      { label: 'Demanda', value: '69/100' },
      { label: 'Riesgo suministro', value: 'Medio' },
    ],
    findings: [
      'El ticket medio del segmento permite absorber un coste logistico alto.',
      'La garantia de 5 anos es el argumento mas citado en la comparativa.',
      'Conviene negociar un segundo proveedor antes de escalar el volumen.',
    ],
    sources: [{ title: 'Simulacion de costes y margen', type: 'modelo' }],
    series: [
      { label: 'Coste', value: 184 },
      { label: 'Precio', value: 349 },
      { label: 'Margen', value: 165 },
    ],
  },
  {
    id: 'rsc-0005',
    productId: 'prd-004',
    type: 'market',
    title: 'Mercado de escritorios regulables electricos',
    summary:
      'Demanda alta pero competencia alta y riesgo de suministro elevado: el margen depende de negociar volumen con el fabricante.',
    status: 'published',
    authorAgentId: 'agt-002',
    publishedAt: isoDaysAgo(17),
    metrics: [
      { label: 'TAM', value: '310 M EUR' },
      { label: 'Demanda', value: '88/100' },
      { label: 'Competencia', value: 'Alta' },
      { label: 'Margen estimado', value: '29%' },
    ],
    findings: [
      'La demanda crece un 11% trimestral, el mayor crecimiento del catalogo analizado.',
      'El coste logistico por unidad reduce el margen por debajo del umbral objetivo del 32%.',
      'La preventa permitiria validar demanda sin inmovilizar stock.',
    ],
    sources: [
      { title: 'Serie de consultas normalizada (simulada)', type: 'panel' },
      { title: 'Simulacion de costes de importacion', type: 'modelo' },
    ],
    series: [
      { label: 'May', value: 52 },
      { label: 'Jun', value: 58 },
      { label: 'Jul', value: 64 },
      { label: 'Ago', value: 71 },
      { label: 'Sep', value: 79 },
      { label: 'Oct', value: 88 },
    ],
  },
  {
    id: 'rsc-0006',
    productId: 'prd-005',
    type: 'validation',
    title: 'Validacion de lampara Halo Focus',
    summary:
      'Score 77/100. Margen alto (44%) y competencia baja, con demanda mas contenida que el resto del catalogo.',
    status: 'published',
    authorAgentId: 'agt-005',
    publishedAt: isoDaysAgo(7),
    metrics: [
      { label: 'Score', value: '77/100' },
      { label: 'Margen', value: '44%' },
      { label: 'Demanda', value: '63/100' },
      { label: 'Riesgo suministro', value: 'Bajo' },
    ],
    findings: [
      'Es el producto con mejor margen unitario del catalogo actual.',
      'Funciona bien como complemento en la oferta Studio.',
      'Conviene probarlo como producto de entrada en trafico organico.',
    ],
    sources: [{ title: 'Simulacion de costes y margen', type: 'modelo' }],
    series: [
      { label: 'Coste', value: 27 },
      { label: 'Precio', value: 64 },
      { label: 'Margen', value: 37 },
    ],
  },
  {
    id: 'rsc-0007',
    productId: 'prd-006',
    type: 'market',
    title: 'Mercado de webcams 4K (investigacion en curso)',
    summary:
      'Margen estimado insuficiente frente al riesgo de suministro. Se mantiene en investigacion sin pasar a oferta.',
    status: 'draft',
    authorAgentId: 'agt-002',
    publishedAt: isoDaysAgo(3),
    metrics: [
      { label: 'TAM', value: '96 M EUR' },
      { label: 'Margen estimado', value: '22%' },
      { label: 'Competencia', value: 'Alta' },
    ],
    findings: [
      'El segmento esta copado por marcas con economias de escala dificiles de igualar.',
      'El margen queda por debajo del umbral minimo del 32% definido por el sistema.',
    ],
    sources: [{ title: 'Analisis de precios publicos', type: 'benchmark' }],
    series: [
      { label: 'May', value: 44 },
      { label: 'Jun', value: 43 },
      { label: 'Jul', value: 41 },
      { label: 'Ago', value: 42 },
      { label: 'Sep', value: 40 },
      { label: 'Oct', value: 39 },
    ],
  },
];

export const researchById = new Map(researchReports.map((report) => [report.id, report]));
