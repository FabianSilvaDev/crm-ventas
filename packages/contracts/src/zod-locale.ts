import { z } from 'zod';

/**
 * Mensajes de validación en español.
 *
 * Los mensajes de Zod viajan al cliente dentro de `errors[].message` (`docs/api.md` §2.2), así que
 * son parte del contrato observable. Por defecto Zod responde en inglés: sin esto, un CRM en
 * español devolvería "Invalid input: expected number, received string" a un usuario colombiano.
 *
 * Zod 4 trae los locales incorporados, así que no hay tabla que mantener a mano.
 *
 * Se configura al importar `@crm/contracts` porque el idioma es una propiedad **del contrato**,
 * no de cada proceso: si se dejara a cada app, el worker y el API podrían responder en idiomas
 * distintos ante el mismo payload. El paquete expone un único punto de entrada (`.`) en su
 * `exports`, de modo que no hay forma de cargar los schemas sin pasar por aquí.
 */
z.config(z.locales.es());
