// 回归测试：种族切换时「中庸·自由熟练度」不应残留到其他种族的角色概览
// 运行：node tests/chargen_overview_race.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', '斯诺德跑团', '角色创建页.html'), 'utf8');

function extractFunction(name) {
  const marker = 'function ' + name + '(';
  const at = html.indexOf(marker);
  if (at < 0) throw new Error('function not found: ' + name);
  const start = html.indexOf('{', at + marker.length);
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return html.slice(at, i + 1); }
  }
  throw new Error('unbalanced braces for ' + name);
}

const sandbox = {
  console,
  SPEC_AUTO_PROF: {},
  BG_SKILL_MAP: {},
  resolveProfSkill: () => null,
  overviewNamesFromSpecChoices: () => [],
  CHAR: {
    className: '', selectedSkills: [], specChoices: {}, bgName: '', bgData: null, bgProfs: null,
    raceName: '', raceData: null, humanFreeSkill: null
  },
  document: {
    getElementById: (id) => (id === 'raceDetail' ? { parentNode: { insertBefore() {} } } : null),
    createElement: () => ({ style: {}, className: '', innerHTML: '', id: '' })
  }
};
vm.createContext(sandbox);
vm.runInContext(extractFunction('raceHasTrait'), sandbox);
vm.runInContext(extractFunction('buildOverviewProfLines'), sandbox);
vm.runInContext(extractFunction('showHumanFreeSkill'), sandbox);

let failed = 0;
function check(name, cond) {
  if (cond) console.log('PASS ' + name);
  else { console.error('FAIL ' + name); failed++; }
}
const run = (code) => vm.runInContext(code, sandbox);

// 1) 人类 + 已选「察觉」→ 概览应包含 [人类]察觉
sandbox.CHAR.raceName = '人类';
sandbox.CHAR.raceData = { '特性': [{ name: '中庸' }] };
sandbox.CHAR.humanFreeSkill = '察觉';
let lines = run('buildOverviewProfLines()');
check('人类选择中庸自由熟练度后，概览包含 src=人类 的条目',
  lines.some((l) => l.src === '人类' && l.name === '察觉'));

// 2) 旧草稿：矮人 + 残留 humanFreeSkill → 概览不应再出现 [人类]
sandbox.CHAR.raceName = '矮人';
sandbox.CHAR.raceData = { '特性': [{ name: '黑暗视觉' }, { name: '矮人坚韧' }] };
sandbox.CHAR.humanFreeSkill = '察觉';
lines = run('buildOverviewProfLines()');
check('切换/载入矮人后，概览不再出现 src=人类 的残留条目',
  !lines.some((l) => l.src === '人类'));

// 3) showHumanFreeSkill(非人类种族) 应清空 humanFreeSkill
sandbox.CHAR.humanFreeSkill = '察觉';
run('showHumanFreeSkill(' + JSON.stringify({ '特性': [{ name: '黑暗视觉' }] }) + ')');
check('showHumanFreeSkill(矮人) 会清空 CHAR.humanFreeSkill', sandbox.CHAR.humanFreeSkill === null);

// 4) 静态断言：selectRace 切换种族时会重置种族相关的暂存选择
const selectRaceSrc = extractFunction('selectRace');
check('selectRace 重置 raceSaves/raceSkillChoice/raceProfInput/raceSize/humanFreeSkill',
  selectRaceSrc.includes('CHAR.raceSaves=[]') && selectRaceSrc.includes('CHAR.humanFreeSkill=null'));

console.log(failed === 0 ? '\nALL PASS' : '\nFAILED: ' + failed);
process.exit(failed === 0 ? 0 : 1);
