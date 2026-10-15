/**
 * Arnes de pruebas CON puertas de decision activadas.
 *
 * Fichero aparte por una razon concreta: `config.js` lee `SIMULATION_GATES` al
 * importarse, y `node --test` ejecuta cada fichero en su propio proceso, asi que esta
 * es la forma fiable de probar los dos modos sin recargar modulos.
 *
 * Las etapas con puerta corren mas despacio que la simulacion normal, porque hay que
 * esperar a que cada etapa termine antes de que se abra la siguiente.
 */
import { applyBaseEnv, startServerWith, waitFor } from './api-client.js';

applyBaseEnv({ gates: 'on', stepMs: '220' });

const { createApp } = await import('../src/app.js');

/** Levanta la API con las puertas activadas. */
export const startServer = () => startServerWith(createApp());

export { waitFor };
