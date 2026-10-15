/**
 * Comprobador de sprites (herramienta de desarrollo).
 *
 * Lee las matrices de pixeles de `src/app/shared/pixel/agent-sprites.ts`, valida
 * que todas las filas de cada matriz midan lo mismo y las imprime en ASCII para
 * poder revisar las siluetas sin abrir un navegador. Ademas compone varios
 * personajes aplicando la misma regla de superposicion que el motor
 * (`overlay`: un punto en la capa deja ver la capa inferior).
 *
 * Uso:  node tools/check-sprites.mjs
 *
 * No forma parte del build: es una ayuda para mantener el pixel art a mano alzada.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(here, '../src/app/shared/pixel/agent-sprites.ts');
const iconsPath = resolve(here, '../src/app/shared/pixel/icons.ts');
const source = readFileSync(sourcePath, 'utf8');
const iconsSource = readFileSync(iconsPath, 'utf8');

/** Extrae pares nombre -> filas: tanto `const X: PixelMatrix = [...]` como `clave: [...]`. */
const extractMatrices = (text) => {
  const matrices = new Map();
  const patterns = [
    /(?:const\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*:\s*PixelMatrix\s*=\s*\[\s*((?:\s*'[^']*'\s*,?\s*)+)\]/g,
    /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\[\s*((?:\s*'[^']*'\s*,?\s*)+)\]/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const [, name, body] = match;
      if (matrices.has(name)) continue;
      const rows = [...body.matchAll(/'([^']*)'/g)].map((row) => row[1]);
      if (rows.length > 0) matrices.set(name, rows);
    }
  }

  return matrices;
};

const matrices = extractMatrices(source);
const iconMatrices = extractMatrices(iconsSource);

if (matrices.size === 0 || iconMatrices.size === 0) {
  console.error('No se han encontrado matrices. Revisa el formato de los ficheros de sprites e iconos.');
  process.exit(1);
}

const ascii = (rows) => rows.map((row) => `    |${row.replace(/[^.]/g, '#').replace(/\./g, ' ')}|`).join('\n');

/** Misma regla que `overlay()` del motor: '.' deja ver la capa inferior. */
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

let failures = 0;

const report = (name, rows, { preview = true } = {}) => {
  const width = rows[0].length;
  const mismatched = rows
    .map((row, index) => ({ index, length: row.length }))
    .filter((row) => row.length !== width);

  console.log(`\n[${mismatched.length === 0 ? 'OK  ' : 'FALLA'}] ${name} — ${width}x${rows.length}`);
  if (preview) console.log(ascii(rows));

  if (mismatched.length > 0) {
    failures += 1;
    console.log(`    filas descuadradas: ${mismatched.map((row) => `${row.index} (${row.length})`).join(', ')}`);
  }
};

console.log('=== Capas ===');
for (const [name, rows] of matrices) report(name, rows, { preview: name.startsWith('BODY') || name.startsWith('HAIR') || name.startsWith('ACCESSORY') });

console.log('\n=== Composicion de personajes (cuerpo + peinado + accesorio) ===');
const combos = [
  { name: 'slim + corto + gafas', body: 'BODY_SLIM', hair: 'HAIR_SHORT', accessory: 'ACCESSORY_GLASSES' },
  { name: 'ancho + largo + auriculares', body: 'BODY_BROAD', hair: 'HAIR_LONG', accessory: 'ACCESSORY_HEADSET' },
  { name: 'slim + recogido + tablet', body: 'BODY_SLIM', hair: 'HAIR_TIED', accessory: 'ACCESSORY_TABLET' },
  { name: 'ancho + corto + sin accesorio', body: 'BODY_BROAD', hair: 'HAIR_SHORT', accessory: null },
];

for (const combo of combos) {
  let sprite = matrices.get(combo.body);
  sprite = overlay(sprite, matrices.get(combo.hair));

  // El tablet es la unica capa que no cabe en 16 filas del cuerpo recortado.
  if (combo.accessory === 'ACCESSORY_TABLET') {
    const accessory = matrices.get('ACCESSORY_TABLET');
    sprite = overlay(sprite, accessory);
  } else if (combo.accessory) {
    sprite = overlay(sprite, matrices.get(combo.accessory));
  }

  report(combo.name, sprite);
}

console.log('=== Iconos de interfaz ===');
for (const [name, rows] of iconMatrices) report(name, rows, { preview: true });

console.log(`\n${iconMatrices.size} iconos revisados.`);
console.log(`\n${matrices.size} matrices de oficina revisadas, ${failures} con filas descuadradas.`);
process.exit(failures === 0 ? 0 : 1);
