# Manual de uso

Cómo se instala, se arranca y se opera este proyecto. Estado: **Hito 1 (Cimientos), Sprint 1**.
Lo que todavía no existe está listado en §9 — leer esa sección antes de buscar una pantalla que no
está.

Autoridad: cuando este manual y el código discrepen, manda el código. Si la discrepancia es real,
el manual es lo que hay que corregir.

---

## 1. Qué hay hoy, en una frase

Un backend NestJS con sondas de salud, errores `problem+json` y **el webhook de Meta Lead Ads**
(handshake, firma HMAC, rate limit y cliente de Graph API), un paquete de contratos compartido, y una
interfaz Angular con dos pantallas: el estado del sistema y **los leads**.

**Lo que no hay que dar por hecho:** el webhook **no guarda nada**. No hay base de datos, así que
`{received:true}` significa «el sobre pasó todas las puertas», no «hay un lead nuevo». La pantalla de
leads lo dice en vez de inventar filas, y el motivo está en §9.

---

## 2. Requisitos

| Herramienta | Versión | Nota |
|---|---|---|
| Node.js | **≥ 22** (aquí v24.19.0) | `engines` del `package.json` raíz |
| pnpm | **12.8.1** | **Solo vía `corepack`**. Ver abajo |

### pnpm: siempre `corepack pnpm`, nunca `pnpm` a secas

En esta máquina `corepack enable` falla con **EPERM**, así que `pnpm` **no está en el `PATH`**.
Escribir `pnpm install` da "no se reconoce el comando". La forma correcta siempre es:

```powershell
corepack pnpm install
```

Los scripts del repo ya invocan `corepack pnpm` internamente, así que **no hay que pensarlo**: usa
`corepack pnpm <script>` desde la raíz y el resto se encadena solo.

---

## 3. Puesta en marcha (solo la primera vez)

```powershell
# 1. Dependencias de los 4 paquetes del workspace
corepack pnpm install

# 2. Comprobar que todo compila y que los tests pasan
corepack pnpm build
corepack pnpm test
```

Eso compila y pasa los tests, pero **el API todavía no arranca**: desde que el webhook de Meta
existe, hay variables **obligatorias** sin valor por defecto, y es a propósito.

```powershell
# 3. Copiar el entorno de ejemplo y rellenar los dos secretos locales
Copy-Item .env.example .env
#    META_APP_SECRET     → cualquier cadena de 16+ caracteres (firma del webhook)
#    META_VERIFY_TOKEN   → cualquier cadena (handshake de verificación)
```

Los valores pueden ser inventados: son **solo para local**, y sin ellos el API no arranca
precisamente para que nadie despliegue con un secreto de mentira. `.env` está en `.gitignore` y
**nunca se commitea**.

El `.env` se busca en la **raíz del monorepo** (junto a `.env.example`), no en `apps/api`. El
entorno real del proceso tiene prioridad sobre el fichero, así que en un despliegue mandan las
variables de la plataforma.

| Variable | Por defecto | Para qué |
|---|---|---|
| `NODE_ENV` | `development` | Entorno |
| `PORT` | `3000` | Puerto del API |
| `LOG_LEVEL` | `info` | `fatal`…`trace` |
| `WEB_ORIGIN` | `http://localhost:4200` | **Origen exacto** permitido por CORS |
| `META_APP_SECRET` | **obligatoria** (mín. 16) | Firma HMAC del webhook de Meta |
| `META_VERIFY_TOKEN` | **obligatoria** | Token del handshake `GET /webhooks/meta` |
| `META_ACCESS_TOKEN` | *(sin valor)* | Token de Graph API. **Solo** si `META_GRAPH_MODE=live` |
| `META_GRAPH_MODE` | `fixture` | `live` = Graph API real; `fixture` = datos de prueba locales |
| `META_GRAPH_API_VERSION` | `v21.0` | Versión de Graph API |
| `META_GRAPH_TIMEOUT_MS` | `3000` | Timeout de la llamada a Graph API |
| `PUBLIC_RATE_LIMIT_PER_MINUTE` | `120` | Límite por IP en el webhook |
| `DATABASE_URL` | *(sin valor)* | Opcional hoy: Prisma no está instalado |
| `REDIS_URL` | *(sin valor)* | Opcional hoy: BullMQ no está instalado |

`META_GRAPH_MODE` vale `fixture` por defecto a propósito: un clon recién hecho debe poder arrancar
**sin credenciales**. En `production` el arranque **falla** si vale `fixture`, así que ese valor no
puede llegar a un despliegue real.

Si una variable está mal escrita, **el API no arranca** y lista todos los errores juntos. Es
deliberado: mejor fallar en el arranque que en la primera petición de un usuario.

---

## 4. Uso diario

Hacen falta **dos terminales**: el API y la interfaz son dos procesos.

**Terminal 1 — API** (escucha en `http://localhost:3000`)

```powershell
corepack pnpm dev
```

**Terminal 2 — interfaz** (por defecto `http://localhost:4200`)

```powershell
corepack pnpm --filter @crm/web start
```

Si el **4200 está ocupado** (le pasa a menudo si tienes otro proyecto abierto):

```powershell
corepack pnpm --filter @crm/web exec ng serve --port 4210
```

> Cambiar el puerto de la UI **no** rompe nada, ni siquiera CORS. La UI no llama al API
> directamente: el servidor de desarrollo reenvía `/health` y `/api` a `http://localhost:3000`
> (`apps/web/proxy.conf.json`). Desde el navegador todo es del mismo origen, así que el puerto es
> irrelevante y las cookies de sesión del futuro login también funcionarán sin tocar nada.

### Comandos, todos desde la raíz

| Comando | Qué hace |
|---|---|
| `corepack pnpm dev` | API en modo desarrollo, con recarga al guardar |
| `corepack pnpm start` | API compilada, sin recarga (como en producción). **Requiere `build` antes**: ejecuta `node dist/main.js` y no compila por su cuenta |
| `corepack pnpm build` | Compila `contracts` y `api` (`tsc -b`) |
| `corepack pnpm test` | Tests de los 3 paquetes |
| `corepack pnpm typecheck` | Comprueba tipos en los 3 paquetes |
| `corepack pnpm clean` | Borra los artefactos de compilación |

> `pnpm test` va en serie (`--workspace-concurrency=1`) por un motivo medido, no por gusto: lanzando
> los tres paquetes a la vez, cada uno levanta su propia pool de workers de vitest y la máquina se
> queda sin recursos —el síntoma es `Timeout waiting for worker to respond` en tests que pasan
> perfectamente en solitario—. Serializado tarda ~2 minutos y **siempre** da el mismo resultado. Un
> comando de verificación que a veces falla no sirve como verificación.

### Comandos de la interfaz

| Comando | Qué hace |
|---|---|
| `corepack pnpm --filter @crm/web start` | Servidor de desarrollo |
| `corepack pnpm --filter @crm/web build` | Build de producción → `apps/web/dist/web` |
| `corepack pnpm --filter @crm/web test` | Tests, una sola pasada |
| `corepack pnpm --filter @crm/web test:watch` | Tests en watch, para trabajar |
| `corepack pnpm --filter @crm/web typecheck` | Compila a `dist/typecheck` (ver §7) |

---

## 5. La interfaz

### Navegación

La barra lateral tiene las **14 etapas del flujo** (nicho → investigación → … → analítica). Hoy
**dos** tienen pantalla: **«Leads»** y **«Estado del sistema»**. Las otras doce están marcadas
«pendiente».

Una etapa pendiente **no es un enlace**: es texto. Es intencionado — un enlace que no lleva a
ninguna parte es peor que un texto honesto, porque el usuario deja de fiarse del menú entero.

«Estado del sistema» vive en su propio grupo «Sistema» justo debajo de las etapas porque **no es una
etapa del ciclo comercial**. En pantallas estrechas (<900 px) la navegación se oculta y aparece un
botón «Menú» en la barra superior.

### Leads

La primera pantalla de negocio. Muestra una tabla con los leads que devuelve `GET /api/v1/leads`.

**Hoy la tabla estará vacía, y la pantalla lo explica.** El endpoint todavía no existe: el API
responde `404 RESOURCE_NOT_FOUND` y la pantalla lo traduce a un aviso —«el listado aún no está
implementado»— en vez de a un «error 404» que parecería una avería. **No se inventan filas**: una
tabla de mentira en un CRM es peor que una tabla vacía, porque alguien podría actuar sobre ella.

**Qué muestra cada fila cuando haya datos:** nombre, contacto, estado, canal de origen, si hay
consentimiento registrado, cuándo entró y si ya se le respondió.

**El botón de WhatsApp.** Abre `wa.me` con un mensaje ya escrito. Tres cosas que conviene saber y que
la propia pantalla declara:

- **Abre WhatsApp; no envía nada y no confirma que se envió.** Si el mensaje sale, es porque alguien
  le dio a enviar. Por eso la pantalla dice «se abrió el contacto», no «el cliente respondió».
- **El texto viaja en la URL**, así que queda en el historial del navegador. Por eso lleva **solo el
  nombre de pila**: nada de apellidos, email ni teléfono, que ya están en la ficha.
- **Sin teléfono no hay botón, y se explica por qué.** El teléfono tiene que estar en formato
  **E.164** (`+573001234567`). Con un número sin código de país, `wa.me` **no falla**: abre WhatsApp
  apuntando a otra persona. Por eso se exige el formato en vez de adivinar.

**La marca de consentimiento.** Un lead sin consentimiento registrado sale como «Sin registro» y se
marca que su marketing está **bloqueado**. Es la regla de `docs/security.md` §10.7: la ausencia de
evidencia no es evidencia de permiso. Un lead de Meta que no traiga un disclaimer verificable se
creará con `granted:false` —se crea, porque el consentimiento sí se pudo recoger aunque no se pueda
leer— pero no se le podrá enviar marketing.

### Estado del sistema

Hace dos consultas reales a tu API y las muestra sin adornos.

**Dos tarjetas:**

| Tarjeta | Endpoint | Qué responde |
|---|---|---|
| Proceso del API | `/health/live` | ¿Está el proceso en pie? |
| Capacidad de atender tráfico | `/health/ready` | ¿Podemos atender peticiones? |

Cada una muestra latencia, código HTTP y el `traceId`.

**Los cuatro estados:**

| Estado | Color | Significa |
|---|---|---|
| Responde / Listo | Verde | Todo correcto |
| No listo | Ámbar | El API responde pero una dependencia falla (**HTTP 503**) |
| No responde / Sin respuesta | Rojo | El API no contestó, o contestó con un error del contrato |
| Comprobando | Gris | Consulta en curso |

**El aviso ámbar que verás ahora mismo.** Si el API responde `{"status":"ok","checks":[]}`, lo verás.
**No es un fallo.** Significa que el API está en pie pero **no tiene ninguna dependencia que
comprobar** todavía, porque Prisma y Redis entran en el Hito 2. Un «Listo» verde sin ese aviso
afirmaría que Postgres funciona, y eso sería mentira. Desaparecerá solo cuando el API registre su
primer indicador de readiness.

**Distinción importante:** «el API no responde» (rojo, sin respuesta HTTP — proceso caído o puerto
equivocado) es distinto de «el API devolvió un error» (rojo, con `problem+json`, que muestra el
`code`, el HTTP y el `detail`). Son problemas diferentes con arreglos diferentes, y la pantalla no
los mezcla.

Al pie, la pantalla declara **de dónde salen sus datos** (todo real, medido en tu navegador). Es el
estándar para el resto del CRM: real / estimado / inferido por IA, siempre etiquetado.

---

## 6. Diagnóstico

### Sondas desde la terminal

```powershell
# ¿Está el proceso en pie?
Invoke-WebRequest http://localhost:3000/health/live -UseBasicParsing

# ¿Podemos atender tráfico? (503 si una dependencia falla)
Invoke-WebRequest http://localhost:3000/health/ready -UseBasicParsing
```

**`-UseBasicParsing` no es opcional** en PowerShell: sin él, `Invoke-WebRequest` intenta usar el
motor antiguo de Internet Explorer y falla con un error que no tiene nada que ver.

### El `traceId`

**Toda** respuesta del API lleva la cabecera `X-Trace-Id` (32 caracteres hexadecimales).

```powershell
(Invoke-WebRequest http://localhost:3000/health/ready -UseBasicParsing).Headers['X-Trace-Id']
```

Es la pieza que une la pantalla con el servidor: copia el `traceId` que muestra la interfaz y
búscalo en los logs del API. Ese es el procedimiento para investigar cualquier error que el usuario
vea en pantalla.

### Rutas que existen

| Ruta | Estado |
|---|---|
| `GET /health/live` | ✅ |
| `GET /health/ready` | ✅ |
| `GET /metrics` | ❌ No existe todavía |
| `/api/v1/*` (negocio) | ❌ El prefijo está puesto, sin rutas todavía |

`/health/*` está **fuera** de `/api/v1` a propósito: son rutas de infraestructura, no de negocio, y
no se versionan.

---

## 7. Problemas conocidos y su causa real

Estos ya han pasado. Si vuelven, el diagnóstico está aquí.

**`ERR_PNPM_IGNORED_BUILDS` y el install falla (exit 1)**
Una dependencia con script de instalación (`esbuild`, `lmdb`, `@parcel/watcher`…) no está aprobada.
No basta con que `node_modules` se pueble: pnpm devuelve error igualmente. La causa está comentada
en `pnpm-workspace.yaml`. Se aprueba añadiendo la clave al mapa **`allowBuilds`** — y **nunca**
usando `onlyBuiltDependencies`, que pnpm 11 eliminó y **se ignora en silencio** aunque
`pnpm config get` lo devuelva.

**`EADDRINUSE :::3000` al arrancar el API**
Ya hay un API corriendo. Es lo más habitual de todo: mira si tienes la otra terminal abierta. Para
ver quién ocupa un puerto:
```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen
```

**`Port 4200 is already in use`**
Otro proyecto tuyo está en ese puerto. Usa `--port 4210` (§4). **No** hace falta tocar `WEB_ORIGIN`.

**`typecheck` de la UI escribe en `dist/typecheck`, no en `dist/web`**
Es deliberado. Compilar para comprobar tipos **no** debe dejar un bundle de desarrollo donde el
build de producción escribe su salida. Antes lo hacía, y un `typecheck` después de un `build` dejaba
en `dist/web` algo desplegable que no era la versión optimizada.

**`corepack pnpm test` no termina nunca**
No debería pasar: `test` es siempre una pasada y `--watch` está solo en `test:watch`. Si vuelve a
pasar, alguien quitó el `--watch=false` del script de `apps/web`.

---

## 8. Reglas al escribir código

Cinco cosas que **no** se ven en el código y que rompen de formas confusas si se ignoran.

**1. Angular 22 es *zoneless*.** No hay `zone.js`. Todo estado que deba refrescar la vista tiene que
ser `signal()` o `computed()`. Una propiedad normal asignada dentro de un `await` **no repinta
nada** — y no da ningún error, simplemente la pantalla no se actualiza.

**2. Las extensiones de los imports son distintas a propósito.**

| | Import relativo | Por qué |
|---|---|---|
| `apps/api`, `packages/*` | `./errors.js` ← **con `.js`** | `moduleResolution: node16`, lo exige Node |
| `apps/web` | `./health` ← **sin extensión** | Resolución `bundler`, lo pone el build de Angular |

Copiar un import de un lado al otro da un error que no explica la causa.

**3. El `tsconfig.json` de `apps/web` es independiente.** No extiende `tsconfig.base.json` y **no**
aparece en las `references` del `tsconfig.json` raíz. Si lo añades, el build del backend empieza a
fallar. Motivo: Angular necesita `module: preserve` y `target: ES2022`, que chocan con el backend.

**4. La versión de TypeScript está fijada con `~`.** Estamos en **6.0.3** porque Angular 22 exige
`>=6.0 <6.1`. Subir a 6.1 rompería la interfaz **sin que nada avise en el backend**. Leer
`docs/decisions.md` ADR-021 antes de tocarla.

**5. Ningún valor visual a mano.** Ni `#hex`, ni `padding: 12px`, ni `font-family` en el CSS de un
componente. Los valores viven en `apps/web/src/styles/tokens.css` y las primitivas compartidas en
`apps/web/src/styles/components.css`. La prueba para decidir dónde va un estilo: **¿lo va a necesitar
una segunda pantalla?** Ver `docs/design-system.md`.

**Nunca commitear secretos.** `.env` está en `.gitignore`. Si añades una variable, añádela también a
`.env.example` (sin el valor real).

---

## 9. Lo que todavía NO existe

Listado explícito, para que no se busque.

| No existe | Cuándo |
|---|---|
| Base de datos, Prisma, migraciones | Hito 2. **Es la puerta que bloquea todo lo demás** |
| Persistencia de un lead: el webhook recibe y valida, pero **no guarda nada** | Hito 2 |
| `GET /api/v1/leads`: el API responde `404`, no una lista | Hito 2. La pantalla de leads lo dice en vez de inventar filas |
| Colas BullMQ y el worker | Hito 2 |
| Autenticación y sesiones | Hito 2 |
| El resto de rutas de negocio (`/api/v1/*`) | Hitos siguientes. Solo existen `/health/*` y el webhook de Meta |
| **Las 14 etapas del flujo** | Hitos siguientes. Solo «Leads» y «Estado del sistema» tienen pantalla |
| `apps/site` (el sitio público) | Hito 1, pendiente |
| Observabilidad: logs estructurados, OpenTelemetry, `/metrics` | Hito 1, pendiente |
| ESLint | Hito 1, pendiente |
| CI (con detección de deriva de contratos) | Hito 1, pendiente |
| Redis / rate limit compartido | Hito 2. Hoy el límite es **en memoria y por proceso**: el despliegue multi-réplica está bloqueado hasta que exista |
| Outbox transaccional (invariante I12) | Cuando exista el primer consumidor de eventos. Es deuda registrada con fecha, no un olvido |
| `touchpoints` / atribución por clic | Cuando exista `campaigns`. Un lead de Meta no tiene `anonymous_id`, así que no puede crear un touchpoint |
| Agentes de IA, campañas, anuncios, WhatsApp | Fases posteriores |

El **worker** está decidido (ADR-001/003) pero no arrancado: hoy solo hay un proceso, el API.

### Lo que sí existe y **se puede probar hoy**: el webhook de Meta

Sin cuenta de Meta, sin túnel y sin base de datos. El *handshake* es el que Meta hará de verdad:

```powershell
corepack pnpm dev    # terminal 1

# Terminal 2 — el handshake (sustituye el token por el de tu .env)
$t = (Select-String -Path .env -Pattern '^META_VERIFY_TOKEN=(.*)$').Matches.Groups[1].Value
Invoke-WebRequest "http://localhost:3000/api/v1/webhooks/meta?hub.mode=subscribe&hub.verify_token=$t&hub.challenge=1234567890" -UseBasicParsing
# → 200, text/plain, cuerpo exactamente: 1234567890
```

Y el camino completo de una entrega, firmando con el mismo HMAC que verifica el servidor:

```powershell
corepack pnpm --filter @crm/api build        # el script importa dist/
node apps/api/scripts/send-signed-webhook.mjs               # 200 {received:true}
node apps/api/scripts/send-signed-webhook.mjs --tamper      # 401 (firma un cuerpo y envía otro)
node apps/api/scripts/send-signed-webhook.mjs --unsigned    # 401
node apps/api/scripts/send-signed-webhook.mjs --other-object # 200 {ignored:true}
```

`--tamper` es el más útil de los cuatro: si devolviera `200`, significaría que la firma no está
verificando nada.

**Lo que eso NO prueba:** que Meta acepte el endpoint (eso depende de la revisión de la app), ni que
haya un lead guardado. `{received:true}` significa «el sobre pasó todas las puertas».

---

## 10. Dónde está cada cosa

| Fichero | Contenido |
|---|---|
| `README.md` | Estado del proyecto y stack |
| `docs/architecture.md` | Arquitectura: módulos, capas, dependencias |
| `docs/decisions.md` | **ADRs: la autoridad.** El porqué de cada decisión |
| `docs/api.md` | Contrato HTTP y catálogo de errores |
| `docs/design-system.md` | Tokens, reglas de UI, accesibilidad |
| `docs/security.md` | Seguridad y §48 (qué no puede hacer una IA) |
| `docs/deployment.md` | Despliegue, entornos, CI/CD |
| `docs/roadmap.md` | Hitos y fases |
| `apps/web/README.md` | Detalles específicos de la interfaz |

```
apps/
  api/         NestJS — sondas de salud, problem+json, validación de entorno, webhook de Meta
    scripts/   Scripts de desarrollo (no se compilan ni entran en dist/)
  web/         Angular 22 — CRM interno (SPA, noindex): «Leads» y «Estado del sistema»
packages/
  contracts/   Zod + tipos compartidos. Lo usan el API y la web
```

**Regla de dependencias:** `apps/*` puede depender de `packages/*`, nunca al revés.
