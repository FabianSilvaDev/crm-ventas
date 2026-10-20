/**
 * Lectura y escritura de PNG para las herramientas de desarrollo.
 *
 * Soporta lo que usan los generadores de pixel art:
 *  - 8 bits por canal, sin entrelazar;
 *  - RGB (colorType 2), RGBA (6) y **paleta indexada** (3, con tRNS opcional).
 *
 * El resultado siempre es un buffer RGBA, para que las herramientas no tengan que
 * saber de que formato venia cada fichero.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';

const SIGNATURE = '89504e470d0a1a0a';

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = (data) => {
  let crc = -1;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
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

/** Cabecera de un PNG: solo lo necesario para saber su tamano y formato. */
export const readPngHeader = (source) => {
  const buffer = Buffer.isBuffer(source) ? source : readFileSync(source);
  if (buffer.subarray(0, 8).toString('hex') !== SIGNATURE) {
    throw new Error('El fichero no es un PNG.');
  }

  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      return {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    }
  }

  throw new Error('El PNG no tiene cabecera IHDR.');
};

/**
 * Decodifica un PNG a RGBA.
 * `source` puede ser una ruta o directamente un Buffer (util al descargar por red).
 */
export const readPng = (source) => {
  const buffer = Buffer.isBuffer(source) ? source : readFileSync(source);
  if (buffer.subarray(0, 8).toString('hex') !== SIGNATURE) {
    throw new Error('El fichero no es un PNG.');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette = null;
  let transparency = null;
  const idat = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'tRNS') {
      transparency = data;
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 3 ? 1 : 0;
  // Los PNG indexados de pixel art suelen venir a 4 bits; los de color, a 8.
  const depthSupported = colorType === 3 ? [1, 2, 4, 8].includes(bitDepth) : bitDepth === 8;
  if (interlace !== 0 || channels === 0 || !depthSupported) {
    throw new Error(`Formato no soportado: ${bitDepth} bits, colorType ${colorType}, interlace ${interlace}.`);
  }
  if (colorType === 3 && !palette) {
    throw new Error('PNG indexado sin tabla de paleta (PLTE).');
  }

  const raw = inflateSync(Buffer.concat(idat));
  // En indexado, el ancho de linea se mide en bytes empaquetados, no en pixeles.
  const stride = colorType === 3 ? Math.ceil((width * bitDepth) / 8) : width * channels;
  const scan = Buffer.alloc(height * stride);

  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const lineStart = y * (stride + 1) + 1;
    const rowStart = y * stride;

    for (let x = 0; x < stride; x += 1) {
      const value = raw[lineStart + x];
      const left = x >= channels ? scan[rowStart + x - channels] : 0;
      const up = y > 0 ? scan[rowStart - stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? scan[rowStart - stride + x - channels] : 0;

      let reconstructed;
      switch (filter) {
        case 0:
          reconstructed = value;
          break;
        case 1:
          reconstructed = value + left;
          break;
        case 2:
          reconstructed = value + up;
          break;
        case 3:
          reconstructed = value + Math.floor((left + up) / 2);
          break;
        case 4:
          reconstructed = value + paeth(left, up, upLeft);
          break;
        default:
          throw new Error(`Filtro PNG desconocido: ${filter}`);
      }

      scan[rowStart + x] = reconstructed & 0xff;
    }
  }

  const pixels = Buffer.alloc(width * height * 4);

  const pixelsPerByte = colorType === 3 ? 8 / bitDepth : 0;
  const indexMask = colorType === 3 ? (1 << bitDepth) - 1 : 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const target = (y * width + x) * 4;

      if (colorType === 3) {
        const byte = scan[y * stride + Math.floor(x / pixelsPerByte)];
        const shift = 8 - bitDepth - (x % pixelsPerByte) * bitDepth;
        const index = (byte >> shift) & indexMask;
        const entry = index * 3;
        if (entry + 2 < palette.length) {
          pixels[target] = palette[entry];
          pixels[target + 1] = palette[entry + 1];
          pixels[target + 2] = palette[entry + 2];
          pixels[target + 3] = transparency && index < transparency.length ? transparency[index] : 255;
        }
        continue;
      }

      const source = y * stride + x * channels;
      if (colorType === 6) {
        pixels[target] = scan[source];
        pixels[target + 1] = scan[source + 1];
        pixels[target + 2] = scan[source + 2];
        pixels[target + 3] = scan[source + 3];
      } else {
        pixels[target] = scan[source];
        pixels[target + 1] = scan[source + 1];
        pixels[target + 2] = scan[source + 2];
        pixels[target + 3] = 255;
      }
    }
  }

  return { width, height, pixels };
};

/** Escribe un buffer RGBA como PNG. */
export const writePng = (output, widthPx, heightPx, rgba) => {
  const scanlines = Buffer.alloc((widthPx * 4 + 1) * heightPx);
  for (let y = 0; y < heightPx; y += 1) {
    scanlines[y * (widthPx * 4 + 1)] = 0;
    rgba.copy(scanlines, y * (widthPx * 4 + 1) + 1, y * widthPx * 4, (y + 1) * widthPx * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(widthPx, 0);
  header.writeUInt32BE(heightPx, 4);
  header[8] = 8;
  header[9] = 6;

  writeFileSync(
    output,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(scanlines, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
};
