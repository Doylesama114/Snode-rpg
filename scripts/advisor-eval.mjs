#!/usr/bin/env node
/**
 * Advisor 回归评测：检索覆盖 + 回答断言 + 引用校验 + LLM-as-judge 要点评分。
 * 用法:
 *   node scripts/advisor-eval.mjs                      完整 API + 断言 + 引用校验
 *   node scripts/advisor-eval.mjs --context-only      只校验检索上下文（不调 API）
 *   node scripts/advisor-eval.mjs --judge             回答 + 断言 + 引用校验 + judge 要点评分
 *   node scripts/advisor-eval.mjs --sample 3          随机抽 3 个用例
 *   node scripts/advisor-eval.mjs --report            汇总历史报告趋势
 *   node scripts/advisor-eval.mjs --json              每用例输出单行 JSON
 * 退出码：断言失败 1；judge 低分不参与退出码（报告呈现）。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { advise } from './mage-advisor.mjs';
import { judgeAnswer } from './advisor-judge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'tmp', 'eval_reports');

const CASES = [
  {
    name: 'build_warrior',
    citationRequired: true,
    query: '我是1级战士，属性力量16敏捷14体质14，请帮我规划前几级的学习路线和推荐技能',
    contextHas: ['L2 战士技能', '猛击'],
    mustInclude: ['战士', '专长'],
    anyOf: [['猛击', '重殴', '盾牌格挡']],
    points: [
      '正确识别属性：力量16/敏捷14/体质14',
      'L1 技能槽基数 10',
      'L4 获取一项特殊专长，L5 开启三条进阶途径',
      '推荐具体战斗风格或技能（如猛击/重殴/盾牌格挡之一）',
      '末尾含免责声明',
    ],
  },
  {
    name: 'class_compare',
    query: '术士和法师有什么区别，新手该选哪个？',
    contextHas: ['术士', '法师'],
    mustInclude: ['术士', '法师'],
    points: [
      '术士关键属性为幸运，法师关键属性为智力',
      '术士含随机机制（混沌法术/混乱箭依赖骰点）',
      '法师初始特性为八选四（含塑能箭等）',
      '给出新手选择建议（任一方向）',
    ],
  },
  {
    name: 'rules_qa_long',
    citationRequired: true,
    query: '防御等级和攻击命中的检定公式是什么？我的战士力量18，防御等级该怎么算？',
    contextHas: ['护甲值演算'],
    mustInclude: ['护甲基础', '攻击命中检定值'],
    points: [
      'AC 公式包含护甲基础、敏捷调整值（含上限）、盾牌加值三项',
      '无护甲时 AC 合计为 10',
      '力量 18 转换为命中调整值 +4',
      '命中公式 = D20 + 攻击命中检定值',
      '说明未指定变量（武器熟练/益补等）不计入',
    ],
  },
  {
    name: 'rules_qa_short',
    query: '防御等级和攻击命中的检定公式是什么？',
    contextHas: ['护甲值演算', '战斗命中演算'],
    mustInclude: ['护甲基础', 'D20'],
    points: [
      'AC 公式三项组成（护甲基础+敏捷+盾牌）',
      '无护甲 AC=10',
      '命中公式 = D20 + 攻击命中检定值',
      '注明假设（无武器熟练加成等）',
    ],
  },
  {
    name: 'druid_advance',
    query: '德鲁伊3级能获得什么新形态？水栖形态有什么用？',
    contextHas: ['野兽形态', '水栖形态', '飞禽形态'],
    mustInclude: ['水栖形态', '水下呼吸'],
    anyOf: [['8米', '飞禽形态', '海豹']],
    points: [
      '3 级通过野兽形态获得水栖形态',
      '水栖形态提供水下呼吸',
      '生命值上限临时变为 5+角色等级',
      '水下移动速度 8 米',
      '5 级可变海豹/海豚/小型鲨鱼等更具攻击性水栖生物',
      '3 级升级奖励含技能槽+1与解锁三阶天赋树',
    ],
  },
  {
    name: 'cleric_domain',
    query: '牧师生命与丰收之神的领域技能有哪些？树莓术的效果是什么？',
    contextHas: ['生命与丰收之神', '树莓术'],
    mustInclude: ['树莓术', '生命与丰收之神'],
    points: [
      '生命与丰收之神领域存在',
      '树莓术的效果（回复生命/视作进食/移除力竭之一）',
      '引用至少一个具体领域技能名',
    ],
  },
  {
    name: 'mage_school_seq',
    query: '法师的塑能学派序列是什么？',
    contextHas: ['塑能学派序列'],
    mustInclude: ['塑能学派序列'],
    points: [
      '塑能学派序列存在',
      '序列机制：可将塑能学派法术/戏法加入法术序列',
      '提及 L18 解锁大元素使超越者途径信息',
    ],
  },
  {
    name: 'universal_rune',
    query: '通用天赋树里的坚韧与不息符文有什么效果？',
    contextHas: ['坚韧与不息符文'],
    mustInclude: ['坚韧与不息符文'],
    points: [
      '坚韧与不息符文存在',
      '效果与体魄 D8 色彩骰/临时生命值相关',
      '包含具体数值或规则（临时生命值等于角色等级/回复优势之一）',
    ],
  },
  {
    name: 'artificer_drawing',
    query: '奇械师的破片手雷图纸怎么制作？有什么效果？',
    contextHas: ['破片手雷（图纸）'],
    mustInclude: ['破片手雷'],
    points: [
      '破片手雷（图纸）存在',
      '制作需要零件包（研发材料）',
      '效果：3*3 区域内角色各受 4 点穿刺伤害',
      '闪避成功仍承受一半结算后伤害',
    ],
  },
  {
    name: 'hunter_guard_talent',
    query: '猎人的灵龟守护的天赋效果是什么？',
    contextHas: ['灵龟守护·天赋'],
    mustInclude: ['灵龟守护'],
    anyOf: [['16点生命值', '命中检定具有劣势']],
    points: [
      '灵龟守护·天赋存在',
      '效果之一：跳过自身回合回复 16 点生命值',
      '效果之二：承受穿刺/挥砍时可令对方命中检定具有劣势',
    ],
  },
  {
    name: 'bard_chord_restored',
    query: '吟游诗人的治愈和弦是什么效果？',
    contextHas: ['治愈和弦'],
    mustInclude: ['回复', '律动节拍'],
    points: [
      '治愈和弦为回复类技能（触发带回复关键词的律动节拍效果）',
      '关键词包含回复.媒介.节奏',
      '不与静寂术内容混淆（无"粉色罩子/隔绝声音"类描述）',
    ],
  },
  {
    name: 'universal_free_offensive',
    query: '通用天赋树的自由攻势有什么效果？',
    contextHas: ['自由攻势'],
    mustInclude: ['自由攻势'],
    points: [
      '自由攻势存在',
      '效果：分别施展两个不同的通用天赋树战技（位阶不超过四阶）',
      '这次攻击可忽视战技限制条件',
    ],
  },
  {
    name: 'hunter_guard_passive_natural',
    query: '灵猴守护的被动是什么效果？',
    contextHas: ['灵猴守护·天赋'],
    mustInclude: ['灵猴守护'],
    points: [
      '灵猴守护·天赋存在',
      '效果：偷窃失败可回退事态（警惕值 15 可识破）',
    ],
  },
  {
    name: 'artificer_drawing_natural',
    query: '奇械师的破片手雷图纸怎么做？',
    contextHas: ['破片手雷（图纸）'],
    mustInclude: ['破片手雷'],
    points: [
      '破片手雷（图纸）存在',
      '制作需零件包等材料',
      '效果：3*3 区域 4 点穿刺伤害',
    ],
  },
  {
    name: 'rogue_recipe_natural',
    query: '游荡者的猩红之瓶配方怎么做？',
    contextHas: ['猩红之瓶（配方）'],
    mustInclude: ['猩红之瓶'],
    points: [
      '猩红之瓶（配方）存在',
      '配方材料包含蝎毒/炽心椒/血液之一',
      '效果：受 4 点火焰伤害后回复 8 点生命值',
      '伤害和回复不附加关键属性',
    ],
  },
  {
    name: 'druid_water_form_interaction',
    query: '德鲁伊的野兽形态在水栖形态下，如果我施展一个兽灵风格以外的技能，会发生什么？水栖形态的水下呼吸会怎样？',
    contextHas: ['野兽形态', '水栖形态'],
    mustInclude: ['解除', '水下呼吸'],
    points: [
      '施展兽灵风格以外的技能会强制解除野兽形态，变形关键词能力锁定至下一自身回合结束',
      '水栖形态是野兽形态的升级内容，提供水下呼吸',
      '解除形态后水下呼吸随之消失',
      '水栖形态下水下移动速度为8米或生命值上限 5+角色等级',
      '不使用“未收录”句式（资料库有完整机制与水栖数据）',
    ],
  },
  {
    name: 'ac_armor_value_calc',
    query: '我是一名3级战士，力量18，敏捷14，穿着皮甲拿着盾牌。我朋友说战士的防御等级是力量加值加护甲，那我的防御等级是18吗？',
    contextHas: ['护甲值演算'],
    mustInclude: ['15', '敏捷'],
    points: [
      '纠正错误假设：防御等级用敏捷调整值而非力量加值',
      'AC公式=护甲基础+min(敏捷调整值,敏捷上限)+盾牌加值',
      '敏捷14对应调整值+2，皮甲敏捷上限为2不削减',
      '皮甲基础11、盾牌加值+2',
      '合计防御等级为15',
      '不顺着错误前提给出18',
    ],
  },
  {
    name: 'chargen_recommend_vague',
    query: '我想玩一个很帅，很有操作感的角色，我可以玩点什么',
    contextHas: ['职业定位', '地精', '高等精灵', '小丑', '职业杀手'],
    mustInclude: ['推荐'],
    points: [
      '推荐≥3个不同职业（含定位/操作感/生存说明）',
      '至少2个职业各带≥2个推荐种族（含契合点）',
      '属性目标给出最终值（购点+种族加值叠加，如 15+2=17）',
      '推荐的职业/种族/背景名称均来自上下文（不编造）',
      '背景推荐后附自由选择声明（含“自行选择”类词）',
    ],
  },
  {
    name: 'chargen_advice',
    query: '推荐一个适合新手的吟游诗人加点方案和开局装备',
    contextHas: ['吟游诗人', '套装 A'],
    mustInclude: ['魅力'],
    points: [
      '吟游诗人关键属性为魅力',
      '初始特性五选二（推荐激励乐章/休憩曲之一）',
      '开局套装推荐且给出理由（套装 A 可推荐）',
    ],
  },
];

function extractContext(messages) {
  const user = [...messages].reverse().find((m) => m.role === 'user' && m.content && m.content.includes('【检索上下文】'));
  if (!user) return '';
  const at = user.content.indexOf('【检索上下文】');
  const routeAt = user.content.indexOf('【路由】');
  if (at < 0) return '';
  let ctx = routeAt > at ? user.content.slice(at, routeAt) : user.content.slice(at);
  // 去掉回显的问题行，避免 contextHas 被 query 关键词污染
  ctx = ctx.split('\n').filter((l) => !/^# 检索上下文/.test(l) && !/^\u95ee\u9898: /.test(l)).join('\n');
  return ctx;
}

function contextIds(ctx) {
  const ids = new Set();
  for (const m of ctx.matchAll(/条目:([A-Za-z0-9-]+)/g)) {
    if (m[1] && m[1] !== '-') ids.add(m[1]);
  }
  return ids;
}

function extractRefs(text) {
  const m = String(text || '').match(/【参考】[^\n]*$/);
  if (!m) return [];
  const items = m[0].replace(/^【参考】/, '').split('｜').map((x) => x.trim()).filter(Boolean);
  const refs = [];
  for (const it of items) {
    const mm = it.match(/^(.*?)（(.*?)·(.*?)）$/);
    if (mm) refs.push({ raw: it, name: mm[1].trim(), cls: mm[2].trim(), id: mm[3].trim() });
    else refs.push({ raw: it, name: it, cls: '', id: '' });
  }
  return refs;
}

function checkCitation(refs, validIds) {
  const errors = [];
  for (const r of refs) {
    const idOk = /^[a-z]+-[a-z]+(-?\d+)+$/.test(r.id);
    if (!idOk || !validIds.has(r.id)) {
      errors.push({ raw: r.raw, id: r.id, reason: !idOk ? 'id 格式非法' : 'id 不在检索上下文' });
    }
  }
  return errors;
}

function checkCase(c, text, missing) {
  const okInclude = c.mustInclude.every((k) => text.includes(k));
  if (!okInclude) missing.push(...c.mustInclude.filter((k) => !text.includes(k)));
  for (const group of c.anyOf || []) {
    if (!group.some((k) => text.includes(k))) {
      missing.push(`anyOf[${group.join('/')}]`);
    }
  }
  if (c.citationRequired && !text.includes('【参考】')) {
    missing.push('【参考】');
  }
}

function runReport(args) {
  if (!fs.existsSync(REPORTS_DIR)) {
    console.log('暂无历史报告');
    return;
  }
  const files = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) {
    console.log('暂无历史报告');
    return;
  }
  const rows = [];
  for (const f of files) {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), 'utf8'));
      rows.push({
        file: f,
        date: r.date,
        passRate: r.summary?.passRate,
        judgeAvg: r.summary?.judgeAvg,
        citationErrors: r.summary?.citationErrors,
        total: r.summary?.total,
      });
    } catch { /* skip */ }
  }
  console.log('=== 历史报告趋势 ===');
  for (const row of rows.slice(-10)) {
    console.log(` ${row.file} | 断言通过率 ${row.passRate} | judge 均分 ${row.judgeAvg} | 引用错误 ${row.citationErrors} | 用例 ${row.total}`);
  }
}

async function run() {
  const args = process.argv.slice(2);
  const contextOnly = args.includes('--context-only');
  const useJudge = args.includes('--judge');
  const json = args.includes('--json');
  const sampleIdx = args.indexOf('--sample');
  const sampleN = sampleIdx >= 0 ? Number(args[sampleIdx + 1]) : null;
  if (args.includes('--report')) {
    runReport(args);
    return;
  }

  let cases = CASES;
  if (sampleN && sampleN > 0) {
    cases = [...CASES].sort(() => Math.random() - 0.5).slice(0, sampleN);
    console.log(`抽样 ${cases.length} 个用例`);
  }

  const results = [];
  let failed = 0;
  let citationErrorsTotal = 0;
  let judgeSum = 0;
  let judgeCount = 0;

  for (const c of cases) {
    const t0 = Date.now();
    try {
      const dry = await advise(c.query, { dryRun: true });
      const ctx = extractContext(dry.messages || []);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const ctxMissing = c.contextHas.filter((k) => !ctx.includes(k));
      if (contextOnly) {
        const ok = ctxMissing.length === 0;
        if (!ok) failed += 1;
        results.push({ name: c.name, ok, skipped: false, seconds: Number(elapsed), ctxMissing, intent: dry.intent });
        if (json) console.log('###RESULT### ' + JSON.stringify(results[results.length - 1]));
        else console.log(`${ok ? 'PASS' : 'FAIL'} ${c.name} (${elapsed}s) intent=${dry.intent}${ctxMissing.length ? ' ctxMissing=' + ctxMissing.join(',') : ''}`);
        continue;
      }

      const out = await advise(c.query);
      const elapsedFull = ((Date.now() - t0) / 1000).toFixed(1);
      const missing = [];
      checkCase(c, out.answer || '', missing);
      if (ctxMissing.length) missing.push(`ctx[${ctxMissing.join(',')}]`);
      const refs = extractRefs(out.answer || '');
      const validIds = contextIds(ctx);
      const citeErrors = checkCitation(refs, validIds);
      if (citeErrors.length) citationErrorsTotal += citeErrors.length;
      const ok = missing.length === 0;

      let judge = null;
      if (useJudge && c.points?.length) {
        judge = await judgeAnswer({ query: c.query, points: c.points, answer: out.answer || '' });
        if (judge.ok) {
          const passed = judge.scores.filter((s) => s.pass === 1).length;
          judgeSum += passed / Math.max(judge.scores.length, 1);
          judgeCount += 1;
        }
      }

      if (!ok) failed += 1;
      const rec = {
        name: c.name, ok, skipped: false, seconds: Number(elapsedFull), missing,
        intent: out.intent, citationErrors: citeErrors, judge: judge ? {
          ok: judge.ok, pointPass: judge.ok ? judge.scores.filter((s) => s.pass === 1).length : 0,
          pointTotal: judge.ok ? judge.scores.length : 0, total: judge.ok ? judge.total : null,
          reason: judge.ok ? judge.reason : (judge.error || ''),
        } : null,
      };
      results.push(rec);
      if (json) console.log('###RESULT### ' + JSON.stringify(rec));
      else {
        let line = `${ok ? 'PASS' : 'FAIL'} ${c.name} (${elapsedFull}s) intent=${out.intent}`;
        if (missing.length) line += ` missing=${missing.join(',')}`;
        if (citeErrors.length) line += ` citeErr=${citeErrors.length}`;
        if (judge && judge.ok) line += ` judge=${judge.scores.filter((s) => s.pass === 1).length}/${judge.scores.length}`;
        console.log(line);
      }
    } catch (e) {
      failed += 1;
      results.push({ name: c.name, ok: false, skipped: false, error: e.message });
      if (json) console.log('###RESULT### ' + JSON.stringify(results[results.length - 1]));
      else console.log(`FAIL ${c.name} error=${e.message}`);
    }
  }

  const total = results.length;
  const passed = results.filter((r) => r.ok && !r.skipped).length;
  const passRate = total ? Number(((passed / total) * 100).toFixed(1)) : 0;
  const judgeAvg = judgeCount ? Number(((judgeSum / judgeCount) * 5).toFixed(2)) : null;
  console.log(`\nSUMMARY: ${passed} passed, ${failed} failed (of ${total}) | 引用错误 ${citationErrorsTotal}${judgeAvg != null ? ` | judge 均分 ${judgeAvg}/5` : ''}`);

  const report = {
    date: new Date().toISOString(),
    mode: useJudge ? 'judge' : (contextOnly ? 'context' : 'full'),
    summary: { total, passed, failed, passRate, citationErrors: citationErrorsTotal, judgeAvg, judgeCount },
    results,
  };
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(REPORTS_DIR, `eval-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2), 'utf8');
  console.log('报告已存 ' + file);
  process.exit(failed ? 1 : 0);
}

run();
