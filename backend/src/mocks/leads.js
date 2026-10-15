/**
 * Leads simulados. Se generan de forma determinista a partir de un catalogo de
 * organizaciones ficticias y una semilla fija: la misma consulta devuelve siempre
 * los mismos leads, sus puntuaciones y su valor estimado (seccion 13 del prompt).
 *
 * Todas las empresas, personas, correos y telefonos son inventados.
 */
import { createRandom, seedFrom } from '../utils/random.js';
import { isoDaysAgo, makeId } from '../utils/time.js';

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
export const LEAD_ORIGINS = ['busqueda', 'social', 'organico', 'referido', 'display'];

/** Organizaciones ficticias usadas como semilla de los leads. */
const ORGANIZATIONS = [
  { company: 'Estudio Noroeste', industry: 'Diseno', size: '3-10', country: 'ES', city: 'A Coruna', contact: 'Marta Cela', role: 'Directora creativa', campaignId: 'cmp-0001', offerId: 'off-0001', origin: 'busqueda' },
  { company: 'Oficina Vela', industry: 'Consultoria', size: '11-50', country: 'ES', city: 'Valencia', contact: 'Ruben Alcaraz', role: 'Responsable de operaciones', campaignId: 'cmp-0001', offerId: 'off-0001', origin: 'social' },
  { company: 'Taller Bruma', industry: 'Arquitectura', size: '3-10', country: 'ES', city: 'Bilbao', contact: 'Nerea Igartua', role: 'Socia fundadora', campaignId: 'cmp-0003', offerId: 'off-0003', origin: 'display' },
  { company: 'Pixelaria', industry: 'Videojuegos', size: '11-50', country: 'ES', city: 'Madrid', contact: 'Diego Sanchis', role: 'Productor', campaignId: 'cmp-0002', offerId: 'off-0002', origin: 'social' },
  { company: 'Cobalto Studio', industry: 'Animacion', size: '3-10', country: 'ES', city: 'Barcelona', contact: 'Laia Ferrer', role: 'Directora de arte', campaignId: 'cmp-0002', offerId: 'off-0002', origin: 'social' },
  { company: 'Grupo Litoral', industry: 'Logistica', size: '51-200', country: 'ES', city: 'Cadiz', contact: 'Alvaro Mena', role: 'Jefe de compras', campaignId: 'cmp-0003', offerId: 'off-0003', origin: 'busqueda' },
  { company: 'Helio Labs', industry: 'Software', size: '11-50', country: 'PT', city: 'Porto', contact: 'Ines Rocha', role: 'Engineering manager', campaignId: 'cmp-0001', offerId: 'off-0001', origin: 'organico' },
  { company: 'Casa Mirlo', industry: 'Interiorismo', size: '1-2', country: 'ES', city: 'Sevilla', contact: 'Pablo Rueda', role: 'Fundador', campaignId: 'cmp-0004', offerId: 'off-0005', origin: 'organico' },
  { company: 'Nodo Formacion', industry: 'Educacion', size: '11-50', country: 'ES', city: 'Zaragoza', contact: 'Carmen Oliete', role: 'Coordinadora academica', campaignId: 'cmp-0001', offerId: 'off-0001', origin: 'referido' },
  { company: 'Delta Audio', industry: 'Produccion musical', size: '3-10', country: 'ES', city: 'Granada', contact: 'Sergio Palma', role: 'Tecnico de estudio', campaignId: 'cmp-0004', offerId: 'off-0005', origin: 'organico' },
  { company: 'Red Montevideo', industry: 'Marketing', size: '11-50', country: 'UY', city: 'Montevideo', contact: 'Valentina Sosa', role: 'Head of growth', campaignId: 'cmp-0002', offerId: 'off-0002', origin: 'display' },
  { company: 'Clinica Auria', industry: 'Salud', size: '51-200', country: 'ES', city: 'Murcia', contact: 'Tomas Belmonte', role: 'Responsable de administracion', campaignId: 'cmp-0003', offerId: 'off-0003', origin: 'busqueda' },
];

const STATUS_CYCLE = [
  'won', 'qualified', 'contacted', 'proposal', 'new', 'lost',
  'won', 'contacted', 'qualified', 'new', 'proposal', 'contacted',
  'lost', 'qualified', 'won', 'new', 'contacted', 'proposal',
];

const NEXT_STEP = {
  new: 'Cualificar y confirmar encaje',
  contacted: 'Segundo contacto de la secuencia',
  qualified: 'Enviar propuesta con niveles',
  proposal: 'Resolver objeciones y cerrar',
  won: 'Onboarding y verificacion de entrega',
  lost: 'Reactivar en el proximo ciclo',
};

/**
 * Construye la traza del lead. Los dias se cuentan hacia atras desde su creacion
 * (`ageDays`), nunca desde la fecha de referencia, para que la traza nunca empiece
 * antes que el propio lead.
 */
const buildTimeline = (status, ageDays, ownerAgentId) => {
  const steps = [
    { type: 'created', note: 'Lead captado desde la campana', agentId: null, offsetDays: 0 },
    { type: 'qualified', note: 'Puntuacion calculada por QUALIFY', agentId: 'agt-015', offsetDays: 1 },
    { type: 'contacted', note: 'Primer contacto enviado por CLOSER', agentId: 'agt-016', offsetDays: 2 },
    { type: 'proposal', note: 'Propuesta enviada', agentId: 'agt-016', offsetDays: 4 },
    { type: 'won', note: 'Oportunidad ganada', agentId: ownerAgentId, offsetDays: 6 },
    { type: 'lost', note: 'Oportunidad perdida: sin presupuesto', agentId: ownerAgentId, offsetDays: 6 },
  ];

  const reachable = {
    new: ['created'],
    contacted: ['created', 'qualified', 'contacted'],
    qualified: ['created', 'qualified'],
    proposal: ['created', 'qualified', 'contacted', 'proposal'],
    won: ['created', 'qualified', 'contacted', 'proposal', 'won'],
    lost: ['created', 'qualified', 'contacted', 'proposal', 'lost'],
  }[status];

  return steps
    .filter((step) => reachable.includes(step.type))
    .map((step, index) => ({
      id: `${index + 1}`,
      type: step.type,
      note: step.note,
      agentId: step.agentId,
      at: isoDaysAgo(Math.max(0, ageDays - step.offsetDays)),
    }));
};

const buildLeads = () => {
  const random = createRandom(seedFrom('leads-v1'));
  const total = 42;

  return Array.from({ length: total }, (_, index) => {
    const organization = ORGANIZATIONS[index % ORGANIZATIONS.length];
    const status = STATUS_CYCLE[index % STATUS_CYCLE.length];
    const ageDays = 4 + (index % 30);
    const score = random.int(24, 97);
    const units = random.int(1, 6);
    const ticket = { 'off-0001': 129, 'off-0002': 109, 'off-0003': 349, 'off-0005': 64 }[organization.offerId] ?? 100;
    const ownerAgentId = status === 'new' ? 'agt-015' : 'agt-016';
    const timeline = buildTimeline(status, ageDays, ownerAgentId);

    return {
      id: makeId('led', index + 1),
      contact: {
        name: organization.contact,
        role: organization.role,
        email: `${organization.contact.split(' ')[0].toLowerCase()}.${organization.contact.split(' ')[1].toLowerCase()}@${organization.company.split(' ')[0].toLowerCase()}.demo.test`,
        phone: `+34 6${random.int(10, 99)} ${random.int(100, 999)} ${random.int(100, 999)}`,
      },
      company: {
        name: organization.company,
        industry: organization.industry,
        size: organization.size,
        country: organization.country,
        city: organization.city,
      },
      campaignId: organization.campaignId,
      offerId: organization.offerId,
      productId: null, // se resuelve en el servicio a partir de la oferta
      origin: organization.origin,
      status,
      score,
      priority: score >= 75 ? 'alta' : score >= 50 ? 'media' : 'baja',
      value: units * ticket,
      units,
      currency: 'EUR',
      ownerAgentId,
      nextStep: NEXT_STEP[status],
      createdAt: isoDaysAgo(ageDays),
      lastContactAt: timeline[timeline.length - 1].at,
      timeline,
      tags: [organization.industry.toLowerCase(), organization.size],
      reachedGoal: status === 'won',
    };
  });
};

export const leads = buildLeads();
