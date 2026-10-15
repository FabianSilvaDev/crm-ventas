/** Configuracion del workspace, del perfil y de la simulacion. */
import { getSettings } from '../services/settings.service.js';
import { asyncHandler, ok } from '../utils/http.js';

export const readSettings = asyncHandler((_req, res) => {
  ok(res, getSettings());
});
