import type { MetaLeadGraphResponse } from '@crm/contracts';

/**
 * Respuestas de la Graph API inventadas, para poder probar la ingesta **sin app de Meta aprobada**.
 *
 * ## Por qué son módulos TypeScript y no ficheros `.json`
 *
 * `apps/api/tsconfig.json` emite solo los ficheros `.ts` que están bajo `src/` a `dist/`. Un `.json`
 * importado con atributo de import **no se copia**, así que la compilación pasaría y el fallo
 * aparecería únicamente en el runtime desplegado — el peor sitio donde enterarse. Un módulo `.ts` se
 * copia siempre.
 *
 * ## Por qué son un mapa y no objetos sueltos
 *
 * El cliente de fixtures busca por `leadgen_id`. Tener las claves a la vista en un solo sitio hace
 * evidente qué ids existen, y el error de un id desconocido puede listarlos.
 *
 * ## Aviso sobre el contenido
 *
 * Los datos de las personas son **inventados** (+57 300 000 0000 y nombres de ejemplo). No deben
 * parecerse a nadie real: estos fixtures acaban en logs, capturas y pruebas compartidas.
 *
 * `lead-1` es el id que usa el sobre de prueba del webhook en `meta-webhook.controller.test.ts`, de
 * forma que el camino «webhook → Graph API» se puede recorrer entero en modo `fixture`.
 */
export const LEADS_DE_PRUEBA: Readonly<Record<string, MetaLeadGraphResponse>> = {
  /** Caso feliz: formulario con teléfono, email y consentimiento marcado. */
  'lead-1': {
    id: 'lead-1',
    created_time: '2025-10-01T12:00:00+0000',
    form_id: '999',
    ad_id: '111',
    adset_id: '222',
    campaign_id: '333',
    platform: 'facebook',
    field_data: [
      { name: 'full_name', values: ['Ana Pérez'] },
      { name: 'phone_number', values: ['+573000000000'] },
      { name: 'email', values: ['ana@ejemplo.test'] },
    ],
    custom_disclaimer_responses: [{ checkbox_key: 'marketing', is_checked: true }],
  },

  /**
   * El caso que más importa: **sin ninguna evidencia de consentimiento**.
   *
   * `custom_disclaimer_responses` no viene, y eso NO significa que la persona no aceptara: significa
   * que Meta no nos lo puede acreditar. La ingesta debe guardarlo con `granted:false` y bloquear el
   * marketing (`docs/security.md` §10.7). Este fixture existe para que ese camino esté probado.
   */
  'lead-2': {
    id: 'lead-2',
    created_time: '2025-10-01T12:05:00+0000',
    form_id: '999',
    platform: 'instagram',
    field_data: [
      { name: 'full_name', values: ['Beto Gómez'] },
      { name: 'phone_number', values: ['+573000000001'] },
    ],
  },

  /**
   * Lead sin teléfono: Meta no obliga a pedirlo.
   *
   * Sin teléfono no hay enlace `wa.me` posible, así que la pantalla de leads debe explicarlo en vez de
   * mostrar un botón que no lleva a ninguna parte.
   */
  'lead-3': {
    id: 'lead-3',
    created_time: '2025-10-01T12:10:00+0000',
    form_id: '998',
    platform: 'facebook',
    field_data: [
      { name: 'full_name', values: ['Carla Ruiz'] },
      { name: 'email', values: ['carla@ejemplo.test'] },
    ],
  },

  /**
   * Consentimiento **explícitamente denegado**, que es distinto de no tener evidencia.
   *
   * La casilla existe y está desmarcada: aquí sí sabemos lo que la persona decidió, y decidió que no.
   */
  'lead-4': {
    id: 'lead-4',
    created_time: '2025-10-01T12:15:00+0000',
    form_id: '998',
    platform: 'facebook',
    field_data: [
      { name: 'full_name', values: ['Dani Mora'] },
      { name: 'phone_number', values: ['+573000000002'] },
      { name: 'email', values: ['dani@ejemplo.test'] },
    ],
    custom_disclaimer_responses: [{ checkbox_key: 'marketing', is_checked: false }],
  },

  /**
   * Valores de forma inesperada: `values` trae un número y un booleano, no texto.
   *
   * Meta modela así los campos no textuales, y un código que asuma `string` se rompería con un lead
   * real. Este fixture lo mantiene a la vista.
   */
  'lead-5': {
    id: 'lead-5',
    created_time: '2025-10-01T12:20:00+0000',
    form_id: '997',
    platform: 'facebook',
    field_data: [
      { name: 'full_name', values: ['Eva Salas'] },
      { name: 'phone_number', values: ['+573000000003'] },
      { name: 'numero_de_empleados', values: [12] },
      { name: 'acepta_terminos', values: [true] },
    ],
  },
};

/** Los ids disponibles, ordenados. Se usan en el mensaje de error de un id desconocido. */
export const IDS_DE_PRUEBA: readonly string[] = Object.keys(LEADS_DE_PRUEBA).sort();
