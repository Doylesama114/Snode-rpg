/**
 * 从 OSS 拉取用户 Bug 反馈到 advisor/bug/inbox/，并生成汇总报告。
 *
 * 用法（需要环境变量 ALIYUN_OSS_ACCESS_KEY_ID / ALIYUN_OSS_ACCESS_KEY_SECRET /
 *       ALIYUN_OSS_BUCKET / ALIYUN_OSS_ENDPOINT）：
 *   node scripts/advisor-bug-pull.mjs            # 拉取 + 报告
 *   node scripts/advisor-bug-pull.mjs --dry-run  # 只列远端对象
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ossList, ossGet, getOssCreds } from './oss-client.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INBOX = path.join(ROOT, 'advisor', 'bug', 'inbox');
const REPORT = path.join(ROOT, 'advisor', 'bug', 'reports', 'bug-report.md');
const PREFIX = 'advisor-bug/inbox/';

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
  console.log(`远端 Bug 反馈对象: ${keys.length}`);
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

  raw.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const bySource = new Map();
  const byPage = new Map();
  for (const f of raw) {
    const source = f.source || 'unknown';
    bySource.set(source, (bySource.get(source) || 0) + 1);
    const page = String(f.page || 'unknown').split(/[?#]/)[0].slice(0, 60) || 'unknown';
    byPage.set(page, (byPage.get(page) || 0) + 1);
  }

  const rows = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `| ${k} | ${v} |`).join('\n');

  const latestTs = raw.length
    ? new Date(Math.max(...raw.map((f) => {
        const v = f.ts || f.receivedAt || 0;
        return typeof v === 'number' ? v : (new Date(v).getTime() || 0);
      }))).toISOString()
    : '暂无数据';
  const md = [
    '# Bug 反馈汇总',
    '',
    `数据截止：${latestTs}`,
    '',
    `| 指标 | 数量 |`,
    `|---|---|`,
    `| 总反馈 | ${raw.length} |`,
    `| 本次新拉取 | ${downloaded} |`,
    '',
    '## 按来源分布',
    '',
    '| 来源 | 数量 |',
    '|---|---|',
    rows(bySource) || '（无）',
    '',
    '## 按页面分布（Top 20）',
    '',
    '| 页面 | 数量 |',
    '|---|---|',
    rows(byPage) || '（无）',
    '',
    '## 明细（按时间倒序）',
    '',
  ];
  if (!raw.length) {
    md.push('（暂无反馈）');
  }
  for (const f of raw.slice(0, 100)) {
    const ts = new Date(f.ts || Date.now()).toISOString();
    md.push(`### ${ts}｜${f.source || 'unknown'}`);
    md.push(`- 页面：${f.page || 'unknown'}｜标题：${f.title || ''}`);
    md.push('```');
    md.push(String(f.body || '').slice(0, 1200));
    md.push('```');
    md.push('');
  }

  fs.mkdirSync(path.dirname(opts.report), { recursive: true });
  fs.writeFileSync(opts.report, md.join('\n'), 'utf8');
  console.log(`新拉取: ${downloaded}，总计: ${raw.length}`);
  console.log(`报告: ${path.relative(ROOT, opts.report)}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
