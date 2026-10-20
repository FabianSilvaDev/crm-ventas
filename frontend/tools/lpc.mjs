/**
 * Piezas de LPC para las herramientas: paletas, recolor y composicion.
 *
 * Las capas del repositorio oficial vienen en su **paleta base** (piel clara, tela
 * blanca, pelo naranja). El generador web las recolorea en el navegador; si ese paso
 * falla, la hoja sale sin color. Aqui se hace lo mismo, pero en Node: se empareja cada
 * color base con el destino por indice y se compone con alfa.
 */
import { readPng } from './png.mjs';

export const REPO =
  'https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/master/spritesheets/';

/** Paletas de `palette_definitions/` (solo las entradas que usa la aplicacion). */
export const PALETTES = {
  body: {
    light: ['#271920', '#99423c', '#cc8665', '#E4A47C', '#F9D5BA', '#FAECE7'],
    olive: ['#271920', '#442725', '#7F4C31', '#AE6B3F', '#D38B59', '#E4A47C'],
    taupe: ['#271920', '#503734', '#785946', '#936849', '#BA8454', '#C7935F'],
    brown: ['#120E10', '#412B29', '#5F4539', '#76513A', '#9C663E', '#B8773F'],
    black: ['#000000', '#1A1213', '#2E1F1C', '#442725', '#603429', '#7F4C31'],
  },
  cloth: {
    white: ['#281820', '#4D4A5D', '#958080', '#C4B59F', '#E5E6C7', '#FFFFFF'],
    yellow: ['#301723', '#5F2F25', '#BA5B23', '#D99431', '#F3C03F', '#FFE360'],
    orange: ['#301723', '#5F1D1B', '#9C3F23', '#D75B1A', '#EF7E19', '#FFA749'],
    green: ['#101820', '#192832', '#0B5C2F', '#214437', '#2F8136', '#64A42C'],
    teal: ['#180716', '#1B2B47', '#0E4E72', '#156C99', '#0098B2', '#00CFDF'],
    purple: ['#180716', '#13112D', '#261044', '#411357', '#621E78', '#813089'],
    lavender: ['#13112d', '#2B225A', '#402E82', '#7141B2', '#A966DD', '#D085ED'],
    pink: ['#1d131e', '#54242E', '#6C3536', '#AE424A', '#C36072', '#E08080'],
    rose: ['#1d131e', '#301723', '#562323', '#77372B', '#8A3D28', '#B05F3C'],
    blue: ['#180716', '#281E41', '#322D6A', '#3C49AD', '#466AC9', '#61A0EF'],
    navy: ['#180716', '#20102B', '#281E41', '#322D6A', '#3C49AD', '#466AC9'],
    charcoal: ['#000000', '#130D14', '#1C2222', '#2A3034', '#4A5057', '#6E7675'],
    slate: ['#1d131e', '#31313E', '#4A5057', '#818B8B', '#B3AFA1', '#E5E6C7'],
    gray: ['#0e0e18', '#201E2B', '#373340', '#585561', '#797580', '#A2A0A4'],
    black: ['#000000', '#101414', '#1C2222', '#22282A', '#2A3034', '#4A5057'],
    sky: ['#1a0d18', '#313148', '#586B90', '#9FBBCB', '#C6EEFD', '#FFFFFF'],
    maroon: ['#1d131e', '#400B1F', '#551C22', '#682121', '#832121', '#AE424A'],
    leather: ['#2b1c1d', '#311210', '#4B2B13', '#704325', '#75502D', '#9A6F37'],
    brown: ['#1d131e', '#411E05', '#4B2B13', '#62351C', '#744B30', '#996B4A'],
  },
  hair: {
    orange: ['#260D14', '#6A1108', '#A42600', '#BF4000', '#E55600', '#FF8A00'],
    black: ['#000000', '#080A0A', '#101414', '#1C2222', '#31313E', '#4A5057'],
    chestnut: ['#200C0D', '#3A130E', '#63200B', '#81310A', '#B6550E', '#D28102'],
    light_brown: ['#1A0E04', '#301B07', '#60350F', '#7D4513', '#AE682A', '#C88D58'],
    gray: ['#0E0E0E', '#292929', '#4B4B4B', '#777777', '#AAAAAA', '#D9D9D9'],
    violet: ['#1E032E', '#30035C', '#380392', '#3C07D8', '#5662F3', '#5792F2'],
    blonde: ['#331313', '#552B15', '#AC5D1F', '#E09E2B', '#FCCF56', '#FFE67D'],
    redhead: ['#260D14', '#3E111A', '#73171E', '#9E1F1F', '#C7341B', '#E74716'],
  },
  eye: {
    blue: ['#2a3c49', '#5686ae', '#57cee4'],
  },
};

/** Paletas base de las capas del repositorio. */
export const BASE = {
  skin: 'body.light',
  cloth: 'cloth.white',
  hair: 'hair.orange',
  eye: 'eye.blue',
};

const paletteOf = (name) => {
  const [material, key] = name.split('.');
  const colors = PALETTES[material]?.[key];
  if (!colors) throw new Error(`Paleta desconocida: ${name}`);
  return colors;
};

const toRgb = (hex) => {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
};

const keyOf = (r, g, b) => (r << 16) | (g << 8) | b;

const buildMap = (sourceName, targetName) => {
  const source = paletteOf(sourceName);
  const target = paletteOf(targetName);
  if (source.length !== target.length) {
    throw new Error(`Paletas de distinto tamano: ${sourceName} (${source.length}) y ${targetName} (${target.length})`);
  }

  const map = new Map();
  source.forEach((hex, index) => {
    const [r, g, b] = toRgb(hex);
    map.set(keyOf(r, g, b), toRgb(target[index]));
  });
  return map;
};

const cache = new Map();

/** Descarga (una sola vez por ejecucion) una capa de caminar del repositorio oficial. */
export const fetchLayer = async (file) => {
  if (cache.has(file)) return cache.get(file);

  const response = await fetch(REPO + file);
  if (!response.ok) {
    throw new Error(`No se pudo descargar ${file}: HTTP ${response.status}`);
  }

  const image = readPng(Buffer.from(await response.arrayBuffer()));
  cache.set(file, image);
  return image;
};

/** Aplica una paleta a una capa. Devuelve una copia: la cache no se modifica. */
export const palettize = (image, sourceName, targetName) => {
  const pixels = Buffer.from(image.pixels);
  if (!sourceName || !targetName) return { width: image.width, height: image.height, pixels };

  const map = buildMap(sourceName, targetName);
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    const target = map.get(keyOf(pixels[i], pixels[i + 1], pixels[i + 2]));
    if (!target) continue;
    pixels[i] = target[0];
    pixels[i + 1] = target[1];
    pixels[i + 2] = target[2];
  }

  return { width: image.width, height: image.height, pixels };
};

/** Compone capas ya recoloradas, en orden, con alfa sobre. */
export const compose = (layers) => {
  const width = layers[0].width;
  const height = layers[0].height;
  if (layers.some((layer) => layer.width !== width || layer.height !== height)) {
    throw new Error('Las capas no tienen el mismo tamano; no se pueden componer.');
  }

  const out = Buffer.alloc(width * height * 4);

  for (const layer of layers) {
    const { pixels } = layer;
    for (let i = 0; i < pixels.length; i += 4) {
      const sourceAlpha = pixels[i + 3] / 255;
      if (sourceAlpha === 0) continue;

      const targetAlpha = out[i + 3] / 255;
      const alpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
      if (alpha === 0) continue;

      out[i] = Math.round((pixels[i] * sourceAlpha + out[i] * targetAlpha * (1 - sourceAlpha)) / alpha);
      out[i + 1] = Math.round((pixels[i + 1] * sourceAlpha + out[i + 1] * targetAlpha * (1 - sourceAlpha)) / alpha);
      out[i + 2] = Math.round((pixels[i + 2] * sourceAlpha + out[i + 2] * targetAlpha * (1 - sourceAlpha)) / alpha);
      out[i + 3] = Math.round(alpha * 255);
    }
  }

  return { width, height, pixels: out };
};

/**
 * Descarga y colorea una capa.
 * `palette` es `[origen, destino]` o `null` si la capa no se recolorea (gafas).
 */
export const loadLayer = async ({ file, palette }) => {
  const image = await fetchLayer(file);
  return palette ? palettize(image, palette[0], palette[1]) : palettize(image, null, null);
};
