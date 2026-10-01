import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { envSchema, loadEnv } from './env.js';

/**
 * Entorno mínimo válido: los secretos de Meta son **obligatorios**, así que un `loadEnv({})` a
 * secas ya no representa un arranque válido. Se parte de esto y cada test cambia lo que prueba.
 */
const BASE = {
  META_APP_SECRET: 'a'.repeat(32),
  META_VERIFY_TOKEN: 'b'.repeat(16),
} as const;

describe('loadEnv', () => {
  it('aplica los valores por defecto con un entorno mínimo válido', () => {
    const env = loadEnv(BASE);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.WEB_ORIGIN).toBe('http://localhost:4200');
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it('convierte PORT de string a número', () => {
    // Las variables de entorno son siempre strings; sin `coerce`, `PORT="8080"` no es un número.
    expect(loadEnv({ ...BASE, PORT: '8080' }).PORT).toBe(8080);
  });

  it('rechaza un PORT que no es un puerto', () => {
    expect(() => loadEnv({ ...BASE, PORT: 'ochenta' })).toThrow(/PORT/);
    expect(() => loadEnv({ ...BASE, PORT: '99999' })).toThrow(/Configuración de entorno inválida/);
  });

  it('rechaza un WEB_ORIGIN que no es URL', () => {
    // Importa porque CORS con credenciales necesita un origen exacto: un valor inválido aquí
    // deja la autenticación por cookie sin funcionar.
    expect(() => loadEnv({ ...BASE, WEB_ORIGIN: 'localhost:4200' })).toThrow(/WEB_ORIGIN/);
  });

  it('rechaza un NODE_ENV desconocido', () => {
    expect(() => loadEnv({ ...BASE, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('acumula TODOS los errores en un solo mensaje', () => {
    // Arreglar cinco variables en cinco arranques es peor que arreglarlas de una vez.
    let message = '';
    try {
      loadEnv({ PORT: 'x', NODE_ENV: 'staging', WEB_ORIGIN: 'no-es-url' });
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }

    expect(message).toMatch(/PORT/);
    expect(message).toMatch(/NODE_ENV/);
    expect(message).toMatch(/WEB_ORIGIN/);
    // Y los secretos de Meta, que faltan en ese entorno: se nombran en el MISMO mensaje.
    expect(message).toMatch(/META_APP_SECRET/);
    expect(message).toMatch(/META_VERIFY_TOKEN/);
  });

  it('acepta DATABASE_URL y REDIS_URL cuando están presentes', () => {
    const env = loadEnv({
      ...BASE,
      DATABASE_URL: 'postgresql://crm:secret@localhost:5432/crm',
      REDIS_URL: 'redis://localhost:6379',
    });

    expect(env.DATABASE_URL).toBe('postgresql://crm:secret@localhost:5432/crm');
    expect(env.REDIS_URL).toBe('redis://localhost:6379');
  });

  it('no filtra la contraseña de DATABASE_URL en el mensaje de error', () => {
    // Una cadena de conexión lleva usuario y contraseña. Volcarla en un mensaje de error que
    // acaba en un log de arranque (o en un issue) es una fuga de credenciales.
    // El valor es inválido por el espacio en el host, de modo que hay algo que citar en el error.
    let message = '';
    try {
      loadEnv({ ...BASE, DATABASE_URL: 'postgresql://crm:sup3r-s3cret@local host:5432/crm' });
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }

    expect(message).toMatch(/DATABASE_URL/);
    expect(message).not.toContain('sup3r-s3cret');
  });

  it('no filtra el valor de un secreto de Meta en el mensaje de error', () => {
    // El mensaje de un `min(16)` no incluye el valor, pero se comprueba: es el mismo tipo de
    // fuga que la de DATABASE_URL y la comprobación cuesta nada.
    let message = '';
    try {
      loadEnv({ META_APP_SECRET: 's3cr3t', META_VERIFY_TOKEN: 'b'.repeat(16) });
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }

    expect(message).toMatch(/META_APP_SECRET/);
    expect(message).not.toContain('s3cr3t');
  });
});

describe('loadEnv: reglas cruzadas de Meta', () => {
  it('exige META_APP_SECRET: sin él el endpoint no puede aceptar un solo lead', () => {
    // Un CRM que arranca "sano" mientras rechaza todos los webhooks es el peor fallo posible.
    // Preferimos que no arranque y lo diga.
    expect(() => loadEnv({ META_VERIFY_TOKEN: 'b'.repeat(16) })).toThrow(/META_APP_SECRET/);
  });

  it('rechaza un META_APP_SECRET demasiado corto', () => {
    expect(() => loadEnv({ META_APP_SECRET: 'corto' })).toThrow(/META_APP_SECRET/);
  });

  it('usa `fixture` por defecto, para poder desarrollar sin credenciales de Meta', () => {
    // Con `live` por defecto, una máquina recién clonada no arrancaría: exigiría un token que
    // todavía no existe. Los datos de mentira solo se usan fuera de producción (siguiente test).
    expect(loadEnv(BASE).META_GRAPH_MODE).toBe('fixture');
  });

  it('PROHÍBE `fixture` en producción', () => {
    // Servir datos inventados como si fueran leads reales es exactamente lo que no podemos
    // permitirnos, y no basta con confiar en que nadie lo configure mal.
    expect(() => loadEnv({ ...BASE, NODE_ENV: 'production', META_GRAPH_MODE: 'fixture' })).toThrow(
      /META_GRAPH_MODE/,
    );
  });

  it('en producción obliga a elegir `live` de forma explícita', () => {
    // Al no haber default de producción, el despliegue tiene que decir a las claras que va en
    // vivo. Si se olvida, el error lo nombra en vez de arrancar en modo equivocado.
    let message = '';
    try {
      loadEnv({ ...BASE, NODE_ENV: 'production' });
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }

    expect(message).toMatch(/META_GRAPH_MODE/);
  });

  it('exige META_ACCESS_TOKEN cuando el modo es `live`', () => {
    expect(() => loadEnv({ ...BASE, META_GRAPH_MODE: 'live' })).toThrow(/META_ACCESS_TOKEN/);
  });

  it('acepta `live` con token, y no lo exige en `fixture`', () => {
    expect(
      loadEnv({ ...BASE, META_GRAPH_MODE: 'live', META_ACCESS_TOKEN: 't'.repeat(32) })
        .META_ACCESS_TOKEN,
    ).toBe('t'.repeat(32));

    expect(loadEnv({ ...BASE, META_GRAPH_MODE: 'fixture' }).META_ACCESS_TOKEN).toBeUndefined();
  });

  it('rechaza una versión del Graph API con forma inventada', () => {
    expect(() => loadEnv({ ...BASE, META_GRAPH_API_VERSION: 'latest' })).toThrow(
      /META_GRAPH_API_VERSION/,
    );
    expect(loadEnv({ ...BASE, META_GRAPH_API_VERSION: 'v21.0' }).META_GRAPH_API_VERSION).toBe(
      'v21.0',
    );
  });
});

/**
 * El `.env.example` es la única guía de arranque que tiene alguien que clona el repositorio, y se
 * desincroniza **en silencio**: al añadir una variable obligatoria, la app deja de arrancar en una
 * máquina limpia y el error no aparece en ninguna prueba.
 *
 * Esta prueba se apoya en el propio schema en vez de en una lista escrita a mano —una lista a mano se
 * desincroniza igual— preguntando qué campos rechazan `undefined`.
 */
describe('.env.example y el schema no se desincronizan', () => {
  const RUTA = new URL('../../../../.env.example', import.meta.url);
  const bruto = readFileSync(RUTA, 'utf8');

  /** Solo las asignaciones sin comentar: `# PORT=…` documenta, no configura. */
  const documentadas = new Set(
    bruto
      .split('\n')
      .map((linea) => linea.trim())
      .filter((linea) => linea !== '' && !linea.startsWith('#'))
      .map((linea) => linea.split('=')[0]?.trim() ?? '')
      .filter((clave) => clave !== ''),
  );

  it('documenta toda variable obligatoria', () => {
    const obligatorias = Object.entries(envSchema.shape)
      .filter(([, campo]) => !campo.safeParse(undefined).success)
      .map(([clave]) => clave);

    // Si esta lista queda vacía, la prueba deja de comprobar nada: se afirma primero.
    expect(obligatorias.length).toBeGreaterThan(0);

    for (const clave of obligatorias) {
      expect(documentadas, `falta ${clave} en .env.example`).toContain(clave);
    }
  });

  it('no documenta ninguna variable que el schema no conozca', () => {
    // Un nombre mal escrito en `.env.example` (`META_APP_SECRE`) es peor que no documentarlo:
    // alguien lo copia, la app arranca con la variable que falta y el error no señala al culpable.
    const conocidas = new Set(Object.keys(envSchema.shape));
    const desconocidas = [...documentadas].filter((clave) => !conocidas.has(clave));

    expect(desconocidas).toEqual([]);
  });
});
