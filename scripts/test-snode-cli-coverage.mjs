import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';

const file = process.env.SNODE_CLI_CONNECTION;
if (!file) throw new Error('运行测试前设置 SNODE_CLI_CONNECTION 指向测试应用的连接文件');
const connection = JSON.parse(fs.readFileSync(file, 'utf8'));
function call(input) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: connection.port, path: '/v1/call', method: 'POST', headers: { Authorization: 'Bearer ' + connection.token, 'Content-Type': 'application/json' } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        body.ok ? resolve(body.value) : reject(new Error(body.error));
      });
    });
    req.on('error', reject);
    req.end(JSON.stringify(input));
  });
}

const classes = (await call({ op: 'catalog', type: 'classes' })).data.map(row => row.name);
const races = (await call({ op: 'catalog', type: 'races' })).data.map(row => row.name);
const backgrounds = (await call({ op: 'catalog', type: 'backgrounds' })).data.map(row => row.name);
const draft = await call({ op: 'draft-new' });
const missing = [];
for (const name of classes) {
  const entry = await call({ op: 'show', type: 'class', name, full: true });
  assert.ok(entry.detailText.length > 20, name);
  if (entry.fullPreview.some(page => !page.available || page.allText.length < 100)) missing.push(name);
  if (entry.fullPreview[0].skills.length < 1 || entry.fullPreview[0].skills.some(skill => !skill.searchText)) missing.push(name + ':skills');
  await call({ op: 'draft-patch', id: draft.id, patch: { className: name } });
  const options = await call({ op: 'options', id: draft.id, step: 0 });
  assert.ok(options.renderedText.includes(name), name);
  if (name === '牧师') assert.ok(options.extras.deities.length > 0);
  if (name === '魔契师') assert.ok(options.extras.patrons.length > 0);
  if (name === '召唤师') assert.ok(options.extras.contracts.length > 0);
}
for (const name of races) {
  const entry = await call({ op: 'show', type: 'race', name });
  assert.ok(entry.detailText.includes(name), name);
  await call({ op: 'draft-patch', id: draft.id, patch: { raceName: name } });
  const options = await call({ op: 'options', id: draft.id, step: 2 });
  assert.ok(options.renderedText.includes(name), name);
  const hasChoice = Object.values(entry.data.属性加成 || {}).includes('X') ||
    /[\/或]/.test(entry.data.体型 || '') || name === '龙裔' ||
    (entry.data.特性 || []).some(trait => trait.name === '中庸' || trait.save_choice || trait.skill_choice || trait.prof_input);
  if (hasChoice) assert.ok(options.extras.conditionalText.length > 0, name + ': conditional options');
}
for (const name of backgrounds) {
  const entry = await call({ op: 'show', type: 'background', name });
  assert.ok(entry.detailText.includes(name), name);
  await call({ op: 'draft-patch', id: draft.id, patch: { bgName: name } });
  const options = await call({ op: 'options', id: draft.id, step: 5 });
  assert.ok(options.renderedText.includes(name), name);
  if (entry.personalityChoices.traits?.length) assert.deepEqual(options.extras.personalityChoices.traits, entry.personalityChoices.traits);
  if (entry.otherPick) assert.equal(options.extras.otherPick.count, entry.otherPick.count);
}
console.log(JSON.stringify({ ok: true, classes: classes.length, races: races.length, backgrounds: backgrounds.length, missingFullPreviews: missing }));
