import type { MetaLeadGraphResponse } from '@crm/contracts';

/**
 * Puerto de salida hacia el Graph API de Meta: «dame los datos del lead que me acabas de anunciar».
 *
 * ## Por qué es una interfaz y no una llamada suelta
 *
 * Es la **única dependencia externa del camino de ingesta**, y también la única que no se puede
 * probar sin credenciales reales: para leer un lead hace falta una app de Meta aprobada y el permiso
 * `leads_retrieval`. Con esta interfaz, toda la ingesta se prueba contra fixtures y la red queda
 * confinada a una implementación.
 *
 * El mismo patrón que `READINESS_INDICATORS` en `health/readiness.ts`: un token de inyección propio y
 * la implementación elegida en la raíz de composición (aquí, `WebhooksModule`).
 *
 * ## Contrato de fallos: `null` no es un error
 *
 * - **`null`** → Meta dice que ese `leadgen_id` **no existe** (404). Es un dato, no un fallo: puede
 *   ser un lead borrado, o un id de otra cuenta. Quien consuma esto debe decidir qué hacer —en la
 *   ingesta real, descartar el evento— pero **no** reintentar: insistir no lo va a resucitar.
 * - **Lanza `AppError('DEPENDENCY_UNAVAILABLE')`** → no pudimos preguntar (timeout, red caída, 5xx,
 *   token inválido, respuesta con forma desconocida). Todo lo que un reintento **sí** puede arreglar.
 *   El webhook lo traducirá a un `503` para que Meta reintente más tarde.
 *
 * Esa distinción es la que evita las dos formas de perder un lead: reintentar lo irrecuperable
 * (ruido infinito) o descartar lo transitorio (pérdida silenciosa).
 */
export interface MetaLeadGraphClient {
  /** Devuelve el lead, o `null` si Meta responde que no existe. Lanza `AppError` si no se pudo preguntar. */
  fetchLead(leadgenId: string): Promise<MetaLeadGraphResponse | null>;
}

/**
 * Token de inyección del cliente del Graph API.
 *
 * El mismo símbolo que en `READINESS_INDICATORS`: sin él, dos módulos podrían inyectar
 * implementaciones distintas y la sustitución por fixtures dejaría de ser fiable.
 */
export const META_LEAD_GRAPH_CLIENT = Symbol('crm:meta-lead-graph-client');
