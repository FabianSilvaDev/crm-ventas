import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';

import { buildProblem, toValidationIssues } from '@crm/contracts';
import type { ErrorCode, ProblemDetails } from '@crm/contracts';

import { AppError } from './app-error.js';
import { currentTraceId, generateTraceId } from './request-context.js';
import type { RequestWithContext } from './trace-id.middleware.js';

/**
 * Códigos para los errores que genera el **framework**, no nuestro código. Son los únicos que
 * NestJS produce sin pasar por `AppError` (una ruta inexistente, el throttler).
 * Deliberadamente corta: cada entrada de aquí es una excepción a la regla "todo error de dominio
 * nace con un `AppError`".
 */
const FRAMEWORK_STATUS_CODES: Readonly<Partial<Record<number, ErrorCode>>> = {
  404: 'RESOURCE_NOT_FOUND',
  429: 'RATE_LIMIT_EXCEEDED',
};

const FRAMEWORK_DETAILS: Readonly<Partial<Record<ErrorCode, string>>> = {
  RESOURCE_NOT_FOUND: 'La ruta solicitada no existe.',
  RATE_LIMIT_EXCEEDED: 'Se superó el límite de peticiones. Reintenta tras el backoff.',
};

/**
 * Ruta que se publica en `instance` (`docs/api.md` §2.1): la ruta **completa**, sin query string.
 *
 * Se parte de `originalUrl` y no de `req.path` porque Nest monta el router bajo el prefijo global
 * (`/api/v1`) y Express **recorta** ese prefijo de `req.path`: un 404 en `/api/v1/nope` llega al
 * filtro como `/nope`. El contrato escribe la ruta tal como la pidió el cliente, y su ejemplo es
 * `/api/v1/campaigns/{id}/transition`.
 *
 * Se corta la query a propósito: si un token viajara en ella, acabaría copiado en el cuerpo del
 * error y en los logs.
 */
function toInstancePath(url: string): string {
  const queryIndex = url.indexOf('?');
  const path = queryIndex === -1 ? url : url.slice(0, queryIndex);
  return path.length > 0 ? path : '/';
}

/**
 * Convierte **cualquier** excepción en un `application/problem+json` (RFC 9457) conforme a
 * `docs/api.md` §2.
 *
 * Es un `@Catch()` sin argumentos: la última red de seguridad. Nada sale del API sin pasar por
 * aquí, de modo que no puede haber una respuesta de error con forma distinta a la del contrato.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<Response>();

    const traceId = request.traceId ?? currentTraceId() ?? generateTraceId();
    const instance = toInstancePath(request.originalUrl ?? request.url);

    const problem = this.toProblem(exception, traceId, instance);

    this.log(exception, problem);

    if (!response.headersSent) {
      response.status(problem.status);
      response.setHeader('Content-Type', 'application/problem+json; charset=utf-8');
    }
    response.json(problem);
  }

  private toProblem(exception: unknown, traceId: string, instance: string): ProblemDetails {
    if (exception instanceof AppError) {
      return buildProblem({
        code: exception.code,
        detail: exception.detail,
        instance,
        traceId,
        ...(exception.context === undefined ? {} : { context: exception.context }),
        ...(exception.errors === undefined ? {} : { errors: exception.errors }),
      });
    }

    if (exception instanceof ZodError) {
      const errors = toValidationIssues(exception.issues);
      return buildProblem({
        code: 'VALIDATION_FAILED',
        detail: `La petición no supera la validación (${errors.length} campo(s)).`,
        instance,
        traceId,
        errors,
      });
    }

    if (exception instanceof HttpException) {
      const frameworkCode = FRAMEWORK_STATUS_CODES[exception.getStatus()];
      if (frameworkCode !== undefined) {
        return buildProblem({
          code: frameworkCode,
          detail: FRAMEWORK_DETAILS[frameworkCode] ?? 'La petición no pudo completarse.',
          instance,
          traceId,
        });
      }
    }

    // Cualquier otra cosa es un fallo nuestro sin clasificar. Se responde 500 **a propósito**,
    // aunque la excepción traiga otro status: si un 4xx llega hasta aquí es que no supimos
    // clasificarlo, y devolver 500 lo hace ruidoso en vez de silenciosamente incorrecto.
    return buildProblem({
      code: 'INTERNAL_ERROR',
      detail: this.internalDetail(exception),
      instance,
      traceId,
    });
  }

  /**
   * Detalle visible al cliente para un error no clasificado.
   *
   * En producción es un texto fijo: el mensaje de una excepción arbitraria puede contener SQL,
   * rutas del sistema de archivos, nombres de tabla o valores de filas. El `traceId` es lo que
   * permite recuperar el error real desde los logs, y para eso está.
   */
  private internalDetail(exception: unknown): string {
    if (this.isProduction) {
      return 'Se produjo un error interno. Usa el traceId para correlacionarlo con los logs del servidor.';
    }

    const message = exception instanceof Error ? exception.message : String(exception);
    return `[detalle visible solo fuera de producción] ${message}`;
  }

  private log(exception: unknown, problem: ProblemDetails): void {
    // Se registran método, ruta, status, código y traceId. NO se registra el cuerpo de la
    // petición ni las cabeceras: pueden llevar credenciales o datos personales.
    const summary =
      `traceId=${problem.traceId} code=${problem.code} status=${problem.status} ` +
      `instance=${problem.instance}`;

    if (problem.status >= 500) {
      this.logger.error(
        summary,
        exception instanceof Error ? exception.stack : String(exception),
      );
      return;
    }

    this.logger.warn(`${summary} detail=${problem.detail}`);
  }
}
