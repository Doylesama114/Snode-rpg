/**
 * 从 OSS 拉取用户 👍/👎 反馈到 advisor/feedback/inbox/，并生成汇总报告。
 *
 * 用法（需要环境变量 ALIYUN_OSS_ACCESS_KEY_ID / ALIYUN_OSS_ACCESS_KEY_SECRET /
 *       ALIYUN_OSS_BUCKET / ALIYUN_OSS_ENDPOINT）：
 *   node scripts/advisor-feedback-pull.mjs            # 拉取 + 报告
 *   node scripts/advisor-feedback-pull.mjs --dry-run  # 只列远端对象
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ossList, ossGet, getOssCreds } from './oss-client.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INBOX = path.join(ROOT, 'advisor', 'feedback', 'inbox');
const REPORT = path.join(ROOT, 'advisor', 'feedback', 'reports', 'feedback-report.md');
const PREFIX = 'advisor-feedback/inbox/';

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    report: (() => {
      const i = argv.indexOf('--report');
      return i >= 0 ? path.resolve(ROOT, argv[i + 1]) : REPORT;
    })(),
  };
}

function truncate(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const creds = getOssCreds();
  if (!creds.id || !creds.secret || !creds.bucket) {
    console.error('缺少 OSS 环境变量（ALIYUN_OSS_ACCESS_KEY_ID / ALIYUN_OSS_ACCESS_KEY_SECRET / ALIYUN_OSS_BUCKET）');
    process.exit(1);
  }

  const keys = await ossList(PREFIX, { creds });
  console.log(`远端反馈对象: ${keys.length}`);
  if (opts.dryRun) {
    for (const k of keys.slice(0, 50)) console.log('  ', k);
    return;
  }

  fs.mkdirSync(INBOX, { recursive: true });
  const existing = new Set(fs.readdirSync(INBOX).filter((f) => f.endsWith('.json')));
  let downloaded = 0;
  const raw = [];
  for (const key of keys) {
    const name = key.split('/').pop();
    if (existing.has(name)) {
      raw.push(JSON.parse(fs.readFileSync(path.join(INBOX, name), 'utf8')));
      continue;
    }
    try {
      const text = await ossGet(key, { creds });
      const obj = JSON.parse(text);
      fs.writeFileSync(path.join(INBOX, name), `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
      raw.push(obj);
      downloaded += 1;
    } catch (e) {
      console.warn(`跳过 ${key}: ${e.message}`);
    }
  }

  // 统计
  const byIntent = new Map();
  const byProfile = new Map();
  let up = 0;
  let down = 0;
  const downList = [];
  for (const f of raw) {
    const rating = f.rating === 'up' ? 'up' : 'down';
    if (rating === 'up') up += 1;
    else down += 1;
    const intent = f.intent || 'unknown';
    const profile = f.profile || f.mode || 'unknown';
    byIntent.set(intent, (byIntent.get(intent) || 0) + 1);
    byProfile.set(profile, (byProfile.get(profile) || 0) + 1);
    if (rating === 'down') {
      downList.push(f);
    }
  }
  downList.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  const rows = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `| ${k} | ${v} |`).join('\n');

  const latestTs = raw.length
    ? new Date(Math.max(...raw.map((f) => {
        const v = f.ts || f.receivedAt || 0;
        return typeof v === 'number' ? v : (new Date(v).getTime() || 0);
      }))).toISOString()
    : '暂无数据';
  const md = [
    '# AI 顾问反馈汇总',
    '',
    `数据截止：${latestTs}`,
    '',
    `| 指标 | 数量 |`,
    `|---|---|`,
    `| 总反馈 | ${raw.length} |`,
    `| 👍 有用 | ${up} |`,
    `| 👎 没用 | ${down} |`,
    `| 本次新拉取 | ${downloaded} |`,
    '',
    '## 按意图分布',
    '',
    '| 意图 | 数量 |',
    '|---|---|',
    rows(byIntent) || '（无）',
    '',
    '## 按回答模板分布',
    '',
    '| 模板 | 数量 |',
    '|---|---|',
    rows(byProfile) || '（无）',
    '',
    '## 👎 差评明细（按时间倒序）',
    '',
  ];
  if (!downList.length) {
    md.push('（暂无差评）');
  }
  for (const f of downList.slice(0, 50)) {
    const ts = new Date(f.ts || Date.now()).toISOString();
    md.push(`### ${truncate(f.query, 60)}`);
    md.push(`- 时间：${ts}｜意图：${f.intent || 'unknown'}｜模板：${f.profile || f.mode || 'unknown'}｜来源：${f.source || 'unknown'}`);
    md.push(`- 问题：${truncate(f.query, 300)}`);
    md.push(`- 回答：${truncate(f.answer, 500)}`);
    md.push('');
  }
  md.push('> 说明：👎 差评适合人工转成 golden 评测用例（query + expectIntent + mustInclude），参考 advisor/feedback/templates/。');

  fs.mkdirSync(path.dirname(opts.report), { recursive: true });
  fs.writeFileSync(opts.report, md.join('\n'), 'utf8');
  console.log(`新拉取: ${downloaded}，总计: ${raw.length}（👍${up} / 👎${down}）`);
  console.log(`报告: ${path.relative(ROOT, opts.report)}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
