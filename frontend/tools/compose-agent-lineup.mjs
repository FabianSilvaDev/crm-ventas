/**
 * Genera los sprites LPC de los agentes que no tienen uno propio.
 *
 * Usa el avatar que ya define el backend (`body`, `palette`, `hair`, `skin`,
 * `accessory`) y lo traduce a piezas de LPC:
 *
 *   - `body` a/b -> cuerpo masculino; c/d -> cuerpo musculoso.
 *   - `hair` -> estilo y color de pelo (negro, castaño, gris, violeta, rubio, pelirrojo).
 *   - `skin` -> paleta de piel (clara, oliva, marron, negra).
 *   - `palette` (departamento) -> color de la camisa.
 *   - `accessory: glasses` -> gafas; los cascos y tablets no existen en LPC y se omiten.
 *
 * Escribe una hoja por agente en `public/assets/agents/{id}@lpc.png` (9 fotogramas x
 * 4 filas) y una lamina de revision `frontend/agents-lineup.png`.
 *
 * Uso:  npm --prefix frontend run sprites:lineup
 *
 * `agt-020` (Yanca) no se toca: tiene su personaje propio en `compose-lpc-sprite.mjs`.
 *
 * Licencias: ver `public/assets/agents/CREDITS.md`.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePng } from './png.mjs';
import { BASE, compose, loadLayer } from './lpc.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const assets = resolve(here, '../public/assets/agents');
const preview = resolve(here, '../agents-lineup.png');

/**
 * Estilos de pelo. Cada uno puede aportar varias capas (la melena ondulada se dibuja
 * detras y delante del cuerpo; el recogido anade una extension).
 */
const HAIR_STYLES = {
  plain: [{ file: 'hair/plain/adult/walk.png', zPos: 120 }],
  long: [{ file: 'hair/long/adult/walk.png', zPos: 120 }],
  wavy: [
    { file: 'hair/wavy/adult/bg/walk.png', zPos: 9 },
    { file: 'hair/wavy/adult/fg/walk.png', zPos: 120 },
  ],
  topknot: [
    { file: 'hair/parted_side_bangs/adult/walk.png', zPos: 120 },
    { file: 'hair/extensions/ponytails/topknot_short/adult/walk.png', zPos: 145 },
  ],
};

/**
 * Traduccion del avatar del backend a piezas de LPC.
 * `hairStyle`/`hairColor` se derivan de `avatar.hair`; `shirt` del departamento.
 */
const LOOKS = {
  'agt-001': { body: 'male', hairStyle: 'plain', hairColor: 'black', skin: 'olive', shirt: 'yellow', pants: 'charcoal', pantsStyle: 'pants', shoes: 'black', glasses: false },
  'agt-002': { body: 'male', hairStyle: 'wavy', hairColor: 'light_brown', skin: 'light', shirt: 'teal', pants: 'gray', pantsStyle: 'pants', shoes: 'black', glasses: true },
  'agt-003': { body: 'muscular', hairStyle: 'plain', hairColor: 'gray', skin: 'brown', shirt: 'teal', pants: 'gray', pantsStyle: 'formal', shoes: 'black', glasses: false },
  'agt-004': { body: 'male', hairStyle: 'long', hairColor: 'violet', skin: 'olive', shirt: 'teal', pants: 'gray', pantsStyle: 'pants', shoes: 'black', glasses: false },
  'agt-005': { body: 'muscular', hairStyle: 'plain', hairColor: 'black', skin: 'black', shirt: 'teal', pants: 'gray', pantsStyle: 'formal', shoes: 'black', glasses: true },
  'agt-006': { body: 'male', hairStyle: 'topknot', hairColor: 'blonde', skin: 'light', shirt: 'purple', pants: 'navy', pantsStyle: 'pants', shoes: 'leather', glasses: false },
  'agt-007': { body: 'male', hairStyle: 'long', hairColor: 'redhead', skin: 'olive', shirt: 'purple', pants: 'navy', pantsStyle: 'pants', shoes: 'leather', glasses: false },
  'agt-008': { body: 'muscular', hairStyle: 'plain', hairColor: 'black', skin: 'black', shirt: 'purple', pants: 'navy', pantsStyle: 'formal', shoes: 'leather', glasses: false },
  'agt-009': { body: 'muscular', hairStyle: 'wavy', hairColor: 'light_brown', skin: 'light', shirt: 'green', pants: 'gray', pantsStyle: 'formal', shoes: 'black', glasses: true },
  'agt-010': { body: 'male', hairStyle: 'topknot', hairColor: 'blonde', skin: 'olive', shirt: 'green', pants: 'gray', pantsStyle: 'pants', shoes: 'black', glasses: false },
  'agt-011': { body: 'male', hairStyle: 'long', hairColor: 'violet', skin: 'light', shirt: 'pink', pants: 'charcoal', pantsStyle: 'pants', shoes: 'leather', glasses: false },
  'agt-012': { body: 'muscular', hairStyle: 'plain', hairColor: 'black', skin: 'olive', shirt: 'pink', pants: 'charcoal', pantsStyle: 'formal', shoes: 'leather', glasses: true },
  'agt-013': { body: 'muscular', hairStyle: 'wavy', hairColor: 'light_brown', skin: 'brown', shirt: 'orange', pants: 'brown', pantsStyle: 'formal', shoes: 'black', glasses: false },
  'agt-014': { body: 'male', hairStyle: 'plain', hairColor: 'gray', skin: 'light', shirt: 'orange', pants: 'brown', pantsStyle: 'pants', shoes: 'black', glasses: true },
  'agt-015': { body: 'male', hairStyle: 'plain', hairColor: 'black', skin: 'olive', shirt: 'green', pants: 'navy', pantsStyle: 'pants', shoes: 'black', glasses: false },
  'agt-016': { body: 'muscular', hairStyle: 'topknot', hairColor: 'blonde', skin: 'light', shirt: 'green', pants: 'navy', pantsStyle: 'formal', shoes: 'black', glasses: false },
  'agt-017': { body: 'muscular', hairStyle: 'wavy', hairColor: 'light_brown', skin: 'black', shirt: 'blue', pants: 'charcoal', pantsStyle: 'formal', shoes: 'black', glasses: true },
  'agt-018': { body: 'male', hairStyle: 'long', hairColor: 'redhead', skin: 'olive', shirt: 'blue', pants: 'charcoal', pantsStyle: 'pants', shoes: 'black', glasses: false },
  'agt-019': { body: 'male', hairStyle: 'plain', hairColor: 'gray', skin: 'light', shirt: 'blue', pants: 'charcoal', pantsStyle: 'pants', shoes: 'black', glasses: false },
};

/** Construye las capas de un agente, ordenadas por zPos. */
const layersFor = (look) => {
  const layers = [
    {
      name: 'Cuerpo',
      zPos: 10,
      file: `body/bodies/${look.body}/walk.png`,
      palette: [BASE.skin, `body.${look.skin}`],
    },
    {
      name: 'Zapatos',
      zPos: 15,
      file: 'feet/shoes/revised/male/walk.png',
      palette: [BASE.cloth, `cloth.${look.shoes}`],
    },
    {
      name: 'Pantalon',
      zPos: 20,
      file: `legs/${look.pantsStyle}/male/walk.png`,
      palette: [BASE.cloth, `cloth.${look.pants}`],
    },
    {
      // Camisa base con torso completo. El overlay `longsleeves` solo dibuja mangas
      // y cuello: sobre un cuerpo desnudo deja el torso al aire.
      name: 'Camisa',
      zPos: 35,
      file: 'torso/clothes/longsleeve/longsleeve/male/walk.png',
      palette: [BASE.cloth, `cloth.${look.shirt}`],
    },
    {
      name: 'Cabeza',
      zPos: 100,
      file: 'head/heads/human/male/walk.png',
      palette: [BASE.skin, `body.${look.skin}`],
    },
    {
      name: 'Cara',
      zPos: 101,
      file: 'head/faces/male/neutral/walk.png',
      palette: [BASE.skin, `body.${look.skin}`],
    },
    ...HAIR_STYLES[look.hairStyle].map((layer) => ({
      ...layer,
      name: `Pelo (${look.hairStyle})`,
      palette: [BASE.hair, `hair.${look.hairColor}`],
    })),
  ];

  if (look.glasses) {
    layers.push({
      name: 'Gafas',
      zPos: 115,
      file: 'facial/glasses/glasses/adult/walk.png',
      palette: null,
    });
  }

  return layers.sort((a, b) => a.zPos - b.zPos);
};

/** Lamina de revision: un fotograma de frente (fila 2) de cada agente, a 3x. */
const writeContactSheet = (sheets) => {
  const cell = 64;
  const scale = 3;
  const columns = 5;
  const rows = Math.ceil(sheets.length / columns);
  const padding = 4;
  const step = cell * scale + padding;
  const width = columns * step + padding;
  const height = rows * step + padding;
  const out = Buffer.alloc(width * height * 4, 24);

  sheets.forEach((sheet, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const originX = padding + column * step;
    const originY = padding + row * step;

    for (let y = 0; y < cell * scale; y += 1) {
      for (let x = 0; x < cell * scale; x += 1) {
        const sourceX = Math.floor(x / scale);
        const sourceY = 2 * cell + Math.floor(y / scale);
        const source = (sourceY * sheet.width + sourceX) * 4;
        const target = ((originY + y) * width + originX + x) * 4;
        const checker = (Math.floor(x / 12) + Math.floor(y / 12)) % 2 === 0 ? 32 : 40;

        if (sheet.pixels[source + 3] === 0) {
          out[target] = checker;
          out[target + 1] = checker + 4;
          out[target + 2] = checker + 8;
        } else {
          out[target] = sheet.pixels[source];
          out[target + 1] = sheet.pixels[source + 1];
          out[target + 2] = sheet.pixels[source + 2];
        }
        out[target + 3] = 255;
      }
    }
  });

  writePng(preview, width, height, out);
};

const main = async () => {
  const ids = Object.keys(LOOKS);
  console.log(`Componiendo ${ids.length} agentes con piezas de LPC...\n`);

  const sheets = [];

  for (const id of ids) {
    const look = LOOKS[id];
    const layers = [];

    for (const layer of layersFor(look)) {
      layers.push(await loadLayer(layer));
    }

    const sheet = compose(layers);
    if (sheet.width !== 576 || sheet.height !== 256) {
      throw new Error(`${id}: se esperaba una hoja de 576x256 y salio ${sheet.width}x${sheet.height}`);
    }

    writePng(resolve(assets, `${id}@lpc.png`), sheet.width, sheet.height, sheet.pixels);
    sheets.push(sheet);

    console.log(
      `  ${id} · ${look.body.padEnd(8)} · pelo ${look.hairStyle}/${look.hairColor} · camisa ${look.shirt} · ${look.glasses ? 'gafas' : 'sin gafas'}`,
    );
  }

  writeContactSheet(sheets);

  console.log(`\n${ids.length} hojas escritas en ${assets}`);
  console.log(`Lamina de revision: ${preview}`);
  console.log('\nAhora ejecuta `npm --prefix frontend run sprites:sync` para registrarlas.');
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

