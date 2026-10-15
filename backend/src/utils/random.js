/**
 * Generador pseudoaleatorio determinista (mulberry32).
 * Se usa con semillas estables para que una misma consulta devuelva siempre los
 * mismos valores: la seccion 13 del prompt prohibe cifras distintas entre vistas.
 */
export function createRandom(seed = 1) {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    /** Float en [0, 1). */
    next,
    /** Entero en [min, max]. */
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    /** Float en [min, max] con `decimals` decimales. */
    float: (min, max, decimals = 2) => {
      const value = next() * (max - min) + min;
      return Number(value.toFixed(decimals));
    },
    pick: (items) => (items.length === 0 ? undefined : items[Math.floor(next() * items.length)]),
  };
}

/** Convierte cualquier cadena en una semilla entera estable. */
export function seedFrom(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
