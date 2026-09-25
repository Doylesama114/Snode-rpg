import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';

if (!process.env.SNODE_CLI_CONNECTION) throw new Error('运行测试前设置 SNODE_CLI_CONNECTION 指向测试应用的连接文件');
const connection = JSON.parse(fs.readFileSync(process.env.SNODE_CLI_CONNECTION, 'utf8'));
function call(input) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: connection.port, path: '/v1/call', method: 'POST', headers: { Authorization: 'Bearer ' + connection.token, 'Content-Type': 'application/json' } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => { const data = JSON.parse(Buffer.concat(chunks).toString()); data.ok ? resolve(data.value) : reject(new Error(data.error)); });
    });
    req.on('error', reject);
    req.end(JSON.stringify(input));
  });
}
const draft = await call({ op: 'draft-new' });
const base = {
  className: '蛮斗士', specChoices: { 运动健将: { attr: '力量', skill: '威力' } },
  selectedFeatures: ['猛击', '凶蛮打击'], raceName: '人类',
  attrs: { 力量: 15, 敏捷: 15, 体质: 15, 智力: 8, 感知: 8, 魅力: 8, 意志: 13, 幸运: 8 },
  selectedSkills: ['威力', '体操', '耐力', '驯兽'], bgName: '平民英雄',
  equipLetter: 'A', charName: 'CLI_SPECIAL_TEST'
};
await call({ op: 'draft-patch', id: draft.id, patch: base });
const humanOptions = await call({ op: 'options', id: draft.id, step: 2 });
assert.ok(humanOptions.extras.conditionalText.join(' ').includes('中庸'));
assert.equal((await call({ op: 'validate', id: draft.id })).ok, false);
await call({ op: 'draft-patch', id: draft.id, patch: { humanFreeSkill: '威力' } });
assert.equal((await call({ op: 'validate', id: draft.id })).ok, true);
await call({ op: 'draft-patch', id: draft.id, patch: { specChoices: { 运动健将: { attr: '力量', skill: '不存在的熟练项' } } } });
assert.equal((await call({ op: 'validate', id: draft.id })).ok, false);
await call({ op: 'draft-patch', id: draft.id, patch: { specChoices: { 运动健将: { attr: '力量', skill: '威力' } } } });

await call({ op: 'draft-patch', id: draft.id, patch: { raceName: '龙裔', humanFreeSkill: null, dragonType: '' } });
const dragonOptions = await call({ op: 'options', id: draft.id, step: 2 });
assert.equal(dragonOptions.extras.dragonTypes.length, 10);
assert.equal((await call({ op: 'validate', id: draft.id })).ok, false);
await call({ op: 'draft-patch', id: draft.id, patch: { dragonType: '红龙' } });
const dragonValid = await call({ op: 'validate', id: draft.id });
assert.equal(dragonValid.ok, true, JSON.stringify(dragonValid.errors));
assert.equal(dragonValid.preview.dragonBreath, '火焰');

await call({ op: 'draft-patch', id: draft.id, patch: { bgName: '法师学徒', bgCantrips: [] } });
const bgOptions = await call({ op: 'options', id: draft.id, step: 5 });
assert.ok(bgOptions.extras.cantrips.length > 20);
assert.equal((await call({ op: 'validate', id: draft.id })).ok, false);
await call({ op: 'draft-patch', id: draft.id, patch: { bgCantrips: ['光亮术', '舞光术'] } });
assert.equal((await call({ op: 'validate', id: draft.id })).ok, true);

const soldier = await call({ op: 'show', type: 'background', name: '士兵' });
assert.ok(soldier.personalityChoices.military_roles.length > 0);
console.log(JSON.stringify({ ok: true, checked: ['human choice', 'invalid specialization rejection', 'dragon type and derived breath', 'background cantrips', 'personality options'] }));
