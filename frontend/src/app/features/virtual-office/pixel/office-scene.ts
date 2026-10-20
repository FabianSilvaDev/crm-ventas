/**
 * Escenario pixel art de la oficina virtual (PixiJS 8).
 *
 * Decisiones de arquitectura (seccion 8 del prompt):
 *  - UNA sola instancia de `Application` por vista. Los agentes y las áreas son
 *    contenedores dentro de un unico grafo de escena.
 *  - Vista cenital con perspectiva de videojuego: el suelo y las áreas se ven desde
 *    arriba; personajes y muebles se dibujan de frente.
 *  - **Cuatro capas**: suelo/áreas -> agentes sentados -> mesas -> paseantes. Las mesas
 *    van por encima de los agentes para que parezcan sentados tras ellas; los que pasean
 *    se mueven a la capa superior, de modo que no quedan tapados por los escritorios.
 *  - Los agentes **inactivos con animacion propia** se levantan y van a un punto de
 *    descanso de su área, y vuelven a su puesto. Los que trabajan se quedan sentados.
 *  - El estado que llega de la API se vuelca sobre nodos ya existentes en cada sondeo.
 */
import { Application, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import type { Agent, Department, OfficeGrid } from '../../../core/models/agents.model';
import type { Direction, SpriteSet } from '../../../core/services/custom-sprites.service';
import { STATUS_COLOR } from '../../../shared/pixel/agent-sprites';
import {
  ACCENT_HEX,
  CUBICLE_COUNT,
  LOUNGE,
  buildDeskLayer,
  buildOfficeShell,
  buildRoom,
  roomPosition,
  worldSize,
} from './office-room';
import { agentTexture, disposeTextures, statusTexture, textureCount } from './textures';
import { disposeOfficeProps, loadOfficeProps } from './office-props';

/** Escala de los personajes sin sprite propio: 24x32 a 48x64. */
const AGENT_SCALE = 2;
/** Altura (en pixeles de pantalla) a la que quedan los pies del personaje. */
const AGENT_FEET = 64;
const MIN_SCALE = 0.5;
const MAX_SCALE = 5;

/** Velocidad del paseo, en pixeles de mundo por segundo. */
const WALK_SPEED = 34;
/** Altura del pasillo entre las dos filas de puestos (coordenada de sala). */
const AISLE_Y = 140;
/** Puntos de descanso en la zona de descanso (coordenadas de sala). */
const REST_SPOTS = [
  { x: LOUNGE.x + 38, y: LOUNGE.y + 78 },
  { x: LOUNGE.x + 94, y: LOUNGE.y + 128 },
  { x: LOUNGE.x + 34, y: LOUNGE.y + 188 },
];

/** Semilla estable a partir del id, para que cada agente tenga su ritmo. */
const hashOf = (text: string): number => {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  return hash;
};

type WanderPhase = 'seated' | 'walking' | 'resting';

export interface OfficeFilter {
  departmentId: string | null;
  status: string | null;
  search: string;
}

interface RoomEntry {
  container: Container;
  desks: Container;
  stations: { x: number; y: number }[];
  signature: string;
}

interface AgentNode {
  agent: Agent;
  root: Container;
  portrait: Sprite;
  bubble: Sprite;
  outline: Graphics;
  label: Text;
  progress: Graphics;
  progressWidth: number;
  /** Puesto en coordenadas del mundo. */
  home: { x: number; y: number };
  /** Origen de la sala, para calcular los puntos de descanso. */
  roomOrigin: { x: number; y: number };
  phase: number;
  /** Solo la cadencia: los fotogramas viven en la cache de sprites. */
  animation: { fps: number } | null;
  frameIndex: number;
  frameElapsed: number;
  wander: {
    phase: WanderPhase;
    path: { x: number; y: number }[];
    waitUntil: number;
    nextDecisionAt: number;
    direction: Direction;
  };
}

interface CustomSprite {
  set: SpriteSet;
  still: Texture;
  directions: Partial<Record<Direction, Texture[]>>;
  /** Escala entera, para no emborronar los pixeles. */
  scale: number;
}

export interface OfficeSceneOptions {
  onSelect: (agentId: string | null) => void;
  onHover: (agentId: string | null) => void;
}

export class OfficeScene {
  private app: Application | null = null;
  private readonly world = new Container();
  private readonly roomLayer = new Container();
  private readonly agentLayer = new Container();
  private readonly deskLayer = new Container();
  private readonly walkerLayer = new Container();

  private readonly nodes = new Map<string, AgentNode>();
  private readonly rooms = new Map<string, RoomEntry>();
  private readonly customSprites = new Map<string, CustomSprite>();
  private departments: Department[] = [];
  private grid: OfficeGrid = { columns: 4, rows: 2 };

  private filter: OfficeFilter = { departmentId: null, status: null, search: '' };
  private selectedId: string | null = null;
  private hoveredId: string | null = null;
  private suppressTap = false;
  private dragOrigin: { x: number; y: number; worldX: number; worldY: number } | null = null;

  constructor(private readonly options: OfficeSceneOptions) {}

  async mount(host: HTMLElement): Promise<void> {
    const app = new Application();

    await app.init({
      background: '#0b1116',
      resizeTo: host,
      antialias: false,
      roundPixels: true,
      preference: 'webgl',
    });

    this.app = app;
    host.appendChild(app.canvas);

    // Los props importados tienen que estar listos antes de construir las salas.
    // Si fallan, las salas usan el mobiliario procedural sin romperse.
    try {
      await loadOfficeProps();
    } catch (error) {
      console.warn('No se pudieron cargar los props de oficina; se usan los procedurales.', error);
    }

    // El orden importa: sala, agentes sentados, mesas encima y paseantes al final.
    this.world.addChild(this.roomLayer, this.agentLayer, this.deskLayer, this.walkerLayer);
    app.stage.addChild(this.world);
    app.stage.eventMode = 'static';
    app.stage.hitArea = new Rectangle(0, 0, 100000, 100000);

    app.stage.on('pointertap', (event) => {
      if (this.suppressTap) return;
      if (event.target === app.stage || event.target === this.world) this.options.onSelect(null);
    });

    this.bindPointerEvents(app.canvas);
    app.ticker.add((ticker) => this.animate(ticker.deltaMS));
  }

  destroy(): void {
    if (!this.app) return;
    this.app.destroy(true, { children: true });
    this.app = null;
    this.nodes.clear();
    this.rooms.clear();
    this.customSprites.clear();
    disposeOfficeProps();
    disposeTextures();
  }

  // --- Datos ----------------------------------------------------------------

  setDepartments(departments: Department[], grid: OfficeGrid): void {
    const sameSet =
      this.departments.length === departments.length &&
      this.departments.every((department, index) => department.id === departments[index]?.id);

    this.departments = departments;
    this.grid = grid;
    if (sameSet) return;

    this.roomLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.deskLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.rooms.clear();

    // Una sola oficina: suelo continuo y pared perimetral compartidos por todas
    // las areas. Las areas solo aportan divisiones, mobiliario y su letrero.
    const officeSize = worldSize(grid);
    this.roomLayer.addChild(buildOfficeShell(officeSize.width, officeSize.height));

    for (const department of departments) {
      const origin = roomPosition(department, grid);
      const { room, desks, stations } = buildRoom(department, [], {
        floor: false,
        wall: false,
        sign: 'area',
      });

      room.position.set(origin.x, origin.y);
      desks.position.set(origin.x, origin.y);

      this.roomLayer.addChild(room);
      this.deskLayer.addChild(desks);
      this.rooms.set(department.id, { container: room, desks, stations, signature: '' });
    }
  }

  applyAgents(agents: Agent[]): void {
    const seen = new Set<string>();

    for (const agent of agents) {
      seen.add(agent.id);
      const node = this.nodes.get(agent.id);

      if (node) {
        node.agent = agent;
        this.paintAgent(node);
        continue;
      }

      const created = this.buildAgentNode(agent);
      if (!created) continue;
      this.nodes.set(agent.id, created);
      this.agentLayer.addChild(created.root);
    }

    for (const [id, node] of this.nodes) {
      if (seen.has(id)) continue;
      node.root.destroy({ children: true });
      this.nodes.delete(id);
    }

    this.refreshDesks();
    this.applyFilter();
  }

  setFilter(filter: Partial<OfficeFilter>): void {
    this.filter = { ...this.filter, ...filter };
    this.applyFilter();
  }

  /**
   * Aplica los sprites propios (canvas ya recortados) a los agentes.
   * Solo reconstruye texturas cuando el conjunto cambia de verdad.
   */
  setCustomSprites(sets: Record<string, SpriteSet>): void {
    for (const [agentId, set] of Object.entries(sets ?? {})) {
      const existing = this.customSprites.get(agentId);
      if (existing?.set === set) continue;

      const scale = set.still.height >= 48 ? 1 : 2;
      const still = existing?.still ?? Texture.from(set.still);
      still.source.scaleMode = 'nearest';

      const directions: Partial<Record<Direction, Texture[]>> = {};
      for (const [direction, canvases] of Object.entries(set.animation?.directions ?? {})) {
        directions[direction as Direction] = canvases.map((canvas) => {
          const texture = Texture.from(canvas);
          texture.source.scaleMode = 'nearest';
          return texture;
        });
      }

      this.customSprites.set(agentId, { set, still, directions, scale });

      const node = this.nodes.get(agentId);
      if (node) {
        node.animation = set.animation ? { fps: set.animation.fps } : null;
        this.applyPortrait(node);
      }
    }
  }

  select(agentId: string | null): void {
    this.selectedId = agentId;
    this.applyFilter();
    if (agentId) this.focusAgent(agentId);
  }

  visibleCount(): { visible: number; dimmed: number } {
    let visible = 0;
    let dimmed = 0;

    for (const node of this.nodes.values()) {
      if (this.matches(node)) visible += 1;
      else dimmed += 1;
    }

    return { visible, dimmed };
  }

  get textureCount(): number {
    return textureCount();
  }

  // --- Construccion de los agentes -----------------------------------------

  private stationFor(agent: Agent): { x: number; y: number } | null {
    const room = this.rooms.get(agent.department?.id ?? '');
    if (!room) return null;

    const department = this.departments.find((item) => item.id === agent.department?.id);
    const index = Math.max(0, department?.agents.findIndex((item) => item.id === agent.id) ?? 0);
    const station = room.stations[index % CUBICLE_COUNT];

    return station ? { x: room.container.x + station.x, y: room.container.y + station.y } : null;
  }

  private buildAgentNode(agent: Agent): AgentNode | null {
    const home = this.stationFor(agent);
    const room = this.rooms.get(agent.department?.id ?? '');
    if (!home || !room) return null;

    const accent = this.accentOf(agent.department?.id);
    const root = new Container();
    root.position.set(home.x, home.y);
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new Rectangle(-4, -14, 56, 88);

    const portrait = new Sprite(agentTexture(agent.avatar));
    portrait.scale.set(AGENT_SCALE);
    portrait.position.set(0, 0);
    root.addChild(portrait);

    const bubble = new Sprite(statusTexture(agent.status));
    bubble.scale.set(1.6);
    bubble.position.set(30, -24);
    root.addChild(bubble);

    const label = new Text({
      text: agent.name,
      style: {
        fontFamily: '"Cascadia Mono", Consolas, monospace',
        fontSize: 10,
        fontWeight: 'bold',
        fill: accent,
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(24, 86);
    root.addChild(label);

    const progress = new Graphics();
    progress.position.set(6, 88);
    root.addChild(progress);

    const outline = new Graphics();
    outline.visible = false;
    root.addChild(outline);

    root.on('pointertap', () => {
      if (this.suppressTap) return;
      this.options.onSelect(agent.id);
    });
    root.on('pointerover', () => {
      this.hoveredId = agent.id;
      this.applyFilter();
      this.options.onHover(agent.id);
    });
    root.on('pointerout', () => {
      if (this.hoveredId === agent.id) this.hoveredId = null;
      this.applyFilter();
      this.options.onHover(null);
    });

    const node: AgentNode = {
      agent,
      root,
      portrait,
      bubble,
      outline,
      label,
      progress,
      progressWidth: 36,
      home,
      roomOrigin: { x: room.container.x, y: room.container.y },
      phase: (hashOf(agent.id) % 100) / 15,
      animation: null,
      frameIndex: 0,
      frameElapsed: 0,
      wander: {
        phase: 'seated',
        path: [],
        waitUntil: 0,
        // Escalonado por agente: no todos se levantan a la vez.
        nextDecisionAt: performance.now() + 3000 + (hashOf(agent.id) % 9000),
        direction: 'down',
      },
    };

    this.applyPortrait(node);
    this.paintAgent(node);
    return node;
  }

  /** Fija el fotograma de pie y lo alinea por los pies. */
  private applyPortrait(node: AgentNode): void {
    const custom = this.customSprites.get(node.agent.id);
    const texture = custom?.still ?? agentTexture(node.agent.avatar);
    const scale = custom?.scale ?? AGENT_SCALE;

    node.portrait.texture = texture;
    node.portrait.scale.set(scale);
    this.positionPortrait(node, texture);
  }

  /** Coloca el retrato centrado y con los pies en la misma linea. */
  private positionPortrait(node: AgentNode, texture: Texture): void {
    const scale = node.portrait.scale.x;
    const width = texture.width * scale;
    const height = texture.height * scale;
    node.portrait.position.set(24 - width / 2, AGENT_FEET - height);
  }

  /** Cambia el fotograma de la animacion, recolocando si el tamano cambia. */
  private showFrame(node: AgentNode, texture: Texture): void {
    if (node.portrait.texture === texture) return;
    node.portrait.texture = texture;
    this.positionPortrait(node, texture);
  }

  private paintAgent(node: AgentNode): void {
    const agent = node.agent;
    node.bubble.texture = statusTexture(agent.status);

    const home = this.stationFor(agent);
    if (home) node.home = home;

    // Si deja de estar inactivo, vuelve a su sitio: el puesto manda sobre el paseo.
    if (agent.status !== 'idle' && node.wander.phase !== 'seated') this.returnHome(node, false);

    if (node.wander.phase === 'seated') {
      if (home) node.root.position.set(home.x, home.y);
      this.applyPortrait(node);
    }

    const busy = ['working', 'thinking', 'collaborating'].includes(agent.status);
    node.progress.clear();
    if (busy && agent.progress > 0) {
      node.progress
        .rect(0, 0, node.progressWidth, 3)
        .fill({ color: '#0a0e13', alpha: 0.85 })
        .rect(0, 0, Math.max(2, node.progressWidth * Math.min(1, agent.progress)), 3)
        .fill(STATUS_COLOR[agent.status]);
    }
  }

  private refreshDesks(): void {
    const occupancy = new Map<string, number[]>();

    for (const node of this.nodes.values()) {
      const departmentId = node.agent.department?.id;
      if (!departmentId) continue;

      const department = this.departments.find((item) => item.id === departmentId);
      const index = Math.max(0, department?.agents.findIndex((item) => item.id === node.agent.id) ?? 0);
      const list = occupancy.get(departmentId) ?? [];
      list.push(index % CUBICLE_COUNT);
      occupancy.set(departmentId, list);
    }

    for (const [departmentId, entry] of this.rooms) {
      const indices = occupancy.get(departmentId) ?? [];
      const signature = [...indices].sort((a, b) => a - b).join(',');

      if (entry.signature === signature) continue;
      entry.signature = signature;

      const department = this.departments.find((item) => item.id === departmentId);
      if (!department) continue;

      entry.desks.removeChildren().forEach((child) => child.destroy({ children: true }));
      entry.desks.addChild(buildDeskLayer(department, indices));
    }
  }

  private accentOf(departmentId: string | undefined): string {
    const department = this.departments.find((item) => item.id === departmentId);
    return ACCENT_HEX[department?.accent ?? 'gray'] ?? ACCENT_HEX['gray'];
  }

  // --- Paseo ----------------------------------------------------------------

  /** Arranca un paseo hacia un punto de descanso de la sala. */
  private startWander(node: AgentNode): void {
    if (!node.animation || node.agent.status !== 'idle') return;

    const spot = REST_SPOTS[hashOf(node.agent.id) % REST_SPOTS.length];
    const target = { x: node.roomOrigin.x + spot.x, y: node.roomOrigin.y + spot.y };
    const aisle = { x: node.root.x, y: node.roomOrigin.y + AISLE_Y };

    node.wander.phase = 'walking';
    node.wander.path = [aisle, { x: target.x, y: aisle.y }, target];
    node.wander.direction = 'down';
    node.frameIndex = 0;
    node.frameElapsed = 0;
    // Por encima de las mesas: si no, quedaria tapado por los escritorios.
    this.walkerLayer.addChild(node.root);
  }

  /** Vuelve al puesto por el pasillo. */
  private startReturn(node: AgentNode): void {
    const aisle = { x: node.root.x, y: node.roomOrigin.y + AISLE_Y };

    node.wander.phase = 'walking';
    node.wander.path = [aisle, { x: node.home.x, y: aisle.y }, node.home];
    node.wander.direction = 'down';
    node.frameIndex = 0;
    node.frameElapsed = 0;
  }

  private arrive(node: AgentNode): void {
    node.wander.phase = 'resting';
    node.wander.direction = 'down';
    // Entre 5 y 12 segundos descansando, distinto por agente.
    node.wander.waitUntil = performance.now() + 5000 + (hashOf(node.agent.id) % 7000);

    const frames = this.customSprites.get(node.agent.id)?.directions.down;
    if (frames?.[0]) this.showFrame(node, frames[0]);
  }

  private returnHome(node: AgentNode, scheduleNext = true): void {
    node.wander.phase = 'seated';
    node.wander.path = [];
    node.wander.direction = 'down';
    node.wander.nextDecisionAt = scheduleNext ? performance.now() + 6000 + (hashOf(node.agent.id) % 9000) : 0;
    node.root.position.set(node.home.x, node.home.y);
    this.agentLayer.addChild(node.root);
    this.applyPortrait(node);
  }

  // --- Filtro y seleccion ---------------------------------------------------

  private matches(node: AgentNode): boolean {
    const agent = node.agent;
    const { departmentId, status, search } = this.filter;

    if (departmentId && agent.department?.id !== departmentId) return false;
    if (status && agent.status !== status) return false;
    if (search) {
      const needle = search.trim().toLocaleLowerCase('es');
      if (needle && !`${agent.name} ${agent.role} ${agent.specialty}`.toLocaleLowerCase('es').includes(needle)) {
        return false;
      }
    }

    return true;
  }

  private applyFilter(): void {
    for (const node of this.nodes.values()) {
      const visible = this.matches(node);

      node.root.alpha = visible ? 1 : 0.16;
      node.root.eventMode = visible ? 'static' : 'none';
      node.root.cursor = visible ? 'pointer' : 'default';

      this.paintOutline(node, this.selectedId === node.agent.id ? 0xffc44d : this.hoveredId === node.agent.id ? 0x4fd6ff : null);
    }

    for (const [departmentId, entry] of this.rooms) {
      const dimmed = Boolean(this.filter.departmentId && this.filter.departmentId !== departmentId);
      entry.container.alpha = dimmed ? 0.35 : 1;
      entry.desks.alpha = dimmed ? 0.35 : 1;
    }
  }

  private paintOutline(node: AgentNode, color: number | null): void {
    if (color === null) {
      node.outline.visible = false;
      return;
    }

    node.outline.clear();
    node.outline.rect(-3, -3, 54, 78).stroke({ width: 2, color, alpha: 0.9 });
    node.outline.visible = true;
  }

  // --- Camara ---------------------------------------------------------------

  private bindPointerEvents(canvas: HTMLCanvasElement): void {
    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        const bounds = canvas.getBoundingClientRect();
        this.zoomAt(event.clientX - bounds.left, event.clientY - bounds.top, event.deltaY < 0 ? 1.12 : 1 / 1.12);
      },
      { passive: false },
    );

    canvas.addEventListener('pointerdown', (event) => {
      this.dragOrigin = { x: event.clientX, y: event.clientY, worldX: this.world.x, worldY: this.world.y };
      this.suppressTap = false;
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!this.dragOrigin) return;

      const dx = event.clientX - this.dragOrigin.x;
      const dy = event.clientY - this.dragOrigin.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) this.suppressTap = true;
      if (!this.suppressTap) return;

      this.world.x = this.dragOrigin.worldX + dx;
      this.world.y = this.dragOrigin.worldY + dy;
    });

    const endDrag = (event: PointerEvent) => {
      this.dragOrigin = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      setTimeout(() => {
        this.suppressTap = false;
      }, 0);
    };

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
  }

  private zoomAt(screenX: number, screenY: number, factor: number): void {
    const current = this.world.scale.x;
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current * factor));
    if (next === current) return;

    const worldX = (screenX - this.world.x) / current;
    const worldY = (screenY - this.world.y) / current;

    this.world.scale.set(next);
    this.world.x = screenX - worldX * next;
    this.world.y = screenY - worldY * next;
  }

  zoomBy(factor: number): void {
    const app = this.app;
    if (!app) return;
    this.zoomAt(app.renderer.width / 2, app.renderer.height / 2, factor);
  }

  fitAll(): void {
    const app = this.app;
    if (!app) return;

    const { width, height } = worldSize(this.grid);
    const scale = Math.min(app.renderer.width / width, app.renderer.height / height) * 0.96;

    this.world.scale.set(Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale)));
    this.world.x = (app.renderer.width - width * this.world.scale.x) / 2;
    this.world.y = (app.renderer.height - height * this.world.scale.y) / 2;
  }

  focusAgent(agentId: string): void {
    const app = this.app;
    const node = this.nodes.get(agentId);
    if (!app || !node) return;

    const scale = Math.max(1.8, this.world.scale.x);
    this.world.scale.set(scale);
    this.world.x = app.renderer.width / 2 - node.root.x * scale - 24 * scale;
    this.world.y = app.renderer.height / 2 - node.root.y * scale - 32 * scale;
  }

  focusRoom(departmentId: string): boolean {
    const app = this.app;
    const entry = this.rooms.get(departmentId);
    if (!app || !entry) return false;

    const scale = Math.max(1.6, Math.min(MAX_SCALE, this.world.scale.x));
    this.world.scale.set(scale);
    this.world.x = app.renderer.width / 2 - (entry.container.x + 208) * scale;
    this.world.y = app.renderer.height / 2 - (entry.container.y + 128) * scale;
    return true;
  }

  // --- Animacion ------------------------------------------------------------

  private animate(deltaMS: number): void {
    const seconds = Math.min(0.1, deltaMS / 1000);
    const now = performance.now();
    const elapsed = now / 1000;

    for (const node of this.nodes.values()) {
      const wander = node.wander;

      // 1. Sentado: se balancea si trabaja; si esta inactivo y sabe andar, se levanta.
      if (wander.phase === 'seated') {
        const busy = ['working', 'thinking', 'collaborating'].includes(node.agent.status);
        node.root.y = busy ? node.home.y + Math.round(Math.sin(elapsed * 2.4 + node.phase)) : node.home.y;

        if (!busy && node.agent.status === 'idle' && node.animation && now >= wander.nextDecisionAt) {
          this.startWander(node);
        }
        continue;
      }

      // 2. Caminando: avanzar por los puntos del recorrido.
      if (wander.phase === 'walking') {
        const target = wander.path[0];
        if (!target) {
          this.arrive(node);
          continue;
        }

        const dx = target.x - node.root.x;
        const dy = target.y - node.root.y;
        const distance = Math.hypot(dx, dy);
        const step = WALK_SPEED * seconds;

        if (distance <= step || distance === 0) {
          node.root.position.set(target.x, target.y);
          wander.path.shift();
          if (wander.path.length === 0) {
            // Si el destino es su puesto, se sienta; si no, descansa.
            if (Math.abs(target.x - node.home.x) < 1 && Math.abs(target.y - node.home.y) < 1) {
              this.returnHome(node);
            } else {
              this.arrive(node);
            }
            continue;
          }
        } else {
          node.root.position.set(node.root.x + (dx / distance) * step, node.root.y + (dy / distance) * step);
        }

        // Direccion dominante del movimiento, para elegir la fila del sprite.
        const direction: Direction =
          Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        wander.direction = direction;

        this.advanceWalkFrame(node, direction, seconds);
        continue;
      }

      // 3. Descansando: quieto, y luego vuelve.
      const frames = this.customSprites.get(node.agent.id)?.directions.down;
      if (frames?.[0]) this.showFrame(node, frames[0]);
      if (now >= wander.waitUntil) this.startReturn(node);
    }
  }

  /** Alterna los fotogramas del ciclo de caminar. */
  private advanceWalkFrame(node: AgentNode, direction: Direction, seconds: number): void {
    const custom = this.customSprites.get(node.agent.id);
    const frames = custom?.directions[direction] ?? custom?.directions.down;
    if (!frames || frames.length <= 1) return;

    node.frameElapsed += seconds;
    const frameDuration = 1 / (node.animation?.fps ?? 8);
    if (node.frameElapsed >= frameDuration) {
      node.frameElapsed = 0;
      node.frameIndex = (node.frameIndex + 1) % frames.length;
    }

    this.showFrame(node, frames[node.frameIndex % frames.length]);
  }
}
