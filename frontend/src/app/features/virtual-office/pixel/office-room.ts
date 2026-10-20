/**
 * Construccion de la oficina open-plan.
 *
 * Ya no hay una sala cerrada por departamento: hay **una sola oficina** con un suelo
 * continuo, una pared perimetral comun y ocho areas separadas por divisiones bajas de
 * cristal y un letrero pequeno. Todas las areas comparten la misma paleta (un unico
 * esquema de color); lo que las distingue es el letrero, el mobiliario y los agentes.
 *
 *   - `buildOfficeShell` dibuja el suelo global, la pared perimetral y el rotulo de la
 *     oficina; se coloca una sola vez, debajo de las areas.
 *   - `buildRoom` dibuja el area de un departamento: cuatro puestos (2x2), zona de
 *     descanso, divisiones de cristal y letrero. En modo area no dibuja suelo ni pared.
 *   - Los agentes se dibujan SENTADOS tras su mesa: la capa de mesas va por encima de
 *     los personajes y les tapa la falda y las piernas.
 *
 * El orden de capas del escenario sigue siendo:
 *   suelo global -> areas -> agentes -> puestos -> paseantes.
 */
import { Container, Graphics, Sprite, Text, TilingSprite } from 'pixi.js';
import type { Department } from '../../../core/models/agents.model';
import { type FurnitureName, AGENT_HEIGHT, AGENT_WIDTH } from '../../../shared/pixel/agent-sprites';
import { furnitureTexture } from './textures';
import { officePropTexture, type OfficePropName } from './office-props';

/** Medidas de la sala, en pixeles. */
export const ROOM_WIDTH = 448;
export const ROOM_HEIGHT = 256;
/** Alto de la banda de pared. */
export const WALL_HEIGHT = 32;
/** Separacion entre salas y margen del mundo. */
export const ROOM_GAP = 48;
export const WORLD_MARGIN = 32;

/** Escala del mobiliario: los sprites miden 32 px de lado. */
export const FURNITURE_SCALE = 2;

/** Puesto de trabajo, en pixeles relativos a la sala. */
export const CUBICLE_WIDTH = 128;
export const CUBICLE_HEIGHT = 96;
const CUBICLES = [
  { x: 16, y: 36 },
  { x: 160, y: 36 },
  { x: 16, y: 148 },
  { x: 160, y: 148 },
];

/** Zona de descanso: alfombra y anclajes del mobiliario. */
const LOUNGE = { x: 296, y: 36, width: 136, height: 208 };

/** Donde se dibuja el personaje dentro de su puesto (esquina superior izquierda). */
export const AGENT_OFFSET = { x: 10, y: 18 };

/**
 * Capa de mesas de una sala.
 * Se reconstruye cuando cambia que puestos estan ocupados, para que la silla aparezca
 * solo en los libres.
 */
export const buildDeskLayer = (_department: Department, occupied: number[]): Container => {
  const accent = OFFICE_ACCENT;
  const layer = new Container();
  const graphics = new Graphics();
  const importedDesk = officePropTexture('deskOrnate');
  const importedLaptop = officePropTexture('laptop');

  CUBICLES.forEach((cubicle, index) => {
    const isOccupied = occupied.includes(index);

    if (importedDesk) {
      // La mesa importada tapa la falda del agente: el puesto parece ocupado sin
      // dibujar el monitor procedural. La silla solo hace falta si esta libre.
      if (!isOccupied) drawEmptyChair(graphics, cubicle);
      return;
    }

    drawWorkstation(graphics, cubicle, accent);
    if (!isOccupied) drawEmptyChair(graphics, cubicle);
  });

  layer.addChild(graphics);

  // Mesas de madera y portatiles importados, encima de las sillas.
  if (importedDesk) {
    for (const cubicle of CUBICLES) {
      const desk = new Sprite(importedDesk);
      // La mesa se baja 8 px respecto al borde del cubículo para no tapar el torso
      // del agente: cubre la falda y las piernas, que es lo que da la sensación de
      // estar sentado, pero deja ver cabeza y pecho.
      desk.position.set(cubicle.x + 16, cubicle.y + 64);
      layer.addChild(desk);

      if (importedLaptop) {
        const laptop = new Sprite(importedLaptop);
        laptop.position.set(cubicle.x + 66, cubicle.y + 62);
        layer.addChild(laptop);
      }
    }
  }

  return layer;
};

/**
 * Paleta unica de la oficina. Todas las areas comparten estos tonos y el mismo acento;
 * lo que cambia entre areas es el letrero y el mobiliario, no el color.
 */
export const OFFICE_TONES = {
  floor: '#182028',
  floorAlt: '#1c2630',
  wall: '#25313b',
  trim: '#33424e',
};

/** Acento unico de la oficina: cristales, letreros y detalles. */
export const OFFICE_ACCENT = '#5fc9e8';

/** Nombres cortos para los letreros de area. */
const AREA_SIGNS: Record<string, string> = {
  'ops-center': 'OPERACIONES',
  'research-lab': 'INVESTIGACIÓN',
  'marketing-studio': 'MARKETING',
  'creative-studio': 'CREATIVO',
  'seo-web-lab': 'SEO / WEB',
  'ad-operations': 'PUBLICIDAD',
  'sales-department': 'VENTAS',
  'analytics-optimization': 'ANALÍTICA',
};

/**
 * Convierte un tono oscuro de la sala en un tinte para un tile gris (los tiles
 * importados rondan el gris 128). Asi cada departamento conserva su color.
 */
const tileTint = (hex: string): number => {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.min(255, ((value >> shift) & 0xff) * 2);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
};

/** Acento del departamento en hexadecimal, para bordes y rotulos. */
export const ACCENT_HEX: Record<string, string> = {
  amber: '#ffc44d',
  cyan: '#4fd6ff',
  violet: '#a98bff',
  pink: '#ff6fa5',
  green: '#5ce08a',
  orange: '#ff8f4d',
  lime: '#b6e34d',
  blue: '#5b9bff',
  gray: '#8fa7b8',
};

/**
 * Mobiliario propio de cada departamento: lo que hace que una sala se reconozca.
 * Los dos primeros van en la zona de descanso y el tercero es el objeto de pared.
 */
const DEPARTMENT_DECOR: Record<string, { lounge: FurnitureName[]; wall: FurnitureName }> = {
  'ops-center': { lounge: ['server', 'printer'], wall: 'whiteboard' },
  'research-lab': { lounge: ['shelf'], wall: 'whiteboard' },
  'marketing-studio': { lounge: ['coffee'], wall: 'shelf' },
  'creative-studio': { lounge: ['sofa'], wall: 'whiteboard' },
  'seo-web-lab': { lounge: ['printer'], wall: 'whiteboard' },
  'ad-operations': { lounge: ['printer', 'coffee'], wall: 'shelf' },
  'sales-department': { lounge: ['coffee'], wall: 'shelf' },
  'analytics-optimization': { lounge: ['shelf'], wall: 'whiteboard' },
};

export interface RoomLayers {
  /** Suelo, pared, paneles y mobiliario decorativo. */
  room: Container;
  /** Mesas, monitores y sillas: van POR ENCIMA de los agentes. */
  desks: Container;
  /** Anclajes de los puestos, para colocar a los agentes. */
  stations: { x: number; y: number }[];
  width: number;
  height: number;
}

/** Dibuja un rectangulo con el borde marcado, al estilo de la interfaz. */
const box = (graphics: Graphics, x: number, y: number, width: number, height: number, fill: string, stroke = '#0a0e13') => {
  graphics.rect(x, y, width, height).fill(fill);
  graphics.rect(x, y, width, height).stroke({ width: 2, color: stroke, alpha: 0.9 });
};

/** Suelo con damero y junta de baldosas. */
const drawFloor = (graphics: Graphics, tones: { floor: string; floorAlt: string }, accent: string) => {
  const floorY = WALL_HEIGHT;
  const floorHeight = ROOM_HEIGHT - WALL_HEIGHT;
  graphics.rect(0, floorY, ROOM_WIDTH, floorHeight).fill(tones.floor);

  for (let tileY = 0; tileY < Math.ceil(floorHeight / 16); tileY += 1) {
    for (let tileX = 0; tileX < Math.ceil(ROOM_WIDTH / 16); tileX += 1) {
      if ((tileX + tileY) % 2 === 0) continue;
      graphics
        .rect(tileX * 16, floorY + tileY * 16, 16, 16)
        .fill({ color: tones.floorAlt, alpha: 0.5 });
    }
  }

  graphics.rect(0, floorY, ROOM_WIDTH, floorHeight).stroke({ width: 2, color: accent, alpha: 0.14 });
};

/** Relleno base de la pared: solo se usa si no hay tile importado. */
const drawWallBase = (graphics: Graphics, tones: { wall: string }) => {
  graphics.rect(0, 0, ROOM_WIDTH, WALL_HEIGHT).fill(tones.wall);
};

/** Ventanas y rodapie, por encima del tile o del relleno base. */
const drawWallDetails = (graphics: Graphics, tones: { trim: string }, accent: string) => {
  // Ventanas: dan la sensacion de que la sala tiene exterior.
  for (const windowX of [24, 168, 312]) {
    graphics.rect(windowX, 6, 68, 18).fill('#0d1a24');
    graphics.rect(windowX + 2, 8, 64, 14).fill('#1d3a4d');
    graphics.rect(windowX + 2, 8, 30, 14).fill({ color: '#2b5a78', alpha: 0.7 });
    graphics.rect(windowX, 6, 68, 18).stroke({ width: 2, color: '#0a0e13', alpha: 0.9 });
  }

  graphics.rect(0, WALL_HEIGHT - 6, ROOM_WIDTH, 6).fill(tones.trim);
  graphics.rect(0, WALL_HEIGHT - 2, ROOM_WIDTH, 2).fill({ color: accent, alpha: 0.55 });
};

/** Panel lateral y trasero de un puesto de trabajo. */
const drawCubiclePanels = (graphics: Graphics, cubicle: { x: number; y: number }, tones: { trim: string }) => {
  // Panel trasero bajo: separa el puesto de la sala.
  graphics.rect(cubicle.x, cubicle.y + 30, CUBICLE_WIDTH, 10).fill(tones.trim);
  graphics.rect(cubicle.x, cubicle.y + 30, CUBICLE_WIDTH, 2).fill({ color: '#0a0e13', alpha: 0.6 });

  // Paneles laterales, que son lo que hace que un puesto parezca un cubiculo.
  graphics.rect(cubicle.x - 6, cubicle.y + 30, 6, 74).fill(tones.trim);
  graphics.rect(cubicle.x + CUBICLE_WIDTH, cubicle.y + 30, 6, 74).fill(tones.trim);
};

/** Mesa, monitor y teclado procedurales (respaldo si no hay piezas importadas). */
const drawWorkstation = (graphics: Graphics, cubicle: { x: number; y: number }, accent: string) => {
  const deskY = cubicle.y + 72;

  // Monitor de espaldas.
  graphics.rect(cubicle.x + 66, cubicle.y + 56, 30, 20).fill('#1a222c');
  graphics.rect(cubicle.x + 66, cubicle.y + 56, 30, 20).stroke({ width: 2, color: '#0a0e13', alpha: 0.9 });
  graphics.rect(cubicle.x + 66, cubicle.y + 56, 30, 4).fill('#2b3846');
  graphics.rect(cubicle.x + 78, cubicle.y + 76, 6, 6).fill('#141a22');

  // Tablero de la mesa, con el canto mas claro.
  graphics.rect(cubicle.x, deskY, CUBICLE_WIDTH, 26).fill('#3a2a1c');
  graphics.rect(cubicle.x, deskY, CUBICLE_WIDTH, 6).fill('#5b432c');
  graphics.rect(cubicle.x, deskY, CUBICLE_WIDTH, 26).stroke({ width: 2, color: '#0a0e13', alpha: 0.9 });

  // Teclado y un par de objetos sobre la mesa.
  graphics.rect(cubicle.x + 16, deskY + 10, 44, 8).fill('#2b3846');
  graphics.rect(cubicle.x + 104, deskY + 10, 14, 8).fill({ color: accent, alpha: 0.75 });
};

/** Silla vacia, delante de la mesa. */
const drawEmptyChair = (graphics: Graphics, cubicle: { x: number; y: number }) => {
  const chairX = cubicle.x + 48;
  const chairY = cubicle.y + 72 + 22;
  graphics.rect(chairX + 10, chairY, 12, 18).fill('#26333f');
  graphics.rect(chairX + 4, chairY + 18, 24, 8).fill('#2f3f4d');
  graphics.rect(chairX + 14, chairY + 26, 4, 14).fill('#26333f');
  graphics.rect(chairX, chairY + 40, 32, 5).fill('#26333f');
};

/** Zona de descanso: solo un contorno tenue, para no romper el suelo unico. */
const drawLounge = (graphics: Graphics, accent: string) => {
  graphics
    .rect(LOUNGE.x - 8, LOUNGE.y - 8, LOUNGE.width + 16, LOUNGE.height + 16)
    .stroke({ width: 1, color: accent, alpha: 0.14 });
};

/** Divisiones bajas de cristal que separan un area de las demas. */
const drawAreaDividers = (graphics: Graphics, accent: string) => {
  const glass = (x: number, y: number, width: number, height: number) => {
    graphics.rect(x, y, width, height).fill({ color: '#4f7f92', alpha: 0.16 });
    graphics.rect(x, y, width, height).stroke({ width: 1, color: accent, alpha: 0.5 });
  };

  const opening = 80;
  const half = ROOM_WIDTH / 2;

  // Banda superior, con una abertura central de acceso al area.
  glass(0, 0, half - opening / 2, 6);
  glass(half + opening / 2, 0, half - opening / 2, 6);

  // Banda izquierda, con una abertura a la altura del pasillo.
  glass(0, 0, 6, 100);
  glass(0, 180, 6, ROOM_HEIGHT - 180);
};

/** Letrero pequeno del area, sobre la division superior. */
const drawAreaSign = (room: Container, department: Department, accent: string) => {
  const name = AREA_SIGNS[department.id] ?? department.name.toUpperCase();
  const width = Math.max(88, name.length * 6 + 34);

  const plate = new Graphics();
  plate.roundRect(12, 4, width, 18, 3).fill({ color: '#0d141a', alpha: 0.9 });
  plate.roundRect(12, 4, width, 18, 3).stroke({ width: 1, color: accent, alpha: 0.55 });
  plate.rect(12, 22, width, 2).fill({ color: accent, alpha: 0.35 });
  room.addChild(plate);

  const label = new Text({
    text: name,
    style: {
      fontFamily: '"Cascadia Mono", Consolas, monospace',
      fontSize: 9,
      fontWeight: 'bold',
      fill: '#dfeaf0',
      letterSpacing: 0.5,
    },
  });
  label.position.set(20, 7);
  room.addChild(label);

  const count = new Text({
    text: `${department.stats.agentCount}`,
    style: {
      fontFamily: '"Cascadia Mono", Consolas, monospace',
      fontSize: 8,
      fill: accent,
    },
  });
  count.anchor.set(1, 0);
  count.position.set(12 + width - 8, 8);
  room.addChild(count);
};

/**
 * Muebles procedurales que tienen una pieza equivalente en el pack de oficina.
 * Si el PNG esta cargado se usa la pieza importada; si no, el mueble procedural.
 */
const PROP_FOR_FURNITURE: Partial<Record<FurnitureName, OfficePropName>> = {
  printer: 'copyMachine',
  coffee: 'coffeeMaker',
  watercooler: 'waterCooler',
};

/** Coloca un mueble a partir de su sprite, escalado y alineado por su base. */
const placeFurniture = (layer: Container, name: FurnitureName, x: number, y: number) => {
  const propName = PROP_FOR_FURNITURE[name];
  const imported = propName ? officePropTexture(propName) : null;
  const sprite = new Sprite(imported ?? furnitureTexture(name));

  // Las piezas importadas ya estan a la escala de los agentes (1x); las matrices
  // procedurales miden 32 px y se dibujan al doble.
  sprite.scale.set(imported ? 1 : FURNITURE_SCALE);
  sprite.position.set(x, y - sprite.height);
  layer.addChild(sprite);
  return sprite;
};

/** Coloca una pieza importada. `align` indica si `y` es la base o el borde superior. */
const placeProp = (
  layer: Container,
  name: OfficePropName,
  x: number,
  y: number,
  align: 'bottom' | 'top' = 'bottom',
) => {
  const texture = officePropTexture(name);
  if (!texture) return null;

  const sprite = new Sprite(texture);
  sprite.position.set(x, align === 'bottom' ? y - sprite.height : y);
  layer.addChild(sprite);
  return sprite;
};

export interface RoomOptions {
  /** Dibuja el suelo del area. false cuando la oficina tiene un suelo global. */
  floor?: boolean;
  /** Dibuja la pared y las ventanas del area. false en la oficina open-plan. */
  wall?: boolean;
  /** 'room' = cabecera grande de sala; 'area' = letrero pequeno de area. */
  sign?: 'room' | 'area';
}

/**
 * Construye el area de un departamento.
 * @param department Departamento al que pertenece el area.
 * @param occupied Indices de los puestos ocupados (los que tienen agente).
 * @param options Suelo, pared y estilo de rotulo. En la oficina open-plan se usa
 *   `{ floor: false, wall: false, sign: 'area' }`.
 */
export const buildRoom = (department: Department, occupied: number[], options: RoomOptions = {}): RoomLayers => {
  const { floor = true, wall = true, sign = 'room' } = options;
  const tones = OFFICE_TONES;
  const accent = OFFICE_ACCENT;

  const room = new Container();
  const desks = new Container();

  // Suelo del area: solo si el area no comparte el suelo global de la oficina.
  const floorTexture = floor ? officePropTexture('floorTile') : null;
  if (floor && floorTexture) {
    const floorSprite = new TilingSprite({ texture: floorTexture, width: ROOM_WIDTH, height: ROOM_HEIGHT - WALL_HEIGHT });
    floorSprite.position.set(0, WALL_HEIGHT);
    floorSprite.tint = tileTint(tones.floor);
    room.addChild(floorSprite);
  }

  // Pared del area: solo si no hay pared perimetral global.
  const wallTexture = wall ? officePropTexture('wallTile') : null;
  if (wall && wallTexture) {
    const wallSprite = new TilingSprite({ texture: wallTexture, width: ROOM_WIDTH, height: WALL_HEIGHT });
    wallSprite.tint = tileTint(tones.wall);
    room.addChild(wallSprite);
  }

  const shell = new Graphics();
  if (floor && !floorTexture) drawFloor(shell, tones, accent);
  if (floor && floorTexture) {
    shell.rect(0, WALL_HEIGHT, ROOM_WIDTH, ROOM_HEIGHT - WALL_HEIGHT).stroke({ width: 2, color: accent, alpha: 0.14 });
  }
  if (wall && !wallTexture) drawWallBase(shell, tones);
  if (wall) drawWallDetails(shell, tones, accent);
  if (sign === 'area') drawAreaDividers(shell, accent);
  for (const cubicle of CUBICLES) drawCubiclePanels(shell, cubicle, tones);
  drawLounge(shell, accent);
  room.addChild(shell);

  if (sign === 'area') {
    drawAreaSign(room, department, accent);
  } else {
    // Cabecera grande, para el modo sala clasico.
    const label = new Text({
      text: department.name.toUpperCase(),
      style: {
        fontFamily: '"Cascadia Mono", Consolas, monospace',
        fontSize: 11,
        fontWeight: 'bold',
        fill: '#e8f2f8',
        letterSpacing: 0.6,
      },
    });
    label.position.set(10, 6);
    room.addChild(label);

    const headcount = new Text({
      text: `${department.stats.agentCount} agentes · ${department.stats.active} activos`,
      style: { fontFamily: '"Cascadia Mono", Consolas, monospace', fontSize: 9, fill: accent },
    });
    headcount.anchor.set(1, 0);
    headcount.position.set(ROOM_WIDTH - 10, 8);
    room.addChild(headcount);
  }

  // Mobiliario decorativo del departamento, en los anclajes de la zona de descanso.
  const decor = DEPARTMENT_DECOR[department.id] ?? DEPARTMENT_DECOR['research-lab'];
  placeFurniture(room, 'sofa', LOUNGE.x + 8, LOUNGE.y + 72);
  placeFurniture(room, 'table', LOUNGE.x + 8, LOUNGE.y + 144);
  if (decor.lounge[0]) placeFurniture(room, decor.lounge[0], LOUNGE.x + 72, LOUNGE.y + 144);
  if (decor.lounge[1]) placeFurniture(room, decor.lounge[1], LOUNGE.x + 8, LOUNGE.y + 212);

  // Objeto de pared y retratos: solo si el area tiene pared propia.
  if (wall) {
    const wallItem = new Sprite(furnitureTexture(decor.wall));
    wallItem.scale.set(FURNITURE_SCALE);
    wallItem.position.set(ROOM_WIDTH - 88, WALL_HEIGHT - wallItem.height + 14);
    room.addChild(wallItem);

    placeProp(room, 'portraitA', 120, 6, 'top');
    placeProp(room, 'portraitB', 140, 6, 'top');
  }

  // Props importados: nevera de agua y papelera.
  placeProp(room, 'waterCooler', LOUNGE.x + 120, LOUNGE.y + 212);
  placeProp(room, 'bin', 10, WALL_HEIGHT + 33);

  // Mesas y monitores, en su propia capa: van por encima de los agentes.
  desks.addChild(buildDeskLayer(department, occupied));

  // Los portatiles los coloca buildDeskLayer sobre cada mesa importada. Aqui solo
  // se anaden telefonos a dos puestos, sobre la superficie de la mesa.
  if (officePropTexture('deskOrnate')) {
    const deskProps: { cubicle: number; prop: OfficePropName; offsetX: number }[] = [
      { cubicle: 1, prop: 'phone', offsetX: 88 },
      { cubicle: 2, prop: 'phone', offsetX: 88 },
    ];
    for (const { cubicle, prop, offsetX } of deskProps) {
      const station = CUBICLES[cubicle];
      placeProp(desks, prop, station.x + offsetX, station.y + 66, 'top');
    }
  }

  return {
    room,
    desks,
    stations: CUBICLES.map((cubicle) => ({ x: cubicle.x + AGENT_OFFSET.x, y: cubicle.y + AGENT_OFFSET.y })),
    width: ROOM_WIDTH,
    height: ROOM_HEIGHT,
  };
};

/**
 * Suelo continuo, pared perimetral y rotulo de la oficina.
 * Se coloca una sola vez, debajo de todas las areas.
 */
export const buildOfficeShell = (width: number, height: number): Container => {
  const container = new Container();

  // Suelo global: el mismo tile para toda la oficina.
  const floorTexture = officePropTexture('floorTile');
  if (floorTexture) {
    const floor = new TilingSprite({ texture: floorTexture, width, height });
    floor.tint = tileTint(OFFICE_TONES.floor);
    container.addChild(floor);
  } else {
    const fallback = new Graphics();
    fallback.rect(0, 0, width, height).fill(OFFICE_TONES.floor);
    container.addChild(fallback);
  }

  // Pared perimetral superior.
  const wallTexture = officePropTexture('wallTile');
  if (wallTexture) {
    const wall = new TilingSprite({ texture: wallTexture, width, height: WALL_HEIGHT });
    wall.tint = tileTint(OFFICE_TONES.wall);
    container.addChild(wall);
  }

  const shell = new Graphics();
  if (!wallTexture) shell.rect(0, 0, width, WALL_HEIGHT).fill(OFFICE_TONES.wall);

  // Ventanales repartidos por la fachada.
  for (let x = 40; x + 120 < width; x += 240) {
    shell.rect(x, 6, 120, 18).fill('#0d1a24');
    shell.rect(x + 2, 8, 116, 14).fill('#1d3a4d');
    shell.rect(x + 2, 8, 56, 14).fill({ color: '#2b5a78', alpha: 0.7 });
    shell.rect(x, 6, 120, 18).stroke({ width: 2, color: '#0a0e13', alpha: 0.9 });
  }

  // Marcos laterales e inferior, para cerrar la planta.
  shell.rect(0, 0, 6, height).fill(OFFICE_TONES.wall);
  shell.rect(width - 6, 0, 6, height).fill(OFFICE_TONES.wall);
  shell.rect(0, height - 6, width, 6).fill(OFFICE_TONES.wall);

  // Rodapie comun y borde perimetral.
  shell.rect(0, WALL_HEIGHT - 6, width, 6).fill(OFFICE_TONES.trim);
  shell.rect(0, WALL_HEIGHT - 2, width, 2).fill({ color: OFFICE_ACCENT, alpha: 0.5 });
  shell.rect(0, 0, width, height).stroke({ width: 2, color: '#0a0e13', alpha: 0.9 });
  container.addChild(shell);

  // Rotulo central de la oficina, sobre la pared.
  const plateWidth = 220;
  const plate = new Graphics();
  plate.roundRect(width / 2 - plateWidth / 2, 4, plateWidth, 22, 3).fill({ color: '#0d141a', alpha: 0.92 });
  plate.roundRect(width / 2 - plateWidth / 2, 4, plateWidth, 22, 3).stroke({ width: 1, color: OFFICE_ACCENT, alpha: 0.55 });
  container.addChild(plate);

  const title = new Text({
    text: 'OFICINA CENTRAL',
    style: {
      fontFamily: '"Cascadia Mono", Consolas, monospace',
      fontSize: 13,
      fontWeight: 'bold',
      fill: '#dfeaf0',
      letterSpacing: 2,
    },
  });
  title.anchor.set(0.5, 0);
  title.position.set(width / 2, 8);
  container.addChild(title);

  return container;
};

/** Cuantos puestos tiene una sala. */
export const CUBICLE_COUNT = CUBICLES.length;

/** Tamano del mundo para una rejilla de salas. */
export const worldSize = (grid: { columns: number; rows: number }) => ({
  width: WORLD_MARGIN * 2 + grid.columns * ROOM_WIDTH + (grid.columns - 1) * ROOM_GAP,
  height: WORLD_MARGIN * 2 + grid.rows * ROOM_HEIGHT + (grid.rows - 1) * ROOM_GAP,
});

/** Esquina superior izquierda de una sala dentro del mundo. */
export const roomPosition = (department: Department, grid: { columns: number; rows: number }) => ({
  x: WORLD_MARGIN + Math.min(department.room.col, grid.columns - 1) * (ROOM_WIDTH + ROOM_GAP),
  y: WORLD_MARGIN + Math.min(department.room.row, grid.rows - 1) * (ROOM_HEIGHT + ROOM_GAP),
});

export { CUBICLES, LOUNGE, AGENT_WIDTH, AGENT_HEIGHT };
