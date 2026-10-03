'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class RecoveryStore {
  constructor(directory, options = {}) {
    this.directory = directory;
    this.maxBytes = options.maxBytes || 16 * 1024 * 1024;
    this.maxTotalBytes = options.maxTotalBytes || 128 * 1024 * 1024;
  }
  validateIdentity(identity) {
    if (!identity || !['panel', 'chargen'].includes(identity.module) ||
        typeof identity.character !== 'string' || !identity.character || identity.character.length > 300 ||
        !Number.isInteger(identity.slot) || identity.slot < 0 || identity.slot > 100) throw new Error('恢复草稿标识无效');
    return { module: identity.module, character: identity.character, slot: identity.slot };
  }
  file(identity) {
    const id = this.validateIdentity(identity);
    return path.join(this.directory, crypto.createHash('sha256').update(JSON.stringify(id)).digest('hex') + '.json');
  }
  read(identity) {
    const file = this.file(identity);
    if (!fs.existsSync(file)) return null;
    const draft = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (draft.version !== 1) throw new Error('恢复草稿版本不兼容，原文件已保留');
    if (JSON.stringify(draft.identity) !== JSON.stringify(this.validateIdentity(identity)) ||
        !Number.isSafeInteger(draft.seq) || draft.seq < 1 || !draft.snapshot || typeof draft.snapshot !== 'object' || Array.isArray(draft.snapshot)) {
      throw new Error('恢复草稿损坏，原文件已保留');
    }
    return draft;
  }
  write(identity, snapshot, savedAt) {
    const id = this.validateIdentity(identity);
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('恢复快照格式无效');
    fs.mkdirSync(this.directory, { recursive: true });
    const file = this.file(id);
    const old = this.read(id); // Corruption must not be overwritten by a fresh empty draft.
    const counter = path.join(this.directory, '.sequence');
    let previous = 0;
    if (fs.existsSync(counter)) {
      previous = Number(fs.readFileSync(counter, 'utf8'));
      if (!Number.isSafeInteger(previous) || previous < 0) throw new Error('恢复序号文件损坏，旧草稿已保留');
    }
    const seq = Math.max(previous, old ? old.seq : 0) + 1;
    const draft = { version: 1, identity: id, seq, at: new Date().toISOString(), savedAt: typeof savedAt === 'string' ? savedAt : null, snapshot };
    const bytes = Buffer.from(JSON.stringify(draft));
    if (bytes.length > this.maxBytes) throw new Error('恢复草稿超过容量上限，旧草稿已保留');
    let total = 0;
    for (const entry of fs.readdirSync(this.directory)) {
      if (entry.endsWith('.json')) total += fs.statSync(path.join(this.directory, entry)).size;
    }
    const previousSize = fs.existsSync(file) ? fs.statSync(file).size : 0;
    if (total - previousSize + bytes.length > this.maxTotalBytes) throw new Error('恢复草稿空间已满，请先处理已有草稿');
    const counterFd = fs.openSync(counter + '.tmp', 'w', 0o600);
    try { fs.writeFileSync(counterFd, String(seq), 'utf8'); fs.fsyncSync(counterFd); }
    finally { fs.closeSync(counterFd); }
    fs.renameSync(counter + '.tmp', counter);
    const temp = file + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
    let fd;
    try {
      fd = fs.openSync(temp, 'wx', 0o600);
      fs.writeFileSync(fd, bytes);
      fs.fsyncSync(fd); // ACK follows durable file write + atomic replacement.
      fs.closeSync(fd); fd = undefined;
      fs.renameSync(temp, file);
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
    }
    return { ok: true, seq: draft.seq, at: draft.at };
  }
  clear(identity, expectedSeq) {
    const draft = this.read(identity);
    if (!draft) return { ok: true };
    if (expectedSeq !== undefined && draft.seq !== expectedSeq) throw new Error('草稿已更新，请重新确认');
    fs.unlinkSync(this.file(identity));
    return { ok: true };
  }
  list() {
    if (!fs.existsSync(this.directory)) return [];
    return fs.readdirSync(this.directory).filter(n => n.endsWith('.json')).map(n => {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(this.directory, n), 'utf8'));
        if (d.version !== 1) throw new Error('unknown version');
        this.validateIdentity(d.identity);
        return { identity: d.identity, seq: d.seq, at: d.at };
      } catch (_) { return { damaged: true }; }
    });
  }
}
module.exports = { RecoveryStore };
