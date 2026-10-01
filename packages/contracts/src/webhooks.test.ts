import { describe, expect, it } from 'vitest';

import {
  metaLeadGraphResponseSchema,
  metaLeadgenValueSchema,
  metaWebhookAcceptedSchema,
  metaWebhookEnvelopeSchema,
  metaWebhookVerifyQuerySchema,
} from './webhooks.js';

const SOBRE_MINIMO = {
  object: 'page',
  entry: [
    {
      id: '1234567890',
      time: 1759324951,
      changes: [{ field: 'leadgen', value: { leadgen_id: 'abc123' } }],
    },
  ],
};

describe('metaWebhookEnvelopeSchema', () => {
  it('acepta el sobre de una entrega real', () => {
    expect(metaWebhookEnvelopeSchema.safeParse(SOBRE_MINIMO).success).toBe(true);
  });

  it('NO falla si Meta añade un campo que no conocemos', () => {
    // La razón de que estos schemas sean `loose` y no `strict`: Meta cambia su payload sin avisar,
    // y la ingesta de leads no puede caerse por un campo nuevo que ni siquiera usamos.
    const conCampoNuevo = {
      ...SOBRE_MINIMO,
      entry: [{ ...SOBRE_MINIMO.entry[0], campo_que_meta_anadira: 'en 2027' }],
    };

    expect(metaWebhookEnvelopeSchema.safeParse(conCampoNuevo).success).toBe(true);
  });

  it('acepta un sobre de otro tipo de objeto, para poder ignorarlo en vez de fallar', () => {
    // `object` es un string y no un literal a propósito: un sobre de `instagram` debe poder
    // responderse con `200 {ignored:true}`; un 422 sería un fallo que Meta reintentaría sin fin.
    expect(metaWebhookEnvelopeSchema.safeParse({ ...SOBRE_MINIMO, object: 'instagram' }).success).toBe(
      true,
    );
  });

  it('rechaza un sobre sin `entry`', () => {
    expect(metaWebhookEnvelopeSchema.safeParse({ object: 'page' }).success).toBe(false);
  });
});

describe('metaLeadgenValueSchema', () => {
  it('exige `leadgen_id`: sin él no hay nada que ir a buscar', () => {
    expect(metaLeadgenValueSchema.safeParse({ form_id: '999' }).success).toBe(false);
  });

  it('rechaza un `leadgen_id` vacío, que pasaría un `z.string()` a secas', () => {
    expect(metaLeadgenValueSchema.safeParse({ leadgen_id: '' }).success).toBe(false);
  });

  it('acepta los identificadores de atribución cuando vienen', () => {
    const result = metaLeadgenValueSchema.safeParse({
      leadgen_id: 'abc123',
      form_id: '999',
      ad_id: '111',
      adset_id: '222',
      campaign_id: '333',
    });

    expect(result.success).toBe(true);
    expect(result.data?.campaign_id).toBe('333');
  });
});

describe('metaWebhookVerifyQuerySchema', () => {
  it('acepta el handshake tal como lo manda Meta', () => {
    const result = metaWebhookVerifyQuerySchema.safeParse({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'un-token',
      'hub.challenge': '1234567890',
    });

    expect(result.success).toBe(true);
  });

  it('no falla si Meta añade un parámetro más', () => {
    // Si esto fallara, la verificación del endpoint sería imposible y con ella toda la ingesta.
    const result = metaWebhookVerifyQuerySchema.safeParse({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'un-token',
      'hub.challenge': '1234567890',
      'hub.extra': 'lo-que-sea',
    });

    expect(result.success).toBe(true);
  });

  it('exige los tres parámetros', () => {
    expect(metaWebhookVerifyQuerySchema.safeParse({ 'hub.mode': 'subscribe' }).success).toBe(false);
  });
});

describe('metaLeadGraphResponseSchema', () => {
  it('acepta una respuesta sin `field_data`, que es opcional', () => {
    expect(metaLeadGraphResponseSchema.safeParse({ id: 'abc123' }).success).toBe(true);
  });

  it('acepta `field_data` con valores que no son texto', () => {
    const result = metaLeadGraphResponseSchema.safeParse({
      id: 'abc123',
      field_data: [{ name: 'edad', values: [30] }],
    });

    expect(result.success).toBe(true);
  });

  it('acepta la respuesta SIN `custom_disclaimer_responses`', () => {
    // Es el caso importante: su ausencia es precisamente «no hay evidencia de consentimiento», y
    // el schema tiene que poder representarlo sin fallar. La duda se resuelve del lado seguro
    // (el lead se guarda con `granted:false` y el marketing queda bloqueado).
    const sinDisclaimer = metaLeadGraphResponseSchema.safeParse({ id: 'abc123', form_id: '999' });

    expect(sinDisclaimer.success).toBe(true);
    expect(sinDisclaimer.data?.custom_disclaimer_responses).toBeUndefined();
  });
});

describe('metaWebhookAcceptedSchema', () => {
  it('exige `received: true`, que es lo que documenta la aceptación', () => {
    expect(metaWebhookAcceptedSchema.safeParse({}).success).toBe(false);
    expect(metaWebhookAcceptedSchema.safeParse({ received: true }).success).toBe(true);
  });

  it('acepta la marca de duplicado, que NO es un error', () => {
    // Un duplicado se responde 200: devolver 409 haría que Meta reintentara para siempre.
    const result = metaWebhookAcceptedSchema.safeParse({ received: true, duplicate: true });

    expect(result.success).toBe(true);
  });

  it('no admite `duplicate: false` explícito, que sería ruido sin significado', () => {
    expect(metaWebhookAcceptedSchema.safeParse({ received: true, duplicate: false }).success).toBe(
      false,
    );
  });
});
