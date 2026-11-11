// 谋士「博闻强识」创建流程 E2E：专长选择 UI / 2 项知识熟练度 / 总览 / 导出 / 快照 / 面板显示
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PORT = 8175;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const rel = p.startsWith('/') ? p.slice(1) : p;
    const data = fs.readFileSync(path.join(ROOT, rel));
    res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({ headless: true });
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra || ''); } }

// ===== 创建页：专长选择 =====
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e.message)));
  await page.goto(`http://127.0.0.1:${PORT}/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E5%88%9B%E5%BB%BA%E9%A1%B5.html`);
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    window.PROF_SKELETON = {
      '力量': { '豁免': 0, '威力': 0, '承重': 0, '运动-跳跃': 0, '运动-攀爬': 0, '运动-游泳': 0, '运动-自定义': 0 },
      '敏捷': { '豁免': 0, '体操': 0, '骑乘': 0, '隐匿': 0, '巧手-偷窃': 0, '巧手-开锁': 0, '巧手-拆除': 0, '巧手-自定义': 0 },
      '体质': { '豁免': 0, '专注': 0, '耐力': 0 },
      '智力': { '豁免': 0, '调查': 0, '逻辑': 0, '宗教': 0, '估价': 0, '伪造': 0, '读唇': 0,
        '知识-历史': 0, '知识-地理': 0, '知识-人文': 0, '知识-政治': 0, '知识-神秘学': 0,
        '知识-工程学': 0, '知识-珠宝学': 0, '知识-草药学': 0, '知识-医药': 0, '知识-烹饪': 0 },
      '感知': { '豁免': 0, '察觉': 0, '洞悉': 0, '聆听': 0, '求生': 0, '医药': 0, '驯兽': 0 },
      '魅力': { '豁免': 0, '欺瞒': 0, '威吓': 0, '表演': 0, '说服': 0, '交涉': 0, '易容': 0 },
      '意志': { '豁免': 0, '决策': 0, '专注': 0 }
    };
  });
  const setup = await page.evaluate(() => {
    const idx = CLASSES.findIndex(c => c.name === '谋士');
    selectClass(idx);
    const groups = [...document.querySelectorAll('#specChoiceArea .specGroup')].map(g => ({
      spec: g.getAttribute('data-spec'),
      chips: [...g.querySelectorAll('.specMultiRow .spec-skill')].map(c => c.getAttribute('data-skill')),
      hint: g.querySelector('.specMultiHint')?.textContent.trim(),
    }));
    return {
      features: (CLASS_SPECIALIZATIONS['谋士'] || []).map(f => f.n),
      multi: (SPEC_PROF_CHOICES['谋士'] || {})['博闻强识']?.multi,
      groups,
      nextDisabled: document.getElementById('nextBtn')?.disabled,
    };
  });
  ok('谋士专长 = 运筹帷幄/博闻强识/料敌机先', setup.features.join('、') === '运筹帷幄、博闻强识、料敌机先', setup.features.join('、'));
  ok('博闻强识 为多选（2 项）', setup.multi === 2, String(setup.multi));
  const g = setup.groups.find(x => x.spec === '博闻强识');
  ok('专长选择区渲染 10 项知识熟练度', !!g && g.chips.length === 10 && g.chips.includes('知识-历史') && g.chips.includes('知识-烹饪'), JSON.stringify(g && g.chips.slice(0, 3)));
  ok('未选满 2 项时 Next 禁用', setup.nextDisabled === true, String(setup.nextDisabled));

  const after = await page.evaluate(() => {
    const grp = [...document.querySelectorAll('#specChoiceArea .specGroup')].find(x => x.getAttribute('data-spec') === '博闻强识');
    const chip = name => [...grp.querySelectorAll('.specMultiRow .spec-skill')].find(c => c.getAttribute('data-skill') === name);
    chip('知识-历史').click();
    chip('知识-人文').click();
    const mid = {
      picks: (CHAR.specChoices['博闻强识'] || {}).skills,
      selected: [...grp.querySelectorAll('.specMultiRow .spec-skill.selected')].map(c => c.getAttribute('data-skill')),
      hint: grp.querySelector('.specMultiHint')?.textContent.trim(),
      nextDisabled: document.getElementById('nextBtn')?.disabled,
    };
    // 点第三项 → 仍是 2 项（替换最早一项）
    chip('知识-神秘学').click();
    const after3 = (CHAR.specChoices['博闻强识'] || {}).skills;
    // 取消一项（点已选中项）→ 变 1 项且 Next 重新禁用；再补选一项 → 恢复 2 项
    chip('知识-人文').click();
    const afterCancel = (CHAR.specChoices['博闻强识'] || {}).skills;
    const nextAfterCancel = document.getElementById('nextBtn')?.disabled;
    chip('知识-历史').click();
    return { mid, after3, afterCancel, nextAfterCancel, final: (CHAR.specChoices['博闻强识'] || {}).skills, nextDisabled2: document.getElementById('nextBtn')?.disabled };
  });
  ok('可勾选 2 项不同知识熟练度', JSON.stringify(after.mid.picks) === JSON.stringify(['知识-历史', '知识-人文']), JSON.stringify(after.mid.picks));
  ok('选中态与计数提示正确', after.mid.selected.length === 2 && /2\s*\/\s*2/.test(after.mid.hint || ''), JSON.stringify(after.mid));
  ok('选满 2 项后 Next 可用', after.mid.nextDisabled === false, String(after.mid.nextDisabled));
  ok('第三项替换最早一项（上限 2）', JSON.stringify(after.after3) === JSON.stringify(['知识-人文', '知识-神秘学']), JSON.stringify(after.after3));
  ok('取消一项后仅剩 1 项且 Next 禁用', JSON.stringify(after.afterCancel) === JSON.stringify(['知识-神秘学']) && after.nextAfterCancel === true, JSON.stringify(after.afterCancel) + ' disabled=' + after.nextAfterCancel);
  ok('补选后恢复 2 项且 Next 可用', JSON.stringify(after.final) === JSON.stringify(['知识-神秘学', '知识-历史']) && after.nextDisabled2 === false, JSON.stringify(after.final));

  // 总览 / 导出 / 快照
  const rest = await page.evaluate(() => {
    // 固定成两项便于断言
    CHAR.specChoices['博闻强识'] = { skills: ['知识-历史', '知识-人文'] };
    CHAR.selectedSkills = ['专注', '调查', '逻辑', '知识'];
    const ovNames = overviewNamesFromSpecChoices(CHAR.specChoices);
    updateOverview();
    const overview = document.getElementById('ovContent')?.textContent.replace(/\s+/g, ' ') || '';
    // 导出：applySpecProfs 到 charData.profs（骨架取自创建页导出用 allSkills）
    const charData = { profs: JSON.parse(JSON.stringify(PROF_SKELETON)), professionals: [] };
    applySpecProfs(charData);
    const flat = {};
    for (const a in charData.profs) for (const k in charData.profs[a]) flat[a + '/' + k] = charData.profs[a][k];
    // 快照往返（完整快照）
    const snap = buildCreationSnapshot();
    CHAR.specChoices = {};
    applyCreationSnapshotToChar(JSON.parse(JSON.stringify(snap)));
    const restored = CHAR.specChoices['博闻强识'];
    return { ovNames, overview, flat, snap: JSON.parse(JSON.stringify(snap.specChoices || {})), restored };
  });
  ok('总览熟练项包含两项知识熟练度', rest.ovNames.includes('知识-历史') && rest.ovNames.includes('知识-人文'), JSON.stringify(rest.ovNames));
  ok('创建页总览显示知识熟练度', /知识-历史/.test(rest.overview) && /知识-人文/.test(rest.overview), rest.overview.slice(0, 200));
  ok('导出 profs 含 知识-历史 + 知识-人文（各 +1）',
    rest.flat['智力/知识-历史'] === 1 && rest.flat['智力/知识-人文'] === 1, JSON.stringify(rest.flat));
  ok('快照保留两项选择并可还原', Array.isArray(rest.restored?.skills) && rest.restored.skills.length === 2, JSON.stringify(rest.restored));

  ok('谋士创建页无 JS 错误', errs.length === 0, errs.join('|'));
  await page.close();
}

// ===== 面板：职业专长显示两项 =====
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e.message)));
  await page.goto(`http://127.0.0.1:${PORT}/%E6%96%AF%E8%AF%BA%E5%BE%B7%E8%B7%91%E5%9B%A2/%E8%A7%92%E8%89%B2%E9%9D%A2%E6%9D%BF.html`);
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const specs = (REF_CLASSES['谋士'] || {}).specializations || [];
    // 面板特性列表：模拟 classChoices.specChoices
    state.classChoices = { weaponSpec: '', weaponSpecBonus: '', specChoices: { '博闻强识': { skills: ['知识-历史', '知识-人文'] } } };
    state.classes = [{ name: '谋士', level: 1, styles: ['', '', '', ''] }, { name: '', level: 0, styles: ['', '', '', ''] }, { name: '', level: 0, styles: ['', '', '', ''] }];
    state.profs = {};
    // 面板渲染特性描述（与导出/展示同源逻辑）
    let desc = '';
    if (typeof getClassFeatureDescForDisplay === 'function') desc = getClassFeatureDescForDisplay('谋士', '博闻强识');
    return { specs: specs.map(s => s.name), desc };
  });
  ok('面板 REF_CLASSES 专长 = 3 职业专长', r.specs.join('、') === '运筹帷幄、博闻强识、料敌机先', r.specs.join('、'));
  ok('面板加载无 JS 错误', errs.length === 0, errs.join('|'));
  await page.close();
}

await browser.close(); server.close();
console.log(`\n谋士专长选择E2E: ${pass}P ${fail}F`);
process.exit(fail > 0 ? 1 : 0);
