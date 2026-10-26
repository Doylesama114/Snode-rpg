/**
 * 全自动更新流程（策略 B）验收
 * 覆盖：主进程接线（自动下载/立即安装/进度/脏窗口）、preload API、启动台状态显示、角色面板未保存上报
 * 用法：node verify_update_flow_e2e.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const ROOT = process.cwd().replace(/\\/g, '/');
const URL = (p) => 'file:///' + ROOT + '/' + encodeURI(p);
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); } };
const sec = (t) => console.log('\n▌' + t);

const main = fs.readFileSync('electron-app/main.js', 'utf8');
const preload = fs.readFileSync('electron-app/preload.js', 'utf8');
const launcher = fs.readFileSync('斯诺德跑团/启动台.html', 'utf8');
const engine = fs.readFileSync('斯诺德跑团/panel_engine.js', 'utf8');

sec('① 主进程接线（静态断言）');
ok('autoInstallOnAppQuit = true（退出时安装已下载的包）', /autoInstallOnAppQuit\s*=\s*true/.test(main));
ok('发现新版本后自动下载（不再等用户点下载）', /自动开始下载 v/.test(main) && /autoUpdater\.downloadUpdate\(\)/.test(main));
ok('下载完成后手动检查走立即安装', /if \(manualCheckRequested\) maybeInstallNow\(\);/.test(main));
ok('存在 maybeInstallNow（quitAndInstall）', /function maybeInstallNow/.test(main) && /quitAndInstall\(true, true\)/.test(main));
ok('转发下载进度 download-progress', /autoUpdater\.on\('download-progress'/.test(main));
ok('跟踪未保存窗口 panel-dirty', /ipcMain\.on\('panel-dirty'/.test(main) && /dirtyWindows/.test(main));
ok('未保存时先提示再安装（waiting-save）', /waiting-save/.test(main));
ok('自动检查不自动重启（仅手动检查才立即重启）', !/update-available[\s\S]{0,400}maybeInstallNow/.test(main));

sec('② preload API');
ok('checkUpdate 接受 manual 参数', /checkUpdate:\s*\(manual\)\s*=>\s*ipcRenderer\.send\('check-update',\s*\{\s*manual/.test(preload));
ok('暴露 setPanelDirty', /setPanelDirty:\s*\(flag\)\s*=>\s*ipcRenderer\.send\('panel-dirty'/.test(preload));

sec('③ 启动台：手动标记与状态显示');
ok('检查更新按钮传 manual=true', /checkUpdate\(true\)/.test(launcher));
ok('支持 downloading / installing / waiting-save 三种状态', /'installing'/.test(launcher) && /'waiting-save'/.test(launcher) && /percent/.test(launcher));
{
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.addInitScript(() => localStorage.setItem('_snowd_changelog_seen', '1.0.8003'));
  await p.goto(URL('斯诺德跑团/启动台.html'), { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  const res = await p.evaluate(() => {
    const msg = document.getElementById('updateMsg');
    const out = {};
    showUpdateMsg({ status: 'downloading', version: '9.9.9', percent: 42, message: '' });
    out.downloading = msg.textContent;
    showUpdateMsg({ status: 'installing', version: '9.9.9', message: '' });
    out.installing = msg.textContent;
    showUpdateMsg({ status: 'waiting-save', version: '9.9.9', message: '' });
    out.waiting = msg.textContent;
    showUpdateMsg({ status: 'uptodate' });
    return out;
  });
  ok('下载中显示百分比：' + res.downloading.slice(0, 24), /42/.test(res.downloading), res.downloading);
  ok('安装中提示：' + res.installing.slice(0, 20), /重启安装/.test(res.installing), res.installing);
  ok('待保存提示：' + res.waiting.slice(0, 22), /保存/.test(res.waiting), res.waiting);
  await p.close();
  await b.close();
}

sec('④ 角色面板：未保存状态上报');
ok('engine 定义 reportPanelDirty', /function reportPanelDirty/.test(engine));
ok('autoSave 会置脏', /function autoSave\(\)[\s\S]{0,80}reportPanelDirty\(true\)/.test(engine));
ok('saveState / saveCurrentSlot 会清脏', /state\._dirty = false;\s*\n\s*reportPanelDirty\(false\)/.test(engine));
{
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.addInitScript(() => {
    window.__dirtyCalls = [];
    window.electronAPI = { setPanelDirty: (v) => window.__dirtyCalls.push(!!v) };
    localStorage.setItem('char_测试勇者_slot1', JSON.stringify({ name: '测试勇者' }));
  });
  await p.goto(URL('斯诺德跑团/角色面板.html') + '?char=%E6%B5%8B%E8%AF%95%E5%8B%87%E8%80%85&slot=1', { waitUntil: 'load' });
  await p.waitForTimeout(2200);
  const r = await p.evaluate(() => {
    if (typeof autoSave !== 'function') return { err: 'no autoSave' };
    autoSave();
    const afterDirty = (window.__dirtyCalls || []).slice();
    if (typeof saveState === 'function') saveState(1);   // 真实保存入口（💾 保存按钮走它）
    const afterSave = (window.__dirtyCalls || []).slice();
    return { afterDirty, afterSave };
  });
  ok('编辑触发 setPanelDirty(true)', r.afterDirty && r.afterDirty.indexOf(true) >= 0, JSON.stringify(r.afterDirty));
  ok('保存触发 setPanelDirty(false)', r.afterSave && r.afterSave.indexOf(false) >= 0, JSON.stringify(r.afterSave));
  await p.close();
  await b.close();
}


sec('⑤ 更新链路：镜像优先 / 源回退 / 低速熔断 / 安装校验');
ok('自动检查镜像优先（oss -> github）', /function runAutoUpdateCheck\(\)[\s\S]{0,400}sources:\s*\['oss',\s*'github'\]/.test(main));
ok('存在 tryNextUntriedSource（切到未尝试的源）', /function tryNextUntriedSource\(reason\)/.test(main));
ok('tryNextUntriedSource 会挑出未尝试的源', /tried\.indexOf\(updateSession\.order\[i\]\)\s*<\s*0/.test(main));
ok('useSource 记录已尝试源', /updateSession\.tried\.push\(info\.source\)/.test(main));
ok('error 事件先尝试切源', /autoUpdater\.on\('error'[\s\S]{0,220}if \(tryNextUntriedSource\(/.test(main));
ok('下载失败也会切源', /自动下载失败[\s\S]{0,260}tryNextUntriedSource\(/.test(main));
ok('回退不会来回打转（_fromFallback + mirrorAttempted）', /_fromFallback:\s*true/.test(main) && /mirrorAttempted:\s*!!opts\._fromFallback/.test(main));
ok('低速熔断阈值存在（100 KB/s / 60s / 120s）', /DOWNLOAD_MIN_KBPS\s*=\s*100/.test(main) && /DOWNLOAD_SLOW_AFTER_MS\s*=\s*60000/.test(main) && /DOWNLOAD_STALL_MS\s*=\s*120000/.test(main));
ok('download-progress 会采样并可能中止', /autoUpdater\.on\('download-progress'[\s\S]{0,120}noteDownloadProgress\(p\)/.test(main));
ok('下载使用 CancellationToken（可中止）', /getDownloadToken\(\)/.test(main) && /CancellationToken/.test(main));
ok('本次运行内 10/30 分钟重试', /10 \* 60 \* 1000/.test(main) && /30 \* 60 \* 1000/.test(main) && /scheduleUpdateRetries\(\)/.test(main));
ok('启动后执行安装结果校验', /checkInstallApplied\(\);/.test(main));
ok('安装前写入待安装版本（两处 quitAndInstall）', (main.match(/markInstallAttempt\(pendingUpdate\.version\)/g) || []).length >= 2);
ok('版本没变会报 update-install-not-applied', /updater-install-not-applied/.test(main));
ok('updater 日志保留消息体', /info:\s*\(m\)\s*=>\s*diagnostics\.log\('updater-info',\s*\{\s*msg:/.test(main));
ok('诊断白名单允许 msg/source/percent', /'msg'[\s\S]{0,40}'source'[\s\S]{0,40}'percent'/.test(fs.readFileSync('electron-app/desktop-diagnostics.js', 'utf8')));

console.log('\n' + '─'.repeat(52));
console.log((fail === 0 ? '✅ 全自动更新流程验收通过（策略 B）' : '❌ 存在失败项') + '  ' + pass + 'P / ' + fail + 'F');
process.exit(fail === 0 ? 0 : 1);
