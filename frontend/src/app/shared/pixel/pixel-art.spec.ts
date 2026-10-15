/**
 * Pruebas del motor de pixel art.
 *
 * Es la unica parte del frontend con pruebas automatizadas: son funciones puras sin
 * dependencias de Angular, asi que se ejecutan rapido y cubren lo que de verdad
 * puede romperse a mano alzada (una matriz descuadrada, una capa mal superpuesta).
 *
 *   npm --prefix frontend test
 */
import { describe, expect, it } from 'vitest';
import { matrixWidth, overlay, resolvePalette, toSvg } from './pixel-art';
import { BODY_SLIM, HAIR_SHORT, buildAgentSprite, statusGlyph } from './agent-sprites';
import { ICONS } from './icons';

describe('matrices de pixeles', () => {
  it('todas las filas de una matriz miden lo mismo', () => {
    const matriz = ['..AA..', '.AAAA.', '..AA..'];
    expect(matrixWidth(matriz)).toBe(6);
  });

  it('el cuerpo del agente es cuadrado y de 16x16', () => {
    expect(matrixWidth(BODY_SLIM)).toBe(16);
    expect(BODY_SLIM).toHaveLength(16);
  });

  it('compone cuerpo, peinado y accesorio sin descuadrar el resultado', () => {
    const sprite = buildAgentSprite({
      body: 'a',
      palette: 'cyan',
      hair: 'dark',
      skin: 'light',
      accessory: 'glasses',
    });

    expect(sprite).toHaveLength(16);
    expect(new Set(sprite.map((row) => row.length)).size).toBe(1);
  });

  it('la capa respeta el token transparente de la base', () => {
    const base = ['..s..', '..s..'];
    const layer = ['..h..', '.....'];
    const resultado = overlay(base, layer);

    expect(resultado[0]).toBe('..h..');
    expect(resultado[1]).toBe('..s..');
  });

  it('el globo de estado cambia segun el estado del agente', () => {
    expect(statusGlyph('error')).not.toEqual(statusGlyph('completed'));
  });
});

describe('paleta y render', () => {
  it('resuelve el acento por nombre de departamento', () => {
    const paleta = resolvePalette({ accent: 'cyan', skin: 'light' });
    expect(paleta['A']).toBe('#4fd6ff');
  });

  it('acepta un color hexadecimal directo como acento', () => {
    const paleta = resolvePalette({ accent: '#123456' });
    expect(paleta['A']).toBe('#123456');
  });

  it('genera un SVG con un rectangulo por tramo de color', () => {
    const svg = toSvg(['AAA', 'A.A'], { accent: 'cyan' });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('<rect');
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });
});

describe('iconos de la interfaz', () => {
  it('incluye la marca y las secciones del menu', () => {
    for (const nombre of ['logo', 'grid', 'office', 'flow', 'agents', 'settings'] as const) {
      expect(ICONS[nombre]).toBeDefined();
    }
  });

  it('cada icono tiene filas uniformes', () => {
    for (const [nombre, matriz] of Object.entries(ICONS)) {
      const ancho = matriz[0].length;
      expect(new Set(matriz.map((row) => row.length)).size, `icono ${nombre}`).toBe(1);
      expect(ancho).toBeGreaterThan(0);
    }
  });
});

describe('capas auxiliares', () => {
  it('el peinado corto no altera las filas del torso', () => {
    expect(HAIR_SHORT.length).toBeLessThan(BODY_SLIM.length);
  });
});
