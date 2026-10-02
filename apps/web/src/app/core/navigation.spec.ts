import { describe, expect, it } from 'vitest';

import { destinoSeguro } from './navigation';

/**
 * Estas pruebas son la mitad de la defensa contra el *open redirect*: la otra mitad es que el guard
 * use esta función. Los casos raros están aquí porque son los que se olvidan y los que se explotan.
 */
describe('destinoSeguro', () => {
  it('deja pasar una ruta interna', () => {
    expect(destinoSeguro('/panel')).toBe('/panel');
    expect(destinoSeguro('/leads')).toBe('/leads');
  });

  it('conserva la query y el fragmento: volver a donde estabas incluye los filtros', () => {
    expect(destinoSeguro('/leads?estado=NEW&page=2')).toBe('/leads?estado=NEW&page=2');
    expect(destinoSeguro('/leads#tabla')).toBe('/leads#tabla');
  });

  it('rechaza una URL absoluta', () => {
    expect(destinoSeguro('https://sitio-malicioso.test')).toBeNull();
    expect(destinoSeguro('http://sitio-malicioso.test')).toBeNull();
    // Y también un esquema que no sea http: no hay ninguno que queramos aceptar aquí.
    expect(destinoSeguro('javascript:alert(1)')).toBeNull();
    expect(destinoSeguro('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('rechaza `//host`, que para el navegador NO es una ruta', () => {
    expect(destinoSeguro('//sitio-malicioso.test')).toBeNull();
  });

  it('rechaza `/\\host`, que Chrome y Safari tratan igual que `//host`', () => {
    // Para los esquemas http/https la barra invertida es un separador más, así que `/\sitio` es una
    // URL con otro host y no una ruta del CRM.
    expect(destinoSeguro('/\\sitio-malicioso.test')).toBeNull();
  });

  it('rechaza un salto de línea intercalado, que el navegador borra antes de resolver', () => {
    // La especificación de URLs elimina tabuladores y saltos de línea de la entrada antes de
    // interpretarla: esto es literalmente `//sitio-malicioso.test` disfrazado.
    expect(destinoSeguro('/\n/sitio-malicioso.test')).toBeNull();
    expect(destinoSeguro('/\t/sitio-malicioso.test')).toBeNull();
    expect(destinoSeguro('/\r/sitio-malicioso.test')).toBeNull();
  });

  it('recorta los espacios de fuera antes de decidir', () => {
    expect(destinoSeguro('  /panel  ')).toBe('/panel');
    // Y recortar no puede servir para colar lo que se rechaza.
    expect(destinoSeguro('  //sitio-malicioso.test  ')).toBeNull();
  });

  it('«no me lo han dicho» es `null`, no una cadena vacía', () => {
    expect(destinoSeguro(null)).toBeNull();
    expect(destinoSeguro('')).toBeNull();
    expect(destinoSeguro('   ')).toBeNull();
  });
});
