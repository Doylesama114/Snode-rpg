import { describe, expect, it } from 'vitest';
import stealthJson from '../../data/cards/abilities/rogue-stealth.json';
import shadowStrikeJson from '../../data/cards/abilities/rogue-shadow-strike.json';
import sapJson from '../../data/cards/abilities/rogue-sap.json';
import bideJson from '../../data/cards/abilities/rogue-bide-time.json';
import butterflyJson from '../../data/cards/abilities/rogue-butterfly-dance.json';
import type { AbilityCardData, StatusCardData } from '../cards';
import { Board } from '../board';
import { Encounter } from '../encounter';
import { SeededRng } from '../rng';
import { beginTurn } from '../action-economy';
import { executeAbility } from '../resolver';
import { executeBasicAttack } from '../basic-actions';
import { normalizeAttrs, UnitInstance } from '../unit';
import { processTurnStartStatuses } from '../phases';
import type { UnitCard, WeaponData } from '../types';

const statusModules = import.meta.glob('../../data/cards/statuses/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const statusCatalog = new Map<string, StatusCardData>();
for (const mod of Object.values(statusModules)) {
  const status = mod as unknown as StatusCardData;
  statusCatalog.set(status.id, status);
}

class FixedHitRng {
  next(): number { return 0.5; }
  die(sides: number): number { return 1 + Math.floor(0.5 * sides); }
}
class QueueRng {
  constructor(private queue: number[]) {}
  next(): number { return 0.5; }
  die(sides: number): number { return this.queue.shift() ?? 1 + Math.floor(0.5 * sides); }
}

function rogueCard(): UnitCard {
  return {
    id: 'rogue', name: '游荡者', kind: 'player', class: '游荡者', level: 3,
    attrs: normalizeAttrs({ 力量: 8, 敏捷: 16, 体质: 12, 智力: 10, 感知: 14, 魅力: 10, 意志: 10, 幸运: 10 }),
    hpMax: 20, fpMax: 10, ac: 14, speed: 6, proficiency: 2, keyAttr: '敏捷',
    weaponProfs: { 匕首: 1, 刺剑: 1, 锤类: 1 },
    resources: { comboPointsMax: 5 },
  };
}
function player(x: number, y: number, opts: { weapon?: WeaponData; stealthed?: boolean } = {}) {
  const card = rogueCard();
  card.weapon = opts.weapon ?? { id: 'dagger', name: '匕首', category: '匕首', tags: ['匕首'], hands: 1, dice: '1D4', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'adjacent' };
  const u = new UnitInstance(card, { team: 'player', x, y, facing: 'N' });
  u.stealthed = opts.stealthed ?? false;
  return u;
}
function enemy(id: string, x: number, y: number, opts: { ac?: number; hp?: number; creatureType?: string; size?: 'small'|'medium'|'large'|'huge'; attrs?: Partial<Record<string, number>> } = {}) {
  const size = opts.size ?? 'medium';
  return new UnitInstance({
    id, name: id, kind: 'monster', size, creatureType: opts.creatureType ?? '类人',
    attrs: normalizeAttrs(opts.attrs ?? { 力量: 8, 敏捷: 14, 体质: 10, 智力: 10, 感知: 10, 魅力: 8, 意志: 8, 幸运: 10 }),
    hpMax: opts.hp ?? 20, fpMax: 4, ac: opts.ac ?? 14, speed: 5, proficiency: 2, keyAttr: '敏捷',
    weaponProfs: { 短剑: 1 },
    weapon: { id: 'short', name: '短剑', category: '剑类', tags: ['剑'], hands: 1, dice: '1D4', damageType: '挥砍', attackAttr: '敏捷', rangeMetric: 'adjacent' },
  }, { team: 'enemy', x, y, facing: 'S' });
}
function enc(...units: UnitInstance[]) { const e = new Encounter('p2', new Board(10,10), new SeededRng(1)); for (const u of units) e.addUnit(u); return e; }

const cards = {
  stealth: stealthJson as unknown as AbilityCardData,
  shadow: shadowStrikeJson as unknown as AbilityCardData,
  sap: sapJson as unknown as AbilityCardData,
  bide: bideJson as unknown as AbilityCardData,
  butterfly: butterflyJson as unknown as AbilityCardData,
};

describe('P2 技能结算', () => {
  it('潜行：进入潜行，攻击后显形', () => {
    const source = player(0, 0); beginTurn(source); source.fp = 10;
    const target = enemy('goblin', 3, 0);
    const e = enc(source, target);
    const r = executeAbility(cards.stealth, source, e, { rng: new FixedHitRng(), statusCatalog, level: 3 });
    expect(r.ok).toBe(true);
    expect(source.stealthed).toBe(true);
    target.x = 1; target.y = 0;
    const atk = executeBasicAttack(source, target, e, new FixedHitRng(), statusCatalog, undefined, { gainCombo: false, skipActionCost: true });
    expect(atk.ok).toBe(true);
    expect(source.stealthed).toBe(false);
  });

  it('影袭：AC减半向下取整，结算后+4', () => {
    const source = player(0, 0, { stealthed: true }); beginTurn(source); source.fp = 10;
    const target = enemy('goblin', 1, 0, { ac: 15, hp: 40 });
    const e = enc(source, target);
    // D20=10，匕首命中：10+3+1=14 vs floor(15/2)=7 命中；伤害(1D4=3+3)+4=10
    const r = executeAbility(cards.shadow, source, e, { rng: new FixedHitRng(), statusCatalog, level: 3 });
    expect(r.ok).toBe(true);
    expect(r.damageByTarget.get('goblin')).toBe(10);
    expect(target.hp).toBe(30);
    expect(source.stealthed).toBe(false);
  });

  it('闷棍：体质豁免极大劣势=3D20取低，失败昏迷且受伤害解除', () => {
    const source = player(0, 0, {
      weapon: { id: 'club', name: '木棍', category: '锤类', tags: ['钝器', '锤类'], hands: 1, dice: '1D4', damageType: '钝击', attackAttr: '敏捷', rangeMetric: 'adjacent' },
      stealthed: true,
    }); beginTurn(source);
    const target = enemy('goblin', 1, 0, { hp: 30 });
    const e = enc(source, target);
    // 3D20=[10,5,2]取2；体质+0=2<15失败；1D3原始D6=4→2轮
    const r = executeAbility(cards.sap, source, e, { rng: new QueueRng([10, 5, 2, 4]), statusCatalog, level: 1 });
    expect(r.ok).toBe(true);
    expect(target.hasCondition('unconscious')).toBe(true);
    expect(target.conditionDurations.get('unconscious')?.serial).toBe(source.turnSerial + 2);
    target.applyDamage(1);
    expect(target.hasCondition('unconscious')).toBe(false);
  });

  it('闷棍：构造体/超大型免疫', () => {
    const source = player(0, 0, {
      weapon: { id: 'club', name: '木棍', category: '锤类', tags: ['钝器', '锤类'], hands: 1, dice: '1D4', damageType: '钝击', attackAttr: '敏捷', rangeMetric: 'adjacent' },
      stealthed: true,
    }); beginTurn(source);
    const golem = enemy('golem', 1, 0, { creatureType: '构造体' });
    const e = enc(source, golem);
    const r = executeAbility(cards.sap, source, e, { rng: new QueueRng([10, 5, 2, 4]), statusCatalog, level: 1 });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('免疫闷棍');
  });

  it('伺机待发：本回合攻击命中与伤害减半', () => {
    const source = player(0, 0); beginTurn(source); source.fp = 10;
    const target = enemy('goblin', 1, 0, { hp: 40 });
    const e = enc(source, target);
    const bide = executeAbility(cards.bide, source, e, { rng: new FixedHitRng(), statusCatalog, level: 3 });
    expect(bide.ok).toBe(true);
    expect(source.marks.get('bide_time_penalty')).toBe(1);
    // 基础攻击 D20=20 暴击；武器 1D4=4+3=7 ×2=14，减半=7
    const atk = executeBasicAttack(source, target, e, new QueueRng([20, 4]), statusCatalog, undefined, { gainCombo: false, skipActionCost: true });
    expect(atk.damage).toBe(7);
  });

  it('蝶舞初次施放：魅力豁免失败进入魅惑，有豁免熟练自动成功', () => {
    const source = player(0, 0); beginTurn(source); source.fp = 10;
    const a = enemy('a', 1, 0, { attrs: { 魅力: 8 } });
    const b = enemy('b', 2, 0, { attrs: { 魅力: 12 } });
    b.saveProfs.push('魅力');
    const e = enc(source, a, b);
    // a 豁免10失败；b 自动成功（不消耗掷骰）
    const r = executeAbility(cards.butterfly, source, e, { rng: new QueueRng([10]), statusCatalog, level: 3 });
    expect(r.ok).toBe(true);
    expect(a.hasCondition('charmed')).toBe(true);
    expect(a.temporaryConditions.has('charmed')).toBe(true);
    expect(b.hasCondition('charmed')).toBe(false);
    beginTurn(a);
    a.removeTemporaryConditionsOnTurnEnd();
    expect(a.hasCondition('charmed')).toBe(false);
  });

  it('死亡印记L10：首次驱散只消耗护盾，不解除标记', () => {
    const target = enemy('bandit', 1, 0);
    target.marks.set('death_mark', 1);
    target.shieldedMarks.add('death_mark');
    expect(target.dispelMark('death_mark')).toBe(false);
    expect(target.marks.get('death_mark')).toBe(1);
    expect(target.dispelMark('death_mark')).toBe(true);
    expect(target.marks.has('death_mark')).toBe(false);
  });

  it('通用取消钩子：命中后伤害与后续效果全部抵消', () => {
    const source = player(0, 0); beginTurn(source);
    const target = enemy('goblin', 1, 0, { hp: 30 });
    const e = enc(source, target);
    const atk = executeBasicAttack(source, target, e, new FixedHitRng(), statusCatalog, undefined, {
      gainCombo: false,
      cancelHitEffects: () => true,
    });
    expect(atk.ok).toBe(true);
    expect(atk.damage).toBe(0);
    expect(target.hp).toBe(30);
    expect(atk.events.some((ev) => ev.detail?.includes('抵消'))).toBe(true);
  });

  it('状态阶段：中毒回合开始先按层数扣血，再D3追加层数', () => {
    const target = enemy('goblin', 1, 0, { hp: 30 });
    target.addCondition('poisoned', 2, 99);
    const e = enc(target);
    // 追加1D3：D6=6→3层
    const events = processTurnStartStatuses(target, e, statusCatalog, new QueueRng([6]));
    expect(target.hp).toBe(28);
    expect(target.conditionLayersOf('poisoned')).toBe(5);
    expect(events.length).toBeGreaterThanOrEqual(2);
  });
});
