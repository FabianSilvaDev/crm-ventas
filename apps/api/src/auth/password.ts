import { hash, verify } from '@node-rs/argon2';

/**
 * Hashing de passwords con argon2id.
 *
 * `docs/api.md` §3.7 exige argon2id y prohíbe bcrypt. Los parámetros se dejan en los valores por
 * defecto de la librería, que ya son conservadores; si algún día hay que ajustarlos, se hace aquí
 * y se documenta en un ADR.
 *
 * Esta capa aísla al resto del código del paquete concreto. Si alguna vez hay que cambiar de
 * `@node-rs/argon2` a otro proveedor, solo toca este archivo.
 */

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export async function verifyPassword(hashValue: string, plain: string): Promise<boolean> {
  return verify(hashValue, plain);
}
