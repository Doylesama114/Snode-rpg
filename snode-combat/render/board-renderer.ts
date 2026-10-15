import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Board } from '../core/board';
import type { UnitInstance } from '../core/unit';
import type { Vec2 } from '../core/types';
import type { SilhouetteInstance, ZoneInstance } from '../core/objects';
import { DIRECTION_VECTORS } from '../core/geometry';

export interface BoardRendererOptions {
  cellSize?: number;
  background?: number;
}

export interface BoardRendererCallbacks {
  onUnitClick?: (unit: UnitInstance) => void;
  onCellClick?: (x: number, y: number) => void;
  onObjectClick?: (id: string) => void;
}

export interface RenderObjects {
  silhouettes?: readonly SilhouetteInstance[];
  zones?: readonly ZoneInstance[];
}

const DEFAULT_CELL = 56;

export class BoardRenderer {
  readonly app = new Application();
  private board: Board | null = null;
  private units: readonly UnitInstance[] = [];
  private readonly cellSize: number;
  private readonly boardLayer = new Container();
  private readonly rangeLayer = new Container();
  private readonly targetLayer = new Container();
  private readonly tokenLayer = new Container();
  private objects: RenderObjects = {};
  private callbacks: BoardRendererCallbacks = {};

  constructor(opts: BoardRendererOptions = {}) {
    this.cellSize = opts.cellSize ?? DEFAULT_CELL;
    this.boardLayer.addChild(new Graphics());
    this.boardLayer.addChild(new Graphics());
    this.boardLayer.addChild(new Graphics());
    this.boardLayer.addChild(new Container());
  }

  async init(host: HTMLElement, board: Board, units: readonly UnitInstance[]): Promise<void> {
    await this.app.init({
      width: board.width * this.cellSize,
      height: board.height * this.cellSize,
      background: 0x15191d,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    host.appendChild(this.app.canvas);
    this.boardLayer.eventMode = 'static';
    this.boardLayer.on('pointerdown', (event) => {
      const point = event.global;
      const x = Math.floor(point.x / this.cellSize);
      const y = Math.floor(point.y / this.cellSize);
      if (this.board?.inBounds(x, y)) this.callbacks.onCellClick?.(x, y);
    });
    this.app.stage.addChild(this.boardLayer);
    this.app.stage.addChild(this.rangeLayer);
    this.app.stage.addChild(this.targetLayer);
    this.app.stage.addChild(this.tokenLayer);
    this.setBoard(board, units);
  }

  setBoard(board: Board, units: readonly UnitInstance[]): void {
    this.board = board;
    this.units = units;
    this.drawBoard();
  }

  setCallbacks(callbacks: BoardRendererCallbacks): void {
    this.callbacks = callbacks;
  }

  setUnits(units: readonly UnitInstance[]): void {
    this.units = units;
    this.drawUnits();
  }

  setObjects(objects: RenderObjects): void {
    this.objects = objects;
  }

  /** 全量重绘。 */
  sync(): void {
    this.drawBoard();
    this.drawUnits();
    this.drawObjects();
  }

  clearHighlights(): void {
    this.rangeLayer.removeChildren().forEach((child) => child.destroy());
    this.targetLayer.removeChildren().forEach((child) => child.destroy());
  }

  highlightCells(cells: Iterable<Vec2>, color = 0x4aa3ff, alpha = 0.32): void {
    const g = new Graphics();
    for (const cell of cells) {
      g.rect(cell.x * this.cellSize + 2, cell.y * this.cellSize + 2, this.cellSize - 4, this.cellSize - 4)
        .fill({ color, alpha });
    }
    this.rangeLayer.addChild(g);
  }

  /** 技能范围（锥形等）。 */
  highlightAreaCells(cells: Iterable<Vec2>, color = 0xff7043, alpha = 0.3): void {
    const g = new Graphics();
    for (const cell of cells) {
      if (this.board && !this.board.inBounds(cell.x, cell.y)) continue;
      g.rect(cell.x * this.cellSize + 3, cell.y * this.cellSize + 3, this.cellSize - 6, this.cellSize - 6)
        .fill({ color, alpha });
      g.rect(cell.x * this.cellSize + 3, cell.y * this.cellSize + 3, this.cellSize - 6, this.cellSize - 6)
        .stroke({ width: 1, color, alpha: 0.9 });
    }
    this.rangeLayer.addChild(g);
  }

  /** 合法目标棋子脚下标记。 */
  highlightTargetUnits(targets: readonly UnitInstance[], color = 0xff5252): void {
    const g = new Graphics();
    for (const unit of targets) {
      const x = unit.x * this.cellSize;
      const y = unit.y * this.cellSize;
      g.rect(x + 3, y + 3, this.cellSize - 6, this.cellSize - 6)
        .stroke({ width: 3, color, alpha: 0.95 });
      g.moveTo(x + 3, y + 3).lineTo(x + this.cellSize - 3, y + this.cellSize - 3).stroke({ width: 1, color, alpha: 0.5 });
      g.moveTo(x + this.cellSize - 3, y + 3).lineTo(x + 3, y + this.cellSize - 3).stroke({ width: 1, color, alpha: 0.5 });
    }
    this.targetLayer.addChild(g);
  }

  /** 飘字：伤害/状态等临时文字。 */
  showFloatingText(x: number, y: number, text: string, color = 0xffffff): void {
    const label = new Text({
      text,
      style: new TextStyle({
        fontSize: 18,
        fontWeight: 'bold',
        fill: color,
        fontFamily: 'Microsoft YaHei, sans-serif',
        stroke: { color: 0x000000, width: 2 },
      }),
    });
    label.anchor.set(0.5);
    label.x = x * this.cellSize + this.cellSize / 2;
    label.y = y * this.cellSize;
    this.tokenLayer.addChild(label);
    const start = performance.now();
    const tick = () => {
      if (label.destroyed) {
        this.app.ticker.remove(tick);
        return;
      }
      const elapsed = performance.now() - start;
      if (elapsed >= 900) {
        this.app.ticker.remove(tick);
        label.destroy();
        return;
      }
      label.y = y * this.cellSize - (elapsed / 900) * 26;
      label.alpha = Math.max(0, 1 - elapsed / 900);
    };
    this.app.ticker.add(tick);
  }

  highlightSelectedUnit(unit: UnitInstance, color = 0xffd54a): void {
    const g = new Graphics();
    const x = unit.x * this.cellSize;
    const y = unit.y * this.cellSize;
    g.rect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4)
      .stroke({ width: 3, color, alpha: 1 });
    this.targetLayer.addChild(g);
  }

  highlightCell(x: number, y: number, color = 0xffd54a, alpha = 0.55): void {
    const g = new Graphics();
    g.rect(x * this.cellSize + 1, y * this.cellSize + 1, this.cellSize - 2, this.cellSize - 2)
      .stroke({ width: 3, color, alpha });
    this.rangeLayer.addChild(g);
  }

  destroy(): void {
    this.app.destroy(true, { children: true, texture: true });
  }

  private drawBoard(): void {
    if (!this.board) return;
    const board = this.board;
    const cs = this.cellSize;
    this.boardLayer.removeChildren().forEach((child) => child.destroy());

    const grid = new Graphics();
    for (let x = 0; x <= board.width; x += 1) {
      grid.moveTo(x * cs, 0).lineTo(x * cs, board.height * cs).stroke({ width: 1, color: 0x3a4148 });
    }
    for (let y = 0; y <= board.height; y += 1) {
      grid.moveTo(0, y * cs).lineTo(board.width * cs, y * cs).stroke({ width: 1, color: 0x3a4148 });
    }

    const terrain = new Graphics();
    for (let x = 0; x < board.width; x += 1) {
      for (let y = 0; y < board.height; y += 1) {
        const t = board.terrainAt(x, y).type;
        if (t === 'blocked') {
          terrain.rect(x * cs + 1, y * cs + 1, cs - 2, cs - 2).fill(0x20262c);
          terrain.rect(x * cs + 1, y * cs + 1, cs - 2, cs - 2).stroke({ width: 1, color: 0x111519 });
        } else if (t === 'cover') {
          terrain.rect(x * cs + 4, y * cs + 4, cs - 8, cs - 8).fill(0x4a6a35);
        } else if (t === 'danger') {
          terrain.rect(x * cs + 2, y * cs + 2, cs - 4, cs - 4).fill(0x8a2b1f, 0.35);
        }
      }
    }

    this.boardLayer.addChild(terrain);
    this.boardLayer.addChild(grid);
  }

  private drawObjects(): void {
    for (const zone of this.objects.zones ?? []) {
      const g = new Graphics();
      for (const key of zone.cells) {
        const [x, y] = key.split(',').map(Number);
        if (!this.board?.inBounds(x as number, y as number)) continue;
        g.rect((x as number) * this.cellSize + 2, (y as number) * this.cellSize + 2, this.cellSize - 4, this.cellSize - 4)
          .fill({ color: 0xd46bd4, alpha: 0.22 });
      }
      this.tokenLayer.addChild(g);
    }
    for (const silhouette of this.objects.silhouettes ?? []) {
      const token = new Container();
      token.x = silhouette.x * this.cellSize + this.cellSize / 2;
      token.y = silhouette.y * this.cellSize + this.cellSize / 2;
      token.eventMode = 'static';
      token.cursor = 'pointer';
      token.on('pointerdown', (event) => {
        event.stopPropagation();
        this.callbacks.onObjectClick?.(silhouette.id);
      });
      const radius = this.cellSize * 0.3;
      const shape = new Graphics();
      shape.ellipse(0, 0, radius, radius * 1.25).fill(0x1f2933);
      shape.ellipse(0, 0, radius, radius * 1.25).stroke({ width: 2, color: 0xd46bd4 });
      const label = new Text({
        text: '影子',
        style: new TextStyle({ fontSize: 11, fill: 0xe6c7f2, fontFamily: 'Microsoft YaHei, sans-serif' }),
      });
      label.anchor.set(0.5, 0);
      label.y = radius * 1.3;
      token.addChild(shape);
      token.addChild(label);
      this.tokenLayer.addChild(token);
    }
  }

  private drawUnits(): void {
    this.tokenLayer.removeChildren().forEach((child) => child.destroy());
    for (const unit of this.units) {
      if (unit.hp <= 0) continue;
      if (unit.stealthed && unit.team !== 'player') continue;
      const token = new Container();
      token.x = unit.x * this.cellSize + this.cellSize / 2;
      token.y = unit.y * this.cellSize + this.cellSize / 2;
      token.eventMode = 'static';
      token.cursor = 'pointer';
      const unitId = unit.id;
      token.on('pointerdown', (event) => {
        event.stopPropagation();
        this.callbacks.onUnitClick?.(unit);
      });

      const radius = this.cellSize * 0.38;
      const circle = new Graphics();
      const color = unit.team === 'player' ? 0xd4a54a : 0xc84f3c;
      circle.circle(0, 0, radius).fill(color);
      circle.circle(0, 0, radius).stroke({ width: 2, color: 0xf7f2e7 });

      const label = new Text({
        text: unit.name,
        style: new TextStyle({ fontSize: 12, fill: 0xffffff, fontFamily: 'Microsoft YaHei, sans-serif' }),
      });
      label.anchor.set(0.5, 1);
      label.y = radius + 12;

      const hp = new Text({
        text: `${unit.hp}/${unit.hpMax}`,
        style: new TextStyle({ fontSize: 11, fill: 0xdfe6ea, fontFamily: 'sans-serif' }),
      });
      hp.anchor.set(0.5, 0);
      hp.y = -radius - 16;

      const facing = new Graphics();
      const v = DIRECTION_VECTORS[unit.facing];
      facing.moveTo(v.dx * radius * 1.25, v.dy * radius * 1.25);
      facing.lineTo(-v.dy * radius * 0.55, v.dx * radius * 0.55);
      facing.lineTo(v.dy * radius * 0.55, -v.dx * radius * 0.55);
      facing.closePath().fill(0xffffff);

      token.addChild(circle);
      token.addChild(facing);
      token.addChild(label);
      token.addChild(hp);
      this.tokenLayer.addChild(token);
      void unitId;
    }
  }
}
