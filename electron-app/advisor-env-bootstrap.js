/**
 * Load .env into process.env before advisor modules (packaged NSIS/portable + dev).
 */
const fs = require('fs');
const path = require('path');

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

function resolveEnvPaths() {
  const paths = [];
  if (process.env.SNOWD_ENV_FILE) {
    paths.push(path.resolve(process.env.SNOWD_ENV_FILE));
  }
  if (process.resourcesPath) {
    paths.push(path.join(process.resourcesPath, '.env'));
    paths.push(path.join(process.resourcesPath, '..', '.env'));
  }
  if (process.execPath) {
    paths.push(path.join(path.dirname(process.execPath), '.env'));
  }
  try {
    const { app } = require('electron');
    if (app && !app.isReady()) {
      // app.getAppPath works after ready; use __dirname fallback
    }
  } catch (_) { /* not in electron yet */ }
  paths.push(path.join(__dirname, '..', '.env'));
  paths.push(path.join(__dirname, '.env'));

  const seen = new Set();
  return paths.filter((p) => {
    const key = path.resolve(p);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function bootstrapAdvisorEnv() {
  if (process.env.DEEPSEEK_API_KEY) return null;
  for (const envPath of resolveEnvPaths()) {
    if (!fs.existsSync(envPath)) continue;
    const fileVars = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
    for (const [k, v] of Object.entries(fileVars)) {
      if (process.env[k] === undefined || process.env[k] === '') {
        process.env[k] = v;
      }
    }
    process.env.SNOWD_ENV_FILE = envPath;
    return envPath;
  }
  return null;
}

module.exports = { bootstrapAdvisorEnv, resolveEnvPaths };
