#!/usr/bin/env node
/**
 * Prueba el webhook de Meta **de punta a punta y sin cuenta de Meta**.
 *
 * Firma un payload con el mismo HMAC que verifica el servidor y lo envía al API local. Es la única
 * forma de recorrer el camino completo —cabecera, cuerpo crudo, guard, validación del sobre,
 * respuesta— antes de tener app de Meta, túnel y permiso `leads_retrieval`.
 *
 * ## Lo que este script prueba y lo que no
 *
 * - **Prueba** que la firma se verifica sobre el **cuerpo crudo**, que el sobre se valida, que el
 *   rate limit se aplica y que se responde `200` como exige `docs/api.md` §8.4.
 * - **No prueba** que Meta nos acepte el endpoint: eso depende del handshake contra sus servidores,
 *   y de la revisión de la app. Un script que firma con nuestro secreto no dice nada sobre Meta.
 * - **No crea un lead.** La ingesta todavía no persiste: no hay base de datos. La respuesta
 *   `{received:true}` significa «el sobre pasó todas las puertas», no «hay un lead guardado».
 *
 * ## Por qué `.mjs` y no `.ts`
 *
 * Los scripts se ejecutan con `node` sin compilar, y `engines` declara Node `>=22.0.0`. El
 * *type stripping* de TypeScript está activado por defecto a partir de **23.6**: un script `.ts`
 * fallaría en la versión mínima que el propio proyecto declara soportar. Además, este script
 * **importa el código compilado** (`dist/`), así que no necesita tipos: usa exactamente la función
 * que corre en producción.
 *
 * ## Uso
 *
 *     corepack pnpm --filter @crm/api build      # el script importa dist/
 *     corepack pnpm --filter @crm/api dev         # en otra terminal
 *     node apps/api/scripts/send-signed-webhook.mjs
 *
 * Opciones:
 *
 *     --url <url>          destino (por defecto http://localhost:$PORT/api/v1/webhooks/meta)
 *     --leadgen-id <id>    id del lead simulado (por defecto uno generado con la hora)
 *     --tamper             firma un cuerpo y envía **otro**: debe responder 401
 *     --unsigned           envía sin cabecera de firma: debe responder 401
 *     --other-object       sobre de Instagram en vez de `page`: debe responder 200 {ignored:true}
 *     --repeat <n>         envía n veces el mismo payload: la deduplicación se verá cuando haya DB
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// Rutas: se resuelven respecto a este archivo, no al directorio de trabajo.
// ─────────────────────────────────────────────────────────────────────────────

const DIST_SIGNATURE = new URL('../dist/webhooks/meta/meta-signature.js', import.meta.url);
const DIST_ENV_FILE = new URL('../dist/config/env-file.js', import.meta.url);

// ─────────────────────────────────────────────────────────────────────────────
// Argumentos
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

/** Busca `--nombre valor` y devuelve el valor, o `undefined`. */
function opcion(nombre) {
  const i = args.indexOf(nombre);
  return i === -1 ? undefined : args[i + 1];
}

const banderas = new Set(args.filter((a) => a.startsWith('--')).map((a) => a.split('=')[0]));

if (banderas.has('--help') || banderas.has('-h')) {
  console.log(
    [
      'Uso: node apps/api/scripts/send-signed-webhook.mjs [opciones]',
      '',
      '  --url <url>        destino del POST',
      '  --leadgen-id <id>  id del lead simulado',
      '  --tamper           firma un cuerpo y envía otro (debe dar 401)',
      '  --unsigned         sin cabecera de firma (debe dar 401)',
      '  --other-object     sobre de Instagram (debe dar 200 ignored)',
      '  --repeat <n>       envía n veces el mismo payload',
    ].join('\n'),
  );
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Comprobaciones previas, con mensajes que digan qué hacer
// ─────────────────────────────────────────────────────────────────────────────

for (const [ruta, arreglo] of [
  [DIST_SIGNATURE, 'corepack pnpm --filter @crm/api build'],
  [DIST_ENV_FILE, 'corepack pnpm --filter @crm/api build'],
]) {
  if (!existsSync(ruta)) {
    console.error(`No existe el código compilado «${fileURLToPath(ruta)}».`);
    console.error(`Ejecuta primero:  ${arreglo}`);
    process.exit(1);
  }
}

// El servidor carga el `.env` con este mismo módulo, así que aquí se lee igual que él: si el script
// y el servidor leyeran de sitios distintos, un test verde no probaría nada sobre el servidor.
const { loadEnvFileIfPresent } = await import(DIST_ENV_FILE.href);
const rutaEnv = loadEnvFileIfPresent();
console.log(rutaEnv === undefined ? 'Sin .env: se usa el entorno del proceso.' : `Entorno: ${rutaEnv}`);

const { computeMetaSignature, META_SIGNATURE_HEADER } = await import(DIST_SIGNATURE.href);

const appSecret = process.env.META_APP_SECRET;
if (appSecret === undefined || appSecret.length === 0) {
  // Nunca se imprime el valor. Solo se dice qué falta y dónde ponerlo.
  console.error('Falta META_APP_SECRET. Defínelo en el .env de la raíz (copia .env.example).');
  process.exit(1);
}

const puerto = process.env.PORT ?? '3000';
const url = opcion('--url') ?? `http://localhost:${puerto}/api/v1/webhooks/meta`;
const leadgenId = opcion('--leadgen-id') ?? `lead-de-prueba-${Date.now()}`;
const repeticiones = Number.parseInt(opcion('--repeat') ?? '1', 10);

// ─────────────────────────────────────────────────────────────────────────────
// Payload con la forma del sobre de Meta
// ─────────────────────────────────────────────────────────────────────────────

/** Un sobre como el que Meta envía. Lleva campos de más a propósito: el contrato es `loose`. */
function sobre(object = 'page', id = leadgenId) {
  return {
    object,
    entry: [
      {
        id: '102290129340398',
        time: Math.floor(Date.now() / 1000),
        changes: [
          {
            field: 'leadgen',
            value: {
              leadgen_id: id,
              page_id: '102290129340398',
              form_id: '123456789012345',
              ad_id: '987654321098765',
              adset_id: '111222333444555',
              campaign_id: '666777888999000',
              created_time: Math.floor(Date.now() / 1000),
              // Campo que el contrato ignora: un `strictObject` habría dado 422 por esto.
              campo_que_meta_añadirá_algún_día: 'ignorado',
            },
          },
        ],
      },
    ],
  };
}

const cuerpoFeliz = JSON.stringify(sobre());

// Se decide primero **qué se envía** y después **qué se firma**, porque los dos solo coinciden
// cuando la petición es legítima. Ese es justo el punto de `--tamper`.
let cuerpoEnviado = cuerpoFeliz;

if (banderas.has('--other-object')) {
  cuerpoEnviado = JSON.stringify(sobre('instagram'));
}

if (banderas.has('--tamper')) {
  // Un solo carácter distinto: el `leadgen_id`. Es el caso real —un proxy o un tercero modifica el
  // cuerpo al pasar— y el que demuestra que el servidor verifica lo que **recibió**.
  //
  // Ojo: la primera versión de este script firmaba y enviaba el mismo cuerpo en modo `--tamper`, así
  // que devolvía 200 y no probaba nada. Un caso de prueba que no puede fallar no vale nada.
  cuerpoEnviado = JSON.stringify(sobre('page', `${leadgenId}-manipulado`));
}

// ─────────────────────────────────────────────────────────────────────────────
// Firma
// ─────────────────────────────────────────────────────────────────────────────

let cabeceras = { 'content-type': 'application/json' };

if (!banderas.has('--unsigned')) {
  const cuerpoFirmado = banderas.has('--tamper') ? cuerpoFeliz : cuerpoEnviado;
  const firma = computeMetaSignature(Buffer.from(cuerpoFirmado, 'utf8'), appSecret);

  cabeceras = { ...cabeceras, [META_SIGNATURE_HEADER]: firma };

  // La firma **nunca** es secreta (viaja en cada petición de Meta), pero se trunca en la salida para
  // no llenar la consola. El `appSecret` no se imprime jamás.
  console.log(`Firma: ${firma.slice(0, 21)}… (${firma.length} caracteres)`);
}

if (banderas.has('--tamper')) {
  console.log('Modo --tamper: el cuerpo enviado NO es el que se firmó. Se espera 401.');
}
if (banderas.has('--unsigned')) {
  console.log('Modo --unsigned: sin cabecera de firma. Se espera 401.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Envío
// ─────────────────────────────────────────────────────────────────────────────

console.log(`POST ${url}`);
console.log(`leadgen_id: ${leadgenId}`);

let ultimoEstado = null;
let ultimoCuerpo = '';

for (let i = 1; i <= repeticiones; i += 1) {
  const etiqueta = repeticiones > 1 ? ` [${i}/${repeticiones}]` : '';

  try {
    const respuesta = await fetch(url, { method: 'POST', headers: cabeceras, body: cuerpoEnviado });
    const texto = await respuesta.text();

    ultimoEstado = respuesta.status;
    ultimoCuerpo = texto;
    console.log(`${etiqueta} → ${respuesta.status} ${respuesta.statusText}`);
    console.log(`${etiqueta} ← ${texto}`);

    const traceId = respuesta.headers.get('x-trace-id');
    if (traceId !== null) {
      console.log(`${etiqueta}   X-Trace-Id: ${traceId}`);
    }
  } catch (error) {
    // `fetch` lanza cuando no hubo respuesta: el API no está arrancado, o el puerto no es el 3000.
    console.error(`\nNo hubo respuesta de ${url}.`);
    console.error(`¿Está el API en marcha?  corepack pnpm dev`);
    console.error(`Causa: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Qué significa lo que se ha visto
// ─────────────────────────────────────────────────────────────────────────────

const significados = {
  200: 'El sobre pasó firma, validación y rate limit.',
  401: 'Firma rechazada: el servidor verifica el cuerpo CRUDO, no el parseado.',
  403: 'No es un 403 esperable en POST; ¿apuntas al handshake (GET) por error?',
  422: 'El sobre no cumple el contrato: falta `leadgen_id` o `entry` no es un array.',
  429: 'Rate limit por IP superado (PUBLIC_RATE_LIMIT_PER_MINUTE).',
  503: 'Una dependencia no está disponible.',
};

// El 200 tiene tres significados distintos y decirlos igual sería engañoso: `ignored` significa que
// el sobre era válido pero **no contenía un lead**, así que no se procesó nada. Es lo correcto
// (`docs/api.md` §8.4 prohíbe el 4xx aquí), pero no es «todo bien».
if (ultimoEstado === 200 && ultimoCuerpo.includes('"ignored":true')) {
  console.log('Sobre firmado y válido, pero sin eventos de `leadgen`: no había nada que procesar.');
  console.log('Es el comportamiento correcto para un sobre de otra superficie (Instagram, WhatsApp).');
} else if (ultimoEstado === 200 && ultimoCuerpo.includes('"duplicate":true')) {
  console.log('Ese `leadgen_id` ya estaba registrado. No es un error: el emisor reintenta.');
} else {
  const explicacion = significados[ultimoEstado];
  console.log(
    explicacion === undefined ? `Estado ${ultimoEstado}: sin explicación registrada.` : explicacion,
  );
}

if (repeticiones > 1) {
  console.log(
    'Nota: la deduplicación (200 {duplicate:true}) necesita base de datos y todavía no existe; ' +
      'hoy todas las repeticiones se aceptan como nuevas.',
  );
}

console.log(
  'Nota: {received:true} no significa que haya un lead guardado. La ingesta real espera a la base de datos.',
);
