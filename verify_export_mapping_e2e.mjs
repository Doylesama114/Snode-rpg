// 导出映射 + 回读 E2E：验证新模板的 K/Q/U 动态效果、Q6/Q8/R/Q36-Q42、I89/I100、戏法与 H33-H39 不写
import { chromium } from 'playwright';
import { join } from 'path';

const BASE = 'D:\\Download\\scholar-agent-main';
const PANEL = 'file:///' + join(BASE, '斯诺德跑团', '角色面板.html').replace(/\\/g, '/');
const UPLOAD = 'file:///' + join(BASE, '斯诺德跑团', '上传角色.html').replace(/\\/g, '/');

function overridesA() {
  return {
    race: '龙裔', background: '职业杀手', name: '验证龙裔战士',
    dragonType: '赤铜龙', dragonBreath: '冰霜', dragonResistance: '冰霜 + 护甲检定',
    raceChoices: { extraAttrs: [], humanFreeSkill: '', raceSaves: [], raceSkillChoice: '', raceProfInput: '', wingfolkHasCommon: true },
    classChoices: { weaponSpec: '斧类', weaponSpecBonus: '暴击率+1', specChoices: { '运动健将': { attr: '力量', skill: '运动-跳跃' } } },
    backgroundChoices: { deity: '', contacts: '', scamType: '', missionChannel: '公会密线', academicDomain: '' },
    bgOtherPicks: [],
    classes: [{ name: '战士', level: 1, keyAttr: '力量', styles: ['斗争', '狂攻', '', ''] }, { name: '', level: 0, styles: ['', '', '', ''] }, { name: '', level: 0, styles: ['', '', '', ''] }],
    racial_traits: [{ name: '龙族血脉', desc: '根据龙种改变外观和吐息类型' }, { name: '巨龙吐息', desc: '对前方喷吐龙息' }, { name: '传承抗性', desc: '根据龙种获得对应抗性' }],
    class_features: [{ name: '[战士] 武器专精', desc: '获得一项特定武器的专精' }, { name: '[战士] 运动健将', desc: '获得力量或敏捷的熟练项' }, { name: '[战士] 回气', desc: '为自身回复生命值' }],
    languages: ['通用语', '龙语', '地精语'],
    professionals: ['易容'],
    skills: [{ id: 'f1', n: '猛击', src: '战士', sub: '', tm: '1标准动作', range: '近战', dur: '立即', cost: '1', ds: '进行一次强力近战攻击。' }],
    equipment: Object.assign({}, JSON.parse(JSON.stringify(BASE_DEFAULT_EQUIPMENT)), { '材料包': [{ type: '炼金材料包', items: [] }, { type: '草药材料包', items: [] }] })
  };
}
function overridesB() {
  return {
    race: '半精灵', background: '法师学徒', name: '验证半精灵法师',
    dragonType: '', dragonBreath: '', dragonResistance: '',
    raceChoices: { extraAttrs: ['敏捷', '感知'], humanFreeSkill: '', raceSaves: [], raceSkillChoice: '', raceProfInput: '', wingfolkHasCommon: true },
    classChoices: { weaponSpec: '', weaponSpecBonus: '', specChoices: { '奥法学者': { attr: '', skill: '奥秘-魔法学识' }, '知识传承': { attr: '', skill: '知识-历史' } } },
    backgroundChoices: { deity: '', contacts: '', scamType: '', missionChannel: '', academicDomain: '' },
    bgOtherPicks: [],
    classes: [{ name: '法师', level: 1, keyAttr: '智力', styles: ['附魔', '塑能', '', ''] }, { name: '', level: 0, styles: ['', '', '', ''] }, { name: '', level: 0, styles: ['', '', '', ''] }],
    racial_traits: [{ name: '亲和', desc: '团队有人类和精灵会获得激励点' }, { name: '精灵恩惠', desc: '根据精灵血脉获得属性值' }, { name: '精类血统', desc: '魅力豁免优势，睡眠需求降低' }],
    class_features: [{ name: '[法师] 奥法学者', desc: '获得奥秘熟练度和法术槽位' }, { name: '[法师] 知识传承', desc: '获得知识熟练度和幕间学习能力' }, { name: '[法师] 魔法学派', desc: '法师需要选择一个对立学派' }],
    languages: ['通用语', '精灵语'],
    professionals: [],
    skills: [
      { id: 'm1', n: '塑能箭', src: '法师', sub: '', tm: '1标准动作', range: '18米', dur: '立即', cost: '1', ds: '造成元素伤害。' },
      { id: 'c1', n: '魔法伎俩', src: '法师', sub: '', tm: '1标准动作', range: '3米', dur: '立即', cost: '0', ds: '制造一个小型魔法效果。', freeSlot: true, grantedBy: '法师学徒', tier: '一阶' },
      { id: 'c2', n: '光亮术', src: '法师', sub: '', tm: '1标准动作', range: '触碰', dur: '1小时', cost: '0', ds: '使物体发出光亮。', freeSlot: true, grantedBy: '法师学徒', tier: '一阶' }
    ],
    equipment: Object.assign({}, JSON.parse(JSON.stringify(BASE_DEFAULT_EQUIPMENT)), { '材料包': [{ type: '炼金材料包', items: [] }] })
  };
}
const BASE_DEFAULT_EQUIPMENT = { '主手武器': [], '副手武器': [], '防具': [], '配饰': [], '背包': [], '杂物包': [], '旅行腰包': [], '材料包': [] };

function report(name, ok, detail) {
  console.log((ok ? '✅ ' : '❌ ') + name + (detail ? ('：' + detail) : ''));
  if (!ok) process.exitCode = 1;
}

const browser = await chromium.launch({ headless: true });
try {
  const panel = await browser.newPage();
  await panel.goto(PANEL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await panel.waitForFunction(() => typeof window.exportXlsxFromState === 'function' && typeof window.STATE_DEFAULTS !== 'undefined');

  const upload = await browser.newPage();
  await upload.goto(UPLOAD, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await upload.waitForFunction(() => typeof window.parseXLSX === 'function' && typeof window.buildState === 'function');

  async function runCase(label, overrides, checks) {
    const bytes = await panel.evaluate(async (ov) => {
      const st = JSON.parse(JSON.stringify(window.STATE_DEFAULTS));
      for (const k in ov) st[k] = ov[k];
      st._uploadedXlsxBuf = null;
      window.state = st;
      window.SB_toast = function () {};
      window.__capturedBlob = null;
      const oc = URL.createObjectURL;
      URL.createObjectURL = function (blob) { window.__capturedBlob = blob; return 'blob:x'; };
      const ok = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {};
      try { await window.exportXlsxFromState(st); } finally { HTMLAnchorElement.prototype.click = ok; URL.createObjectURL = oc; }
      if (!window.__capturedBlob) throw new Error('no blob');
      return Array.from(new Uint8Array(await window.__capturedBlob.arrayBuffer()));
    }, overrides);

    const rt = await upload.evaluate(async (arr) => {
      const parsed = await window.parseXLSX(new Uint8Array(arr).buffer);
      return { cells: parsed.cells, state: window.buildState(parsed) };
    }, bytes);

    const failures = checks(rt);
    report(label, failures.length === 0, failures.join('；'));
  }

  await runCase('龙裔战士导出/回读', overridesA(), ({ cells, state }) => {
    const f = [];
    if (!/通用语/.test(cells.Q6 || '')) f.push('Q6 语言缺失');
    if (!/易容/.test(cells.Q8 || '')) f.push('Q8 专业缺失');
    if (!(cells.R3 && cells.R4 && cells.R5)) f.push('R3-R5 负重缺失');
    if (!(cells.Q36 && cells.Q38 && cells.Q40)) f.push('Q36-Q40 货币缺失');
    if (!/任务渠道/.test(cells.U27 || '')) f.push('U27 背景选择缺失');
    if ((cells.H33 || cells.H34 || cells.H35 || cells.H36 || cells.H37 || cells.H38 || cells.H39)) f.push('H33-H39 不应有内容');
    if (!/龙种/.test(cells.K112 || '')) f.push('K112 龙种缺失');
    if (!/吐息/.test(cells.K113 || '')) f.push('K113 吐息缺失');
    if (!/抗性/.test(cells.K114 || '')) f.push('K114 抗性缺失');
    if (!/斧类/.test(cells.Q112 || '')) f.push('Q112 武器专精缺失');
    if (!/运动-跳跃/.test(cells.Q113 || '')) f.push('Q113 运动健将缺失');
    if (!(cells.I89 || /材料包/.test(cells.I89 || ''))) f.push('I89 材料包标题缺失');
    if (state.dragonType !== '赤铜龙') f.push('回读龙种错误');
    if ((state.raceChoices.extraAttrs || []).length !== 0) f.push('回读种族选择错误');
    if (!state.classChoices.weaponSpec) f.push('回读武器专精缺失');
    if (state.backgroundChoices.missionChannel !== '公会密线') f.push('回读任务渠道错误');
    if (!/易容/.test((state.professionals || []).join('、'))) f.push('回读专业缺失');
    return f;
  });

  await runCase('士兵背景专职导出/回读', Object.assign(overridesA(), { background: '士兵', name: '验证士兵', backgroundChoices: { deity: '', contacts: '', scamType: '', missionChannel: '', academicDomain: '', crime: '', seclusion: '', militaryRole: '军官', foreignOrigin: '', companion: '' } }), ({ cells, state }) => {
    const f = [];
    const u27 = cells.U27 || '';
    if (!/专职：军官/.test(u27)) f.push('U27 缺少专职');
    if (!/熟练度加成：说服/.test(u27)) f.push('U27 缺少熟练度加成');
    if (!/额外装备：一枚镶金怀表/.test(u27)) f.push('U27 缺少额外装备');
    if (state.backgroundChoices.militaryRole !== '军官') f.push('回读专职错误: ' + state.backgroundChoices.militaryRole);
    if ((cells.H33 || cells.H34 || cells.H35 || cells.H36 || cells.H37 || cells.H38 || cells.H39)) f.push('H33-H39 不应有内容');
    return f;
  });

  await runCase('外乡人造访原因导出/回读', Object.assign(overridesA(), { background: '外乡人', name: '验证外乡人', backgroundChoices: { deity: '', contacts: '', scamType: '', missionChannel: '', academicDomain: '', crime: '', seclusion: '', militaryRole: '', foreignOrigin: '游客', companion: '' } }), ({ cells, state }) => {
    const f = [];
    const u27 = cells.U27 || '';
    if (!/造访原因：游客/.test(u27)) f.push('U27 缺少造访原因');
    if (!/额外获得50金币的起始资金/.test(u27)) f.push('U27 缺少原因加成说明');
    if (state.backgroundChoices.foreignOrigin !== '游客') f.push('回读造访原因错误: ' + state.backgroundChoices.foreignOrigin);
    return f;
  });

  await runCase('半精灵法师导出/回读', overridesB(), ({ cells, state }) => {
    const f = [];
    if (!/精灵语/.test(cells.Q6 || '')) f.push('Q6 语言缺失');
    if (!/属性选择/.test(cells.K113 || '')) f.push('K113 精灵恩惠缺失');
    if (!/奥法学者|知识/.test(cells.Q112 || '') && !/知识/.test(cells.Q113 || '')) f.push('Q112/Q113 法师专长缺失');
    let cantripRows=[];
    for(let r=123;r<=162;r++){
      const b=cells['B'+r]||'';
      if(b.indexOf('魔法伎俩')>=0||b.indexOf('光亮术')>=0)cantripRows.push(r);
    }
    if(cantripRows.length<2) f.push('法师戏法未写入主技能列表');
    else if(!cantripRows.every(r=>String(cells['I'+r]||'').indexOf('法师学徒')>=0)) f.push('法师戏法来源缺失');
    if ((cells.H33 || cells.H34 || cells.H35 || cells.H36 || cells.H37 || cells.H38 || cells.H39)) f.push('H33-H39 不应有内容');
    if ((state.raceChoices.extraAttrs || []).join('、') !== '敏捷、感知') f.push('回读半精灵属性错误');
    if (!state.classChoices.specChoices || !state.classChoices.specChoices['奥法学者']) f.push('回读法师专长缺失');
    const cantrips = (state.skills || []).filter(s => s.grantedBy === '法师学徒');
    if (cantrips.length < 2) f.push('回读戏法 freeSlot 标记缺失');
    return f;
  });
} finally {
  await browser.close();
}
