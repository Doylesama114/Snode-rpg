'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { BrowserWindow, app } = require('electron');

const API_VERSION = 1;
const MAX_BODY = 4 * 1024 * 1024;
const CREATION_PAGE = path.join(__dirname, '斯诺德跑团', '角色创建页.html');
const CLASS_PAGES = path.join(__dirname, '职业页');
const CONNECTION_FILE = 'chargen-cli-connection.json';
const DRAFT_FILE = 'chargen-cli-drafts.json';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function merge(base, patch) {
  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    result[key] = isObject(value) && isObject(base[key]) ? merge(base[key], value) : value;
  }
  return result;
}

function readDrafts(file) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return isObject(value) ? value : {};
  } catch (_) { return {}; }
}

function saveDrafts(file, drafts) {
  const temp = file + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(drafts, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, file);
}

async function inCreationPage(request, isolated) {
  const webPreferences = { nodeIntegration: false, contextIsolation: true };
  if (isolated) webPreferences.partition = 'chargen-cli-' + crypto.randomUUID();
  const window = new BrowserWindow({ show: false, skipTaskbar: true, webPreferences });
  try {
    await window.loadFile(CREATION_PAGE, { query: { cli: '1' } });
    return await window.webContents.executeJavaScript(
      'window.snowdChargenCli.call(' + JSON.stringify(request) + ')', true
    );
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
}

async function fullClassPreview(name, includeSource, requestedPart) {
  const pages = [];
  const parts = requestedPart ? [requestedPart] : ['skills', 'advancement'];
  for (const part of parts) {
    const file = path.join(CLASS_PAGES, name + (part === 'advancement' ? '·进阶' : '') + '.html');
    if (!fs.existsSync(file)) {
      pages.push({ part, available: false });
      continue;
    }
    const window = new BrowserWindow({ show: false, skipTaskbar: true, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    try {
      await window.loadFile(file);
      const content = await window.webContents.executeJavaScript(`(() => {
        const body = document.body.cloneNode(true);
        body.querySelectorAll('script,style,noscript').forEach(node => node.remove());
        return {
          title: document.title,
          renderedText: document.body.innerText,
          allText: body.textContent.replace(/\\s+/g, ' ').trim(),
          headings: Array.from(document.querySelectorAll('h1,h2,h3,h4')).map(node => ({ level: node.tagName, text: node.textContent.trim() })),
          skills: Array.from(document.querySelectorAll('article.skill')).map(article => {
            const detail = article.querySelector('template.skill-body,.detail');
            const detailNode = detail && detail.content ? detail.content : detail;
            const searchText = article.dataset.search || '';
            return {
              id: article.id,
              name: (article.querySelector('h4') || {}).textContent?.trim() || '',
              tier: article.dataset.tier || '',
              style: article.dataset.style || '',
              type: article.dataset.type || '',
              tags: (article.dataset.tags || '').split(',').filter(Boolean),
              searchText,
              detailText: detailNode ? detailNode.textContent.replace(/\\s+/g, ' ').trim() : searchText,
              detailHtml: detail ? detail.innerHTML : article.innerHTML
            };
          }),
          hiddenTemplates: Array.from(document.querySelectorAll('template:not(.skill-body)')).map(template => ({
            id: template.id || '',
            className: template.className || '',
            text: template.content.textContent.replace(/\\s+/g, ' ').trim(),
            html: template.innerHTML
          }))
        };
      })()`, true);
      pages.push({ part, available: true, ...content, ...(includeSource ? { sourceHtml: fs.readFileSync(file, 'utf8') } : {}) });
    } finally {
      if (!window.isDestroyed()) window.destroy();
    }
  }
  return pages;
}

function refreshCharacterViews(mainWindow) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.executeJavaScript(`(() => {
    window.dispatchEvent(new CustomEvent('snowd-characters-changed'));
    if (/角色选择页\\.html|角色存档页\\.html/.test(location.pathname)) location.reload();
  })()`).catch(() => {});
}

function startChargenCliServer(mainWindow) {
  const userData = app.getPath('userData');
  const connectionDir = process.env.SNODE_CLI_TEST_USER_DATA || path.join(app.getPath('appData'), 'snode-rpg-cli');
  const connectionPath = path.join(connectionDir, CONNECTION_FILE);
  const draftPath = path.join(userData, DRAFT_FILE);
  const drafts = readDrafts(draftPath);
  const token = crypto.randomBytes(32).toString('hex');
  let queue = Promise.resolve();

  async function dispatch(input) {
    const op = input && input.op;
    if (op === 'ping') return { apiVersion: API_VERSION, appName: app.getName() };
    if (op === 'draft-new') {
      const id = crypto.randomUUID();
      drafts[id] = { id, spec: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      saveDrafts(draftPath, drafts);
      return drafts[id];
    }
    if (op === 'draft-get') {
      if (!drafts[input.id]) throw new Error('草稿不存在：' + input.id);
      return drafts[input.id];
    }
    if (op === 'draft-patch') {
      if (!drafts[input.id]) throw new Error('草稿不存在：' + input.id);
      if (!isObject(input.patch)) throw new Error('patch 必须是 JSON 对象');
      drafts[input.id].spec = merge(drafts[input.id].spec, input.patch);
      drafts[input.id].updatedAt = new Date().toISOString();
      saveDrafts(draftPath, drafts);
      return drafts[input.id];
    }

    if (op === 'catalog' && input.type === 'classSkills') {
      await inCreationPage({ op: 'show', type: 'class', name: input.className }, true);
      const page = (await fullClassPreview(input.className, false, 'skills'))[0];
      if (!page.available) throw new Error('职业技能页不存在：' + input.className);
      return { type: 'classSkills', className: input.className, entries: page.skills.map(({ id, name, tier, style, type, tags }) => ({ id, name, tier, style, type, tags })), source: '职业页/' + input.className + '.html' };
    }
    if (op === 'show-skill') {
      await inCreationPage({ op: 'show', type: 'class', name: input.className }, true);
      const page = (await fullClassPreview(input.className, false, 'skills'))[0];
      const matches = page.skills.filter(skill => skill.id === input.name || skill.name === input.name || skill.name.startsWith(input.name + ' '));
      if (!matches.length) throw new Error('未找到职业技能：' + input.className + ':' + input.name);
      return { className: input.className, query: input.name, matches, source: '职业页/' + input.className + '.html' };
    }
    if (['flow', 'catalog', 'show', 'rules'].includes(op)) {
      const result = await inCreationPage(input, true);
      if (op === 'show' && input.type === 'class' && input.full) {
        result.fullPreview = await fullClassPreview(input.name, !!input.includeSource, input.part);
      }
      return result;
    }
    if (['options', 'preview', 'validate', 'commit'].includes(op)) {
      const draft = drafts[input.id];
      if (!draft) throw new Error('草稿不存在：' + input.id);
      if (op === 'options') return inCreationPage({ op, spec: draft.spec, step: input.step }, true);
      if (op === 'preview') return inCreationPage({ op, spec: draft.spec }, true);
      const checked = await inCreationPage({ op: 'save', spec: draft.spec }, true);
      if (op === 'validate') return { ok: checked.ok, errors: checked.errors || [], preview: checked.ok ? checked.character : null };
      if (!checked.ok) return { ok: false, errors: checked.errors || [] };
      const created = await inCreationPage({ op: 'save', spec: draft.spec }, false);
      if (created.ok) refreshCharacterViews(mainWindow);
      return created;
    }
    if (op === 'character-list') return inCreationPage({ op: 'characters', action: 'list' }, false);
    if (op === 'character-get') return inCreationPage({ op: 'characters', action: 'get', id: input.id, slot: input.slot }, false);
    if (op === 'character-delete') {
      const deleted = await inCreationPage({ op: 'characters', action: 'delete', id: input.id, slot: input.slot }, false);
      refreshCharacterViews(mainWindow);
      return deleted;
    }
    if (op === 'character-update') {
      const draft = drafts[input.draftId];
      if (!draft) throw new Error('草稿不存在：' + input.draftId);
      const checked = await inCreationPage({ op: 'save', spec: draft.spec }, true);
      if (!checked.ok) return { ok: false, errors: checked.errors || [] };
      const updated = await inCreationPage({ op: 'characters', action: 'update', id: input.id, slot: input.slot, value: checked.character }, false);
      refreshCharacterViews(mainWindow);
      return updated;
    }
    throw new Error('未知操作：' + op);
  }

  const server = http.createServer((request, response) => {
    function reply(status, value) {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(value));
    }
    if (request.method !== 'POST' || request.url !== '/v1/call') return reply(404, { ok: false, error: 'Not found' });
    if (request.headers.authorization !== 'Bearer ' + token) return reply(401, { ok: false, error: 'Unauthorized' });
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) request.destroy();
      else chunks.push(chunk);
    });
    request.on('end', () => {
      let input;
      try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch (_) { return reply(400, { ok: false, error: 'Invalid JSON' }); }
      const next = queue.then(() => dispatch(input));
      queue = next.catch(() => {});
      next.then(value => reply(200, { ok: true, value })).catch(error => reply(400, { ok: false, error: error.message }));
    });
  });
  server.listen(0, '127.0.0.1', () => {
    fs.mkdirSync(connectionDir, { recursive: true });
    fs.writeFileSync(connectionPath, JSON.stringify({ apiVersion: API_VERSION, port: server.address().port, token, pid: process.pid }), { encoding: 'utf8', mode: 0o600 });
  });
  server.on('error', error => console.error('[chargen-cli] server error:', error));
  app.on('before-quit', () => {
    server.close();
    try {
      const current = JSON.parse(fs.readFileSync(connectionPath, 'utf8'));
      if (current.token === token) fs.unlinkSync(connectionPath);
    } catch (_) {}
  });
  return server;
}

module.exports = { startChargenCliServer };
