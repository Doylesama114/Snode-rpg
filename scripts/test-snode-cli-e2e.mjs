import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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
  const flowRun = spawnSync(process.execPath, [cli, 'chargen', 'flow'], { cwd: repo, env, encoding: 'utf8' });
  assert.equal(flowRun.status, 0, flowRun.stderr);
  assert.ok(/^[\x00-\x7f]*$/.test(flowRun.stdout), 'JSON output must survive legacy Windows console encodings');
  const flow = JSON.parse(flowRun.stdout);
  assert.equal(flow.steps.length, 8);
  assert.equal(flow.steps[0].label, '选择职业');
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
  fs.writeFileSync(updatedPatchPath, '\uFEFF' + JSON.stringify({ story: '通过 CLI 更新的背景故事' }), 'utf8');
  call('chargen', 'draft', 'patch', draft.id, '--input', updatedPatchPath);
  const updated = call('character', 'update', id, '--draft', draft.id);
  assert.equal(updated.updated, true);
  assert.equal(call('character', 'get', id).story, '通过 CLI 更新的背景故事');

  const beforePortrait = call('character', 'get', id);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');
  const portraitPath = path.join(testWork, 'chargen-cli-e2e-portrait.png');
  fs.writeFileSync(portraitPath, png);
  const portrait = call('character', 'portrait', id, '--file', portraitPath, '--slot', '1');
  assert.equal(portrait.updated, true);
  assert.equal(portrait.bytes, png.length);
  assert.equal(portrait.sha256, crypto.createHash('sha256').update(png).digest('hex'));
  const compact = call('character', 'get', id);
  assert.equal(compact.portrait, undefined);
  assert.deepEqual(compact.portraitInfo, { mime: 'image/png', bytes: png.length });
  const complete = call('character', 'get', id, '--include-portrait');
  assert.equal(complete.portrait, 'data:image/png;base64,' + png.toString('base64'));
  delete beforePortrait.portrait;
  delete beforePortrait._savedAt;
  delete compact.portraitInfo;
  delete compact._savedAt;
  assert.deepEqual(compact, beforePortrait, 'portrait update must preserve every other saved field');

  for (const slotArgs of [['--slot'], ['--slot', '4'], ['--slot', 'oops']]) {
    const run = spawnSync(process.execPath, [cli, 'character', 'delete', id, '--yes', ...slotArgs], { cwd: repo, env, encoding: 'utf8' });
    assert.notEqual(run.status, 0, `invalid ${slotArgs.join(' ')} must fail`);
    assert.match(JSON.parse(run.stderr).error, /--slot/);
    assert.equal(call('character', 'get', id).name, name, 'invalid slot must not delete the role');
  }

  call('character', 'delete', id, '--yes');
  id = undefined;
  assert.equal(call('character', 'list').length, before);

  const dancerDraft = call('chargen', 'draft', 'new');
  const dancerPatchPath = path.join(testWork, 'chargen-cli-e2e-dancer.json');
  fs.writeFileSync(dancerPatchPath, JSON.stringify({
    className: '战舞者', keyAttr: '敏捷', selectedFeatures: ['回旋斩', '激励旋步'],
    raceName: '木精灵',
    attrs: { 力量: 8, 敏捷: 15, 体质: 14, 智力: 8, 感知: 13, 魅力: 14, 意志: 12, 幸运: 8 },
    selectedSkills: ['隐匿', '洞悉', '察觉', '激励'],
    bgName: '运动员', bgProfs: { skills: { 运动: ['运动-跳跃'] }, profInput: '' },
    sportPreference: '短跑', equipLetter: 'B', charName: name + '_DANCER'
  }), 'utf8');
  call('chargen', 'draft', 'patch', dancerDraft.id, '--input', dancerPatchPath);
  const dancerValid = call('chargen', 'validate', dancerDraft.id);
  assert.equal(dancerValid.ok, true, JSON.stringify(dancerValid.errors));
  const dancer = call('chargen', 'commit', dancerDraft.id);
  assert.equal(dancer.ok, true, JSON.stringify(dancer.errors));
  id = dancer.id;
  const dancerSheet = call('character', 'get', id);
  assert.ok(dancerSheet.equipment['主手武器'].some(item => item.item === '匕首'));
  assert.ok(dancerSheet.equipment['副手武器'].some(item => item.item === '匕首'));
  call('character', 'delete', id, '--yes');
  id = undefined;
  assert.equal(call('character', 'list').length, before);

  console.log(JSON.stringify({ ok: true, checked: ['flow', 'catalog', 'full preview and hidden skill details', 'targeted skill lookup', 'draft', 'invalid validate', 'options', 'preview', 'valid validate', 'commit', 'get', 'list', 'update', 'portrait', 'compact get', 'slot validation', 'dual daggers', 'delete'] }));
} finally {
  if (id) {
    try { call('character', 'delete', id, '--yes'); } catch (_) {}
  }
}
