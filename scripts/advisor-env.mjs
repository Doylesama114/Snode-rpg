/**
 * Load .env for Build Advisor (dev + packaged portable).
 * Search order: SNOWD_ENV_FILE → resources/scripts/../.env → exe-dir/.env
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

let _loaded = false;
let _loadedFrom = null;

function parseEnvFile(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function resolveEnvPaths() {
  const paths = [];
  if (process.env.SNOWD_ENV_FILE) {
    paths.push(path.resolve(process.env.SNOWD_ENV_FILE));
  }
  paths.push(path.join(ROOT, '.env'));
  if (process.resourcesPath) {
    paths.push(path.join(process.resourcesPath, '.env'));
  }
  if (process.execPath) {
    paths.push(path.join(path.dirname(process.execPath), '.env'));
  }
  const seen = new Set();
  return paths.filter((p) => {
    const key = path.resolve(p);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function loadEnv() {
  if (_loaded) return;
  _loaded = true;
  for (const envPath of resolveEnvPaths()) {
    if (!fs.existsSync(envPath)) continue;
    const fileVars = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
    for (const [k, v] of Object.entries(fileVars)) {
      if (process.env[k] === undefined || process.env[k] === '') {
        process.env[k] = v;
      }
    }
    _loadedFrom = envPath;
    return;
  }
}

export function getAdvisorConfig() {
  loadEnv();
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    temperature: Number(process.env.DEEPSEEK_TEMPERATURE || '0.3'),
    maxTokens: Number(process.env.DEEPSEEK_MAX_TOKENS || '3072'),
    thinkingDefault: process.env.DEEPSEEK_THINKING === '1',
    envLoadedFrom: _loadedFrom,
  };
}

/** @deprecated use resolveEnvPaths */
export const ENV_PATH = path.join(ROOT, '.env');
