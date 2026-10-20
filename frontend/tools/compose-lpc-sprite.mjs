/**
 * Compone la hoja de caminar de **Yanca** (agt-020) a color.
 *
 * El generador web exporta a veces la hoja sin aplicar el recolor: dibuja las capas
 * crudas, que estan en la paleta base de cada material, y el navegador se encarga de
 * sustituirlos por los colores elegidos. Este script hace ese paso por su cuenta:
 * descarga las capas del repositorio oficial de LPC, reemplaza cada color base por el
 * color destino y las compone en una hoja de 4 filas (arriba, izquierda, abajo,
 * derecha) x 9 fotogramas, que es justo lo que espera la aplicacion.
 *
 * Uso:  npm --prefix frontend run sprites:compose
 *
 * Para el resto de agentes: `npm --prefix frontend run sprites:lineup`.
 *
 * Licencias: ver `public/assets/agents/CREDITS.md`.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePng } from './png.mjs';
import { compose, loadLayer } from './lpc.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, '../public/assets/agents/agt-020@lpc.png');

/** Capas del personaje, en orden de dibujo (zPos ascendente). */
const LAYERS = [
  { name: 'Cuerpo', file: 'body/bodies/male/walk.png', palette: ['body.light', 'body.olive'] },
  { name: 'Zapatos', file: 'feet/shoes/revised/male/walk.png', palette: ['cloth.white', 'cloth.maroon'] },
  { name: 'Pantalon', file: 'legs/cuffed/male/walk.png', palette: ['cloth.white', 'cloth.brown'] },
  {
    name: 'Mangas largas',
    file: 'torso/clothes/longsleeve/longsleeves/male/walk.png',
    palette: ['cloth.white', 'cloth.yellow'],
  },
  {
    name: 'Cardigan',
    file: 'torso/clothes/longsleeve/longsleeve2_cardigan/male/walk.png',
    palette: ['cloth.white', 'cloth.yellow'],
  },
  { name: 'Cabeza', file: 'head/heads/human/male/walk.png', palette: ['body.light', 'body.olive'] },
  { name: 'Cara neutra', file: 'head/faces/male/neutral/walk.png', palette: ['body.light', 'body.olive'] },
  { name: 'Rastas', file: 'hair/dreadlocks_short/adult/walk.png', palette: ['hair.orange', 'hair.orange'] },
];

const main = async () => {
  console.log('Descargando y recoloreando capas de LPC...');
  const layers = [];

  for (const layer of LAYERS) {
    const image = await loadLayer(layer);
    layers.push(image);
    console.log(`  ${layer.name.padEnd(14)} ${image.width}x${image.height}`);
  }

  const sheet = compose(layers);
  writePng(output, sheet.width, sheet.height, sheet.pixels);

  console.log(`\nHoja compuesta: ${output}`);
  console.log(`  ${sheet.width}x${sheet.height} px · ${sheet.width / 64} fotogramas x ${sheet.height / 64} filas`);
  console.log('  filas: 0 arriba · 1 izquierda · 2 abajo · 3 derecha');
  console.log('\nAhora ejecuta `npm --prefix frontend run sprites:sync` para registrarla.');
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
