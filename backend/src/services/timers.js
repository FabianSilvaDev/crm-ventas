/**
 * Registro central de temporizadores de simulacion.
 *
 * La seccion 12 del prompt exige limpiar los temporizadores al pausar, reiniciar o
 * finalizar, y no dejar nada corriendo en segundo plano. Todos los timers pasan por
 * aqui para poder cancelarlos de forma individual o masiva (apagado del servidor,
 * pruebas automatizadas).
 *
 * Se marcan con `unref()` para que un temporizador olvidado nunca impida que el
 * proceso termine.
 */
const intervals = new Set();
const timeouts = new Set();

export const scheduleInterval = (callback, ms) => {
  const timer = setInterval(callback, ms);
  timer.unref?.();
  intervals.add(timer);
  return timer;
};

export const scheduleTimeout = (callback, ms) => {
  const timer = setTimeout(() => {
    timeouts.delete(timer);
    callback();
  }, ms);
  timer.unref?.();
  timeouts.add(timer);
  return timer;
};

export const clearTimer = (timer) => {
  if (!timer) return;
  clearInterval(timer);
  clearTimeout(timer);
  intervals.delete(timer);
  timeouts.delete(timer);
};

/** Cancela todos los temporizadores vivos (apagado ordenado y pruebas). */
export const clearAllTimers = () => {
  for (const timer of intervals) clearInterval(timer);
  for (const timer of timeouts) clearTimeout(timer);
  intervals.clear();
  timeouts.clear();
};

export const activeTimerCount = () => intervals.size + timeouts.size;
