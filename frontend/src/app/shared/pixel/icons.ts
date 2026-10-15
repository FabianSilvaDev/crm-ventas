/**
 * Iconos de la interfaz (12x12) dibujados como matrices de pixeles.
 *
 * Se renderizan a SVG desde `PixelIcon`, asi que heredan el aspecto pixel art del
 * resto del proyecto y no anaden ficheros ni peticiones remotas.
 *
 * Tokens: '.' transparente, 'o' contorno, 'A' acento, 'w' claro, 'y' calido, 'g' metal.
 */
import { type PixelMatrix, assertMatrix } from './pixel-art';

const GRID: PixelMatrix = [
  '............',
  '.oooo..oooo.',
  '.oAAo..oAAo.',
  '.oAAo..oAAo.',
  '.oooo..oooo.',
  '............',
  '.oooo..oooo.',
  '.oAAo..oAAo.',
  '.oAAo..oAAo.',
  '.oooo..oooo.',
  '............',
  '............',
];

const OFFICE: PixelMatrix = [
  '............',
  '..oooooooo..',
  '..oyyyyyyo..',
  '..oyoyooyo..',
  '..oyyyyyyo..',
  '..oyoyooyo..',
  '..oyyyyyyo..',
  '..oooooooo..',
  '............',
  '............',
  '............',
  '............',
];

const FLOW: PixelMatrix = [
  '............',
  '.oooo.......',
  '.oAAo.......',
  '.oooo.......',
  '..o.........',
  '..ooooooo...',
  '........o...',
  '......oooo..',
  '......oAAo..',
  '......oooo..',
  '............',
  '............',
];

const AGENTS: PixelMatrix = [
  '............',
  '.....oo.....',
  '....osso....',
  '....osso....',
  '.....oo.....',
  '...oooooo...',
  '..oAAAAAAo..',
  '.oAAAAAAAAo.',
  '.oAAAAAAAAo.',
  '..oAAAAAAo..',
  '............',
  '............',
];

const RESEARCH: PixelMatrix = [
  '............',
  '...oooo.....',
  '..oggggo....',
  '.ogggggo....',
  '.ogggggo....',
  '..oggggo....',
  '...oooogo...',
  '.......ogo..',
  '........oo..',
  '............',
  '............',
  '............',
];

const PRODUCTS: PixelMatrix = [
  '............',
  '...oooooo...',
  '..oyyyyyyo..',
  '.oyyyyyyyyo.',
  '.oywwwwwwyo.',
  '.oywAAAAwyo.',
  '.oywwwwwwyo.',
  '.oyyyyyyyyo.',
  '.oyyyyyyyyo.',
  '..oyyyyyyo..',
  '..oooooooo..',
  '............',
];

const CONTENT: PixelMatrix = [
  '............',
  '..oooooooo..',
  '..owwwwwwo..',
  '..owAAAwwo..',
  '..owwwwwwo..',
  '..owAwAwwo..',
  '..owwwwwwo..',
  '..owAAAwwo..',
  '..owwwwwwo..',
  '..oooooooo..',
  '............',
  '............',
];

const LANDING: PixelMatrix = [
  '............',
  'oooooooooooo',
  'oyyyyyyyyyyo',
  'oooooooooooo',
  'owwwwwwwwwwo',
  'owAAwwwwwwwo',
  'owwwwwwwwwwo',
  'owwwAAAAwwwo',
  'owwwwwwwwwwo',
  'oooooooooooo',
  '............',
  '............',
];

const CAMPAIGNS: PixelMatrix = [
  '............',
  '.......ooo..',
  '......oyyyo.',
  '.....oyyyyo.',
  'oooooyyyyyo.',
  'oAAAoyyyyo..',
  'oAAAoyyyo...',
  'oooooyyo....',
  '.....oo.....',
  '...oo.......',
  '............',
  '............',
];

const LEADS: PixelMatrix = [
  '............',
  '...oooooo...',
  '..oyyyyyyo..',
  '.oyyoAAoyyo.',
  '.oyoAAAAoyo.',
  '.oyoAAAAoyo.',
  '.oyyoAAoyyo.',
  '..oyyyyyyo..',
  '...oooooo...',
  '............',
  '............',
  '............',
];

const ANALYTICS: PixelMatrix = [
  '............',
  '.........AA.',
  '.........AA.',
  '......AA.AA.',
  '......AA.AA.',
  '...AA.AA.AA.',
  '...AA.AA.AA.',
  'oooooooooooo',
  '............',
  '............',
  '............',
  '............',
];

const SETTINGS: PixelMatrix = [
  '............',
  '....oAAo....',
  '..ooAAAAoo..',
  '..oAAAAAAo..',
  '.ooAAAAAAoo.',
  '.oAAAAAAAAo.',
  '.ooAAAAAAoo.',
  '..oAAAAAAo..',
  '..ooAAAAoo..',
  '....oAAo....',
  '............',
  '............',
];

const SEARCH: PixelMatrix = [
  '............',
  '...oooo.....',
  '..owwwwo....',
  '.owwoowwo...',
  '.owwoowwo...',
  '..owwwwo....',
  '...oooowo...',
  '.......owo..',
  '........oo..',
  '............',
  '............',
  '............',
];

const BELL: PixelMatrix = [
  '............',
  '.....oo.....',
  '....oAAo....',
  '...oAAAAo...',
  '..oAAAAAAo..',
  '..oAAAAAAo..',
  '..oAAAAAAo..',
  '..oAAAAAAo..',
  '.ooAAAAAAoo.',
  '............',
  '....oooo....',
  '............',
];

const DEMO_TAG: PixelMatrix = [
  '............',
  'oooooooooooo',
  'oyyyyyyyyyyo',
  'oyoAAAAAAoyo',
  'oyoAAAAAAoyo',
  'oyyyyyyyyyyo',
  'oooooooooooo',
  '............',
  '............',
  '............',
  '............',
  '............',
];

/** Aviso: triangulo con exclamacion (senales y bandeja de demostracion). */
const WARNING: PixelMatrix = [
  '............',
  '.....oo.....',
  '....oAAo....',
  '....oAAo....',
  '...oAAAAo...',
  '...oAooAo...',
  '..oAAAAAAo..',
  '..oAooooAo..',
  '..oAAAAAAo..',
  '.oAAAAAAAAo.',
  '..oooooooo..',
  '............',
];

const CHECK: PixelMatrix = [
  '............',
  '............',
  '..........wo',
  '.........wwo',
  '..w.....wwo.',
  '..ww...wwo..',
  '...ww.ww o..',
  '....wwwwo...',
  '.....wwo....',
  '............',
  '............',
  '............',
];

const CROSS: PixelMatrix = [
  '............',
  '..oooo..oooo',
  '..oAAo..oAAo',
  '...oAAooAAo.',
  '....oAAAAo..',
  '.....oAAo...',
  '....oAAAAo..',
  '...oAAooAAo.',
  '..oAAo..oAAo',
  '..oooo..oooo',
  '............',
  '............',
];

const PLAY: PixelMatrix = [
  '............',
  '...oo.......',
  '...oAo......',
  '...oAAo.....',
  '...oAAAo....',
  '...oAAAAo...',
  '...oAAAo....',
  '...oAAo.....',
  '...oAo......',
  '...oo.......',
  '............',
  '............',
];

const PAUSE: PixelMatrix = [
  '............',
  '..ooo..ooo..',
  '..oAo..oAo..',
  '..oAo..oAo..',
  '..oAo..oAo..',
  '..oAo..oAo..',
  '..oAo..oAo..',
  '..oAo..oAo..',
  '..ooo..ooo..',
  '............',
  '............',
  '............',
];

const RESET: PixelMatrix = [
  '............',
  '....oooo....',
  '..ooAAAAoo..',
  '.oAAooooAAo.',
  '.oAo....oAo.',
  '.oAo........',
  '.oAAo.......',
  '..oo........',
  '............',
  '............',
  '............',
  '............',
];

const OFFICE_ZOOM: PixelMatrix = [
  '............',
  '..oooooooo..',
  '..oAAAAAAo..',
  '..oAoAAoAo..',
  '..oAAAAAAo..',
  '..oAoAAoAo..',
  '..oAAAAAAo..',
  '..oooooooo..',
  '...o....o...',
  '...o....o...',
  '............',
  '............',
];

/** Marca del proyecto: cabeza de agente con antena. */
const LOGO: PixelMatrix = [
  '................',
  '.......oo.......',
  '.......oo.......',
  '..oooooooooooo..',
  '..oAAAAAAAAAAo..',
  '..oAwwAAAAwwAo..',
  '..oAwwAAAAwwAo..',
  '..oAAAAAAAAAAo..',
  '..oAooooooooAo..',
  '..oAAAAAAAAAAo..',
  '..oooooooooooo..',
  '................',
  '................',
  '................',
  '................',
  '................',
];

/** Oportunidad: bombilla encendida. */
const OPPORTUNITY: PixelMatrix = [
  '............',
  '.....oo.....',
  '....oAAo....',
  '...oAAAAo...',
  '...oAAAAo...',
  '...oAAAAo...',
  '....oAAo....',
  '....oooo....',
  '....oAAo....',
  '.....oo.....',
  '............',
  '............',
];

export const ICONS = {
  'logo': LOGO,
  'opportunity': OPPORTUNITY,
  'grid': GRID,
  'office': OFFICE,
  'flow': FLOW,
  'agents': AGENTS,
  'research': RESEARCH,
  'products': PRODUCTS,
  'content': CONTENT,
  'landing': LANDING,
  'campaigns': CAMPAIGNS,
  'leads': LEADS,
  'analytics': ANALYTICS,
  'settings': SETTINGS,
  'search': SEARCH,
  'bell': BELL,
  'demo': DEMO_TAG,
  'warning': WARNING,
  'check': CHECK,
  'cross': CROSS,
  'play': PLAY,
  'pause': PAUSE,
  'reset': RESET,
  'office-zoom': OFFICE_ZOOM,
} as const;

export type PixelIconName = keyof typeof ICONS;

for (const [name, matrix] of Object.entries(ICONS)) assertMatrix(matrix, `ICONS.${name}`);
