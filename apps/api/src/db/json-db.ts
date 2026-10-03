import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Mínimo contrato de toda fila JSON: debe tener un id. */
export interface WithId {
  readonly id: string;
}

/** Mutex async muy ligero. Encola operaciones para evitar escrituras concurrentes a un mismo archivo. */
class Lock {
  private promise: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.promise.then(() => fn());
    // Si la operación falla, la cadena no se rompe: el siguiente `run` puede intentarlo.
    this.promise = next.catch(() => undefined);
    return next;
  }
}

/**
 * Base de datos JSON muy pequeña para la Fase 1.
 *
 * - Cada tabla es un archivo independiente.
 * - La escritura es atómica (archivo temporal + rename).
 * - Mantiene una caché en memoria después de la primera carga; las escrituras refrescan el archivo.
 * - La concurrencia se serializa por tabla con un lock en memoria.
 *
 * Limitaciones aceptadas: no escala, no soporta múltiples procesos concurrentes, no tiene índices.
 * Su único propósito es sobrevivir a reinicios del API mientras se construye Prisma.
 */
export class JsonDb<T extends WithId> {
  private data: T[] | null = null;
  private readonly lock = new Lock();

  constructor(private readonly filePath: string) {}

  private async load(): Promise<T[]> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      return JSON.parse(raw) as T[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  private async save(items: T[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.tmp`;
    await writeFile(temp, `${JSON.stringify(items, null, 2)}\n`, 'utf-8');
    await rename(temp, this.filePath);
  }

  private async ensureLoaded(): Promise<T[]> {
    if (this.data === null) {
      this.data = await this.load();
    }
    return this.data;
  }

  async findAll(): Promise<T[]> {
    return this.lock.run(async () => {
      const items = await this.ensureLoaded();
      return [...items];
    });
  }

  async findById(id: string): Promise<T | undefined> {
    return this.lock.run(async () => {
      const items = await this.ensureLoaded();
      return items.find((item) => item.id === id);
    });
  }

  async findOne(predicate: (item: T) => boolean): Promise<T | undefined> {
    return this.lock.run(async () => {
      const items = await this.ensureLoaded();
      return items.find(predicate);
    });
  }

  async insert(item: T): Promise<T> {
    return this.lock.run(async () => {
      const items = await this.ensureLoaded();
      if (items.some((i) => i.id === item.id)) {
        throw new Error(`JsonDb: id duplicado ${item.id}`);
      }
      items.push(item);
      await this.save(items);
      return item;
    });
  }

  async update(id: string, patch: Partial<T>): Promise<T | undefined> {
    return this.lock.run(async () => {
      const items = await this.ensureLoaded();
      const index = items.findIndex((i) => i.id === id);
      if (index === -1) {
        return undefined;
      }
      items[index] = { ...items[index], ...patch, id } as T;
      await this.save(items);
      return items[index];
    });
  }

  async upsert(item: T): Promise<T> {
    return this.lock.run(async () => {
      const items = await this.ensureLoaded();
      const index = items.findIndex((i) => i.id === item.id);
      if (index === -1) {
        items.push(item);
      } else {
        items[index] = { ...items[index], ...item };
      }
      await this.save(items);
      return items[index]!;
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.lock.run(async () => {
      const items = await this.ensureLoaded();
      const index = items.findIndex((i) => i.id === id);
      if (index === -1) {
        return false;
      }
      items.splice(index, 1);
      await this.save(items);
      return true;
    });
  }

  async count(): Promise<number> {
    return this.lock.run(async () => {
      const items = await this.ensureLoaded();
      return items.length;
    });
  }
}
