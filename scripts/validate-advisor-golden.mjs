#!/usr/bin/env node
/**
 * Advisor 4.0 — golden conversation regression (plan + retrieve + context; no LLM).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { planFromRules } from './advisor-planner.mjs';
import { retrieve, formatContext } from './advisor-retrieve.mjs';
import { enrichPlannerContext } from './advisor-session.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = path.join(__dirname, '..', 'advisor', 'golden', 'conversations.json');

let failed = 0;

function check(label, ok, detail) {
  if (ok) console.log(`✓ ${label}`);
  else {
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
console.log('=== validate-advisor-golden ===\n');

for (const c of golden.cases || []) {
  console.log(`--- ${c.id} ---`);
  const history = c.history || [];
  const baseCtx = {
    conversationHistory: history,
    ...(c.ctx || {}),
  };
  const ctx = enrichPlannerContext(c.query, baseCtx);
  const plan = planFromRules(c.query, ctx);
  const retrieval = retrieve(c.query, { plan, goalOverride: ctx.goalOverride || null });
  const context = formatContext(retrieval);

  if (c.expectIntent) {
    check(`${c.id} intent`, retrieval.intent === c.expectIntent, `got ${retrieval.intent}`);
  }
  if (c.expectMainClass) {
    const mainFromPlan = plan?.tasks?.[0]?.mainClass;
    const mainFromRoadmap = retrieval.results._roadmap?.goal?.mainClass;
    check(
      `${c.id} mainClass`,
      mainFromPlan === c.expectMainClass || mainFromRoadmap === c.expectMainClass,
      `plan=${mainFromPlan} roadmap=${mainFromRoadmap}`,
    );
  }
  if (c.expectAdvancement) {
    const adv = plan?.tasks?.[0]?.advancementName
      || retrieval.results._roadmap?.goal?.advancementName;
    check(`${c.id} advancement`, adv === c.expectAdvancement, `got ${adv}`);
  }
  for (const needle of c.mustInclude || []) {
    check(`${c.id} includes「${needle}」`, context.includes(needle));
  }
  for (const needle of c.mustNotInclude || []) {
    check(`${c.id} excludes「${needle}」`, !context.includes(needle));
  }
  console.log('');
}

console.log(`${failed ? 'FAILED' : 'OK'} (${failed} failures)`);
process.exit(failed ? 1 : 0);
