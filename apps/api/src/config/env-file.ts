import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Carga el `.env` de la raíz del monorepo, si existe.
 *
 * ## Por qué esto existe
 *
 * Hasta ahora **nada leía `.env`** en este proyecto: `loadEnv()` mira `process.env` y punto. Daba
 * igual mientras todos los valores tenían un default razonable, pero los secretos de Meta
 * (`META_APP_SECRET`, `META_VERIFY_TOKEN`) son obligatorios y sin valor por defecto — y eso es
 * deliberado. Sin este cargador, el API no arrancaría en ninguna máquina que no exportase las
 * variables a mano, que es justo lo contrario de lo que el proyecto quiere ("la app no arranca con
 * configuración inválida" ≠ "la app no arranca hasta que adivines cómo").
 *
 * Se usa **`process.loadEnvFile` de Node** (`>=20.12`, sin dependencias) en vez de `dotenv`.
 *
 * ## Precedencia, comprobada
 *
 * El entorno real **gana** sobre el fichero. Verificado ejecutando: con `CRM_PROBE` definida en
 * `process.env` y otra vez en el fichero, `loadEnvFile` deja el valor del entorno. Es la precedencia
 * correcta para un despliegue, donde las variables las pone la plataforma y un `.env` olvidado en la
 * imagen no debe poder sobreescribirlas.
 *
 * ## Dónde busca, y por qué no depende del directorio de trabajo
 *
 * La ruta se resuelve **respecto a este archivo**, no a `process.cwd()`: el proceso puede lanzarse
 * desde otro directorio (lo hace un gestor de procesos), y el `.env` vive en la **raíz del
 * monorepo**, junto a `.env.example`.
 *
 * Son **cuatro** niveles, y esto costó un bug: `src/config/` y `dist/config/` están a la misma
 * profundidad (`apps/api/<src|dist>/config/`), así que una sola constante sirve para los dos. Con
 * `../../../` la ruta resolvía a `apps/.env` —un fichero que nadie crea— y el cargador no encontraba
 * nunca el que sí existe. El síntoma era el peor posible: la app arrancaba sin cargar nada y el
 * error que se veía hablaba de variables ausentes, no de una ruta equivocada.
 *
 * **No se llama desde `loadEnv`** a propósito: `loadEnv` es pura y los tests la invocan con entornos
 * construidos a mano. Si leyera el `.env` del desarrollador, las pruebas dependerían de la máquina y
 * de un fichero no versionado.
 *
 * Se exporta para el test que comprueba que sigue apuntando junto a `.env.example`: la ruta es un
 * literal y un refactor puede desviarla sin que nada más se entere.
 */
export const ENV_FILE_PATH = fileURLToPath(new URL('../../../../.env', import.meta.url));

/**
 * Devuelve la ruta del `.env` cargado, o `undefined` si no había fichero.
 *
 * Solo informa de la **ruta**: el contenido no se registra nunca (`docs/security.md` §10.4).
 */
export function loadEnvFileIfPresent(): string | undefined {
  if (!existsSync(ENV_FILE_PATH)) {
    return undefined;
  }

  // Si el fichero existe pero está mal formado, esto **debe** lanzar: es un error de configuración
  // y arrancar con el entorno a medias sería peor que no arrancar.
  process.loadEnvFile(ENV_FILE_PATH);

  return ENV_FILE_PATH;
}
