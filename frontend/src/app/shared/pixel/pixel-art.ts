/**
 * Motor de pixel art.
 *
 * Los graficos de este proyecto no son imagenes: son matrices de pixeles descritas
 * en TypeScript y teñidas en tiempo de ejecucion. Asi se cumple el requisito de no
 * depender de recursos remotos ni de binarios, y un mismo sprite se reutiliza para
 * los iconos de la interfaz (SVG) y para el escenario de la oficina (texturas de
 * PixiJS via canvas).
 *
 * Tokens de la matriz:
 *   '.'  transparente
 *   'o'  contorno          'n'  sombra profunda     'k'  tela oscura
 *   'g'  metal / cristal   'w'  brillo             'y'  luz calida
 *   'A'  acento (color del departamento)  'a'  acento en sombra
 *   's'  piel              'd'  piel en sombra     'e'  piel en penumbra
 *   'h'  pelo              'j'  pelo en sombra
 */

export type PixelMatrix = readonly string[];

/** Mapa de token a color. Un token ausente se dibuja transparente. */
export type PixelPalette = Readonly<Record<string, string | undefined>>;

export interface SpriteTheme {
  accent?: string;
  accentDark?: string;
  skin?: string;
  skinDark?: string;
  hair?: string;
}

/** Paleta base, comun a todos los sprites. */
export const BASE_TOKENS: PixelPalette = {
  o: '#080b0f',
  n: '#151d26',
  k: '#26333f',
  g: '#8fa7b8',
  w: '#eef6fb',
  y: '#ffc44d',
};

/** Tonos de piel disponibles (piel y su sombra). */
export const SKIN_TONES: Record<string, { base: string; shade: string }> = {
  light: { base: '#f2c9a4', shade: '#d8a67f' },
  medium: { base: '#d69f70', shade: '#b47f54' },
  dark: { base: '#a9714a', shade: '#87552f' },
  deep: { base: '#7a4b2e', shade: '#5d381f' },
};

/** Colores de pelo disponibles. */
export const HAIR_COLORS: Record<string, string> = {
  dark: '#2a2118',
  brown: '#6b4523',
  blond: '#d9b06a',
  red: '#a8442a',
  gray: '#9aa7b0',
  violet: '#7b5cc4',
};

/** Acentos por departamento: color base y su sombra. */
export const ACCENT_COLORS: Record<string, { base: string; dark: string }> = {
  amber: { base: '#ffc44d', dark: '#c78f22' },
  cyan: { base: '#4fd6ff', dark: '#2a93b8' },
  violet: { base: '#a98bff', dark: '#7a5fd0' },
  pink: { base: '#ff6fa5', dark: '#c94a78' },
  green: { base: '#5ce08a', dark: '#2fa35c' },
  orange: { base: '#ff8f4d', dark: '#c7651f' },
  lime: { base: '#b6e34d', dark: '#87ad2a' },
  blue: { base: '#5b9bff', dark: '#3a6fd0' },
};

/** Oscurece un color hexadecimal multiplicando sus canales (sin dependencias). */
const shadeHex = (hex: string, factor: number): string => {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return hex;

  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) =>
    Math.max(0, Math.min(255, Math.round(channel * factor))),
  );

  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
};

/** Construye la paleta final de un sprite a partir de su tema. */
export const resolvePalette = (theme: SpriteTheme = {}): PixelPalette => {
  const requested = theme.accent ?? 'cyan';
  // El acento puede ser el nombre de un departamento o un color hexadecimal
  // directo (por ejemplo, el color de un estado en los globos de la oficina).
  const accent = requested.startsWith('#')
    ? { base: requested, dark: shadeHex(requested, 0.68) }
    : (ACCENT_COLORS[requested] ?? ACCENT_COLORS['cyan']);
  const skin = SKIN_TONES[theme.skin ?? 'medium'] ?? SKIN_TONES['medium'];
  const hair = theme.hair ?? HAIR_COLORS['dark'];

  return {
    ...BASE_TOKENS,
    A: accent.base,
    a: theme.accentDark ?? accent.dark,
    s: skin.base,
    d: skin.shade,
    // Tercer tono de piel y sombra del pelo: lo que da volumen al personaje.
    e: shadeHex(skin.shade, 0.86),
    h: hair,
    j: shadeHex(hair, 0.62),
  };
};

/** Ancho de una matriz (el de su fila mas larga). */
export const matrixWidth = (rows: PixelMatrix): number =>
  rows.reduce((width, row) => Math.max(width, row.length), 0);

export const matrixHeight = (rows: PixelMatrix): number => rows.length;

/**
 * Comprueba que todas las filas midan lo mismo.
 * Un sprite descuadrado suele ser un error de tecleo; mejor detectarlo al cargar
 * que descubrir un personaje roto en pantalla.
 */
export const assertMatrix = (rows: PixelMatrix, name: string): void => {
  if (rows.length === 0) throw new Error(`El sprite "${name}" no tiene filas.`);
  const width = rows[0].length;
  rows.forEach((row, index) => {
    if (row.length !== width) {
      throw new Error(
        `El sprite "${name}" esta descuadrado: la fila ${index} mide ${row.length} y se esperaban ${width}.`,
      );
    }
  });
};

/**
 * Superpone una capa sobre una base. El token '.' de la capa deja ver la base.
 * Se usa para el pelo y los accesorios sobre el cuerpo del agente.
 */
export const overlay = (base: PixelMatrix, layer: PixelMatrix): PixelMatrix => {
  const height = Math.max(base.length, layer.length);
  const width = Math.max(matrixWidth(base), matrixWidth(layer));

  return Array.from({ length: height }, (_, y) => {
    const baseRow = base[y] ?? '';
    const layerRow = layer[y] ?? '';
    let result = '';

    for (let x = 0; x < width; x += 1) {
      const layerToken = layerRow[x] ?? '.';
      const baseToken = baseRow[x] ?? '.';
      result += layerToken === '.' ? baseToken : layerToken;
    }

    return result;
  });
};

/** Convierte la matriz en rectangulos SVG, uniendo pixeles contiguos del mismo color. */
const toRects = (rows: PixelMatrix, palette: PixelPalette): string => {
  const width = matrixWidth(rows);
  const rects: string[] = [];

  rows.forEach((row, y) => {
    let x = 0;
    while (x < width) {
      const token = row[x] ?? '.';
      const color = palette[token];
      if (!color) {
        x += 1;
        continue;
      }

      let run = 1;
      while (x + run < width && (row[x + run] ?? '.') === token) run += 1;

      rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${color}"/>`);
      x += run;
    }
  });

  return rects.join('');
};

/** Dibuja una matriz como SVG (iconos de la interfaz). */
export const toSvg = (rows: PixelMatrix, theme: SpriteTheme = {}, options: { title?: string } = {}): string => {
  const width = matrixWidth(rows);
  const height = matrixHeight(rows);
  const palette = resolvePalette(theme);
  const label = options.title ? `<title>${options.title}</title>` : '';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"`,
    ` width="${width}" height="${height}" shape-rendering="crispEdges"`,
    ` role="img" aria-hidden="${options.title ? 'false' : 'true'}" focusable="false">`,
    label,
    toRects(rows, palette),
    '</svg>',
  ].join('');
};

/** SVG listo para usar como `src` de una etiqueta `img` o fondo CSS. */
export const toDataUri = (rows: PixelMatrix, theme: SpriteTheme = {}, options: { title?: string } = {}): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(toSvg(rows, theme, options))}`;

/**
 * Dibuja la matriz en un canvas de 1 pixel por celda.
 * Es la via de entrada a PixiJS: cada sprite se convierte en una textura de tamano
 * nativo y luego se escala con `nearest` para conservar el aspecto pixelado.
 */
export const toCanvas = (rows: PixelMatrix, theme: SpriteTheme = {}): HTMLCanvasElement => {
  const palette = resolvePalette(theme);
  const width = matrixWidth(rows);
  const height = matrixHeight(rows);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) return canvas;

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, width, height);

  rows.forEach((row, y) => {
    for (let x = 0; x < width; x += 1) {
      const color = palette[row[x] ?? '.'];
      if (!color) continue;
      context.fillStyle = color;
      context.fillRect(x, y, 1, 1);
    }
  });

  return canvas;
};
