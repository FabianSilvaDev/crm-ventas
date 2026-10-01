import { describe, expect, it } from 'vitest';

import {
  firstResponseRequestSchema,
  leadChannelSchema,
  leadListQuerySchema,
  leadSourceSchema,
  leadStatusSchema,
  storedConsentTestimonySchema,
} from './leads.js';

describe('enums del modelo', () => {
  it('el estado acepta exactamente los seis valores de docs/database.md', () => {
    const validos = ['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST'];

    for (const valor of validos) {
      expect(leadStatusSchema.safeParse(valor).success).toBe(true);
    }
    expect(leadStatusSchema.safeParse('PENDIENTE').success).toBe(false);
  });

  it('el origen es el vocabulario de pago, no el de canal', () => {
    // Se confunden con facilidad: `source` dice si se pagó por él, `channel` por dónde entró.
    expect(leadSourceSchema.safeParse('paid').success).toBe(true);
    expect(leadSourceSchema.safeParse('META_LEAD_FORM').success).toBe(false);
    expect(leadChannelSchema.safeParse('META_LEAD_FORM').success).toBe(true);
  });
});

describe('leadListQuerySchema', () => {
  it('convierte el límite, que por HTTP llega siempre como texto', () => {
    const result = leadListQuerySchema.safeParse({ limit: '10' });

    expect(result.success).toBe(true);
    expect(result.data?.limit).toBe(10);
  });

  it('aplica el límite por defecto cuando no se pide ninguno', () => {
    expect(leadListQuerySchema.parse({}).limit).toBe(50);
  });

  it('rechaza un límite de cero y uno por encima del máximo', () => {
    expect(leadListQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(leadListQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('rechaza un parámetro desconocido en vez de ignorarlo', () => {
    // Es la regla de `docs/security.md` §11.3: un filtro que no existe puede ser un intento de
    // inyección o un cliente desactualizado, y en ambos casos queremos enterarnos.
    expect(leadListQuerySchema.safeParse({ limit: '10', ordenarPor: 'email' }).success).toBe(false);
  });

  it('rechaza un estado que no está en el enum', () => {
    expect(leadListQuerySchema.safeParse({ status: 'NUEVO' }).success).toBe(false);
  });
});

describe('storedConsentTestimonySchema', () => {
  it('acepta el caso de Meta sin evidencia de consentimiento', () => {
    // El caso que la Ley 1581 obliga a poder representar: no consta que la persona aceptara.
    // `granted:false` con `text:null` es un registro honesto de esa ausencia, no un testimonio.
    const result = storedConsentTestimonySchema.safeParse({
      granted: false,
      evidence: 'NO_DISCLAIMER_IN_FORM',
      text: null,
      granted_at: null,
      channel: 'META_LEAD_FORM',
      form_id: '1234567890',
      purposes: ['CONTACTO_COMERCIAL'],
      policy_version: 'borrador-2026-10-01',
      ip_hash: null,
      user_agent: null,
    });

    expect(result.success).toBe(true);
  });

  it('exige que un testimonio con texto se guarde en snake_case, como la columna', () => {
    // `grantedAt` en camelCase aquí sería un consentimiento que se guarda vacío sin dar error.
    const result = storedConsentTestimonySchema.safeParse({
      granted: true,
      evidence: 'META_CUSTOM_DISCLAIMER',
      text: 'Acepto ser contactado.',
      grantedAt: '2026-10-01T12:00:00Z',
      channel: 'META_LEAD_FORM',
      form_id: null,
      purposes: ['CONTACTO_COMERCIAL', 'MARKETING'],
      policy_version: 'borrador-2026-10-01',
      ip_hash: null,
      user_agent: null,
    });

    expect(result.success).toBe(false);
  });

  it('rechaza una evidencia que no está en el enum', () => {
    const result = storedConsentTestimonySchema.safeParse({
      granted: true,
      evidence: 'PORQUE_SI',
      text: 'x',
      granted_at: null,
      channel: 'META_LEAD_FORM',
      form_id: null,
      purposes: [],
      policy_version: 'v1',
      ip_hash: null,
      user_agent: null,
    });

    expect(result.success).toBe(false);
  });
});

describe('firstResponseRequestSchema', () => {
  it('acepta un cuerpo vacío: responder no obliga a cerrar', () => {
    expect(firstResponseRequestSchema.safeParse({}).success).toBe(true);
  });

  it('acepta la vía de cierre cuando se cierra a la vez', () => {
    expect(firstResponseRequestSchema.safeParse({ closedVia: 'WHATSAPP' }).success).toBe(true);
  });

  it('rechaza una vía de cierre inventada', () => {
    expect(firstResponseRequestSchema.safeParse({ closedVia: 'TELEPATIA' }).success).toBe(false);
  });
});
