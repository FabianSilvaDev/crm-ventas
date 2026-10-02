import { describe, expect, it } from 'vitest';

import type { ProblemDetails } from '@crm/contracts';

import type { AuthResult } from '../../core/auth-api';
import { comoFalloDeAcceso, formatearEspera } from './auth-errors';

function conProblema(
  code: string,
  httpStatus: number,
  retryAfterSeconds: number | null = null,
): AuthResult<unknown> {
  return {
    outcome: 'problem',
    httpStatus,
    traceId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    body: null,
    problem: {
      type: 'about:blank',
      title: 'Título del contrato',
      status: httpStatus,
      detail: 'Detalle del contrato.',
      instance: '/api/v1/auth/login',
      code,
      traceId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
      timestamp: '2028-01-01T00:00:00.000Z',
      retryable: false,
    } as ProblemDetails,
    transportError: null,
    retryAfterSeconds,
  };
}

function sinRespuesta(transportError: string, httpStatus: number | null = null): AuthResult<unknown> {
  return {
    outcome: 'unreachable',
    httpStatus,
    traceId: null,
    body: null,
    problem: null,
    transportError,
    retryAfterSeconds: null,
  };
}

describe('comoFalloDeAcceso', () => {
  it('el 404 de una ruta sin montar se reconoce ANTES que cualquier otra cosa', () => {
    // El caso de hoy: el módulo auth no existe. Un 404 sin `problem` también encaja en «no hubo
    // respuesta interpretable», así que sin esta comprobación primero el mensaje sería «no se pudo
    // contactar con el servidor», que manda a mirar el puerto en vez de a mirar el Hito 2.
    const fallo = comoFalloDeAcceso(sinRespuesta('Respuesta de error con un cuerpo que no es problem+json.', 404));

    expect(fallo.kind).toBe('servicio-ausente');
    expect(fallo.detalle).toContain('Hito 2');
  });

  it('el mensaje de credenciales inválidas no distingue si el correo existe', () => {
    // La regla viene de docs/security.md §2.1 y §12.9: el servidor hace indistinguibles el correo
    // inexistente y la contraseña incorrecta, incluso en el tiempo de respuesta. Lo que este test
    // protege es que la REDACCIÓN no estropee esa propiedad: basta una frase del tipo «esa cuenta no
    // existe» para convertir el formulario en un oráculo de qué direcciones están registradas.
    const fallo = comoFalloDeAcceso(conProblema('AUTH_INVALID_CREDENTIALS', 401));

    expect(fallo.kind).toBe('credenciales');
    expect(`${fallo.titulo} ${fallo.detalle}`).not.toMatch(
      /no existe|no está registrad|correo desconocid|usuario desconocid|contraseña incorrecta para/i,
    );
    // Y dice por qué, para que nadie «mejore» el mensaje más adelante.
    expect(fallo.detalle).toContain('deliberado');
  });

  it('una cuenta bloqueada anuncia la espera cuando el servidor la ha dicho', () => {
    const fallo = comoFalloDeAcceso(conProblema('AUTH_ACCOUNT_LOCKED', 423, 900));

    expect(fallo.kind).toBe('cuenta-bloqueada');
    expect(fallo.detalle).toContain('en 15 minutos');
  });

  it('sin `Retry-After` legible NO inventa una cifra', () => {
    const fallo = comoFalloDeAcceso(conProblema('AUTH_ACCOUNT_LOCKED', 423, null));

    expect(fallo.detalle).toContain('no ha dicho cuánto dura');
    expect(fallo.detalle).not.toMatch(/\d+\s*(minuto|hora|día)/);
  });

  it('el límite de peticiones también distingue si hay cifra o no', () => {
    expect(comoFalloDeAcceso(conProblema('RATE_LIMIT_EXCEEDED', 429, 30)).detalle).toContain(
      'en menos de un minuto',
    );
    expect(comoFalloDeAcceso(conProblema('RATE_LIMIT_EXCEEDED', 429, null)).detalle).toContain(
      'no ha dicho por cuánto tiempo',
    );
  });

  it('un código inesperado se muestra tal cual, con su `traceId`', () => {
    // Ante algo no previsto, lo único útil es el dato que permite buscar la traza en los logs.
    const fallo = comoFalloDeAcceso(conProblema('SOMETHING_ELSE', 500));

    expect(fallo.kind).toBe('otro');
    expect(fallo.titulo).toBe('Título del contrato');
    expect(fallo.problem?.code).toBe('SOMETHING_ELSE');
    expect(fallo.problem?.traceId).toBe('a1b2c3d4e5f60718293a4b5c6d7e8f90');
  });

  it('un fallo de red usa el texto del transporte, que ya es específico', () => {
    const fallo = comoFalloDeAcceso(
      sinRespuesta('No hubo respuesta del API. ¿Está arrancado en el puerto 3000?'),
    );

    expect(fallo.kind).toBe('transporte');
    expect(fallo.detalle).toContain('puerto 3000');
  });
});

describe('formatearEspera', () => {
  it('redondea HACIA ARRIBA: es preferible pasarse que invitar a reintentar antes de tiempo', () => {
    expect(formatearEspera(90)).toBe('en 2 minutos');
    expect(formatearEspera(60)).toBe('en 1 minuto');
    expect(formatearEspera(3600)).toBe('en 1 hora');
    expect(formatearEspera(3660)).toBe('en 2 horas');
    expect(formatearEspera(86400)).toBe('en 1 día');
  });

  it('por debajo del minuto no da una cifra de segundos', () => {
    expect(formatearEspera(45)).toBe('en menos de un minuto');
  });

  it('`null` es «no me lo han dicho» y `0` es «ya puedes»: ninguno de los dos se anuncia', () => {
    expect(formatearEspera(null)).toBeNull();
    expect(formatearEspera(0)).toBeNull();
    expect(formatearEspera(-5)).toBeNull();
  });
});
