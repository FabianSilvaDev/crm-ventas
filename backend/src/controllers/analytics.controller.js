/** Analitica agregada: embudo, atribucion, productos y experimentos. */
import { getAnalytics } from '../services/analytics.service.js';
import { asyncHandler, ok } from '../utils/http.js';
import { parseIntParam } from '../utils/validate.js';

/** Ventanas de tiempo sugeridas en la interfaz; se acepta cualquier valor de 7 a 30. */
const SUGGESTED_RANGES = [7, 14, 30];

export const readAnalytics = asyncHandler((req, res) => {
  const range = parseIntParam(req.query.range, 'range', { min: 7, max: 30, fallback: 14 });
  ok(res, getAnalytics({ range }), { suggestedRanges: SUGGESTED_RANGES });
});
