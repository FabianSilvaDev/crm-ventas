import { z } from 'zod';

import { emailSchema, identitySummarySchema, phoneE164Schema } from './identity.js';

/**
 * Lead: la oportunidad comercial. Columnas y enums copiados de `docs/database.md` §3 y
 * `docs/api.md` §9.2; **no se inventan valores**.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enums del modelo
// ─────────────────────────────────────────────────────────────────────────────

export const leadStatusSchema = z.enum([
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'UNQUALIFIED',
  'CONVERTED',
  'LOST',
]);

export type LeadStatus = z.infer<typeof leadStatusSchema>;

/** De dónde vino el lead, en términos de pago (`docs/database.md` §3). */
export const leadSourceSchema = z.enum(['organic', 'paid', 'referral', 'manual', 'social']);

export type LeadSource = z.infer<typeof leadSourceSchema>;

/** Por qué vía concreta entró (`docs/database.md` §3, ADR-016). */
export const leadChannelSchema = z.enum([
  'META_LEAD_FORM',
  'LANDING_FORM',
  'WHATSAPP_CLICK',
  'MESSENGER',
  'ORGANIC',
  'MANUAL',
]);

export type LeadChannel = z.infer<typeof leadChannelSchema>;

/** Cómo se cerró. Dato de primera clase, no una nota (`docs/database.md` §3, ADR-016). */
export const closedViaSchema = z.enum([
  'WHATSAPP',
  'MESSENGER',
  'INSTAGRAM_DM',
  'PHONE',
  'SITE',
  'PRESENCIAL',
]);

export type ClosedVia = z.infer<typeof closedViaSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Consentimiento (Ley 1581)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hay **dos** formas de consentimiento en este proyecto y se llaman distinto a propósito, porque
 * los documentos las describen en convenciones distintas y confundirlas es un error caro:
 *
 * | Schema | Convención | Dónde vive | Fuente |
 * |---|---|---|---|
 * | `consentSchema` | camelCase | Cuerpo de la respuesta HTTP | `docs/api.md` §1.3 |
 * | `storedConsentTestimonySchema` | snake_case | Columna `leads.consent` (jsonb) | `docs/security.md` §10.2 |
 */

/** Finalidades autorizadas. `MARKETING` es la que se bloquea cuando no hay consentimiento. */
export const consentPurposeSchema = z.enum(['CONTACTO_COMERCIAL', 'MARKETING']);

export type ConsentPurpose = z.infer<typeof consentPurposeSchema>;

/** Vía por la que se recogió el consentimiento. */
export const consentChannelSchema = z.enum([
  'META_LEAD_FORM',
  'LANDING_FORM',
  'WHATSAPP_CLICK',
  'MANUAL',
]);

export type ConsentChannel = z.infer<typeof consentChannelSchema>;

/**
 * Qué evidencia tenemos de que la persona aceptó.
 *
 * Esta enumeración es la pieza que la Ley 1581 hace necesaria y que `docs/security.md` §10.7 no
 * contemplaba: la norma se escribió pensando en un formulario propio, donde el checkbox es nuestro
 * y por tanto verificable. En un formulario instantáneo de Meta **el checkbox vive en Meta** y la
 * Graph API solo devuelve su texto si el formulario usó *custom disclaimer*. Sin este campo, un
 * consentimiento no verificado y uno verificado se guardarían igual, que es exactamente lo que hay
 * que poder distinguir.
 */
export const consentEvidenceSchema = z.enum([
  /** Meta devolvió el texto del disclaimer: sabemos qué aceptó la persona y cuándo. */
  'META_CUSTOM_DISCLAIMER',
  /** El formulario no usó custom disclaimer. No hay evidencia: se asume NO consentido. */
  'NO_DISCLAIMER_IN_FORM',
  /** Checkbox de un formulario nuestro (`apps/site`), verificable por nosotros. */
  'OWN_FORM_CHECKBOX',
]);

export type ConsentEvidence = z.infer<typeof consentEvidenceSchema>;

/**
 * Consentimiento tal como se **guarda** en `leads.consent` (jsonb, snake_case).
 *
 * Es un **testimonio, no un booleano** (`docs/security.md` §10.2): lo que se conserva es qué texto
 * se mostró, cuándo y con qué versión de política, para poder demostrarlo después.
 *
 * Dos diferencias deliberadas con el documento, ambas por la vía de Meta y ambas registradas en
 * `docs/security.md` al cerrar la rebanada:
 *
 * - **`granted` y `evidence`** no están en el documento. Se añaden porque el caso de Meta necesita
 *   distinguir «aceptó» de «no consta», y ese segundo caso no se puede representar sin ellos.
 * - **`ip_hash` y `user_agent` van a `null` cuando el origen es Meta.** No es un olvido: en una
 *   entrega de Meta, la IP y el User-Agent que recibimos son **de Meta**, no de la persona a la que
 *   pertenecen los datos. Hashearlos produciría un dato con aspecto de prueba sin serlo. Se
 *   conservan para formularios propios, donde sí son del titular.
 */
export const storedConsentTestimonySchema = z.object({
  granted: z.boolean(),
  evidence: consentEvidenceSchema,
  /** Texto exacto que la persona vio. `null` cuando no hay evidencia que citar. */
  text: z.string().min(1).nullable(),
  granted_at: z.iso.datetime().nullable(),
  channel: consentChannelSchema,
  form_id: z.string().nullable(),
  purposes: z.array(consentPurposeSchema),
  policy_version: z.string().min(1),
  ip_hash: z.string().nullable(),
  user_agent: z.string().nullable(),
});

export type StoredConsentTestimony = z.infer<typeof storedConsentTestimonySchema>;

/** Consentimiento tal como viaja en la respuesta HTTP (camelCase, `docs/api.md` §10.1). */
export const consentSchema = z.object({
  granted: z.boolean(),
  basis: z.string(),
  textVersion: z.string(),
  capturedAt: z.iso.datetime().nullable(),
});

export type Consent = z.infer<typeof consentSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Recurso
// ─────────────────────────────────────────────────────────────────────────────

export const leadSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  identityId: z.uuid(),

  /**
   * Nombre tal como lo escribió la persona en el formulario de Meta. `identities` no tiene columna
   * de nombre: su sitio definitivo es `contacts`, que esta rebanada no crea. Se expone aquí como
   * dato **crudo del formulario**, no como campo del modelo de personas.
   */
  contactName: z.string().nullable(),

  status: leadStatusSchema,
  source: leadSourceSchema,
  channel: leadChannelSchema,

  score: z.number().int().nullable(),
  ownerUserId: z.uuid().nullable(),

  /** «Métrica clave» del funnel (`docs/database.md` §3): cuándo se respondió por primera vez. */
  firstResponseAt: z.iso.datetime().nullable(),
  convertedAt: z.iso.datetime().nullable(),
  closedVia: closedViaSchema.nullable(),

  consent: consentSchema.nullable(),

  createdAt: z.iso.datetime(),
  identity: identitySummarySchema,
});

export type Lead = z.infer<typeof leadSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Listado
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filtros del listado. `limit` se coacciona porque la query HTTP solo transporta texto; el cuerpo
 * de una petición, en cambio, **no** se coacciona nunca (`docs/security.md` §11.3).
 */
export const leadListQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
  status: leadStatusSchema.optional(),
  channel: leadChannelSchema.optional(),
});

export type LeadListQuery = z.infer<typeof leadListQuerySchema>;

/** Paginación por cursor, no por `offset`: los leads entran continuamente y el `offset` duplica. */
export const pageInfoSchema = z.object({
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
});

export type PageInfo = z.infer<typeof pageInfoSchema>;

export const leadListResponseSchema = z.object({
  items: z.array(leadSchema),
  pageInfo: pageInfoSchema,
});

export type LeadListResponse = z.infer<typeof leadListResponseSchema>;

/**
 * Cuerpo de `POST /leads/:id/first-response`.
 *
 * Existe porque `leads.first_response_at` es la métrica clave del funnel y **`docs/api.md` §9.2 no
 * tenía ningún endpoint que la escribiera**: sin él, la columna nace y muere nula. La transición es
 * idempotente por naturaleza: solo escribe si `first_response_at IS NULL`.
 */
export const firstResponseRequestSchema = z.strictObject({
  /** Si además se cierra la conversación, por qué vía (ADR-016). */
  closedVia: closedViaSchema.optional(),
});

export type FirstResponseRequest = z.infer<typeof firstResponseRequestSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Escritura
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identidad adjunta a un lead nuevo. Hoy solo email y teléfono; el nombre se toma del canal de
 * origen (p. ej. el formulario de Meta) y no se solicita en la creación manual del MVP.
 */
export const leadIdentityCreateSchema = z.strictObject({
  email: emailSchema.nullable().default(null),
  phone: phoneE164Schema.nullable().default(null),
});

export type LeadIdentityCreate = z.infer<typeof leadIdentityCreateSchema>;

export const leadCreateSchema = z.strictObject({
  identity: leadIdentityCreateSchema,
  status: leadStatusSchema.default('NEW'),
  source: leadSourceSchema,
  channel: leadChannelSchema,
  ownerUserId: z.uuid().nullable().default(null),
  score: z.number().int().min(0).max(100).nullable().default(null),
  consent: consentSchema.nullable().default(null),
});

export type LeadCreate = z.infer<typeof leadCreateSchema>;

/**
 * Actualización parcial de un lead. No se toca la identidad desde este endpoint: la fusión de
 * identidades tiene su propia ruta (`POST /identities/merge`).
 */
export const leadUpdateSchema = z.strictObject({
  status: leadStatusSchema.optional(),
  ownerUserId: z.uuid().nullable().optional(),
  score: z.number().int().min(0).max(100).nullable().optional(),
  closedVia: closedViaSchema.nullable().optional(),
  consent: consentSchema.nullable().optional(),
});

export type LeadUpdate = z.infer<typeof leadUpdateSchema>;

/**
 * Cuerpo de `POST /leads/:id/convert`. En el MVP no requiere campos: convierte el lead a
 * contacto + oportunidad con los datos que ya tiene.
 */
export const leadConvertRequestSchema = z.strictObject({}).optional().default({});

export type LeadConvertRequest = z.infer<typeof leadConvertRequestSchema>;
