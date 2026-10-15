/**
 * Sprites de la oficina: personajes (agentes), muebles y globos de estado.
 *
 * Cada matriz tiene filas de la MISMA longitud; `assertMatrix` lo comprueba al
 * cargar el modulo. Los personajes se componen en tres capas:
 *   cuerpo (silueta) + peinado + accesorio
 * de modo que 2 cuerpos x 3 peinados x 3 accesorios x 8 acentos x 4 pieles dan
 * variedad suficiente para toda la plantilla sin dibujar un personaje por agente.
 *
 * Vista: cenital para el suelo y las salas, con personajes y muebles en vista
 * frontal (convencion clasica de los simuladores 2D). Es la unica vista del
 * proyecto, para mantener la coherencia que pide la seccion 5 del prompt.
 */
import { type PixelMatrix, assertMatrix, overlay } from './pixel-art';
import type { AgentAvatar, AgentStatus } from '../../core/models/agents.model';

/** Silueta estandar: cabeza redonda, hombros y piernas. */
const BODY_SLIM: PixelMatrix = [
  '................',
  '.....oooooo.....',
  '....oooooooo....',
  '...ohhhhhhhho...',
  '...ohhhhhhhho...',
  '...ohssssssho...',
  '...ohssssssho...',
  '...ohsossosho...',
  '...ohdssssdho...',
  '....osssssso....',
  '...oAAAAAAAAo...',
  '..osAAAAAAAAso..',
  '..osAAAAAAAAso..',
  '..osAAaaaaAAso..',
  '...okkkkkkkko...',
  '...okko..okko...',
];

/** Silueta ancha, para perfiles senior. */
const BODY_BROAD: PixelMatrix = [
  '................',
  '....oooooooo....',
  '...oooooooooo...',
  '..ohhhhhhhhhho..',
  '..ohhhhhhhhhho..',
  '..ohssssssssho..',
  '..ohssssssssho..',
  '..ohssossossho..',
  '..ohdssssssdho..',
  '....osssssso....',
  '.oaAAAAAAAAao...',
  'oaAAAAAAAAAAao..',
  'oaAAAAAAAAAAao..',
  'oaaaaaaaaaaaao..',
  '..okkkkkkkkkko..',
  '..okkko..okkko..',
];

/** Peinado corto, hasta la linea de las cejas. */
const HAIR_SHORT: PixelMatrix = [
  '................',
  '.....ohhhho.....',
  '....ohhhhhho....',
  '...ohhhhhhhho...',
  '...ohhhhhhhho...',
  '...ohhhhhhhho...',
];

/** Peinado largo, con mechones a los lados del rostro. */
const HAIR_LONG: PixelMatrix = [
  '................',
  '.....ohhhho.....',
  '....ohhhhhho....',
  '...ohhhhhhhho...',
  '..ohhhhhhhhhho..',
  '..ohhsssssshho..',
  '..ohhsssssshho..',
  '..ohhsossossho..',
  '..ohhdssssdhho..',
];

/** Peinado recogido, con un moño sobre la cabeza. */
const HAIR_TIED: PixelMatrix = [
  '......oooo......',
  '......ohho......',
  '.....ohhhho.....',
  '....ohhhhhho....',
  '...ohhhhhhhho...',
  '...ohhhhhhhho...',
];

/** Gafas sobre la linea de los ojos. */
const ACCESSORY_GLASSES: PixelMatrix = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '...ohgwggwgo....',
];

/** Auriculares: diadema y orejeras. */
const ACCESSORY_HEADSET: PixelMatrix = [
  '................',
  '................',
  '....oggggggggo..',
  '................',
  '................',
  '................',
  '................',
  '..gg........gg..',
  '..gg........gg..',
];

/** Tablet sujetada delante del cuerpo. */
const ACCESSORY_TABLET: PixelMatrix = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..........oyyo..',
  '..........oyyo..',
  '..........oooo..',
];

/** Globos de estado: 8x8, dibujados sobre la cabeza del agente. */
const STATUS_GLYPHS: Record<AgentStatus, PixelMatrix> = {
  working: [
    '........',
    '..x.....',
    '..xxx...',
    '..xxxxx.',
    '..xxxxx.',
    '..xxx...',
    '..x.....',
    '........',
  ],
  thinking: [
    '........',
    '...xx...',
    '..x..x..',
    '..x..x..',
    '...xx...',
    '....x...',
    '........',
    '........',
  ],
  collaborating: [
    '........',
    '.xx..xx.',
    '.xx..xx.',
    '...xx...',
    '.xx..xx.',
    '.xx..xx.',
    '........',
    '........',
  ],
  completed: [
    '........',
    '........',
    '......x.',
    '.....xx.',
    '..x.xx..',
    '..xxx...',
    '...x....',
    '........',
  ],
  error: [
    '........',
    '..x..x..',
    '..x..x..',
    '...xx...',
    '...xx...',
    '..x..x..',
    '..x..x..',
    '........',
  ],
  idle: [
    '........',
    '........',
    '..xxxx..',
    '..xxxx..',
    '..xxxx..',
    '..xxxx..',
    '........',
    '........',
  ],
  offline: [
    '........',
    '..x..x..',
    '........',
    '..x..x..',
    '........',
    '..x..x..',
    '........',
    '........',
  ],
};

/** Muebles del escenario, en vista frontal sobre suelo cenital. */
const FURNITURE: Record<string, PixelMatrix> = {
  monitor: [
    '................',
    '................',
    '................',
    '................',
    '..oooooooooooo..',
    '..oyyyyyyyyyyo..',
    '..oygnnngnngyo..',
    '..oygnnngnngyo..',
    '..oyyyyyyyyyyo..',
    '..oooooooooooo..',
    '.......oo.......',
    '......oooo......',
    '....oooooooo....',
    '................',
    '................',
    '................',
  ],
  chair: [
    '................',
    '................',
    '................',
    '.....oooooo.....',
    '....okkkkkko....',
    '....okkkkkko....',
    '....okkkkkko....',
    '....okkkkkko....',
    '.....oooooo.....',
    '......oooo......',
    '.......oo.......',
    '....oo....oo....',
    '...o........o...',
    '................',
    '................',
    '................',
  ],
  plant: [
    '................',
    '.....g.g.g......',
    '....ggggggg.....',
    '...gggggggggg...',
    '...g.ggggg.g....',
    '....gggggggg....',
    '.....gggggg.....',
    '......gggg......',
    '....okkkkkko....',
    '....okkkkkko....',
    '...okkkkkkkko...',
    '...okkkkkkkko...',
    '....okkkkkko....',
    '.....oooooo.....',
    '................',
    '................',
  ],
  whiteboard: [
    '................',
    '................',
    'oooooooooooooooo',
    'owwwwwwwwwwwwwwo',
    'owAAwwwAAwwAAwwo',
    'owwwwwwwwwwwwwwo',
    'owyywwwwyywwwwwo',
    'owwwwwwwwwwwwwwo',
    'owwwwwwwwwwwwwwo',
    'oooooooooooooooo',
    '...o........o...',
    '...o........o...',
    '................',
    '................',
    '................',
    '................',
  ],
  server: [
    '................',
    '..oooooooooooo..',
    '..onnnnnnnnnno..',
    '..onyyyynnnnno..',
    '..onnnnnnnnnno..',
    '..onyyyynnnnno..',
    '..onnnnnnnnnno..',
    '..onyyyynnnnno..',
    '..onnnnnnnnnno..',
    '..onnnnnnnnnno..',
    '..oooooooooooo..',
    '..okkkkkkkkkko..',
    '..okkkkkkkkkko..',
    '..oooooooooooo..',
    '................',
    '................',
  ],
  crate: [
    '................',
    '................',
    '................',
    '....oooooooo....',
    '....oyyyyyyo....',
    '....oyooooyo....',
    '....oyooooyo....',
    '....oyooooyo....',
    '....oyooooyo....',
    '....oyyyyyyo....',
    '....oooooooo....',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  coffee: [
    '................',
    '................',
    '................',
    '.....oooooo.....',
    '.....onnnno.....',
    '.....onyyno.....',
    '.....onnnno.....',
    '.....oooooo.....',
    '.....okkkko.....',
    '.....okkkko.....',
    '....okkkkkko....',
    '....oooooooo....',
    '................',
    '................',
    '................',
    '................',
  ],
};

// Validacion: si alguna matriz esta descuadrada, falla al cargar el modulo en
// lugar de dibujar un personaje roto en pantalla.
assertMatrix(BODY_SLIM, 'BODY_SLIM');
assertMatrix(BODY_BROAD, 'BODY_BROAD');
assertMatrix(HAIR_SHORT, 'HAIR_SHORT');
assertMatrix(HAIR_LONG, 'HAIR_LONG');
assertMatrix(HAIR_TIED, 'HAIR_TIED');
assertMatrix(ACCESSORY_GLASSES, 'ACCESSORY_GLASSES');
assertMatrix(ACCESSORY_HEADSET, 'ACCESSORY_HEADSET');
assertMatrix(ACCESSORY_TABLET, 'ACCESSORY_TABLET');
for (const [name, matrix] of Object.entries(FURNITURE)) assertMatrix(matrix, `FURNITURE.${name}`);
for (const [name, matrix] of Object.entries(STATUS_GLYPHS)) assertMatrix(matrix, `STATUS_GLYPHS.${name}`);

const HAIR_BY_KEY: Record<AgentAvatar['hair'], PixelMatrix> = {
  dark: HAIR_SHORT,
  brown: HAIR_SHORT,
  blond: HAIR_TIED,
  red: HAIR_LONG,
  gray: HAIR_SHORT,
  violet: HAIR_LONG,
};

const ACCESSORY_BY_KEY: Record<AgentAvatar['accessory'], PixelMatrix | null> = {
  glasses: ACCESSORY_GLASSES,
  headset: ACCESSORY_HEADSET,
  tablet: ACCESSORY_TABLET,
  none: null,
};

/** Compone el sprite definitivo de un agente (cuerpo + peinado + accesorio). */
export const buildAgentSprite = (avatar: AgentAvatar): PixelMatrix => {
  const body = avatar.body === 'c' || avatar.body === 'd' ? BODY_BROAD : BODY_SLIM;
  const withHair = overlay(body, HAIR_BY_KEY[avatar.hair] ?? HAIR_SHORT);
  const accessory = ACCESSORY_BY_KEY[avatar.accessory];
  return accessory ? overlay(withHair, accessory) : withHair;
};

/** Globo de estado del agente (8x8). */
export const statusGlyph = (status: AgentStatus): PixelMatrix => STATUS_GLYPHS[status] ?? STATUS_GLYPHS.idle;

export const furnitureSprite = (name: keyof typeof FURNITURE): PixelMatrix => FURNITURE[name];

/** Tema de color que corresponde a un estado (para los globos de la oficina). */
export const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: '#8fa7b8',
  working: '#4fd6ff',
  thinking: '#5b9bff',
  collaborating: '#a98bff',
  completed: '#5ce08a',
  error: '#d03b3b',
  offline: '#7a8fa3',
};

export { BODY_SLIM, BODY_BROAD, HAIR_SHORT, HAIR_LONG, HAIR_TIED, FURNITURE, STATUS_GLYPHS };
