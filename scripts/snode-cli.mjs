#!/usr/bin/env node
/** Local command-line client for the running Snode desktop application. */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const HELP = `Snode character creation CLI (JSON output)

The Snode desktop app must be running.

  snode chargen flow
  snode chargen catalog <type> [--class <name>]
  snode chargen catalog classSkills --class <name>
  snode chargen show <class|race|background|feature> <name> [--full] [--part skills|advancement] [--include-source]
  snode chargen show skill <class> <name-or-id>
  snode chargen rules [topic]
  snode chargen draft new
  snode chargen draft get <id>
  snode chargen draft patch <id> --input <patch.json>
  snode chargen options <draft-id> --step <0-7>
  snode chargen preview <draft-id>
  snode chargen validate <draft-id>
  snode chargen commit <draft-id>
  snode character list
  snode character get <id> [--slot 1]
  snode character update <id> --draft <draft-id> [--slot 1]
  snode character delete <id> --yes [--slot 1]  (default: all slots)

Options: --connection <path> overrides SNODE_CLI_CONNECTION and the default app data path.
Every command prints one JSON document. Errors use a nonzero exit code.`;

function jsonForConsole(value) {
  // Windows PowerShell 5.1 may decode native stdout as GBK even though Node
  // writes UTF-8. ASCII JSON escapes survive either decoding and round-trip.
  return JSON.stringify(value, null, 2).replace(/[^\x00-\x7f]/g, char =>
    '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
}

function flag(args, name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function parse(args) {
  const [root, command, ...rest] = args;
  if (!root || root === '--help' || root === 'help') return null;
  if (root === 'chargen') {
    if (command === 'flow') return { op: 'flow' };
    if (command === 'catalog') return { op: 'catalog', type: rest[0], className: flag(args, '--class') };
    if (command === 'show') {
      if (rest[0] === 'skill') return { op: 'show-skill', className: rest[1], name: rest[2] };
      const part = flag(args, '--part');
      if (part && !['skills', 'advancement'].includes(part)) throw new Error('--part 只能为 skills 或 advancement');
      return { op: 'show', type: rest[0], name: rest[1], full: args.includes('--full') || !!part, part, includeSource: args.includes('--include-source') };
    }
    if (command === 'rules') return { op: 'rules', topic: rest[0] || 'all' };
    if (command === 'options') return { op: 'options', id: rest[0], step: Number(flag(args, '--step')) };
    if (command === 'preview' || command === 'validate' || command === 'commit') return { op: command, id: rest[0] };
    if (command === 'draft') {
      const [action, id] = rest;
      if (action === 'new') return { op: 'draft-new' };
      if (action === 'get') return { op: 'draft-get', id };
      if (action === 'patch') {
        const input = flag(args, '--input');
        if (!input) throw new Error('draft patch 需要 --input <patch.json>');
        return { op: 'draft-patch', id, patch: JSON.parse(fs.readFileSync(path.resolve(input), 'utf8').replace(/^\uFEFF/, '')) };
      }
    }
  }
  if (root === 'character') {
    const id = rest[0];
    const slot = Number(flag(args, '--slot') || 1);
    if (command === 'list') return { op: 'character-list' };
    if (command === 'get') return { op: 'character-get', id, slot };
    if (command === 'update') return { op: 'character-update', id, slot, draftId: flag(args, '--draft') };
    if (command === 'delete') {
      if (!args.includes('--yes')) throw new Error('删除角色需要 --yes');
      return { op: 'character-delete', id, slot: flag(args, '--slot') ? slot : undefined };
    }
  }
  throw new Error('未知命令；运行 snode --help 查看用法');
}

function connectionFile(args) {
  return flag(args, '--connection') || process.env.SNODE_CLI_CONNECTION ||
    path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'snode-rpg-cli', 'chargen-cli-connection.json');
}

function call(connection, input) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1', port: connection.port, path: '/v1/call', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + connection.token },
      timeout: 120000
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        try {
          const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (!result.ok) reject(new Error(result.error || 'Snode API 调用失败'));
          else resolve(result.value);
        } catch (error) { reject(error); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Snode API 请求超时')));
    request.on('error', reject);
    request.end(JSON.stringify(input));
  });
}

try {
  const args = process.argv.slice(2);
  const input = parse(args);
  if (!input) {
    process.stdout.write(HELP + '\n');
  } else {
    const file = connectionFile(args);
    let connection;
    try { connection = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (_) { throw new Error('未找到运行中的 Snode 桌面应用；连接文件：' + file); }
    if (connection.apiVersion !== 1) throw new Error('Snode CLI API 版本不匹配');
    const value = await call(connection, input);
    process.stdout.write(jsonForConsole(value) + '\n');
  }
} catch (error) {
  process.stderr.write(jsonForConsole({ ok: false, error: error.message }) + '\n');
  process.exitCode = 1;
}
