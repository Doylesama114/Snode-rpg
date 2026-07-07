/**
 * Extract A-tier advancement skills from 职业页/advancement_details.js
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DETAILS_PATH = path.join(ROOT, '职业页', 'advancement_details.js');

export function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function loadAdvancementDetails() {
  const code = fs.readFileSync(DETAILS_PATH, 'utf8');
  const ctx = {};
  vm.runInNewContext(code, ctx, { filename: DETAILS_PATH });
  return ctx.ADVANCEMENT_DETAILS || [];
}

function tableToSkills(tables) {
  const out = [];
  for (const tbl of tables || []) {
    if (!tbl?.length) continue;
    const title = tbl[0]?.[0] || '进阶技能';
    const rows = [];
    for (let ri = 1; ri < tbl.length; ri += 1) {
      const row = tbl[ri].filter(Boolean).join(' ');
      if (row) rows.push(stripHtml(row));
    }
    out.push({
      name: stripHtml(title),
      kind: 'table_skill',
      tags: '',
      summary: rows.slice(0, 6).join('\n'),
    });
  }
  return out;
}

export function detailToRecord(d) {
  const talents = [];
  for (const a of d.abilities || []) {
    talents.push({
      name: a.name,
      kind: 'ability',
      tags: a.tags || '',
      summary: stripHtml(a.desc_html || a.desc || ''),
    });
  }
  talents.push(...tableToSkills(d.tables));
  if (d.insight) {
    talents.push({
      name: d.insight.name,
      kind: 'insight',
      tags: d.insight.tags || '',
      summary: stripHtml(d.insight.desc_html || d.insight.desc || ''),
    });
  }
  return {
    name: d.name,
    confidence: 'documented',
    description: stripHtml(d.desc_html || d.description || ''),
    talents,
  };
}

export function buildAdvancementSkillsIndex(nameFilter = null) {
  const details = loadAdvancementDetails();
  const byName = {};
  for (const d of details) {
    if (nameFilter && !nameFilter.has(d.name)) continue;
    byName[d.name] = detailToRecord(d);
  }
  return byName;
}

/** @deprecated use buildAdvancementSkillsIndex(null) for all entries */
export function buildMageAdvancementSkillsIndex(mageNames) {
  return buildAdvancementSkillsIndex(mageNames);
}
