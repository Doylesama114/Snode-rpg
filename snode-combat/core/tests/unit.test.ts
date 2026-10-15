import { describe, expect, it } from 'vitest';
import { UnitInstance, normalizeAttrs } from '../unit';
import type { UnitCard } from '../types';

function card(): UnitCard {
  return {
    id: 'test-rogue',
    name: '测试游荡者',
    kind: 'player',
    class: '游荡者',
    level: 3,
    attrs: normalizeAttrs({ 力量: 8, 敏捷: 16, 体质: 12, 智力: 10, 感知: 14, 魅力: 10, 意志: 10, 幸运: 10 }),
    hpMax: 20,
    fpMax: 10,
    ac: 14,
    speed: 6,
    proficiency: 2,
    keyAttr: '敏捷',
    weaponProfs: { 刺剑: 1, 匕首: 1, 袖剑: 1, 手弩: 1, 火枪: 1 },
    weapon: {
      id: 'rapier',
      name: '刺剑',
      category: '剑类',
      tags: ['剑', '单手'],
      hands: 1,
      dice: '1D8',
      damageType: '穿刺',
      attackAttr: '敏捷',
      rangeMetric: 'adjacent',
    },
    resources: {
      comboPointsMax: 5,
      ammo: {
        弹药: { reserve: 20, loaded: true },
      },
    },
  };
}

describe('UnitInstance', () => {
  it('属性调整值：floor((v-10)/2)', () => {
    const u = new UnitInstance(card(), { team: 'player' });
    expect(u.attrMod('敏捷')).toBe(3);
    expect(u.attrMod('力量')).toBe(-1);
  });

  it('武器攻击调整与熟练项', () => {
    const u = new UnitInstance(card(), { team: 'player' });
    expect(u.weaponAttackMod()).toBe(3);
    expect(u.weaponProfBonus()).toBe(1);
    expect(u.hasWeaponProf()).toBe(true);
  });

  it('枪械命中：使用敏捷属性调整；枪械伤害不附加属性', () => {
    const u = new UnitInstance(card(), { team: 'player' });
    u.weapon = {
      id: 'gun', name: '火枪', category: '火器', tags: ['火枪'], hands: 1,
      dice: '1D8', damageType: '穿刺', isTech: true, attackAttr: '敏捷',
      rangeMetric: 'grid', rangeMax: 12,
    };
    expect(u.weaponHitMod()).toBe(3);
    expect(u.weaponAttackMod()).toBe(0);
  });

  it('连击点：普通攻击命中+1，上限5', () => {
    const u = new UnitInstance(card(), { team: 'player' });
    expect(u.gainCombo()).toBe(1);
    for (let i = 0; i < 10; i += 1) u.gainCombo();
    expect(u.comboPoints).toBe(5);
    expect(u.spendAllCombo()).toBe(5);
    expect(u.comboPoints).toBe(0);
  });

  it('减速：移动力减半向下取整', () => {
    const u = new UnitInstance(card(), { team: 'player' });
    expect(u.effectiveSpeed()).toBe(6);
    u.addCondition('slowed');
    expect(u.effectiveSpeed()).toBe(3);
  });

  it('弹药：射击后未装填，装填后恢复', () => {
    const u = new UnitInstance(card(), { team: 'player' });
    expect(u.consumeLoadedAmmo('弹药')).toBe(true);
    expect(u.ammo.get('弹药')?.reserve).toBe(19);
    expect(u.ammo.get('弹药')?.loaded).toBe(false);
    expect(u.consumeLoadedAmmo('弹药')).toBe(false);
    expect(u.reload('弹药')).toBe(true);
    expect(u.ammo.get('弹药')?.loaded).toBe(true);
    expect(u.reload('弹药')).toBe(false);
  });

  it('伤害/治疗/直接失血', () => {
    const u = new UnitInstance(card(), { team: 'player' });
    expect(u.applyDamage(12)).toBe(12);
    expect(u.hp).toBe(8);
    expect(u.heal(3)).toBe(3);
    expect(u.hp).toBe(11);
    expect(u.loseHp(5)).toBe(5);
    expect(u.hp).toBe(6);
  });
});
