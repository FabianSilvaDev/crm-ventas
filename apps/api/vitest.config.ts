import { defineConfig } from 'vitest/config';

/**
 * Configuración de las pruebas del API.
 *
 * Existe por una razón concreta y no negociable: Nest se apoya en **decoradores heredados**
 * (`experimentalDecorators`) y, sobre todo, en decoradores de **parámetro** —`@Body()`, `@Param()`,
 * los nuestros `@ZodBody()`/`@ZodQuery()`— que **no existen en el estándar TC39**. El transformador
 * por defecto de Vitest 5 (rolldown/oxc) parsea en modo estándar, así que cualquier test que importe
 * un controlador de Nest **no llega a parsearse**:
 *
 *     RolldownError: Parse failure: Decorators are not valid here.
 *
 * Lo llamativo es que un decorador de clase (`@Controller()`, `@Catch()`) sí pasa: en el estándar
 * los decoradores existen, y es solo el de parámetro el que no está contemplado. Por eso el fallo
 * aparece únicamente al probar controladores, y por eso conviene tenerlo resuelto antes de escribir
 * los tests del webhook en vez de descubrirlo a mitad.
 *
 * `oxc.decorator` es la opción real de rolldown (`legacy` + `emitDecoratorMetadata`); el `esbuild`
 * de toda la vida ya no interviene en esta versión de Vite y configurarlo aquí no haría nada. Se
 * replica lo que declara `tsconfig.base.json` para que el código que se prueba y el que se compila
 * se transformen igual: probar algo distinto de lo que se despliega es una forma silenciosa de
 * mentir.
 */
export default defineConfig({
  oxc: {
    decorator: {
      legacy: true,
      // Nest necesita los metadatos de diseño (`design:paramtypes`) para resolver la inyección de
      // dependencias. Sin esto, la app de prueba arrancaría con inyección rota.
      emitDecoratorMetadata: true,
    },
  },
  test: {
    environment: 'node',
  },
});
