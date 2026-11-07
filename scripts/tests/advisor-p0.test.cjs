const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'scripts', 'mage-advisor.mjs');

test('澄清闸门在实体解析之后（源码守卫）', () => {
  const src = fs.readFileSync(SRC, 'utf8');
  assert.match(src, /resolveAdvancementName/, '必须解析进阶名');
  assert.match(src, /const clarify = plan && !advancementName/, '已点名进阶时不再追问职业');
  const iResolve = src.indexOf('resolveAdvancementName(query)');
  const iClarify = src.indexOf('const clarify = plan && !advancementName');
  assert.ok(iResolve > 0 && iClarify > iResolve, '解析必须发生在追问判断之前');
});

test('advise 暴露三段计时字段', () => {
  const src = fs.readFileSync(SRC, 'utf8');
  for (const k of ['planMs', 'retrieveMs', 'llmMs', 'totalMs']) {
    assert.ok(src.includes(k), '缺少计时字段 ' + k);
  }
  assert.match(src, /traceAdvise\(/, '必须写 trace');
});

test('飞贼可被解析为游荡者（运行时）', async () => {
  const mod = await import(pathToFileURL(path.join(ROOT, 'scripts', 'advisor-advancement-resolve.mjs')).href);
  const adv = mod.resolveAdvancementName('我想玩飞贼，我该怎么安排我的成长路线？');
  assert.equal(adv, '飞贼');
  const base = mod.inferSourceClassForAdvancement(adv);
  assert.ok(base && base.includes('游荡'), '应解析出游荡者，实际 ' + base);
});

test('eval 用例都带 capability 族标签', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'advisor-eval.mjs'), 'utf8');
  assert.match(src, /FAMILY_BY_NAME/, '缺少族映射');
  assert.match(src, /能力矩阵/, '缺少矩阵汇总输出');
  assert.match(src, /family: familyOf\(c\.name\)/, '用例未打标');
});
