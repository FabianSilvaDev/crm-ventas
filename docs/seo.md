# SEO — Arquitectura, Checklist Técnico y SEO Content Engine

> Documento de fase 6 (Hito 4 — La Comercialización).
> Estado: **especificación**. Coherente con `architecture-review.md` (§B.1, §C.1, §D, §I),
> `decisions.md` (ADR-002, ADR-004, ADR-005, ADR-008) y `database.md` (§6).
>
> Regla que gobierna todo este documento: **el SEO solo aplica a `apps/site`**. El SEO es una
> propiedad del sitio público, no de la plataforma entera. Cualquier ítem de esta especificación
> que se intente aplicar a `apps/web` es un error.

---

## 1. Arquitectura SEO

### 1.1 Por qué dos frontends y no uno con SSR condicional

El requisito de negocio es claro: el CRM interno **no debe indexarse** (contiene datos de leads,
márgenes, precios de costo y conversaciones) y el sitio público **sí debe ser indexable**
(landings, blog, páginas de producto). Son dos objetivos opuestos sobre la misma base de código.

La tentación —una sola app Angular con SSR activado solo en las rutas públicas— falla por una
razón concreta: el SSR se ejecuta en un servidor Node que comparte proceso, caché y variables de
entorno entre las dos audiencias. Un error de configuración en la ruta pública (una cookie mal
excluida del árbol de render, un `TransferState` que serializa estado de sesión, una caché de CDN
mal configurada) convierte el servidor público en un canal de fuga del CRM. No es un riesgo
teórico: es la clase de bug que "funciona en dev y falla en prod".

Separar las apps hace que ese error sea **estructuralmente imposible**: el proceso que sirve el
sitio público no tiene acceso a las rutas autenticadas, no conoce el token de sesión y no puede
renderizar una vista del CRM porque esa vista no está en su bundle. Ver ADR-002.

### 1.2 Tabla comparativa de las dos aplicaciones

| | `apps/web` (CRM) | `apps/site` (público) |
|---|---|---|
| Propósito | CRM, CMS, centro de agentes, analítica | Landings, blog, producto, páginas estáticas |
| Render | SPA puro en cliente. Sin SSR, sin prerender | **Prerender (SSG)** para landings/blog/estáticas; **SSR** para páginas con precio/stock en vivo |
| Motor de build | `ng build` (CSR) | `ng build` con `@angular/ssr` + `@angular/build:ssr` (prerender + server bundle) |
| `robots.txt` | `User-agent: * / Disallow: /` (propio, servido por su host) | `Allow: /` + `Disallow` de infraestructura y parámetros de tracking |
| `<meta name="robots">` | `noindex, nofollow` | `index, follow, max-image-preview:large` en contenido; `noindex, follow` en búsqueda/filtros |
| Header `X-Robots-Tag` | `noindex, nofollow` en todas las respuestas (defensa en profundidad; cubre assets no-HTML) | Solo en recursos que no deben indexarse como página |
| Auth | Detrás de login (JWT + refresh cookie). Sin acceso anónimo | Público. **No conoce sesión de usuario** |
| Datos | Estado de servidor autenticado vía `/api/v1` | Solo endpoints públicos: landing, blog, producto (precio/stock), categorías |
| CWV | No es objetivo (red interna, pocos usuarios) | **Objetivo con presupuesto verificado en CI** |
| Caché | Prácticamente ninguna (datos cambian por usuario) | CDN + `Cache-Control` público en prerender; SSR con `s-maxage` corto en producto |
| Indexación | Bloqueada por tres capas independientes | Habilitada y observada vía Search Console |
| Origen de datos de render | API autenticada | API pública (`/api/v1/public/*`) + manifest de prerender |

### 1.3 Qué se rompería con la alternativa "SSR en todo"

Si se hubiera elegido una sola app con SSR global, los fallos serían de tres tipos:

1. **Fuga de datos entre sesiones por caché.** El SSR de una vista autenticada produce HTML que
   depende de la cookie del usuario. Si esa respuesta se cachea (por CDN, por caché en memoria o
   por `TransferState` mal aislado), el siguiente visitante recibe el HTML del anterior. Es una
   fuga de datos personales, no un bug cosmético.
2. **Superficie de ataque ampliada.** Un proceso Node que renderiza vistas con datos de leads y
   de economía unitaria es un objetivo mucho más atractivo que un proceso que solo renderiza
   páginas públicas. SSR en el CRM significa exponer ese proceso en la misma red que el sitio.
3. **Coste operativo sin beneficio.** El CRM está en `robots.txt: Disallow` y detrás de login:
   Google no puede (ni debe) indexarlo. Mantener un servidor de render para él es coste puro:
   un contenedor más, memoria, un modo de fallo más y un modelo de caché que nadie necesita.

La separación no es una optimización: es lo que hace que el requisito de seguridad (el CRM no se
filtra) y el requisito de marketing (el sitio se indexa) dejen de competir entre sí.

### 1.4 Modelo mental: tres capas de exclusión del CRM

El CRM se bloquea en tres capas independientes, de forma que el fallo de una no expone nada:

```txt
Capa 1 — Red / auth    → el CRM está detrás de login; sin sesión, redirige a /login (no renderiza datos)
Capa 2 — Header        → X-Robots-Tag: noindex, nofollow en toda respuesta de apps/web
Capa 3 — HTML + robots → <meta name="robots" content="noindex, nofollow"> en index.html
                         y robots.txt propio con Disallow: /
```

En el sitio público, el bloqueo inverso se aplica solo a rutas que no aportan contenido:
búsqueda interna, filtros, resultados de ordenación con parámetros y páginas de cuenta/carrito.

### 1.5 Prerender vs SSR: el criterio de decisión

```txt
¿El HTML cambia por usuario?                          → NO indexable (no aplica a apps/site)
¿El contenido cambia con el tiempo (precio/stock)?    → SSG con revalidación por job
                                                        (la página se regenera cuando el producto cambia)
¿La página depende de datos en vivo en cada request?  → SSR
¿Es estática o cambia en publicación?                 → Prerender (SSG), generado en build
```

| Tipo de página | Modo | Motivo |
|---|---|---|
| Home | Prerender | Estática; cambia en publicación |
| Landings (`/lp/:slug`) | Prerender | Contenido publicado; sin datos por usuario |
| Blog (`/blog`, `/blog/:slug`) | Prerender | Contenido publicado |
| Categorías de contenido | Prerender | Contenido publicado |
| Nosotros, privacidad, términos, contacto | Prerender | Estáticas |
| Producto (`/producto/:slug`) | **SSR** | Precio y disponibilidad en vivo |
| Búsqueda (`/buscar`) | SSR + `noindex` | Resultados dependen del query |
| 404 | SSR (con `status = 404` real) | Debe responder 404, no 200 |

Un detalle que se confunde a menudo: una página de producto con precio en vivo **sí va en el
sitemap y sí es indexable**, pero se renderiza con SSR. Indexabilidad y modo de render son ejes
independientes. Lo que se evita con SSR en producto es prerenderizar un precio que quedará
obsoleto en el HTML cacheado.

---

## 2. Configuración Angular SSR real

### 2.1 Hidratación: `provideClientHydration()`

La hidratación es lo que permite que el HTML prerenderizado sea interactivo sin volver a
renderizar todo en cliente. Sin ella, Angular descarta el DOM del servidor y lo reconstruye:
el usuario ve un destello, el LCP se mide dos veces y el CLS se dispara.

`apps/site/src/app/app.config.ts` (configuración compartida navegador + servidor):

```ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
  withIncrementalHydration,
} from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      }),
    ),
    provideHttpClient(withFetch()),
    // La hidratación es no negociable en apps/site: es parte del presupuesto de CWV.
    provideClientHydration(withEventReplay(), withIncrementalHydration()),
  ],
};
```

`apps/site/src/app/app.config.server.ts`:

```ts
import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(withRoutes(serverRoutes))],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
```

Reglas de uso:

- **Nunca** `ngSkipHydration` en un componente de contenido público. Si un componente rompe la
  hidratación, se arregla, no se salta. El CI tiene un test que falla si aparece
  `ngSkipHydration` en una plantilla de `apps/site`.
- **Nunca** manipulación directa del DOM fuera del ciclo de Angular en componentes hidratados
  (por ejemplo, `document.querySelector` en el constructor). Se usa `afterNextRender()`.
- El HTML prerenderizado y el renderizado deben producir la misma estructura de DOM. Si un
  componente lee `window` o `Date.now()` sin guarda, la hidratación marca un mismatch. Para
  fechas relativas ("hace 3 días") se usa `afterNextRender()` o `@defer`.

### 2.2 `app.routes.server.ts`: prerender y SSR por ruta

```ts
import { RenderMode, ServerRoute } from '@angular/ssr';
import { readFileSync } from 'node:fs';

/**
 * Manifest de rutas a prerenderizar, generado por el job `seo.prerender.manifest`
 * (ver §2.3). Contiene SOLO contenido en estado PUBLISHED, más las rutas estáticas.
 * El build de apps/site lo descarga antes de compilar; si no existe, el build falla
 * en lugar de prerenderizar un sitio vacío.
 */
type PrerenderManifest = {
  generatedAt: string;
  routes: {
    landings: string[];
    blog: string[];
    categories: string[];
    static: string[];
  };
};

function manifest(): PrerenderManifest {
  return JSON.parse(readFileSync('prerender-manifest.json', 'utf8')) as PrerenderManifest;
}

export const serverRoutes: ServerRoute[] = [
  // --- Prerender (SSG): contenido publicado y páginas estáticas ---
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'blog', renderMode: RenderMode.Prerender },
  {
    path: 'blog/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      return manifest().routes.blog.map((slug) => ({ slug }));
    },
  },
  {
    path: 'categoria/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      return manifest().routes.categories.map((slug) => ({ slug }));
    },
  },
  {
    path: 'lp/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      return manifest().routes.landings.map((slug) => ({ slug }));
    },
  },
  { path: 'nosotros', renderMode: RenderMode.Prerender },
  { path: 'contacto', renderMode: RenderMode.Prerender },
  { path: 'privacidad', renderMode: RenderMode.Prerender },
  { path: 'terminos', renderMode: RenderMode.Prerender },

  // --- SSR: depende de datos en vivo o del request ---
  // Producto: precio y stock cambian sin publicación. Indexable, pero SSR.
  { path: 'producto/:slug', renderMode: RenderMode.Server },
  // Búsqueda: depende del query. SSR + noindex (ver §3.2).
  { path: 'buscar', renderMode: RenderMode.Server },

  // --- 404 real ---
  { path: '**', renderMode: RenderMode.Server },
];
```

Notas de implementación:

- `getPrerenderParams()` puede ser asíncrona; se usa para leer el manifest en disco. **No**
  consulta la base de datos directamente: eso acoplaría el build al estado de la DB y haría
  que un build de un PR reprodujera contenido no publicado.
- Las páginas de producto **no** se prerenderizan (precio en vivo) pero **sí** entran al
  sitemap (§4.2). Es deliberado.
- Si `manifest()` falla (archivo ausente o JSON inválido), el build falla con un error explícito.
  Un sitio prerenderizado sin contenido publicado es peor que un build rojo.

### 2.3 Generación del manifest de prerender desde el sitemap

El sitemap es la fuente de rutas publicadas. El manifest es el mismo dato en el formato que el
build consume. Ambos los produce el mismo job del worker, sobre la misma consulta, para que no
puedan divergir.

Job `seo.prerender.manifest` (cola `seo`, repetible cada 15 min y disparado por el evento
`ContentPublished`):

```ts
// apps/worker/src/jobs/seo/prerender-manifest.job.ts
import { writeFile } from 'node:fs/promises';
import type { PrismaService } from '@app/db';

type Manifest = {
  generatedAt: string;
  routes: { landings: string[]; blog: string[]; categories: string[]; static: string[] };
};

const STATIC_ROUTES = ['nosotros', 'contacto', 'privacidad', 'terminos'];

export async function buildPrerenderManifest(prisma: PrismaService): Promise<Manifest> {
  const published = await prisma.content.findMany({
    where: { status: 'PUBLISHED', publishedAt: { not: null }, deletedAt: null },
    select: { type: true, slug: true },
  });

  const byType = (type: string) =>
    published.filter((c) => c.type === type).map((c) => c.slug);

  return {
    generatedAt: new Date().toISOString(),
    routes: {
      landings: byType('LANDING'),
      blog: byType('BLOG_POST'),
      categories: await prisma.category.findMany({
        where: { contentCount: { gt: 0 } },
        select: { slug: true },
      }).then((rows) => rows.map((r) => r.slug)),
      static: STATIC_ROUTES,
    },
  };
}
```

El job escribe el manifest en el almacenamiento de artefactos (`StorageProvider`) y publica la
referencia en `outbox_events` (`PrerenderManifestUpdated`). El pipeline de despliegue de
`apps/site` lo descarga a la raíz del proyecto antes de `ng build`. Se versiona el manifest con
el commit del despliegue, de modo que un rollback recupera también las rutas de esa versión.

### 2.4 Cómo se evita contenido dependiente del usuario en prerender/caché

Este es el punto donde un sitio prerenderizado se convierte en un incidente de seguridad si se
hace mal. Las reglas son mecánicas, no convenciones:

1. **`apps/site` no tiene autenticación.** No existe interceptor de auth, no existe guard de
   sesión, no existe `AuthService`. El proceso de SSR no conoce cookies de sesión. Esto se
   verifica con una regla ESLint `no-restricted-imports` que prohíbe importar cualquier módulo
   de auth en `apps/site`.

2. **El prerender no recibe un request.** `getPrerenderParams()` corre en build, sin cookies ni
   headers. Si un componente intenta inyectar `REQUEST` o leer una cookie durante el prerender,
   el build falla de forma ruidosa — que es exactamente el comportamiento deseado.

3. **La personalización se renderiza solo en cliente.** Si una página pública necesita mostrar
   algo dependiente del visitante (por ejemplo, "visto recientemente"), se aísla:

   ```html
   @defer (on viewport) {
     <app-recently-viewed />
   } @placeholder {
     <div class="h-24" aria-hidden="true"></div>
   }
   ```

   El componente diferido se renderiza solo en navegador, nunca entra en el HTML prerenderizado
   ni en el `TransferState`.

4. **`TransferState` solo transporta datos públicos.** El interceptor que cachea respuestas para
   la hidratación se registra con un filtro explícito de endpoints públicos
   (`/api/v1/public/*`). Cualquier respuesta de otro prefijo lanza un error en desarrollo.

5. **Caché de CDN sin cookies.** Las respuestas prerenderizadas se sirven con
   `Cache-Control: public, max-age=0, s-maxage=86400, stale-while-revalidate=604800`. Nunca
   `Vary: Cookie` (no hay cookies). Las respuestas SSR de producto llevan `s-maxage=300`. La
   regla es: la clave de caché es la URL completa, y nada más.

6. **Test de CI que lo demuestra.** Se hace grep sobre el HTML prerenderizado (ver §12): el HTML
   no puede contener `access_token`, `refresh_token`, `Bearer`, `anonymous_id`, `set-cookie` ni
   el email del usuario.

7. **El `anonymous_id` del sitio público se genera en cliente** (localStorage/cookie de primera
   parte) y se envía a la API como cabecera en llamadas públicas de atribución. Nunca se escribe
   en el HTML renderizado en servidor. Esto evita que un HTML cacheado contenga el identificador
   de otro visitante.

### 2.5 `server.ts`: estáticos antes que el fallback de SPA

El error clásico es que `/robots.txt` y `/sitemap.xml` caigan al catch-all de la SPA y devuelvan
`index.html` con HTTP 200. El orden del middleware en el servidor Express de Angular es lo que
lo impide:

```ts
// apps/site/src/server.ts
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { redirectsMiddleware } from './server/redirects.middleware';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// 0. Redirecciones 301 (slug cambiado / consolidación). Se cargan en memoria al arrancar
//    y se refrescan cada 5 min desde el artefacto generado por el worker (ver §3.2).
app.use(redirectsMiddleware());

// 1. Estáticos PRIMERO. maxAge largo para assets; index:false para no resolver / a index.html
//    por accidente y redirect:false para no emitir redirecciones implícitas.
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
    setHeaders(res, path) {
      if (path.endsWith('robots.txt')) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    },
  }),
);

// 2. NOTA: /sitemap.xml NO se sirve desde este proceso. Lo genera el worker y lo sirve la API,
//    porque su contenido depende de la base de datos, no del build. nginx enruta
//    /sitemap*.xml y /robots.txt hacia apps/api (ver §3.1).

// 3. SSR. Solo después de los estáticos y de las redirecciones.
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] ?? 4000;
  app.listen(port, () => {
    console.log(`SSR site listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
```

```nginx
# infrastructure/compose/nginx.site.conf (fragmento)
server {
  listen 443 ssl http2;
  server_name ejemplo.com;

  # Infraestructura de indexación: servida por la API, nunca por el SSR.
  location = /robots.txt       { proxy_pass http://api:3000; }
  location ~ ^/sitemap.*\.xml$ { proxy_pass http://api:3000; }

  location / {
    proxy_pass http://site:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    # No se reenvían cookies al SSR del sitio: no las necesita.
  }
}
```

### 2.6 404 real (HTTP 404, no 200 con página de error)

Angular 19+ expone el token `RESPONSE_INIT` desde `@angular/core`. Escribir el estado en él hace
que el servidor devuelva el código correcto:

```ts
// apps/site/src/app/features/not-found/not-found.page.ts
import { Component, inject, RESPONSE_INIT } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="mx-auto max-w-xl py-24 text-center">
      <h1>Página no encontrada</h1>
      <p>La dirección que buscas no existe o cambió de sitio.</p>
      <a routerLink="/">Volver al inicio</a>
    </section>
  `,
})
export class NotFoundPage {
  constructor() {
    const init = inject(RESPONSE_INIT, { optional: true });
    if (init) {
      // Sin esta línea, Angular responde 200 y Google indexa la página de error.
      init.status = 404;
    }
  }
}
```

La ruta `{ path: '**', renderMode: RenderMode.Server }` apunta a este componente. El test de CI
(§12) hace `fetch` a una URL inexistente y exige `status === 404`.

Un matiz importante: la página 404 lleva `noindex` explícito además del 404. Si en algún momento
el estado se rompe, el `noindex` evita que la página de error entre al índice.

### 2.7 301 para URLs cambiadas

Un slug cambiado no puede quedarse sin redirección: la URL antigua se rompe y se pierde la
señal acumulada. El proyecto **no tiene todavía una tabla de redirecciones** en `database.md`;
se añade a la migración `006_content_seo`:

### `content_redirects` (propuesta de adición a `006_content_seo`)

| columna | tipo | notas |
|---|---|---|
| id / organization_id | uuid | |
| from_path | text | ruta normalizada: minúsculas, sin dominio, sin query, con slash inicial |
| to_content_id | uuid FK NULL → content | destino por contenido (preferido) |
| to_path | text NULL | destino literal si no es contenido (asset, externo) |
| status_code | int | `301` permanente; `410` para eliminado definitivamente |
| reason | text | `slug_change` / `consolidation` / `deletion` |
| hit_count | int | contador de uso, para detectar redirecciones muertas |
| created_at | timestamptz | |

Índice: `UNIQUE(organization_id, from_path)`.

Reglas:

- Cuando el servicio de contenido actualiza `content.slug`, escribe en la **misma transacción** la
  fila de `content_redirects` (`from_path` = ruta antigua, `to_content_id` = el propio contenido)
  y emite `ContentSlugChanged` al outbox.
- Un contenido `ARCHIVED` sin reemplazo genera un `410` (eliminado), no un `301` a la home.
  Un 301 a la home se interpreta como "el contenido se movió ahí", lo cual es falso y diluye la
  señal.
- El worker compila `content_redirects` en un artefacto `redirects.json` (`{ from: { to, code } }`)
  publicado en el `StorageProvider`.
- `redirectsMiddleware()` en `server.ts` carga ese mapa en memoria al arrancar y lo refresca
  cada 5 minutos. **No** consulta la API por request: sería un salto de red en el camino crítico
  de cada navegación antigua.
- Regla de auditoría: cada redirección encadenada (`from → a → b`) se resuelve a destino final en
  el job que genera el artefacto. Nunca se emite una cadena de 301 (Google la sigue, pero penaliza
  el presupuesto de rastreo y es señal de gestión descuidada).

```ts
// apps/site/src/server/redirects.middleware.ts
import type { RequestHandler } from 'express';
import { readFileSync } from 'node:fs';

type RedirectMap = Record<string, { to: string; code: 301 | 308 | 410 }>;

let map: RedirectMap = {};

function load(): void {
  try {
    map = JSON.parse(readFileSync('redirects.json', 'utf8')) as RedirectMap;
  } catch {
    map = {}; // Sin artefacto, no hay redirecciones. No rompe el sitio.
  }
}

export function redirectsMiddleware(): RequestHandler {
  if (process.env['NODE_ENV'] !== 'test') {
    load();
    setInterval(load, 5 * 60 * 1000).unref();
  }

  return (req, res, next) => {
    const path = req.path.replace(/\/+$/, '') || '/';
    const rule = map[path];
    if (!rule) return next();

    if (rule.code === 410) {
      return res.status(410).type('text/plain').send('Contenido eliminado permanentemente.');
    }
    return res.redirect(rule.code, rule.to);
  };
}
```

---

## 3. Checklist técnico completo

Cada ítem declara **qué se hace**, **cómo se implementa** (Angular en `apps/site`, NestJS en
`apps/api` + worker) y **cómo se verifica** (test en CI o verificación manual recurrente).

Convención de verificación:

- `CI` — automatizado en el pipeline (bloquea el merge si falla).
- `MANUAL` — revisión recurrente con herramienta externa (Search Console, Rich Results Test),
  con periodicidad indicada.

### 3.1 Rastreo

| # | Qué se hace | Cómo se implementa | Verificación |
|---|---|---|---|
| R1 | **`robots.txt` servido desde la raíz, no como fallback de SPA** | Controlador público `GET /robots.txt` en `apps/api` (módulo `seo`), con `Content-Type: text/plain; charset=utf-8`. nginx enruta `= /robots.txt` a la API antes del SSR. Devuelve texto, nunca HTML. | **CI**: `fetch('/robots.txt')` → status 200, `content-type` contiene `text/plain`, el cuerpo contiene `User-agent: *` y `Sitemap:`, y **no** contiene `<!doctype html>`. |
| R2 | **`sitemap.xml` generado por job, solo contenido publicado** | Job `seo.sitemap.rebuild` (cola `seo`, repetible cada hora + disparado por `ContentPublished`/`ContentUnpublished`) consulta `content WHERE status='PUBLISHED'` y `categories` con contenido, renderiza XML y lo publica como artefacto. `GET /sitemap.xml` en la API lo sirve con `Cache-Control: public, max-age=600`. | **CI**: el XML no contiene ningún slug en estado `DRAFT`/`IN_REVIEW`/`ARCHIVED`; incluye una landing publicada conocida (fixture). Validación XSD del sitemap. |
| R3 | **Sitemap index si > 50.000 URLs** | `SitemapService.render()`: si `entries.length > 50_000`, emite `<sitemapindex>` y el worker genera `sitemap-1.xml` … `sitemap-N.xml` de 45.000 URLs cada uno (margen bajo el límite). El índice se sirve en `/sitemap.xml`; los parciales en `/sitemap-{n}.xml`. | **CI** (test unitario con fixture de 50.001 entradas): el render devuelve `<sitemapindex>` con N `</sitemap>` hijos y ningún `urlset` en el índice. **MANUAL**: Search Console confirma "Sitemap index procesado" y el conteo por parcial. |
| R4 | **Rutas internas bloqueadas (`/api`, `/admin`, `/app`, `/health`, `/metrics`)** | En el `robots.txt` del sitio público; además, esas rutas no existen en el bundle de `apps/site` (son de la API y del CRM). `apps/web` tiene su propio `robots.txt` con `Disallow: /`. | **CI**: el cuerpo de `/robots.txt` incluye las cinco reglas `Disallow`. Test dedicado: `apps/web` responde `Disallow: /` y `X-Robots-Tag: noindex`. |
| R5 | **Sin cadenas de redirección; 301 permanente para URLs cambiadas** | Middleware `redirectsMiddleware()` en `server.ts` (§2.7) sobre el artefacto compilado por el worker. El job **resuelve cadenas** (`from → a → b` se colapsa en `from → b`) al compilar. | **CI**: (a) test que pide una URL con slug antiguo y exige `301` con `Location` correcto; (b) test unitario del compilador que verifica que ninguna entrada del mapa apunta a otra entrada del mapa. |
| R6 | **404 real (HTTP 404, no 200 con página de error)** | Componente `NotFoundPage` que escribe `RESPONSE_INIT.status = 404` (§2.6). Ruta `**` en `RenderMode.Server`. La página lleva además `noindex`. | **CI**: `fetch('/ruta-inexistente')` → `status === 404` y el HTML contiene `noindex`. Es el test que más regresiones evita: es trivial romperlo. |
| R7 | **Sin bloqueo de recursos necesarios para renderizar** | El `robots.txt` permite explícitamente `/assets/`, `*.css$`, `*.js$`, `*.woff2$`, `*.webp$`, `*.avif$`. Nunca se bloquea CSS/JS: Googlebot necesita rastrearlos para renderizar. | **MANUAL** (mensual): Search Console → "Rastreo de páginas" → "Recursos bloqueados por robots.txt" debe estar en 0 para el sitio público. |
| R8 | **`X-Robots-Tag` en assets no-HTML** | La API y el SSR añaden `X-Robots-Tag: noindex` a PDFs, JSON de API y cualquier recurso que no deba aparecer como resultado. Complementa el `<meta>` (que solo existe en HTML). | **CI**: `fetch('/api/v1/public/…json')` devuelve el header. **MANUAL**: revisión de headers en el CDN. |

**Verificación manual periódica del rastreo (mensual):** Search Console → "Estadísticas de
rastreo" (presupuesto consumido, códigos de respuesta), "Sitemaps" (estado y errores) y
"Herramienta de inspección de URL" sobre 3 URLs publicadas al azar.

### 3.2 Indexación

| # | Qué se hace | Cómo se implementa | Verificación |
|---|---|---|---|
| I1 | **Canonical autorreferencial en cada página indexable** | `SeoService.apply()` (§3.3) escribe `<link rel="canonical">` con la URL absoluta de la propia página, construida desde `PUBLIC_SITE_URL` + ruta. Nunca se canonicaliza a otra página salvo consolidación explícita (que se registra en `content.canonical_url`). | **CI**: para cada HTML prerenderizado, el `pathname` del canonical coincide con la ruta del archivo. Falla si hay canonical ausente, relativo o apuntando a otra ruta sin justificación. |
| I2 | **Canonical correcto en paginación (page 2 → sí misma, no a page 1)** | La página de listado (`/blog?page=N`) computa su canonical con el parámetro `page` cuando `N > 1`. La primera página canonicaliza a la URL sin parámetro. Ver §3.3. | **CI**: `fetch('/blog?page=2')` → el canonical contiene `page=2`. `fetch('/blog')` → canonical sin `page`. |
| I3 | **`<meta name="robots">` correcto por tipo de página** | `SeoService.apply({ robots })`. Por defecto `index, follow, max-image-preview:large, max-snippet:-1`. Búsqueda y filtros: `noindex, follow`. 404: `noindex, follow`. | **CI**: ninguna página prerenderizada de contenido contiene `noindex`; `/buscar` y los filtros sí lo contienen. |
| I4 | **`noindex` en búsqueda interna y filtros** | Rutas `/buscar` y vistas con parámetros de filtro/orden. **No se bloquean en `robots.txt`**: si se bloquearan, Google no podría leer el `noindex` y las indexaría igual. Se dejan rastreables con `noindex, follow`. Los parámetros de tracking (`utm_*`, `fbclid`, `gclid`) sí se bloquean en robots porque duplican URLs sin contenido distinto. | **CI**: `/buscar?q=x` y `/blog?filtro=y` contienen `<meta name="robots" content="noindex`. **MANUAL** (mensual): Search Console → Páginas → "Excluidas por etiqueta noindex" debe listar esas URLs y **no** listar contenido. |
| I5 | **`hreflang`** | **Postergado.** No se implementa hasta que exista un segundo idioma confirmado (`@angular/localize` en `apps/site`). Cuando aplique: `<link rel="alternate" hreflang="es-CO">` + `x-default`, autorreferencial incluido, y correspondencia recíproca obligatoria. | N/A por ahora. Al activarse: **CI** test de reciprocidad (si A apunta a B, B apunta a A) y **MANUAL** en Search Console. |
| I6 | **Consolidación con canonical + 301, nunca `noindex` sobre contenido que debe consolidarse** | Cuando `seo.detectCannibalization` decide consolidar (§7), el contenido perdedor se marca `ARCHIVED` y se crea una fila `content_redirects` con `301` al ganador. **No** se usa `noindex` para consolidar: `noindex` no transfiere señal; `301` sí. | **CI**: test que publica dos contenidos duplicados, dispara la consolidación y verifica que el perdedor devuelve `301` y que el sitemap ya no lo incluye. |

### 3.3 Metadata

`SeoService` es el único punto de escritura de metadata en `apps/site`:

```ts
// apps/site/src/app/core/seo/seo.service.ts
import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export type SeoInput = {
  title: string;
  description: string;
  canonicalPath: string;         // ruta relativa, sin dominio
  image?: string;                // URL absoluta
  robots?: string;
  type?: 'website' | 'article' | 'product';
  ogTitle?: string;              // sin sufijo de marca; si falta, se usa title
  publishedTime?: string;
  modifiedTime?: string;
};

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly doc = inject(DOCUMENT);
  private readonly titleSvc = inject(Title);
  private readonly meta = inject(Meta);
  private readonly baseUrl = inject(PUBLIC_SITE_URL); // provider de entorno

  apply(input: SeoInput): void {
    const canonical = new URL(input.canonicalPath, this.baseUrl).toString();
    const ogTitle = input.ogTitle ?? input.title;

    this.titleSvc.setTitle(input.title);
    this.meta.updateTag({ name: 'description', content: input.description });
    this.meta.updateTag({
      name: 'robots',
      content: input.robots ?? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    });
    this.upsertCanonical(canonical);

    this.meta.updateTag({ property: 'og:type', content: input.type ?? 'website' });
    this.meta.updateTag({ property: 'og:title', content: ogTitle });
    this.meta.updateTag({ property: 'og:description', content: input.description });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ property: 'og:site_name', content: 'Nombre Comercial' });
    this.meta.updateTag({ property: 'og:locale', content: 'es_CO' });

    if (input.image) {
      this.meta.updateTag({ property: 'og:image', content: input.image });
      this.meta.updateTag({ property: 'og:image:width', content: '1200' });
      this.meta.updateTag({ property: 'og:image:height', content: '630' });
      this.meta.updateTag({ name: 'twitter:image', content: input.image });
    }
    this.meta.updateTag({ name: 'twitter:card', content: input.image ? 'summary_large_image' : 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: ogTitle });
    this.meta.updateTag({ name: 'twitter:description', content: input.description });

    if (input.publishedTime) this.meta.updateTag({ property: 'article:published_time', content: input.publishedTime });
    if (input.modifiedTime) this.meta.updateTag({ property: 'article:modified_time', content: input.modifiedTime });
  }

  private upsertCanonical(href: string): void {
    let link = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }
}
```

| # | Qué se hace | Cómo se implementa | Verificación |
|---|---|---|---|
| M1 | **`<title>` único y descriptivo (no plantilla repetida)** | Cada página construye su título desde su propio contenido: `content.meta_title`. No se usa `"{title} \| Marca"` como plantilla automática para todo. La marca se añade **solo si el título generado no agota los 60 caracteres**. Unicidad verificada en el pipeline de contenido (§10) y en CI. | **CI**: cada HTML prerenderizado tiene `<title>` no vacío, ≤ 65 caracteres, y **ninguno se repite** entre páginas. |
| M2 | **Meta description única, revisada por humano en el MVP** | `content.meta_description` generado por IA y aprobado por humano antes de publicar. Longitud 50–160 caracteres. Unicidad exacta y semántica (§10.2). | **CI**: presente, longitud en rango, sin duplicados exactos. |
| M3 | **Open Graph completo** | `SeoService.apply()` escribe `og:type`, `og:title`, `og:description`, `og:image` (+ dimensiones y alt), `og:url`, `og:site_name`, `og:locale`. La imagen se genera a 1200×630 y se guarda en `content.og_image_url`. | **CI**: los seis tags presentes y no vacíos en cada página. |
| M4 | **Twitter/X card** | `twitter:card` (`summary_large_image` si hay imagen), `twitter:title`, `twitter:description`, `twitter:image`. | **CI**: tags presentes. |
| M5 | **JSON-LD: Organization, WebSite, BreadcrumbList** | Componente `<app-json-ld [data]>` que inyecta `<script type="application/ld+json">`. Organization y WebSite se emiten una vez en el layout; BreadcrumbList en cada página interna desde el `breadcrumb` calculado por el router. | **CI**: cada página contiene al menos Organization+WebSite; las páginas internas contienen BreadcrumbList con `position` consecutiva desde 1. |
| M6 | **JSON-LD: Product + Offer en productos** | Se construye desde `products` (`name`, `slug`, `description`, `sku`) y `product_costs`/`selling_price` (precio real, moneda real). **Nunca** `aggregateRating` si no hay reseñas propias verificadas. | **CI**: validación de estructura con `ajv` contra un schema mínimo; el `price` del JSON-LD coincide con el precio visible en el HTML. **MANUAL** (por release): Rich Results Test. |
| M7 | **JSON-LD: Article/BlogPosting** | Desde `content` (`title`, `excerpt`, `published_at`, `updated_at`, `og_image_url`) + autor/publisher. | **CI**: `@type` presente y `datePublished`/`dateModified` en ISO 8601. |
| M8 | **JSON-LD: FAQPage cuando corresponda** | Se emite solo en landings/blog con sección de preguntas real. Nota: desde agosto de 2023 Google **restringe los rich results de FAQ** a sitios de gobierno/salud; el marcado sigue siendo válido como structured data pero **no genera resultado enriquecido**. Por eso FAQPage es opcional, no un objetivo de marketing. | **CI**: se emite solo si hay ≥ 2 pares pregunta/respuesta visibles en la página. |
| M9 | **Sin `noindex` accidental ni `noindex` + `canonical` contradictorios** | Si una página lleva `noindex`, no se le emite canonical a otra URL que sí es indexable (la señal se contradice). La búsqueda lleva `noindex` y canonical a sí misma. | **CI**: ninguna página prerenderizada de contenido con `noindex`; ninguna página con `noindex` tiene canonical a otra ruta. |

### 3.4 Estructura y contenido

| # | Qué se hace | Cómo se implementa | Verificación |
|---|---|---|---|
| E1 | **HTML semántico** | Uso de `<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<aside>`, `<footer>`. El layout de `apps/site` impone un `<main>` único por página. | **CI**: cada página tiene exactamente un `<main>` y un `<header>`/`<footer>`. |
| E2 | **Jerarquía de headings: exactamente un `<h1>`, sin saltos** | El template de página emite el `<h1>`. El contenido de `body_html` **no puede** contener `<h1>`: el sanitizador lo elimina (§3.6 / §10.3). Los niveles del contenido empiezan en `<h2>`. | **CI**: exactamente un `<h1>` por página; la secuencia de headings no salta (h2→h4 sin h3). |
| E3 | **URLs limpias, en minúsculas, con guiones, estables** | `content.slug` se genera en minúsculas, sin tildes, sin caracteres especiales, con guiones (`normalize-slug`). Estructura: `/blog/{slug}`, `/producto/{slug}`, `/lp/{slug}`, `/categoria/{slug}`. Un cambio de slug dispara redirección 301 (§2.7). | **CI**: ningún slug contiene mayúsculas, espacios, guiones bajos, tildes ni `%`; test unitario del normalizador con casos límite (tildes, `ñ`, emojis). |
| E4 | **`alt` descriptivo en imágenes (sin keyword stuffing)** | El componente de imagen exige `alt` no vacío (o `alt=""` explícito si es decorativa). El sanitizador elimina `<img>` sin `alt`. La IA puede proponer el alt, pero se valida longitud (≤ 125 caracteres) y no repetición exacta de la keyword. | **CI**: ningún `<img>` sin atributo `alt`; test que falla si un `alt` es idéntico al `target_keyword` de la página (señal de stuffing). |
| E5 | **Internal linking: cada contenido nuevo enlaza y es enlazado** | El brief incluye `internal_links`; al publicar, se extraen los enlaces reales del `body_html` a `content_links`. Un contenido publicado sin enlaces entrantes entra en la lista de huérfanas (§8). | **CI**: test de integración que publica contenido y verifica que existe al menos una fila en `content_links` con `to_content_id` = ese contenido. **MANUAL**: revisión del informe de huérfanas. |
| E6 | **Contenido textual visible en el HTML (no solo en JS)** | Todo el contenido indexable se renderiza en servidor. Si una sección se carga en cliente, se verifica que el texto principal (título, primer párrafo, datos clave) esté en el HTML prerenderizado. | **CI**: el HTML prerenderizado contiene el `excerpt` y el primer `<h2>` del contenido. |

### 3.5 Rendimiento

| # | Qué se hace | Cómo se implementa | Verificación |
|---|---|---|---|
| P1 | **Presupuesto de Core Web Vitals** | LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 (campo, p75 móvil). En laboratorio: LCP ≤ 2,0 s, TBT ≤ 200 ms, CLS ≤ 0,05 como puertas de CI. Detalle en §5. | **CI**: Lighthouse CI con `assert` que falla el build si supera el presupuesto (§5.3). |
| P2 | **Imágenes optimizadas con dimensiones explícitas** | `NgOptimizedImage` (`ngSrc`, `width`, `height`, `priority` en la imagen LCP, `ngSrcset` + `sizes`). Formatos AVIF/WebP. Ninguna imagen sin dimensiones (evita CLS). | **CI**: regla ESLint que prohíbe `<img src>` en lugar de `ngSrc` en `apps/site`; Lighthouse valida "Image elements have explicit width and height". |
| P3 | **Fuentes autohospedadas, sin FOUT con layout shift** | Fuentes `.woff2` autohospedadas (sin Google Fonts externo), `<link rel="preload" as="font" crossorigin>` de la fuente crítica, `font-display: swap` + `size-adjust`/`ascent-override` para que la fuente de respaldo ocupe lo mismo. | **CI**: Lighthouse valida "Ensure text remains visible during webfont load"; test que verifica que no hay peticiones a dominios de fuentes externas en el HTML. |
| P4 | **CSS crítico; JS diferido** | El SSR inlinea el CSS crítico por defecto (`inlineCritical`). El JS no crítico (analítica, widgets) se carga con `@defer` o `<script defer>`. Sin `@import` en CSS. | **CI**: Lighthouse "Eliminate render-blocking resources" en verde; presupuesto de peso total. |
| P5 | **Caché de CDN para estáticos** | Assets con hash de contenido e `immutable`; HTML prerenderizado con `s-maxage=86400, stale-while-revalidate`; SSR de producto con `s-maxage=300`. | **MANUAL** (por release): `curl -I` sobre una URL prerenderizada y un asset; verificar `Cache-Control` y `Age`. |
| P6 | **Presupuesto de JS inicial** | ≤ 170 KB gzip de JS inicial en páginas de contenido. Lazy loading por ruta (`loadChildren`). Se vigila especialmente que la librería de analítica no entre en el bundle inicial. | **CI**: el build falla si `dist/apps/site/browser/**/*.js` inicial excede el presupuesto (script `tools/seo-check/bundle-budget.mjs`). |

### 3.6 Sanitización (transversal a Metadata y Estructura)

La sanitización **no es una preocupación de SEO**, pero determina lo que se puede afirmar en E2
y E4: el HTML de IA se limpia en el servidor **al guardar**, no al renderizar (amenaza S2).

```ts
// apps/api/src/modules/content/html-sanitizer.ts
import sanitizeHtml from 'sanitize-html';

/**
 * Allowlist de HTML generado por IA. Se aplica en cada escritura a content.body_html:
 * creación, edición y publicación. Nunca se confía en el HTML almacenado.
 *
 * Ausencias deliberadas:
 *  - h1      → el <h1> lo posee el template de página; el contenido empieza en h2 (E2).
 *  - script/style/iframe/object → superficie de XSS.
 *  - atributos on* → nunca en allowedAttributes, por lo que se eliminan.
 *  - esquemas javascript: y data: → solo https.
 */
const ALLOWED: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'img',
    'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'figure', 'figcaption', 'br', 'hr', 'code', 'pre',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'rel', 'target'],
    img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'],
    th: ['scope'],
    td: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['https'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  disallowedTagsMode: 'discard',
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: '_blank',
        rel: attribs['rel']?.includes('nofollow')
          ? 'noopener noreferrer nofollow'
          : 'noopener noreferrer',
      },
    }),
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: 'lazy', decoding: 'async' },
    }),
  },
};

export function sanitizeContentHtml(raw: string): string {
  return sanitizeHtml(raw, ALLOWED);
}
```

Verificación: **CI** con un test que guarda `body_html` conteniendo `<script>`, `<img onerror>`,
`<a href="javascript:…">`, `<h1>` y `<iframe>`, y comprueba que ninguno sobrevive; y que un `<a>`
externo recibe `rel="noopener noreferrer"`. La sanitización se ejecuta en el servicio de
contenido, no en el controlador, para que ninguna ruta de escritura la omita.

### 3.7 Integraciones

| # | Qué se hace | Cómo se implementa | Verificación |
|---|---|---|---|
| N1 | **Search Console verificado (propiedad de dominio)** | Propiedad de dominio (`ejemplo.com`) verificada por registro DNS TXT. Cubre todos los subdominios y protocolos, que es lo que evita perder datos si cambia `www` o `http→https`. | **MANUAL** (una vez + por cambio de DNS): Search Console muestra "Propiedad verificada". |
| N2 | **API de Search Console conectada** | OAuth 2.0 con scope `webmasters.readonly`; refresh token custodiado como secreto (nunca en base de datos ni en el contexto del modelo). Jobs `seo.gsc.sync-analytics`, `seo.gsc.inspect-urls`, `seo.gsc.sitemaps`. Ver §9. | **CI**: test del cliente GSC contra un mock; el job de sync escribe filas en `seo_index_status`. **MANUAL**: el panel SEO muestra datos reales. |
| N3 | **Sitemap enviado y verificado** | El sitemap se declara en `robots.txt` (`Sitemap:`) y se envía por la API de Sitemaps. | **MANUAL** (semanal al inicio): Search Console → Sitemaps → estado "Correcto", 0 errores, `lastDownloaded` < 72 h. |
| N4 | **Sin dependencia de Google Trends** | ADR-004: no hay API oficial de Trends. El sistema **no** produce `trend_index` salvo que se contrate un proveedor de datos; en su defecto, el campo queda con `provenance = ESTIMATED` e `INSUFFICIENT_DATA` cuando no hay fuente. Ver §11. | **CI**: test que falla si algún pipeline escribe `keywords.search_volume` sin `provenance` o `source`. |
| N5 | **`noindex` en el CRM reforzado por header** | `apps/web` responde con `X-Robots-Tag: noindex, nofollow` y su propio `robots.txt` con `Disallow: /`. | **CI**: test de contrato sobre el host del CRM. |

---

## 4. Ejemplos reales y completos

Dominio de ejemplo usado en todo el documento: `https://ejemplo.com`. Marca: "Nombre Comercial".
Locale: `es-CO`. Moneda: `COP`.

### 4.1 `robots.txt` completo (sitio público)

Servido por `GET /robots.txt` de `apps/api` (§3.1, R1). Contenido literal:

```txt
# robots.txt — https://ejemplo.com
# Sitio público. Única superficie indexable del sistema.

User-agent: *
Allow: /

# --- Infraestructura: nunca debe entrar al índice ---
Disallow: /api/
Disallow: /admin/
Disallow: /app/
Disallow: /health/
Disallow: /metrics

# --- Parámetros de tracking: duplican la URL canónica ---
Disallow: /*?utm_
Disallow: /*?fbclid=
Disallow: /*?gclid=
Disallow: /*?ttclid=

# --- Búsqueda interna y filtros ---
# NO se bloquean aquí a propósito: llevan <meta name="robots" content="noindex, follow">
# y bloquearlos impediría que Google leyera el noindex (y podría indexarlas igual).
# Solo se bloquea el parámetro de ordenación, que no cambia el contenido:
Disallow: /*?orden=
Disallow: /*?sort=

# --- Recursos necesarios para renderizar: permitidos explícitamente ---
Allow: /assets/
Allow: /*.css$
Allow: /*.js$
Allow: /*.woff2$
Allow: /*.webp$
Allow: /*.avif$

Sitemap: https://ejemplo.com/sitemap.xml
```

Notas de por qué cada decisión:

- Las reglas `Allow` de recursos van **después** de los `Disallow` generales; Google aplica la
  regla más específica, pero el orden visual deja claro que el bloqueo de `/*?utm_` no debe
  alcanzar a un CSS.
- `Disallow: /*?orden=` no impide seguir los enlaces de paginación (`?page=2`), que **sí** se
  indexan con canonical propio (I2).
- No se incluye la directiva `Host:` (era de Yandex y ya no aporta).
- Si en el futuro se añade un `sitemap` indexado por secciones, se declaran varias líneas
  `Sitemap:`.

### 4.2 Fragmento real de `sitemap.xml` (2 URLs)

Generado por el job `seo.sitemap.rebuild` (§3.1, R2). `Content-Type:
application/xml; charset=utf-8`.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://ejemplo.com/</loc>
    <lastmod>2026-09-28T14:03:11+00:00</lastmod>
  </url>
  <url>
    <loc>https://ejemplo.com/blog/audifonos-bluetooth-guia-compra</loc>
    <lastmod>2026-09-30T09:12:00+00:00</lastmod>
    <image:image>
      <image:loc>https://ejemplo.com/assets/blog/audifonos-tws-hero.webp</image:loc>
      <image:title>Guía de compra de audífonos Bluetooth TWS</image:title>
      <image:caption>Audífonos Bluetooth TWS sobre fondo claro</image:caption>
    </image:image>
  </url>
</urlset>
```

Reglas de generación que se reflejan en el fragmento:

- Solo entran filas de `content` con `status = 'PUBLISHED'` y `published_at IS NOT NULL`.
- `lastmod` es `content.updated_at` (no la fecha del job). Una fecha de job hace que Google
  ignore `lastmod` por poco fiable.
- **No se emiten** `<changefreq>` ni `<priority>`: Google los ignora desde 2023 y un valor
  incorrecto no aporta nada. Menos campos, menos ruido.
- Las URLs son absolutas, con el dominio de `PUBLIC_SITE_URL`, sin parámetros ni fragmentos.
- Las páginas de producto **sí** aparecen aunque se rendericen con SSR: entran por
  `canonical_url` o por la ruta `/producto/{slug}`.
- Si hubiera más de 50.000 URLs, este archivo sería `sitemap-1.xml` y `/sitemap.xml` sería un
  `<sitemapindex>` (R3).

### 4.3 JSON-LD completo

Se inyectan con `<app-json-ld [data]>`, que serializa con `JSON.stringify` y escapa `<` como
`<` para que el contenido no pueda cerrar el `<script>`.

#### 4.3.1 Organization (una vez, en el layout)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://ejemplo.com/#organization",
  "name": "Nombre Comercial",
  "url": "https://ejemplo.com/",
  "description": "Comercio y contenido especializado en audio personal.",
  "logo": {
    "@type": "ImageObject",
    "@id": "https://ejemplo.com/#logo",
    "url": "https://ejemplo.com/assets/brand/logo-512.png",
    "width": 512,
    "height": 512,
    "caption": "Nombre Comercial"
  },
  "image": { "@id": "https://ejemplo.com/#logo" },
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Calle 12 #34-56, Oficina 201",
    "addressLocality": "Bogotá",
    "addressRegion": "Cundinamarca",
    "postalCode": "110221",
    "addressCountry": "CO"
  },
  "contactPoint": [
    {
      "@type": "ContactPoint",
      "telephone": "+57-601-0000000",
      "contactType": "customer service",
      "areaServed": "CO",
      "availableLanguage": ["es"]
    }
  ],
  "sameAs": [
    "https://www.instagram.com/nombrecomercial",
    "https://www.facebook.com/nombrecomercial"
  ]
}
```

#### 4.3.2 WebSite (una vez, en el layout)

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://ejemplo.com/#website",
  "url": "https://ejemplo.com/",
  "name": "Nombre Comercial",
  "inLanguage": "es-CO",
  "publisher": { "@id": "https://ejemplo.com/#organization" }
}
```

Nota: no se incluye `potentialAction` con `SearchAction`. Google **retiró el rich result de
sitelinks search box** (2024); mantener el marcado solo añade payload sin beneficio. Si algún día
se quiere, se reintroduce sin coste.

#### 4.3.3 BreadcrumbList (en cada página interna)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Inicio",
      "item": "https://ejemplo.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Blog",
      "item": "https://ejemplo.com/blog"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Guía de compra de audífonos Bluetooth"
    }
  ]
}
```

El último `ListItem` **no lleva `item`**: es la página actual y Google no lo espera. Las
`position` son consecutivas desde 1, sin saltos. El breadcrumb visible en la página coincide
exactamente con el del JSON-LD (un desajuste es un error común que invalida el marcado).

#### 4.3.4 Product + Offer (página de producto)

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "@id": "https://ejemplo.com/producto/audifonos-tws-pro#product",
  "name": "Audífonos Bluetooth TWS Pro",
  "description": "Audífonos inalámbricos TWS con cancelación activa de ruido, 32 h de batería con estuche y Bluetooth 5.3.",
  "sku": "TWS-PRO-001",
  "gtin13": "7701234567890",
  "brand": { "@type": "Brand", "name": "Nombre Comercial" },
  "image": [
    "https://ejemplo.com/assets/productos/audifonos-tws-pro-1.webp",
    "https://ejemplo.com/assets/productos/audifonos-tws-pro-2.webp"
  ],
  "offers": {
    "@type": "Offer",
    "url": "https://ejemplo.com/producto/audifonos-tws-pro",
    "priceCurrency": "COP",
    "price": "149900",
    "priceValidUntil": "2026-12-31",
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition",
    "seller": { "@id": "https://ejemplo.com/#organization" },
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingRate": {
        "@type": "MonetaryAmount",
        "value": "0",
        "currency": "COP"
      },
      "shippingDestination": {
        "@type": "DefinedRegion",
        "addressCountry": "CO"
      }
    },
    "hasMerchantReturnPolicy": {
      "@type": "MerchantReturnPolicy",
      "applicableCountry": "CO",
      "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
      "merchantReturnDays": 30
    }
  }
}
```

Reglas duras de este bloque:

- `price` **coincide exactamente** con el precio visible en el HTML. Un desajuste produce una
  acción manual en Search Console.
- `aggregateRating` **no se emite** en el ejemplo porque no hay reseñas propias verificadas.
  Inventarlo es la infracción de structured data más frecuente y la más penalizada.
- `availability` se mapea desde el stock real: `InStock` / `OutOfStock` / `PreOrder`.
  No se emite `Offer` si el producto no tiene precio (mejor un `Product` sin `offers` que un
  `Offer` con un precio inventado).
- `priceValidUntil` solo se emite si existe una promoción con fecha de fin real.

#### 4.3.5 Article / BlogPosting (entrada de blog)

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "@id": "https://ejemplo.com/blog/audifonos-bluetooth-guia-compra#article",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://ejemplo.com/blog/audifonos-bluetooth-guia-compra"
  },
  "headline": "Guía de compra de audífonos Bluetooth en 2026",
  "description": "Cómo elegir audífonos Bluetooth en 2026: batería, códecs, ANC y precio real en Colombia, con datos de 240 listings.",
  "image": [
    "https://ejemplo.com/assets/blog/audifonos-tws-hero.webp"
  ],
  "datePublished": "2026-09-30T09:12:00-05:00",
  "dateModified": "2026-10-01T11:40:00-05:00",
  "inLanguage": "es-CO",
  "author": {
    "@type": "Person",
    "name": "Nombre del Autor",
    "url": "https://ejemplo.com/autor/nombre-del-autor"
  },
  "publisher": { "@id": "https://ejemplo.com/#organization" }
}
```

`datePublished` es `content.published_at`; `dateModified` es `content.updated_at`. Si se actualiza
el artículo, `dateModified` cambia y el `<lastmod>` del sitemap también: es la señal de frescura
que sí se usa.

#### 4.3.6 FAQPage (opcional, solo si hay preguntas reales)

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "¿Cuánto dura la batería de unos audífonos TWS?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Entre 4 y 8 horas de uso continuo, más 20 a 30 horas adicionales con el estuche de carga. La capacidad del estuche es lo que marca la diferencia práctica."
      }
    },
    {
      "@type": "Question",
      "name": "¿Sirven los audífonos TWS para hacer deporte?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Sí, si tienen certificación IPX4 o superior. Para sudor intenso conviene IPX5 o IPX6. Los modelos sin certificación se dañan con la humedad en pocas semanas."
      }
    }
  ]
}
```

Recordatorio: Google restringió los rich results de FAQ a sitios de gobierno y salud (agosto de
2023). El marcado sigue siendo válido y puede aportar contexto semántico, pero **no** prometer
resultado enriquecido. Se emite solo cuando las preguntas y respuestas son visibles en la página.

### 4.4 `<head>` completo de ejemplo

HTML real de la página `/blog/audifonos-bluetooth-guia-compra`. Este es el bloque que el CI
inspecciona (§12).

```html
<!doctype html>
<html lang="es-CO">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <title>Guía de compra de audífonos Bluetooth en 2026</title>
  <meta name="description" content="Cómo elegir audífonos Bluetooth en 2026: batería, códecs, ANC y precio real en Colombia, con datos de 240 listings analizados.">

  <link rel="canonical" href="https://ejemplo.com/blog/audifonos-bluetooth-guia-compra">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">

  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Nombre Comercial">
  <meta property="og:locale" content="es_CO">
  <meta property="og:title" content="Guía de compra de audífonos Bluetooth en 2026">
  <meta property="og:description" content="Cómo elegir audífonos Bluetooth en 2026: batería, códecs, ANC y precio real en Colombia.">
  <meta property="og:url" content="https://ejemplo.com/blog/audifonos-bluetooth-guia-compra">
  <meta property="og:image" content="https://ejemplo.com/assets/blog/audifonos-tws-hero.webp">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Audífonos Bluetooth TWS sobre fondo claro">

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Guía de compra de audífonos Bluetooth en 2026">
  <meta name="twitter:description" content="Batería, códecs, ANC y precio real en Colombia, con 240 listings analizados.">
  <meta name="twitter:image" content="https://ejemplo.com/assets/blog/audifonos-tws-hero.webp">

  <!-- Fechas del artículo -->
  <meta property="article:published_time" content="2026-09-30T09:12:00-05:00">
  <meta property="article:modified_time" content="2026-10-01T11:40:00-05:00">

  <!-- Fuente crítica: autohospedada y precargada -->
  <link rel="preload" href="/assets/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>

  <link rel="stylesheet" href="/styles.css">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": "https://ejemplo.com/blog/audifonos-bluetooth-guia-compra#article",
    "headline": "Guía de compra de audífonos Bluetooth en 2026",
    "datePublished": "2026-09-30T09:12:00-05:00",
    "dateModified": "2026-10-01T11:40:00-05:00",
    "publisher": { "@id": "https://ejemplo.com/#organization" }
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://ejemplo.com/" },
      { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://ejemplo.com/blog" },
      { "@type": "ListItem", "position": 3, "name": "Guía de compra de audífonos Bluetooth" }
    ]
  }
  </script>
</head>
<body>
  <!-- header / main / footer semánticos -->
</body>
</html>
```

Detalles deliberados:

- **No hay `hreflang`**: i18n está postergado (§3.2, I5). Cuando se active, se añaden
  `<link rel="alternate" hreflang>` recíprocos aquí.
- El `<title>` **no** lleva sufijo `| Nombre Comercial`: el título ya describe la página y el
  sufijo consumiría caracteres del límite. La marca está en `og:site_name` y en el JSON-LD.
- Los dos bloques JSON-LD son scripts separados (no un array). Es más fácil de validar y de
  generar por componente; ambos son válidos.
- El CSS está enlazado; el SSR inlinea la parte crítica automáticamente.
- El `<html lang="es-CO">` es obligatorio; una ausencia de `lang` genera una advertencia de
  accesibilidad que Lighthouse marca.

---

## 5. Estrategia de Core Web Vitals

### 5.1 Presupuestos

Los tres umbrales "buenos" de Google son el objetivo de campo. Los umbrales de laboratorio son
más estrictos porque se miden en un entorno controlado, sin red móvil real: si el laboratorio
está justo en el límite, el campo lo superará.

| Métrica | Objetivo de campo (p75 móvil) | Puerta de CI (laboratorio, móvil) | Nota |
|---|---|---|---|
| **LCP** | ≤ 2,5 s | ≤ 2,0 s | Umbral de CI más bajo para absorber la varianza de red |
| **INP** | ≤ 200 ms | TBT ≤ 200 ms (proxy) | Lighthouse no mide INP real; se usa TBT como proxy en lab |
| **CLS** | ≤ 0,1 | ≤ 0,05 | El CLS de lab no ve interacciones tardías; el margen cubre eso |
| **TTFB** | ≤ 800 ms | ≤ 600 ms | Relevante en SSR/prerender con CDN |
| **Peso total de JS inicial** | — | ≤ 170 KB gzip | Se mide en build, no en Lighthouse |
| **Peso de la imagen LCP** | — | ≤ 200 KB | AVIF/WebP, dimensiones explícitas |

Se evalúan en la URL de **p75 móvil**, que es la que Google usa para el ranking. La media no sirve:
un p75 en rojo con una media verde sigue siendo una página lenta para uno de cada cuatro usuarios.

### 5.2 Cómo se miden

**Laboratorio (CI, en cada PR que toca `apps/site`)** — Lighthouse CI
(`@lhci/cli`) contra el servidor SSR real construido, no contra `ng serve`:

```json
// apps/site/lighthouserc.json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:4000/",
        "http://localhost:4000/blog",
        "http://localhost:4000/blog/audifonos-bluetooth-guia-compra",
        "http://localhost:4000/producto/audifonos-tws-pro"
      ],
      "startServerCommand": "node dist/apps/site/server/server.mjs",
      "startServerReadyPattern": "SSR site listening",
      "numberOfRuns": 3,
      "settings": { "preset": "desktop", "throttlingMethod": "simulate" }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:seo": ["error", { "minScore": 1 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2000 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.05 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "server-response-time": ["error", { "maxNumericValue": 600 }],
        "total-byte-weight": ["warn", { "maxNumericValue": 900000 }],
        "uses-responsive-images": "error",
        "uses-optimized-images": "error",
        "render-blocking-resources": "error",
        "unused-javascript": "warn"
      }
    },
    "upload": { "target": "filesystem", "outputDir": ".lighthouseci" }
  }
}
```

Se ejecutan 3 runs y Lighthouse CI toma la mediana, para reducir el ruido. El umbral de
`categories:seo` en 1.0 es exigente y **debe** serlo: su fallo suele indicar un canonical ausente
o un `robots` mal puesto, que es justo lo que queremos detectar.

**Campo** — dos fuentes, ninguna propia en el MVP:

1. **CrUX / PageSpeed Insights API** para las URLs con suficiente tráfico. Requiere volumen; en
   las primeras semanas de un dominio nuevo no habrá datos. Es una limitación real: no se puede
   afirmar que se cumplen los CWV de campo sin tráfico. Se documenta como tal (§11).
2. **Informe de Core Web Vitals de Search Console** (datos de CrUX agregados por origen/grupo de
   URLs). Se consulta manualmente al inicio y, más adelante, podría ingerirse por la API de GSC.

**No se implementa RUM propio en el MVP.** Añadir `web-vitals` + un endpoint de ingesta sería
otra tabla y otra superficie; no aporta a la decisión del MVP. Es una mejora Post-MVP.

### 5.3 Cómo se verifica en CI

- Job `seo-quality` en GitHub Actions, con `paths` filtrado a `apps/site/**` y `packages/ui/**`:

```yaml
seo-quality:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - run: pnpm install --frozen-lockfile
    - name: Build SSR site (con manifest de prerender)
      run: pnpm --filter @app/site build
    - name: Presupuesto de bundle JS
      run: node tools/seo-check/bundle-budget.mjs --max-initial-js-kb 170
    - name: Tests de SEO sobre HTML prerenderizado
      run: pnpm vitest run tools/seo-check
    - name: Lighthouse CI
      run: pnpm dlx @lhci/cli autorun --config=apps/site/lighthouserc.json
```

- El job **bloquea el merge** si falla cualquiera de las tres puertas (bundle, HTML, Lighthouse).
- Los resultados de Lighthouse se suben como artefacto (`.lighthouseci`) para poder comparar
  dos PRs. El presupuesto no es un techo que se sube para que pase el build: si se sube, se
  justifica en la descripción del PR.

### 5.4 Técnicas en Angular

**LCP**

- La imagen LCP se marca con `priority` en `NgOptimizedImage`. Eso genera `fetchpriority="high"`
  y la excluye del lazy loading:

  ```html
  <img
    ngSrc="/assets/blog/audifonos-tws-hero.webp"
    width="1200" height="630"
    priority
    alt="Audífonos Bluetooth TWS sobre fondo claro">
  ```

- El resto de imágenes usan `loading="lazy"` (el sanitizador ya lo fuerza en `body_html`, §3.6)
  y `ngSrcset` con `sizes` para servir el tamaño correcto.
- Ninguna imagen se sirve sin `width`/`height`: eso es lo que produce CLS y LCP tardío por
  reflow.
- El texto LCP (título del artículo en páginas sin hero) se renderiza en servidor, sin depender
  de la carga de JS.

**INP**

- `provideClientHydration(withEventReplay())` evita que los eventos se pierdan antes de hidratar
  y que la interacción espere al bundle completo.
- `provideZoneChangeDetection({ eventCoalescing: true })` agrupa ciclos.
- Los componentes pesados que no son críticos (analítica, chat, mapa de tiendas) se cargan con
  `@defer`, de modo que no compiten por el hilo principal en la primera interacción.
- Sin listeners de scroll/resize sin throttling.

**CLS**

- Dimensiones explícitas en toda imagen y en todo `iframe`/embed (con `aspect-ratio` reservado).
- Fuentes autohospedadas con `font-display: swap` **y** métricas de respaldo ajustadas
  (`size-adjust`, `ascent-override`, `descent-override`, `line-gap-override`) para que el texto
  no salte al cambiar de fuente.
- Ningún elemento se inserta por encima del contenido ya renderizado (avisos, banners). Si un
  banner debe aparecer, reserva su espacio desde el HTML prerenderizado.

**CSS y JS**

- El SSR inlinea el CSS crítico (`inlineCritical` activo por defecto).
- Sin `@import` en CSS (genera peticiones en cascada). Todo se empaqueta.
- Lazy loading por ruta; la analítica se carga con `defer` y nunca en el bundle inicial.
- `TransferState` evita que la hidratación repita las llamadas de datos públicas ya resueltas en
  el servidor (§2.4, punto 4).

**Rendimiento del render**

- Prerender para landings/blog: el HTML se sirve como archivo estático desde CDN, TTFB mínimo.
- SSR de producto con caché `s-maxage=300` en el CDN: la mayoría de visitantes reciben HTML
  cacheado, no un render en vivo.

---

## 6. Pipeline del SEO Content Engine

El pipeline es una cadena de entidades persistidas, no un prompt largo. Cada etapa deja un
registro consultable y auditable. El `SEOAgent` (Fase 6, §G.6 de `architecture-review.md`) no
ejecuta SQL ni toca la base de datos: invoca tools registradas en el `ToolRegistry`, con permisos,
schemas, timeout y auditoría.

### 6.1 Vista general

```txt
keywords ──► clustering (embeddings pgvector) ──► search intent ──► topic clusters
   ──► brief ──► contenido ──► optimización ──► publicación ──► indexación ──► analítica
        │                │                │              │              │
   detección de     sanitización     unicidad de    approval       observación
   canibalización   en servidor      metadata       humano         (GSC)
```

| Etapa | Tabla(s) implicada(s) | Produce | Automatiza el SEOAgent | Revisa el humano |
|---|---|---|---|---|
| 1. Keywords | `keywords` | Términos con intent, volumen y dificultad con `provenance` | Importación, expansión de variantes, normalización | Aprueba el set inicial y corrige intents |
| 2. Clustering | `keyword_clusters`, `keyword_cluster_members`, `ai_embeddings` | Grupos por similitud semántica | Embeddings + agrupación + centroide del cluster | Renombra, fusiona o divide clusters |
| 3. Search intent | `keywords.intent`, `keyword_clusters.intent` | Clasificación por intención | Clasificación con modelo tier 1 | Resuelve desacuerdos y términos de negocio |
| 4. Topic clusters | `keyword_clusters.pillar_content_id`, `content` | Pilar + satélites por cluster | Propone estructura y orden de prioridad | Aprueba la estructura y el orden |
| 5. Brief | `content_briefs` | Outline, entidades, preguntas, enlaces sugeridos | Redacta el brief | Edita y aprueba el brief |
| 6. Contenido | `content` (DRAFT) | Borrador en `body_md` → `body_html` sanitizado | Redacta el borrador | Edita; pasa a `IN_REVIEW` |
| 7. Optimización | `content` (metadata, `json_ld`), `content_links` | Title, description, JSON-LD, enlaces internos | Genera y valida unicidad | Aprueba o corrige metadata |
| 8. Publicación | `content.status`, `approvals`, `outbox_events` | Contenido publicado + evento | **Nada**: la tool exige aprobación | Aprueba explícitamente (`PUBLISH_CONTENT`) |
| 9. Indexación | `seo_index_status` | Estado de cobertura por URL | Sincroniza GSC y observa | Actúa sobre alertas |
| 10. Analítica | `seo_index_status` (clicks, impressions, position) | Rendimiento por cluster | Rollups y propuestas | Decide actualizar o consolidar |

Regla transversal: `effective_permissions = agent.permissions ∩ user.permissions` (ADR-011). El
`SEOAgent` recibe `GENERATE_CONTENT` y `READ_PRODUCTS`; **no** recibe `PUBLISH_CONTENT` ni
`DELETE_ANY`. Aunque el modelo decidiera publicar, el guard lo rechaza.

### 6.2 Etapa 1 — Descubrimiento de keywords

- **Tabla:** `keywords` (`term`, `country`, `language`, `intent`, `search_volume`, `difficulty`,
  `provenance`, `confidence`, `source`, `captured_at`). Unicidad por
  `(organization_id, term, country, language)`.
- **Produce:** el vocabulario de partida, con procedencia declarada.
- **Automatiza:** tools `seo.importKeywords` (CSV/manual estructurado) y `seo.expandKeywords`
  (genera variantes y long-tail a partir de un seed y de datos de `product_sources`).
- **Revisa el humano:** aprueba el conjunto, descarta términos fuera de alcance y corrige los
  que el modelo marcó mal.
- **Honestidad obligatoria:** sin API oficial de Google Trends (ADR-004), `search_volume` y
  `difficulty` se marcan `ESTIMATED` o `AI_INFERENCE` con `source` explícito. Si no hay fuente
  de volumen, se deja `NULL` y `provenance = INSUFFICIENT_DATA`; nunca se inventa un número.
  Esta es la aplicación de ADR-013 al SEO: mejor un término sin volumen que un volumen falso.

### 6.3 Etapa 2 — Clustering por embeddings (pgvector)

El clustering por cadena de texto produce grupos malos ("audífonos bluetooth" y "auriculares
inalámbricos" caen en grupos distintos). Con embeddings caen juntos, que es lo que se necesita
para construir un topic cluster real. Es el caso de uso 3 de ADR-008.

- **Tablas:** `keyword_clusters` (`name`, `topic`, `intent`, `pillar_content_id`, `embedding`,
  `keyword_count`), `keyword_cluster_members` (`cluster_id`, `keyword_id`, `similarity`) y
  `ai_embeddings` (`entity_type = 'keyword'`) para la búsqueda vectorial transversal.
- **Produce:** clusters con nombre, tópico, intención dominante, centroide (embedding) y miembros
  ordenados por similitud.
- **Automatiza:** tool `seo.clusterKeywords`:

```sql
-- 1) Vectores normalizados por término (HNSW, cosine) ya están en ai_embeddings.
-- 2) Asignación de cada keyword al cluster más cercano por centroide, con umbral mínimo.
WITH candidatos AS (
  SELECT
    kc.id AS cluster_id,
    k.id  AS keyword_id,
    1 - (e_k.embedding <=> kc.embedding) AS similarity
  FROM keywords k
  JOIN ai_embeddings e_k
    ON e_k.entity_type = 'keyword' AND e_k.entity_id = k.id
  CROSS JOIN keyword_clusters kc
  WHERE k.organization_id = $1
    AND kc.organization_id = $1
)
SELECT DISTINCT ON (keyword_id) cluster_id, keyword_id, similarity
FROM candidatos
WHERE similarity >= $2          -- umbral mínimo de pertenencia, p. ej. 0.78
ORDER BY keyword_id, similarity DESC;
```

  Los términos que no superan el umbral para ningún cluster existente se marcan como candidatos
  a **nuevo cluster** (el job crea un cluster semilla con ellos y recalcula su centroide).

- **Revisa el humano:** renombra clusters, fusiona los que son el mismo tópico con dos nombres,
  divide clusters demasiado amplios y confirma el `topic`.

### 6.4 Etapa 3 — Search intent

- **Tabla:** `keywords.intent` (`INFORMATIONAL` / `NAVIGATIONAL` / `COMMERCIAL` /
  `TRANSACTIONAL`) y `keyword_clusters.intent` (intención dominante del cluster).
- **Produce:** la intención por término y por cluster, que decide qué tipo de contenido generar.
- **Automatiza:** clasificación con modelo tier 1 (`gemma4:8b` local), que es exactamente su
  perfil: respuesta corta, volumen alto, tolera latencia y no requiere calidad generativa
  (ADR-007). El resultado se registra en `ai_runs` con `routing_reason`.
- **Revisa el humano:** los desacuerdos y los términos de negocio, donde el contexto pesa más
  que el patrón léxico.
- **Regla de coherencia:** un cluster `TRANSACTIONAL` produce landings y páginas de producto;
  uno `INFORMATIONAL` produce artículos. Mezclarlos genera páginas que no responden a la
  intención y no posicionan.

### 6.5 Etapa 4 — Topic clusters (pilar + satélites)

- **Tablas:** `keyword_clusters.pillar_content_id` y `content` (una fila `LANDING` o `BLOG_POST`
  por pieza).
- **Produce:** la estructura del cluster: una página pilar que cubre el tema amplio y N satélites
  que cubren las long-tails, todos enlazados entre sí (§8).
- **Automatiza:** el SEOAgent propone la estructura y el orden de prioridad (a mayor demanda y
  menor competencia estimada, antes). Escribe cada propuesta como `content` en `DRAFT` con
  `cluster_id` asignado.
- **Revisa el humano:** aprueba cuántos satélites, cuál es el pilar y en qué orden. Es una
  decisión de estrategia, no de generación.

### 6.6 Etapa 5 — Brief

- **Tabla:** `content_briefs` (`cluster_id`, `target_keyword`, `secondary_keywords`, `outline`
  jsonb, `entities`, `questions`, `internal_links` jsonb, `status`, `assigned_agent_run_id`).
- **Produce:** el contrato de la pieza: qué debe cubrir para ser completa.
- **Automatiza:** tool `seo.createBrief`. Genera el outline (h1/h2/h3), las entidades que deben
  aparecer, las preguntas a responder y los enlaces internos sugeridos (consultando `content` y
  `content_links` del corpus, no inventándolos). **Antes** de crear el brief se ejecuta
  `seo.detectCannibalization` contra el corpus (§7): si el `target_keyword` ya está cubierto, no
  se crea brief nuevo, se propone consolidar.
- **Revisa el humano:** edita el brief y lo aprueba. El brief es barato de corregir; el artículo
  no. Corregir aquí evita generar 1.500 palabras que no sirven.

### 6.7 Etapa 6 — Contenido

- **Tabla:** `content` (`type`, `channel`, `status = DRAFT`, `title`, `slug`, `body_md`,
  `body_html`, `excerpt`, `target_keyword`, `cluster_id`, `brand_id`,
  `generated_by_agent_run_id`, `content_embedding`).
- **Produce:** el borrador.
- **Automatiza:** el ContentAgent/SEOAgent redacta `body_md`. Al guardar, el servicio:
  1. convierte a HTML y **sanitiza en el servidor** con allowlist (§3.6);
  2. calcula `content_embedding` (para duplicado y canibalización);
  3. valida el Brand Context (§10.3).
- **Revisa el humano:** edita el contenido y lo pasa a `IN_REVIEW`.

### 6.8 Etapa 7 — Optimización

- **Tablas:** `content` (`meta_title`, `meta_description`, `canonical_url`, `og_image_url`,
  `json_ld`) y `content_links`.
- **Produce:** los elementos de SEO on-page y el grafo de enlaces internos.
- **Automatiza:** tools `seo.generateMetadata` (con el chequeo de unicidad, §10.2),
  `seo.generateJsonLd` (construye el bloque correcto por `content.type`) y
  `seo.extractInternalLinks` (parsea el `body_html` saneado y escribe `content_links`).
- **Revisa el humano:** aprueba o corrige metadata. La unicidad es una puerta automática; el
  juicio editorial es humano.

### 6.9 Etapa 8 — Publicación

- **Tablas:** `content` (`status = PUBLISHED`, `approved_by`, `approved_at`, `published_at`),
  `approvals` (`type = PUBLISH_CONTENT`), `outbox_events` (`ContentPublished`).
- **Produce:** el contenido publicado y el evento que dispara sitemap, manifest y notificación.
- **Automatiza:** **nada**. La tool de publicación se declara `requiresApproval: true` (ADR-005):
  el `ToolRegistry` no la ejecuta, crea una `approvals` PENDING. El humano aprueba vía
  `POST /approvals/:id/approve`, que revalida el payload contra el schema antes de ejecutar.
- **Revisa el humano:** aprueba explícitamente. `PUBLISH_CONTENT` no se concede a ningún agente.

La transacción de publicación escribe tres cosas juntas: el cambio de estado, la fila de
`approvals.executed_at` y el evento `ContentPublished` en `outbox_events`. El consumidor del
outbox dispara `seo.sitemap.rebuild` y `seo.prerender.manifest`. Así el sitemap y el manifest no
pueden quedar desfasados del contenido (patrón outbox, ADR-009).

### 6.10 Etapa 9 — Indexación

- **Tabla:** `seo_index_status`.
- **Produce:** el estado observado de cada URL publicada.
- **Automatiza:** jobs de sincronización con Search Console (§9). El sistema **no fuerza** la
  indexación: la observa y alerta. Esto es deliberado y honesto (§11).
- **Revisa el humano:** actúa sobre las alertas (revisar canonical, corregir contenido,
  actualizar, solicitar inspección manual si procede).

### 6.11 Etapa 10 — Analítica

- **Tabla:** `seo_index_status` (`impressions`, `clicks`, `avg_position`, `checked_at`),
  enriquecida con `content.cluster_id` y `content_links` para agregar por cluster.
- **Produce:** rendimiento por URL y por cluster; contenido publicado que nunca recibe
  impresiones; contenido que perdió posiciones.
- **Automatiza:** rollups por cluster, detección de "publicado sin impresiones" (candidato a
  canibalización o a falta de enlaces internos) y propuesta de consolidación o actualización.
- **Revisa el humano:** decide qué se actualiza, qué se consolida y qué se descarta.

---

## 7. Detección de canibalización y contenido duplicado

### 7.1 Por qué esta parte es la más valiosa del sistema

Un `ContentAgent` sin esta puerta produce lo que se le pide: 40 artículos sobre 40 keywords
adyacentes. Y 40 artículos adyacentes son, en la práctica, 40 versiones del mismo artículo.
El resultado es predecible y malo:

- Google elige **uno** de los 40 para cada consulta (o ninguno) y reparte la señal entre todos.
- La autoridad interna se diluye: en vez de una página fuerte, 40 débiles.
- Cada pieza nueva resta, en vez de sumar, porque compite con las anteriores.
- El usuario ve resultados casi idénticos y pierde confianza en el sitio.

La canibalización no rompe el sitio de forma visible. Lo **estanca en silencio**: el contenido se
acumula, el tráfico no sube, y no hay un error que mirar. Es el fallo más caro del marketing de
contenido y el más difícil de diagnosticar a posteriori, porque requiere ver todo el corpus junto.

Es la parte más olvidada porque implementarla exige tres cosas que casi nunca coinciden:
embeddings (para medir similitud semántica real), el corpus completo en un solo lugar (una
planilla de contenidos no permite comparar `target_keyword` + similitud entre 200 piezas) y una
**puerta en el workflow** (una detección que solo avisa no sirve; tiene que bloquear). Este
proyecto tiene las tres por construcción: pgvector (ADR-008), el CMS en Postgres y el
`ToolRegistry` con approval gate.

### 7.2 El algoritmo

Se ejecuta en la tool `seo.detectCannibalization`, invocada en dos momentos:

1. **Al crear un brief** (§6.6): si el `target_keyword` ya está cubierto, no se crea el brief.
2. **Antes de publicar** (§6.9): puerta dura. `POST /content/:id/publish` falla si hay conflicto
   bloqueante no resuelto.

**Paso 1 — normalización del término objetivo.** Se normaliza `target_keyword`: minúsculas, sin
tildes, sin signos, espacios colapsados. Dos términos con la misma forma normalizada son el mismo
objetivo aunque se escriban distinto.

**Paso 2 — solapamiento exacto de keyword objetivo.**

```sql
SELECT
  c1.id AS a_id, c1.slug AS a_slug, c1.target_keyword,
  c2.id AS b_id, c2.slug AS b_slug, c2.status AS b_status, c2.published_at AS b_published_at
FROM content c1
JOIN content c2
  ON  c2.organization_id = c1.organization_id
  AND c2.id > c1.id
WHERE c1.organization_id = $1
  AND c1.id = $2
  AND c1.target_keyword IS NOT NULL
  AND c2.status IN ('IN_REVIEW', 'APPROVED', 'PUBLISHED')
  AND normalize_keyword(c2.target_keyword) = normalize_keyword(c1.target_keyword);
```

Un resultado aquí es **canibalización directa**: dos páginas declararon la misma keyword objetivo.
No requiere umbral: es un hecho.

**Paso 3 — similitud semántica del contenido con pgvector.**

```sql
SELECT
  c2.id AS b_id,
  c2.slug AS b_slug,
  c2.target_keyword AS b_target_keyword,
  c2.status AS b_status,
  1 - (c1.content_embedding <=> c2.content_embedding) AS similarity
FROM content c1
JOIN content c2
  ON  c2.organization_id = c1.organization_id
  AND c2.id <> c1.id
WHERE c1.id = $1
  AND c2.status IN ('IN_REVIEW', 'APPROVED', 'PUBLISHED')
  AND c1.content_embedding IS NOT NULL
  AND c2.content_embedding IS NOT NULL
  AND 1 - (c1.content_embedding <=> c2.content_embedding) >= $2   -- umbral: 0.88
ORDER BY similarity DESC
LIMIT 20;
```

El operador `<=>` es distancia coseno de pgvector; `1 - distancia` es similitud. El índice debe
ser HNSW con `vector_cosine_ops` para que la consulta sea de milisegundos:

```sql
CREATE INDEX content_embedding_hnsw_idx
  ON content USING hnsw (content_embedding vector_cosine_ops);
```

Si `content.content_embedding` está `NULL` (contenido creado antes de que existiera el pipeline o
editado por fuera), se calcula de forma perezosa antes de comparar; si sigue siendo `NULL`, se
marca `INSUFFICIENT_DATA` y **no se puede publicar** hasta que tenga embedding. Publicar sin
poder comprobar el corpus es exactamente el agujero que esta puerta cierra.

**Paso 4 — clasificación del conflicto.** Se combinan las dos señales:

| Keyword objetivo | Similitud | Intención | Clasificación | Acción |
|---|---|---|---|---|
| Igual (normalizada) | cualquiera | Igual | **Canibalización directa** | Consolidar (o no publicar) |
| Distinta | ≥ 0,93 | cualquiera | **Duplicado probable** | Consolidar o diferenciar; revisión humana obligatoria |
| Distinta | 0,88 – 0,93 | Igual | **Solapamiento alto** | Diferenciar: nuevo ángulo, nueva keyword, reescribir brief |
| Distinta | 0,88 – 0,93 | Distinta | **Aceptable** | Publicar (una informativa y una transaccional pueden coexistir) |
| Distinta | < 0,88 | cualquiera | **Sin conflicto** | Publicar |

Los umbrales (0,88 / 0,93) son configuración, no constantes: se calibran contra el corpus real
de este proyecto y se revisan cuando haya resultados. Están documentados en configuración para
que no se "ajusten" a ojo dentro del código.

### 7.3 Qué acción se toma

- **Consolidar.** La pieza perdedora se fusiona en la ganadora: el contenido útil se añade a la
  ganadora, la perdedora pasa a `ARCHIVED` y se crea una fila en `content_redirects` con `301`
  hacia la ganadora (§2.7). Se transfiere el enlace interno: todo `content_links` que apuntaba a
  la perdedora se reescribe hacia la ganadora. **No se usa `noindex`** para consolidar: no
  transfiere señal; el 301 sí.
- **Diferenciar.** El contenido se reescribe con otro ángulo y otro `target_keyword`; se
  actualiza el brief y se recalcula `content_embedding`. No se publica hasta que la similitud con
  el corpus baje del umbral.
- **No publicar.** Si la pieza no aporta nada que la ganadora no cubra ya, se descarta. Es una
  salida válida y frecuente: el objetivo es un corpus fuerte, no un corpus grande.

**La puerta es dura, con override auditado.** Si el humano decide publicar aun con conflicto,
puede forzarlo, pero debe registrar una razón. Esa decisión queda en `audit_logs`
(`action = 'seo.cannibalization.override'`) con el `b_id`, la similitud y el texto de la razón.
No hay forma de saltarse la detección en silencio.

### 7.4 Cómo se consolida (procedimiento)

```txt
1. El SEOAgent detecta el conflicto y crea una approval de tipo SELECT_PRODUCT… no:
   crea una propuesta con la acción recomendada (consolidar hacia X, diferenciar, descartar).
   La propuesta incluye: a_id, b_id, similarity, keyword compartida, y la URL ganadora sugerida.
2. El humano aprueba la consolidación en el panel SEO (apps/web).
3. El servicio de consolidación, en una transacción:
     a. copia el contenido útil de la perdedora a la ganadora (deja constancia en body_md);
     b. marca la perdedora como ARCHIVED;
     c. inserta en content_redirects (from_path = ruta de la perdedora,
        to_content_id = ganadora, status_code = 301, reason = 'consolidation');
     d. reescribe content_links.from_content_id de la perdedora a la ganadora;
     e. emite outbox_events: ContentArchived, ContentSlugChanged (si aplica).
4. Los consumidores del outbox disparan seo.sitemap.rebuild y seo.prerender.manifest.
   La URL perdedora desaparece del sitemap en la siguiente ejecución.
5. seo_index_status conserva la fila de la URL perdedora con su coverage_state hasta que GSC
   refleje el 301; después se marca como consolidada.
```

### 7.5 Detección de duplicado en la misma publicación

Un caso distinto pero frecuente: dos contenidos generados en la misma tanda que son casi iguales
entre sí (no contra el corpus). Se detecta con un job por lotes `seo.duplicate.scan` que corre
sobre los contenidos en `IN_REVIEW` de un mismo `cluster_id`:

```sql
SELECT a.id AS a_id, b.id AS b_id,
       1 - (a.content_embedding <=> b.content_embedding) AS similarity
FROM content a
JOIN content b
  ON b.organization_id = a.organization_id
 AND b.cluster_id = a.cluster_id
 AND b.id > a.id
WHERE a.cluster_id = $1
  AND a.status IN ('IN_REVIEW', 'APPROVED')
  AND b.status IN ('IN_REVIEW', 'APPROVED')
  AND 1 - (a.content_embedding <=> b.content_embedding) >= 0.93
ORDER BY similarity DESC;
```

Un cluster que produce tres artículos con similitud 0,95 entre ellos es un síntoma de que el
brief está mal: no definió ángulos distintos. La corrección es en el brief, no en el texto.

---

## 8. Internal linking y detección de páginas huérfanas

### 8.1 El grafo en `content_links`

```txt
content_links
  id, organization_id, from_content_id, to_content_id, anchor_text, is_internal
```

- `is_internal = true` cuando el destino es un `content` del propio sitio; `false` cuando es un
  enlace saliente. El grafo de enlaces internos es el subconjunto `is_internal = true`.
- Se reconstruye **desde el HTML saneado**, no desde una convención: `seo.extractInternalLinks`
  parsea `content.body_html`, resuelve cada `href` contra el mapa de rutas publicadas y escribe
  una fila por enlace. Un enlace añadido a mano en el CMS entra al grafo igual que uno generado
  por el agente.
- Al actualizar un contenido, el job **borra sus filas como origen y las reescribe** en una
  transacción. Las filas donde el contenido es destino no se tocan: son el registro de quién lo
  enlaza, que es lo que importa para detectar huérfanas.

### 8.2 Detección de páginas huérfanas

Una página huérfana es contenido publicado que **nadie enlaza**. Google puede descubrirla por el
sitemap, pero sin enlaces internos recibe poca señal y suele quedar en "Descubierta: sin
indexar". Es uno de los motivos más comunes de contenido que no se indexa y uno de los pocos que
se pueden corregir del todo por nuestra parte.

```sql
-- Contenido publicado sin ningún enlace interno entrante.
SELECT c.id, c.slug, c.type, c.cluster_id, c.published_at
FROM content c
LEFT JOIN content_links l
  ON  l.to_content_id = c.id
  AND l.is_internal = true
  AND l.organization_id = c.organization_id
WHERE c.organization_id = $1
  AND c.status = 'PUBLISHED'
  AND c.deleted_at IS NULL
  AND l.id IS NULL
ORDER BY c.published_at ASC;
```

Acción sobre una huérfana: se enlaza desde su pilar (si es un satélite, se enlaza desde
`keyword_clusters.pillar_content_id`) o desde el contenido más relacionado por embedding. El
`SEOAgent` propone el enlace y el humano lo aprueba; nunca se inventa un enlace a un contenido
irrelevante solo para "no dejarlo huérfano", porque un enlace irrelevante es peor que ninguno.

### 8.3 Enlaces rotos y enlaces a contenido no publicado

```sql
-- Enlaces internos cuyo destino ya no está publicado (borrador, archivado o eliminado).
SELECT l.from_content_id, l.to_content_id, c.slug AS destino, c.status
FROM content_links l
JOIN content c ON c.id = l.to_content_id
WHERE l.organization_id = $1
  AND l.is_internal = true
  AND c.status <> 'PUBLISHED';
```

Un enlace a un `DRAFT` es un fallo del proceso (se enlazó antes de publicar) y se corrige; un
enlace a un `ARCHIVED` debe apuntar al destino de su `content_redirects` (§7.3), no al contenido
archivado.

### 8.4 Conteo de enlaces entrantes (distribución de señal)

```sql
SELECT
  c.id, c.slug, c.cluster_id,
  COUNT(l.id) AS inbound_internal_links,
  COUNT(l.id) FILTER (WHERE l.anchor_text IS NOT NULL) AS inbound_with_anchor
FROM content c
LEFT JOIN content_links l
  ON l.to_content_id = c.id AND l.is_internal = true
WHERE c.organization_id = $1 AND c.status = 'PUBLISHED'
GROUP BY c.id, c.slug, c.cluster_id
ORDER BY inbound_internal_links ASC;
```

Se vigila la **cola**: páginas con 0 o 1 enlace entrante. Se vigila también la **cabeza a lo
loco**: una página con cientos de enlaces entrantes desde contenido diverso sugiere sobre-enlazado
(a veces señal de manipulación). El objetivo no es maximizar enlaces, es que cada pieza publicada
esté conectada de forma relevante.

### 8.5 Estrategia de enlazado

- **Pilar → satélite:** el pilar enlaza a todos sus satélites (tabla de contenidos del tema).
- **Satélite → pilar:** cada satélite enlaza al pilar con anchor descriptivo del tema amplio.
- **Satélite ↔ satélite:** solo cuando hay relación temática real, no por completar cupo.
- **Anchor text:** descriptivo y variado. Un mismo destino no recibe siempre el mismo anchor
  exacto (eso es un patrón de manipulación). Se usan variantes naturales: el término, una
  variante semántica, y frases como "guía de compra de audífonos". El CI comprueba que la
  distribución de anchors de un mismo destino no sea idéntica.
- **Cross-cluster:** un enlace entre clusters distintos solo si el contexto lo justifica; sirve
  para conectar temas relacionados (audio → accesorios) y no para inflar conteos.
- Los enlaces sugeridos por IA viven en `content_briefs.internal_links` y **no** se publican
  automáticamente: se revisan (son parte de la revisión humana del brief, §6.6).

### 8.6 Verificación

- **CI:** al construir, el test de enlaces internos (§12) comprueba que cada `href` interno
  apunta a una ruta prerenderizada existente o a una ruta SSR conocida (`/producto/*`,
  `/buscar`). Un enlace a una ruta que no existe es un 404 desde el punto de vista del usuario,
  aunque el HTML se genere sin error.
- **CI:** el job de publicación falla si el contenido publicado queda con cero filas en
  `content_links` como origen (publicar sin enlazar nada es un error de proceso).
- **MANUAL (mensual):** informe de huérfanas y de enlaces rotos en `apps/web`; se corrigen antes
  de la siguiente tanda de contenido.

---

## 9. Integración con Google Search Console

### 9.1 Principio

El sistema **no controla** si Google indexa. Lo que hace es **observar** el estado y alertar. Esta
sección implementa la parte accionable del requisito §29 (arquitectura §I.3): "la preparación
técnica es condición necesaria, no suficiente; lo accionable es observar el estado y avisar".

### 9.2 OAuth

```txt
Proveedor:  Google Cloud project → OAuth 2.0 Client (tipo Web)
Scope:      https://www.googleapis.com/auth/webmasters.readonly
             (solo lectura: el sistema nunca envía cambios a GSC por API en el MVP)
Verificación de propiedad:  propiedad de DOMINIO (ejemplo.com) vía registro DNS TXT
             → cubre http/https y todos los subdominios sin reverificar
Token:      refresh token custodiado como SECRETO (env / secret manager del despliegue)
             · nunca se guarda en una tabla de dominio
             · nunca se pasa al contexto de un modelo (K.3)
             · el access token se obtiene en memoria por el provider con `google-auth-library`
```

El MVP es de un solo usuario y una sola propiedad: el refresh token vive como secreto de
despliegue. Si en el futuro hubiera varios usuarios o propiedades, se añadiría una tabla de
credenciales cifradas; hoy sería infraestructura sin uso.

### 9.3 Qué datos se ingieren en `seo_index_status`

```txt
seo_index_status
  id, organization_id, content_id NULL, url, coverage_state,
  indexed_at, last_crawled_at, impressions, clicks, avg_position, checked_at
```

Tres fuentes, tres jobs:

**1) `seo.gsc.sync-analytics` (diario, repetible).**
API Search Analytics (`searchanalytics.query`), dimensiones `page` + `date`, `rowLimit` 25000 con
paginación por `startRow`. Aporta las métricas de rendimiento de búsqueda:

| Campo de `seo_index_status` | Origen |
|---|---|
| `url` | dimensión `page` (se normaliza sin fragmento ni parámetros de tracking) |
| `impressions` | suma de `impressions` (ventana móvil de 28 días) |
| `clicks` | suma de `clicks` |
| `avg_position` | `position` ponderada por impresiones |
| `checked_at` | momento del job |

`content_id` se resuelve por coincidencia con la ruta canónica de `content`; si una URL del
sitemap no coincide con ningún `content`, se registra igual (con `content_id` NULL) porque es un
dato relevante: puede ser una URL indexada que no controlamos.

**2) `seo.gsc.inspect-urls` (diario, con cuota).**
API URL Inspection (`urlInspection.index.inspect`), **una llamada por URL**. Cuota real:
~2.000 inspecciones por día y propiedad, ~600 por minuto. Por eso se prioriza:

```txt
Prioridad 1: contenido publicado en los últimos 14 días (aún no confirmado como indexado)
Prioridad 2: URLs que pasaron de INDEXED a NOT_INDEXED en la última semana
Prioridad 3: contenido con caída de impresiones > 30% en 7 días
Prioridad 4: rotación por antigüedad de `checked_at` (las más antiguas primero)
```

Aporta:

| Campo de `seo_index_status` | Origen en la respuesta |
|---|---|
| `coverage_state` | `inspectionResult.indexStatusResult.coverageState` (texto de GSC) |
| `indexed_at` | derivado de `indexStatusResult.lastCrawlTime` cuando la cobertura indica indexada |
| `last_crawled_at` | `indexStatusResult.lastCrawlTime` |
| `robots_txt_state` | `indexStatusResult.robotsTxtState` (alerta si `DISALLOWED`) — se compara con `coverage_state` |
| `google_canonical` vs `user_canonical` | comparación para detectar discrepancia de canonical |

`coverage_state` se guarda como texto (el valor tal cual lo devuelve GSC, que es lo que permite
compararlo con el panel) y se mapea a un enum interno para las alertas:

```txt
INDEXED      → "Submitted and indexed", "Indexed, not submitted in sitemap"
NOT_INDEXED  → "Crawled - currently not indexed", "Discovered - currently not indexed"
DUPLICATE    → "Duplicate, Google chose different canonical than user", "Duplicate without user-selected canonical"
EXCLUDED     → "Excluded by 'noindex' tag", "Excluded by 'robots.txt'", "Blocked by robots.txt"
ERROR        → "Soft 404", "Not found (404)", "Server error (5xx)", "Redirect error"
```

**3) `seo.gsc.sitemaps` (diario).**
API Sitemaps (`sitemaps.list`, `sitemaps.get`). No escribe en `seo_index_status`; alimenta las
alertas y el panel de control: `lastDownloaded`, `errors`, `warnings`, `isPending`,
`contents[].indexed` por sitemap.

### 9.4 Alertas

Cada alerta se materializa como `outbox_events` (tipo `SeoAlertRaised`) y aparece en el panel SEO
de `apps/web`. En el MVP no se envía email; el canal es el centro de control (Fase 8 lo amplía).

| Alerta | Regla | Por qué importa |
|---|---|---|
| **Caída de indexación** | URLs en estado `INDEXED` baja > 10% en 7 días (o más de 5 URLs absolutas) | El sitio está dejando de indexarse: revisar `noindex`, `robots.txt`, canonical o una migración reciente |
| **Error de cobertura** | Una URL publicada pasa de `INDEXED` a `NOT_INDEXED`/`ERROR`, o lleva > 14 días en `NOT_INDEXED` sin haber estado nunca indexada | Contenido publicado que Google no indexa: candidato a canibalización, a contenido flojo o a canonical incorrecto |
| **Canonical distinto** | `google_canonical != user_canonical` | Google eligió otra URL como canónica: la página no posicionará aunque exista. Suele deberse a duplicado o a canonical mal puesto |
| **Bloqueo por robots** | `coverage_state = "Blocked by robots.txt"` en una URL que debería ser indexable, o `robots_txt_state = DISALLOWED` | Regresión de configuración: una línea de `robots.txt` está bloqueando contenido |
| **Soft 404 / 404 en URL del sitemap** | `coverage_state` contiene "Soft 404" o "Not found (404)" para una URL presente en el sitemap | El sitemap y la realidad divergen: contenido eliminado sin regenerar sitemap, o página vacía |
| **Sitemap con errores** | `errors > 0` en cualquier sitemap, o `lastDownloaded` con más de 72 h, o sitemap no enviado | Los errores de sitemap pasan desapercibidos y bloquean el descubrimiento de todo el contenido nuevo |
| **Publicado sin rastrear** | URL publicada hace > 14 días con `last_crawled_at` nulo | Ni siquiera ha sido rastreada: revisar enlaces internos (huérfana), sitemap y robots |
| **Caída de impresiones** | Impresiones totales (28 d) caen > 40% frente a los 28 d anteriores, sin causa conocida | Puede ser estacionalidad, una actualización de Google o una pérdida real de visibilidad |

Regla de diseño de alertas: **una alerta debe ser accionable**. "No estás indexado" no lo es (no
depende de nosotros); "indexado → no indexado con canonical distinto" sí lo es. Cada alerta incluye
la URL, el estado anterior y el nuevo, y la acción sugerida.

### 9.5 Rate limits y manejo de errores

- Los jobs corren con `attempts` y backoff exponencial e idempotencia por `jobId` (ADR-010).
- `quotaExceeded` (429) de GSC se trata como reintentable con backoff; el job de inspección se
  reanuda desde el último `startRow`/URL procesada en la siguiente ejecución.
- GSC tiene **latencia de datos**: los datos de Search Analytics suelen tener 2-3 días de retraso
  y los últimos días están incompletos. Las alertas comparan ventanas completas (28 d vs 28 d
  anteriores), no días sueltos, para no disparar por el retraso normal.
- Si la propiedad no está verificada o el token expiró, el job falla con `SEARCH_CONSOLE_AUTH_ERROR`
  y se muestra en el panel; no se silencia.

---

## 10. Generación de metadata y contenido por IA

### 10.1 Por qué no se usan plantillas

Una plantilla de `title` como `"{nombre del producto} | {categoría} | Marca"` produce títulos
repetidos, predecibles y sin intención de búsqueda. Con 200 páginas se obtienen 200 títulos que
empiezan igual y que Google trata como contenido de baja calidad. Lo mismo con la meta description
`"Compra {producto} al mejor precio. Envío a todo el país."` repetida con el nombre cambiado.

El sistema genera `title` y `description` **por página**, desde el contenido real de esa página
(su `target_keyword`, su `excerpt`, los datos del producto, los datos reales de `product_metrics`
cuando aportan algo), no desde una cadena de formato. La marca solo se añade al `title` si sobra
espacio (≤ 60 caracteres totales).

### 10.2 Garantía de unicidad

La unicidad no se pide al modelo: se **verifica** contra el corpus. Es una puerta, no una
instrucción. La tool `seo.generateMetadata` nunca devuelve una propuesta sin haberla pasado por
`assertMetadataUnique()`.

**Chequeo exacto.** Normaliza y compara contra todo el contenido en `APPROVED`, `PUBLISHED` y
`IN_REVIEW`:

```ts
// apps/api/src/modules/seo/metadata-uniqueness.service.ts
import { Injectable } from '@nestjs/common';
import type { PrismaService } from '@app/db';

export type MetadataProposal = {
  contentId: string;
  metaTitle: string;
  metaDescription: string;
  targetKeyword: string | null;
};

export type UniquenessVerdict =
  | { ok: true }
  | { ok: false; reasons: string[]; conflicts: { id: string; slug: string; field: 'title' | 'description'; kind: 'exact' | 'similar' }[] };

const TITLE_MIN = 15;
const TITLE_MAX = 60;
const DESC_MIN = 50;
const DESC_MAX = 160;
const SEMANTIC_SIMILARITY_THRESHOLD = 0.92;

@Injectable()
export class MetadataUniquenessService {
  constructor(private readonly prisma: PrismaService) {}

  async assert(proposal: MetadataProposal): Promise<UniquenessVerdict> {
    const reasons: string[] = [];
    const conflicts: UniquenessVerdict extends { conflicts: infer C } ? C : never = [] as never;

    // 1) Longitud
    if (proposal.metaTitle.length < TITLE_MIN || proposal.metaTitle.length > TITLE_MAX) {
      reasons.push(`title fuera de rango (${TITLE_MIN}-${TITLE_MAX})`);
    }
    if (proposal.metaDescription.length < DESC_MIN || proposal.metaDescription.length > DESC_MAX) {
      reasons.push(`description fuera de rango (${DESC_MIN}-${DESC_MAX})`);
    }

    // 2) Duplicado exacto (título o descripción) contra el corpus
    const exact = await this.prisma.$queryRaw<
      { id: string; slug: string; meta_title: string; meta_description: string }[]
    >`
      SELECT id, slug, meta_title, meta_description
      FROM content
      WHERE organization_id = ${this.orgId}
        AND id <> ${proposal.contentId}
        AND status IN ('IN_REVIEW', 'APPROVED', 'PUBLISHED')
        AND deleted_at IS NULL
        AND (
          lower(btrim(meta_title)) = lower(btrim(${proposal.metaTitle}))
          OR lower(btrim(meta_description)) = lower(btrim(${proposal.metaDescription}))
        )
    `;
    for (const row of exact) {
      conflicts.push({
        id: row.id,
        slug: row.slug,
        field: row.meta_title.toLowerCase() === proposal.metaTitle.toLowerCase() ? 'title' : 'description',
        kind: 'exact',
      });
    }

    // 3) Casi duplicado semántico: embeddings del título+descripción contra el corpus.
    //    Se usa ai_embeddings con entity_type = 'content_meta'.
    const similar = await this.prisma.$queryRaw<
      { id: string; slug: string; similarity: number }[]
    >`
      SELECT c.id, c.slug,
             1 - (e_new.embedding <=> e_old.embedding) AS similarity
      FROM content c
      JOIN ai_embeddings e_old
        ON e_old.entity_type = 'content_meta' AND e_old.entity_id = c.id
      JOIN ai_embeddings e_new
        ON e_new.entity_type = 'content_meta' AND e_new.entity_id = ${proposal.contentId}
      WHERE c.organization_id = ${this.orgId}
        AND c.id <> ${proposal.contentId}
        AND c.status IN ('IN_REVIEW', 'APPROVED', 'PUBLISHED')
        AND 1 - (e_new.embedding <=> e_old.embedding) >= ${SEMANTIC_SIMILARITY_THRESHOLD}
      ORDER BY similarity DESC
      LIMIT 5
    `;
    for (const row of similar) {
      conflicts.push({ id: row.id, slug: row.slug, field: 'title', kind: 'similar' });
    }

    if (conflicts.length > 0) reasons.push('existen títulos o descripciones duplicados o casi idénticos');

    return reasons.length ? { ok: false, reasons, conflicts } : { ok: true };
  }
}
```

Cuando el chequeo falla, la tool **regenera** con instrucciones explícitas de diferenciación y
hasta 3 intentos; si tras 3 intentos no consigue unicidad, devuelve el conflicto al humano con
la lista de competidores. No reintenta indefinidamente (eso gastaría presupuesto de IA sin
resultado) ni publica con un duplicado.

**Reglas adicionales que se validan:**

- El `title` contiene el `target_keyword` de forma natural (no forzado al final).
- El `title` no termina en separador ni en el nombre de la marca repetido.
- La `description` responde a la intención del cluster: una `TRANSACTIONAL` incluye el beneficio
  o el precio; una `INFORMATIONAL` incluye qué se aprende.
- Ni `title` ni `description` contienen `forbidden_words` del Brand Context (§10.3).

### 10.3 Brand Context

El Brand Context vive en `brands`:

```txt
brands
  id, organization_id, name, tone, values jsonb, forbidden_words text[],
  preferred_words text[], communication_style, color_palette jsonb, audience jsonb,
  embedding vector NULL
```

Cómo se aplica en tres momentos:

1. **Antes de generar (contexto del prompt).** La fila de `brands` (tono, valores, estilo,
   audiencia, palabras preferidas y prohibidas) se inyecta en el prompt del `ContentAgent` y del
   `SEOAgent`. Además, `brands.embedding` se usa como fuente de RAG: se recuperan pasajes de
   contenido previo con alta similitud de marca (`ai_embeddings` con `entity_type = 'brand'` y
   de `content` publicado) para que el modelo escriba con la voz real de la marca y no repita
   ángulos ya usados.

2. **Después de generar (validación dura).**

```ts
// apps/api/src/modules/content/brand-context.validator.ts
export type BrandContext = {
  forbiddenWords: string[];
  preferredWords: string[];
  tone: string | null;
};

export type BrandValidation = { ok: boolean; violations: string[]; suggestions: string[] };

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function validateBrandContext(text: string, brand: BrandContext): BrandValidation {
  const violations: string[] = [];
  const suggestions: string[] = [];
  const lower = text.toLowerCase();

  // Violación dura: palabra prohibida presente como palabra completa.
  for (const word of brand.forbiddenWords) {
    const re = new RegExp(`(^|[^\\p{L}])${escapeRegex(word.toLowerCase())}([^\\p{L}]|$)`, 'u');
    if (re.test(lower)) violations.push(`palabra prohibida: "${word}"`);
  }

  // Señal blanda: palabras preferidas ausentes. No bloquea; informa.
  const missing = brand.preferredWords.filter((w) => !lower.includes(w.toLowerCase()));
  if (missing.length > 0) suggestions.push(`no aparece ninguna de: ${missing.join(', ')}`);

  return { ok: violations.length === 0, violations, suggestions };
}
```

   `forbidden_words` es una puerta dura: si aparece una, el contenido no avanza de `DRAFT`. Las
   `preferred_words` son una señal blanda que se muestra al revisor; convertirlas en puerta dura
   produciría textos antinaturales rellenando palabras.

3. **Como señal de tono (no como puerta).** La similitud entre el embedding del borrador y
   `brands.embedding` se registra y se muestra al revisor como indicador de consistencia. **No es
   una puerta dura**: un umbral de similitud de marca bloqueando contenido es una forma rápida de
   obligar al modelo a escribir siempre igual. La puerta dura es `forbidden_words` + revisión
   humana.

### 10.4 Revisión humana en el MVP

El MVP **no publica contenido generado sin revisión humana**. El flujo de `content.status`:

```txt
DRAFT ──► IN_REVIEW ──► APPROVED ──► PUBLISHED
  │            │             │
  │            └── vuelve a DRAFT con comentarios del revisor
  │
  └── el agente escribe aquí; el humano no revisa en DRAFT salvo que el agente lo pida
```

- `APPROVED` exige `approved_by` (usuario) y `approved_at` no nulos. No hay transición automática
  a `APPROVED`.
- `PUBLISHED` exige una fila `approvals` de tipo `PUBLISH_CONTENT` en estado `APPROVED` y
  `executed_at` no nulo (ADR-005).
- El agente nunca tiene `PUBLISH_CONTENT`; aunque el modelo lo intentara, el guard lo rechaza.
- Toda la cadena de IA queda trazada: `content.generated_by_agent_run_id` → `ai_runs` (modelo,
  tokens, coste, `routing_reason`) → `ai_tool_calls` (tools usadas con su estado).

Esto es coherente con la puerta de contenido de §H.2 y con el criterio de aceptación del
Hito 4 ("El contenido generado respeta el Brand Context"). La revisión humana no es un cuello de
botella del MVP: es el punto donde el criterio editorial corrige lo que el modelo no puede
juzgar (veracidad, oportunidad, tono de marca).

---

## 11. Qué NO promete el sistema y qué sí garantiza

Esta sección existe para que nadie —ni el usuario del sistema ni quien lea un informe generado
por él— confunda lo que se controla con lo que no.

### 11.1 Lo que el sistema NO promete

| No se promete | Por qué |
|---|---|
| **Que el contenido se indexe** | La indexación la decide Google. La preparación técnica la hace *posible* (rastreable y elegible), no *segura*. Depende de la calidad del contenido, de la autoridad del dominio y de señales que no controlamos. |
| **Posiciones en el buscador** | El ranking depende de la competencia, del algoritmo y de la autoridad. Ninguna configuración técnica lo determina. El sistema puede medir posición (`seo_index_status.avg_position`), no garantizarla. |
| **Tráfico** | Es consecuencia de indexación + posición + demanda. El sistema no puede prometerlo. |
| **Cumplir Core Web Vitals de campo desde el día 1** | Los CWV de campo (CrUX) requieren volumen de tráfico para medirse. En un dominio nuevo no habrá datos de campo hasta que haya visitas. En CI se verifica el laboratorio; el campo se observa después. |
| **Datos de Google Trends** | No hay API oficial (ADR-004). El sistema no produce `trend_index` salvo que se contrate un proveedor de datos. En el MVP: señal indirecta o carga manual. |
| **Volumen de búsqueda real** | Sin fuente de volumen contratada, `search_volume` va marcado `ESTIMATED`/`AI_INFERENCE` o queda nulo. Nunca se presenta como dato. |
| **Rich results de FAQ** | Google restringió los FAQ rich results a sitios de gobierno/salud (2023). El marcado se emite, el resultado enriquecido no está garantizado. |
| **Que un artículo "posicione" por publicarse** | Publicar es la condición de partida, no el resultado. |

### 11.2 Lo que el sistema SÍ garantiza

| Se garantiza | Cómo se comprueba |
|---|---|
| **Rastreabilidad** | `robots.txt` servido correctamente, sitemap con solo contenido publicado, sin rutas internas expuestas, sin cadenas de redirección, 404 reales, 301 para URLs cambiadas. Todo con test en CI (§3.1). |
| **Elegibilidad para el índice** | Canonical autorreferencial, `meta robots` correcto por tipo de página, `noindex` en búsqueda y filtros, JSON-LD válido, HTML renderizado en servidor (no solo en cliente). Test en CI (§3.2, §3.3). |
| **Estructura y calidad on-page verificada** | Un solo `h1` sin saltos, URLs limpias y estables, `alt` descriptivo, HTML semántico, metadata única. Test en CI (§3.4). |
| **Rendimiento dentro de presupuesto** | Presupuesto de CWV y de JS verificado en CI en cada PR que toca el sitio (§5). |
| **Observabilidad del estado de indexación** | `seo_index_status` alimentado por GSC y ocho alertas accionables (§9.3, §9.4). Es lo único accionable del problema de indexación, y es lo que el sistema implementa a fondo. |
| **Protección del CRM** | Tres capas de bloqueo independientes (§1.4) con test de contrato. |
| **Prevención de canibalización** | Una puerta dura, con override auditado (§7). Evita que el corpus se autodestruya. |
| **Trazabilidad del contenido generado** | De la pieza al `ai_run` (modelo, coste, tool calls), y del cambio al `audit_log`. |
| **Un corpus conectado** | Detección de huérfanas y de enlaces rotos (§8), con acción sobre cada una. |

La frase que resume la postura: **el sistema garantiza que el sitio es rastreable, elegible y
observable. Lo que no garantiza —ni puede— es que Google lo premie.** Confundir ambas cosas es
el error que hace que un equipo de marketing crea que hizo "SEO" cuando solo hizo "técnica". La
observabilidad existe precisamente para no quedarse en esa creencia.

---

## 12. Tests de SEO automatizados en CI

### 12.1 Estrategia

Hay dos suites, porque comprueban cosas distintas:

1. **Estática sobre el HTML prerenderizado** (`tools/seo-check/prerender.spec.ts`): lee los
   archivos de `dist/apps/site/browser/**/*.html` y valida el HTML. No necesita servidor. Es
   rápida y atrapa el 90% de las regresiones de metadata, estructura y JSON-LD.
2. **Integración contra el servidor** (`tools/seo-check/server.spec.ts`): levanta el build y hace
   `fetch` a URLs reales. Valida estados HTTP, headers y comportamientos que solo existen en
   runtime (404 real, 301, `robots.txt` servido, `Content-Type`, `noindex` de búsqueda).

Y dos comprobaciones adicionales que no son "tests" en sentido estricto pero van en el mismo job:
el presupuesto de bundle JS y Lighthouse CI (§5.3).

Herramientas: Vitest (`apps/site` y `packages/ui` ya usan Vitest, §C.1), `cheerio` para parsear
HTML, `glob` para recorrer los archivos, `ajv` para validar el JSON-LD contra un schema mínimo.

### 12.2 Suite estática: HTML prerenderizado

```ts
// tools/seo-check/prerender.spec.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { globSync } from 'glob';
import * as cheerio from 'cheerio';
import Ajv from 'ajv';

type Page = { file: string; route: string; $: cheerio.CheerioAPI; html: string };

const files = globSync('dist/apps/site/browser/**/*.html');

const routeOf = (file: string): string =>
  '/' +
  file
    .replace(/^.*browser\//, '')
    .replace(/index\.html$/, '')
    .replace(/\.html$/, '');

let pages: Page[];

beforeAll(() => {
  pages = files.map((file) => {
    const html = readFileSync(file, 'utf8');
    return { file, route: routeOf(file), html, $: cheerio.load(html) };
  });
  expect(pages.length, 'no se prerenderizó ninguna página').toBeGreaterThan(0);
});

describe('SEO — estructura', () => {
  it('cada página tiene exactamente un <h1>', () => {
    for (const { $, file } of pages) {
      expect($('h1').length, `${file} debe tener 1 <h1>`).toBe(1);
    }
  });

  it('la jerarquía de headings no salta niveles', () => {
    for (const { $, file } of pages) {
      const levels = $('h1, h2, h3, h4, h5, h6')
        .map((_, el) => Number.parseInt(el.tagName.slice(1), 10))
        .get();
      for (let i = 1; i < levels.length; i++) {
        expect(
          levels[i]! - levels[i - 1]!,
          `${file}: salto de h${levels[i - 1]} a h${levels[i]}`,
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it('HTML semántico: un <main>, un <header>, un <footer> por página', () => {
    for (const { $, file } of pages) {
      expect($('main').length, file).toBe(1);
      expect($('header').length, file).toBe(1);
      expect($('footer').length, file).toBe(1);
    }
  });
});

describe('SEO — metadata', () => {
  it('title presente, único entre páginas y con longitud correcta', () => {
    const seen = new Map<string, string>();
    for (const { $, file } of pages) {
      const title = $('head > title').first().text().trim();
      expect(title.length, `${file}: title vacío`).toBeGreaterThan(10);
      expect(title.length, `${file}: title demasiado largo`).toBeLessThanOrEqual(65);
      const prev = seen.get(title);
      expect(prev, `title duplicado "${title}" en ${file} y ${prev}`).toBeUndefined();
      seen.set(title, file);
    }
  });

  it('meta description presente, única y con longitud 50-160', () => {
    const seen = new Map<string, string>();
    for (const { $, file } of pages) {
      const desc = $('meta[name="description"]').attr('content')?.trim() ?? '';
      expect(desc.length, `${file}: description corta o ausente`).toBeGreaterThanOrEqual(50);
      expect(desc.length, `${file}: description larga`).toBeLessThanOrEqual(160);
      const prev = seen.get(desc);
      expect(prev, `description duplicada en ${file} y ${prev}`).toBeUndefined();
      seen.set(desc, file);
    }
  });

  it('canonical autorreferencial', () => {
    for (const { $, file, route } of pages) {
      const href = $('link[rel="canonical"]').attr('href');
      expect(href, `${file}: canonical ausente`).toBeTruthy();
      const url = new URL(href!);
      expect(url.pathname, `${file}: canonical no autorreferencial`).toBe(route);
      expect(url.origin, `${file}: canonical sin dominio absoluto`).toBeTruthy();
    }
  });

  it('robots indexable en contenido; noindex solo donde corresponde', () => {
    for (const { $, file, route } of pages) {
      const robots = $('meta[name="robots"]').attr('content') ?? '';
      const shouldNoindex = route.startsWith('/buscar') || route.includes('404');
      if (shouldNoindex) {
        expect(robots, `${file} debería llevar noindex`).toContain('noindex');
      } else {
        expect(robots, `${file} no debería llevar noindex`).not.toContain('noindex');
      }
    }
  });

  it('nunca coexisten noindex y canonical a otra ruta', () => {
    for (const { $, file, route } of pages) {
      const robots = $('meta[name="robots"]').attr('content') ?? '';
      if (!robots.includes('noindex')) continue;
      const href = $('link[rel="canonical"]').attr('href');
      if (!href) continue;
      expect(new URL(href).pathname, `${file}: noindex + canonical externo`).toBe(route);
    }
  });

  it('Open Graph y Twitter card completos', () => {
    for (const { $, file } of pages) {
      for (const prop of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'og:site_name']) {
        expect($(`meta[property="${prop}"]`).attr('content'), `${file}: falta ${prop}`).toBeTruthy();
      }
      expect($('meta[name="twitter:card"]').attr('content'), `${file}: falta twitter:card`).toBeTruthy();
      expect($('meta[name="twitter:title"]').attr('content'), file).toBeTruthy();
    }
  });

  it('imágenes con alt y dimensiones', () => {
    for (const { $, file } of pages) {
      $('img').each((_, el) => {
        expect($(el).attr('alt'), `${file}: <img> sin alt`).toBeDefined();
        expect($(el).attr('width'), `${file}: <img> sin width`).toBeTruthy();
        expect($(el).attr('height'), `${file}: <img> sin height`).toBeTruthy();
      });
    }
  });
});

describe('SEO — JSON-LD', () => {
  const ajv = new Ajv({ strict: false, allErrors: true });
  const baseSchema = {
    type: 'object',
    required: ['@context', '@type'],
    properties: {
      '@context': { const: 'https://schema.org' },
      '@type': { type: ['string', 'array'] },
    },
  };
  const validate = ajv.compile(baseSchema);

  it('todo bloque JSON-LD es JSON válido y pasa el schema mínimo', () => {
    for (const { $, file } of pages) {
      const blocks = $('script[type="application/ld+json"]');
      expect(blocks.length, `${file}: sin JSON-LD`).toBeGreaterThan(0);
      blocks.each((_, el) => {
        const raw = $(el).text();
        let parsed: unknown;
        expect(() => (parsed = JSON.parse(raw))).not.toThrow();
        expect(validate(parsed), `${file}: JSON-LD inválido`).toBe(true);
      });
    }
  });

  it('@type esperado por tipo de ruta', () => {
    for (const { $, file, route } of pages) {
      const types = $('script[type="application/ld+json"]')
        .map((_, el) => JSON.parse($(el).text())['@type'])
        .get()
        .flat();
      expect(types, `${file}: falta Organization`).toContain('Organization');
      expect(types, `${file}: falta WebSite`).toContain('WebSite');
      if (route.startsWith('/blog/')) expect(types, file).toContain('BlogPosting');
      if (route.startsWith('/producto/')) expect(types, file).toContain('Product');
    }
  });

  it('el precio del JSON-LD coincide con el precio visible', () => {
    for (const { $, file, route } of pages) {
      if (!route.startsWith('/producto/')) continue;
      const jsonLd = $('script[type="application/ld+json"]')
        .map((_, el) => JSON.parse($(el).text()))
        .get()
        .find((b) => b['@type'] === 'Product');
      const offered = jsonLd?.offers?.price;
      if (!offered) continue;
      const visible = $('[data-price]').first().attr('data-price');
      expect(String(offered), `${file}: precio JSON-LD ≠ precio visible`).toBe(String(visible));
    }
  });
});

describe('SEO — enlaces internos y seguridad', () => {
  it('todos los enlaces internos apuntan a una ruta existente', () => {
    const prerendered = new Set(pages.map((p) => p.route));
    // Rutas servidas por SSR que no están en dist/ pero son válidas.
    const ssrRoutes = [/^\/producto\//, /^\/buscar/];

    for (const { $, file } of pages) {
      $('a[href^="/"]').each((_, el) => {
        const href = ($(el).attr('href') ?? '').split(/[?#]/)[0]!;
        if (href === '' || prerendered.has(href)) return;
        if (ssrRoutes.some((re) => re.test(href))) return;
        throw new Error(`${file}: enlace interno roto → ${href}`);
      });
    }
  });

  it('el HTML prerenderizado no contiene datos de sesión ni de usuario', () => {
    const forbid = [/refresh_token/i, /access_token/i, /Bearer\s/, /anonymous_id/i, /set-cookie/i];
    for (const { html, file } of pages) {
      for (const re of forbid) {
        expect(re.test(html), `${file}: contiene ${re}`).toBe(false);
      }
    }
  });

  it('ningún componente de apps/site usa ngSkipHydration', () => {
    const templates = globSync('apps/site/**/*.{html,ts}');
    for (const file of templates) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('ngSkipHydration'), `${file}: rompe la hidratación`).toBe(false);
    }
  });
});
```

### 12.3 Suite de integración: servidor

```ts
// tools/seo-check/server.spec.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';

let server: ChildProcess;
const BASE = 'http://localhost:4100';

beforeAll(async () => {
  server = spawn('node', ['dist/apps/site/server/server.mjs'], {
    env: { ...process.env, PORT: '4100' },
    stdio: 'inherit',
  });
  await waitFor(`/`, 30_000);
});

afterAll(() => server?.kill());

async function waitFor(path: string, timeoutMs: number): Promise<void> { /* polling con backoff */ }

describe('SEO — servidor', () => {
  it('/robots.txt se sirve como texto y no cae al fallback de SPA', async () => {
    const res = await fetch(`${BASE}/robots.txt`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    const body = await res.text();
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Sitemap:');
    expect(body).not.toContain('<!doctype html>');
    expect(body).toContain('Disallow: /api/');
  });

  it('/sitemap.xml es XML válido y solo incluye contenido publicado', async () => {
    const res = await fetch(`${BASE}/sitemap.xml`, { headers: { host: 'ejemplo.com' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('xml');
    const xml = await res.text();
    expect(xml).toContain('<urlset');
    // Ninguna ruta de fixture que corresponda a un DRAFT.
    for (const draftSlug of ['borrador-interno', 'sin-publicar']) {
      expect(xml, `sitemap incluye ${draftSlug}`).not.toContain(draftSlug);
    }
  });

  it('una URL inexistente devuelve HTTP 404, no 200', async () => {
    const res = await fetch(`${BASE}/esta-ruta-no-existe-${Date.now()}`);
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('noindex');
  });

  it('una URL con slug antiguo devuelve 301 al destino', async () => {
    const res = await fetch(`${BASE}/blog/slug-antiguo`, { redirect: 'manual' });
    expect([301, 308]).toContain(res.status);
    expect(res.headers.get('location')).toContain('/blog/slug-nuevo');
  });

  it('la búsqueda interna devuelve noindex, follow', async () => {
    const res = await fetch(`${BASE}/buscar?q=audifonos`);
    const html = await res.text();
    expect(html).toMatch(/<meta name="robots" content="noindex/);
  });

  it('la paginación canonicaliza a sí misma, no a la página 1', async () => {
    const res = await fetch(`${BASE}/blog?page=2`);
    const html = await res.text();
    expect(html).toMatch(/<link rel="canonical"[^>]*page=2/);
  });

  it('las respuestas públicas son cacheables y no varían por cookie', async () => {
    const res = await fetch(`${BASE}/blog`);
    const cc = res.headers.get('cache-control') ?? '';
    expect(cc).toContain('s-maxage');
    expect((res.headers.get('vary') ?? '').toLowerCase()).not.toContain('cookie');
  });
});
```

### 12.4 Presupuesto de bundle

```ts
// tools/seo-check/bundle-budget.mjs
import { readFileSync } from 'node:fs';
import { globSync } from 'glob';
import { gzipSync } from 'node:zlib';

const MAX_INITIAL_JS_KB = Number(process.env.MAX_INITIAL_JS_KB ?? 170);

// Solo el JS de entrada (no lazy): se aproxima por los scripts del index.html prerenderizado.
const indexHtml = readFileSync('dist/apps/site/browser/index.html', 'utf8');
const initialScripts = [...indexHtml.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]);

let total = 0;
for (const src of initialScripts) {
  const file = `dist/apps/site/browser${src}`;
  total += gzipSync(readFileSync(file)).length;
}
const kb = total / 1024;

if (kb > MAX_INITIAL_JS_KB) {
  console.error(`JS inicial ${kb.toFixed(1)} KB gzip > presupuesto ${MAX_INITIAL_JS_KB} KB`);
  process.exit(1);
}
console.log(`JS inicial ${kb.toFixed(1)} KB gzip — dentro del presupuesto`);
```

### 12.5 Inventario: test ↔ ítem del checklist

| Ítem del checklist | Test que lo cubre |
|---|---|
| R1 robots.txt no fallback | `server.spec` — "robots.txt se sirve como texto" |
| R2 sitemap solo publicado | `server.spec` — "sitemap.xml solo incluye publicado" |
| R3 sitemap index > 50k | unitario de `SitemapService` con fixture |
| R5 301 | `server.spec` — "slug antiguo devuelve 301" |
| R6 404 real | `server.spec` — "URL inexistente devuelve 404" |
| I1 canonical autorreferencial | `prerender.spec` — "canonical autorreferencial" |
| I2 canonical en paginación | `server.spec` — "paginación canonicaliza a sí misma" |
| I3, I4 meta robots y noindex | `prerender.spec` — "robots indexable" y `server.spec` — "búsqueda noindex" |
| I6 consolidación con 301 | test de integración del servicio de consolidación |
| M1, M2 unicidad de title/description | `prerender.spec` — "title único" y "description única" |
| M3, M4 OG y Twitter | `prerender.spec` — "Open Graph y Twitter card" |
| M5–M8 JSON-LD | `prerender.spec` — suite JSON-LD + Rich Results Test (manual) |
| E1 HTML semántico | `prerender.spec` — "un main/header/footer" |
| E2 un h1 sin saltos | `prerender.spec` — "exactamente un h1" y "jerarquía sin saltos" |
| E3 URLs limpias | unitario del normalizador de slug |
| E4 alt en imágenes | `prerender.spec` — "imágenes con alt y dimensiones" |
| E5 internal linking | `server.spec`/integración + informe de huérfanas (manual) |
| P1–P6 rendimiento | Lighthouse CI + `bundle-budget.mjs` |
| §3.6 sanitización | test unitario del sanitizador con payloads maliciosos |
| §2.4 sin datos de usuario | `prerender.spec` — "no contiene datos de sesión" |
| §7 canibalización | test de integración: dos contenidos con misma keyword disparan la puerta |

### 12.6 Regla del pipeline

El job `seo-quality` **bloquea el merge**. No es un informe: es una puerta. La razón es concreta:
los fallos de SEO técnico son silenciosos. Un canonical ausente, un `sitemap` que incluye un
borrador o un 404 que devuelve 200 no rompen la aplicación, no lanzan un error y no los ve nadie
durante semanas — hasta que se mira Search Console y el daño ya está hecho. Poner la verificación
en CI es lo que convierte la §I.3 de `architecture-review.md` ("cada ítem es un test o una
verificación en CI") en algo real en lugar de una lista de buenas intenciones.

Corolario: si un test de esta suite falla, la respuesta correcta es arreglar el sitio, no relajar
el test. Un presupuesto o un umbral solo se cambia con justificación escrita en el PR.

