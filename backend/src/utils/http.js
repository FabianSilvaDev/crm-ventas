/**
 * Contratos de respuesta de la API.
 * Exito: `{ data, meta }`. Listados: `{ data, meta: { total, page, pageSize, ... } }`.
 * Error: `{ error: { code, message, details? }, meta }`.
 */
import { config } from '../config.js';
import { DEMO_REFERENCE_DATE, nowIso } from './time.js';

const baseMeta = (extra) => ({
  generatedAt: nowIso(),
  apiVersion: config.version,
  demo: config.demo,
  demoReferenceDate: DEMO_REFERENCE_DATE,
  pollIntervalMs: config.pollIntervalMs,
  ...extra,
});

export const ok = (res, data, meta) => res.status(200).json({ data, meta: baseMeta(meta) });

export const created = (res, data, meta) =>
  res.status(201).json({ data, meta: baseMeta(meta) });

export const accepted = (res, data, meta) =>
  res.status(202).json({ data, meta: baseMeta(meta) });

export const noContent = (res) => res.status(204).end();

export const paginated = (res, items, { page, pageSize, total, extra } = {}) =>
  res.status(200).json({
    data: items,
    meta: baseMeta({
      total: total ?? items.length,
      page,
      pageSize,
      totalPages: pageSize ? Math.max(1, Math.ceil((total ?? items.length) / pageSize)) : 1,
      ...extra,
    }),
  });

/** Envuelve un handler async para que sus rechazos lleguen al manejador central. */
export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
