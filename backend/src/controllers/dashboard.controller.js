/** Dashboard agregado de la operacion. */
import { getDashboard } from '../services/dashboard.service.js';
import { asyncHandler, ok } from '../utils/http.js';

export const readDashboard = asyncHandler((_req, res) => {
  ok(res, getDashboard(), { scope: 'dashboard' });
});
