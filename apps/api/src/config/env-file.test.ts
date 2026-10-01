import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ENV_FILE_PATH } from './env-file.js';

/**
 * Guarda contra un desvío de la ruta del `.env`.
 *
 * Existe por un bug real: la constante era `../../../.env` y resolvía a `apps/.env` —un fichero que
 * nadie crea— en vez de al `.env` de la raíz, junto a `.env.example`. El síntoma no apuntaba a la
 * ruta: la app arrancaba sin cargar nada y el error hablaba de variables ausentes.
 *
 * La prueba **no** comprueba que el `.env` exista (en CI no existe, y no debe existir: es un fichero
 * local no versionado). Comprueba la relación que sí es estable: el cargador busca el `.env` **en el
 * mismo directorio** que `.env.example`, que es donde la documentación dice que va. Si alguien mueve
 * el módulo o cambia el número de `../`, esto falla.
 */
describe('ENV_FILE_PATH', () => {
  it('apunta junto a `.env.example`, no dentro de `apps/`', () => {
    const directorio = dirname(ENV_FILE_PATH);

    expect(
      existsSync(join(directorio, '.env.example')),
      `no hay .env.example en «${directorio}»: la ruta del .env quedó desviada`,
    ).toBe(true);
  });

  it('se llama `.env`', () => {
    // Evita el caso de «la carpeta es correcta pero el nombre no», que pasaría el test anterior.
    expect(ENV_FILE_PATH.endsWith('.env')).toBe(true);
  });

  it('está fuera de `apps/api`, que es donde resolvía la ruta equivocada', () => {
    // `apps/api/<src|dist>/config/` con tres niveles daba `apps/.env`. Se afirma la propiedad, no el
    // literal: un `.env` por aplicación dentro de `apps/api` volvería a introducir el bug.
    expect(dirname(ENV_FILE_PATH)).not.toContain(join('apps', 'api'));
  });
});
