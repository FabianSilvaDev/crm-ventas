/**
 * Genera el manifiesto de sprites propios a partir de los PNG de la carpeta.
 *
 * Uso:  npm --prefix frontend run sprites:sync
 *
 * Dos convenciones de nombre:
 *
 *   agt-020.png        PNG ya recortado (24x32, 32x32...). Se usa tal cual.
 *   agt-020@lpc.png    Hoja de LPC (celdas de 64x64). Se recorta una celda en el navegador.
 *
 * En las hojas LPC se escribe un descriptor con `cell`, `row` y `frame`. Si ya existe y
 * apunta al mismo fichero, se conserva: asi puedes ajustar row/frame a mano sin que el
 * script te pise el cambio. Para saber que fila es la buena, abre
 * `public/assets/agents/preview.html` en el navegador.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readPngHeader } from './png.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const folder = resolve(here, '../public/assets/agents');
const manifestPath = resolve(folder, 'manifest.json');

if (!existsSync(folder)) {
  console.error(`No existe la carpeta ${folder}.`);
  process.exit(1);
}

const files = readdirSync(folder)
  .filter((file) => file.toLowerCase().endsWith('.png'))
  .sort();

let previous = {};
if (existsSync(manifestPath)) {
  try {
    previous = JSON.parse(readFileSync(manifestPath, 'utf8')).sprites ?? {};
  } catch {
    console.warn('El manifiesto anterior no era JSON valido: se regenera.');
  }
}

const sprites = {};
const seen = new Set();

for (const file of files) {
  const base = file.replace(/\.png$/i, '');
  const isLpc = /@lpc$/i.test(base);
  const id = base.replace(/@lpc$/i, '');
  const src = `assets/agents/${file}`;

  if (seen.has(id)) {
    console.warn(`  AVISO: dos ficheros para el mismo agente (${id}); se usa el ultimo.`);
  }
  seen.add(id);

  if (!isLpc) {
    sprites[id] = src;
    console.log(`  ${id.padEnd(10)} <- ${file} (PNG directo)`);
    continue;
  }

  // Se mira el tamano real para no escribir una fila que no existe: una hoja completa
  // de LPC tiene 54 filas (walk-down = 10) y una hoja recortada de caminar tiene 4
  // (arriba, izquierda, abajo, derecha; walk-down = 2).
  const { width, height } = readPngHeader(resolve(folder, file));
  const columns = Math.floor(width / 64);
  const rowsInSheet = Math.floor(height / 64);
  const defaultRow = rowsInSheet >= 12 ? 10 : Math.min(2, Math.max(0, rowsInSheet - 1));

  // Se conserva el descriptor si ya apuntaba a este mismo fichero (row/frames ajustados)
  // y sigue teniendo sentido para el tamano actual.
  const previousEntry = previous[id];
  const keep =
    previousEntry && typeof previousEntry === 'object' && previousEntry.src === src && (previousEntry.row ?? 0) < rowsInSheet
      ? previousEntry
      : null;

  sprites[id] = keep ?? {
    src,
    cell: 64,
    row: defaultRow,
    frames: Math.max(1, Math.min(9, columns)),
    fps: 8,
  };

  const { cell, row, frames, fps } = sprites[id];
  const sizeKb = Math.round(statSync(resolve(folder, file)).size / 1024);
  console.log(
    `  ${id.padEnd(10)} <- ${file} (celda ${cell}px, fila ${row}, ${frames} frames a ${fps} fps, ${sizeKb} kB)`,
  );
}

const removed = Object.keys(previous).filter((id) => !(id in sprites));

writeFileSync(manifestPath, `${JSON.stringify({ sprites }, null, 2)}\n`, 'utf8');

console.log(`\n${files.length} sprite(s) en el manifiesto.`);
if (removed.length > 0) console.log(`  Ya no existen: ${removed.join(', ')}`);
console.log(`  Escrito en ${manifestPath}`);
console.log('\nSi una celda LPC sale vacia o con la pose equivocada, abre preview.html y ajusta row/frames.');
