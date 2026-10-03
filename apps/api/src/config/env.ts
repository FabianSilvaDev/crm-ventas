import { z } from 'zod';

/**
 * Configuración de entorno, validada **al arrancar**.
 *
 * Principio: la app no arranca con configuración inválida. Un `PORT` mal escrito o un
 * `WEB_ORIGIN` que no es URL deben romper en el arranque, no en la primera petición de un usuario.
 */

export const NODE_ENVS = ['development', 'test', 'production'] as const;

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

export const envSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVS).default('development'),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  /** Nivel de log. `trace` y `debug` solo tienen sentido en desarrollo. */
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),

  /**
   * Origen exacto de `apps/web`.
   *
   * Es una URL única y explícita, no una lista con comodines: el refresh token viaja en una
   * cookie `__Host-` y `Access-Control-Allow-Credentials` **prohíbe** `*`. Un comodín aquí no
   * "abre CORS", rompe la autenticación.
   *
   * `protocol` no es decorativo: sin él, `z.url()` acepta `localhost:4200` — WHATWG lo interpreta
   * como el esquema `localhost:` con ruta `4200`, que es una URL válida y un origen inservible.
   */
  WEB_ORIGIN: z.url({ protocol: /^https?$/ }).default('http://localhost:4200'),

  /**
   * Aún **sin consumidor**: Prisma no está instalado en este hito. Se validan ya porque un typo
   * en una URL de conexión es el fallo de despliegue más común, y porque `.env.example` y
   * `docs/deployment.md` ya las nombran.
   *
   * Cuando Prisma y BullMQ entren (Hito 2), pasan a ser obligatorias: en ese momento la app no
   * puede funcionar sin ellas y dejarlas opcionales sería una mentira.
   *
   * Se validan como URL con esquema restringido, no como cadena no vacía: un `postgresql://`
   * mal formado es un fallo de despliegue que solo aparece en la primera consulta, cuando ya hay
   * un usuario esperando.
   */
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }).optional(),

  // ───────────────────────────────────────────────────────────────────────────
  // Meta Lead Ads
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * *App Secret* de la app de Meta. Firma y verifica los webhooks.
   *
   * **Obligatorio y sin valor por defecto**, a diferencia de `DATABASE_URL`: un secreto por defecto
   * es un secreto público. Y si falta, el endpoint no puede aceptar ni un solo lead — un CRM que
   * arranca "sano" mientras rechaza todos los leads es el peor fallo posible, así que es preferible
   * que no arranque.
   *
   * Los secretos de app de Meta son 32 hex; se exige 16 como suelo para no aceptar un
   * `META_APP_SECRET=corto` que parezca configurado.
   */
  META_APP_SECRET: z.string().min(16),

  /** Token que Meta devuelve en el handshake `GET /webhooks/meta`. Se compara en tiempo constante. */
  META_VERIFY_TOKEN: z.string().min(16),

  /** Token de la Graph API. Necesario **solo** en modo `live`; ver `META_GRAPH_MODE`. */
  META_ACCESS_TOKEN: z.string().min(16).optional(),

  /**
   * De dónde salen los datos del Graph API.
   *
   * Por defecto `fixture`, que es lo que permite desarrollar y probar **sin** credenciales de Meta:
   * con `live` y sin `META_ACCESS_TOKEN` la app no arrancaría en una máquina recién clonada.
   *
   * En **producción se prohíbe `fixture`** (ver la comprobación cruzada de abajo): que un despliegue
   * real sirva datos inventados y los presente como leads es exactamente el fallo que no podemos
   * permitirnos, y no basta con confiar en que nadie lo configure mal.
   */
  META_GRAPH_MODE: z.enum(['live', 'fixture']).default('fixture'),

  /** Versión de la Graph API. Fijada, nunca "la última": Meta rompe compatibilidad hacia atrás. */
  META_GRAPH_API_VERSION: z
    .string()
    .regex(/^v\d{1,2}\.\d$/, 'Debe tener la forma v21.0')
    .default('v21.0'),

  /** Tiempo máximo de una llamada a la Graph API. Una llamada colgada bloquea la ingesta entera. */
  META_GRAPH_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(3000),

  /** Límite de peticiones por IP y minuto en los endpoints públicos (los que llama Meta). */
  PUBLIC_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(10_000).default(120),

  /**
   * Versión de la política de tratamiento de datos que se graba en cada testimonio de
   * consentimiento, para poder acreditar **con qué texto** aceptó una persona.
   *
   * Sin consumidor todavía, igual que `DATABASE_URL` y por la misma razón: el testimonio se escribe
   * cuando exista la ingesta con base de datos. Se declara ya porque es un valor **legal**, y
   * inventarlo por defecto en el código sería peor que exigirlo cuando toque.
   */
  CONSENT_POLICY_VERSION: z.string().min(1).optional(),

  /** Organización por defecto del MVP (uso interno, despliegue único). Ver ADR-011. */
  DEFAULT_ORGANIZATION_ID: z.uuid().optional(),

  /**
   * Ruta de la base de datos JSON. Si no se configura, se usa `apps/api/db` relativo al directorio
   * de trabajo. En tests se apunta a un directorio temporal para no contaminar datos locales.
   */
  DB_PATH: z.string().min(1).optional(),

  /**
   * Token estático de desarrollo para proteger endpoints de negocio antes de que exista
   * autenticación real (`docs/api.md` §9.2 nota). Fail-closed: sin él las rutas devuelven 401.
   *
   * En producción **no se permite**: el arranque falla si está configurado, porque eso significaría
   * que el modo de autenticación no es el real (JWT + permisos).
   */
  DEV_API_TOKEN: z.string().min(16).optional(),
})
  // Reglas que **no** se pueden expresar campo a campo, porque dependen de dos valores a la vez.
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.META_GRAPH_MODE === 'fixture') {
      ctx.addIssue({
        code: 'custom',
        path: ['META_GRAPH_MODE'],
        message:
          'No se puede usar `fixture` con NODE_ENV=production: serviría datos inventados como si fueran leads reales.',
      });
    }

    if (env.META_GRAPH_MODE === 'live' && env.META_ACCESS_TOKEN === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['META_ACCESS_TOKEN'],
        message: 'Es obligatorio cuando META_GRAPH_MODE=live.',
      });
    }

    if (env.NODE_ENV === 'production' && env.DEV_API_TOKEN !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['DEV_API_TOKEN'],
        message:
          'No se puede usar DEV_API_TOKEN en producción: las rutas de negocio deben usar autenticación real.',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Lee y valida el entorno. Lanza si algo no cuadra, con **todos** los errores juntos: arreglar
 * cinco variables en cinco arranques es peor que arreglarlas en uno.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);

  if (parsed.success) {
    return parsed.data;
  }

  const detail = parsed.error.issues
    .map((issue) => `  - ${issue.path.map(String).join('.') || '(raíz)'}: ${issue.message}`)
    .join('\n');

  throw new Error(`Configuración de entorno inválida:\n${detail}`);
}
