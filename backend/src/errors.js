/**
 * Errores de aplicacion. El manejador central traduce `AppError` a una
 * respuesta JSON estable y nunca expone detalles internos del servidor.
 */
export class AppError extends Error {
  /**
   * @param {number} status Codigo HTTP.
   * @param {string} code Codigo de error legible por maquina (SCREAMING_SNAKE_CASE).
   * @param {string} message Mensaje apto para el cliente.
   * @param {unknown} [details] Informacion adicional opcional (validaciones).
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }
}

export const badRequest = (message, details) => new AppError(400, 'BAD_REQUEST', message, details);
export const notFound = (message = 'Recurso no encontrado') =>
  new AppError(404, 'NOT_FOUND', message);
export const conflict = (message, details) =>
  new AppError(409, 'CONFLICT', message, details);
export const unprocessable = (message, details) =>
  new AppError(422, 'UNPROCESSABLE_ENTITY', message, details);
