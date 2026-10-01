import { timingSafeEqual } from 'node:crypto';

/**
 * Compara dos cadenas en **tiempo constante**, para que el tiempo de respuesta no revele cuántos
 * caracteres del principio acertó quien está probando.
 *
 * La comparación carácter a carácter de toda la vida (`===`) **corta en la primera diferencia**: eso
 * convierte adivinar un token en un juego de "caliente o frío" que se resuelve en miles de intentos
 * en vez de en el espacio entero de claves.
 *
 * Se usa para el token del handshake de Meta y para la firma HMAC.
 *
 * ## Lo que esto NO protege
 *
 * Una diferencia de **longitud** se resuelve antes de comparar nada, así que la longitud del valor
 * esperado se filtra por el tiempo. Es inherente a `timingSafeEqual` (lanza si los buffers miden
 * distinto) y no es un problema aquí: la longitud de un token no es el secreto, y el número de
 * intentos necesarios sigue siendo astronómico.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
}
