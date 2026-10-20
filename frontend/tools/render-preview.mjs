/**
 * Previsualizacion de sprites a PNG (herramienta de desarrollo).
 *
 * Convierte las matrices de pixeles a una imagen PNG para poder mirarlas sin abrir un
 * navegador. Lee los sprites y la paleta del propio codigo fuente, de modo que lo que se
 * ve aqui es exactamente lo que dibuja la aplicacion: si la paleta cambia en
 * `pixel-art.ts`, la previsualizacion cambia con ella.
 *
 * Uso:  node tools/render-preview.mjs [salida.png]
 *
 * Escribe el PNG a la ruta indicada (por defecto `sprites-preview.png` en la raiz del
 * proyecto) e imprime el orden de las piezas dibujadas.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const spritesPath = resolve(here, '../src/app/shared/pixel/agent-sprites.ts');
const palettePath = resolve(here, '../src/app/shared/pixel/pixel-art.ts');
const outputPath = resolve(here, process.argv[2] ?? '../sprites-preview.png');

const spriteSource = readFileSync(spritesPath, 'utf8');
const paletteSource = readFileSync(palettePath, 'utf8');

// --- Lectura de la paleta real del codigo -----------------------------------

/** Extrae las entradas `clave: '#hex'` del bloque de un objeto exportado. */
const hexMap = (source, exportName) => {
  const block = source.match(new RegExp(`export const ${exportName}[^=]*= \\{([\\s\\S]*?)\\n\\};`));
  if (!block) throw new Error(`No se ha encontrado ${exportName} en el codigo fuente.`);

  const entries = {};
  for (const match of block[1].matchAll(/([A-Za-z_][\w]*)\s*:\s*'([^']+)'/g)) entries[match[1]] = match[2];
  return entries;
};

/** Extrae los pares `base`/`shade` o `base`/`dark` de un objeto de tonos. */
const toneMap = (source, exportName) => {
  const block = source.match(new RegExp(`export const ${exportName}[^=]*= \\{([\\s\\S]*?)\\n\\};`));
  if (!block) throw new Error(`No se ha encontrado ${exportName} en el codigo fuente.`);

  const entries = {};
  for (const match of block[1].matchAll(/([A-Za-z_][\w]*)\s*:\s*\{\s*base:\s*'([^']+)',\s*(?:shade|dark):\s*'([^']+)'/g)) {
    entries[match[1]] = { base: match[2], shade: match[3] };
  }
  return entries;
};

const BASE_TOKENS = hexMap(paletteSource, 'BASE_TOKENS');
const HAIR_COLORS = hexMap(paletteSource, 'HAIR_COLORS');
const SKIN_TONES = toneMap(paletteSource, 'SKIN_TONES');
const ACCENT_COLORS = toneMap(paletteSource, 'ACCENT_COLORS');

/** Oscurece un color hexadecimal; replica `shadeHex` de `pixel-art.ts`. */
const shadeHex = (hex, factor) => {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) =>
    Math.max(0, Math.min(255, Math.round(channel * factor))),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
};

/** Paleta final de un tema; replica `resolvePalette` de `pixel-art.ts`. */
const resolvePalette = (theme = {}) => {
  const accent = ACCENT_COLORS[theme.accent] ?? ACCENT_COLORS.cyan;
  const skin = SKIN_TONES[theme.skin] ?? SKIN_TONES.medium;
  const hair = HAIR_COLORS[theme.hair] ?? HAIR_COLORS.dark;

  return {
    ...BASE_TOKENS,
    A: accent.base,
    a: accent.dark,
    s: skin.base,
    d: skin.shade,
    e: shadeHex(skin.shade, 0.86),
    h: hair,
    j: shadeHex(hair, 0.62),
  };
};

// --- Lectura de las matrices ----------------------------------------------

const matrices = (() => {
  const found = new Map();
  const patterns = [
    /(?:const\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*:\s*PixelMatrix\s*=\s*\[\s*((?:\s*'[^']*'\s*,?\s*)+)\]/g,
    /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\[\s*((?:\s*'[^']*'\s*,?\s*)+)\]/g,
  ];

  for (const pattern of patterns) {
    for (const match of spriteSource.matchAll(pattern)) {
      if (found.has(match[1])) continue;
      const rows = [...match[2].matchAll(/'([^']*)'/g)].map((row) => row[1]);
      if (rows.length > 0) found.set(match[1], rows);
    }
  }

  return found;
})();

const overlay = (base, layer) => {
  const height = Math.max(base.length, layer.length);
  const width = Math.max(...[...base, ...layer].map((row) => row.length));

  return Array.from({ length: height }, (_, y) => {
    const baseRow = base[y] ?? '';
    const layerRow = layer[y] ?? '';
    let result = '';
    for (let x = 0; x < width; x += 1) {
      const layerToken = layerRow[x] ?? '.';
      result += layerToken === '.' ? (baseRow[x] ?? '.') : layerToken;
    }
    return result;
  });
};

const HAIR_BY_KEY = {
  dark: 'HAIR_SHORT',
  brown: 'HAIR_WAVES',
  blond: 'HAIR_TIED',
  red: 'HAIR_LONG',
  gray: 'HAIR_SHORT',
  violet: 'HAIR_LONG',
};

const ACCESSORY_BY_KEY = {
  glasses: 'ACCESSORY_GLASSES',
  headset: 'ACCESSORY_HEADSET',
  tablet: 'ACCESSORY_TABLET',
  mug: 'ACCESSORY_MUG',
  none: null,
};

const buildAgent = (avatar) => {
  const body = ['c', 'd'].includes(avatar.body) ? 'BODY_BROAD' : 'BODY_SLIM';
  const withHair = overlay(matrices.get(body), matrices.get(HAIR_BY_KEY[avatar.hair]));
  const accessory = ACCESSORY_BY_KEY[avatar.accessory];
  return accessory ? overlay(withHair, matrices.get(accessory)) : withHair;
};

// --- Lienzo y dibujo -------------------------------------------------------

const createCanvas = (width, height, background = '#101820') => ({
  width,
  height,
  pixels: Buffer.alloc(width * height * 4),
  fillColor: background,
  /** Pinta un pixel con un color hexadecimal. */
  set(x, y, hex) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const value = Number.parseInt(hex.replace('#', ''), 16);
    const offset = (y * this.width + x) * 4;
    this.pixels[offset] = (value >> 16) & 255;
    this.pixels[offset + 1] = (value >> 8) & 255;
    this.pixels[offset + 2] = value & 255;
    this.pixels[offset + 3] = 255;
  },
  /** Dibuja una matriz de pixeles escalada. */
  drawMatrix(rows, palette, originX, originY, scale = 1) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        const color = palette[row[x] ?? '.'];
        if (!color) continue;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            this.set(originX + x * scale + dx, originY + y * scale + dy, color);
          }
        }
      }
    });
  },
});

// --- Codificacion PNG ------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = (buffer) => {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
};

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
};

const encodePng = (canvas) => {
  const stride = canvas.width * 4;
  const raw = Buffer.alloc((stride + 1) * canvas.height);

  for (let y = 0; y < canvas.height; y += 1) {
    raw[y * (stride + 1)] = 0; // sin filtro
    canvas.pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(canvas.width, 0);
  header.writeUInt32BE(canvas.height, 4);
  header[8] = 8; // bits por canal
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

// --- Composicion de la lamina ---------------------------------------------

const AGENT_SCALE = 7;
const AGENT_W = 24 * AGENT_SCALE;
const AGENT_H = 32 * AGENT_SCALE;
const FURNITURE_SCALE = 3;

const AGENTS = [
  { body: 'a', hair: 'dark', accessory: 'glasses', skin: 'light', accent: 'cyan', note: 'slim + corto + gafas' },
  { body: 'a', hair: 'brown', accessory: 'headset', skin: 'medium', accent: 'amber', note: 'slim + ondulado + auriculares' },
  { body: 'c', hair: 'red', accessory: 'tablet', skin: 'dark', accent: 'violet', note: 'ancho + melena + tablet' },
  { body: 'c', hair: 'blond', accessory: 'mug', skin: 'deep', accent: 'green', note: 'ancho + recogido + taza' },
  { body: 'a', hair: 'violet', accessory: 'none', skin: 'light', accent: 'pink', note: 'slim + melena + sin accesorio' },
  { body: 'c', hair: 'gray', accessory: 'none', skin: 'medium', accent: 'blue', note: 'ancho + corto + sin accesorio' },
];

const FURNITURE = ['monitor', 'chair', 'plant', 'watercooler', 'sofa', 'table', 'shelf', 'printer', 'whiteboard', 'server', 'coffee'];

const gap = 10;
const margin = 14;
const furnitureWidths = FURNITURE.map((name) => matrices.get(name)[0].length * FURNITURE_SCALE);
const furnitureRowWidth = furnitureWidths.reduce((total, width) => total + width + gap, 0) - gap;

const width = margin * 2 + Math.max(AGENTS.length * (AGENT_W + gap) - gap, furnitureRowWidth);
const agentsHeight = AGENT_H;
const furnitureHeight = 32 * FURNITURE_SCALE;
const height = margin + agentsHeight + 24 + furnitureHeight + margin;

const canvas = createCanvas(width, height);

// Fondo con una rejilla tenue, para poder medir a ojo.
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const isGrid = x % 16 === 0 || y % 16 === 0;
    canvas.set(x, y, isGrid ? '#1b2530' : '#101820');
  }
}

console.log(`Lamina de ${width}x${height} px (agentes x${AGENT_SCALE}, muebles x${FURNITURE_SCALE})\n`);
console.log('Agentes (de izquierda a derecha):');

AGENTS.forEach((avatar, index) => {
  const palette = resolvePalette({ accent: avatar.accent, skin: avatar.skin, hair: avatar.hair });
  const sprite = buildAgent(avatar);
  const x = margin + index * (AGENT_W + gap);
  canvas.drawMatrix(sprite, palette, x, margin, AGENT_SCALE);

  // Linea de suelo bajo cada personaje, para comprobar que los pies estan alineados.
  for (let dx = 0; dx < AGENT_W; dx += 1) canvas.set(x + dx, margin + AGENT_H + 4, '#2e4050');

  console.log(`  ${index + 1}. ${avatar.note} (acento ${avatar.accent}, piel ${avatar.skin})`);
});

console.log('\nMuebles (de izquierda a derecha):');
let furnitureX = margin;
const furnitureY = margin + agentsHeight + 24;

FURNITURE.forEach((name, index) => {
  const sprite = matrices.get(name);
  canvas.drawMatrix(sprite, resolvePalette({ accent: 'cyan' }), furnitureX, furnitureY, FURNITURE_SCALE);
  console.log(`  ${index + 1}. ${name} (${sprite[0].length}x${sprite.length})`);
  furnitureX += furnitureWidths[index] + gap;
});

writeFileSync(outputPath, encodePng(canvas));
console.log(`\nPNG escrito en ${outputPath}`);

// --- Lamina 2: planta de una sala ------------------------------------------
//
// Lee las medidas y los anclajes del modulo de sala y los pinta como un plano, para
// comprobar de un vistazo que los puestos y las areas no se solapan ni se salen.

const roomSource = readFileSync(resolve(here, '../src/app/features/virtual-office/pixel/office-room.ts'), 'utf8');
const number = (name) => Number((roomSource.match(new RegExp(`export const ${name} = (\\d+)`)) ?? [])[1]);
const ROOM_WIDTH = number('ROOM_WIDTH');
const ROOM_HEIGHT = number('ROOM_HEIGHT');
const WALL_HEIGHT = number('WALL_HEIGHT');

const cubicleBlock = roomSource.match(/const CUBICLES = \[([\s\S]*?)\n\];/)[1];
const CUBICLES = [...cubicleBlock.matchAll(/x:\s*(\d+),\s*y:\s*(\d+)/g)].map((match) => ({
  x: Number(match[1]),
  y: Number(match[2]),
}));

const loungeBlock = roomSource.match(/const LOUNGE = \{([^}]+)\}/)[1];
const LOUNGE = {
  x: number(''), // se sustituye abajo
};
for (const [, key, value] of loungeBlock.matchAll(/(\w+):\s*(\d+)/g)) LOUNGE[key] = Number(value);

const CUBICLE_WIDTH = 128;
const CUBICLE_HEIGHT = 96;
const planScale = 1.6;
const planWidth = Math.round(ROOM_WIDTH * planScale);
const planHeight = Math.round(ROOM_HEIGHT * planScale);

const plan = createCanvas(planWidth, planHeight, '#0a0e13');
const rect = (x, y, w, h, color) => {
  for (let dy = 0; dy < Math.round(h * planScale); dy += 1) {
    for (let dx = 0; dx < Math.round(w * planScale); dx += 1) {
      plan.set(Math.round(x * planScale) + dx, Math.round(y * planScale) + dy, color);
    }
  }
};

rect(0, 0, ROOM_WIDTH, ROOM_HEIGHT, '#1d2a37');
rect(0, WALL_HEIGHT, ROOM_WIDTH, ROOM_HEIGHT - WALL_HEIGHT, '#16202b');
rect(LOUNGE.x, LOUNGE.y, LOUNGE.width, LOUNGE.height, '#24333f');

CUBICLES.forEach((cubicle, index) => {
  rect(cubicle.x, cubicle.y + 30, CUBICLE_WIDTH, 10, '#3d5568');
  rect(cubicle.x - 6, cubicle.y + 30, 6, 74, '#3d5568');
  rect(cubicle.x, cubicle.y + 72, CUBICLE_WIDTH, 26, '#5b432c');
  rect(cubicle.x + 10, cubicle.y + 18, 48, 64, '#4fd6ff');
  rect(cubicle.x + 66, cubicle.y + 56, 30, 20, '#8fa7b8');
  console.log(`  puesto ${index + 1}: origen (${cubicle.x}, ${cubicle.y}) · agente en (${cubicle.x + 10}, ${cubicle.y + 18})`);
});

writeFileSync(resolve(here, '../office-plan.png'), encodePng(plan));
console.log(`\nPlano de sala ${ROOM_WIDTH}x${ROOM_HEIGHT} (pared ${WALL_HEIGHT} px, ${CUBICLES.length} puestos)`);
console.log(`  zona de descanso: x ${LOUNGE.x}..${LOUNGE.x + LOUNGE.width}, y ${LOUNGE.y}..${LOUNGE.y + LOUNGE.height}`);
console.log(`  los puestos llegan hasta y=${Math.max(...CUBICLES.map((c) => c.y + CUBICLE_HEIGHT))} y la sala mide ${ROOM_HEIGHT}`);
console.log(`  PNG del plano escrito en ${resolve(here, '../office-plan.png')}`);
void CUBICLE_HEIGHT;
