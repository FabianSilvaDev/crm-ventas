/**
 * Arnes de pruebas por defecto: simulacion SIN puertas de decision.
 *
 * Es el modo que usan las pruebas de mecanica (avance de etapas, pausa, reanudacion,
 * reinicio), donde interesa que un flujo llegue hasta el final sin detenerse. Las
 * puertas se prueban aparte, con `gated-harness.js`.
 *
 * Las variables se fijan ANTES de importar la aplicacion porque `config.js` las lee al
 * cargarse.
 */
import { applyBaseEnv, startServerWith, waitFor } from './api-client.js';

applyBaseEnv({ gates: 'off' });

const { createApp } = await import('../src/app.js');

/** Levanta la API en un puerto libre y devuelve utilidades para las pruebas. */
export const startServer = () => startServerWith(createApp());

export { waitFor };
