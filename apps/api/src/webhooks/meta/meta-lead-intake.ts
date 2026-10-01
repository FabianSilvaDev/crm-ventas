/**
 * Puerto de entrada de leads de Meta.
 *
 * El controlador **no sabe** qué pasa después de recibir un lead: solo entrega el evento a esta
 * interfaz y traduce el resultado a la respuesta que espera Meta. Esa indirección es la que permite
 * en esta rebanada tener un webhook verificado y probado **sin base de datos**, y sustituir la
 * implementación por la real (resolución de identidad, lead, testimonio de consentimiento,
 * `audit_logs`) sin tocar el controlador ni una línea.
 *
 * Mientras no exista la implementación con base de datos, la única que hay es un doble de
 * desarrollo, y se llama así precisamente para que nadie lo confunda con persistencia.
 */
export const META_LEAD_INTAKE = Symbol('crm:meta-lead-intake');

/**
 * Un lead tal como lo anuncia Meta en el webhook.
 *
 * Son **solo los identificadores y la atribución**: los datos de la persona (nombre, teléfono,
 * email) no vienen aquí, se piden aparte al Graph API con el `leadgenId`. Esa separación importa
 * porque el webhook no trae PII, y por eso se puede registrar su recepción sin problema.
 */
export interface MetaLeadEvent {
  readonly leadgenId: string;
  readonly formId: string | null;
  readonly pageId: string | null;
  readonly adId: string | null;
  readonly adsetId: string | null;
  readonly campaignId: string | null;
  readonly createdTime: string | null;
  /**
   * El `change` completo, tal cual llegó.
   *
   * Se conserva crudo porque es la única copia fiel de la atribución que Meta nos dio, y porque
   * `docs/database.md` la guarda en `meta_lead_submissions.raw_payload` para poder reconstruir qué
   * se recibió exactamente cuando algo no cuadre.
   */
  readonly rawChange: unknown;
}

/**
 * Qué pasó con el evento.
 *
 * `duplicate` **no es un error**: significa que ese `leadgenId` ya estaba, y la respuesta sigue
 * siendo `200` (`docs/api.md` §8.4). La idempotencia real la da el `UNIQUE(meta_lead_id)` de la base
 * de datos, no este proceso.
 */
export type MetaLeadIntakeResult = 'stored' | 'duplicate';

export interface MetaLeadIntake {
  intake(event: MetaLeadEvent): Promise<MetaLeadIntakeResult>;
}
