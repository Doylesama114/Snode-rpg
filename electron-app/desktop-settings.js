'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SCENES = ['launcher', 'chargen', 'picker'];
function defaults() { return { version: 1, revision: 0, onboardingEnabled: true, advisorAutoTipsEnabled: false, onboardingSeen: {}, lastAdvisorTipAt: 0 }; }
function normalize(value) {
  if (value === undefined) return defaults();
  if (!value || value.version !== 1 || typeof value.onboardingEnabled !== 'boolean' || typeof value.advisorAutoTipsEnabled !== 'boolean') throw new Error('提示设置格式不兼容，原文件已保留');
  const out = { ...defaults(), ...value, onboardingSeen: {} };
  if (value.onboardingSeen) for (const scene of SCENES) {
    if (['shown','done','skipped'].includes(value.onboardingSeen[scene])) out.onboardingSeen[scene] = value.onboardingSeen[scene];
  }
  out.revision = Number.isSafeInteger(value.revision) && value.revision >= 0 ? value.revision : 0;
  out.lastAdvisorTipAt = Number.isFinite(value.lastAdvisorTipAt) && value.lastAdvisorTipAt >= 0 ? value.lastAdvisorTipAt : 0;
  return out;
}
class DesktopSettings {
  constructor(file) { this.file = file; }
  read() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('设置文件格式无效');
      return data;
    } catch (e) { if (e.code === 'ENOENT') return {}; throw e; }
  }
  patchRoot(patch) {
    const data = { ...this.read(), ...patch };
    const temp = this.file + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    let fd;
    try {
      fd = fs.openSync(temp, 'wx', 0o600);
      fs.writeFileSync(fd, JSON.stringify(data, null, 2), 'utf8'); fs.fsyncSync(fd);
      fs.closeSync(fd); fd = undefined; fs.renameSync(temp, this.file);
    } finally { if (fd !== undefined) fs.closeSync(fd); if (fs.existsSync(temp)) fs.unlinkSync(temp); }
    return data;
  }
  preferences(legacySeen) {
    const data = this.read();
    if (data.promptPreferences !== undefined) return normalize(data.promptPreferences);
    const prefs = defaults();
    if (legacySeen && typeof legacySeen === 'object') for (const scene of SCENES) {
      if (['done','skipped','shown'].includes(legacySeen[scene])) prefs.onboardingSeen[scene] = legacySeen[scene];
    }
    this.patchRoot({ promptPreferences: prefs });
    return prefs;
  }
  update(operation) {
    const prefs = this.preferences();
    const result = operation(prefs);
    if (result === false) return { ok: true, claimed: false, preferences: prefs };
    prefs.revision++;
    this.patchRoot({ promptPreferences: prefs });
    return { ok: true, preferences: prefs, claimed: true };
  }
  switches(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('开关参数无效');
    for (const [key, value] of Object.entries(patch)) {
      if (!['onboardingEnabled','advisorAutoTipsEnabled'].includes(key) || typeof value !== 'boolean') throw new Error('开关参数无效');
    }
    return this.update(prefs => Object.assign(prefs, patch));
  }
  seen(scene, status = 'shown') {
    if (!SCENES.includes(scene) || !['shown','done','skipped'].includes(status)) throw new Error('引导场景无效');
    return this.update(prefs => {
      if (status === 'shown' && (!prefs.onboardingEnabled || prefs.onboardingSeen[scene])) return false;
      prefs.onboardingSeen[scene] = status;
    });
  }
  claimTip() {
    return this.update(prefs => {
      if (!prefs.advisorAutoTipsEnabled || Date.now() - prefs.lastAdvisorTipAt < 300000) return false;
      prefs.lastAdvisorTipAt = Date.now();
    });
  }
}
module.exports = { DesktopSettings, defaults, normalize };
