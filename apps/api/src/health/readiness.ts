/**
 * Sonda de disponibilidad de una dependencia (Postgres, Redis, worker, proveedor LLM).
 *
 * `docs/api.md` §1.1 separa dos conceptos que se confunden a menudo:
 *   - **live**  → el proceso está vivo. Si falla, el orquestador debe **reiniciar** el contenedor.
 *   - **ready** → el proceso puede atender tráfico. Si falla, debe **sacarse del balanceador**
 *                 pero NO reiniciarse: reiniciar no arregla que Postgres esté caído.
 *
 * Por eso un indicador de `ready` consulta la dependencia, y uno de `live` no consulta nada.
 */
export interface ReadinessIndicator {
  readonly name: string;
  /** `true` si la dependencia responde. No debe lanzar: un fallo es un `false`. */
  check(): Promise<boolean>;
}

/**
 * Token de inyección para las sondas registradas.
 *
 * **Estado actual: vacío.** No hay ninguna sonda porque este hito no abre Postgres ni Redis. Con
 * cero sondas, `/health/ready` devuelve `ok` sin comprobar nada — lo cual es **cierto** (no hay
 * dependencias que puedan estar caídas) pero también inútil, y por eso está escrito aquí en vez
 * de quedar implícito.
 *
 * Cuando Prisma y BullMQ entren (Hito 2), cada uno registra su sonda en `HealthModule`. A partir
 * de ese momento `ready` empieza a significar algo de verdad.
 */
export const READINESS_INDICATORS = Symbol('READINESS_INDICATORS');
