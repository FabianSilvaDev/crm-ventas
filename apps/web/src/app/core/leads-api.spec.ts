import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LeadsApi } from './leads-api';

/**
 * Pruebas del cliente HTTP. Lo que se comprueba aquí no es «hace un GET», sino que **no convierte
 * una respuesta inesperada en una tabla de leads**: la diferencia entre un error visible y una
 * pantalla que miente con la boca pequeña.
 */
describe('LeadsApi', () => {
  let api: LeadsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    api = TestBed.inject(LeadsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  /** `expectOne` compara la URL **con** su query string; aquí se compara la ruta, sin el `limit`. */
  function peticionDeLeads(): TestRequest {
    return http.expectOne((req) => req.url === '/api/v1/leads');
  }

  it('pide la primera página con el límite del contrato', async () => {
    const promesa = api.list();

    const peticion = peticionDeLeads();
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.get('limit')).toBe('50');

    peticion.flush({ items: [], pageInfo: { hasMore: false, nextCursor: null } });

    await expect(promesa).resolves.toMatchObject({ outcome: 'ok', leads: [], hasMore: false });
  });

  it('devuelve los leads y el `hasMore` del contrato', async () => {
    const promesa = api.list();

    peticionDeLeads().flush({
      items: [{ id: 'a' }],
      pageInfo: { hasMore: true, nextCursor: 'c2' },
    });

    const result = await promesa;
    expect(result.outcome).toBe('ok');
    expect(result.leads).toHaveLength(1);
    expect(result.hasMore).toBe(true);
  });

  it('traduce el 404 de una ruta sin montar a un problema del contrato', async () => {
    // El caso de hoy: `GET /api/v1/leads` todavía no existe. La pantalla necesita el CÓDIGO para
    // poder decir «el listado aún no está implementado» en vez de «error 404».
    const promesa = api.list();

    peticionDeLeads().flush(
      {
        type: 'about:blank',
        title: 'Recurso no encontrado',
        status: 404,
        code: 'RESOURCE_NOT_FOUND',
        detail: 'La ruta solicitada no existe.',
        instance: '/api/v1/leads',
        traceId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
      },
      { status: 404, statusText: 'Not Found' },
    );

    const result = await promesa;
    expect(result.outcome).toBe('problem');
    expect(result.problem?.code).toBe('RESOURCE_NOT_FOUND');
    expect(result.httpStatus).toBe(404);
    expect(result.leads).toEqual([]);
  });

  it('no acepta como lista un 200 con otra forma', async () => {
    // Un proxy o un cambio de API que devuelva esto no debe pintarse como «no hay leads»: no es lo
    // mismo «la lista está vacía» que «no me llegó una lista».
    const promesa = api.list();

    peticionDeLeads().flush({ leads: [], total: 0 });

    const result = await promesa;
    expect(result.outcome).toBe('unreachable');
    expect(result.transportError).toContain('no tiene la forma de una lista de leads');
  });

  it('no acepta como lista un `items` que no es array', async () => {
    const promesa = api.list();

    peticionDeLeads().flush({ items: null, pageInfo: { hasMore: false } });

    await expect(promesa).resolves.toMatchObject({ outcome: 'unreachable' });
  });

  it('no acepta una lista sin `pageInfo.hasMore`', async () => {
    // `hasMore` es lo que impide que la pantalla dé por completo un listado paginado.
    const promesa = api.list();

    peticionDeLeads().flush({ items: [], pageInfo: {} });

    await expect(promesa).resolves.toMatchObject({ outcome: 'unreachable' });
  });

  it('trata un error con cuerpo que no es problem+json como fallo de transporte', async () => {
    const promesa = api.list();

    peticionDeLeads().flush('<html>Bad gateway</html>', {
      status: 502,
      statusText: 'Bad Gateway',
    });

    const result = await promesa;
    expect(result.outcome).toBe('unreachable');
    expect(result.problem).toBeNull();
    expect(result.transportError).toContain('problem+json');
  });
});
