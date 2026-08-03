/**
 * 抉择技能组：为顾问回答提供“二选一/多选一”事实上下文。
 * 数据来源：advisor/chargen/choice_groups.json（由 build-advisor-choice-groups.mjs 生成）。
 */
import fs from 'fs';
import path from 'path';
import { ROOT } from './advisor-env.mjs';

let _cache = null;

export function loadChoiceGroups() {
  if (_cache) return _cache;
  const p = path.join(ROOT, 'advisor', 'chargen', 'choice_groups.json');
  _cache = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { groups: [] };
  return _cache;
}

export function resetChoiceGroupsCache() {
  _cache = null;
}

/** 找出 query 中出现的抉择组（按技能名直接匹配问题文本） */
export function findChoiceGroupsForQuery(query) {
  const q = String(query || '');
  const out = [];
  for (const g of loadChoiceGroups().groups || []) {
    const hits = (g.skills || []).filter((s) => q.includes(s));
    if (hits.length) {
      out.push({ ...g, hits });
    }
  }
  return out;
}

/** 在检索上下文末尾追加抉择规则事实；无匹配时原样返回 */
export function appendChoiceContext(query, context) {
  const groups = findChoiceGroupsForQuery(query);
  if (!groups.length) return context;
  const lines = [
    '',
    '### 抉择技能规则（事实 · 学习时受限）',
  ];
  for (const g of groups) {
    const maxNote = g.max && g.max > 1 ? `（最多选择 ${g.max} 项）` : '';
    lines.push(
      `- 抉择组「${g.id || g.cls}」（${g.cls || '通用'}）：${g.skills.join(' / ')} — ${g.rule || '仅可选择一项习得'}${maxNote}`,
    );
  }
  lines.push('- 用户询问其中任一技能时，须明确指出它与同组技能为抉择关系（不能同时学习），除非用户已说明只问效果。');
  return String(context || '') + '\n' + lines.join('\n');
}
