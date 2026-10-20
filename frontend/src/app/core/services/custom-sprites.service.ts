/**
 * Sprites propios de los agentes, con animacion opcional.
 *
 * El manifiesto (`assets/agents/manifest.json`) admite tres formas por agente:
 *
 *   "agt-020": "assets/agents/agt-020.png"
 *   "agt-021": { "src": "...", "cell": 64, "row": 10, "frame": 0 }
 *   "agt-022": { "src": "...", "cell": 64, "row": 10, "frames": 9, "fps": 8 }
 *
 * La tercera es la buena para **LPC**: `row` es la fila de "caminar hacia abajo" y de ahi
 * se derivan las cuatro direcciones (arriba = row-2, izquierda = row-1, derecha = row+1),
 * que es el orden del layout de LPC. Si la hoja solo tiene una direccion, todas apuntan a
 * la misma fila y el personaje camina "hacia delante" siempre.
 *
 * Los frames de una misma direccion se recortan con **una caja comun**: si cada frame se
 * recortara por separado, el personaje temblaria al alternarlos.
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { type Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export type Direction = 'up' | 'down' | 'left' | 'right';

/** Entrada del manifiesto (una celda o una animacion de varias). */
export interface SpriteDescriptor {
  src: string;
  /** Lado de la celda en pixeles. LPC usa 64. */
  cell?: number;
  /** Fila de la direccion "abajo" (LPC: walk-down es 10 en la hoja completa). */
  row?: number;
  /** Columnas a usar. 1 = sprite estatico. */
  frame?: number;
  frames?: number;
  fps?: number;
  /** Filas explicitas por direccion, si el layout no es el de LPC. */
  rows?: Partial<Record<Direction, number>>;
}

export type SpriteEntry = string | SpriteDescriptor;

/** Animacion lista para el escenario: frames por direccion. */
export interface SpriteAnimation {
  fps: number;
  directions: Partial<Record<Direction, HTMLCanvasElement[]>>;
}

export interface SpriteSet {
  /** Fotograma de pie (abajo, frame 0), para los avatares y para estar sentado. */
  still: HTMLCanvasElement;
  /** Ciclo de caminar, si la hoja trae varios frames. */
  animation: SpriteAnimation | null;
}

interface SpriteManifest {
  sprites: Record<string, SpriteEntry>;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    image.src = src;
  });

const createCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context) context.imageSmoothingEnabled = false;
  return canvas;
};

/** Caja de pixeles no transparentes de un frame concreto de la hoja. */
const frameBounds = (image: HTMLImageElement, cell: number, row: number, frame: number) => {
  const canvas = createCanvas(cell, cell);
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.drawImage(image, frame * cell, row * cell, cell, cell, 0, 0, cell, cell);
  const data = context.getImageData(0, 0, cell, cell).data;

  let minX = cell;
  let minY = cell;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < cell; y += 1) {
    for (let x = 0; x < cell; x += 1) {
      if (data[(y * cell + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  return maxX < 0 ? null : { minX, minY, maxX, maxY };
};

/**
 * Recorta los frames de una fila usando una caja COMUN a todos ellos.
 * Asi el personaje no baila al cambiar de fotograma.
 */
const cropFrames = (
  image: HTMLImageElement,
  { cell, row, frames }: { cell: number; row: number; frames: number },
): HTMLCanvasElement[] => {
  const boxes = Array.from({ length: frames }, (_, frame) => frameBounds(image, cell, row, frame)).filter(
    (box): box is NonNullable<typeof box> => box !== null,
  );
  if (boxes.length === 0) return [];

  const box = boxes.reduce(
    (union, current) => ({
      minX: Math.min(union.minX, current.minX),
      minY: Math.min(union.minY, current.minY),
      maxX: Math.max(union.maxX, current.maxX),
      maxY: Math.max(union.maxY, current.maxY),
    }),
    boxes[0],
  );

  const width = box.maxX - box.minX + 1;
  const height = box.maxY - box.minY + 1;

  return Array.from({ length: frames }, (_, frame) => {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    if (context) {
      context.imageSmoothingEnabled = false;
      // Se extrae exactamente la misma ventana para todos los frames.
      context.drawImage(
        image,
        frame * cell + box.minX,
        row * cell + box.minY,
        width,
        height,
        0,
        0,
        width,
        height,
      );
    }
    return canvas;
  });
};

@Injectable({ providedIn: 'root' })
export class CustomSpriteService {
  private readonly http = inject(HttpClient);
  private started = false;

  readonly entries = signal<Record<string, SpriteEntry>>({});
  /** URL para un `<img>`: el PNG tal cual o el fotograma de pie recortado. */
  readonly dataUrls = signal<Record<string, string>>({});
  /** Frames listos para el escenario (canvas). */
  readonly spriteSets = signal<Record<string, SpriteSet>>({});
  readonly loading = signal(false);

  start(): void {
    if (this.started) return;
    this.started = true;

    this.http
      .get<SpriteManifest>('assets/agents/manifest.json')
      .pipe(catchError((): Observable<SpriteManifest> => of({ sprites: {} })))
      .subscribe({
        next: (manifest) => {
          const sprites = manifest?.sprites ?? {};
          this.entries.set(sprites);
          void this.prepare(sprites);
        },
      });
  }

  private async prepare(sprites: Record<string, SpriteEntry>): Promise<void> {
    this.loading.set(true);
    const urls: Record<string, string> = {};
    const sets: Record<string, SpriteSet> = {};

    await Promise.all(
      Object.entries(sprites).map(async ([agentId, entry]) => {
        try {
          if (typeof entry === 'string') {
            const image = await loadImage(entry);
            const canvas = createCanvas(image.width, image.height);
            canvas.getContext('2d')?.drawImage(image, 0, 0);
            urls[agentId] = entry;
            sets[agentId] = { still: canvas, animation: null };
            return;
          }

          const image = await loadImage(entry.src);
          const cell = entry.cell ?? 64;
          const frames = Math.max(1, entry.frames ?? 1);
          const fps = Math.min(30, Math.max(1, entry.fps ?? 8));
          const row = entry.row ?? 0;

          // Layout de LPC: up, left, down, right en filas consecutivas.
          const rowsInSheet = Math.floor(image.height / cell);
          const canDerive = row - 2 >= 0 && row + 1 < rowsInSheet;
          const rows: Record<Direction, number> = entry.rows
            ? {
                up: entry.rows.up ?? row,
                left: entry.rows.left ?? row,
                down: entry.rows.down ?? row,
                right: entry.rows.right ?? row,
              }
            : canDerive
              ? { up: row - 2, left: row - 1, down: row, right: row + 1 }
              : { up: row, left: row, down: row, right: row };

          const directions: Partial<Record<Direction, HTMLCanvasElement[]>> = {};
          for (const direction of ['down', 'up', 'left', 'right'] as Direction[]) {
            const cropped = cropFrames(image, { cell, row: rows[direction], frames });
            if (cropped.length > 0) directions[direction] = cropped;
          }

          const still = directions.down?.[entry.frame ?? 0] ?? directions.down?.[0];
          if (!still) throw new Error('La celda de abajo esta vacia.');

          urls[agentId] = still.toDataURL('image/png');
          sets[agentId] = {
            still,
            animation: frames > 1 ? { fps, directions } : null,
          };
        } catch {
          // Un sprite mal configurado no debe romper nada: ese agente sigue procedural.
        }
      }),
    );

    this.dataUrls.set(urls);
    this.spriteSets.set(sets);
    this.loading.set(false);
  }

  /** URL del sprite propio de un agente, o `null` si no tiene. */
  urlFor(agentId: string | null | undefined): string | null {
    if (!agentId) return null;
    return this.dataUrls()[agentId] ?? null;
  }
}
