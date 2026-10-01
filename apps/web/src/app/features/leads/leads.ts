import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';

import type { Lead, LeadChannel, LeadStatus } from '@crm/contracts';

import { LeadsApi } from '../../core/leads-api';
import type { LeadsResult } from '../../core/leads-api';
import { buildWhatsAppLink } from './whatsapp-link';

type Tone = 'ok' | 'bad' | 'warn' | 'idle';

interface View {
  readonly tone: Tone;
  readonly label: string;
}

/**
 * Una fila ya resuelta para pintar: nada de lógica en la plantilla.
 *
 * Se traduce el `Lead` del contrato a etiquetas en español y a un enlace `wa.me` listo, de modo que
 * el HTML solo coloca valores. Las decisiones —qué significa «sin teléfono», cuándo hay enlace— se
 * toman aquí, donde se pueden probar.
 */
interface LeadRow {
  readonly id: string;
  readonly nombre: string;
  readonly email: string | null;
  readonly telefono: string | null;
  /** `null` cuando no se puede construir: ver `buildWhatsAppLink`. */
  readonly whatsapp: string | null;
  readonly estado: View;
  readonly canal: string;
  readonly consentimiento: View;
  /** Por qué consta (o no) el consentimiento. Dato legal, no decorativo. */
  readonly consentimientoBase: string;
  readonly marketingBloqueado: boolean;
  readonly creadoEn: string;
  readonly primeraRespuesta: string;
  readonly respondido: boolean;
}

/**
 * Etiquetas de estado.
 *
 * Es un `Record` sobre el enum del contrato, no un `switch` ni un objeto suelto: si el contrato gana
 * un estado, esto **deja de compilar**. Un estado nuevo pintado como «undefined» en una tabla de
 * leads es la clase de fallo que nadie ve hasta que importa.
 */
const ESTADOS: Readonly<Record<LeadStatus, View>> = {
  NEW: { tone: 'idle', label: 'Nuevo' },
  CONTACTED: { tone: 'warn', label: 'Contactado' },
  QUALIFIED: { tone: 'ok', label: 'Cualificado' },
  UNQUALIFIED: { tone: 'idle', label: 'No cualificado' },
  CONVERTED: { tone: 'ok', label: 'Convertido' },
  LOST: { tone: 'bad', label: 'Perdido' },
};

const CANALES: Readonly<Record<LeadChannel, string>> = {
  META_LEAD_FORM: 'Formulario de Meta',
  LANDING_FORM: 'Formulario de la landing',
  WHATSAPP_CLICK: 'Clic a WhatsApp',
  MESSENGER: 'Messenger',
  ORGANIC: 'Orgánico',
  MANUAL: 'Manual',
};

@Component({
  selector: 'app-leads',
  imports: [DatePipe],
  templateUrl: './leads.html',
  styleUrl: './leads.css',
})
export class Leads {
  readonly #api = inject(LeadsApi);

  // Todo el estado en signals: Angular 22 es zoneless y una propiedad normal asignada dentro de un
  // `await` no refrescaría la vista. Mismo motivo que en `system-status.ts`.
  protected readonly result = signal<LeadsResult | null>(null);
  protected readonly loading = signal(false);
  protected readonly consultedAt = signal<Date | null>(null);

  protected readonly rows = computed<readonly LeadRow[]>(() =>
    (this.result()?.leads ?? []).map(toRow),
  );

  protected readonly hayMas = computed(() => this.result()?.hasMore === true);

  /**
   * El endpoint no existe todavía: el API responde `404 RESOURCE_NOT_FOUND`.
   *
   * Se comprueba el **código**, no el 404 a secas. Para una ruta de colección, un 404 solo puede
   * significar «esa ruta no está montada»; nombrarlo así permite decir exactamente qué falta en vez
   * de un «error 404» que parecería un fallo.
   */
  protected readonly rutaSinImplementar = computed(
    () => this.result()?.problem?.code === 'RESOURCE_NOT_FOUND',
  );

  constructor() {
    void this.refresh();
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);

    const result = await this.#api.list();

    this.result.set(result);
    this.consultedAt.set(new Date());
    this.loading.set(false);
  }
}

function toRow(lead: Lead): LeadRow {
  const nombre = lead.contactName;

  return {
    id: lead.id,
    nombre: nombre ?? 'Sin nombre',
    email: lead.identity.email,
    telefono: lead.identity.phone,
    whatsapp: buildWhatsAppLink({
      phoneE164: lead.identity.phone,
      // Solo el nombre de pila: el texto viaja en la URL y queda en el historial del navegador.
      // Ni apellidos, ni email, ni teléfono — eso ya está en la ficha, no hace falta repetirlo.
      message: saludo(nombre),
    }),
    estado: ESTADOS[lead.status] ?? valorDesconocido(lead.status),
    canal: CANALES[lead.channel] ?? String(lead.channel),
    consentimiento: consentimientoDe(lead),
    consentimientoBase: lead.consent?.basis ?? 'no consta',
    // El marketing se bloquea tanto si la persona dijo que no como si no hay constancia de que
    // aceptara. `docs/security.md` §10.7: la ausencia de evidencia no es evidencia de permiso.
    marketingBloqueado: lead.consent === null || !lead.consent.granted,
    creadoEn: lead.createdAt,
    primeraRespuesta: lead.firstResponseAt ?? '',
    respondido: lead.firstResponseAt !== null,
  };
}

/**
 * Estado que llegó sin estar en el catálogo.
 *
 * Los `Record` de arriba son exhaustivos para el compilador, así que este caso no debería ocurrir.
 * Existe porque la comprobación de forma de `leads-api.ts` es deliberadamente superficial (no valida
 * campo a campo), y una tabla de leads no es sitio para un `undefined` que rompa el render: se pinta
 * el valor crudo, que es feo pero **honesto** y localizable.
 */
function valorDesconocido(valor: unknown): View {
  return { tone: 'idle', label: typeof valor === 'string' ? valor : 'Desconocido' };
}

function consentimientoDe(lead: Lead): View {
  if (lead.consent === null) {
    return { tone: 'idle', label: 'Sin registro' };
  }

  return lead.consent.granted
    ? { tone: 'ok', label: 'Autorizado' }
    : { tone: 'bad', label: 'NO autorizado' };
}

function saludo(nombreCompleto: string | null): string {
  const pila = nombreCompleto?.trim().split(/\s+/)[0];

  return pila === undefined || pila === ''
    ? 'Hola, gracias por tu interés. ¿Te ayudo con alguna duda?'
    : `Hola ${pila}, gracias por tu interés. ¿Te ayudo con alguna duda?`;
}
