import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { ZodType } from 'zod';

import { AppError } from '../app-error.js';

/**
 * Pipe de validación Zod, registrado **globalmente** en `createApp`.
 *
 * ## Cómo se declara un schema
 *
 * Nest 12 acepta el schema como **opción del decorador de parámetro** (`ArgumentMetadata.schema`,
 * tipado como *Standard Schema*), así que no hace falta ningún decorador propio:
 *
 * ```ts
 * @Post()
 * crear(@Body({ schema: leadCreateSchema }) body: LeadCreate) {}
 *
 * @Get()
 * listar(@Query({ schema: leadListQuerySchema }) query: LeadListQuery) {}
 * ```
 *
 * Vale para `@Body`, `@Query`, `@Param`, `@RawBody` y `@Headers`, porque el `schema` viaja en los
 * metadatos del parámetro y Nest lo entrega a **cualquier** pipe, incluido este.
 *
 * ## Por qué NO hay decoradores propios
 *
 * Se intentó primero con un `@ZodBody(schema)` propio que marcaba el valor con un `Symbol` y lo
 * validaba aquí. **No funciona, y de una forma que conviene dejar escrita:** Nest clasifica el
 * argumento del decorador con `isPipe(value) => typeof value.transform === 'function'`, y un schema
 * de Zod **tiene un método `transform`**. Así que el schema se interpretaba como un *pipe* —no como
 * el dato— y el handler recibía `undefined` en su lugar, con un error tan confuso como
 * `Cannot read properties of undefined (reading 'safeParse')`.
 *
 * La opción nativa del framework no tiene ese problema, es la documentada, y además da `@Param`,
 * `@Headers` y los decoradores futuros sin tocar nada. Menos código propio, menos superficie.
 *
 * ## Qué hace y qué no
 *
 * Un parámetro **sin** schema atraviesa el pipe intacto: un `@Param('id')` es un string y no debe
 * validarse contra nada. Y cuando falla, lanza el `ZodError` tal cual: `ProblemDetailsFilter` ya lo
 * traduce a `422 VALIDATION_FAILED`, y toda la política de qué se cuenta y qué se redacta (los
 * campos de `SENSITIVE_FIELD_NAMES`) vive en un solo sitio. Construir la respuesta aquí sería una
 * segunda verdad que puede divergir de la del filtro.
 */

/** El hueco que Nest reserva para el schema en los metadatos de un parámetro. */
type SchemaSlot = NonNullable<ArgumentMetadata['schema']>;

/**
 * Comprueba que el schema sea de Zod.
 *
 * El hueco está tipado como *Standard Schema* (el estándar que Zod, Valibot y ArkType implementan),
 * y este pipe es deliberadamente **de Zod**: usa `safeParse` para poder entregarle al filtro los
 * issues de Zod **con su `code`**, que es lo que el contrato publica. La interfaz `~standard`
 * devuelve `{ message, path }` y pierde el `code`, así que degradaría la respuesta de error.
 *
 * Si algún día entra otro validador, esto falla ruidosamente en vez de validar a medias.
 */
function isZodSchema(schema: SchemaSlot): schema is SchemaSlot & ZodType {
  return typeof (schema as { safeParse?: unknown }).safeParse === 'function';
}

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const schema = metadata.schema;

    if (schema === undefined) {
      return value;
    }

    if (!isZodSchema(schema)) {
      // Error de programación, no del cliente: por eso 500 y no 422. El detalle no incluye el
      // schema ni el valor recibido (llevan datos del cliente).
      throw new AppError('INTERNAL_ERROR', 'El schema de un parámetro no es de Zod.', {
        context: { parameterType: metadata.type },
      });
    }

    const result = schema.safeParse(value);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }
}
