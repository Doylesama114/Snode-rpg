#!/usr/bin/env node
/**
 * Advisor 回归测试：验证 deepseek-v4-flash 下的回答质量与检索覆盖。
 * 用法：
 *   node scripts/advisor-eval.mjs            完整 API 测试（真实调用）
 *   node scripts/advisor-eval.mjs --context-only  只校验检索上下文（不调 API，快）
 *   node scripts/advisor-eval.mjs --json      每用例输出单行 JSON
 * 退出码：全部通过 0；任一失败 1。
 */
import { advise } from './mage-advisor.mjs';

const CASES = [
  {
    name: 'build_warrior',
    query: '我是1级战士，属性力量16敏捷14体质14，请帮我规划前几级的学习路线和推荐技能',
    contextHas: ['L2 战士技能', '猛击'],
    mustInclude: ['战士', '专长'],
    anyOf: [['猛击', '重殴', '盾牌格挡']],
  },
  {
    name: 'class_compare',
    query: '术士和法师有什么区别，新手该选哪个？',
    contextHas: ['术士', '法师'],
    mustInclude: ['术士', '法师'],
  },
  {
    name: 'rules_qa_long',
    query: '防御等级和攻击命中的检定公式是什么？我的战士力量18，防御等级该怎么算？',
    contextHas: ['护甲值演算'],
    mustInclude: ['护甲基础', '攻击命中检定值'],
  },
  {
    name: 'rules_qa_short',
    query: '防御等级和攻击命中的检定公式是什么？',
    contextHas: ['护甲值演算', '战斗命中演算'],
    mustInclude: ['护甲基础', 'D20'],
  },
  {
    name: 'druid_advance',
    query: '德鲁伊3级能获得什么新形态？水栖形态有什么用？',
    contextHas: ['野兽形态', '水栖形态', '飞禽形态'],
    mustInclude: ['水栖形态', '水下呼吸'],
    anyOf: [['8米', '飞禽形态', '海豹']],
  },
  {
    name: 'cleric_domain',
    query: '牧师生命与丰收之神的领域技能有哪些？树莓术的效果是什么？',
    contextHas: ['生命与丰收之神', '树莓术'],
    mustInclude: ['树莓术', '生命与丰收之神'],
  },
  {
    name: 'mage_school_seq',
    query: '法师的塑能学派序列是什么？',
    contextHas: ['塑能学派序列'],
    mustInclude: ['塑能学派序列'],
  },
  {
    name: 'universal_rune',
    query: '通用天赋树里的坚韧与不息符文有什么效果？',
    contextHas: ['坚韧与不息符文'],
    mustInclude: ['坚韧与不息符文'],
  },
  {
    name: 'chargen_advice',
    query: '推荐一个适合新手的吟游诗人加点方案和开局装备',
    contextHas: ['吟游诗人', '套装 A'],
    mustInclude: ['魅力'],
  },
];

function extractContext(messages) {
  const user = [...messages].reverse().find((m) => m.role === 'user' && m.content && m.content.includes('【检索上下文】'));
  if (!user) return '';
  const at = user.content.indexOf('【检索上下文】');
  const routeAt = user.content.indexOf('【路由】');
  if (at < 0) return '';
  return routeAt > at ? user.content.slice(at, routeAt) : user.content.slice(at);
}

function checkCase(c, text, missing) {
  const okInclude = c.mustInclude.every((k) => text.includes(k));
  if (!okInclude) missing.push(...c.mustInclude.filter((k) => !text.includes(k)));
  for (const group of c.anyOf || []) {
    if (!group.some((k) => text.includes(k))) {
      missing.push(`anyOf[${group.join('/')}]`);
    }
  }
}

async function run() {
  const contextOnly = process.argv.includes('--context-only');
  const json = process.argv.includes('--json');
  const results = [];
  let failed = 0;
  let skipped = 0;

  for (const c of CASES) {
    const t0 = Date.now();
    try {
      const out = await advise(c.query, { dryRun: contextOnly });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      if (contextOnly) {
        const ctx = extractContext(out.messages || []);
        const missing = c.contextHas.filter((k) => !ctx.includes(k));
        const ok = missing.length === 0;
        if (!ok) failed += 1;
        results.push({ name: c.name, ok, skipped: !!c.skip, seconds: Number(elapsed), missing, intent: out.intent });
        if (json) console.log('###RESULT### ' + JSON.stringify(results[results.length - 1]));
        else console.log(`${ok ? 'PASS' : 'FAIL'} ${c.name} (${elapsed}s) intent=${out.intent}${missing.length ? ' missing=' + missing.join(',') : ''}`);
        continue;
      }
      if (c.skip) {
        skipped += 1;
        results.push({ name: c.name, ok: true, skipped: true, seconds: Number(elapsed), reason: c.skipReason });
        if (json) console.log('###RESULT### ' + JSON.stringify(results[results.length - 1]));
        else console.log(`SKIP ${c.name} (${elapsed}s) — ${c.skipReason}`);
        continue;
      }
      const missing = [];
      checkCase(c, out.answer || '', missing);
      const ok = missing.length === 0;
      if (!ok) failed += 1;
      results.push({ name: c.name, ok, skipped: false, seconds: Number(elapsed), missing, intent: out.intent, answerStyle: out.answerStyle });
      if (json) console.log('###RESULT### ' + JSON.stringify(results[results.length - 1]));
      else console.log(`${ok ? 'PASS' : 'FAIL'} ${c.name} (${elapsed}s) intent=${out.intent}${missing.length ? ' missing=' + missing.join(',') : ''}`);
    } catch (e) {
      failed += 1;
      results.push({ name: c.name, ok: false, skipped: false, error: e.message });
      if (json) console.log('###RESULT### ' + JSON.stringify(results[results.length - 1]));
      else console.log(`FAIL ${c.name} error=${e.message}`);
    }
  }

  const total = results.length;
  const passed = results.filter((r) => r.ok && !r.skipped).length;
  console.log(`\nSUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped (of ${total})`);
  process.exit(failed ? 1 : 0);
}

run();
