import { describe, expect, it } from 'vitest';
const monsterModules = import.meta.glob('../../data/cards/monsters/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const statusModules = import.meta.glob('../../data/cards/statuses/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
import type { AbilityCardData, MonsterCardData, StatusCardData } from '../cards';
import stealthJson from '../../data/cards/abilities/rogue-stealth.json';
import phantomJson from '../../data/cards/abilities/rogue-phantom-dagger.json';
import deathMarkJson from '../../data/cards/abilities/rogue-death-mark.json';
import bideJson from '../../data/cards/abilities/rogue-bide-time.json';
import provokeJson from '../../data/cards/abilities/rogue-provoke-duel.json';
import spinJson from '../../data/cards/abilities/rogue-spin-blade-song.json';
import toxinJson from '../../data/cards/abilities/rogue-toxin-spread.json';
import nowhereJson from '../../data/cards/abilities/rogue-nowhere-to-run.json';
import butterflyJson from '../../data/cards/abilities/rogue-butterfly-dance.json';
import { CardCatalog } from '../catalog';
import { Board } from '../board';
import { Encounter } from '../encounter';
import { PveGame } from '../pve-game';
import { createMonsterUnit, createPlayerUnit } from '../combatant-factory';
import { SeededRng } from '../rng';
import { normalizeAttrs } from '../unit';

const monsters = Object.values(monsterModules) as unknown as MonsterCardData[];
const monsterMap = new Map(monsters.map((m) => [m.id, m]));
const statuses = Object.values(statusModules) as unknown as StatusCardData[];
const statusCatalog = new Map(statuses.map((s) => [s.id, s]));

function makePlayer(level = 3) {
  return createPlayerUnit({
    id: 'pc', name: '测试游荡者', class: '游荡者', level,
    attrs: normalizeAttrs({ 力量: 8, 敏捷: 16, 体质: 12, 智力: 10, 感知: 14, 魅力: 10, 意志: 10, 幸运: 10 }),
    hpMax: 20, fpMax: 30, ac: 14, speed: 6, keyAttr: '敏捷', proficiency: 2,
    weaponProfs: { 刺剑: 1, 匕首: 1, 袖剑: 1 },
    weapon: { id: 'rapier', name: '刺剑', category: '剑类', tags: ['剑'], hands: 1, dice: '1D8', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'adjacent' },
  });
}
function makeGame(abilities: AbilityCardData[], level = 3) {
  const player = makePlayer(level);
  const board = new Board(8, 8);
  const enc = new Encounter('p2-pve', board, new SeededRng(42));
  player.x = 2; player.y = 2;
  enc.addUnit(player);
  const goblin = createMonsterUnit({ ...monsterMap.get('goblin') as MonsterCardData, hpMax: 30, ac: 10 }, { id: 'goblin', x: 3, y: 2, facing: 'S' });
  enc.addUnit(goblin);
  enc.initiative = [
    { unitId: player.id, total: 99, mode: 'fixed' },
    { unitId: goblin.id, total: 1, mode: 'fixed' },
  ];
  const catalog = new CardCatalog({ abilities, statuses, monsters });
  const game = new PveGame(enc, { rng: new SeededRng(42), catalog, playerAbilities: abilities });
  game.start();
  return { game, player, goblin };
}

const a = (x: unknown) => x as AbilityCardData;

describe('P2 PveGame 系统', () => {
  it('潜行中的玩家不会被怪物单体攻击', () => {
    const { game, player } = makeGame([a(stealthJson)]);
    game.encounter.unitById('goblin')!.x = 5;
    expect(game.playerUseAbility('rogue-stealth', [player.id]).ok).toBe(true);
    expect(player.stealthed).toBe(true);
    const hpBefore = player.hp;
    game.playerEndTurn();
    expect(player.hp).toBe(hpBefore);
  });

  it('伺机待发：下一回合获得额外主要动作', () => {
    const { game, player } = makeGame([a(bideJson)]);
    expect(game.playerUseAbility('rogue-bide-time', [player.id]).ok).toBe(true);
    game.playerEndTurn();
    expect(game.phase).toBe('playerTurn');
    expect(player.extraMainActions).toBe(1);
  });

  it('幻影匕首：玩家单目标攻击后追加匕首攻击事件', () => {
    const { game, goblin } = makeGame([a(phantomJson)]);
    expect(game.playerUseAbility('rogue-phantom-dagger', [goblin.id]).ok).toBe(true);
    const before = goblin.hp;
    const atk = game.playerBasicAttack('goblin');
    expect(atk.ok).toBe(true);
    const events = game.lastPlayerExtraEvents.length > 0 ? game.lastPlayerExtraEvents : atk.events;
    expect(events.some((e) => e.label.includes('幻影匕首'))).toBe(true);
    void before;
  });

  it('死亡印记：终结技命中后直接处决', () => {
    const finisher: AbilityCardData = {
      id: 'test-finisher', name: '测试终结技', class: '游荡者', style: '奇袭', tier: '四阶', category: 'skill', active: true,
      cast: { action: 'main', fp: '0', duration: 'instant', usage: { scope: 'unlimited', max: 99 }, keywords: ['战技', '近战攻击', '终结技'] },
      conditions: [], targeting: { kind: 'unit', range: { metric: 'adjacent' }, filter: { teams: ['enemy'], livingOnly: true } },
      resolution: {
        rolls: [{ id: 'attack', kind: 'attack', attr: 'weapon', prof: 'weapon', vs: 'AC', target: 'targets', mods: [{ guaranteedCrit: true }] }],
        branches: [{ if: { roll: 'attack', outcome: 'hit' }, effects: [{ op: 'damage', source: 'weapon', dice: '@weapon.dice', flat: '@weapon.attrMod' }] }],
      },
    };
    const { game, goblin } = makeGame([a(deathMarkJson), finisher], 15);
    expect(game.playerUseAbility('rogue-death-mark', [goblin.id]).ok).toBe(true);
    expect(goblin.marks.get('death_mark')).toBe(1);
    const result = game.playerUseAbility('test-finisher', [goblin.id]);
    expect(result.ok).toBe(true);
    expect(goblin.hp).toBe(0);
    expect(result.events.some((e) => e.label.includes('死亡印记处决'))).toBe(true);
  });

  it('挑衅对决：双方各消耗一次反应使用次数', () => {
    const { game, goblin } = makeGame([a(provokeJson)]);
    const before = goblin.actions.reactionUsed;
    expect(game.playerProvokeDuel('goblin').ok).toBe(true);
    expect(game.player.actions.reactionUsed).toBe(1);
    expect(goblin.actions.reactionUsed).toBe(before + 1);
  });

  it('旋刃魂曲：创建区域并立即触发进入伤害', () => {
    const { game, goblin } = makeGame([a(spinJson)]);
    const result = game.playerCastSpinBladeSong(goblin.x, goblin.y);
    expect(result.ok).toBe(true);
    expect(game.zones).toHaveLength(1);
    expect(result.events.some((e) => e.kind === 'aoeSave')).toBe(true);
  });

  it('毒性蔓延：6米内目标中毒并消耗使用次数', () => {
    const { game, goblin } = makeGame([a(toxinJson)]);
    const result = game.playerUseToxinSpread(0, 'goblin');
    expect(result.ok).toBe(true);
    expect(goblin.hasCondition('poisoned')).toBe(true);
    expect(game.player.getUsage('rogue-toxin-spread:shortRest')).toBe(1);
  });

  it('无处可逃：随后基础移动免费且不要求附赠动作', () => {
    const { game, goblin } = makeGame([a(nowhereJson)]);
    goblin.x = 4;
    const before = game.player.x;
    expect(game.playerUseAbility('rogue-nowhere-to-run', [goblin.id]).ok).toBe(true);
    expect(game.player.x).not.toBe(before);
  });

  it('毒性蔓延 L15：双效果只消耗一次使用次数', () => {
    const { game } = makeGame([a(toxinJson)], 15);
    const r = game.playerUseToxinSpreadPair(2, 'pc', 3, 'pc');
    expect(r.ok).toBe(true);
    expect(game.player.getUsage('rogue-toxin-spread:shortRest')).toBe(1);
    expect(game.player.marks.get('toxin_spread_double')).toBe(1);
    expect(game.player.marks.get('toxin_spread_bonus')).toBe(1);
  });

  it('蝶舞：施放后进入引导，下回合完成并结算终幕伤害', () => {
    const { game, goblin } = makeGame([a(butterflyJson)]);
    const cast = game.playerUseAbility('rogue-butterfly-dance', [goblin.id]);
    expect(cast.ok).toBe(true);
    expect(game.channelingButterfly).not.toBeNull();
    game.playerEndTurn();
    // 敌人被魅惑（若未受伤则其回合朝玩家移动并跳过攻击）
    expect(game.phase).toBe('playerTurn');
    const done = game.playerCompleteButterflyDance(0);
    expect(done.ok).toBe(true);
    game.playerEndTurn();
    expect(game.channelingButterfly).toBeNull();
  });
});
