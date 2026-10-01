import { z } from 'zod';

/**
 * Identidad: la persona, separada del lead (`identities` en `docs/database.md` §3, ADR-014).
 *
 * La separación existe porque la misma persona puede llegar por dos canales y no debe duplicarse:
 * el lead es la oportunidad, la identidad es quién. Por eso `email` y `phone` viven aquí y no en
 * `leads`.
 */

/**
 * Teléfono en formato **E.164**: `+`, código de país sin ceros de relleno, y de 8 a 15 dígitos en
 * total.
 *
 * No es una preferencia de estilo. `docs/database.md` §3 exige normalizar el teléfono, y el enlace
 * `wa.me` que cierra esta rebanada **construye una URL con esos dígitos**: un número sin normalizar
 * no falla, apunta a otra persona. Por eso el contrato lo valida en el borde en vez de confiar en
 * que alguien se acuerde.
 *
 * Meta entrega el teléfono tal como lo escribió la persona, así que la normalización es un paso
 * obligatorio de la ingesta, no un detalle.
 */
export const phoneE164Schema = z
  .string()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    'El teléfono debe ir en formato E.164, por ejemplo +573001234567',
  );

/**
 * Email. En Zod 4 los formatos son funciones de primer nivel (`z.email()`), no un método de
 * `z.string()`.
 *
 * En la base de datos la columna es `citext`, así que la comparación ignora mayúsculas; aquí solo
 * se comprueba la forma.
 */
export const emailSchema = z.email();

/**
 * Lo que la API expone de una identidad.
 *
 * **Solo lo que la tabla `identities` tiene.** No hay `name` porque `identities` no tiene columna
 * de nombre: el nombre vivirá en `contacts`, que esta rebanada no crea.
 */
export const identitySummarySchema = z.object({
  id: z.uuid(),
  email: emailSchema.nullable(),
  phone: phoneE164Schema.nullable(),
});

export type IdentitySummary = z.infer<typeof identitySummarySchema>;
