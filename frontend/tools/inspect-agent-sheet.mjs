/**
 * Inspector de hojas de sprites (herramienta de desarrollo).
 *
 * Lee un PNG, lo decodifica y dice:
 *  - el tamano de la hoja y cuantas celdas tiene;
 *  - cuantas celdas de cada fila tienen contenido (para saber que animaciones trae);
 *  - el recuadro de pixeles no transparentes de cada frame de una fila;
 *  - y escribe un PNG con esa fila ampliada, para poder mirarla.
 *
 * Uso:  node tools/inspect-agent-sheet.mjs <fichero.png> [fila]
 *
 * Acepta PNG de 8 bits por canal, sin entrelazar, en RGBA (colorType 6), RGB (2) o
 * paleta indexada (3), que es lo que exportan el generador de LPC y los editores de
 * pixel art.
 */
import { basename, resolve } from 'node:path';
import { readPng, writePng } from './png.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Uso: node tools/inspect-agent-sheet.mjs <fichero.png> [fila]');
  process.exit(1);
}

const path = resolve(file);

let width = 0;
let height = 0;
let pixels = Buffer.alloc(0);

try {
  ({ width, height, pixels } = readPng(path));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const alphaAt = (x, y) => pixels[(y * width + x) * 4 + 3];

// --- Analisis por celdas ---------------------------------------------------

const cell = 64;
const columns = Math.ceil(width / cell);
const rows = Math.ceil(height / cell);

console.log(`${basename(path)} · ${width}x${height} px · ${columns} columnas x ${rows} filas de ${cell}px\n`);

const rowOccupancy = [];
for (let row = 0; row < rows; row += 1) {
  let occupied = 0;
  let total = 0;

  for (let column = 0; column < columns; column += 1) {
    let count = 0;
    for (let y = row * cell; y < Math.min((row + 1) * cell, height); y += 1) {
      for (let x = column * cell; x < Math.min((column + 1) * cell, width); x += 1) {
        if (alphaAt(x, y) > 0) count += 1;
      }
    }
    if (count > 0) occupied += 1;
    total += count;
  }

  rowOccupancy.push({ row, occupied, total });
  if (total > 0) console.log(`  fila ${String(row).padStart(2)}: ${occupied}/${columns} celdas con contenido (${total} px opacos)`);
}

const emptyRows = rowOccupancy.filter((entry) => entry.total === 0).map((entry) => entry.row);
if (emptyRows.length > 0) console.log(`  filas vacias: ${emptyRows.join(', ')}`);

// --- Recuadros de la fila pedida -------------------------------------------

const requestedRow = process.argv[3] === undefined ? null : Number(process.argv[3]);
const inspectRow = requestedRow ?? rowOccupancy.find((entry) => entry.occupied > 1)?.row ?? 0;

console.log(`\nFila inspeccionada: ${inspectRow}`);

const boxes = [];
for (let column = 0; column < columns; column += 1) {
  let minX = cell;
  let minY = cell;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < cell; y += 1) {
    for (let x = 0; x < cell; x += 1) {
      const px = column * cell + x;
      const py = inspectRow * cell + y;
      if (px >= width || py >= height || alphaAt(px, py) === 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  boxes.push(minX > maxX ? null : { minX, minY, maxX, maxY });
}

console.log(
  boxes
    .map((box, column) =>
      box ? `  frame ${column}: x ${box.minX}..${box.maxX}, y ${box.minY}..${box.maxY} (${box.maxX - box.minX + 1}x${box.maxY - box.minY + 1})` : `  frame ${column}: vacio`,
    )
    .join('\n'),
);

const union = boxes.filter(Boolean).reduce(
  (acc, box) => ({
    minX: Math.min(acc.minX, box.minX),
    minY: Math.min(acc.minY, box.minY),
    maxX: Math.max(acc.maxX, box.maxX),
    maxY: Math.max(acc.maxY, box.maxY),
  }),
  { minX: cell, minY: cell, maxX: -1, maxY: -1 },
);

if (union.maxX >= 0) {
  console.log(`\n  caja comun: ${union.maxX - union.minX + 1}x${union.maxY - union.minY + 1} px`);
  console.log(`  desplazamiento respecto a la celda: izquierda ${union.minX}, abajo ${cell - 1 - union.maxY}`);
}

// --- Colores reales de la fila (para detectar hojas sin colorear) ----------

const colorCounts = new Map();
for (let column = 0; column < columns; column += 1) {
  for (let y = 0; y < cell; y += 1) {
    for (let x = 0; x < cell; x += 1) {
      const px = column * cell + x;
      const py = inspectRow * cell + y;
      if (px >= width || py >= height) continue;
      const index = (py * width + px) * 4;
      if (pixels[index + 3] === 0) continue;
      const key = `${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`;
      colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
    }
  }
}

const topColors = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
const greys = [...colorCounts.keys()].filter((key) => {
  const [r, g, b] = key.split(',').map(Number);
  return Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b) > 24;
}).length;

console.log(`\n  colores distintos: ${colorCounts.size} · con croma apreciable: ${greys}`);
for (const [key, count] of topColors) {
  const [r, g, b] = key.split(',');
  console.log(`    rgb(${r}, ${g}, ${b}) · ${count} px`);
}
if (greys === 0) {
  console.log('    AVISO: la fila es practicamente en escala de grises. Si esperabas color,');
  console.log('    el PNG descargado es la plantilla base sin colorear (o una capa suelta).');
}

// --- Resumen de color de TODA la hoja --------------------------------------

const globalColors = new Set();
let globalChroma = 0;
for (let y = 0; y < height; y += 2) {
  for (let x = 0; x < width; x += 2) {
    const index = (y * width + x) * 4;
    if (pixels[index + 3] === 0) continue;
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    globalColors.add(`${r},${g},${b}`);
    if (Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b) > 24) globalChroma += 1;
  }
}

console.log(`\n  Hoja completa (muestreo): ${globalColors.size} colores distintos, ${globalChroma} px con croma.`);
if (globalChroma === 0) {
  console.log('  AVISO: la hoja ENTERA es en escala de grises.');
}

// --- Frame grande para revisarlo a ojo ------------------------------------

if (union.maxX >= 0) {
  const frameScale = 8;
  const frameWidth = (union.maxX - union.minX + 1) * frameScale;
  const frameHeight = (union.maxY - union.minY + 1) * frameScale;
  const frame = Buffer.alloc(frameWidth * frameHeight * 4);

  for (let y = 0; y < frameHeight; y += 1) {
    for (let x = 0; x < frameWidth; x += 1) {
      const sourceX = union.minX + Math.floor(x / frameScale);
      const sourceY = inspectRow * cell + union.minY + Math.floor(y / frameScale);
      const source = (sourceY * width + sourceX) * 4;
      const target = (y * frameWidth + x) * 4;
      const checker = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 20 : 28;
      const alpha = pixels[source + 3];

      if (alpha === 0) {
        frame[target] = checker;
        frame[target + 1] = checker + 6;
        frame[target + 2] = checker + 12;
      } else {
        frame[target] = pixels[source];
        frame[target + 1] = pixels[source + 1];
        frame[target + 2] = pixels[source + 2];
      }
      frame[target + 3] = 255;
    }
  }

  const frameOutput = resolve('frontend/agent-frame.png');
  writePng(frameOutput, frameWidth, frameHeight, frame);
  console.log(`  Frame grande escrito en ${frameOutput}`);
}

// --- PNG de la fila inspeccionada -----------------------------------------

const scale = 3;
const previewWidth = columns * cell * scale;
const previewHeight = cell * scale;
const out = Buffer.alloc(previewWidth * previewHeight * 4);

for (let y = 0; y < previewHeight; y += 1) {
  for (let x = 0; x < previewWidth; x += 1) {
    const sourceX = Math.floor(x / scale);
    const sourceY = inspectRow * cell + Math.floor(y / scale);
    const target = (y * previewWidth + x) * 4;

    if (sourceX >= width || sourceY >= height) {
      out[target] = 16;
      out[target + 1] = 24;
      out[target + 2] = 32;
      out[target + 3] = 255;
      continue;
    }

    const source = (sourceY * width + sourceX) * 4;
    const alpha = pixels[source + 3];
    // Fondo de tablero para que se vea la transparencia.
    const checker = (Math.floor(sourceX / 8) + Math.floor(sourceY / 8)) % 2 === 0 ? 20 : 28;

    if (alpha === 0) {
      out[target] = checker;
      out[target + 1] = checker + 6;
      out[target + 2] = checker + 12;
      out[target + 3] = 255;
    } else {
      out[target] = pixels[source];
      out[target + 1] = pixels[source + 1];
      out[target + 2] = pixels[source + 2];
      out[target + 3] = 255;
    }
  }
}

const output = resolve('frontend/agent-sheet-row.png');
writePng(output, previewWidth, previewHeight, out);

console.log(`\n  PNG de la fila ${inspectRow} escrito en ${output}`);
