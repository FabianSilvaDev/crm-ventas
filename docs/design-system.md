# Sistema de diseño de `apps/web`

Referencia de la interfaz del CRM interno. La decisión arquitectónica está en **ADR-022**; este
documento es el detalle: qué tokens existen, qué reglas hay que cumplir y cómo se añade una pantalla.

Alcance: **`apps/web`**. `apps/site` (el sitio público) podrá reutilizar los tokens que le sirvan,
pero no hereda estas reglas: su público y su objetivo son otros.

---

## 1. Dónde vive cada cosa

Tres capas. Cada una tiene un dueño y un motivo.

```
apps/web/src/
  styles/
    tokens.css       ← VALORES. Custom properties. Fuente única de verdad.
    components.css   ← PRIMITIVAS compartidas entre pantallas.
  app/features/*/**.css  ← LAYOUT propio de una pantalla. Nada más.
```

**La prueba para decidir dónde va un estilo:** *¿lo va a necesitar una segunda pantalla?*
Si la respuesta es «sí» o «probablemente», va en `components.css`. Si es exclusivo de una pantalla,
se queda en el componente.

Por qué importa: Angular encapsula los estilos de cada componente. Un `.status` declarado dentro de
`features/system-status/` **no existe** para la pantalla siguiente, así que habría que volver a
escribirlo — y a la tercera copia ya habría tres versiones distintas del mismo verde.

> Este no es un principio abstracto: se descubrió porque el build avisó de que un CSS de componente
> superaba el presupuesto de 4 kB. La causa era que las primitivas estaban en el sitio equivocado.

---

## 2. Reglas que el código hace cumplir

Seis reglas. Ninguna es negociable sin cambiar ADR-022.

| # | Regla | Cómo se comprueba |
|---|---|---|
| 1 | **Ningún valor literal.** Sin `#hex`, sin `padding: 12px`, sin `font-family` suelta. | Revisión: un componente con un `#` en su CSS ha empezado a divergir |
| 2 | **Contraste ≥ 4.5:1** para texto sobre su fondo. | Anotado valor por valor en `tokens.css` |
| 3 | **El color nunca comunica solo.** Siempre color + texto. | Un estado sin palabra dentro es invisible para ≈8 % de los hombres |
| 4 | **Foco visible siempre.** `:focus-visible` global, nunca `outline: none` sin sustituto. | `styles.css` |
| 5 | **Movimiento desactivable.** Todo respeta `prefers-reduced-motion`. | `styles.css` |
| 6 | **La navegación por teclado llega a todo,** y hay enlace «Saltar al contenido». | `app.html` |

---

## 3. Tokens

Fuente: `src/styles/tokens.css`. Esta tabla se actualiza cuando cambie el archivo; si discrepan,
manda el archivo.

### Color — superficies

| Token | Valor | Uso |
|---|---|---|
| `--c-bg` / `--color-background` | `#fafafa` | Fondo de la aplicación |
| `--c-surface` / `--color-surface` | `#ffffff` | Tarjetas, barras |
| `--c-surface-sunken` / `--color-surface-sunken` | `#f3f4f6` | Zonas hundidas |
| `--c-border` / `--color-border` | `#e5e7eb` | Bordes normales |
| `--c-border-strong` / `--color-border-strong` | `#d1d5db` | Bordes que deben verse (controles) |

### Color — texto

| Token | Valor | Contraste sobre `--c-surface` |
|---|---|---|
| `--c-text` / `--color-text` | `#111827` | **18.7:1** |
| `--c-text-muted` / `--color-text-secondary` | `#4b5563` | **7.6:1** |
| `--c-text-faint` / `--color-text-tertiary` | `#6b7280` | **5.7:1** |

### Color — navegación

| Token | Valor | Nota |
|---|---|---|
| `--c-nav-bg` | `#ffffff` | Barra superior clara |
| `--c-nav-text` | `#4b5563` | **7.6:1** sobre `--c-nav-bg` |
| `--c-nav-text-active` | `#111827` | Elemento activo |
| `--c-nav-active-bg` | `#eef2ff` | Fondo del elemento activo |
| `--c-nav-active-indicator` | `#4f46e5` | Indicador activo |
| `--c-nav-heading` | `#6b7280` | Etiquetas de grupo. **Decorativas**: siempre acompañan a texto |

### Color — acento

| Token | Valor | Uso |
|---|---|---|
| `--c-accent` / `--color-primary` | `#4f46e5` | Acción principal, marca |
| `--c-accent-hover` / `--color-primary-hover` | `#4338ca` | Estado hover |
| `--c-accent-soft` / `--color-primary-soft` | `#eef2ff` | Fondo teñido |
| `--c-accent-ring` / `--color-primary-ring` | `rgba(79, 70, 229, .35)` | Anillo de foco alternativo |
| `--c-accent-bright` / `--color-primary-bright` | `#dbe4ff` | Foco sobre fondo de marca |
| `--c-text-on-brand` / `--color-text-on-primary` | `#ffffff` | Texto sobre fondo de marca (contraste 6.6:1) |

### Color — estados

Cada estado tiene **tres** tokens: `-bg`, `-fg`, `-border`. El estado nunca se usa con color suelto.

| Estado | `-bg` | `-fg` | `-border` |
|---|---|---|---|
| `--c-ok-*` / `--color-success-*` | `#dcfce7` | `#166534` | `#86efac` |
| `--color-success` | — | `#16a34a` | — |
| `--color-success-soft` | `#dcfce7` | — | — |
| `--c-bad-*` / `--color-danger-*` | `#fee2e2` | `#991b1b` | `#fca5a5` |
| `--c-warn-*` / `--color-warning-*` | `#fef3c7` | `#92400e` | `#fde68a` |
| `--c-idle-*` / `--color-neutral-*` | `#f3f4f6` | `#4b5563` | `#e5e7eb` |
| `--color-info-*` | `#eff6ff` | `#1e40af` | `#bfdbfe` |

### Espaciado — escala de 4

`--s-1`/`--space-1` 4px · `--s-2`/`--space-2` 8px · `--s-3`/`--space-3` 12px · `--s-4`/`--space-4` 16px · `--s-5`/`--space-5` 24px · `--s-6`/`--space-6` 32px · `--s-7`/`--space-7` 48px · `--s-8`/`--space-8` 64px

**Un valor intermedio es un error**, no una decisión de diseño. Si 16px no basta y 24px sobra, el
problema suele estar en el layout, no en la escala.

### Tipografía

```css
--font-sans: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
--font-mono: ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', Consolas, monospace;
```

Tamaños: `--fs-xs`/`--text-xs` 12 · `--fs-sm`/`--text-sm` 14 · `--fs-base`/`--text-base` 16 · `--fs-lg`/`--text-lg` 18 · `--fs-xl`/`--text-xl` 20 · `--fs-2xl`/`--text-2xl` 24 · `--fs-3xl`/`--text-3xl` 30 · `--fs-4xl`/`--text-4xl` 36 · `--text-5xl` 48
Interlineado: `--lh-tight` 1.25 (títulos) · `--lh-base` 1.5 (texto) · `--lh-display` 1.15 (números grandes)

**Pila del sistema, no webfont.** Cero peticiones de red en el arranque, cero FOUT, funciona sin
conexión. Para una herramienta interna, una webfont añade un punto de fallo externo a cambio de una
ganancia estética que nadie ha pedido (§48: nada ajeno en la ruta crítica). Los nuevos componentes
`ui/*` usan `--font-sans` con este stack; si en el futuro se decide cargar Inter, el cambio es en
un solo token.

### Radios, sombras y layout

`--r-sm`/`--radius-sm` 6px · `--r-md`/`--radius-md` 10px · `--r-lg`/`--radius-lg` 16px · `--r-xl`/`--radius-xl` 24px · `--r-2xl`/`--radius-2xl` 32px · `--r-pill`/`--radius-pill` 999px · `--r-circle`/`--radius-circle` 50%
`--shadow-sm` · `--shadow-md` · `--shadow-lg` · `--shadow-xl`
`--nav-width` 264px · `--topbar-height` 64px · `--bottom-nav-height` 64px · `--t-fast` 120ms ease · `--t-base` 200ms ease
`--duration-fast` 120ms · `--duration-base` 200ms · `--duration-slow` 300ms · `--ease-out` · `--ease-in-out`

---

## 4. Primitivas disponibles

Todas en `src/styles/components.css`. Son **globales** (sin encapsular), así que funcionan en
cualquier componente sin importar nada.

| Clase | Qué es | Variantes |
|---|---|---|
| `.btn` | Botón | `.btn--ghost` |
| `.card` + `.card__head` + `.card__title` | Tarjeta con cabecera | — |
| `.status` + `.status__dot` | Píldora de estado. **Siempre lleva texto dentro** | `.status--ok`, `--bad`, `--warn`, `--idle` |
| `.tag` | Etiqueta pequeña en mayúsculas | `.tag--real`, `.tag--none`, `.tag--warn` |
| `.kv` + `.kv__row` | Lista clave/valor (`<dl>`) | — |
| `.note` | Aviso en línea, dentro del flujo | `.note--warn`, `.note--info` |
| `.alert` | Alerta de fallo, separada del contenido | `.alert--bad` |
| `.problem` + `__title` `__meta` `__detail` | Render de `problem+json` (RFC 9457) | — |
| `.section-head` + `.section-title` + `.section-note` | Cabecera de sección con icono, título y nota | `.section-title--solo`, `.section-title--sm` |
| `.sales__stage` | Tarjeta numerada de etapa de pipeline | — |
| `.opportunity-card__next` | Caja de próxima acción dentro de una oportunidad | — |
| `.customer-card__health` | Insignia de salud de cliente con color + texto | `--good`, `--at-risk`, `--churned` |
| `.follow-up-list__item` | Fila de seguimiento con icono, asunto y fecha | — |
| `.metric-grid` | Grid de 2–4 métricas | — |
| `.dashboard-grid` | Grid de 1–3 tarjetas de trabajo | — |
| `.attention-card` + `__inner` + `__body` + `__title` | Alerta de atención con borde lateral | `:has(.badge--warning)` |
| `.work-card__head` + `.work-card__title` + `.work-link` | Cabecera de tarjeta de trabajo activo | — |
| `.lead-list` + `__item` `__avatar` `__name` `__meta` | Lista compacta de leads | — |
| `.label` | Etiqueta uppercase de campo | — |
| `.muted` | Texto secundario neutral | — |
| `.origin-box` + `__title` `__list` `__item` | Origen de datos con fondo diferenciado | — |
| `.settings-card` + `__head` `__identity` `__title` `__status` `__actions` | Tarjeta de sección de configuración | `.settings-card__status--active` |
| `.visually-hidden` | Solo para lectores de pantalla | — |
| `code`, `.mono` | Texto técnico | — |

### Por qué `.problem` es una primitiva y no algo de cada pantalla

**Todo** error del API llega con la misma forma (`ProblemDetails` de `@crm/contracts`): `title`,
`code`, `status`, `detail`, `traceId`. Presentarlo de una sola manera significa que el `traceId`
—lo único que permite cruzar la pantalla con los logs del servidor— aparece siempre en el mismo
sitio. Si cada pantalla lo pintara a su gusto, en la mitad de ellas no estaría.

---

## 5. Cómo se añade una pantalla

1. Comprobar si lo que necesitas ya existe en `components.css`. Casi siempre sí.
2. Si falta un **valor** (color, medida), añadirlo a `tokens.css` y a la tabla de §3 de este
   documento. Nunca escribirlo en el componente.
3. Si falta una **primitiva** que va a usar más de una pantalla, añadirla a `components.css` con su
   comentario explicando por qué es compartida.
4. Solo el layout propio —rejillas, tamaños máximos, distribución— se queda en el CSS del componente.
5. Enlazarla desde `src/app/nav-items.ts`. **Mientras no exista, `path` va en `null`**: la navegación
   la muestra como texto marcado «pendiente», nunca como un enlace que no lleva a ninguna parte.
6. Si muestra datos, decir en pantalla **de dónde salen** (ver §6).

---

## 6. Datos: real, estimado o inferido

§3 del prompt inicial exige no inventar métricas. En la interfaz eso se traduce en una obligación:
**si una pantalla muestra un número, tiene que poder decir de dónde viene.**

| Marca | Significado |
|---|---|
| <kbd>Real</kbd> | Medido. Una respuesta HTTP, un dato de la base, un evento registrado |
| <kbd>Estimado</kbd> | Proyección calculada. Se dice el método y el periodo |
| <kbd>IA</kbd> | Inferencia de un modelo. Nunca se presenta como un hecho |

`Estado del sistema` es el ejemplo de referencia: declara explícitamente que todo lo que muestra es
dato real, y distingue «el proceso está en pie» de «las dependencias funcionan». Cuando el API
devuelve `checks: []`, la pantalla **dice que el verde no está respaldado por nada** en vez de
mostrar un «Listo» que el usuario leería como «Postgres funciona».

Ese matiz es el estándar: **una interfaz que no puede verificar algo no debe afirmarlo.**

---

## 7. Lo que deliberadamente NO hay

- **Tailwind.** Ver ADR-022.
- **Biblioteca de componentes con estilos** (Material, PrimeNG). Se usa **CDK** para comportamiento
  (overlay, a11y, portal, virtual scroll) y el aspecto es propio.
- **Modo oscuro.** `color-scheme: light` está fijado. Añadirlo es un cambio de tokens, no de
  componentes: llegará cuando se pida, no antes.
- **Animaciones.** Solo transiciones de 120 ms. `prefers-reduced-motion` las desactiva.
- **Fuentes e iconos externos.** Ver §3.
