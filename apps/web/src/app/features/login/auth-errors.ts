import type { ProblemDetails } from '@crm/contracts';

import type { AuthResult } from '../../core/auth-api';
import { esRutaAusente } from '../../core/auth-api';

/**
 * Traducción de un fallo de acceso a algo que una persona pueda leer y entender.
 *
 * ## Por qué esto NO se importa de `@crm/contracts`
 *
 * El paquete compartido tiene el catálogo de **códigos y títulos** de error (`ERROR_CATALOG`), y de
 * ahí sale lo que ve un cliente de la API. Lo que no tiene —ni debería— es la redacción de esta
 * pantalla: «Correo o contraseña incorrectos» es una decisión de producto y de seguridad de este
 * formulario, no un dato del contrato. Además, importar `ERROR_CATALOG` como valor arrastraría Zod al
 * bundle del navegador (472 kB medidos en este repo).
 *
 * ## Qué revela cada mensaje, y qué no
 *
 * `AUTH_INVALID_CREDENTIALS` cubre **los dos** casos —correo inexistente y contraseña incorrecta— y
 * el servidor los hace indistinguibles también en el tiempo de respuesta (`docs/security.md` §2.1:
 * verifica argon2id contra un hash dummy cuando el usuario no existe). El texto de aquí no puede
 * estropear eso, y por eso dice explícitamente por qué está redactado así: quien lea el código no
 * debería tener que deducir que es intencional.
 */

export type LoginFailureKind =
  | 'servicio-ausente'
  | 'credenciales'
  | 'cuenta-bloqueada'
  | 'demasiadas-peticiones'
  | 'validacion'
  | 'transporte'
  | 'otro';

export interface LoginFailure {
  readonly kind: LoginFailureKind;
  /** Titular. Es lo primero que se oye: va dentro de un `role="alert"`. */
  readonly titulo: string;
  readonly detalle: string;
  /**
   * El `problem+json` completo, sólo cuando el fallo no está previsto.
   *
   * Se arrastra entero —código, HTTP, `traceId`— porque ante un error que no hemos previsto lo único
   * útil que podemos darle a quien lo sufre es lo que hace falta para buscar la traza en los logs.
   * Inventar un mensaje amable en ese caso esconde justo el dato que sirve.
   */
  readonly problem: ProblemDetails | null;
}

/**
 * Convierte la espera de un `Retry-After` en texto.
 *
 * Redondea **hacia arriba** a propósito: decir «en 2 minutos» cuando quedan 90 segundos es un error
 * que se corrige solo; decir «en 1 minuto» cuando quedan 90 invita a reintentar antes de tiempo y a
 * comerse otro rechazo. `null` y `0` devuelven `null`: lo primero es «no me lo han dicho» y lo
 * segundo, «ya puedes».
 */
export function formatearEspera(segundos: number | null): string | null {
  if (segundos === null || segundos <= 0) {
    return null;
  }

  if (segundos < 60) {
    return 'en menos de un minuto';
  }

  const minutos = Math.ceil(segundos / 60);

  if (minutos < 60) {
    return `en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
  }

  const horas = Math.ceil(segundos / 3600);

  if (horas < 24) {
    return `en ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  }

  const dias = Math.ceil(segundos / 86400);

  return `en ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/**
 * Traduce el resultado del transporte a un fallo que la pantalla pueda pintar.
 *
 * El orden de las comprobaciones es significativo y no alfabético:
 *
 * 1. **Ruta ausente** primero. Es el estado de hoy y hay que reconocerlo antes que nada, porque un
 *    404 sin `problem` también es «no hubo respuesta interpretable» y sin este paso el mensaje sería
 *    un genérico «no se pudo contactar», que manda a mirar el sitio equivocado.
 * 2. **Sin `problem`** → fallo de transporte. `transportError` ya viene redactado en castellano desde
 *    `core/auth-api.ts` y es más específico que cualquier cosa que se escriba aquí.
 * 3. **Con `problem`** → por código. Y sólo los códigos que esta pantalla puede provocar; el resto
 *    cae en `otro` y se pinta tal cual, con su `traceId`.
 */
export function comoFalloDeAcceso(resultado: AuthResult<unknown>): LoginFailure {
  if (esRutaAusente(resultado)) {
    return {
      kind: 'servicio-ausente',
      titulo: 'El servicio de acceso no responde',
      detalle:
        'El API de autenticación no está respondiendo o la ruta no está montada. Verifica que el ' +
        'backend esté arrancado y que el módulo de auth esté registrado.',
      problem: null,
    };
  }

  if (resultado.problem === null) {
    return {
      kind: 'transporte',
      titulo: 'No se pudo contactar con el servidor',
      detalle: resultado.transportError ?? 'No hubo respuesta del API.',
      problem: null,
    };
  }

  const espera = formatearEspera(resultado.retryAfterSeconds);

  switch (resultado.problem.code) {
    case 'AUTH_INVALID_CREDENTIALS':
      return {
        kind: 'credenciales',
        titulo: 'Correo o contraseña incorrectos',
        detalle:
          'Este mensaje es el mismo tanto si el correo existe como si no, y es deliberado: un ' +
          'mensaje distinto permitiría averiguar qué direcciones están registradas.',
        problem: null,
      };

    case 'AUTH_ACCOUNT_LOCKED':
      return {
        kind: 'cuenta-bloqueada',
        titulo: 'Cuenta bloqueada temporalmente',
        detalle:
          espera === null
            ? 'Se han acumulado demasiados intentos fallidos. El servidor no ha dicho cuánto dura ' +
              'el bloqueo, así que no se muestra una cifra: espera y vuelve a intentarlo.'
            : `Se han acumulado demasiados intentos fallidos. Podrás volver a intentarlo ${espera}.`,
        problem: null,
      };

    case 'RATE_LIMIT_EXCEEDED':
      return {
        kind: 'demasiadas-peticiones',
        titulo: 'Demasiados intentos seguidos',
        detalle:
          espera === null
            ? 'El servidor ha limitado las peticiones desde esta red y no ha dicho por cuánto ' +
              'tiempo. Espera un momento y vuelve a intentarlo.'
            : `El servidor ha limitado las peticiones desde esta red. Vuelve a intentarlo ${espera}.`,
        problem: null,
      };

    case 'VALIDATION_FAILED':
      return {
        kind: 'validacion',
        titulo: 'Revisa el correo y la contraseña',
        detalle:
          'El servidor ha rechazado el formato. La contraseña debe tener entre 12 y 128 ' +
          'caracteres, al menos una mayúscula, una minúscula, un dígito y un símbolo ' +
          '(docs/api.md §3.2 y ADR-025).',
        problem: null,
      };

    default:
      // Un código que esta pantalla no espera. Se muestra el problema tal cual, con su `traceId`:
      // es lo único que permite encontrar la traza en los logs.
      return {
        kind: 'otro',
        titulo: resultado.problem.title,
        detalle: resultado.problem.detail,
        problem: resultado.problem,
      };
  }
}
