import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  isDevMode,
  signal,
  viewChild,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthApi } from '../../core/auth-api';
import { destinoSeguro } from '../../core/navigation';
import { SessionService, puertaDeDemostracionAbierta } from '../../core/session';
import type { LoginFailure } from './auth-errors';
import { comoFalloDeAcceso } from './auth-errors';

/**
 * Pantalla de acceso (`/entrar`).
 *
 * ## Está FUERA del shell, y por eso el shell es una ruta
 *
 * Una de las dos pantallas del CRM que no llevan barra lateral (la otra es `/setup`). Un «Saltar al
 * contenido» en una pantalla que solo tiene un formulario saltaría a sí mismo, y veinte etapas de
 * menú al lado de un formulario de acceso invitan a hacer clic en algo que va a rebotar contra el guard.
 *
 * ## Sin `@angular/forms`
 *
 * Dos campos y un botón no justifican `FormBuilder` + `FormGroup` + un sistema de suscripciones que
 * compite con el patrón de señales del resto del proyecto. Los valores se leen del formulario en el
 * momento del envío, así que no pueden desincronizarse de lo que hay en pantalla — ni siquiera cuando
 * el navegador rellena solo, que es justo el caso en que una copia en memoria se queda obsoleta.
 * La validación que importa es la del servidor; `type="email"`, `required`, `minlength` y `maxlength`
 * son el espejo en el cliente de lo que `docs/security.md` §2.1 ya exige.
 *
 * Se revisará cuando llegue el formulario de edición de lead —muchos campos, validación cruzada—, no
 * antes.
 */
@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  readonly #session = inject(SessionService);
  readonly #router = inject(Router);
  readonly #ruta = inject(ActivatedRoute);
  readonly #auth = inject(AuthApi);
  readonly #injector = inject(Injector);

  protected readonly enviando = signal(false);
  protected readonly fallo = signal<LoginFailure | null>(null);
  protected readonly setupNecesario = signal(false);

  /**
   * Herramienta de desarrollo: registro directo desde el login.
   *
   * En desarrollo se expone `window.__CRM_ENABLE_REGISTRATION()` sin argumentos. Abre un diálogo
   * propio que pide correo y contraseña. Si las credenciales pertenecen a un OWNER con `MANAGE_AGENTS`,
   * aparece un formulario de registro en la propia pantalla de acceso. Tras 3 intentos fallidos el
   * diálogo se cierra y la función queda bloqueada por `REGISTRATION_UNLOCK_COOLDOWN_MINUTES`.
   * En producción la función no existe: `isDevMode()` es `false` y el build optimizado la elimina.
   */
  protected readonly registroHabilitado = signal(false);
  protected readonly registroEnviando = signal(false);
  protected readonly registroExito = signal<string | null>(null);
  protected readonly registroFallo = signal<LoginFailure | null>(null);

  /** Diálogo de autorización para la herramienta de consola de desarrollo. */
  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogoRegistro');
  protected readonly modalAbierto = signal(false);
  protected readonly modalEnviando = signal(false);
  protected readonly modalFallo = signal<LoginFailure | null>(null);
  protected readonly modalIntentos = signal(3);
  protected readonly modalBloqueadoHasta = signal<number | null>(null);

  /**
   * Cooldown de la herramienta de consola, en minutos.
   *
   * Es una constante editable a propósito: cambiar este número cambia el tiempo de bloqueo tras 3
   * intentos fallidos. No se expone al usuario final; solo existe para ajustar el comportamiento en
   * desarrollo.
   */
  readonly #COOLDOWN_MINUTOS = 60;

  /**
   * El bloque de error, para poder llevar allí el foco después de un fallo.
   *
   * Existe solo mientras hay fallo (va dentro de un `@if`), así que la consulta devuelve `undefined`
   * hasta que la vista se ha repintado. Ver `#trasElRender`.
   *
   * Va con `private` de TypeScript y no con `#` como el resto de miembros privados de este
   * fichero: el compilador de plantillas rechaza `viewChild` sobre un campo `#` (NG1053). No hay
   * elección, así que se deja dicho para que nadie lo «arregle» y se encuentre con el error otra vez.
   */
  private readonly resumen = viewChild<ElementRef<HTMLElement>>('resumen');

  /**
   * ¿El fallo es culpa de lo que hay escrito en los campos?
   *
   * Sólo entonces se marcan los campos con `aria-invalid`: decirle a un lector de pantalla que un
   * campo es inválido cuando el problema es que el servidor está caído es desinformación.
   */
  protected readonly camposInvalidos = computed(() => {
    const kind = this.fallo()?.kind;

    return kind === 'credenciales' || kind === 'validacion';
  });

  /**
   * Clases del bloque de error, resueltas aquí y no en la plantilla.
   *
   * El aviso de «servicio sin desplegar» no es culpa de quien lo lee ni tiene arreglo por su parte,
   * así que va en tono informativo (`.note--warn`); lo que sí puede corregir —credenciales, bloqueo,
   * límite de peticiones— va en tono de error (`.alert--bad`). Son los dos avisos que ya existen en
   * `components.css`; esta pantalla no añade ninguno.
   */
  protected readonly claseDeFallo = computed(() => {
    const fallo = this.fallo();

    if (fallo === null) {
      return '';
    }

    return fallo.kind === 'servicio-ausente'
      ? 'acceso__error note note--warn'
      : 'acceso__error alert alert--bad';
  });

  /**
   * ¿Se puede ofrecer la puerta de demostración?
   *
   * Se evalúa al construir el componente. En el artefacto de producción la doble condición
   * —`environment.demoSession`, que `fileReplacements` deja en `false`, e `isDevMode()`, falso en
   * cualquier build optimizado— da `false`, así que el botón **no se pinta**: no hay nada que
   * descubrir inspeccionando el DOM.
   */
  protected readonly demoDisponible = puertaDeDemostracionAbierta(
    environment.demoSession,
    isDevMode(),
  );

  /**
   * Consulta si el backend aún no tiene usuarios. Cuando es así, muestra un botón para crear la
   * primera cuenta en `/setup`. La redirección no es automática: el usuario debe elegir ir al setup,
   * lo que evita sorpresas si abre `/entrar` a propósito.
   */
  constructor() {
    /**
     * Efecto para sincronizar el diálogo nativo con el estado de la señal. Se usa `effect` en vez de
     * manipular el DOM directamente desde los handlers, porque en zoneless el repintado no es
     * síncrono y abrir/cerrar el diálogo fuera de la reactividad puede dejarlo colgado.
     */
    effect(() => {
      const abierto = this.modalAbierto();
      const nativo = this.dialogo()?.nativeElement;
      if (nativo === undefined) {
        return;
      }
      // `jsdom` (usado en los tests) no implementa `HTMLDialogElement.showModal`. Se protege la
      // llamada para que el entorno de pruebas no rompa, sin afectar el comportamiento real en
      // navegadores.
      if (abierto && !nativo.open && typeof nativo.showModal === 'function') {
        nativo.showModal();
      } else if (!abierto && nativo.open && typeof nativo.close === 'function') {
        nativo.close();
      }
    });
  }

  async ngOnInit(): Promise<void> {
    const resultado = await this.#auth.setupRequired();

    this.setupNecesario.set(
      resultado.outcome === 'ok' && resultado.body !== null && resultado.body.required,
    );

    this.#exponerHerramientaDeRegistro();
  }

  protected async goToSetup(): Promise<void> {
    await this.#router.navigateByUrl('/setup');
  }

  /**
   * Envía el formulario de registro de AGENT que se desbloquea por la herramienta de consola.
   */
  protected async onRegisterSubmit(event: Event): Promise<void> {
    event.preventDefault();

    if (this.registroEnviando()) {
      return;
    }

    const { email, password, passwordConfirm, asOwner } = this.#leerFormularioRegistro(event);

    this.registroFallo.set(null);
    this.registroExito.set(null);

    const clientError = this.#validarRegistro(password, passwordConfirm);
    if (clientError !== null) {
      this.registroFallo.set({
        kind: 'validacion',
        titulo: 'Revisa el formulario',
        detalle: clientError,
        problem: null,
      });
      return;
    }

    this.registroEnviando.set(true);
    const resultado = asOwner
      ? await this.#session.registerOwner(email, password)
      : await this.#session.register(email, password);
    this.registroEnviando.set(false);

    if (resultado.outcome === 'ok' && resultado.body !== null) {
      this.registroExito.set(`${resultado.body.email} (${resultado.body.role})`);
      (event.target as HTMLFormElement).reset();
      return;
    }

    this.registroFallo.set(comoFalloDeAcceso(resultado));
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();

    // Doble envío: el botón está deshabilitado, pero un `submit` puede llegar por otras vías (pulsar
    // Intro dos veces muy rápido). Un segundo login con la misma contraseña fallida suma un intento
    // al contador de bloqueo de la cuenta.
    if (this.enviando()) {
      return;
    }

    const { email, password } = this.#leerFormulario(event);

    this.fallo.set(null);
    this.enviando.set(true);

    const resultado = await this.#session.login(email, password, false);

    this.enviando.set(false);

    if (resultado.outcome === 'ok') {
      await this.#router.navigateByUrl(this.#destino());
      return;
    }

    this.fallo.set(comoFalloDeAcceso(resultado));
    await this.#trasElRender();
    this.resumen()?.nativeElement.focus();
  }

  /**
   * Abre una sesión simulada. No hay formulario que rellenar ni credencial que pedir: la puerta está
   * ahí para poder ver la interfaz antes de que exista el backend.
   */
  protected async enterDemo(): Promise<void> {
    if (!this.#session.startDemoSession()) {
      return;
    }

    await this.#router.navigateByUrl(this.#destino());
  }

  /**
   * A dónde va el usuario después de entrar.
   *
   * Por defecto, al inicio. Si el guard lo trajo aquí desde otra pantalla, vuelve a esa pantalla con
   * sus filtros — y por eso el valor pasa por `destinoSeguro` (`core/navigation.ts`) antes de usarse:
   * el parámetro lo escribe la aplicación, pero cualquiera puede escribir un enlace a mano, y
   * `/entrar?returnTo=https://sitio-malicioso` sin validar convertiría el acceso en un trampolín.
   *
   * Se lee del `snapshot` y no de un observable porque solo se usa en el momento de enviar: la URL del
   * acceso no cambia mientras se está escribiendo la contraseña.
   */
  #destino(): string {
    const pedido = destinoSeguro(this.#ruta.snapshot.queryParamMap.get('returnTo'));

    // Volver al propio acceso sería un bucle tonto: se entra para acabar otra vez en el formulario.
    if (
      pedido === null ||
      pedido === ENTRAR ||
      pedido.startsWith(`${ENTRAR}/`) ||
      pedido.startsWith(`${ENTRAR}?`)
    ) {
      return INICIO;
    }

    return pedido;
  }

  /**
   * Expone `window.__CRM_ENABLE_REGISTRATION` solo en desarrollo.
   *
   * La función no recibe argumentos: abre un diálogo propio para pedir correo y contraseña. Tras 3
   * intentos fallidos queda bloqueada por `#COOLDOWN_MINUTOS`. En producción `isDevMode()` es falso,
   * así que la función no se asigna y no queda rastro en `window`.
   */
  #exponerHerramientaDeRegistro(): void {
    if (!isDevMode()) {
      return;
    }

    const w = window as unknown as Record<string, unknown>;

    w['__CRM_ENABLE_REGISTRATION'] = async (): Promise<string> => {
      const bloqueadoHasta = this.#leerBloqueo();
      if (bloqueadoHasta !== null && Date.now() < bloqueadoHasta) {
        const minutosRestantes = Math.ceil((bloqueadoHasta - Date.now()) / 60_000);
        return `Herramienta bloqueada. Intentá de nuevo en ${minutosRestantes} minutos.`;
      }

      this.modalBloqueadoHasta.set(null);
      this.modalIntentos.set(3);
      this.modalFallo.set(null);
      this.modalEnviando.set(false);
      this.modalAbierto.set(true);
      return 'Diálogo de autorización abierto. Ingresá correo y contraseña.';
    };
  }

  protected async onModalSubmit(event: Event): Promise<void> {
    event.preventDefault();

    if (this.modalEnviando() || this.modalBloqueadoHasta() !== null) {
      return;
    }

    const { email, password } = this.#leerFormularioModal(event);

    this.modalEnviando.set(true);
    this.modalFallo.set(null);

    const resultado = await this.#session.login(email, password, false);
    this.modalEnviando.set(false);

    if (resultado.outcome === 'ok' && resultado.body !== null) {
      const user = resultado.body.user;
      if (user.role !== 'OWNER') {
        this.#registrarFalloModal(`El usuario ${user.email} no es OWNER (rol: ${user.role}).`);
        return;
      }
      if (!user.permissions.includes('MANAGE_AGENTS')) {
        this.#registrarFalloModal(`El OWNER ${user.email} no tiene el permiso MANAGE_AGENTS.`);
        return;
      }

      this.registroHabilitado.set(true);
      this.modalAbierto.set(false);
      this.#limpiarBloqueo();
      return;
    }

    const detalle =
      resultado.problem?.code === 'AUTH_INVALID_CREDENTIALS'
        ? 'Correo o contraseña incorrectos.'
        : (resultado.transportError ?? 'No se pudo autenticar.');
    this.#registrarFalloModal(detalle);
  }

  protected cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  #registrarFalloModal(detalle: string): void {
    const restantes = this.modalIntentos() - 1;
    this.modalIntentos.set(restantes);

    if (restantes <= 0) {
      const hasta = Date.now() + this.#COOLDOWN_MINUTOS * 60_000;
      this.modalBloqueadoHasta.set(hasta);
      this.#guardarBloqueo(hasta);
      this.modalFallo.set({
        kind: 'otro',
        titulo: 'Demasiados intentos',
        detalle: `La herramienta se bloqueó por ${this.#COOLDOWN_MINUTOS} minutos.`,
        problem: null,
      });
      this.modalAbierto.set(false);
      return;
    }

    this.modalFallo.set({
      kind: 'credenciales',
      titulo: 'No se pudo autorizar',
      detalle: `${detalle} Te quedan ${restantes} ${restantes === 1 ? 'intento' : 'intentos'}.`,
      problem: null,
    });
  }

  #leerFormularioModal(event: Event): { email: string; password: string } {
    const datos = new FormData(event.target as HTMLFormElement);
    return {
      email: String(datos.get('modal-email') ?? '').trim(),
      password: String(datos.get('modal-password') ?? ''),
    };
  }

  #guardarBloqueo(hasta: number): void {
    try {
      sessionStorage.setItem('__crm_reg_lock', String(hasta));
    } catch {
      // sessionStorage puede fallar en modo privado con quota excedida. El bloqueo solo afecta a
      // recargas de página; sin persistencia, la función sigue bloqueada en esta pestaña.
    }
  }

  #leerBloqueo(): number | null {
    try {
      const raw = sessionStorage.getItem('__crm_reg_lock');
      if (raw === null) {
        return null;
      }
      const parsed = Number(raw);
      return Number.isNaN(parsed) ? null : parsed;
    } catch {
      return null;
    }
  }

  #limpiarBloqueo(): void {
    try {
      sessionStorage.removeItem('__crm_reg_lock');
    } catch {
      // Ignorar si sessionStorage no está disponible.
    }
  }

  /**
   * Lee los valores del formulario **en el momento del envío**.
   *
   * `rememberDevice` va fijo a `false` y no hay casilla que lo active: el contrato documenta el campo
   * (`docs/api.md` §3.2) pero **en ningún sitio dice qué cambia**. Con `Max-Age` del refresco fijado
   * en 30 días para todos los casos, una casilla «Recordar este dispositivo» sería un control que
   * promete algo que el servidor no hace. Se añadirá cuando el contrato defina su efecto, no antes.
   */
  #leerFormulario(event: Event): { email: string; password: string } {
    const datos = new FormData(event.target as HTMLFormElement);

    return {
      email: String(datos.get('email') ?? '').trim(),
      password: String(datos.get('password') ?? ''),
    };
  }

  /**
   * Lee los valores del formulario de registro de AGENT u OWNER.
   */
  #leerFormularioRegistro(event: Event): {
    email: string;
    password: string;
    passwordConfirm: string;
    asOwner: boolean;
  } {
    const datos = new FormData(event.target as HTMLFormElement);

    return {
      email: String(datos.get('registro-email') ?? '').trim(),
      password: String(datos.get('registro-password') ?? ''),
      passwordConfirm: String(datos.get('registro-password-confirm') ?? ''),
      asOwner: datos.get('registro-owner') === 'on',
    };
  }

  /**
   * Validación mínima del formulario de registro. El servidor tiene la validación definitiva.
   */
  #validarRegistro(password: string, passwordConfirm: string): string | null {
    if (password.length < 12) {
      return 'La contraseña debe tener al menos 12 caracteres.';
    }

    if (password.length > 128) {
      return 'La contraseña no puede superar los 128 caracteres.';
    }

    if (!/[A-Z]/.test(password)) {
      return 'La contraseña debe incluir al menos una mayúscula.';
    }

    if (!/[a-z]/.test(password)) {
      return 'La contraseña debe incluir al menos una minúscula.';
    }

    if (!/\d/.test(password)) {
      return 'La contraseña debe incluir al menos un número.';
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      return 'La contraseña debe incluir al menos un símbolo.';
    }

    if (password !== passwordConfirm) {
      return 'Las dos contraseñas no coinciden.';
    }

    return null;
  }

  /**
   * Espera a que Angular haya repintado.
   *
   * El bloque de error vive dentro de un `@if`, así que no existe en el DOM hasta que la vista se
   * actualiza. La aplicación es **sin zonas** (`zone.js` no está ni instalado): fijar una señal no
   * toca el DOM de forma síncrona, y leer la consulta antes del repintado devuelve `undefined` — sin
   * error, sin nada en consola, y el foco simplemente no se mueve.
   *
   * Se usa `afterNextRender` y no un `setTimeout(0)`: el primero se ejecuta **después del render por
   * definición**, mientras que un temporizador compite en la misma cola con el que usa Angular para
   * programar el suyo, y cuál de los dos corre antes depende de en qué orden se encolaron. Es
   * exactamente la clase de carrera que funciona en la máquina de quien la escribe y falla en la de
   * al lado.
   */
  #trasElRender(): Promise<void> {
    return new Promise<void>((resolver) => {
      afterNextRender(() => resolver(), { injector: this.#injector });
    });
  }

  /**
   * Qué anuncios describen a cada campo, para el `aria-describedby`.
   *
   * El bloque de error se enlaza **solo cuando el fallo es de los campos** (`camposInvalidos`), no
   * siempre que hay un fallo: con el API caído, apuntar los dos campos a un aviso que dice «no se pudo
   * contactar con el servidor» hace que quien navega con lector de pantalla oiga, al llegar a cada
   * campo, algo que no describe ese campo. `aria-invalid` y este enlace van juntos o no van.
   *
   * El id no puede estar fijo en el HTML porque el bloque solo existe cuando hay fallo: un
   * `aria-describedby` que apunta a un elemento inexistente es peor que no tenerlo.
   */
  protected descritoPor(ayuda: string | null): string | null {
    const ids = [ayuda, this.camposInvalidos() ? 'acceso-error' : null].filter(
      (id): id is string => id !== null,
    );

    return ids.length === 0 ? null : ids.join(' ');
  }
}

/**
 * A dónde va el usuario al entrar.
 *
 * Será `/panel` en cuanto exista el panel; hoy la pantalla de inicio sigue siendo el listado de
 * leads. Está como constante para que el cambio sea de una línea y no una búsqueda de literales.
 */
const INICIO = '/leads';

/** La propia pantalla de acceso, para no mandar a nadie de vuelta aquí después de entrar. */
const ENTRAR = '/entrar';
