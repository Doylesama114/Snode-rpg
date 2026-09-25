import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repo, 'scripts/snode-cli.mjs');
const connection = process.env.SNODE_CLI_CONNECTION;
if (!connection) throw new Error('运行测试前设置 SNODE_CLI_CONNECTION 指向测试应用的连接文件');
const testWork = process.env.SNODE_CLI_TEST_WORKDIR || fs.mkdtempSync(path.join(os.tmpdir(), 'snode-cli-test-'));
const env = { ...process.env, SNODE_CLI_CONNECTION: connection };
const call = (...args) => {
  const run = spawnSync(process.execPath, [cli, ...args], { cwd: repo, env, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (run.status !== 0) throw new Error(`${args.join(' ')}: ${run.stderr || run.stdout}`);
  return JSON.parse(run.stdout);
};

const name = 'CLI_E2E_' + Date.now();
let id;
try {
  const flow = call('chargen', 'flow');
  assert.equal(flow.steps.length, 8);
  assert.equal(call('chargen', 'catalog', 'classes').data.length, 18);
  assert.equal(call('chargen', 'catalog', 'races').data.length, 30);
  assert.equal(call('chargen', 'catalog', 'backgrounds').data.length, 42);
  const full = call('chargen', 'show', 'class', '法师', '--full');
  assert.ok(full.fullPreview[0].allText.length > 20000);
  assert.ok(full.fullPreview[1].allText.length > 3000);
  assert.ok(full.fullPreview[0].skills.length > 400);
  const classSkills = call('chargen', 'catalog', 'classSkills', '--class', '法师');
  assert.equal(classSkills.entries.length, full.fullPreview[0].skills.length);
  const skill = call('chargen', 'show', 'skill', '法师', '塑能箭');
  assert.ok(skill.matches[0].detailText.includes('施展时间'));

  const draft = call('chargen', 'draft', 'new');
  assert.ok(draft.id);
  const before = call('character', 'list').length;
  const invalid = call('chargen', 'validate', draft.id);
  assert.equal(invalid.ok, false);
  assert.equal(call('character', 'list').length, before);

  const patch = {
    className: '蛮斗士',
    specChoices: { 运动健将: { attr: '力量', skill: '威力' } },
    selectedFeatures: ['猛击', '凶蛮打击'],
    raceName: '矮人',
    attrs: { 力量: 15, 敏捷: 15, 体质: 15, 智力: 8, 感知: 8, 魅力: 8, 意志: 13, 幸运: 8 },
    selectedSkills: ['威力', '体操', '耐力', '驯兽'],
    bgName: '平民英雄',
    equipLetter: 'A',
    charName: name,
    playerName: 'CLI 测试'
  };
  const patchPath = path.join(testWork, 'chargen-cli-e2e-patch.json');
  fs.writeFileSync(patchPath, JSON.stringify(patch), 'utf8');
  call('chargen', 'draft', 'patch', draft.id, '--input', patchPath);
  const options = call('chargen', 'options', draft.id, '--step', '0');
  assert.equal(options.label, '选择职业');
  assert.ok(options.renderedText.includes('蛮斗士'));
  const reviewOptions = call('chargen', 'options', draft.id, '--step', '7');
  assert.ok(reviewOptions.renderedHtml.includes('id="saveBtn"'));
  assert.equal(reviewOptions.canContinue, true);
  const preview = call('chargen', 'preview', draft.id);
  assert.equal(preview.state.charName, name);
  assert.ok(preview.reviewText.includes('蛮斗士'));
  assert.ok(preview.reviewHtml.includes('id="saveBtn"'));

  const valid = call('chargen', 'validate', draft.id);
  assert.equal(valid.ok, true, JSON.stringify(valid.errors));
  assert.equal(call('character', 'list').length, before);
  const created = call('chargen', 'commit', draft.id);
  assert.equal(created.ok, true, JSON.stringify(created.errors));
  id = created.id;
  assert.equal(call('character', 'get', id).name, name);
  assert.equal(call('character', 'list').length, before + 1);

  const updatedPatchPath = path.join(testWork, 'chargen-cli-e2e-update.json');
  fs.writeFileSync(updatedPatchPath, JSON.stringify({ story: '通过 CLI 更新的背景故事' }), 'utf8');
  call('chargen', 'draft', 'patch', draft.id, '--input', updatedPatchPath);
  const updated = call('character', 'update', id, '--draft', draft.id);
  assert.equal(updated.updated, true);
  assert.equal(call('character', 'get', id).story, '通过 CLI 更新的背景故事');
  call('character', 'delete', id, '--yes');
  id = undefined;
  assert.equal(call('character', 'list').length, before);

  console.log(JSON.stringify({ ok: true, checked: ['flow', 'catalog', 'full preview and hidden skill details', 'targeted skill lookup', 'draft', 'invalid validate', 'options', 'preview', 'valid validate', 'commit', 'get', 'list', 'update', 'delete'] }));
} finally {
  if (id) {
    try { call('character', 'delete', id, '--yes'); } catch (_) {}
  }
}
