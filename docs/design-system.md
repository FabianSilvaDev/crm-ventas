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
| `--c-bg` | `#f4f6f8` | Fondo de la aplicación |
| `--c-surface` | `#ffffff` | Tarjetas, barras |
| `--c-surface-sunken` | `#eef1f5` | Zonas hundidas |
| `--c-border` | `#dde3ea` | Bordes normales |
| `--c-border-strong` | `#c3ccd6` | Bordes que deben verse (controles) |

### Color — texto

| Token | Valor | Contraste sobre `--c-surface` |
|---|---|---|
| `--c-text` | `#131a22` | **17.3:1** |
| `--c-text-muted` | `#5a6675` | **5.5:1** |
| `--c-text-faint` | `#67717d` | **4.8:1** — el mínimo permitido |

### Color — navegación

| Token | Valor | Nota |
|---|---|---|
| `--c-nav-bg` | `#151d26` | Barra oscura, para separarla del área de trabajo |
| `--c-nav-text` | `#aab6c3` | **8.3:1** sobre `--c-nav-bg` |
| `--c-nav-text-active` | `#ffffff` | Elemento activo |
| `--c-nav-active-bg` | `#1f2a36` | Fondo del elemento activo |
| `--c-nav-heading` | `#6f7d8c` | Etiquetas de grupo. **Decorativas**: siempre acompañan a texto |

### Color — acento

| Token | Valor | Uso |
|---|---|---|
| `--c-accent` | `#0d7267` | Acción principal, marca |
| `--c-accent-hover` | `#0a5b52` | Estado hover |
| `--c-accent-soft` | `#e6f2f0` | Fondo teñido |
| `--c-accent-ring` | `rgba(13,114,103,.35)` | Anillo de foco alternativo |

### Color — estados

Cada estado tiene **tres** tokens: `-bg`, `-fg`, `-border`. El estado nunca se usa con color suelto.

| Estado | `-bg` | `-fg` | `-border` |
|---|---|---|---|
| `--c-ok-*` | `#e9f7ee` | `#14663a` | `#b7e0c6` |
| `--c-bad-*` | `#fdeceb` | `#a5211b` | `#f3c3c0` |
| `--c-warn-*` | `#fdf5e6` | `#8a5a12` | `#eeddb5` |
| `--c-idle-*` | `#f0f2f5` | `#5a6675` | `#dde3ea` |

### Espaciado — escala de 4

`--s-1` 4px · `--s-2` 8px · `--s-3` 12px · `--s-4` 16px · `--s-5` 24px · `--s-6` 32px · `--s-7` 48px

**Un valor intermedio es un error**, no una decisión de diseño. Si 16px no basta y 24px sobra, el
problema suele estar en el layout, no en la escala.

### Tipografía

```css
--font-sans: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
--font-mono: ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', Consolas, monospace;
```

Tamaños: `--fs-xs` 12 · `--fs-sm` 13 · `--fs-base` 14 · `--fs-lg` 16 · `--fs-xl` 20 · `--fs-2xl` 26
Interlineado: `--lh-tight` 1.25 (títulos) · `--lh-base` 1.5 (texto)

**Pila del sistema, no webfont.** Cero peticiones de red en el arranque, cero FOUT, funciona sin
conexión. Para una herramienta interna, una webfont añade un punto de fallo externo a cambio de una
ganancia estética que nadie ha pedido (§48: nada ajeno en la ruta crítica).

### Radios, sombras y layout

`--r-sm` 6px · `--r-md` 10px · `--r-lg` 14px · `--r-pill` 999px
`--shadow-sm` · `--shadow-md`
`--nav-width` 264px · `--topbar-height` 56px · `--t-fast` 120ms ease

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
