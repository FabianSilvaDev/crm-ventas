/**
 * Prueba de humo del layout raiz.
 *
 * Monta el componente `App` con el enrutador real y un backend HTTP simulado, para
 * comprobar que la cadena completa (layout + servicios + contenedores de inyeccion)
 * arranca sin errores y que la cabecera refleja el estado que devuelve la API.
 *
 * Se desactiva la navegacion inicial para que la prueba no cargue las vistas
 * diferidas: aqui se valida el armazon, no cada seccion.
 *
 *   npm --prefix frontend test
 */
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, withDisabledInitialNavigation } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';

/** Respuestas minimas por endpoint, para que cada servicio reciba la forma que espera. */
const respond = (httpMock: HttpTestingController): void => {
  for (const request of httpMock.match(() => true)) {
    const meta = { generatedAt: new Date().toISOString(), apiVersion: '1.0.0', demo: true };

    if (request.request.url.endsWith('/health')) {
      request.flush({
        data: {
          status: 'ok',
          version: '1.0.0',
          node: 'v24.19.0',
          nodeEnv: 'test',
          demoMode: true,
          uptimeSeconds: 1,
          memoryUsageMb: 10,
          simulation: { stepMs: 4200, taskMs: 2600, failureRate: 0, pollIntervalMs: 1500 },
          inMemory: { agents: 20, activityEvents: 0, runs: 0, agentTasks: 0, timers: 0 },
        },
        meta,
      });
      continue;
    }

    if (request.request.url.endsWith('/agents/summary')) {
      request.flush({
        data: { summary: { total: 20, active: 7, byStatus: { working: 5, error: 1, offline: 1 } }, statuses: [] },
        meta,
      });
      continue;
    }

    if (request.request.url.includes('/workflows/runs')) {
      request.flush({ data: [], meta: { ...meta, total: 0 } });
      continue;
    }

    if (request.request.url.endsWith('/settings')) {
      request.flush({ data: { profile: null, workspace: null, integrations: [], featureFlags: [] }, meta });
      continue;
    }

    if (request.request.url.includes('/notifications')) {
      request.flush({ data: [], meta: { ...meta, unread: 0, total: 0 } });
      continue;
    }

    request.flush({ data: {}, meta });
  }
};

describe('Layout raiz (App)', () => {
  let fixture: ComponentFixture<App>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes, withDisabledInitialNavigation()), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    respond(httpMock);
    fixture.detectChanges();
  });

  afterEach(() => {
    respond(httpMock);
    fixture.destroy();
  });

  it('pinta la marca, el sidebar y el header', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.app-brand__name')?.textContent).toContain('AI Operations CMS');
    expect(element.querySelector('app-sidebar')).toBeTruthy();
    expect(element.querySelector('app-header')).toBeTruthy();
    expect(element.querySelector('main.app-content')).toBeTruthy();
  });

  it('muestra las trece secciones del CMS en la navegacion', () => {
    const element = fixture.nativeElement as HTMLElement;
    const links = [...element.querySelectorAll('.nav__item')];
    const labels = [...element.querySelectorAll('.nav__label')].map((label) => label.textContent?.trim());

    expect(links).toHaveLength(13);
    expect(labels).toContain('Oportunidades');
    expect(labels).toContain('Oficina virtual');
    expect(labels).toContain('Flujo de agentes');
    expect(links.map((link) => link.getAttribute('href'))).toContain('/opportunities');
  });

  it('indica que la API esta conectada y cuantos agentes trabajan', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.conn')?.textContent).toContain('API conectada');
    expect(element.querySelector('.header__stat-value')?.textContent).toContain('7/20');
  });

  it('no marca la conexion como caida cuando la API responde', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.conn--offline')).toBeNull();
  });
});
