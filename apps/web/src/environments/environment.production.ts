/**
 * Entorno de **producción**. `angular.json` lo enlaza por `fileReplacements`, así que en el artefacto
 * que se despliega este fichero ocupa el lugar de `environment.ts` y el valor queda **compilado**,
 * no evaluado en tiempo de ejecución.
 *
 * `demoSession: false` es la mitad de la puerta de demostración. La otra mitad es `isDevMode()`, que
 * ya es falso en cualquier build optimizado. **Las dos cerradas**: cambiar solo una de las dos no
 * abre nada, y ese es el motivo de que sean dos.
 *
 * Si alguien tiene la tentación de poner `true` aquí «para probar en el entorno desplegado»: eso
 * convertiría una puerta que hoy no puede abrirse en una que sí, y el modo demostración entra en las
 * pantallas sin credencial alguna. Para probar, `ng serve`.
 */
export const environment = {
  demoSession: false,
} as const;
