/**
 * Recorta una region de un PNG y la guarda como PNG independiente.
 *
 * Uso: node tools/crop-png.mjs <entrada.png> <salida.png> <x> <y> <ancho> <alto>
 *
 * Sirve para convertir una celda de una hoja de tiles en un tile suelto que se pueda
 * repetir con `TilingSprite` sin depender de subtextures.
 */
import { readPng, writePng } from './png.mjs';

const [input, output, xArg, yArg, widthArg, heightArg] = process.argv.slice(2);

if (!input || !output) {
  console.error('Uso: node tools/crop-png.mjs <entrada.png> <salida.png> <x> <y> <ancho> <alto>');
  process.exit(1);
}

const x0 = Number(xArg);
const y0 = Number(yArg);
const width = Number(widthArg);
const height = Number(heightArg);

const source = readPng(input);
const pixels = Buffer.alloc(width * height * 4);

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const sx = x0 + x;
    const sy = y0 + y;
    if (sx < 0 || sy < 0 || sx >= source.width || sy >= source.height) continue;
    source.pixels.copy(pixels, (y * width + x) * 4, (sy * source.width + sx) * 4, (sy * source.width + sx) * 4 + 4);
  }
}

writePng(output, width, height, pixels);
console.log(`${output} · ${width}x${height} desde ${x0},${y0}`);
