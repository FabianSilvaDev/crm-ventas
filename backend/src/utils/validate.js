/**
 * Validacion de parametros recibidos por Express (seccion 15 del prompt).
 * Lanza AppError 400 con detalles; nunca confia en la entrada del cliente.
 */
import { config } from '../config.js';
import { badRequest } from '../errors.js';

export const requireString = (value, field, { maxLength = 120, minLength = 1 } = {}) => {
  if (typeof value !== 'string' || value.trim().length < minLength) {
    throw badRequest(`El parametro "${field}" es obligatorio.`, { field });
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw badRequest(`El parametro "${field}" supera ${maxLength} caracteres.`, { field });
  }
  return trimmed;
};

/** Valida que `value` pertenezca a `allowed` (comparacion exacta). */
export const parseEnum = (value, allowed, field, fallback) => {
  if (value === undefined || value === '') return fallback;
  if (!allowed.includes(value)) {
    throw badRequest(
      `El parametro "${field}" debe ser uno de: ${allowed.join(', ')}.`,
      { field, allowed },
    );
  }
  return value;
};

export const parseIntParam = (value, field, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback } = {}) => {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw badRequest(`El parametro "${field}" debe ser un entero entre ${min} y ${max}.`, {
      field,
      min,
      max,
    });
  }
  return parsed;
};

export const parseBoolean = (value, field, fallback = undefined) => {
  if (value === undefined || value === '') return fallback;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  throw badRequest(`El parametro "${field}" debe ser true o false.`, { field });
};

/** Normaliza page/pageSize y devuelve tambien el offset para cortar arrays. */
export const parsePagination = (query = {}) => {
  const page = parseIntParam(query.page, 'page', { min: 1, fallback: 1 });
  const pageSize = parseIntParam(query.pageSize, 'pageSize', {
    min: 1,
    max: config.pagination.maxPageSize,
    fallback: config.pagination.defaultPageSize,
  });
  return { page, pageSize, offset: (page - 1) * pageSize };
};

/** Aplica paginacion a un array ya filtrado. */
export const paginate = (items, { page, pageSize, offset }) => ({
  items: items.slice(offset, offset + pageSize),
  total: items.length,
  page,
  pageSize,
});

/** Busqueda libre case-insensitive sobre varios campos. */
export const matchesSearch = (item, search, fields) => {
  if (!search) return true;
  const needle = search.toLocaleLowerCase('es');
  return fields.some((field) => {
    const value = field.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), item);
    return typeof value === 'string' && value.toLocaleLowerCase('es').includes(needle);
  });
};
