import type { SeededRng } from './rng';
import type { UnitInstance } from './unit';
import { beginTurn, endTurn } from './action-economy';
import type { Board } from './board';

export type EncounterPhase = 'setup' | 'initiative' | 'turn' | 'ended';

export type EncounterOutcome = 'victory' | 'defeat' | 'ongoing';

export interface InitiativeEntry {
  unitId: string;
  total: number;
  roll?: number;
  mode: 'roll' | 'fixed';
}

/**
 * 遭遇实例：先攻队列、轮次与回合循环、胜负判定。
 * 注意：同先攻值规则正文未写死，当前使用稳定排序（保持加入顺序），待项目所有者裁决。
 */
export class Encounter {
  readonly id: string;
  readonly board: Board;
  readonly units: UnitInstance[] = [];
  readonly rng: SeededRng;

  round = 0;
  turnIndex = -1;
  phase: EncounterPhase = 'setup';
  outcome: EncounterOutcome = 'ongoing';
  initiative: InitiativeEntry[] = [];

  constructor(id: string, board: Board, rng: SeededRng) {
    this.id = id;
    this.board = board;
    this.rng = rng;
  }

  addUnit(unit: UnitInstance): void {
    if (this.phase !== 'setup') throw new Error('只能在 setup 阶段加入单位');
    this.units.push(unit);
  }

  unitById(id: string): UnitInstance | undefined {
    return this.units.find((u) => u.id === id);
  }

  livingUnits(): UnitInstance[] {
    return this.units.filter((u) => u.hp > 0);
  }

  livingEnemiesOf(unit: UnitInstance): UnitInstance[] {
    return this.livingUnits().filter((u) => u.team !== unit.team);
  }

  /** 掷先攻：玩家 D20+敏捷调整，怪物固定值。同值稳定排序。 */
  rollInitiative(): void {
    const entries: InitiativeEntry[] = [];
    for (const unit of this.units) {
      const mode = unit.initiative.mode;
      if (mode === 'roll') {
        const roll = this.rng.d20();
        const total = roll + unit.attrMod('敏捷');
        entries.push({ unitId: unit.id, total, roll, mode });
      } else {
        entries.push({ unitId: unit.id, total: unit.initiative.value ?? 0, mode: 'fixed' });
      }
    }
    entries.sort((a, b) => b.total - a.total); // Array.sort 稳定：同值保持加入顺序
    this.initiative = entries;
    this.phase = 'initiative';
  }

  /** 从 initiative 阶段进入首个回合。 */
  start(): boolean {
    if (this.phase === 'turn') return true;
    if (this.phase !== 'initiative') this.rollInitiative();
    this.round = 1;
    this.turnIndex = 0;
    this.phase = 'turn';
    this.beginCurrentTurn();
    return true;
  }

  get currentUnit(): UnitInstance | null {
    if (this.phase !== 'turn' || this.turnIndex < 0 || this.turnIndex >= this.initiative.length) {
      return null;
    }
    return this.unitById(this.initiative[this.turnIndex]?.unitId ?? '') ?? null;
  }

  beginCurrentTurn(): void {
    const unit = this.currentUnit;
    if (unit) {
      unit.beginOwnTurn();
      beginTurn(unit);
    }
  }

  /**
   * 结束当前回合并推进到下一名存活单位。
   * 若先攻队列回绕，轮次 +1。
   */
  endTurn(): EncounterOutcome {
    if (this.phase !== 'turn') return this.outcome;
    const current = this.currentUnit;
    if (current) {
      endTurn(current);
      current.removeTemporaryConditionsOnTurnEnd();
    }

    let scanned = 0;
    do {
      this.turnIndex += 1;
      if (this.turnIndex >= this.initiative.length) {
        this.turnIndex = 0;
        this.round += 1;
      }
      scanned += 1;
      if (scanned > this.initiative.length + 1) {
        this.outcome = this.checkOutcome();
        this.phase = 'ended';
        return this.outcome;
      }
    } while (!this.currentUnit || this.currentUnit.hp <= 0);

    this.beginCurrentTurn();
    this.outcome = this.checkOutcome();
    if (this.outcome !== 'ongoing') this.phase = 'ended';
    return this.outcome;
  }

  /** 胜负：敌方全灭胜利；玩家全灭失败。 */
  checkOutcome(): EncounterOutcome {
    const living = this.livingUnits();
    const hasPlayer = living.some((u) => u.team === 'player');
    const hasEnemy = living.some((u) => u.team === 'enemy');
    if (!hasEnemy) return 'victory';
    if (!hasPlayer) return 'defeat';
    return 'ongoing';
  }

  finish(outcome: Exclude<EncounterOutcome, 'ongoing'>): void {
    this.outcome = outcome;
    this.phase = 'ended';
  }
}
