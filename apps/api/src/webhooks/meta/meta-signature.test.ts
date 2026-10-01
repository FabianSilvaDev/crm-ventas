import { describe, expect, it } from 'vitest';

import { computeMetaSignature, verifyMetaSignature } from './meta-signature.js';

const SECRET = 'un-app-secret-de-meta-suficientemente-largo';

/** Cuerpo tal como llega: bytes, no un objeto. */
const RAW = Buffer.from(
  JSON.stringify({ object: 'page', entry: [{ id: '1', changes: [] }] }),
  'utf8',
);

function firmar(rawBody: Buffer, secret = SECRET): string {
  return computeMetaSignature(rawBody, secret);
}

describe('computeMetaSignature', () => {
  it('produce la cabecera con el prefijo que usa Meta', () => {
    expect(firmar(RAW)).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('es determinista y no depende del secreto en claro', () => {
    expect(firmar(RAW)).toBe(firmar(RAW));
    expect(firmar(RAW)).not.toContain(SECRET);
  });
});

describe('verifyMetaSignature', () => {
  it('acepta la firma correcta', () => {
    expect(verifyMetaSignature({ rawBody: RAW, signatureHeader: firmar(RAW), appSecret: SECRET })).toBe(
      true,
    );
  });

  it('rechaza la firma hecha con otro secreto', () => {
    // El caso del atacante que conoce el formato pero no el secreto.
    expect(
      verifyMetaSignature({
        rawBody: RAW,
        signatureHeader: firmar(RAW, 'otro-secreto-igual-de-largo'),
        appSecret: SECRET,
      }),
    ).toBe(false);
  });

  it('rechaza un cuerpo DISTINTO al firmado, aunque sea casi igual', () => {
    // El corazón del asunto: firmamos un cuerpo y verificamos otro. Con `JSON.stringify` sobre el
    // objeto ya parseado, un espacio de más o el orden de las claves cambian los bytes y la firma
    // deja de valer; aquí se comprueba que la verificación se ancla a los bytes, no a la forma.
    const otro = Buffer.from(
      JSON.stringify({ object: 'page', entry: [{ id: '1', changes: [] }] }, null, 2),
      'utf8',
    );

    expect(otro.equals(RAW)).toBe(false);
    expect(
      verifyMetaSignature({ rawBody: otro, signatureHeader: firmar(RAW), appSecret: SECRET }),
    ).toBe(false);
  });

  it('rechaza una firma sin el prefijo `sha256=`', () => {
    // Un hex desnudo no es el formato de Meta; aceptarlo sería admitir un esquema que nadie envía.
    const desnuda = firmar(RAW).slice('sha256='.length);

    expect(verifyMetaSignature({ rawBody: RAW, signatureHeader: desnuda, appSecret: SECRET })).toBe(
      false,
    );
  });

  it('rechaza una firma de longitud inesperada SIN lanzar', () => {
    // `timingSafeEqual` **lanza** si los buffers miden distinto. Si esa excepción escapara, el
    // filtro la convertiría en un 500 y Meta reintentaría para siempre un cuerpo que jamás podrá
    // verificar. Un rechazo limpio (401) es la respuesta correcta.
    expect(verifyMetaSignature({ rawBody: RAW, signatureHeader: 'sha256=abc', appSecret: SECRET })).toBe(
      false,
    );
    expect(
      verifyMetaSignature({ rawBody: RAW, signatureHeader: `sha256=${'f'.repeat(200)}`, appSecret: SECRET }),
    ).toBe(false);
  });

  it('rechaza cuando falta la cabecera o el cuerpo crudo', () => {
    expect(verifyMetaSignature({ rawBody: RAW, signatureHeader: undefined, appSecret: SECRET })).toBe(
      false,
    );
    expect(verifyMetaSignature({ rawBody: undefined, signatureHeader: firmar(RAW), appSecret: SECRET })).toBe(
      false,
    );
  });

  it('rechaza si el secreto de la app está vacío (fail-closed)', () => {
    // Un secreto vacío no es "sin verificación": es una firma que cualquiera puede calcular. Si
    // esto devolviera `true`, un despliegue sin `META_APP_SECRET` aceptaría cuerpos de cualquiera.
    expect(verifyMetaSignature({ rawBody: RAW, signatureHeader: firmar(RAW, ''), appSecret: '' })).toBe(
      false,
    );
  });

  it('acepta el hexadecimal en mayúsculas, que es la misma firma', () => {
    expect(
      verifyMetaSignature({
        rawBody: RAW,
        signatureHeader: firmar(RAW).toUpperCase().replace('SHA256=', 'sha256='),
        appSecret: SECRET,
      }),
    ).toBe(true);
  });
});
