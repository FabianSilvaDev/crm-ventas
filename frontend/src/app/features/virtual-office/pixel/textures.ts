/**
 * Cache de texturas de PixiJS.
 *
 * Cada matriz de pixeles se dibuja una sola vez en un canvas de 1 pixel por celda y
 * se convierte en una textura con muestreo `nearest`. Las texturas se reutilizan por
 * clave (avatar, estado, mueble), de modo que dos agentes con el mismo aspecto no
 * generan dos texturas distintas y el escenario tiene un numero de texturas acotado.
 */
import { Texture } from 'pixi.js';
import type { AgentAvatar, AgentStatus } from '../../../core/models/agents.model';
import {
  type FurnitureName,
  STATUS_COLOR,
  buildAgentSprite,
  furnitureSprite,
  statusGlyph,
} from '../../../shared/pixel/agent-sprites';
import { toCanvas } from '../../../shared/pixel/pixel-art';
import { ICONS, type PixelIconName } from '../../../shared/pixel/icons';

const textures = new Map<string, Texture>();

const remember = (key: string, canvas: HTMLCanvasElement): Texture => {
  const cached = textures.get(key);
  if (cached) return cached;

  const texture = Texture.from(canvas);
  // Sin suavizado: el pixel art debe escalar en bloques.
  texture.source.scaleMode = 'nearest';
  textures.set(key, texture);
  return texture;
};

/** Clave estable de un avatar: dos agentes con el mismo aspecto comparten textura. */
const avatarKey = (avatar: AgentAvatar): string =>
  `avatar:${avatar.body}:${avatar.palette}:${avatar.hair}:${avatar.skin}:${avatar.accessory}`;

/** Textura del personaje compuesto (cuerpo + peinado + accesorio). */
export const agentTexture = (avatar: AgentAvatar): Texture =>
  remember(avatarKey(avatar), toCanvas(buildAgentSprite(avatar)));

/** Textura del globo de estado, tintado con el color del estado. */
export const statusTexture = (status: AgentStatus): Texture =>
  remember(`status:${status}`, toCanvas(statusGlyph(status), { accent: STATUS_COLOR[status] }));

/** Textura de un mueble del escenario. */
export const furnitureTexture = (name: FurnitureName): Texture =>
  remember(`furniture:${name}`, toCanvas(furnitureSprite(name)));

/** Textura de un icono de la interfaz, por si la oficina necesita dibujarlos dentro del lienzo. */
export const iconTexture = (name: PixelIconName, accent = 'cyan'): Texture =>
  remember(`icon:${name}:${accent}`, toCanvas(ICONS[name], { accent }));

/** Numero de texturas en cache; se publica en el HUD como diagnostico. */
export const textureCount = (): number => textures.size;

/** Libera todas las texturas (al desmontar la vista). */
export const disposeTextures = (): void => {
  for (const texture of textures.values()) texture.destroy(true);
  textures.clear();
};
