#!/usr/bin/env node
// Launch the actual packaged app in hidden mode and exercise its renderer/CLI.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binary = process.argv[2];
if (!binary) throw new Error('Usage: node scripts/smoke-desktop.mjs <app-binary> [app-directory]');
const dist = path.join(ROOT, 'electron-app', 'dist', 'mac');
fs.mkdirSync(dist, { recursive: true });
const userData = fs.mkdtempSync(path.join(dist, 'smoke-'));
const env = { ...process.env, SNODE_CLI_TEST: '1', SNODE_CLI_TEST_USER_DATA: userData };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(path.resolve(binary), process.argv.slice(3),
  { cwd: ROOT, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
child.stdout.on('data', data => { log = (log + data.toString()).slice(-12000); });
child.stderr.on('data', data => { log = (log + data.toString()).slice(-12000); });
let launchError;
child.on('error', error => { launchError = error; });

function call(connection, input) {
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port: connection.port,
      path: '/v1/call', method: 'POST', timeout: 15000,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + connection.token } }, response => {
      const chunks = [];
      response.on('data', data => chunks.push(data));
      response.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (error) { reject(error); }
      });
    });
    request.on('error', reject);
    request.on('timeout', () => request.destroy(new Error('Renderer/CLI request timed out')));
    request.end(JSON.stringify(input));
  });
}

try {
  const connectionPath = path.join(userData, 'chargen-cli-connection.json');
  let connection;
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    if (child.exitCode !== null) throw new Error('Application exited during startup');
    if (fs.existsSync(connectionPath)) {
      try { connection = JSON.parse(fs.readFileSync(connectionPath, 'utf8')); } catch { /* still writing */ }
      if (connection) break;
    }
    await delay(200);
  }
  if (!connection) throw new Error('Application did not start its CLI server');
  for (const input of [{ op: 'flow' }, { op: 'character-list' }]) {
    const result = await call(connection, input);
    if (!result.ok) throw new Error('Renderer/CLI failed: ' + JSON.stringify(result));
    console.log(`[smoke] ${input.op}: passed`);
  }
  console.log('[smoke] Actual Electron startup and character renderer passed.');
} catch (error) {
  // Do not print the connection file: it contains the local authentication token.
  console.error(log);
  throw error;
} finally {
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill();
  await Promise.race([exited, delay(5000)]);
}
