import { createHmac } from 'node:crypto';

import { timingSafeEqualStrings } from '../../common/timing-safe.js';

/**
 * Firma HMAC-SHA256 de los webhooks de Meta. **Función pura, sin HTTP**: se prueba en aislamiento y
 * es la misma que usa el script de desarrollo para firmar un payload de prueba.
 *
 * ## El esquema real de Meta (y no el que documenta `docs/api.md` §8.2)
 *
 * Meta envía:
 *
 *     X-Hub-Signature-256: sha256=<hex>
 *
 * donde `<hex>` es el HMAC-SHA256 del **cuerpo crudo** con el *App Secret* como clave. **No lleva
 * timestamp**, así que no hay ventana de tolerancia ni protección anti-replay por reloj: la
 * idempotencia recae en el `UNIQUE(meta_lead_id)` de la base de datos, que es donde debe estar.
 *
 * `docs/api.md` §8.2 describe un esquema genérico con `t=…,v1=…` y `WEBHOOK_TOLERANCE_SECONDS` que
 * **no es el de Meta**. Se implementa el de Meta; el documento se enmienda en la sincronización de
 * documentación de esta misma rebanada.
 */

/** Cabecera de firma de Meta. En minúsculas porque así la normaliza Express. */
export const META_SIGNATURE_HEADER = 'x-hub-signature-256';

const SIGNATURE_PREFIX = 'sha256=';

/** Un SHA-256 en hexadecimal son 64 caracteres. */
const HEX_DIGEST_LENGTH = 64;

/**
 * Firma un cuerpo crudo con el *App Secret*. La usa la verificación y el script de desarrollo, para
 * que el camino que se prueba y el que se usa sean literalmente el mismo.
 */
export function computeMetaSignature(rawBody: Buffer, appSecret: string): string {
  return SIGNATURE_PREFIX + createHmac('sha256', appSecret).update(rawBody).digest('hex');
}

export interface MetaSignatureInput {
  /**
   * Cuerpo **crudo**, tal como llegó por el cable. Es el punto entero de la verificación: si se
   * recalcula sobre el objeto ya parseado (o peor, sobre `JSON.stringify(req.body)`), el resultado
   * es otro y la firma no coincide.
   */
  readonly rawBody: Buffer | undefined;
  readonly signatureHeader: string | undefined;
  readonly appSecret: string;
}

/**
 * Verifica la firma. **Fail-closed**: cualquier duda —sin cabecera, sin cuerpo crudo, sin secreto,
 * prefijo ausente, longitud inesperada— devuelve `false`.
 *
 * No lanza: quien decide qué hacer con un `false` es el guard, que es donde vive la política de
 * auditoría.
 */
export function verifyMetaSignature(input: MetaSignatureInput): boolean {
  const { rawBody, signatureHeader, appSecret } = input;

  if (rawBody === undefined || signatureHeader === undefined || appSecret.length === 0) {
    return false;
  }

  // El prefijo se compara en minúsculas pero el hexadecimal también, así que una firma en
  // mayúsculas (que Meta no manda, pero que otro cliente podría mandar) no se rechaza de más.
  if (!signatureHeader.toLowerCase().startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const provided = signatureHeader.slice(SIGNATURE_PREFIX.length).toLowerCase();

  // Se comprueba la longitud **antes** de `timingSafeEqual`, porque esa función **lanza** si los
  // buffers miden distinto. Un rechazo limpio es mejor que una excepción que el filtro convertiría
  // en un 500 y un reintento eterno por parte de Meta.
  if (provided.length !== HEX_DIGEST_LENGTH) {
    return false;
  }

  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');

  // La comparación es la misma que usa el handshake: en tiempo constante y con la longitud ya
  // comprobada (ambas son 64 caracteres, así que no puede lanzar).
  return timingSafeEqualStrings(provided, expected);
}
