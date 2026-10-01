import { metaLeadGraphResponseSchema } from '@crm/contracts';
import type { MetaLeadGraphResponse } from '@crm/contracts';

import { AppError } from '../../common/app-error.js';
import type { MetaLeadGraphClient } from './meta-graph.client.js';
import { IDS_DE_PRUEBA, LEADS_DE_PRUEBA } from './fixtures/lead-fixtures.js';

/**
 * Cliente del Graph API servido desde fixtures locales (`META_GRAPH_MODE=fixture`).
 *
 * Permite recorrer el camino completo de la ingesta —webhook firmado → lectura del lead → decisión de
 * consentimiento— **sin app de Meta y sin salir a internet**. Es lo que hace que la ingesta real del
 * Hito 2 se pueda escribir y probar antes de tener credenciales.
 *
 * ## Dos decisiones que conviene entender
 *
 * **Un id desconocido lanza, no devuelve `null`.** `null` significa «Meta dice que no existe», y
 * devolverlo por un id que simplemente no está en la tabla convertiría un error de tecleo en un caso
 * legítimo. Aquí se avisa con la lista de ids disponibles, que es lo que uno necesita leer en ese
 * momento.
 *
 * **Cada lectura pasa por el schema del contrato.** Si un fixture se escribe mal —o el contrato
 * cambia—, falla aquí y no en la ingesta. Un fixture que no cumple el contrato es una prueba que
 * miente.
 *
 * Nunca hace red: no hay `fetch` en este fichero, y hay una prueba que lo comprueba.
 */
export class FixtureMetaGraphClient implements MetaLeadGraphClient {
  async fetchLead(leadgenId: string): Promise<MetaLeadGraphResponse> {
    const fixture = LEADS_DE_PRUEBA[leadgenId];

    if (fixture === undefined) {
      throw new AppError(
        'DEPENDENCY_UNAVAILABLE',
        `No hay fixture para el leadgen_id «${leadgenId}».`,
        { context: { leadgenId, idsDisponibles: IDS_DE_PRUEBA } },
      );
    }

    return metaLeadGraphResponseSchema.parse(fixture);
  }
}
