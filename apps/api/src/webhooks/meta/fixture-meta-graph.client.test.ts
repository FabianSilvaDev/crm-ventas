import { metaLeadGraphResponseSchema } from '@crm/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../common/app-error.js';
import { FixtureMetaGraphClient } from './fixture-meta-graph.client.js';
import { IDS_DE_PRUEBA, LEADS_DE_PRUEBA } from './fixtures/lead-fixtures.js';

const cliente = new FixtureMetaGraphClient();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FixtureMetaGraphClient', () => {
  it('devuelve el lead de un id conocido', async () => {
    const lead = await cliente.fetchLead('lead-1');

    expect(lead.id).toBe('lead-1');
    expect(lead.form_id).toBe('999');
  });

  it('todos los fixtures cumplen el contrato del Graph API', async () => {
    // Si un fixture deja de cumplir el schema, la prueba que lo usa empezaría a mentir: probaría una
    // forma que la API real no puede devolver.
    for (const [leadgenId, fixture] of Object.entries(LEADS_DE_PRUEBA)) {
      expect(metaLeadGraphResponseSchema.safeParse(fixture).success, leadgenId).toBe(true);
      expect((await cliente.fetchLead(leadgenId)).id).toBe(leadgenId);
    }
  });

  it('falla de forma controlada con un id desconocido', async () => {
    // `null` significaría «Meta dice que no existe». Un id que no está en la tabla es un error de
    // tecleo, y confundirlos convertiría un fallo de desarrollo en un caso legítimo.
    const error = await cliente.fetchLead('lead-que-no-existe').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('DEPENDENCY_UNAVAILABLE');
    expect((error as AppError).context).toMatchObject({ leadgenId: 'lead-que-no-existe' });
    // El error lista lo que sí existe: es lo que uno necesita leer en ese momento.
    expect((error as AppError).context).toMatchObject({ idsDisponibles: IDS_DE_PRUEBA });
  });

  it('nunca hace red', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await cliente.fetchLead('lead-1');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('incluye a propósito los casos difíciles que la ingesta tendrá que tratar', async () => {
    // Sin evidencia de consentimiento, sin teléfono y con consentimiento denegado: son los tres
    // caminos que `docs/security.md` §10.7 obliga a distinguir.
    expect(LEADS_DE_PRUEBA['lead-2']?.custom_disclaimer_responses).toBeUndefined();
    expect(LEADS_DE_PRUEBA['lead-3']?.field_data?.some((c) => c.name === 'phone_number')).toBe(false);
    expect(LEADS_DE_PRUEBA['lead-4']?.custom_disclaimer_responses?.[0]?.is_checked).toBe(false);
  });

  it('usa el mismo `leadgen_id` que el sobre de prueba del webhook', () => {
    // Así el camino «webhook firmado → lectura del lead» se puede recorrer entero en modo fixture.
    expect(Object.keys(LEADS_DE_PRUEBA)).toContain('lead-1');
  });
});
