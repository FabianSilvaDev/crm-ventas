/**
 * Escenario pixel art de la oficina virtual (PixiJS 8).
 *
 * Decisiones de arquitectura (seccion 8 del prompt):
 *  - UNA sola instancia de `Application` por vista. Los agentes y las salas son
 *    contenedores dentro de un unico grafo de escena; nunca hay un renderer por
 *    personaje.
 *  - Vista cenital con perspectiva de videojuego: el suelo y las salas se ven desde
 *    arriba; personajes y muebles se dibujan de frente. Es la unica vista del
 *    proyecto, elegida una vez y mantenida en todo el escenario.
 *  - Los recursos se administran de forma centralizada en `textures.ts`, con cache
 *    por clave, y se liberan al desmontar.
 *  - El estado que llega de la API se vuelca sobre nodos ya existentes (`applyAgents`)
 *    en lugar de reconstruir la escena en cada sondeo, para no perder la camara ni
 *    provocar parpadeos.
 */
import { Application, Container, Graphics, Rectangle, Sprite, Text } from 'pixi.js';
import type { Agent, Department, OfficeGrid } from '../../../core/models/agents.model';
import { STATUS_COLOR } from '../../../shared/pixel/agent-sprites';
import { agentTexture, disposeTextures, furnitureTexture, statusTexture, textureCount } from './textures';

/** Unidad base del escenario, en pixeles. */
const UNIT = 16;
const ROOM_WIDTH = 22 * UNIT;
const ROOM_HEIGHT = 13 * UNIT;
const ROOM_GAP = 3 * UNIT;
const WORLD_MARGIN = 2 * UNIT;
const WALL_HEIGHT = 2 * UNIT;

/** Escala inicial del mundo: los sprites miden 16 px y se ven a 32 px. */
const BASE_SCALE = 2;
const MIN_SCALE = 0.8;
const MAX_SCALE = 6;

/** Estaciones de trabajo por sala: 3 por fila, 2 filas. */
const STATION_WIDTH = 6 * UNIT;
const STATION_HEIGHT = 4 * UNIT;
const STATIONS_PER_ROW = 3;
const STATION_ROWS = 2;

/** Tonos de suelo y pared por acento de departamento. */
const ROOM_TONES: Record<string, { floor: string; floorAlt: string; wall: string }> = {
  amber: { floor: '#1d1a12', floorAlt: '#241f15', wall: '#2c2517' },
  cyan: { floor: '#101d23', floorAlt: '#142530', wall: '#16303c' },
  violet: { floor: '#17142a', floorAlt: '#1e1a38', wall: '#241f45' },
  pink: { floor: '#22131f', floorAlt: '#2b1a28', wall: '#342031' },
  green: { floor: '#11201a', floorAlt: '#152a22', wall: '#18352a' },
  orange: { floor: '#221a12', floorAlt: '#2b2117', wall: '#34271b' },
  lime: { floor: '#1a2112', floorAlt: '#222b18', wall: '#2a351e' },
  blue: { floor: '#121a26', floorAlt: '#172234', wall: '#1c2a41' },
  gray: { floor: '#161a1e', floorAlt: '#1d2329', wall: '#242c33' },
};

/** Acento del departamento en hexadecimal, para bordes y etiquetas. */
const ACCENT_HEX: Record<string, string> = {
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

export interface OfficeFilter {
  departmentId: string | null;
  status: string | null;
  search: string;
}

interface AgentNode {
  agent: Agent;
  root: Container;
  portrait: Sprite;
  bubble: Sprite;
  outline: Graphics;
  label: Text;
  detail: Text;
  progress: Graphics;
  progressWidth: number;
  homeY: number;
  phase: number;
}

export interface OfficeSceneOptions {
  onSelect: (agentId: string | null) => void;
  onHover: (agentId: string | null) => void;
}

/** Escena de la oficina. Se monta sobre un host y se destruye al salir de la vista. */
export class OfficeScene {
  private app: Application | null = null;
  private readonly world = new Container();
  private readonly roomLayer = new Container();
  private readonly agentLayer = new Container();

  private readonly nodes = new Map<string, AgentNode>();
  private departments: Department[] = [];
  private grid: OfficeGrid = { columns: 4, rows: 2 };

  private filter: OfficeFilter = { departmentId: null, status: null, search: '' };
  private selectedId: string | null = null;
  private hoveredId: string | null = null;
  private suppressTap = false;
  private dragOrigin: { x: number; y: number; worldX: number; worldY: number } | null = null;

  constructor(private readonly options: OfficeSceneOptions) {}

  /** Crea la aplicacion de PixiJS y el grafo de escena. */
  async mount(host: HTMLElement): Promise<void> {
    const app = new Application();

    await app.init({
      background: '#0b1116',
      resizeTo: host,
      antialias: false,
      // El pixel art no quiere suavizado ni en el canvas.
      roundPixels: true,
      preference: 'webgl',
    });

    this.app = app;
    host.appendChild(app.canvas);

    this.world.addChild(this.roomLayer, this.agentLayer);
    app.stage.addChild(this.world);
    app.stage.eventMode = 'static';
    app.stage.hitArea = new Rectangle(0, 0, 100000, 100000);

    // Un clic en el fondo deselecciona; el clic sobre un agente lo gestiona su nodo.
    app.stage.on('pointertap', (event) => {
      if (this.suppressTap) return;
      if (event.target === app.stage || event.target === this.world) this.options.onSelect(null);
    });

    this.bindPointerEvents(app.canvas);
    app.ticker.add((ticker) => this.animate(ticker.deltaTime));
  }

  /** Libera el renderer y las texturas. */
  destroy(): void {
    if (!this.app) return;
    this.app.destroy(true, { children: true });
    this.app = null;
    this.nodes.clear();
    disposeTextures();
  }

  // --- Datos ----------------------------------------------------------------

  /** Reconstruye las salas. Solo se llama cuando cambia la lista de departamentos. */
  setDepartments(departments: Department[], grid: OfficeGrid): void {
    const sameSet =
      this.departments.length === departments.length &&
      this.departments.every((department, index) => department.id === departments[index]?.id);

    this.departments = departments;
    this.grid = grid;
    if (sameSet) return;

    this.roomLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    for (const department of departments) this.roomLayer.addChild(this.buildRoom(department));
  }

  /** Vuelca el estado de los agentes sobre la escena. */
  applyAgents(agents: Agent[]): void {
    const seen = new Set<string>();

    for (const agent of agents) {
      seen.add(agent.id);
      const node = this.nodes.get(agent.id);

      if (node) {
        node.agent = agent;
        this.paintAgent(node);
      } else {
        const created = this.buildAgentNode(agent);
        this.nodes.set(agent.id, created);
        this.agentLayer.addChild(created.root);
      }
    }

    for (const [id, node] of this.nodes) {
      if (seen.has(id)) continue;
      node.root.destroy({ children: true });
      this.nodes.delete(id);
    }

    this.applyFilter();
  }

  setFilter(filter: Partial<OfficeFilter>): void {
    this.filter = { ...this.filter, ...filter };
    this.applyFilter();
  }

  select(agentId: string | null): void {
    this.selectedId = agentId;
    this.applyFilter();
    if (agentId) this.focusAgent(agentId);
  }

  /** Recuento de agentes visibles y atenuados con el filtro actual. */
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

  // --- Construccion del escenario ------------------------------------------

  private roomPosition(department: Department): { x: number; y: number; width: number; height: number } {
    const col = Math.min(department.room.col, this.grid.columns - 1);
    const row = Math.min(department.room.row, this.grid.rows - 1);

    return {
      x: WORLD_MARGIN + col * (ROOM_WIDTH + ROOM_GAP),
      y: WORLD_MARGIN + row * (ROOM_HEIGHT + ROOM_GAP),
      width: ROOM_WIDTH,
      height: ROOM_HEIGHT,
    };
  }

  /** Dimensiones totales del mundo, en pixeles. */
  private worldSize(): { width: number; height: number } {
    return {
      width: WORLD_MARGIN * 2 + this.grid.columns * ROOM_WIDTH + (this.grid.columns - 1) * ROOM_GAP,
      height: WORLD_MARGIN * 2 + this.grid.rows * ROOM_HEIGHT + (this.grid.rows - 1) * ROOM_GAP,
    };
  }

  private buildRoom(department: Department): Container {
    const container = new Container();
    const { x, y, width, height } = this.roomPosition(department);
    container.x = x;
    container.y = y;

    const tones = ROOM_TONES[department.accent] ?? ROOM_TONES['gray'];
    const accent = ACCENT_HEX[department.accent] ?? ACCENT_HEX['gray'];

    const graphics = new Graphics();

    // Suelo con damero sutil y junta de baldosas cada unidad.
    graphics.rect(0, WALL_HEIGHT, width, height - WALL_HEIGHT).fill(tones.floor);
    for (let tileY = 0; tileY < Math.ceil((height - WALL_HEIGHT) / UNIT); tileY += 1) {
      for (let tileX = 0; tileX < Math.ceil(width / UNIT); tileX += 1) {
        if ((tileX + tileY) % 2 === 0) continue;
        graphics
          .rect(tileX * UNIT, WALL_HEIGHT + tileY * UNIT, UNIT, UNIT)
          .fill({ color: tones.floorAlt, alpha: 0.55 });
      }
    }
    graphics
      .rect(0, WALL_HEIGHT, width, height - WALL_HEIGHT)
      .stroke({ width: 2, color: accent, alpha: 0.16 });

    // Pared superior con remate del color del departamento.
    graphics.rect(0, 0, width, WALL_HEIGHT).fill(tones.wall);
    graphics.rect(0, WALL_HEIGHT - 4, width, 4).fill({ color: accent, alpha: 0.5 });
    graphics.rect(0, 0, width, WALL_HEIGHT).stroke({ width: 2, color: '#0a0e13', alpha: 0.8 });

    container.addChild(graphics);

    // Rotulo del departamento.
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
    label.position.set(10, 7);
    container.addChild(label);

    const headcount = new Text({
      text: `${department.stats.agentCount} agentes · ${department.stats.active} activos`,
      style: {
        fontFamily: '"Cascadia Mono", Consolas, monospace',
        fontSize: 9,
        fill: accent,
      },
    });
    headcount.anchor.set(1, 0);
    headcount.position.set(width - 10, 9);
    container.addChild(headcount);

    // Mobiliario decorativo: un objeto por sala, elegido por departamento.
    const decor = this.decorFor(department.id);
    if (decor) {
      const sprite = new Sprite(furnitureTexture(decor));
      sprite.scale.set(BASE_SCALE);
      sprite.position.set(width - UNIT * 2.4, height - UNIT * 3.4);
      container.addChild(sprite);
    }

    return container;
  }

  private decorFor(departmentId: string): 'whiteboard' | 'plant' | 'server' | 'coffee' | 'crate' | null {
    switch (departmentId) {
      case 'ops-center':
        return 'server';
      case 'research-lab':
        return 'whiteboard';
      case 'marketing-studio':
        return 'coffee';
      case 'creative-studio':
        return 'plant';
      case 'seo-web-lab':
        return 'whiteboard';
      case 'ad-operations':
        return 'crate';
      case 'analytics-optimization':
        return 'plant';
      default:
        return 'plant';
    }
  }

  /** Posicion de la estacion de trabajo de un agente dentro de su sala. */
  private stationPosition(department: Department, index: number): { x: number; y: number } {
    const room = this.roomPosition(department);
    const perRow = STATIONS_PER_ROW;
    const column = index % perRow;
    const row = Math.min(Math.floor(index / perRow), STATION_ROWS - 1);

    return {
      x: room.x + UNIT * 0.75 + column * STATION_WIDTH,
      y: room.y + WALL_HEIGHT + UNIT * 1.1 + row * STATION_HEIGHT,
    };
  }

  private buildAgentNode(agent: Agent): AgentNode {
    const department =
      this.departments.find((item) => item.id === agent.department?.id) ?? this.departments[0];

    // Indice del agente dentro de su departamento: decide su estacion.
    const siblings = this.departments
      .find((item) => item.id === department?.id)
      ?.agents.map((item) => item.id) ?? [agent.id];
    const index = Math.max(0, siblings.indexOf(agent.id));

    const home = department
      ? this.stationPosition(department, index)
      : { x: WORLD_MARGIN, y: WORLD_MARGIN };
    const accent = ACCENT_HEX[agent.department?.accent ?? 'gray'] ?? ACCENT_HEX['gray'];

    const root = new Container();
    root.position.set(home.x, home.y);
    root.eventMode = 'static';
    root.cursor = 'pointer';
    // Zona de pulsacion mas generosa que el propio sprite.
    root.hitArea = new Rectangle(-6, -10, 34, 56);

    // Mesa y silla: mobiliario fijo de la estacion.
    const desk = new Sprite(furnitureTexture('monitor'));
    desk.scale.set(BASE_SCALE);
    desk.position.set(UNIT * 1.4, UNIT * 0.6);
    root.addChild(desk);

    const chair = new Sprite(furnitureTexture('chair'));
    chair.scale.set(BASE_SCALE);
    chair.position.set(UNIT * 1.4, UNIT * 2.1);
    root.addChild(chair);

    // Retrato del agente (sprite compuesto y tintado por su acento).
    const portrait = new Sprite(agentTexture(agent.avatar));
    portrait.scale.set(BASE_SCALE);
    portrait.position.set(0, UNIT * 0.9);
    root.addChild(portrait);

    // Globo de estado sobre la cabeza.
    const bubble = new Sprite(statusTexture(agent.status));
    bubble.scale.set(BASE_SCALE * 0.75);
    bubble.position.set(UNIT * 0.9, -UNIT * 0.4);
    root.addChild(bubble);

    const label = new Text({
      text: agent.name,
      style: {
        fontFamily: '"Cascadia Mono", Consolas, monospace',
        fontSize: 9,
        fontWeight: 'bold',
        fill: accent,
      },
    });
    label.position.set(0, UNIT * 2.6);
    root.addChild(label);

    const detail = new Text({
      text: '',
      style: {
        fontFamily: '"Cascadia Mono", Consolas, monospace',
        fontSize: 8,
        fill: '#7a8fa3',
        wordWrap: true,
        wordWrapWidth: STATION_WIDTH - UNIT,
      },
    });
    detail.position.set(0, UNIT * 3.4);
    root.addChild(detail);

    const progress = new Graphics();
    progress.position.set(0, UNIT * 4.6);
    root.addChild(progress);

    // Recuadro de seleccion y de hover: se crea una vez y se redibuja al cambiar.
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
      detail,
      progress,
      progressWidth: STATION_WIDTH - UNIT * 1.4,
      homeY: home.y,
      phase: (index * 1.7) % (Math.PI * 2),
    };

    this.paintAgent(node);
    return node;
  }

  /** Refresca un nodo con el estado actual del agente. */
  private paintAgent(node: AgentNode): void {
    const agent = node.agent;
    // Las texturas cambian con el estado y con el aspecto, ambas cacheadas.
    node.bubble.texture = statusTexture(agent.status);
    node.portrait.texture = agentTexture(agent.avatar);

    const busy = ['working', 'thinking', 'collaborating'].includes(agent.status);
    node.detail.text = agent.currentTask?.title ?? agent.recentResult?.title ?? agent.role;

    node.progress.clear();
    if (busy && agent.progress > 0) {
      node.progress
        .rect(0, 0, node.progressWidth, 4)
        .fill({ color: '#0a0e13', alpha: 0.8 })
        .rect(0, 0, Math.max(2, node.progressWidth * Math.min(1, agent.progress)), 4)
        .fill(STATUS_COLOR[agent.status]);
    }

    node.label.style.fill = ACCENT_HEX[agent.department?.accent ?? 'gray'] ?? '#e8f2f8';
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
      const selected = this.selectedId === node.agent.id;
      const hovered = this.hoveredId === node.agent.id;

      // Los agentes filtrados se atenuan y dejan de responder al raton en lugar de
      // desaparecer: asi se entiende que siguen existiendo en la oficina.
      node.root.alpha = visible ? 1 : 0.16;
      node.root.eventMode = visible ? 'static' : 'none';
      node.root.cursor = visible ? 'pointer' : 'default';
      node.root.scale.set(selected ? 1.12 : 1);

      this.paintOutline(node, selected ? 0xffc44d : hovered ? 0x4fd6ff : null);
    }
  }

  /** Marca el nodo seleccionado o bajo el cursor. El recuadro se reutiliza, no se recrea. */
  private paintOutline(node: AgentNode, color: number | null): void {
    if (color === null) {
      node.outline.visible = false;
      return;
    }

    node.outline.clear();
    node.outline
      .rect(-3, UNIT * 0.9 - 3, UNIT * 1 + 6, UNIT * 1 + 6)
      .stroke({ width: 2, color, alpha: 0.9 });
    node.outline.visible = true;
  }

  // --- Camara ---------------------------------------------------------------

  private bindPointerEvents(canvas: HTMLCanvasElement): void {
    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        const bounds = canvas.getBoundingClientRect();
        this.zoomAt(
          event.clientX - bounds.left,
          event.clientY - bounds.top,
          event.deltaY < 0 ? 1.12 : 1 / 1.12,
        );
      },
      { passive: false },
    );

    canvas.addEventListener('pointerdown', (event) => {
      this.dragOrigin = {
        x: event.clientX,
        y: event.clientY,
        worldX: this.world.x,
        worldY: this.world.y,
      };
      this.suppressTap = false;
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!this.dragOrigin) return;

      const dx = event.clientX - this.dragOrigin.x;
      const dy = event.clientY - this.dragOrigin.y;
      // Umbral de arrastre: por debajo se considera un clic sobre lo que haya debajo.
      if (Math.abs(dx) + Math.abs(dy) > 6) this.suppressTap = true;
      if (!this.suppressTap) return;

      this.world.x = this.dragOrigin.worldX + dx;
      this.world.y = this.dragOrigin.worldY + dy;
    });

    const endDrag = (event: PointerEvent) => {
      this.dragOrigin = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      // El flag se limpia en el siguiente ciclo para que Pixi ya haya procesado el tap.
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

  /** Encaja todo el escenario en el lienzo. */
  fitAll(): void {
    const app = this.app;
    if (!app) return;

    const { width, height } = this.worldSize();
    const scale = Math.min(app.renderer.width / width, app.renderer.height / height) * 0.96;

    this.world.scale.set(Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale)));
    this.world.x = (app.renderer.width - width * this.world.scale.x) / 2;
    this.world.y = (app.renderer.height - height * this.world.scale.y) / 2;
  }

  /** Centra la camara en un agente concreto. */
  focusAgent(agentId: string): void {
    const app = this.app;
    const node = this.nodes.get(agentId);
    if (!app || !node) return;

    const scale = Math.max(2.4, this.world.scale.x);
    this.world.scale.set(scale);
    this.world.x = app.renderer.width / 2 - node.root.x * scale - UNIT * scale;
    this.world.y = app.renderer.height / 2 - node.root.y * scale - UNIT * scale;
  }

  // --- Animacion ------------------------------------------------------------

  /**
   * Animacion deliberada y minima: los agentes ocupados se balancean un pixel y los
   * inactivos quedan quietos. Nada de movimiento constante sin motivo.
   */
  private animate(deltaTime: number): void {
    const elapsed = performance.now() / 1000;

    for (const node of this.nodes.values()) {
      const busy = ['working', 'thinking', 'collaborating'].includes(node.agent.status);
      if (!busy) {
        node.root.y = node.homeY;
        continue;
      }

      node.root.y = node.homeY + Math.round(Math.sin(elapsed * 2.4 + node.phase));
      void deltaTime;
    }
  }
}
