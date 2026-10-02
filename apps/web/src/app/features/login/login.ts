import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  isDevMode,
  signal,
  viewChild,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { environment } from '../../../environments/environment';
import { destinoSeguro } from '../../core/navigation';
import { SessionService, puertaDeDemostracionAbierta } from '../../core/session';
import type { LoginFailure } from './auth-errors';
import { comoFalloDeAcceso } from './auth-errors';

/**
 * Pantalla de acceso (`/entrar`).
 *
 * ## Está FUERA del shell, y por eso el shell es una ruta
 *
 * Es la única pantalla del CRM que no lleva barra lateral. Un «Saltar al contenido» en una pantalla
 * que solo tiene un formulario saltaría a sí mismo, y veinte etapas de menú al lado de un formulario
 * de acceso invitan a hacer clic en algo que va a rebotar contra el guard.
 *
 * ## Esta pantalla todavía no autentica a nadie, y lo dice en voz alta
 *
 * El backend de acceso es del Hito 2 y no existe (ver `core/auth-api.ts`). El aviso de honestidad del
 * formulario es **permanente y no descartable**: no está detrás de un «+info» ni en letra pequeña,
 * porque es la única cosa que separa esta pantalla de una frontera de seguridad falsa.
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
export class Login {
  readonly #session = inject(SessionService);
  readonly #router = inject(Router);
  readonly #ruta = inject(ActivatedRoute);
  readonly #injector = inject(Injector);

  protected readonly enviando = signal(false);
  protected readonly fallo = signal<LoginFailure | null>(null);

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
