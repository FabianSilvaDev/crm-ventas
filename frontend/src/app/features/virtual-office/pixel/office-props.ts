/**
 * Props y tiles de oficina importados de dos packs de OpenGameArt:
 *
 *  - **LPC Revised: The Office** (Eliza Wyatt y Lanea Zimmerman; OGA-BY 3.0): nevera,
 *    cafetera, fotocopiadora, papeleras, retratos, telefonos, portatiles y la mesa.
 *  - **Pixel Art Lab/Office Tiles** (The Leafy Lemur; CC-BY 3.0): suelo y pared.
 *
 * Las hojas originales traen varios fotogramas y variantes en una sola imagen; aqui se
 * declara el recuadro exacto de la pieza que usa el escenario. Se cargan con `Assets`
 * antes de construir las salas, y `office-room.ts` las usa si estan disponibles; si no
 * (por ejemplo, si el PNG no existe), cae al mueble procedural de siempre.
 *
 * Autoria y licencias completas en `public/assets/office/`.
 */
import { Assets, Rectangle, Texture } from 'pixi.js';

export type OfficePropName =
  | 'waterCooler'
  | 'coffeeMaker'
  | 'copyMachine'
  | 'bin'
  | 'portraitA'
  | 'portraitB'
  | 'laptop'
  | 'phone'
  | 'deskOrnate'
  | 'floorTile'
  | 'wallTile';

interface PropFrame {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const BASE = 'assets/office';

/**
 * Recuadros dentro de cada hoja. Los valores salen de inspeccionar los pixeles opacos
 * de cada PNG; no son inventados.
 */
export const OFFICE_PROPS: Record<OfficePropName, PropFrame> = {
  waterCooler: { src: `${BASE}/water-cooler.png`, x: 8, y: 9, width: 18, height: 53 },
  coffeeMaker: { src: `${BASE}/coffee-maker.png`, x: 8, y: 2, width: 15, height: 29 },
  copyMachine: { src: `${BASE}/copy-machine.png`, x: 5, y: 18, width: 53, height: 45 },
  bin: { src: `${BASE}/bins.png`, x: 9, y: 0, width: 14, height: 31 },
  portraitA: { src: `${BASE}/office-portraits.png`, x: 10, y: 5, width: 13, height: 20 },
  portraitB: { src: `${BASE}/office-portraits.png`, x: 41, y: 5, width: 16, height: 20 },
  laptop: { src: `${BASE}/laptop.png`, x: 6, y: 6, width: 19, height: 22 },
  phone: { src: `${BASE}/rotary-phones.png`, x: 10, y: 16, width: 13, height: 14 },
  // Mesa de madera del pack The Office (vista frontal, con los cajones a la vista).
  deskOrnate: { src: `${BASE}/ornate-desk.png`, x: 0, y: 12, width: 96, height: 42 },
  // Suelo y pared del pack Lab/Office Tiles (CC-BY 3.0, The Leafy Lemur), recortados
  // a PNG sueltos de 32x32 para repetirlos con `TilingSprite`. El color final lo pone
  // el tinte del departamento.
  floorTile: { src: `${BASE}/floor-tile.png`, x: 0, y: 0, width: 32, height: 32 },
  wallTile: { src: `${BASE}/wall-tile.png`, x: 0, y: 0, width: 32, height: 32 },
};

const textures = new Map<OfficePropName, Texture>();

/** Carga las hojas y crea un subtexture por pieza. */
export const loadOfficeProps = async (): Promise<void> => {
  // Si el escenario se monta dos veces sin destruirse, no se duplican los subtextures.
  if (textures.size > 0) return;

  const sources = [...new Set(Object.values(OFFICE_PROPS).map((prop) => prop.src))];
  const loaded = new Map<string, Texture>();

  await Promise.all(
    sources.map(async (src) => {
      const texture = await Assets.load<Texture>(src);
      // Pixel art: sin interpolacion al escalar.
      texture.source.scaleMode = 'nearest';
      loaded.set(src, texture);
    }),
  );

  for (const [name, prop] of Object.entries(OFFICE_PROPS) as [OfficePropName, PropFrame][]) {
    const base = loaded.get(prop.src);
    if (!base) continue;

    textures.set(
      name,
      new Texture({
        source: base.source,
        frame: new Rectangle(prop.x, prop.y, prop.width, prop.height),
      }),
    );
  }
};

/** Textura de una pieza, o `null` si no se cargo. */
export const officePropTexture = (name: OfficePropName): Texture | null => textures.get(name) ?? null;

/** Libera los subtextures (las hojas base las gestiona `Assets`). */
export const disposeOfficeProps = (): void => {
  for (const texture of textures.values()) texture.destroy(false);
  textures.clear();
};
