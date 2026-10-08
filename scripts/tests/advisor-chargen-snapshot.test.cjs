const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const pages = ['斯诺德跑团/角色创建页.html', 'electron-app/斯诺德跑团/角色创建页.html'];
const labels = ['选择职业', '选择起始特性', '选择种族', '分配属性',
  '选择熟练项', '选择个性背景', '选择装备', '确认角色'];

function loadChargenAdapter(file, character, step = 0) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const start = html.indexOf('function chargenSnapshotChar(){');
  const end = html.indexOf('function applyAdvisorHandoff(){', start);
  assert.ok(start >= 0 && end > start, 'Creation-page advisor adapter must exist');
  const context = vm.createContext({
    CHAR: character,
    CURRENT_STEP: step,
    STEP_LABELS: labels,
    window: {},
    calcCost: () => 32,
    buildOverviewProfLines: () => [{ name: '专注', src: '职业' }],
  });
  vm.runInContext(html.slice(start, end), context, {
    filename: path.join(ROOT, file),
    lineOffset: html.slice(0, start).split('\n').length - 1,
  });
  return context.window.snowdChargen;
}

for (const file of pages) {
  test(`${file}: advisor receives the actual selected class without a global char variable`, () => {
    const character = { className: '法师', keyAttr: '智力', raceName: '人类',
      attrs: { 智力: 15 }, selectedFeatures: [{ n: '塑能箭' }],
      selectedSkills: ['专注'], charName: '测试角色',
      raceData: { 属性加成: { 智力: 1 } } };
    const adapter = loadChargenAdapter(file, character, 3);
    const state = adapter.getState();
    assert.equal(state.char.className, '法师');
    assert.equal(state.char.keyAttr, '智力');
    assert.equal(state.step, 3);
    assert.equal(state.stepLabel, '分配属性');
    assert.equal(state.char.pointSpent, 32);
    assert.equal(state.char.selectedFeatures[0], '塑能箭');
    assert.ok(state.fingerprint.includes('法师'));
    state.char.attrs.智力 = 8;
    assert.equal(character.attrs.智力, 15, 'Advisor snapshots must not mutate the creation state');
  });

  test(`${file}: an empty creation form can still provide an advisor snapshot`, () => {
    const state = loadChargenAdapter(file, { attrs: {} }).getState();
    assert.equal(state.char.className, null);
    assert.equal(state.source, 'chargen_page');
    assert.equal(typeof state.fingerprint, 'string');
  });

  test(`${file}: every creation step can reach the advisor bridge and query policy`, async () => {
    const { chargenToWizardState } = await import('../advisor-chargen-bridge.mjs');
    const { buildChargenBubbleQuery, buildChargenExtraContext } = await import('../advisor-chargen-policy.mjs');
    for (let step = 0; step < labels.length; step++) {
      const state = loadChargenAdapter(file, { className: '战士', keyAttr: '力量',
        attrs: { 力量: 15 }, selectedSkills: ['专注'], charName: '测试角色' }, step).getState();
      assert.equal(chargenToWizardState(state).selections.className, '战士');
      assert.ok(buildChargenBubbleQuery(state).length > 0, `Step ${step} query`);
      assert.equal(typeof buildChargenExtraContext(state), 'string');
    }
  });
}
