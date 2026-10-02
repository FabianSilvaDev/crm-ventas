import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { ProblemDetails } from '@crm/contracts';

/**
 * Cliente de `POST /auth/login`, `/auth/refresh`, `/auth/logout` y `GET /auth/me`
 * (`docs/api.md` §3.2–3.6).
 *
 * ## Estado real de estos endpoints: NO EXISTEN
 *
 * El backend de autenticación es del **Hito 2**: no hay módulo `auth` en `apps/api`, ni tablas
 * `users`/`refresh_tokens`, ni dependencias de hashing o de JWT. Hoy estas cuatro rutas devuelven el
 * 404 por defecto de Nest, que **no** es problem+json. Eso no es un fallo de este cliente: es el
 * estado del proyecto, y la pantalla de acceso lo dice con esas palabras en vez de disimularlo.
 *
 * Se escriben igualmente, contra el contrato ya congelado, por una razón práctica: la parte difícil
 * de esta pantalla —los desenlaces, el `Retry-After`, la distinción entre «no existe la ruta» y «no
 * hay red»— no se puede validar contra un contrato imaginario. Tenerla escrita y probada antes de
 * que exista el servidor ahorra rehacerla. Lo que NO se hace es fingir que autentica.
 *
 * ## Los tres desenlaces, otra vez
 *
 * Mismos que `core/health.ts` y `core/leads-api.ts`, y por el mismo motivo: `ok`, `problem` (el API
 * respondió un error del contrato) y `unreachable` (no hubo respuesta interpretable) exigen acciones
 * distintas, y mezclarlas mandaría al usuario a mirar el sitio equivocado.
 *
 * ## Los tipos se declaran aquí: desviación consciente de ADR-012
 *
 * ADR-012 dice que los tipos de API viven en `@crm/contracts`, de donde se genera el OpenAPI y el
 * cliente. Ese pipeline **todavía no existe** —el propio `core/leads-api.ts` lo dice de sí mismo—,
 * pero al menos encuentra allí los tipos de leads ya escritos. Los de auth no están, y no deberían
 * estar: el contrato es la promesa de lo que el API **hace**, y declarar un contrato de algo que no
 * está implementado es exactamente el tipo de documento que acaba mintiendo.
 *
 * Consecuencia, dicha sin adornos: **cuando el Hito 2 implemente el módulo `auth`, estas formas deben
 * mudarse a `@crm/contracts` y borrarse de aquí.** Queda escrito junto al código y no en un
 * documento aparte, porque es aquí donde se va a leer.
 *
 * ## Por qué las cookies importan (`withCredentials`)
 *
 * El refresh token vive en la cookie `__Host-crm_rt` (`HttpOnly`), y el navegador **no la envía** en
 * una petición XHR salvo que se le pida explícitamente. Sin `withCredentials: true` en `/refresh` y
 * `/logout`, el servidor no ve la cookie nunca, la sesión no se restaura al recargar y **no falla
 * nada**: simplemente hay que volver a entrar cada vez. Es el tipo de error que se busca durante
 * semanas. El CORS del API ya está con `credentials: true` (`docs/api.md` §12.4): las dos mitades
 * encajan.
 */

/** Identidad del usuario tal como la devuelve `POST /auth/login` (`docs/api.md` §3.2). */
export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly status: string;
  readonly organizationId: string;
  readonly permissions: readonly string[];
}

/** Cuerpo de éxito de `POST /auth/login`. */
export interface LoginBody {
  readonly accessToken: string;
  readonly tokenType: string;
  /** Segundos de vida del access token. En el contrato, 900. */
  readonly expiresIn: number;
  readonly user: AuthUser;
}

/**
 * Cuerpo de éxito de `POST /auth/refresh` (§3.4): como el del login **sin el bloque `user`
 * completo**. Solo llegan `id` y `permissions`, que es lo que la UI necesita para repintarse.
 *
 * Se modela como un tipo aparte y no como `LoginBody` con campos opcionales: un `user.email?` haría
 * que el compilador aceptase leer un email que en esta respuesta nunca viene.
 */
export interface RefreshBody {
  readonly accessToken: string;
  readonly tokenType: string;
  readonly expiresIn: number;
  readonly user: {
    readonly id: string;
    readonly permissions: readonly string[];
  };
}

/** Usuario de `GET /auth/me` (§3.6). El único que trae la organización y los permisos efectivos. */
export interface MeBody {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly organization: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  };
  readonly permissions: readonly string[];
  readonly lastLoginAt: string;
}

export type AuthOutcome = 'ok' | 'problem' | 'unreachable';

export interface AuthResult<T> {
  readonly outcome: AuthOutcome;
  readonly httpStatus: number | null;
  readonly traceId: string | null;
  readonly body: T | null;
  readonly problem: ProblemDetails | null;
  /** Qué falló exactamente cuando no hay `problem` del contrato. Se pinta tal cual. */
  readonly transportError: string | null;
  /**
   * Segundos de espera que pide un `429` o un `423` (§3.2).
   *
   * `null` cuando no hay cabecera **o cuando no se pudo interpretar**. Se prefiere no decir nada a
   * decir una cifra inventada. `0` significa «ya puedes reintentar» y la pantalla lo trata como «no
   * anuncies espera», no como «espera cero segundos».
   */
  readonly retryAfterSeconds: number | null;
}

const TRACE_ID_HEADER = 'X-Trace-Id';
const RETRY_AFTER_HEADER = 'Retry-After';

const RUTA_LOGIN = '/api/v1/auth/login';
const RUTA_REFRESH = '/api/v1/auth/refresh';
const RUTA_LOGOUT = '/api/v1/auth/logout';
const RUTA_ME = '/api/v1/auth/me';

interface OpcionesDePeticion<T> {
  readonly method: 'GET' | 'POST';
  readonly body: unknown;
  readonly withCredentials: boolean;
  readonly headers?: Record<string, string>;
  /**
   * Validador de forma, o `null` si la respuesta **no tiene cuerpo**.
   *
   * La distinción es obligatoria y no un lujo: `#pedir` usa `validar(...) === null` para decir «la
   * respuesta no tiene la forma del contrato», así que un validador que devolviera `null` como valor
   * legítimo —el caso de un `204`, cuyo cuerpo es literalmente nada— haría que un logout correcto se
   * leyera como un fallo de contrato. Un endpoint sin cuerpo no tiene nada que validar: su éxito lo
   * dice el código HTTP.
   */
  readonly validar: ((valor: unknown) => T | null) | null;
}

@Injectable({ providedIn: 'root' })
export class AuthApi {
  readonly #http = inject(HttpClient);

  async login(
    email: string,
    password: string,
    rememberDevice: boolean,
  ): Promise<AuthResult<LoginBody>> {
    return this.#pedir<LoginBody>(RUTA_LOGIN, {
      method: 'POST',
      body: { email, password, rememberDevice },
      // Pública, pero la respuesta trae el `Set-Cookie` con el refresh token.
      withCredentials: true,
      validar: comoLogin,
    });
  }

  /**
   * Cuerpo vacío: el token va en la cookie (§3.4). Es lo que hace que sea `POST` y no `GET`, para que
   * no lo dispare un `<img>` ni el prefetch del navegador.
   */
  async refresh(): Promise<AuthResult<RefreshBody>> {
    return this.#pedir<RefreshBody>(RUTA_REFRESH, {
      method: 'POST',
      body: null,
      withCredentials: true,
      validar: comoRefresh,
    });
  }

  /** `204 No Content`, idempotente (§3.5). No hay cuerpo de éxito que validar. */
  async logout(): Promise<AuthResult<null>> {
    return this.#pedir<null>(RUTA_LOGOUT, {
      method: 'POST',
      body: null,
      withCredentials: true,
      validar: null,
    });
  }

  /** El único método que lleva `Authorization`: los demás se autentican con la cookie. */
  async me(accessToken: string): Promise<AuthResult<MeBody>> {
    return this.#pedir<MeBody>(RUTA_ME, {
      method: 'GET',
      body: null,
      withCredentials: false,
      headers: { Authorization: `Bearer ${accessToken}` },
      validar: comoMe,
    });
  }

  async #pedir<T>(url: string, opciones: OpcionesDePeticion<T>): Promise<AuthResult<T>> {
    try {
      const response = await firstValueFrom(
        this.#http.request<T>(opciones.method, url, {
          body: opciones.body,
          observe: 'response',
          withCredentials: opciones.withCredentials,
          headers: opciones.headers,
        }),
      );

      const { validar } = opciones;
      const body = validar === null ? null : validar(response.body);

      if (validar !== null && body === null) {
        return {
          outcome: 'unreachable',
          httpStatus: response.status,
          traceId: response.headers.get(TRACE_ID_HEADER),
          body: null,
          problem: null,
          transportError:
            'El API respondió, pero la respuesta no tiene la forma que describe el contrato de ' +
            'autenticación. No se da la sesión por buena.',
          retryAfterSeconds: null,
        };
      }

      return {
        outcome: 'ok',
        httpStatus: response.status,
        traceId: response.headers.get(TRACE_ID_HEADER),
        body,
        problem: null,
        transportError: null,
        retryAfterSeconds: null,
      };
    } catch (error: unknown) {
      return this.#comoFallo<T>(error);
    }
  }

  #comoFallo<T>(error: unknown): AuthResult<T> {
    if (!(error instanceof HttpErrorResponse)) {
      return sinRespuesta<T>('Fallo inesperado en el cliente HTTP.');
    }

    // status 0 = el navegador no llegó al servidor.
    if (error.status === 0) {
      return sinRespuesta<T>('No hubo respuesta del API. ¿Está arrancado en el puerto 3000?');
    }

    const problem = asProblemDetails(error);

    return {
      outcome: problem === null ? 'unreachable' : 'problem',
      httpStatus: error.status,
      traceId: error.headers.get(TRACE_ID_HEADER),
      body: null,
      problem,
      transportError:
        problem === null ? 'Respuesta de error con un cuerpo que no es problem+json.' : null,
      retryAfterSeconds: parseRetryAfter(error.headers.get(RETRY_AFTER_HEADER)),
    };
  }
}

function sinRespuesta<T>(transportError: string): AuthResult<T> {
  return {
    outcome: 'unreachable',
    httpStatus: null,
    traceId: null,
    body: null,
    problem: null,
    transportError,
    retryAfterSeconds: null,
  };
}

/**
 * ¿El 404 significa «esta ruta no está montada» y no «el recurso no existe»?
 *
 * La condición tiene dos brazos a propósito. Con el API arrancado pero sin el módulo `auth`, Nest
 * responde su 404 por defecto, que **no** es problem+json y por tanto llega con `problem === null`.
 * Con el módulo implementado, la misma situación se expresaría con `RESOURCE_NOT_FOUND`. Mirar solo
 * el código del contrato dejaría el caso de hoy sin detectar, y el usuario vería «error 404» en vez
 * de «el servicio de acceso todavía no está desplegado».
 *
 * Vive aquí y no en la pantalla porque la usan dos sitios: la pantalla, para elegir el mensaje, y
 * `core/session.ts`, para decidir si merece la pena volver a preguntar el refresh más adelante.
 */
export function esRutaAusente(resultado: {
  readonly httpStatus: number | null;
  readonly problem: ProblemDetails | null;
}): boolean {
  return (
    resultado.httpStatus === 404 &&
    (resultado.problem === null || resultado.problem.code === 'RESOURCE_NOT_FOUND')
  );
}

/**
 * Forma exacta de una fecha HTTP (`IMF-fixdate`, RFC 9110 §10.2.1): `Thu, 01 Oct 2026 10:15:00 GMT`.
 *
 * La comprobación de forma **no es cosmética**, es el núcleo de esta función. Medido en V8:
 * `Date.parse('-5')` devuelve el año −5 y `Date.parse('1.5')` el año 1.5, **no** `NaN`. Es decir, un
 * `Retry-After` con basura se interpretaría como una fecha válida y la pantalla anunciaría una
 * espera de decenas de miles de años. `Date.parse` no distingue «no es una fecha» de «es una fecha
 * rarísima», así que la distinción hay que hacerla antes, aquí.
 */
const FECHA_HTTP = /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/;

/**
 * `Retry-After` es, según RFC 9110, **o** un número de segundos **o** una fecha HTTP. Aquí se acepta
 * lo que se pueda interpretar con seguridad y se devuelve `null` en cualquier otro caso: es
 * preferible callar la cifra a inventarla (regla del §3: no inventar datos que no podamos obtener).
 *
 * Una fecha ya pasada devuelve `0`, que significa «reintenta ya» — no `null`, porque en ese caso el
 * servidor sí ha dicho algo.
 */
export function parseRetryAfter(valor: string | null, ahora: Date = new Date()): number | null {
  if (valor === null) {
    return null;
  }

  const texto = valor.trim();

  if (/^\d+$/.test(texto)) {
    const segundos = Number(texto);

    // Un entero fuera del rango seguro no es una espera: es un desbordamiento esperando a ocurrir.
    return Number.isSafeInteger(segundos) ? segundos : null;
  }

  if (!FECHA_HTTP.test(texto)) {
    return null;
  }

  const instante = Date.parse(texto);

  if (Number.isNaN(instante)) {
    return null;
  }

  return Math.max(0, Math.ceil((instante - ahora.getTime()) / 1000));
}

/**
 * Comprueba la forma de la respuesta antes de darla por buena. Ver el comentario largo de
 * `core/leads-api.ts`: **no** se importan los schemas de `@crm/contracts` como valor porque eso
 * arrastra Zod al bundle del navegador (472 kB medidos en este repo). Aquí, además, no hay ningún
 * schema que importar.
 *
 * Se comprueba lo que esta aplicación va a **leer** —el token y el id del usuario—, no cada campo.
 * Una comprobación profunda sería una segunda verdad que se desincroniza del contrato.
 */
function comoLogin(valor: unknown): LoginBody | null {
  const campos = comoCampos(valor);

  if (campos === null || !tieneTokenYUsuario(campos)) {
    return null;
  }

  const user = comoCampos(campos['user']);

  if (user === null || typeof user['id'] !== 'string' || typeof user['email'] !== 'string') {
    return null;
  }

  return valor as LoginBody;
}

function comoRefresh(valor: unknown): RefreshBody | null {
  const campos = comoCampos(valor);

  if (campos === null || !tieneTokenYUsuario(campos)) {
    return null;
  }

  const user = comoCampos(campos['user']);

  if (user === null || typeof user['id'] !== 'string' || !Array.isArray(user['permissions'])) {
    return null;
  }

  return valor as RefreshBody;
}

function comoMe(valor: unknown): MeBody | null {
  const campos = comoCampos(valor);

  if (campos === null || typeof campos['id'] !== 'string' || !Array.isArray(campos['permissions'])) {
    return null;
  }

  return valor as MeBody;
}

/**
 * Lo que comparten las respuestas que traen un token y un usuario: `accessToken` no vacío,
 * `expiresIn` numérico y un bloque `user` que sea objeto.
 *
 * `accessToken` tiene que ser una cadena **no vacía** a propósito: un `""` pasaría un
 * `typeof === 'string'` y convertiría la sesión en «autenticado sin credencial», que es peor que no
 * tener sesión, porque no se nota hasta que falla la primera petición de verdad.
 *
 * Recibe ya el objeto como `Record<string, unknown>` y no como `unknown` porque las funciones de
 * arriba necesitan conservar el `unknown` original para el cast final: si `valor` quedara estrechado
 * aquí, TypeScript rechazaría el `as LoginBody` («ningún tipo se solapa suficientemente con el
 * otro») y la salida sería un `as unknown as LoginBody` encadenado, que es justo lo que hace que un
 * cast deje de documentar nada.
 */
function tieneTokenYUsuario(campos: Record<string, unknown>): boolean {
  const token = campos['accessToken'];

  if (typeof token !== 'string' || token === '') {
    return false;
  }

  if (typeof campos['expiresIn'] !== 'number') {
    return false;
  }

  return comoCampos(campos['user']) !== null;
}

/**
 * Devuelve el valor como objeto indexable, o `null` si no lo es.
 *
 * **No es un tipo predicado a propósito**: un `valor is Record<string, unknown>` estrecharía la
 * variable del llamante y rompería el cast al tipo del contrato (ver `tieneTokenYUsuario`).
 *
 * El proyecto compila con `noPropertyAccessFromIndexSignature`, así que a partir de aquí los campos
 * se leen por corchetes — igual que en `core/leads-api.ts` y `core/health.ts`.
 */
function comoCampos(valor: unknown): Record<string, unknown> | null {
  return typeof valor === 'object' && valor !== null ? (valor as Record<string, unknown>) : null;
}

/**
 * Reconoce un `ProblemDetails` sin fiarse del cliente. Misma función que en `core/health.ts`: se
 * comprueba que existan `code` y `title` antes de aceptarlo, porque un proxy caído devuelve su
 * propia página HTML y pintarla como un problema del contrato daría un mensaje sin sentido.
 */
function asProblemDetails(error: HttpErrorResponse): ProblemDetails | null {
  const raw: unknown = error.error;
  const candidate: unknown = typeof raw === 'string' ? parseJson(raw) : raw;

  if (candidate === null || typeof candidate !== 'object') {
    return null;
  }

  const value = candidate as Record<string, unknown>;
  if (typeof value['code'] !== 'string' || typeof value['title'] !== 'string') {
    return null;
  }

  return candidate as ProblemDetails;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
