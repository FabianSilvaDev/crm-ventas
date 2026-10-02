/**
 * URLs internas seguras.
 *
 * ## Por qué esto existe
 *
 * El guard manda al acceso con la pantalla pedida en la query: `/entrar?returnTo=/sistema`. Ese
 * parámetro lo escribe la aplicación, pero **lo puede escribir cualquiera**: basta con pegar un enlace
 * en la barra del navegador o recibirlo por WhatsApp. Sin validar, un login correcto terminaría
 * llevando a donde diga el enlace — con la marca del CRM delante durante todo el trayecto, que es
 * justo lo que hace peligroso un *open redirect*.
 *
 * ## Qué se acepta y qué no
 *
 * Solo rutas internas: empezar por `/` y no ser nada de lo que el navegador interpreta como otro
 * origen. Las tres comprobaciones son por motivos distintos y ninguna es decorativa:
 *
 * 1. **`//sitio` y `/\sitio` son URLs absolutas.** No son rutas que empiecen por barra: para el
 *    navegador, `//sitio` es «mismo esquema, otro host». Y `/\sitio` también, porque en los esquemas
 *    «especiales» (`http`, `https`) la barra invertida cuenta como separador — Chrome y Safari lo
 *    tratan igual que `//`.
 * 2. **Los caracteres de control se eliminan ANTES de resolver la URL.** Según la especificación de
 *    URLs, el analizador borra todos los tabuladores y saltos de línea de la entrada antes de
 *    interpretarla: `/` + salto de línea + `/sitio` acaba siendo `//sitio`. Quitar el salto de línea
 *    «para limpiarlo» sería justo lo que lo convertiría en peligroso; por eso se rechaza.
 * 3. **El `trim()` va antes de mirar nada**, para que un espacio al principio no cuele una ruta que
 *    luego se interpreta distinto.
 *
 * Vive en `core/` y no en el guard porque la usan dos sitios —el guard escribe el parámetro y el
 * acceso lo lee— y el día que se añada un «salir y volver aquí» será el tercero.
 */
export function destinoSeguro(valor: string | null): string | null {
  if (valor === null) {
    return null;
  }

  const texto = valor.trim();

  if (!texto.startsWith('/')) {
    return null;
  }

  if (texto.startsWith('//') || texto.startsWith('/\\')) {
    return null;
  }

  if (CARACTERES_DE_CONTROL.test(texto)) {
    return null;
  }

  return texto;
}

/** C0, DEL y todo lo que el analizador de URLs descarta o interpreta de forma sorprendente. */
const CARACTERES_DE_CONTROL = /[\u0000-\u001f\u007f]/;
