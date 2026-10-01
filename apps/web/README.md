# `@crm/web` — CRM interno (SPA Angular)

Aplicación de uso interno. **No indexable** (`noindex, nofollow`) y, cuando exista, detrás de
autenticación. Ver ADR-002 y `docs/seo.md` §"apps/web".

Es distinta de `apps/site`, que es el sitio público SSR/prerenderizado. Comparten el paquete de
contratos (`@crm/contracts`) y nada más: son dos objetivos de build con públicos opuestos.

| | `apps/web` | `apps/site` |
|---|---|---|
| Público | Empleados | Visitantes / buscadores |
| Render | CSR | SSR + prerender |
| SEO | `noindex, nofollow` | optimizado |

## Arrancar en desarrollo

Hace falta el API en `:3000`. En dos terminales:

```bash
# terminal 1 — API
corepack pnpm --filter @crm/api dev

# terminal 2 — UI
corepack pnpm --filter @crm/web start
```

`ng serve` usa `proxy.conf.json` para reenviar `/health` y `/api` a `http://localhost:3000`. Por
eso la app **no** necesita CORS en desarrollo ni lleva una URL de API embebida en el bundle: el
mismo código sirve en desarrollo y en producción, donde el proxy lo hace el servidor web. El
detalle está comentado en `proxy.conf.json`.

Si el puerto 4200 está ocupado: `ng serve --port 4210`.

## Comandos

```bash
corepack pnpm --filter @crm/web start        # servidor de desarrollo
corepack pnpm --filter @crm/web build        # build de producción → dist/web
corepack pnpm --filter @crm/web test         # tests, una sola pasada (vitest + jsdom)
corepack pnpm --filter @crm/web test:watch   # tests en watch, para trabajar
corepack pnpm --filter @crm/web typecheck    # comprobación de tipos → dist/typecheck
```

`typecheck` es un build de desarrollo, no un `tsc --noEmit`: las plantillas de Angular solo se
comprueban de verdad al compilarlas, así que un `tsc` suelto daría un falso "todo bien" en los
`.html`. Escribe en `dist/typecheck` **a propósito**, para no pisar el bundle de producción de
`dist/web`.

`test` corre una sola pasada (como `vitest run` en los otros paquetes) porque `pnpm -r test` lo
invoca desde la raíz: en modo watch, ese comando no terminaría nunca. Para trabajar, `test:watch`.

## Notas que no se ven en el código

- **Angular 22 es zoneless.** No hay `zone.js`. Todo estado que deba refrescar la vista tiene que
  ser `signal()` o `computed()`; una propiedad normal asignada dentro de un `await` no repinta
  nada. Ver el comentario de `src/app/app.config.ts`.
- **Los imports relativos van sin extensión** (resolución `bundler`), al contrario que en
  `apps/api`, donde el `moduleResolution: node16` de Node obliga a poner `.js`. La diferencia es
  deliberada y está explicada en `src/app/app.routes.ts`.
- **`tsconfig.json` es independiente**: no extiende `tsconfig.base.json` ni aparece en las
  `references` del `tsconfig.json` raíz. Angular necesita `module: preserve` y `target: ES2022`,
  que chocan con lo que usa el backend. Ver ADR-021.
- **Estilos:** los valores viven en `src/styles/tokens.css` y las primitivas compartidas en
  `src/styles/components.css`. Ningún componente escribe un color a mano. El porqué, en
  `docs/design-system.md`.

## Estructura

```
src/
  styles/
    tokens.css        ← fuente única de color, espaciado y tipografía
    components.css    ← primitivas compartidas (tarjeta, estado, aviso, problem+json…)
  app/
    core/             ← servicios de acceso al API
    features/         ← una carpeta por pantalla
    nav-items.ts      ← las 14 etapas del flujo; `path: null` = todavía no existe
    app.ts/.html/.css ← shell: navegación + área de trabajo
```

Más contexto: `docs/design-system.md`, `docs/architecture.md`, `docs/decisions.md`.
