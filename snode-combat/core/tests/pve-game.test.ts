import { describe, expect, it } from 'vitest';
const monsterModules = import.meta.glob('../../data/cards/monsters/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
import type { MonsterCardData, AbilityCardData } from '../cards';
import quickPrepJson from '../../data/cards/abilities/rogue-quick-prep.json';
import firstBloodJson from '../../data/cards/abilities/rogue-first-blood.json';
import feintJson from '../../data/cards/abilities/rogue-feint.json';
import sprintBurstJson from '../../data/cards/abilities/rogue-sprint-burst.json';
import throatLockJson from '../../data/cards/abilities/rogue-throat-lock.json';
import { CardCatalog } from '../catalog';
import { Board } from '../board';
import { Encounter } from '../encounter';
import { PveGame } from '../pve-game';
import { createMonsterUnit, createPlayerUnit } from '../combatant-factory';
import { SeededRng } from '../rng';
import { normalizeAttrs } from '../unit';
import type { EncounterCardData } from '../cards';
import type { Direction } from '../types';

const monsters = Object.values(monsterModules) as unknown as MonsterCardData[];
const monsterMap = new Map(monsters.map((m) => [m.id, m]));

function makePlayer(x: number, y: number) {
  return createPlayerUnit({
    id: 'pc', name: '测试游荡者', class: '游荡者', level: 1,
    attrs: normalizeAttrs({ 力量: 8, 敏捷: 16, 体质: 12, 智力: 10, 感知: 14, 魅力: 10, 意志: 10, 幸运: 10 }),
    hpMax: 20, fpMax: 10, ac: 14, speed: 6, keyAttr: '敏捷', proficiency: 2,
    weaponProfs: { 刺剑: 1, 匕首: 1, 袖剑: 1 },
    weapon: { id: 'rapier', name: '刺剑', category: '剑类', tags: ['剑'], hands: 1, dice: '1D8', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'adjacent' },
  });
}

function makeEncounter(player: ReturnType<typeof makePlayer>, monsterId: string, mx: number, my: number, monsterPatch: Partial<MonsterCardData> = {}) {
  const card = { ...(monsterMap.get(monsterId) as MonsterCardData), ...monsterPatch };
  const board = new Board(8, 8);
  const enc = new Encounter('test-enc', board, new SeededRng(1));
  player.x = 3; player.y = 5;
  enc.addUnit(player);
  const monster = createMonsterUnit(card, { id: 'monster', x: mx, y: my, facing: 'N' });
  enc.addUnit(monster);
  enc.initiative = [
    { unitId: player.id, total: 99, mode: 'fixed' },
    { unitId: monster.id, total: 1, mode: 'fixed' },
  ];
  return { enc, player, monster };
}

const emptyCatalog = new CardCatalog({ statuses: [], monsters, abilities: [] });

describe('PveGame 最小可玩循环', () => {
  it('快速备战：战斗开始立即获得连击点', () => {
    const player = makePlayer(3, 5);
    const { enc } = makeEncounter(player, 'goblin', 3, 3, { hpMax: 10 });
    const catalog = new CardCatalog({ statuses: [], monsters, abilities: [quickPrepJson as unknown as AbilityCardData] });
    const game = new PveGame(enc, { rng: new SeededRng(3), catalog, playerAbilities: [quickPrepJson as unknown as AbilityCardData] });
    game.start();
    expect(player.comboPoints).toBe(1);
  });

  it('佯攻：基础攻击未命中后返还主要动作并等待替换', () => {
    const player = makePlayer(3, 5);
    const { enc, monster } = makeEncounter(player, 'goblin', 3, 4, { hpMax: 20, ac: 99 });
    const catalog = new CardCatalog({ statuses: [], monsters, abilities: [feintJson as unknown as AbilityCardData] });
    const game = new PveGame(enc, { rng: new SeededRng(7), catalog, playerAbilities: [feintJson as unknown as AbilityCardData] });
    game.start();
    const result = game.playerBasicAttack('monster');
    expect(result.ok).toBe(true);
    expect(game.pendingFeint?.targetId).toBe('monster');
    expect(player.actions.main).toBe(true);
  });

  it('冲刺爆发：全速移动后强制免费基础攻击', () => {
    const player = makePlayer(3, 5);
    const { enc, monster } = makeEncounter(player, 'goblin', 3, 2, { hpMax: 20, ac: 1 });
    const catalog = new CardCatalog({ statuses: [], monsters, abilities: [sprintBurstJson as unknown as AbilityCardData] });
    const game = new PveGame(enc, { rng: new SeededRng(7), catalog, playerAbilities: [sprintBurstJson as unknown as AbilityCardData] });
    game.start();
    player.gainCombo(3);
    const used = game.playerUseAbility('rogue-sprint-burst', [player.id]);
    expect(used.ok).toBe(true);
    expect(game.pendingSprintBurst).toBe(true);
    const move = game.playerMoveTo(3, 3);
    expect(move.ok).toBe(true);
    const hit = game.playerFinishSprintBurst();
    expect(hit.ok).toBe(true);
    expect(hit.damage).toBeGreaterThan(0);
    expect(player.actions.main).toBe(true); // 免费攻击
  });

  it('锁喉离场用法消耗反应动作', () => {
    const player = makePlayer(3, 5);
    const { enc, monster } = makeEncounter(player, 'goblin', 3, 4, { hpMax: 20 });
    const catalog = new CardCatalog({ statuses: [], monsters, abilities: [throatLockJson as unknown as AbilityCardData] });
    const game = new PveGame(enc, { rng: new SeededRng(7), catalog, playerAbilities: [throatLockJson as unknown as AbilityCardData] });
    game.start();
    game.phase = 'enemyTurn';
    player.actions.reactionUsed = 0;
    const result = game.playerUseLockThroatOffTurn('monster');
    expect(result.ok).toBe(true);
    expect(player.actions.reactionUsed).toBe(1);
  });

  it('第一滴血：本场首次造成伤害附加10点失血', () => {
    const player = makePlayer(3, 5);
    const { enc, monster } = makeEncounter(player, 'goblin', 3, 4, { hpMax: 40, ac: 1 });
    monster.hp = 40;
    const catalog = new CardCatalog({ statuses: [], monsters, abilities: [firstBloodJson as unknown as AbilityCardData] });
    const game = new PveGame(enc, { rng: new SeededRng(7), catalog, playerAbilities: [firstBloodJson as unknown as AbilityCardData] });
    game.start();
    const result = game.playerBasicAttack('monster');
    expect(result.ok).toBe(true);
    expect(monster.hp).toBe(40 - result.damage - 10);
  });

  it('玩家移动后基础攻击击杀敌人 → 胜利结束', () => {
    const player = makePlayer(3, 5);
    const { enc, monster } = makeEncounter(player, 'goblin', 3, 3, { hpMax: 1, ac: 1 });
    monster.hp = 1;
    const game = new PveGame(enc, { rng: new SeededRng(7), catalog: emptyCatalog, playerAbilities: [] });
    expect(game.start()).toBe('playerTurn');

    const move = game.playerMoveTo(3, 4);
    expect(move.ok).toBe(true);
    expect(move.activated).toBe('basic');
    expect(player.actions.bonus).toBe(false);

    const attack = game.playerBasicAttack('monster');
    expect(attack.ok).toBe(true);
    expect(game.phase).toBe('ended');
    expect(enc.outcome).toBe('victory');
  });

  it('玩家结束回合后，怪物AI自动移动并攻击', () => {
    const player = makePlayer(3, 5);
    const { enc, monster } = makeEncounter(player, 'goblin', 3, 1);
    monster.ac = 1;
    const game = new PveGame(enc, { rng: new SeededRng(11), catalog: emptyCatalog, playerAbilities: [] });
    game.start();
    expect(game.phase).toBe('playerTurn');
    const hpBefore = player.hp;
    game.playerEndTurn();
    expect(game.phase).toBe('playerTurn'); // 怪物行动完回到玩家回合
    expect(monster.x).toBe(3);
    expect(monster.y).toBe(4); // 移动到玩家相邻
    expect(player.hp).toBeLessThan(hpBefore);
  });
});
