import { Injectable, computed, inject, isDevMode, signal } from '@angular/core';

import { environment } from '../../environments/environment';
import { AuthApi, esRutaAusente } from './auth-api';
import type { AuthResult, LoginBody, RegisterBody, SetupBody } from './auth-api';

/**
 * Estado de la sesión del CRM.
 *
 * ## El access token vive aquí y SOLO aquí: en memoria
 *
 * `docs/security.md` §2.2 lo dice en su tabla («Almacenamiento en cliente: **Memoria** del SPA.
 * Nunca `localStorage` ni `sessionStorage`»), §2.5 lo repite como regla de endurecimiento y §14.1 lo
 * pone como ítem crítico del checklist de pre-producción. Es una prohibición escrita tres veces, así
 * que aquí se cumple de la forma más simple que existe: el token es una señal privada, muere al
 * recargar la página y se recupera con `POST /auth/refresh` + la cookie `__Host-crm_rt`.
 *
 * El control es verificable y está en el plan de verificación:
 * `Select-String -Path apps\web\src -Pattern 'localStorage|sessionStorage'` debe devolver **0**.
 *
 * ## Qué NO es esto
 *
 * Un backend de autenticación. Este servicio es el estado del cliente escrito contra el contrato;
 * la autorización real es `@RequirePermission` en el servidor (`docs/security.md` §3.4).
 */

export type SessionStatus = 'anonimo' | 'restaurando' | 'autenticado';

/**
 * De dónde sale la sesión. Es lo que permite pintar el banner de «sesión simulada» y que ninguna
 * captura de pantalla pueda confundirse con una sesión real.
 */
export type SessionOrigin = 'real' | 'demostracion';

/**
 * Lo que sabemos del usuario.
 *
 * `email` y `role` son `null` cuando la sesión se restauró con `/auth/refresh`: esa respuesta solo
 * trae `id` y `permissions` (`docs/api.md` §3.4). Se escribe así en vez de dejar el campo fuera o de
 * rellenarlo con una cadena vacía, porque «no me lo han dicho» es un dato distinto de «está vacío».
 * Completarlo es trabajo de `GET /auth/me`, que hoy nadie llama: la pantalla no necesita el email
 * para nada todavía.
 */
export interface SessionIdentity {
  readonly id: string;
  readonly permissions: readonly string[];
  readonly email: string | null;
  readonly role: string | null;
}

/**
 * ¿Está abierta la puerta de la sesión de demostración?
 *
 * **Las dos condiciones son obligatorias y por eso es una función pura**: así se puede probar la
 * tabla de verdad completa con un test, en vez de depender de `isDevMode()`, que no se puede
 * controlar desde un test y que en la práctica siempre es `true` ahí. Ver `session.spec.ts`.
 *
 * - `habilitada` viene de `environment.demoSession`, que `angular.json` sustituye en el build de
 *   producción por `environment.production.ts` → `false`. Queda **compilada a `false`**.
 * - `enDesarrollo` es `isDevMode()`, falso en cualquier build optimizado.
 *
 * Es una segunda cerradura sobre la primera y no un adorno: si alguien cambia el `fileReplacements`
 * de `angular.json` sin leerlo, el artefacto de producción sigue sin tener puerta.
 */
export function puertaDeDemostracionAbierta(habilitada: boolean, enDesarrollo: boolean): boolean {
  return habilitada && enDesarrollo;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly #auth = inject(AuthApi);

  /** Privada a propósito: el token no se expone a las plantillas. Se entrega por `authorizationHeader`. */
  #accessToken = signal<string | null>(null);

  #identity = signal<SessionIdentity | null>(null);
  #origin = signal<SessionOrigin | null>(null);
  #status = signal<SessionStatus>('anonimo');

  /**
   * Intento de restauración en curso, o ya resuelto en negativo.
   *
   * No es una señal porque no se pinta: es memoria de trabajo. Existe para que
   * `ensureRestored()` sea idempotente, que es lo que permite llamarlo desde el guard en **cada**
   * navegación sin disparar una petición por navegación.
   */
  #intentoDeRestauracion: Promise<boolean> | null = null;

  readonly status = this.#status.asReadonly();
  readonly origin = this.#origin.asReadonly();
  readonly user = this.#identity.asReadonly();

  readonly authenticated = computed(() => this.#status() === 'autenticado');

  /**
   * Conjunto de permisos del usuario autenticado. Vacío si no hay sesión.
   */
  readonly permissions = computed(
    () => this.#identity()?.permissions ?? ([] as readonly string[]),
  );

  /**
   * Hay sesión, pero es simulada. La barra lateral pinta un banner fijo mientras esto sea cierto.
   */
  readonly isDemo = computed(() => this.#origin() === 'demostracion');

  /**
   * Token de acceso sin prefijo. Para peticiones que lo necesiten sin armar una cabecera
   * completa, como `AuthApi.register` o `AuthApi.registerOwner`, que añaden `Bearer` ellos mismos.
   */
  accessToken(): string | null {
    return this.#accessToken();
  }

  /**
   * Cabecera `Authorization` para la siguiente petición al API.
   *
   * Devuelve el token **en el momento de llamar**, no una copia guardada: cuando exista el
   * interceptor de `401 → refresh`, leerá de aquí y no de un campo congelado.
   */
  authorizationHeader(): string | null {
    const token = this.#accessToken();

    return token === null ? null : `Bearer ${token}`;
  }

  /**
   * Inicia sesión. **No lanza**: devuelve el resultado del transporte para que la pantalla elija el
   * mensaje (credenciales inválidas, cuenta bloqueada con espera, demasiados intentos, servicio sin
   * desplegar…). Traducir esos códigos a castellano es trabajo de la pantalla, no del transporte.
   */
  async login(
    email: string,
    password: string,
    rememberDevice: boolean,
  ): Promise<AuthResult<LoginBody>> {
    const resultado = await this.#auth.login(email, password, rememberDevice);

    if (resultado.outcome === 'ok' && resultado.body !== null) {
      this.#accessToken.set(resultado.body.accessToken);
      this.#identity.set({
        id: resultado.body.user.id,
        permissions: resultado.body.user.permissions,
        email: resultado.body.user.email,
        role: resultado.body.user.role,
      });
      this.#origin.set('real');
      this.#status.set('autenticado');
      this.#intentoDeRestauracion = null;
    }

    return resultado;
  }

  /**
   * Configuración inicial: crea el primer OWNER y abre sesión.
   *
   * La respuesta tiene la misma forma que login, así que reutiliza el mismo cierre de sesión. Si el
   * setup ya fue completado, el servidor devuelve `STATE_CONFLICT` y el estado local no cambia.
   */
  async setup(
    email: string,
    password: string,
    organizationName?: string,
  ): Promise<AuthResult<SetupBody>> {
    const resultado = await this.#auth.setup(email, password, organizationName);

    if (resultado.outcome === 'ok' && resultado.body !== null) {
      this.#accessToken.set(resultado.body.accessToken);
      this.#identity.set({
        id: resultado.body.user.id,
        permissions: resultado.body.user.permissions,
        email: resultado.body.user.email,
        role: resultado.body.user.role,
      });
      this.#origin.set('real');
      this.#status.set('autenticado');
      this.#intentoDeRestauracion = null;
    }

    return resultado;
  }

  /**
   * Crea un AGENT dentro de la organización del usuario autenticado. Requiere `MANAGE_AGENTS`.
   *
   * No toca el estado local: es una operación de administración, no de sesión.
   */
  async register(
    email: string,
    password: string,
  ): Promise<AuthResult<RegisterBody>> {
    const token = this.accessToken();

    return this.#auth.register(token ?? '', email, password);
  }

  /**
   * Crea un OWNER adicional dentro de la organización. Requiere que el usuario autenticado sea OWNER
   * y tenga `MANAGE_AGENTS`. Es la herramienta de consola de desarrollo.
   */
  async registerOwner(
    email: string,
    password: string,
  ): Promise<AuthResult<RegisterBody>> {
    const token = this.accessToken();

    return this.#auth.registerOwner(token ?? '', email, password);
  }

  /**
   * ¿Hay sesión? Se llama **desde el guard**, no desde `provideAppInitializer`.
   *
   * La diferencia importa: un inicializador bloquearía el arranque de la aplicación entera en una
   * petición que hoy devuelve 404, castigando también a quien solo quiere ver la pantalla de acceso.
   * Llamándolo desde el guard, la aplicación arranca siempre y solo se paga este coste cuando se
   * navega a una pantalla protegida.
   *
   * Es idempotente. Y un fallo **no concluyente** —no hay red, o la ruta no está montada— se olvida,
   * de modo que el siguiente intento vuelve a preguntar: si el usuario arranca el API con la pestaña
   * ya abierta, entra sin recargar. Un fallo concluyente (el contrato dijo que no) sí se recuerda,
   * porque volver a preguntar solo puede dar lo mismo.
   */
  async ensureRestored(): Promise<boolean> {
    if (this.#status() === 'autenticado') {
      return true;
    }

    this.#intentoDeRestauracion ??= this.#intentarRestaurar();

    return this.#intentoDeRestauracion;
  }

  async #intentarRestaurar(): Promise<boolean> {
    this.#status.set('restaurando');

    const resultado = await this.#auth.refresh();

    if (resultado.outcome === 'ok' && resultado.body !== null) {
      this.#accessToken.set(resultado.body.accessToken);

      // `/auth/refresh` no trae email ni role (docs/api.md §3.4). Completamos la identidad con
      // `GET /auth/me` para que la barra lateral y los mensajes de bienvenida tengan datos reales.
      const me = await this.#auth.me(resultado.body.accessToken);
      const email = me.outcome === 'ok' && me.body !== null ? me.body.email : null;
      const role = me.outcome === 'ok' && me.body !== null ? me.body.role : null;

      this.#identity.set({
        id: resultado.body.user.id,
        permissions: resultado.body.user.permissions,
        // `null` sigue siendo un valor válido: significa «el endpoint no respondió o no está montado».
        email,
        role,
      });
      this.#origin.set('real');
      this.#status.set('autenticado');
      return true;
    }

    this.#status.set('anonimo');

    if (resultado.outcome === 'unreachable' || esRutaAusente(resultado)) {
      this.#intentoDeRestauracion = null;
    }

    return false;
  }

  /**
   * Cierra la sesión. Devuelve el resultado del aviso al servidor y **limpia el estado local en
   * cualquier caso**: si el API no responde, la sesión local tiene que morir igual.
   *
   * Consecuencia que hay que decir, no esconder: en ese caso la cookie de refresco sigue viva en el
   * navegador y en el servidor, así que recargar la página puede devolver la sesión. Quien llame a
   * esto debe avisar si el resultado no fue `ok`; por eso devuelve el resultado en vez de `void`.
   */
  async logout(): Promise<AuthResult<null>> {
    const resultado = await this.#auth.logout();

    this.#olvidarSesion();

    return resultado;
  }

  /**
   * Abre una sesión **simulada** para poder ver el resto de la interfaz antes de que exista el
   * backend. Es la única puerta, y está cerrada en el artefacto de producción por doble condición.
   *
   * **No inventa un usuario.** `user` se queda en `null` y `authorizationHeader()` en `null`: en modo
   * demostración la aplicación entra en las pantallas, pero no tiene ni la más mínima credencial, así
   * que cualquier dato que intente pedir al API dará 401. Es exactamente lo que queremos que pase —
   * una sesión de mentira que no puede tocar datos reales.
   *
   * @returns `true` si la puerta estaba abierta; `false` si no, sin tocar el estado.
   */
  startDemoSession(): boolean {
    if (!puertaDeDemostracionAbierta(environment.demoSession, isDevMode())) {
      return false;
    }

    this.#accessToken.set(null);
    this.#identity.set(null);
    this.#origin.set('demostracion');
    this.#status.set('autenticado');
    this.#intentoDeRestauracion = null;

    return true;
  }

  #olvidarSesion(): void {
    this.#accessToken.set(null);
    this.#identity.set(null);
    this.#origin.set(null);
    this.#status.set('anonimo');
    this.#intentoDeRestauracion = null;
  }
}
