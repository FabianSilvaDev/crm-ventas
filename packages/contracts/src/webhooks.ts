import { z } from 'zod';

/**
 * Contrato de los webhooks de Meta Lead Ads (`docs/api.md` §8, ADR-017).
 *
 * ## Regla de estrictez, y por qué aquí es distinta
 *
 * En el resto del contrato las entradas son **nuestras** y se validan con `strictObject`: si un
 * cliente manda un campo de más, es un error suyo y queremos el `422`.
 *
 * **Aquí el emisor es Meta.** Aplicar `strictObject` significaría que el día que Meta añada un
 * campo a su payload —cosa que hace sin avisar— la ingesta de leads deja de funcionar por un
 * cambio que no controlamos. Por eso estos schemas son **loose**: exigimos los campos de los que
 * dependemos y dejamos pasar el resto.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Handshake de verificación (GET)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Query del handshake que Meta envía **una sola vez**, al configurar el webhook:
 * `?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…`.
 *
 * Los nombres llevan punto literal (`hub.mode`), que es lo que Meta manda de verdad. Es loose
 * porque si Meta añadiera un parámetro, un `422` aquí dejaría la verificación imposible.
 */
export const metaWebhookVerifyQuerySchema = z.looseObject({
  'hub.mode': z.string(),
  'hub.verify_token': z.string(),
  'hub.challenge': z.string(),
});

export type MetaWebhookVerifyQuery = z.infer<typeof metaWebhookVerifyQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Notificación de entrega (POST)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El valor de un `change` de tipo `leadgen`: los identificadores que Meta nos da para ir a buscar
 * el lead al Graph API. **`leadgen_id` es el único obligatorio**: sin él no hay nada que buscar.
 *
 * Los demás identificadores se guardan crudos como texto. `docs/database.md` los modela como FK a
 * `campaigns`/`ads`, tablas que todavía no existen; convertirlos en FK ahora obligaría a crear
 * tablas sin consumidor.
 */
export const metaLeadgenValueSchema = z.looseObject({
  leadgen_id: z.string().min(1),
  form_id: z.string().optional(),
  page_id: z.string().optional(),
  ad_id: z.string().optional(),
  adset_id: z.string().optional(),
  campaign_id: z.string().optional(),
  created_time: z.union([z.number(), z.string()]).optional(),
});

export type MetaLeadgenValue = z.infer<typeof metaLeadgenValueSchema>;

export const metaChangeSchema = z.looseObject({
  field: z.string(),
  value: z.unknown(),
});

export const metaEntrySchema = z.looseObject({
  id: z.string(),
  time: z.number().optional(),
  changes: z.array(metaChangeSchema),
});

/**
 * Sobre de la notificación.
 *
 * `object` es un `string` y **no** un literal a propósito: si Meta entrega un sobre de otro tipo
 * (por ejemplo de `instagram`), queremos responder `200 {ignored:true}` en vez de un `422` que
 * Meta interpretaría como fallo nuestro y reintentaría indefinidamente (`docs/api.md` §8.4).
 */
export const metaWebhookEnvelopeSchema = z.looseObject({
  object: z.string(),
  entry: z.array(metaEntrySchema),
});

export type MetaWebhookEnvelope = z.infer<typeof metaWebhookEnvelopeSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Respuesta del Graph API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un campo del formulario. `values` es un array porque Meta lo modela así incluso cuando solo hay
 * uno; se admiten números y booleanos porque no todos los campos son texto.
 */
export const metaFieldDatumSchema = z.looseObject({
  name: z.string(),
  values: z.array(z.union([z.string(), z.number(), z.boolean()])),
});

export type MetaFieldDatum = z.infer<typeof metaFieldDatumSchema>;

/**
 * Respuesta de `GET /{leadgen_id}`.
 *
 * **`custom_disclaimer_responses` es la única prueba de consentimiento que Meta puede darnos**, y
 * solo aparece si el formulario usó *custom disclaimer*. Su forma exacta hay que confirmarla contra
 * la API real cuando la app de Meta esté aprobada; por eso el schema es deliberadamente tolerante
 * y el código trata **la ausencia o la duda como «sin evidencia»**, que es el lado seguro: el lead
 * se guarda con `granted:false` y el marketing queda bloqueado.
 */
export const metaLeadGraphResponseSchema = z.looseObject({
  id: z.string(),
  created_time: z.string().optional(),
  form_id: z.string().optional(),
  ad_id: z.string().optional(),
  adset_id: z.string().optional(),
  campaign_id: z.string().optional(),
  platform: z.string().optional(),
  field_data: z.array(metaFieldDatumSchema).optional(),
  custom_disclaimer_responses: z
    .array(
      z.looseObject({
        checkbox_key: z.string().optional(),
        is_checked: z.boolean().optional(),
      }),
    )
    .optional(),
});

export type MetaLeadGraphResponse = z.infer<typeof metaLeadGraphResponseSchema>;

/**
 * Cuerpo de error de la Graph API (`{"error": {...}}`), que Meta devuelve con un 4xx/5xx.
 *
 * Se modela para poder extraer los campos **estructurados** —código, subcódigo, tipo, `fbtrace_id`—
 * y registrarlos. El `message` es texto libre de un tercero: se registra en el log del servidor, pero
 * **nunca** entra en el `context` de un `AppError`, porque ese sí viaja al cliente.
 *
 * Todos los campos son opcionales a propósito: sirven para diagnosticar, no para decidir. Si Meta
 * cambia esta forma, lo peor que puede pasar es que perdamos el detalle del diagnóstico.
 */
export const metaGraphErrorSchema = z.looseObject({
  error: z.looseObject({
    message: z.string().optional(),
    type: z.string().optional(),
    code: z.number().optional(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional(),
  }),
});

export type MetaGraphError = z.infer<typeof metaGraphErrorSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Respuesta HTTP de nuestro endpoint
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lo que respondemos a Meta. Siempre `200`: `docs/api.md` §8.4 prohíbe los 4xx por eventos no
 * reconocidos o duplicados, porque Meta los reintentaría sin fin.
 *
 * `duplicate` e `ignored` son informativos, no errores.
 */
export const metaWebhookAcceptedSchema = z.object({
  received: z.literal(true),
  /** Ya teníamos ese `leadgen_id`. No es un error: el emisor reintenta. */
  duplicate: z.literal(true).optional(),
  /** Sobre válido y firmado, pero sin nada de `leadgen` que procesar. */
  ignored: z.literal(true).optional(),
});

export type MetaWebhookAccepted = z.infer<typeof metaWebhookAcceptedSchema>;
