// 健壮专长 HP 加成 E2E：面板真实获得路径 + 分级生效 + 多职业快照
import { chromium } from 'playwright';

const ROOT = process.cwd();
const URL = 'file:///' + ROOT.replace(/\\/g, '/') + '/' + encodeURI('斯诺德跑团/角色面板.html');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  PASS ' + n + (x ? '  ' + x : '')); } else { fail++; console.log('  FAIL ' + n + (x ? '  ' + x : '')); } };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e.message).slice(0, 70)));
await page.goto(URL + '?v=' + Date.now(), { waitUntil: 'load' });
await page.waitForTimeout(2200);

const r = await page.evaluate(() => {
  const S = window.SNOWD_CHARACTER_STATS;
  const out = { errors: [] };
  function reset(lv) {
    state.classes = [{ name: '战舞者', level: lv, keyAttr: '力量' }];
    state.attrs = { '力量': 16, '敏捷': 10, '体质': 14, '智力': 10, '感知': 10, '魅力': 10 };
    state.race = '';  // 种族/背景留空：computed 只校验职业与等级，避免依赖具体族群数据
    state.background = '';
    state.special_feats = [];
    state.equipment = {};
    window._pendingLevelUp = null;
  }
  function deltaAt(lv) {
    state.classes[0].level = lv;
    const withFeat = S.computed(state).hp;
    const clone = JSON.parse(JSON.stringify(state));
    clone.special_feats = [];
    const noFeat = S.computed(clone).hp;
    return withFeat - noFeat;
  }

  /* 1) 4 级获得健壮（无 pendingLevelUp） */
  reset(4);
  addSpecialFeat('健壮', {});
  const e1 = state.special_feats[0] || {};
  out.entry1 = { level: e1.level, pickTotal: e1.pickTotal, clsIdx: e1.clsIdx };
  out.d4 = deltaAt(4);
  out.d5 = deltaAt(5);
  out.d20 = deltaAt(20);

  /* 2) 带 pendingLevelUp 的路径（升到 5 级时选） */
  reset(4);
  window._pendingLevelUp = { clsIdx: 0, level: 5, _done: {} };
  addSpecialFeat('健壮', {});
  const e2 = state.special_feats[0] || {};
  out.entry2 = { level: e2.level, pickTotal: e2.pickTotal, clsIdx: e2.clsIdx };
  window._pendingLevelUp = null;
  out.p5at5 = deltaAt(5);
  out.p5at20 = deltaAt(20);

  /* 3) 移除后归零 */
  reset(10);
  addSpecialFeat('健壮', {});
  const before = deltaAt(10);
  state.special_feats = [];
  const after = deltaAt(10);
  out.removeBefore = before;
  out.removeAfter = after;

  /* 4) 健美教练固定 +10 */
  reset(20);
  addSpecialFeat('健美教练', { attr: '体质' });
  out.jm20 = deltaAt(20);
  out.jm4 = deltaAt(4);
  return out;
});

ok('健壮条目带 pickTotal 快照（4 级）', r.entry1.pickTotal === 4, JSON.stringify(r.entry1));
ok('4 级选健壮 → HP +2（旧算法 +8）', r.d4 === 2, 'delta=' + r.d4);
ok('5 级 → +4', r.d5 === 4, 'delta=' + r.d5);
ok('20 级 → +34（旧算法 +40）', r.d20 === 34, 'delta=' + r.d20);
ok('升 5 级时选择 → pickTotal=5', r.entry2.pickTotal === 5, JSON.stringify(r.entry2));
ok('选择于 5 级 · 5 级 → +2', r.p5at5 === 2, 'delta=' + r.p5at5);
ok('选择于 5 级 · 20 级 → +32', r.p5at20 === 32, 'delta=' + r.p5at20);
ok('移除健壮前有加成', r.removeBefore > 0, 'before=' + r.removeBefore);
ok('移除健壮后加成归零', r.removeAfter === 0, 'after=' + r.removeAfter);
ok('健美教练 20 级固定 +10', r.jm20 === 10, 'delta=' + r.jm20);
ok('健美教练 4 级同样 +10', r.jm4 === 10, 'delta=' + r.jm4);
ok('面板无 JS 错误', errs.length === 0, JSON.stringify(errs.slice(0, 2)));
await browser.close();
console.log('');
console.log('面板健壮 E2E: ' + pass + 'P ' + fail + 'F');
process.exit(fail === 0 ? 0 : 1);
