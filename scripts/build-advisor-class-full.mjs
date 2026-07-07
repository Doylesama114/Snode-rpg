#!/usr/bin/env node
/**
 * Phase 6 batch 1 (7039) — 将 registry 职业升至 full 档（首版：战士）
 * 用法: node scripts/build-advisor-class-full.mjs [职业名]
 * 不修改 hints 中种族/背景/人工 build 推荐；仅 meta 与 auto 字段。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadPanelConst,
  loadPanelWeaponProfs,
} from './advisor-entity-sources.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ADVISOR = path.join(ROOT, 'advisor');
const CHARGEN = path.join(ADVISOR, 'chargen');
const PANEL = path.join(ROOT, '斯诺德跑团', 'panel_data.js');
const REGISTRY = path.join(CHARGEN, 'class_registry.json');
const MULTICLASS = path.join(ADVISOR, 'rules', 'multiclass.json');

const TIER_ORDER = ['一阶', '二阶', '三阶', '四阶', '五阶', '六阶'];

const CLASS_FULL_PROFILES = {
  战士: {
    defaultFullL2MinSkills: 100,
    fpKeyLabel: '力量或敏捷',
    specBuildHints: {
      运动健将: '力量或敏捷型 build 均可；创建页选与主属性一致的一项，配合运动/体操等检定。',
      武器专精: '与主武器类型一致（近战选剑/斧/锤/长柄，远程选弓箭/火器）；专精加成仅对该武器类型生效。',
    },
    styleRoleHints: {
      斗争: '近战正面与徒手连段；力量型常见，可搭配猛击起手。',
      狂攻: '高爆发与火焰/位移；冲锋起手契合突进。',
      防护: '嘲讽、格挡与减伤；盾牌格挡起手契合坦克。',
      射击: '远程稳定输出；瞄准射击起手契合弓/火器线。',
      军团: '团队号令与阵型增益；偏辅助指挥。',
      机敏: '毒/控与投掷；敏捷型常见。',
    },
    chargenAttrDetail: '力量偏向斗争/狂攻/防护近战；敏捷偏向射击/机敏与部分狂攻。运动健将专精应选与主属性相同的一项。',
    combatRules: (className, slug, profile) => [
      {
        id: 'tip-' + slug + '-cr-shield',
        title: '盾牌与格挡反应',
        summary: '持盾且具备盾牌熟练时，可用盾牌格挡等反应减伤；防护/军团线常深化此路线。',
        detail: '起手「盾牌格挡」与防护风格防御姿态、嘲讽等配合；切换武器或弃盾后失去相关反应选项。',
        relatedSkills: ['盾牌格挡', '防御姿态'],
        tags: [className, '盾牌', '反应', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-charge',
        title: '冲锋与借机',
        summary: '冲锋等带位移的战技规划时，注意进入/离开敌人触及的借机风险；迅捷类位移不触发借机。',
        detail: '狂攻线「冲锋」用于接近；脱离时用回避或迅捷位移，避免贴脸多人时盲目穿人。',
        relatedSkills: ['冲锋'],
        tags: [className, '位移', '借机攻击', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-armor',
        title: '重甲与属性',
        summary: '战士可着全部护甲；重甲力量不足时移动受限，高敏低力 build 宜轻中甲。',
        detail: '防护/军团坦克向可选锁链/板甲；机敏/射击高敏 build 常用皮甲或中甲保敏捷加成。以创建页熟练与力量最终值为准。',
        relatedSkills: [],
        tags: [className, '护甲', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-fp',
        title: 'FP 与战技节奏',
        summary: '战技消耗 FP；多段战技或高 FP 技能需规划回合节奏，避免空 FP 时无应对手段。',
        detail: '一阶技能 FP 通常较低；长战可先低 FP 稳态输出，再交高 FP 爆发。短休/长休回复见基础规则。',
        relatedSkills: ['猛击', '冲锋'],
        tags: [className, 'FP', 'combat_rule'],
      },
    ],
    extraEquipmentRules: () => [],
  },
  蛮斗士: {
    defaultFullL2MinSkills: 60,
    fpKeyLabel: '力量',
    specBuildHints: {
      运动健将: '蛮斗士以力量为主；运动健将选力量，配合威力/运动等检定与近战输出。',
    },
    styleRoleHints: {
      斗争: '近战战技与连段；猛击起手常见，偏正面换血。',
      狂暴: '爆发与狂怒相关能力；凶蛮打击、鲜血雷鸣等起手可契合。',
      生机: '生命回复与续航；生命归还起手契合持久作战。',
      法咒: '氏族法术/戏法线；远古魔法补充远程与控场，勿与法师八学派混淆。',
    },
    chargenAttrDetail: '力量≥15 为常见目标；体质配合高 HP 与续航。法咒线仍依赖智力相关法术条目，但关键属性为力量。',
    combatRules: (className, slug) => [
      {
        id: 'tip-' + slug + '-cr-rage',
        title: '狂怒与爆发窗口',
        summary: '狂暴/狂怒类能力有开启与维持成本；在关键回合集中输出，避免空窗期硬顶。',
        detail: '专精「狂怒」与狂暴风格技能联动；爆发前确认 FP 与 HP 能否支撑换血节奏。',
        relatedSkills: ['凶蛮打击', '鲜血雷鸣'],
        tags: [className, '狂暴', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-sustain',
        title: '生机与回复',
        summary: '生机风格与生命归还等能力提供续航；长战优先低 FP 稳态再交高消耗战技。',
        detail: '蛮斗士 HP 成长较高；短休配合生机线可反复入场，但仍须规划 FP。',
        relatedSkills: ['生命归还'],
        tags: [className, '生机', '回复', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-narm',
        title: '轻中甲与无甲',
        summary: '蛮斗士熟练轻甲、中甲与盾牌；无甲防御专精（若选）与不着甲 AC 规则见创建页。',
        detail: '无法使用重甲；中甲保 AC 同时注意敏捷加成上限。盾牌可选但非所有 build 必带。',
        relatedSkills: [],
        tags: [className, '护甲', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-spell',
        title: '法咒线定位',
        summary: '法咒风格为氏族魔法/戏法，不是法师八学派；引用须来自 L2 蛮斗士上下文。',
        detail: '法咒与斗争/狂暴可并行投资，但 FP 与技能槽仍有限；优先点亮与属性匹配的低阶节点。',
        relatedSkills: [],
        tags: [className, '法咒', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-tradeoff',
        title: '凶蛮打击的换血',
        summary: '凶蛮打击等对敌我同时造成伤害；确认 HP 余量后再交，配合生机/生命归还。',
        detail: '起手可选凶蛮打击换爆发；勿在已残血时硬开，避免被反杀。',
        relatedSkills: ['凶蛮打击', '生命归还'],
        tags: [className, '起手特性', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-fp',
        title: 'FP 与战技节奏',
        summary: '战技与法术均消耗 FP；长战先低 FP 稳态，再交狂暴/高消耗技能。',
        detail: '一阶技能 FP 通常较低；短休/长休回复见基础规则。',
        relatedSkills: ['猛击', '鲜血雷鸣'],
        tags: [className, 'FP', 'combat_rule'],
      },
    ],
    extraEquipmentRules: (refClass) => {
      const rules = [];
      if (/除枪械|不含枪械/.test(refClass?.weapons || '')) {
        rules.push('蛮斗士不熟练枪械；勿推荐火枪/步枪等火器 build。');
      }
      return rules;
    },
  },
  猎人: {
    defaultFullL2MinSkills: 60,
    fpKeyLabel: '敏捷',
    specBuildHints: {
      武器专精: '远程 build 选弓箭/远程类；生存/兽群近战选猎刀/长柄；专精加成仅对该武器类型生效。',
    },
    styleRoleHints: {
      射击: '远程箭/枪术与标记；瞄准射击起手契合纯远程输出。',
      兽群: '野兽伙伴与协同攻击；野兽伙伴起手契合驯兽线。',
      机敏: '位移、伪装与规避；逃脱起手契合游走猎杀。',
      生存: '陷阱、毒性与战场构筑；荒野医疗起手契合续航。',
      猎鹰: '异能感知与俯冲收割；偏探知与激活类能力。',
    },
    chargenAttrDetail: '敏捷≥15 为常见目标；体质提升 HP 与部分豁免。驯兽/自然熟练与兽群/生存线协同。',
    combatRules: (className, slug) => [
      {
        id: 'tip-' + slug + '-cr-ranged',
        title: '远程与弹药',
        summary: '猎人熟练远程武器；箭矢/弹药消耗与超距/贴脸命中规则见基础规则与创建页。',
        detail: '射击线优先稳定远程输出；切换近战武器时注意触及与借机风险。',
        relatedSkills: ['瞄准射击'],
        tags: [className, '远程', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-beast',
        title: '野兽伙伴',
        summary: '兽群线与起手「野兽伙伴」依赖驯兽；伙伴行动与互动规则以规则书/DM 为准。',
        detail: '车卡若选野兽伙伴，后续投资兽群风格技能；勿假设已有特定伙伴种类。',
        relatedSkills: ['野兽伙伴'],
        tags: [className, '兽群', '驯兽', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-trap',
        title: '陷阱与生存构筑',
        summary: '生存风格含陷阱/毒性相关能力；战前布置与触发时机是猎人特色之一。',
        detail: '生存线适合控场与区域封锁；与射击/机敏远程 kite 可配合。',
        relatedSkills: ['侦测陷阱'],
        tags: [className, '生存', '陷阱', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-armor',
        title: '轻中甲与敏捷',
        summary: '猎人熟练轻甲、中甲与盾牌；高敏捷 build 常用皮甲/中甲保 AC 与加成。',
        detail: '无法着重重甲；盾牌可选。着甲休眠规则见基础规则。',
        relatedSkills: [],
        tags: [className, '护甲', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-kite',
        title: '位移与规避',
        summary: '机敏线与逃脱等能力用于拉开距离；脱离贴脸时注意借机攻击。',
        detail: '带迅捷关键词的位移不触发借机；被击退位移亦不触发。',
        relatedSkills: ['逃脱'],
        tags: [className, '位移', '借机攻击', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-fp',
        title: 'FP 与猎杀节奏',
        summary: '战技消耗 FP；远程爆发与陷阱布置需分回合规划，避免空 FP 无应对。',
        detail: '一阶技能 FP 通常较低；长战配合短休/荒野医疗等续航手段。',
        relatedSkills: ['瞄准射击', '荒野医疗'],
        tags: [className, 'FP', 'combat_rule'],
      },
    ],
    extraEquipmentRules: (refClass) => {
      const rules = [];
      const w = refClass?.weapons || '';
      if (/远程/.test(w)) rules.push('「远程」含弓/弩等；消耗箭矢或对应弹药，见装备与基础规则。');
      if (!/火器|枪械/.test(w)) rules.push('猎人不熟练枪械；勿推荐火枪/步枪 build。');
      return rules;
    },
  },
  牧师: {
    defaultFullL2MinSkills: 50,
    fpKeyLabel: '感知',
    specBuildHints: {
      神圣领域: '创建页选择信奉神祇对应的领域；领域能力影响戒律/虔佑/魂谒投资方向。',
      虔诚祷告: '幕间/日常祷告与部分戒律技能联动（如惩戒真言）；偏仪式与资讯型 build。',
    },
    styleRoleHints: {
      戒律: '神术输出与惩戒；惩击起手契合，虔诚祷告后可强化戒律技能。',
      虔佑: '治疗、净化与团队增益；治疗术/恢复术起手契合支援。',
      魂谒: '控场、回复与短休资源；责难等起手契合干扰与魂灵互动。',
    },
    chargenAttrDetail: '感知≥15 为常见目标；魅力豁免配合部分神术。宗教/医药熟练与治疗和仪式 build 协同。',
    combatRules: (className, slug) => [
      {
        id: 'tip-' + slug + '-cr-cast',
        title: '神术施法姿势',
        summary: '多数神术需空一只手做手势并念诵神言；持盾/武器时须规划空闲手。',
        detail: '上下文出现「施法动作+言语」描述时须原样引用；勿套用法师法器/魔棒规则。',
        relatedSkills: ['惩击', '治疗术'],
        tags: [className, '神术', '施法', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-heal',
        title: '治疗与 FP',
        summary: '治疗术/恢复术消耗 FP；长战须分配输出与回复节奏，避免空 FP 无法救场。',
        detail: '虔佑/魂谒线深化回复；恢复术有延迟，提前规划比濒死再交更安全。',
        relatedSkills: ['治疗术', '恢复术'],
        tags: [className, '治疗', 'FP', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-front',
        title: '盾牌前线',
        summary: '牧师可着轻中甲与盾牌；近站惩击/战锤仍须注意 AC 与借机。',
        detail: '戒律线可近战输出；勿假设重甲。着甲休眠见基础规则。',
        relatedSkills: ['神力战槌'],
        tags: [className, '盾牌', '护甲', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-discipline',
        title: '戒律输出',
        summary: '戒律风格偏神术伤害与增益；低阶优先上下文出现的戒律代表技能。',
        detail: '惩击随等级成长；与虔诚祷告联动的技能须注明前提（若上下文列出）。',
        relatedSkills: ['惩击', '神灵之火'],
        tags: [className, '戒律', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-bless',
        title: '虔佑支援',
        summary: '虔佑线强调回复与净化；每个自身回合限一次等限制以技能描述为准。',
        detail: '团队战时优先稳定血线再展开增益；勿包装成必成立连招。',
        relatedSkills: ['祈福', '治疗术'],
        tags: [className, '虔佑', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-soul',
        title: '魂谒控场',
        summary: '魂谒线含控场、睡眠与短休相关神术；引用须来自 L2 牧师列表。',
        detail: '与法师惑控/预言不同，名称以神术上下文为准；勿引用塑能箭等法师技能。',
        relatedSkills: ['睡眠术', '责难'],
        tags: [className, '魂谒', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-domain',
        title: '神圣领域',
        summary: '专精「神圣领域」决定神祇加成；build 须与所选领域一致，勿编造领域名。',
        detail: '具体领域能力见创建页/规则书；顾问仅引用上下文中出现的名称。',
        relatedSkills: [],
        tags: [className, '专精', '神圣领域', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-fp',
        title: '神术 FP 节奏',
        summary: '神术/法术均消耗 FP；多线兼修时优先点亮与角色定位匹配的低阶节点。',
        detail: '短休/长休回复见基础规则；标识由 DM 结算，勿建议刷标识。',
        relatedSkills: ['惩击'],
        tags: [className, 'FP', 'combat_rule'],
      },
    ],
    extraEquipmentRules: () => [
      '神术媒介为手势+言语（见技能描述）；非法师戏法/法术位体系。',
    ],
  },
  圣骑士: {
    defaultFullL2MinSkills: 50,
    fpKeyLabel: '意志',
    specBuildHints: {
      神圣誓言: '创建页宣誓正义事业；与惩戒/热诚进攻向或守护/圣洁支援向规划一致。',
      神佑: '降低疾病与力竭影响；偏长线冒险与生存。',
      神圣感知: '侦测附近邪恶；情报与先手定位，配合宗教/洞悉熟练。',
    },
    styleRoleHints: {
      惩戒: '光耀惩戒与控场；审判/圣光出鞘起手契合输出。',
      守护: '护盾、探知与团队庇护；盾牌格挡起手契合坦克。',
      圣洁: '治疗、净化与光耀回复；圣光术/驱邪术起手契合支援。',
      热诚: '速攻、复仇与冲锋；偏魅力豁免与近战突击。',
    },
    chargenAttrDetail: '意志≥15 为常见目标；魅力豁免与热诚/惩戒神术协同。宗教熟练支撑誓言与侦测类能力。',
    combatRules: (className, slug) => [
      {
        id: 'tip-' + slug + '-cr-radiant',
        title: '光耀与邪恶特攻',
        summary: '圣骑士技能常带光耀标签；对邪恶/亡灵等目标可能有额外收益（见具体技能与 DM 规则）。',
        detail: '惩戒/圣洁线深化光耀；引用须来自 L2 上下文，勿编造对位加值。',
        relatedSkills: ['审判', '圣光出鞘'],
        tags: [className, '光耀', '惩戒', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-shield',
        title: '盾牌与格挡',
        summary: '盾牌格挡为起手选项之一；守护线可深化护盾类神术与反应减伤。',
        detail: '全部护甲+盾牌熟练；持盾时规划空闲手施法/战技。',
        relatedSkills: ['盾牌格挡', '虔诚护盾'],
        tags: [className, '盾牌', '守护', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-oath',
        title: '神圣誓言',
        summary: '专精「神圣誓言」与角色正义定位绑定；build 须与所选誓言/风格一致。',
        detail: '具体誓言效果见创建页/规则书；顾问仅引用上下文中出现的名称。',
        relatedSkills: [],
        tags: [className, '专精', '神圣誓言', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-heal',
        title: '圣光治疗',
        summary: '圣光术等起手提供回复；圣洁线深化治疗与净化，须规划 FP。',
        detail: '5 选 2 起手：治疗与输出可各取一项；勿假设四项全拿。',
        relatedSkills: ['圣光术', '驱邪术'],
        tags: [className, '圣洁', '治疗', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-martial',
        title: '战法双修',
        summary: '圣骑士兼近战与神术；重甲前线与远程神术须分回合规划。',
        detail: '热诚线偏突击；惩戒线偏光耀战技。勿套用法师塑能/咒法流派名。',
        relatedSkills: ['审判', '制裁之锤'],
        tags: [className, '战法', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-fp',
        title: 'FP 与圣光节奏',
        summary: '战技与神术均消耗 FP；长战先低 FP 稳态再交爆发或救场治疗。',
        detail: '短休/长休回复见基础规则；标识由 DM 结算。',
        relatedSkills: ['审判'],
        tags: [className, 'FP', 'combat_rule'],
      },
    ],
    extraEquipmentRules: (refClass) => {
      const rules = [];
      if (/除枪械|不含枪械/.test(refClass?.weapons || '')) {
        rules.push('圣骑士不熟练枪械；勿推荐火枪/步枪等火器 build。');
      }
      return rules;
    },
  },
  游荡者: {
    defaultFullL2MinSkills: 60,
    fpKeyLabel: '敏捷',
    specBuildHints: {
      连击: '奇袭/狂妄输出向常见；连击点数与攻击节奏联动，见具体技能描述。',
      盗贼黑话: '情报/社交向；欺瞒、探索熟练协同，偏幕间与组织互动。',
      灵巧动作: '生存与规避；偏魅影/妙手，配合体操/隐匿。',
    },
    styleRoleHints: {
      奇袭: '背刺、穿甲与暗影突袭；背刺起手契合单体爆发。',
      妙手: '陷阱、盗窃与戏法辅助；侦测/巧手熟练协同。',
      魅影: '暗影法术与潜行深化；潜行起手契合。',
      狂妄: '火枪/手弩远程与对决；偏每个自身回合限一次类能力。',
      魔药: '毒性与配方（须标注「配方」）；毒刃等近战毒伤。',
    },
    chargenAttrDetail: '敏捷≥15 为常见目标；感知配合察觉/洞悉与妙手探知。隐匿/体操与潜行/背刺协同。',
    combatRules: (className, slug) => [
      {
        id: 'tip-' + slug + '-cr-backstab',
        title: '背刺与站位',
        summary: '背刺等技能要求目标未察觉或背对；须先潜行/佯攻创造机会。',
        detail: '奇袭线核心；勿假设每回合都能背刺。引用须来自 L2 上下文。',
        relatedSkills: ['背刺', '潜行'],
        tags: [className, '奇袭', '背刺', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-stealth',
        title: '潜行与隐匿',
        summary: '潜行使自身进入隐匿；脱离视野或环境掩护后再发起奇袭。',
        detail: '闷棍为非战斗控场；战斗内以潜行+背刺/影袭为主，勿混淆规则。',
        relatedSkills: ['潜行', '闷棍'],
        tags: [className, '潜行', '隐匿', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-firearm',
        title: '火器与手弩',
        summary: '游荡者熟练火枪/手弩；消耗弹药，相邻或超距可能有命中劣势（见基础规则）。',
        detail: '狂妄线深化远程；切换近战武器时注意借机与触及。',
        relatedSkills: ['迅捷连射'],
        tags: [className, '火器', '远程', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-potion',
        title: '魔药与配方',
        summary: '魔药线含「（配方）」技能；须标注为配方，勿当作即时战技。',
        detail: '毒性技能常带体质豁免；具体数值以规则书/创建页为准。',
        relatedSkills: ['毒刃', '致伤毒药（配方）'],
        tags: [className, '魔药', '配方', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-kite',
        title: '疾跑与借机',
        summary: '疾跑为全速移动；离开敌人触及时注意借机，带迅捷位移不触发借机。',
        detail: '魅影/奇袭位移与 arrogant 远程 kite 可配合；规划脱离路线。',
        relatedSkills: ['疾跑'],
        tags: [className, '位移', '借机攻击', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-fp',
        title: 'FP 与奇袭节奏',
        summary: '战技/戏法消耗 FP；爆发轮与潜行准备轮分开规划，避免空 FP。',
        detail: '一阶技能 FP 通常较低；长战注意短休回复。',
        relatedSkills: ['背刺'],
        tags: [className, 'FP', 'combat_rule'],
      },
    ],
    extraEquipmentRules: (refClass) => {
      const rules = [];
      const w = refClass?.weapons || '';
      if (/火枪/.test(w)) rules.push('火枪消耗弹药；装填/射速见基础规则与职业页。');
      if (/手弩/.test(w)) rules.push('手弩消耗箭矢/弹药；远程规则见基础规则战斗章。');
      return rules;
    },
  },
  德鲁伊: {
    defaultFullL2MinSkills: 60,
    fpKeyLabel: '感知',
    specBuildHints: {
      自然祝福: '为自然武器附魔；荒野/兽灵近战或变形 build 协同。',
      回归荒野: '野外休整加成；长线探索与生存向 build。',
      自然之友: '自然/栽培熟练；复苏/荒野法术与植物类能力协同。',
    },
    styleRoleHints: {
      荒野: '自然防御与控场；树皮术等偏坦克与区域封锁。',
      兽灵: '动物沟通与野兽形态联动；驯兽/自然熟练协同。',
      复苏: '治疗与净化；回春术起手契合支援线。',
      月影: '月亮奥术输出；月火术起手契合。',
      日怒: '太阳火焰与 AOE；阳炎术起手契合。',
      星辰: '星界/命运机制；高阶投资向，勿编造未收录天赋名。',
      精火: '精类火焰与戏法；偏激活与幻象辅助。',
    },
    chargenAttrDetail: '感知≥15 为常见目标；体质配合 HP 与荒野前线。自然/驯兽熟练与兽灵/复苏协同。',
    combatRules: (className, slug) => [
      {
        id: 'tip-' + slug + '-cr-beast',
        title: '野兽形态',
        summary: '野兽形态消耗疲劳值（见技能/规则）；附赠动作进入，规划 FP 与形态切换节奏。',
        detail: '起手可选野兽形态；兽灵/荒野 build 深化变形，具体形态列表以规则书为准。',
        relatedSkills: ['野兽形态'],
        tags: [className, '变形', '兽灵', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-armor',
        title: '非金属护甲',
        summary: '德鲁伊护甲熟练含「非金属」限制；着金属甲/盾可能违反职业规则（见创建页）。',
        detail: '轻中甲+非金属盾；勿推荐全身板甲等金属重甲 build。',
        relatedSkills: [],
        tags: [className, '护甲', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-cast',
        title: '自然法术',
        summary: '多数法术需施法动作+念诵法咒；法杖为常见媒介，勿套用法师魔棒/法术位规则。',
        detail: '引用须来自 L2 德鲁伊上下文；月影/日怒/荒野等各属战斗风格，非法师八学派。',
        relatedSkills: ['缠绕术', '月火术'],
        tags: [className, '法术', '自然', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-heal',
        title: '回春与复苏',
        summary: '回春术等有延迟回复；复苏线深化治疗，长战须提前规划。',
        detail: '5 选 2 起手：输出（月火/阳炎）与回复（回春）可各取一项。',
        relatedSkills: ['回春术'],
        tags: [className, '复苏', '治疗', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-control',
        title: '控场与自然',
        summary: '缠绕术等控场起手；荒野线深化藤蔓/自然区域效果。',
        detail: '与法师惑控不同，名称以德鲁伊 L2 列表为准。',
        relatedSkills: ['缠绕术'],
        tags: [className, '荒野', '控场', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-fp',
        title: 'FP 与自然节奏',
        summary: '法术/戏法消耗 FP；变形与法术分回合规划，避免空 FP。',
        detail: '短休/长休回复见基础规则；标识由 DM 结算。',
        relatedSkills: ['月火术', '阳炎术'],
        tags: [className, 'FP', 'combat_rule'],
      },
    ],
    extraEquipmentRules: (refClass) => {
      const rules = [];
      if (/非金属/.test(refClass?.armor || '')) {
        rules.push('德鲁伊须着非金属护甲与盾牌；具体禁制见创建页与基础规则。');
      }
      if (/法杖/.test(refClass?.weapons || '')) {
        rules.push('法杖为常见法术媒介；部分自然法术需持法器/法杖（见技能描述）。');
      }
      return rules;
    },
  },
  萨满祭司: {
    defaultFullL2MinSkills: 80,
    fpKeyLabel: '感知',
    specBuildHints: {
      萨满教义: '仪式沟通先祖；巫术/风暴情报向 build 协同。',
      元素亲和: '多元素搭配；风暴/火焰/水源/大地按主元素投资，勿四系全满。',
      过载: '延缓力竭惩罚；长线战斗与高频施法 build。',
    },
    styleRoleHints: {
      风暴: '雷电与复仇；闪电箭起手契合输出。',
      火焰: '火焰 AOE 与图腾；烈焰冲击起手契合。',
      水源: '治疗与图腾支援；治疗波起手契合。',
      大地: '岩石控场与护盾；大地之盾起手契合。',
      巫术: '诅咒、探知与先祖智慧；偏控场与资讯。',
    },
    chargenAttrDetail: '感知≥15 为常见目标；魅力豁免配合部分神术/社交。宗教/自然熟练与元素/仪式 build 协同。',
    combatRules: (className, slug) => [
      {
        id: 'tip-' + slug + '-cr-elements',
        title: '四元素与风格',
        summary: '风暴/火焰/水源/大地/巫术对应元素与职能；build 宜主修 1～2 系再扩展。',
        detail: '元素亲和专精与多系搭配相关；引用须来自 L2 萨满上下文，勿套用法师八学派。',
        relatedSkills: ['闪电箭', '治疗波'],
        tags: [className, '元素', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-totem',
        title: '图腾与激活',
        summary: '多技能含「图腾」关键词；部署/激活规则以技能描述与 DM 为准。',
        detail: '水源/大地/风暴线常见；勿编造未收录的图腾名。',
        relatedSkills: ['恢复图腾', '灼热图腾'],
        tags: [className, '图腾', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-start',
        title: '起手四选一系',
        summary: '4 选 2 起手：闪电箭/烈焰冲击/治疗波/大地之盾分属不同元素职能。',
        detail: '输出（闪电/烈焰）、治疗（治疗波）、防护（大地之盾）按团队缺口选择，勿假设全拿。',
        relatedSkills: ['闪电箭', '烈焰冲击', '治疗波', '大地之盾'],
        tags: [className, '起手特性', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-hex',
        title: '巫术与诅咒',
        summary: '巫术线含诅咒、探知类法术；与法师惑控/预言名称不同，以 L2 列表为准。',
        detail: '先祖沟通与萨满教义专精相关；深度效果以规则书为准。',
        relatedSkills: ['虚弱诅咒', '视界术'],
        tags: [className, '巫术', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-cast',
        title: '元素法术媒介',
        summary: '萨满法术常需法杖/手势；非法师法术位体系，具体以技能描述为准。',
        detail: '勿引用塑能箭、魔法飞弹等法师专属技能名。',
        relatedSkills: ['闪电箭'],
        tags: [className, '施法', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-fp',
        title: 'FP 与元素节奏',
        summary: '法术消耗 FP；多系兼修时分回合交替元素输出与支援，避免空 FP。',
        detail: '短休/长休回复见基础规则；标识由 DM 结算。',
        relatedSkills: ['治疗波'],
        tags: [className, 'FP', 'combat_rule'],
      },
    ],
    extraEquipmentRules: (refClass) => {
      const rules = [];
      if (/法杖/.test(refClass?.weapons || '')) {
        rules.push('法杖为常见法术媒介；部分元素法术需持法器（见技能描述）。');
      }
      rules.push('图腾类能力部署与维持规则以各技能描述及 DM 裁定为准。');
      return rules;
    },
  },
  术士: {
    defaultFullL2MinSkills: 40,
    l5MinTips: 15,
    fpKeyLabel: '幸运',
    specBuildHints: {
      魔力血脉: '血脉附加伤害；与混乱箭、魔爆术等输出向技能协同。',
      狂野魔法: '施法可能触发随机效应；混沌法术、天赐神通 build 风险与收益并存。',
      偶发灵光: '部分法术可能施展失败；宜备稳定输出技能，勿全押高随机节点。',
    },
    styleRoleHints: {
      潜能: '施法攻击、随机性与虚化飞行道具；混乱箭/魔爆术代表低阶输出。',
    },
    chargenAttrDetail: '幸运≥15 为常见目标；魅力豁免配合欺瞒/恐吓 build。奥秘/宗教熟练与法术体系协同。',
    combatRules: (className, slug) => [
      {
        id: 'tip-' + slug + '-cr-potential',
        title: '潜能单系 build',
        summary: '术士仅「潜能」战斗风格；全技能树集中投资，勿套用法师八学派分系。',
        detail: '引用须来自 L2 术士上下文；塑能/咒法等法师流派名不适用。',
        relatedSkills: ['混乱箭', '魔爆术'],
        tags: [className, '潜能', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-start',
        title: '三项起始特性全得',
        summary: '创建时自动获得：魔法飞弹（稳定输出）、混沌法术（随机效应）、天赐神通（扩展法术池）。',
        detail: '无需选择；勿称「三选二」。天赐神通公共池随术士等级变更（见技能描述）。',
        relatedSkills: ['魔法飞弹', '混沌法术', '天赐神通'],
        tags: [className, '起手特性', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-chaos',
        title: '混沌法术随机性',
        summary: '混沌法术掷 D100 决定效应；高阶可多次掷骰取优，勿编造未收录区间。',
        detail: '5 级起可用附赠动作施展（见升级描述）；与狂野魔法专精主题相关。',
        relatedSkills: ['混沌法术'],
        tags: [className, '混沌', '随机', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-gift',
        title: '天赐神通与公共池',
        summary: '天赐神通从公共法术池随机获得法术/戏法；池内容随术士等级提升。',
        detail: '深度 build 须查规则书公共池列表；勿编造上下文中未出现的法术名。',
        relatedSkills: ['天赐神通'],
        tags: [className, '天赐神通', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-luck',
        title: '幸运关键属性',
        summary: '幸运为术士关键属性；购点通常≥15，与 FP 公式及机遇熟练协同。',
        detail: '勿与法师智力/牧师感知混淆；达标检测以 L3 上下文为准。',
        relatedSkills: [],
        tags: [className, '幸运', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-cast',
        title: '天生施法',
        summary: '术士为天生施法者；多数法术需手势+法咒，非法师法术位体系。',
        detail: '魔法飞弹为术士起手之一，与法师同名技能语境不同；勿引用塑能箭等法师专属起手。',
        relatedSkills: ['魔法飞弹'],
        tags: [className, '施法', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-fp',
        title: 'FP 与潜能节奏',
        summary: '法术/戏法消耗 FP；混沌与高阶秘仪分回合规划，避免空 FP。',
        detail: '短休/长休回复见基础规则；标识由 DM 结算。',
        relatedSkills: ['魔爆术', '混乱箭'],
        tags: [className, 'FP', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-spec',
        title: '三项专精取向',
        summary: '魔力血脉偏伤害、狂野魔法偏随机、偶发灵光偏风险；与起手组合一致再扩展。',
        detail: '创建页三项专精均获得（非三选一）；具体数值以规则书为准。',
        relatedSkills: ['混沌法术'],
        tags: [className, '专精', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-cantrip',
        title: '戏法与辅助',
        summary: '光亮术、舞光术、浮碟术等戏法消耗较低；长战与探索可备实用戏法。',
        detail: '戏法名称以 L2 列表为准；勿引用法师专属戏法名（若上下文中未出现）。',
        relatedSkills: ['光亮术', '舞光术'],
        tags: [className, '戏法', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-talent',
        title: '天赋与进阶节点',
        summary: '潜能树含 talent 类型节点（如超限、节能施法）；前置与 SP 以技能描述为准。',
        detail: '标识消耗由 DM 结算；勿假设玩家已有标识。',
        relatedSkills: ['超限', '节能施法'],
        tags: [className, '天赋', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-arcane',
        title: '秘仪之力高阶',
        summary: '四阶起秘仪之力·战车/火焰/智者/午夜等为高阶代表；长线 build 分阶段投资。',
        detail: '具体效果与前置须来自 L2 上下文；勿编造未收录的秘仪名。',
        relatedSkills: ['秘仪之力·火焰'],
        tags: [className, '秘仪', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-psionic',
        title: '魔能与异能',
        summary: '魔能翻涌、魔能脉冲等含 psionic 标签；与混沌随机线可协同但勿全押随机。',
        detail: '异能类技能规则以描述为准；与法师塑能线名称不同。',
        relatedSkills: ['魔能翻涌', '魔能脉冲'],
        tags: [className, '异能', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-prof',
        title: '熟练与社交',
        summary: '奥秘/宗教/欺瞒/机遇等熟练与术士 build 协同；机遇与幸运属性主题一致。',
        detail: '创建 4 选 4 熟练；重复熟练合法但须说明 trade-off。',
        relatedSkills: [],
        tags: [className, '熟练', 'combat_rule'],
      },
    ],
    extraEquipmentRules: (refClass) => {
      const rules = [];
      if (/轻甲/.test(refClass?.armor || '')) {
        rules.push('术士着轻甲；AC 与敏捷加成见基础规则与创建页。');
      }
      if (/手弩|匕首/.test(refClass?.weapons || '')) {
        rules.push('匕首/手弩为常见副武器；术士不熟练重甲与枪械（见创建页）。');
      }
      return rules;
    },
  },
  武僧: {
    defaultFullL2MinSkills: 80,
    fpKeyLabel: '敏捷',
    specBuildHints: {
      真气诀: '真气池与战技/功法消耗核心；长线 build 须规划真气回复。',
      散打: '徒手攻击额外伤害；极斗/踏风/酒仙等徒手线协同。',
      习武之人: '不着甲 AC 加成；偏无甲/轻甲 build，勿与重甲混用。',
    },
    styleRoleHints: {
      极斗: '徒手爆发与连环战技；猛虎掌/连环拳代表输出。',
      踏风: '速攻位移与点穴；身轻如燕/无影步代表机动。',
      织雾: '真气回复与净化；散魔功/抚慰之雾代表支援。',
      无尘: '控场与护盾；嚎镇八方/金钟罩代表防御控场。',
      锋岚: '长兵与回马枪；当头棒喝代表近战技巧。',
      酒仙: '醉拳与借醉反击；偏反击与技艺 build。',
      凰火: '式（猛虎/云鹤/灵龙/玄武/朱鹤）与火焰机制；高阶长线投资。',
    },
    chargenAttrDetail: '敏捷≥15 为常见目标；力量配合徒手伤害，体操/运动与位移 build 协同。',
    combatRules: (className, slug) => [
      {
        id: 'tip-' + slug + '-cr-styles',
        title: '七风格与首风格',
        summary: '极斗/踏风/织雾/无尘/锋岚/酒仙/凰火七线；创建后选定首个战斗风格，部分高阶技能有替换/合并前置。',
        detail: '引用须来自 L2 武僧上下文；勿套用法师八学派或塑能箭。',
        relatedSkills: ['连环拳', '身轻如燕'],
        tags: [className, '战斗风格', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-start',
        title: '起手四选二',
        summary: '4 选 2 战技：猛虎掌（输出）、扫堂腿（控场）、滚地翻（位移）、活血术（净化）。',
        detail: '按团队缺口选两项；勿假设四项全拿。起手战技为 martial/gongfa 类型，非法术位。',
        relatedSkills: ['猛虎掌', '扫堂腿', '滚地翻', '活血术'],
        tags: [className, '起手特性', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-qi',
        title: '真气机制',
        summary: '多数战技/功法消耗真气；真气诀专精与回复类功法（织雾线）相关。',
        detail: '具体消耗与回复以技能描述为准；标识「式」类天赋由 DM 结算，勿假设已有标识。',
        relatedSkills: ['猛虎掌', '散魔功'],
        tags: [className, '真气', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-types',
        title: '战技/功法/天赋',
        summary: 'martial 战技、gongfa 功法、talent 天赋分类型；前置常写「拥有战技.XXX」或风格锁定。',
        detail: '凰火「式」与高阶合并技须查 prerequisite；勿编造未收录技能名。',
        relatedSkills: ['幻形踢', '猛虎式'],
        tags: [className, '战技', '功法', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-unarmed',
        title: '徒手与散打',
        summary: '散打专精强化徒手；猛虎掌/连环拳等须满足「未持物单手」等施展条件（见描述）。',
        detail: '拳刃为常见武器扩展；徒手 build 与锋岚长兵 build 勿混谈同一套节点。',
        relatedSkills: ['猛虎掌', '连环拳'],
        tags: [className, '徒手', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-unarmored',
        title: '无甲与习武之人',
        summary: '习武之人专精提供不着甲 AC；着中甲仍合法但可能与无甲 build 专精方向不一致。',
        detail: '轻甲/中甲熟练见创建页；AC 计算见基础规则与装备规则上下文。',
        relatedSkills: [],
        tags: [className, '护甲', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-fp',
        title: 'FP 与真气节奏',
        summary: '战技亦可能消耗 FP；长战分回合交替输出、位移与真气回复，避免真气/FP 双空。',
        detail: '短休/长休回复见基础规则；滚地翻等反应类注意每战次数限制。',
        relatedSkills: ['滚地翻'],
        tags: [className, 'FP', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-spec',
        title: '三项专精取向',
        summary: '真气诀偏资源、散打偏徒手伤害、习武之人偏无甲生存；与首风格规划一致再扩展。',
        detail: '创建页三项专精均获得（非三选一）；具体数值以规则书为准。',
        relatedSkills: ['活血术'],
        tags: [className, '专精', 'combat_rule'],
      },
    ],
    extraEquipmentRules: (refClass) => {
      const rules = [];
      if (/轻甲|中甲/.test(refClass?.armor || '')) {
        rules.push('武僧熟练轻甲与中甲；习武之人专精与不着甲 build 相关，着甲取舍见创建页。');
      }
      if (/拳刃/.test(refClass?.weapons || '')) {
        rules.push('拳刃为武僧特色武器；徒手战技与持械 build 分线规划。');
      }
      rules.push('徒手战技常要求「未持有物件的单手」等条件，见各技能施展条件。');
      return rules;
    },
  },
  吟游诗人: {
    defaultFullL2MinSkills: 80,
    fpKeyLabel: '魅力',
    specBuildHints: {
      坊间逸闻: '人文/情报向；探索/欺瞒熟练协同，偏幕间与社交 build。',
      语出惊人: '检定附加魅力；说服/表演/激励熟练协同。',
      律动节拍: '节拍骰机制核心；激昂/灵动节奏类技能协同。',
    },
    styleRoleHints: {
      激昂: '团队增益与节奏爆发；激励乐章/雷鸣和弦代表战端开场。',
      舒缓: '治疗、净化与长休回复；次级治疗术/净化间奏代表支援。',
      灵动: '音波输出与位移节奏；音波刃/轻快小调代表施法攻击。',
      诙谐: '控场戏法与光耀辅助；舞光术/油腻术代表 utility。',
      集中: '防护与专注演奏；警报术/剑刃防护代表生存与媒介。',
    },
    chargenAttrDetail: '魅力≥15 为常见目标；敏捷豁免配合灵动/火器 build。表演/激励/说服与语出惊人专精协同。',
    combatRules: (className, slug) => [
      {
        id: 'tip-' + slug + '-cr-styles',
        title: '五风格职能',
        summary: '激昂偏增益、舒缓偏治疗、灵动偏输出、诙谐偏控场戏法、集中偏防护；宜主修 1～2 系再扩展。',
        detail: '引用须来自 L2 吟游诗人上下文；勿套用法师八学派名。',
        relatedSkills: ['激励乐章', '次级治疗术'],
        tags: [className, '战斗风格', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-start',
        title: '起手五选二',
        summary: '5 选 2：激励乐章（增益）、休憩曲（休整）、交友术/瘙痒术（社交控场）、动能旋律（输出）。',
        detail: '按团队缺口选两项；勿假设五项全拿。激励乐章与激昂线协同。',
        relatedSkills: ['激励乐章', '休憩曲', '动能旋律'],
        tags: [className, '起手特性', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-rhythm',
        title: '节奏与节拍',
        summary: '多技能含「节奏」关键词；律动节拍专精提供节拍骰，激昂/灵动线常见。',
        detail: '每个自身回合限一次类能力须标注；具体数值以技能描述为准。',
        relatedSkills: ['热血节拍', '韵律增幅'],
        tags: [className, '节奏', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-cast',
        title: '法术与戏法',
        summary: '吟游诗人含 spell/cantrip/talent；施展常需乐器/言语，非法师法术位体系。',
        detail: '诙谐/集中线戏法较多；勿引用塑能箭等法师专属起手。',
        relatedSkills: ['舞光术', '音波刃'],
        tags: [className, '法术', '戏法', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-buff',
        title: '团队增益',
        summary: '激昂/舒缓线提供士气、治疗与净化；长战先稳态增益再交输出。',
        detail: '激励乐章为常见起手；休憩曲偏休整环节，勿与战斗轮混淆。',
        relatedSkills: ['激励乐章', '振奋光环'],
        tags: [className, '增益', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-firearm',
        title: '火器与手弩',
        summary: '吟游诗人熟练火枪/手弩；消耗弹药，相邻或超距可能有命中劣势（见基础规则）。',
        detail: '灵动/激昂 build 可兼远程；切换乐器/武器时注意借机与触及。',
        relatedSkills: ['快速拨弦'],
        tags: [className, '火器', '远程', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-fp',
        title: 'FP 与演奏节奏',
        summary: '法术/战歌消耗 FP；激昂爆发轮与舒缓回复轮分开规划，避免空 FP。',
        detail: '短休/长休回复见基础规则；标识由 DM 结算。',
        relatedSkills: ['雷鸣和弦'],
        tags: [className, 'FP', 'combat_rule'],
      },
      {
        id: 'tip-' + slug + '-cr-spec',
        title: '三项专精取向',
        summary: '坊间逸闻偏情报、语出惊人偏检定、律动节拍偏节奏 combat；与主风格一致再扩展。',
        detail: '创建页三项专精均获得（非三选一）；具体数值以规则书为准。',
        relatedSkills: ['激励乐章'],
        tags: [className, '专精', 'combat_rule'],
      },
    ],
    extraEquipmentRules: (refClass) => {
      const rules = [];
      if (/轻甲/.test(refClass?.armor || '')) {
        rules.push('吟游诗人着轻甲；AC 与敏捷加成见基础规则与创建页。');
      }
      if (/火枪|手弩/.test(refClass?.weapons || '')) {
        rules.push('火枪/手弩消耗弹药；装填与射速见基础规则战斗章。');
      }
      if (/刺剑/.test(refClass?.weapons || '')) {
        rules.push('刺剑为常见近战副武器；灵巧攻击 build 须满足武器熟练。');
      }
      rules.push('多数法术/战歌需乐器或言语；具体施展条件见各技能描述。');
      return rules;
    },
  },
};

function classProfile(className) {
  return CLASS_FULL_PROFILES[className] || {
    defaultFullL2MinSkills: 80,
    fpKeyLabel: '关键属性',
    specBuildHints: {},
    styleRoleHints: {},
    chargenAttrDetail: '关键属性购点通常≥15；与战斗风格/武器规划一致。',
    combatRules: (cn, slug) => [{
      id: 'tip-' + slug + '-cr-fp',
      title: 'FP 与技能节奏',
      summary: '技能消耗 FP；规划回合节奏，避免空 FP。',
      detail: '低阶技能优先；长战注意短休/长休回复（见基础规则）。',
      relatedSkills: [],
      tags: [cn, 'FP', 'combat_rule'],
    }],
    extraEquipmentRules: () => [],
  };
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function slugFor(className, profile) {
  if (className === '法师') return 'mage';
  return profile.l2Slug;
}

function inferStyleSummary(styleName, skills) {
  const inStyle = skills.filter((s) => s.style === styleName && s.type !== 'starting');
  if (!inStyle.length) return `${styleName}战斗风格（详见职业页技能树）。`;
  const tags = new Set();
  for (const s of inStyle.slice(0, 8)) {
    for (const t of s.tags || []) tags.add(t);
  }
  const tagStr = [...tags].slice(0, 4).join('、');
  return tagStr ? `${styleName}：偏${tagStr}等能力。` : `${styleName}：该风格技能以职业页为准。`;
}

function resolveStartingSkillEntries(skills, startingFeatures) {
  const fromType = skills.filter((s) => s.type === 'starting');
  if (fromType.length) return fromType;
  return (startingFeatures || []).map((def) => {
    const name = def.name;
    const hit = skills.find((s) => s.name === name);
    if (hit) return { ...hit, type: 'starting' };
    return {
      name,
      type: 'starting',
      style: null,
      summary: def.desc || '',
    };
  });
}

function resolveStartingChoice(profile, refClass, startingCount) {
  if (profile.startingFeaturePick === 'all') return 'all';
  if (typeof profile.startingFeaturePick === 'number') return profile.startingFeaturePick;
  if (refClass?.starting_choice != null) return refClass.starting_choice;
  return 2;
}

function formatStartingFeatureTipDetail(className, profile, startingEntries, feat) {
  const pick = profile.startingFeaturePick;
  const featStyle = feat.style || '起手';
  if (pick === 'all') {
    return className + ' 起始特性三项全得（魔法飞弹/混沌法术/天赐神通），其中「' + feat.name + '」为其中之一。'
      + (feat.summary || '') + ' 与后续 ' + featStyle + ' 风格技能可协同，但非强制绑定。';
  }
  const pickNum = typeof pick === 'number' ? pick : 2;
  const pool = startingEntries.length || 4;
  return className + ' ' + pool + ' 选 ' + pickNum + ' 起手特性之一。' + (feat.summary || '')
    + ' 与后续 ' + featStyle + ' 风格技能可形成初期连招，但非强制绑定。';
}

function lowTierSkills(skills, style, limit = 4) {
  return skills
    .filter((s) => s.style === style && s.type !== 'starting')
    .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))
    .slice(0, limit);
}

function formatHpFormula(ref, className) {
  const hp = ref?.hp_formula || ref?.hpFormula;
  if (!hp) return null;
  if (typeof hp.first === 'string') return { first: hp.first, levelUp: hp.levelUp || hp.level_up };
  return {
    first: `${hp.first}+体质调整值`,
    levelUp: `每${className}等级+${hp.level_up}+体质调整值`,
  };
}

function formatFpFormula(ref, className, fpKeyLabel) {
  const fp = ref?.fp_formula || ref?.fpFormula;
  if (!fp) return null;
  if (typeof fp.first === 'string') return { first: fp.first, levelUp: fp.levelUp || fp.level_up };
  const key = fpKeyLabel || '关键属性';
  return {
    first: `${fp.first}+${key}调整值`,
    levelUp: `每${className}等级+${fp.level_up}`,
  };
}

function buildFullClassDoc(className, profile, refClass, weaponProfs, index, existing) {
  const slug = slugFor(className, profile);
  const cp = classProfile(className);
  const specHints = cp.specBuildHints || {};
  const styleHints = cp.styleRoleHints || {};
  const skills = index.skills || [];
  const styleNames = Object.keys(index.meta?.facets?.byStyle || {});
  const mcReq = readJson(MULTICLASS).requirements?.find((r) => r.class === className);

  const specNames = profile.specProfChoices?.length
    ? profile.specProfChoices
    : (refClass?.specializations || []).map((s) => s.name);

  const specializations = specNames.map((name) => {
    const ref = (refClass?.specializations || []).find((s) => s.name === name);
    return {
      name,
      effect: ref?.desc || ref?.effect || `创建页专精「${name}」`,
      buildHint: specHints[name] || `创建页专精「${name}」；与主属性/武器规划一致即可。`,
    };
  });

  const combatStyles = styleNames.map((name) => {
    const samples = lowTierSkills(skills, name, 3).map((s) => s.name);
    return {
      name,
      summary: inferStyleSummary(name, skills),
      buildHint: styleHints[name] || inferStyleSummary(name, skills),
      sampleSkills: samples,
    };
  });

  const startingFeatures = (existing?.startingFeatures?.length
    ? existing.startingFeatures
    : (refClass?.starting_features || []).map((s) => ({ name: s.name, desc: s.desc })));

  return {
    meta: {
      layer: 'L1',
      phase: '5-full',
      source: `职业页/数据/${className}.json + REF_CLASSES + ${slug}_index.json`,
      generatedAt: new Date().toISOString().slice(0, 10),
      advisorTier: 'full',
    },
    id: className,
    name: className,
    description: existing?.description || '',
    rolePositioning: existing?.rolePositioning || '',
    roleSummary: existing?.roleSummary || {
      positioning: (existing?.rolePositioning || '').split('、').filter(Boolean),
      blurb: (existing?.description || '').slice(0, 220),
    },
    keyAttr: existing?.keyAttr || refClass?.key_attr || profile.keyAttr,
    armor: existing?.armor || refClass?.armor || '',
    weapons: existing?.weapons || refClass?.weapons || '',
    weaponProfCategories: weaponProfs[className] || [],
    weaponCategoryNote: '创建页武器为具体类型；面板武器熟练类别见 weaponProfCategories（剑类/斧类等为分组）。',
    saves: existing?.saves || refClass?.saves || [],
    skills: existing?.skills || refClass?.skills || '',
    startingFeatures,
    startingChoice: resolveStartingChoice(profile, refClass, startingFeatures.length),
    hpFormula: formatHpFormula(refClass, className),
    fpFormula: formatFpFormula(refClass, className, cp.fpKeyLabel),
    multiclassRequirements: mcReq || null,
    specializations,
    combatStyles,
  };
}

function buildFullEquipmentRules(className, refClass, weaponProfs) {
  const cp = classProfile(className);
  const armor = refClass?.armor || '全部护甲';
  const weapons = refClass?.weapons || '全部武器';
  const categories = weaponProfs[className] || [];
  const keyRules = [
    '未着装护甲时 AC = 10 + 敏捷调整值。',
    '布衣/皮甲：AC 11 + 敏捷调整值（敏捷加成至多为 2）；布衣有隐匿劣势。',
    '鳞甲/锁甲/链甲等中重甲：敏捷加成受限；具体 AC 与力量需求见基础规则战斗章与创建页。',
  ];
  if (/全部护甲|重甲/.test(armor)) {
    keyRules.push('重甲：力量不足时移动可能受限；着甲休眠规则见基础规则。');
  }
  if (/盾牌/.test(armor)) {
    keyRules.push('盾牌：需持盾且具备盾牌熟练；相关反应类能力须满足持盾条件。');
  }
  keyRules.push(
    '借机攻击：离开敌人触及或单次移动超过三格时，敌人可借机；带「迅捷」位移不触发借机。',
    '创建页护甲熟练：' + armor,
    '创建页武器熟练：' + weapons,
  );
  if (categories.length) {
    keyRules.push('武器熟练类别（面板）：' + categories.join('、') + '。');
  }
  if (/火器/.test(weapons) || categories.includes('火器')) {
    keyRules.push('火器消耗弹药；相邻或超距射击可能有命中劣势（见基础规则）。');
  }
  for (const r of cp.extraEquipmentRules(refClass)) keyRules.push(r);
  return {
    meta: {
      layer: 'L1',
      phase: '5-full',
      class: className,
      source: 'REF_CLASSES + CLASS_WEAPON_PROFS + 全局护甲摘要',
      generatedAt: new Date().toISOString().slice(0, 10),
      advisorTier: 'full',
    },
    allowedArmor: armor.split(/、/).filter(Boolean),
    allowedWeapons: weapons.split(/、/).filter(Boolean),
    weaponProfCategories: categories,
    keyRules,
  };
}

function makeTipBase(className, slug, id, title, kind, extra = {}) {
  return {
    id,
    scope: 'class',
    applicableClasses: [className],
    title,
    kind,
    confidence: 'auto_generated',
    style: extra.style ?? null,
    summary: extra.summary || '',
    detail: extra.detail || '',
    relatedSkills: extra.relatedSkills || [],
    relatedTipIds: [],
    tags: extra.tags || [className],
    skillRefs: (extra.relatedSkills || []).map((name) => ({ name, source: slug })),
    searchText: '',
    ...extra,
  };
}

function finalizeTip(tip) {
  tip.searchText = [
    tip.title,
    tip.kind,
    tip.confidence,
    tip.summary,
    tip.detail,
    ...(tip.tags || []),
    ...(tip.relatedSkills || []),
  ].filter(Boolean).join(' ');
  return tip;
}

function buildFullTips(className, profile, hints, index, classDoc) {
  const slug = slugFor(className, profile);
  const cp = classProfile(className);
  const styleHints = cp.styleRoleHints || {};
  const specHints = cp.specBuildHints || {};
  const skills = index.skills || [];
  const tips = [];
  const pick = profile.startingFeaturePick ?? 2;
  const startingEntries = resolveStartingSkillEntries(skills, classDoc?.startingFeatures);

  for (const style of hints?.styleHints || []) {
    const samples = (style.sampleSkills || lowTierSkills(skills, style.name, 3).map((s) => s.name)).slice(0, 4);
    tips.push(finalizeTip(makeTipBase(
      className,
      slug,
      'tip-' + slug + '-style-' + style.name,
      className + '·' + style.name + '风格',
      'style_guide',
      {
        style: style.name,
        summary: style.summary,
        detail: [
          styleHints[style.name] || '',
          samples.length ? ('低阶代表：' + samples.join('、') + '。') : '',
          '顾问自动摘要（非官方连招）；数值与前置以规则书/创建页为准。',
        ].filter(Boolean).join(''),
        relatedSkills: samples,
        tags: [className, style.name, '战斗风格', 'style_guide'],
      },
    )));
  }

  for (const style of hints?.styleHints || []) {
    const low = lowTierSkills(skills, style.name, 3);
    const starting = skills.filter((s) => s.style === style.name && s.type === 'starting');
    const names = [...starting, ...low].map((s) => s.name).slice(0, 4);
    if (!names.length) continue;
    tips.push(finalizeTip(makeTipBase(
      className,
      slug,
      'tip-' + slug + '-prio-' + style.name,
      style.name + ' 1～3 阶优先',
      'tactic',
      {
      style: style.name,
      summary: style.name + '线前三级可优先：' + names.join('、') + '；与起手特性/专精规划一致再扩展。',
      detail: className + ' ' + style.name + ' 风格在 L2 索引中一～三阶技能较多；车卡后优先点亮与武器/属性匹配的 low-tier 节点。' + (styleHints[style.name] || ''),
      relatedSkills: names,
      tags: [className, style.name, '优先学', 'tactic'],
    })));
  }

  for (const feat of startingEntries) {
    const featStyle = feat.style || '起手';
    tips.push(finalizeTip(makeTipBase(
      className,
      slug,
      'tip-' + slug + '-start-' + feat.name,
      '起手·' + feat.name,
      'tactic',
      {
        style: feat.style,
        summary: feat.name + '（' + featStyle + '）：' + String(feat.summary || '').slice(0, 80),
        detail: formatStartingFeatureTipDetail(className, profile, startingEntries, feat),
        relatedSkills: [feat.name],
        tags: [className, '起手特性', '车卡', 'tactic'],
      },
    )));
  }

  const combatRules = cp.combatRules(className, slug, profile);
  for (const cr of combatRules) {
    tips.push(finalizeTip(makeTipBase(className, slug, cr.id, cr.title, 'combat_rule', cr)));
  }

  tips.push(finalizeTip(makeTipBase(
    className,
    slug,
    'tip-' + slug + '-chargen-attr',
    className + '关键属性',
    'chargen',
    {
      summary: (profile.keyAttr || hints?.primaryAttr?.name) + '：创建购点通常至少一项≥15，与主武器/战斗风格一致。',
      detail: cp.chargenAttrDetail,
      tags: [className, '车卡', '属性', 'chargen'],
    },
  )));

  tips.push(finalizeTip(makeTipBase(
    className,
    slug,
    'tip-' + slug + '-chargen-spec',
    className + '专精选择',
    'chargen',
    {
      summary: '创建页专精：' + ((profile.specProfChoices || []).join('、') || '见创建页') + '；与武器与风格规划一致即可。',
      detail: Object.entries(specHints).map(([k, v]) => k + '：' + v).join(' '),
      tags: [className, '车卡', '专精', 'chargen'],
    },
  )));

  return {
    meta: {
      layer: 'L5',
      phase: '5-full',
      targetClass: className,
      tier: 'full',
      status: 'auto_generated',
      count: tips.length,
      byKind: tips.reduce((acc, t) => {
        acc[t.kind] = (acc[t.kind] || 0) + 1;
        return acc;
      }, {}),
      note: 'full 档由 build-advisor-class-full.mjs 从 L2 索引与 REF 生成；可人工覆盖',
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    tips,
  };
}

function patchHintsForFull(className, hints) {
  const cp = classProfile(className);
  const specHints = cp.specBuildHints || {};
  const next = { ...hints };
  next.meta = {
    ...next.meta,
    phase: '5-full',
    tier: 'full',
    status: 'auto',
    note: '战斗风格摘要为 auto；种族/背景/build 推荐待人工补充',
  };
  next.specializationHints = (next.specializationHints || []).map((s) => ({
    ...s,
    buildHint: specHints[s.name] || s.buildHint,
  }));
  next.chargenTips = [
    className + ' full 档：可检索 L2 技能名、战斗风格与 L5 小贴士；标识/进阶以规则书与 DM 为准。',
  ];
  delete next.advisorPartialNote;
  return next;
}

function patchRegistry(className, profile, slug, options = {}) {
  const reg = readJson(REGISTRY);
  const row = reg.classes[className];
  if (!row) throw new Error(`Unknown class: ${className}`);
  const cp = classProfile(className);
  row.tier = 'full';
  row.promptProfile = slug + '_skills';
  row.fullL2MinSkills = profile.fullL2MinSkills ?? cp.defaultFullL2MinSkills ?? 80;
  row.l5MinTips = profile.l5MinTips ?? cp.l5MinTips ?? 20;
  delete row.advisorNote;
  if (options.registryMeta) {
    reg.meta = { ...reg.meta, ...options.registryMeta };
  }
  writeJson(REGISTRY, reg);
}

export function buildClassFull(className, options = {}) {
  const root = options.root || ROOT;
  const reg = readJson(path.join(root, 'advisor/chargen/class_registry.json'));
  const profile = reg.classes[className];
  if (!profile?.l2Slug) throw new Error(`No l2Slug for ${className}`);

  const slug = slugFor(className, profile);
  const refClasses = loadPanelConst(path.join(root, '斯诺德跑团/panel_data.js'), 'REF_CLASSES');
  const weaponProfs = loadPanelWeaponProfs(path.join(root, '斯诺德跑团/panel_data.js'));
  const refClass = refClasses[className];
  const indexPath = path.join(root, 'advisor/skills', `${slug}_index.json`);
  const index = readJson(indexPath);
  const existingClass = readJson(path.join(root, 'advisor/chargen', `${slug}_class.json`));
  const hintsPath = path.join(root, 'advisor/chargen/hints', `${className}.json`);
  const hints = readJson(hintsPath);

  const classDoc = buildFullClassDoc(className, profile, refClass, weaponProfs, index, existingClass);
  writeJson(path.join(root, 'advisor/chargen', `${slug}_class.json`), classDoc);

  const equipRules = buildFullEquipmentRules(className, refClass, weaponProfs);
  writeJson(path.join(root, 'advisor/chargen', `${slug}_equipment_rules.json`), equipRules);

  const hintsFull = patchHintsForFull(className, hints);
  writeJson(hintsPath, hintsFull);

  const tipsDoc = buildFullTips(className, profile, hintsFull, index, classDoc);
  writeJson(path.join(root, 'advisor/combos/class_tips', `${className}.json`), tipsDoc);

  patchRegistry(className, profile, slug, options);

  return {
    className,
    slug,
    skillCount: index.meta?.count || index.skills?.length || 0,
    tipsCount: tipsDoc.tips.length,
    styles: classDoc.combatStyles.length,
  };
}

function main() {
  const className = process.argv[2] || '战士';
  const result = buildClassFull(className);
  console.log(`OK ${result.className} → full`);
  console.log(`  skills: ${result.skillCount}, styles: ${result.styles}, tips: ${result.tipsCount}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
