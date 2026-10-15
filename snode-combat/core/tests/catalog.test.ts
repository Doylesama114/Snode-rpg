import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../catalog';
import type { AbilityCardData, EncounterCardData, MonsterCardData, StatusCardData } from '../cards';
import { buildPveEncounter, createPlayerUnit } from '../combatant-factory';
import { SeededRng } from '../rng';
import { normalizeAttrs } from '../unit';

type JsonRecord = Record<string, unknown>;

const abilityModules = import.meta.glob('../../data/cards/abilities/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, JsonRecord>;
const statusModules = import.meta.glob('../../data/cards/statuses/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, JsonRecord>;
const monsterModules = import.meta.glob('../../data/cards/monsters/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, JsonRecord>;
const encounterModules = import.meta.glob('../../data/encounters/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, JsonRecord>;

const abilities = Object.values(abilityModules) as unknown as AbilityCardData[];
const statuses = Object.values(statusModules) as unknown as StatusCardData[];
const monsters = Object.values(monsterModules) as unknown as MonsterCardData[];
const encounters = Object.values(encounterModules) as unknown as EncounterCardData[];

describe('数据目录', () => {
  it('P0 卡数量正确', () => {
    expect(abilities).toHaveLength(47); // P0 9 + P1 18 + P2 19 + 基础潜行
    expect(statuses).toHaveLength(22);
    expect(monsters).toHaveLength(3);
    expect(encounters).toHaveLength(1);
  });

  it('catalog 校验零错误', () => {
    const { errors } = buildCatalog({ abilities, statuses, monsters, encounters });
    expect(errors).toEqual([]);
  });

  it('可构建教学遭遇', () => {
    const player = createPlayerUnit({
      id: 'pc-test',
      name: '测试游荡者',
      class: '游荡者',
      level: 3,
      attrs: normalizeAttrs({ 力量: 8, 敏捷: 16, 体质: 12, 智力: 10, 感知: 14, 魅力: 10, 意志: 10, 幸运: 10 }),
      hpMax: 20,
      fpMax: 10,
      ac: 14,
      speed: 6,
      keyAttr: '敏捷',
      proficiency: 2,
      weaponProfs: { 刺剑: 1, 匕首: 1, 袖剑: 1, 手弩: 1, 火枪: 1 },
      weapon: {
        id: 'rapier-test',
        name: '刺剑',
        category: '剑类',
        tags: ['剑', '单手'],
        hands: 1,
        dice: '1D8',
        damageType: '穿刺',
        attackAttr: '敏捷',
        rangeMetric: 'adjacent',
      },
    });
    const monsterMap = new Map(monsters.map((m) => [m.id, m]));
    const enc = buildPveEncounter(encounters[0] as EncounterCardData, monsterMap, player, new SeededRng(1));
    expect(enc.units).toHaveLength(4);
    expect(enc.board.isBlocked(3, 3)).toBe(true);
    expect(enc.board.isBlocked(8, 3)).toBe(true);
    expect(enc.initiative).toHaveLength(4);
    enc.start();
    expect(enc.phase).toBe('turn');
    expect(enc.currentUnit).not.toBeNull();
  });
});
