import { phoneE164Schema } from '@crm/contracts';
import { describe, expect, it } from 'vitest';

import { buildWhatsAppLink } from './whatsapp-link';

describe('buildWhatsAppLink', () => {
  it('quita el `+` y deja solo dígitos en el número', () => {
    // wa.me no entiende `+` ni espacios: con ellos la URL abre WhatsApp en una pantalla vacía.
    expect(buildWhatsAppLink({ phoneE164: '+573001234567', message: 'Hola' })).toBe(
      'https://wa.me/573001234567?text=Hola',
    );
  });

  it('codifica acentos y saltos de línea del mensaje', () => {
    const enlace = buildWhatsAppLink({
      phoneE164: '+573001234567',
      message: 'Hola Ana,\n¿te llamo mañana?',
    });

    expect(enlace).toContain('%0A');
    expect(enlace).toContain('%C2%BF');
    // El texto sin codificar rompería la URL: si aparece tal cual, el enlace está mal.
    expect(enlace).not.toContain('\n');
    expect(enlace).not.toContain('¿');
  });

  it('devuelve `null` sin teléfono, en vez de un enlace que no lleva a ninguna parte', () => {
    expect(buildWhatsAppLink({ phoneE164: null, message: 'Hola' })).toBeNull();
  });

  it('devuelve `null` con un número que no es E.164', () => {
    // Todos estos "casi funcionan" en wa.me y apuntan a otra persona. Es el motivo de exigir E.164.
    for (const invalido of [
      '3001234567', // sin código de país
      '+03001234567', // con cero de relleno
      '+57 300 123 4567', // con espacios
      '+57-300-1234567', // con guiones
      '573001234567', // sin `+`
      '+573', // demasiado corto
      '', // vacío
    ]) {
      expect(buildWhatsAppLink({ phoneE164: invalido, message: 'Hola' }), invalido).toBeNull();
    }
  });

  it('acepta el teléfono más corto y el más largo que permite E.164', () => {
    expect(buildWhatsAppLink({ phoneE164: '+12345678', message: 'x' })).toContain('wa.me/12345678');
    expect(buildWhatsAppLink({ phoneE164: '+123456789012345', message: 'x' })).toContain(
      'wa.me/123456789012345',
    );
  });

  it('coincide con `phoneE164Schema` del contrato en todos los casos', () => {
    // Esta es la prueba que sustituye a importar Zod en el navegador: `whatsapp-link.ts` repite la
    // expresión regular para no arrastrar la librería al bundle, y aquí se comprueba que las dos
    // comprobaciones dicen **exactamente lo mismo**. Si el contrato se relaja o se endurece, esto
    // falla en el CI en vez de divergir en silencio.
    const casos = [
      '+573001234567',
      '+12345678',
      '+123456789012345',
      '3001234567',
      '+03001234567',
      '+57 300 123 4567',
      '+57-300-1234567',
      '573001234567',
      '+573',
      '+5730012345678901',
      '+1',
      '',
      '+',
      '+abc',
    ];

    for (const caso of casos) {
      const enlace = buildWhatsAppLink({ phoneE164: caso, message: 'x' });
      // `safeParse` acepta el número si y solo si `buildWhatsAppLink` produce un enlace.
      expect(enlace !== null, `discrepancia en «${caso}»`).toBe(phoneE164Schema.safeParse(caso).success);
    }
  });
});
