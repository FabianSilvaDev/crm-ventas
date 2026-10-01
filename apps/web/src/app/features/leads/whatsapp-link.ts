/**
 * Formato E.164, **duplicado a propósito** respecto de `phoneE164Schema` de `@crm/contracts`.
 *
 * Importar el schema como valor arrastraría Zod entero al bundle del navegador: medido, este chunk
 * pasaba de 11 kB a 472 kB. Para una comprobación de forma no se paga eso, así que aquí se repite la
 * expresión regular.
 *
 * Que las dos no puedan divergir no se deja a la disciplina: `whatsapp-link.spec.ts` compara esta
 * comprobación contra el schema del contrato con una tabla de números válidos e inválidos. La regla
 * sigue siendo una sola; lo que cambia es dónde se comprueba —en un test, no en el navegador de
 * quien usa el CRM.
 */
const E164 = /^\+[1-9]\d{7,14}$/;

export interface WhatsAppLinkInput {
  /** Teléfono en E.164, o `null` si el lead no lo trae. */
  readonly phoneE164: string | null;
  /** Texto que WhatsApp mostrará ya escrito. Lo revisa una persona antes de enviarlo. */
  readonly message: string;
}

/**
 * Construye el enlace `wa.me` para abrir la conversación con un lead.
 *
 * ## Devuelve `null` en vez de intentar arreglar el número
 *
 * Es la decisión importante de esta función. `wa.me/3001234567` **no falla**: abre WhatsApp y
 * apunta a otra persona, porque sin código de país el número se interpreta en otro sitio. Un enlace
 * que «casi funciona» y escribe a un desconocido es peor que un enlace ausente, así que aquí se
 * exige E.164 —el mismo formato que valida la ingesta, comprobado contra el contrato en los tests— y
 * si no cuadra se devuelve `null`. Quien pinta la pantalla explica por qué no hay enlace, en vez de
 * ofrecer uno roto.
 *
 * ## Qué NO promete
 *
 * - **No confirma que el mensaje se envió.** Abre WhatsApp con el texto escrito; si la persona le da
 *   a enviar es cosa suya. La pantalla dice «se abrió el contacto», no «se contactó».
 * - **No valida que el número exista** ni que tenga WhatsApp. Eso no se puede saber desde aquí.
 *
 * ## Sobre el texto prellenado
 *
 * Viaja en la URL, así que queda en el historial del navegador y en el portapapeles si alguien copia
 * el enlace. Por eso quien lo compone debe meter **como mucho el nombre de pila**: ni apellidos, ni
 * email, ni teléfono. Un enlace de WhatsApp no es un sitio donde dejar datos personales.
 */
export function buildWhatsAppLink(input: WhatsAppLinkInput): string | null {
  if (input.phoneE164 === null || !E164.test(input.phoneE164)) {
    return null;
  }

  // wa.me quiere solo dígitos: sin `+`, sin espacios y sin guiones. E.164 ya garantiza que el
  // primer dígito no es un cero de relleno.
  const digits = input.phoneE164.slice(1);

  return `https://wa.me/${digits}?text=${encodeURIComponent(input.message)}`;
}
