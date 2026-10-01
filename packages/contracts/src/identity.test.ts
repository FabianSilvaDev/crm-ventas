import { describe, expect, it } from 'vitest';

import { identitySummarySchema, phoneE164Schema } from './identity.js';

describe('phoneE164Schema', () => {
  it('acepta un móvil colombiano normalizado', () => {
    expect(phoneE164Schema.safeParse('+573001234567').success).toBe(true);
  });

  it('rechaza el mismo número sin el prefijo +', () => {
    expect(phoneE164Schema.safeParse('573001234567').success).toBe(false);
  });

  it('rechaza el formato en que Meta lo entrega: con espacios y guiones', () => {
    // Este es el caso real. Meta devuelve el teléfono tal como lo escribió la persona, así que la
    // normalización es un paso obligatorio de la ingesta y no un detalle de estilo: el enlace
    // `wa.me` se construye con estos dígitos y un número sin normalizar apunta a otra persona.
    expect(phoneE164Schema.safeParse('+57 300 123-4567').success).toBe(false);
  });

  it('rechaza un número sin código de país', () => {
    expect(phoneE164Schema.safeParse('+0123456789').success).toBe(false);
  });

  it('rechaza una cadena demasiado corta para ser un teléfono', () => {
    expect(phoneE164Schema.safeParse('+5730').success).toBe(false);
  });

  it('no acepta una cadena vacía', () => {
    expect(phoneE164Schema.safeParse('').success).toBe(false);
  });
});

describe('identitySummarySchema', () => {
  it('acepta una identidad sin email ni teléfono', () => {
    // No es un caso teórico: una persona puede llegar con solo uno de los dos, y el modelo los
    // declara NULL precisamente para eso.
    const result = identitySummarySchema.safeParse({
      id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      email: null,
      phone: null,
    });

    expect(result.success).toBe(true);
  });

  it('rechaza un id que no es uuid', () => {
    expect(
      identitySummarySchema.safeParse({ id: 'no-soy-un-uuid', email: null, phone: null }).success,
    ).toBe(false);
  });
});
