import { Logger } from '@nestjs/common';

import type { MetaLeadEvent, MetaLeadIntake, MetaLeadIntakeResult } from './meta-lead-intake.js';

/**
 * Doble de desarrollo. **No guarda nada, y el nombre lo dice.**
 *
 * Existe para que el webhook pueda probarse de punta a punta —firma, validación, respuesta— antes de
 * que exista la base de datos. Registra la recepción y devuelve `stored` siempre.
 *
 * ## Lo que este doble NO hace, y conviene no olvidar
 *
 * - **No persiste el lead.** El lead existe solo como línea de log y desaparece con la petición.
 * - **No deduplica.** Devuelve `stored` para cada evento, incluso si es el décimo reintento del
 *   mismo `leadgenId`. La idempotencia real es el `UNIQUE(meta_lead_id)` de la base de datos;
 *   simularla aquí con un `Set` en memoria sería peor que no tenerla, porque moriría con el proceso
 *   y daría una falsa sensación de protección (y una respuesta `duplicate` que no sería cierta tras
 *   un reinicio).
 * - **No pide nada al Graph API.** Los datos de la persona no se traen; es la etapa siguiente.
 *
 * Quien lea una respuesta `200 {received:true}` en este estado de la rebanada debe entender que
 * significa «el webhook verificó su firma y aceptó el evento», **no** «hay un lead guardado».
 */
export class DevMetaLeadIntakeNoPersistencia implements MetaLeadIntake {
  private readonly logger = new Logger(DevMetaLeadIntakeNoPersistencia.name);

  intake(event: MetaLeadEvent): Promise<MetaLeadIntakeResult> {
    this.logger.log({
      action: 'meta_lead.received_dev_double',
      leadgenId: event.leadgenId,
      formId: event.formId,
      campaignId: event.campaignId,
      persisted: false,
    });

    return Promise.resolve('stored');
  }
}
