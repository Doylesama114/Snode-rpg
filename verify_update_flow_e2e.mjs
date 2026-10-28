/**
 * 全自动更新流程（策略 B）验收
 * 覆盖：主进程接线（自动下载/立即安装/进度/脏窗口）、preload API、启动台状态显示、角色面板未保存上报
 * 用法：node verify_update_flow_e2e.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd().replace(/\\/g, '/');
const URL = (p) => 'file:///' + ROOT + '/' + encodeURI(p);
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (extra ? '  → ' + extra : '')); } };
const sec = (t) => console.log('\n▌' + t);

const main = fs.readFileSync('electron-app/main.js', 'utf8');

sec('⑬ 安装器不再被运行中的应用卡死（接管 customCheckAppRunning）');
const nshSrc = fs.readFileSync('electron-app/installer.nsh', 'utf8');
ok('定义 customCheckAppRunning', /!macro customCheckAppRunning/.test(nshSrc));
ok('按进程名强杀（taskkill /F /T）', /taskkill[^`]*\/F[^`]*\/T/.test(nshSrc));
ok('重试上限 20 次', /\$R9 < 20/.test(nshSrc));
ok('失败时给出可执行提示（任务管理器 / 管理员）', /Task Manager/.test(nshSrc) && /administrator/i.test(nshSrc));
ok('不再用 preInit 把安装目录钉到 D:\\SnodeRPG', !/!macro preInit/.test(nshSrc) && !/D:\\SnodeRPG/.test(nshSrc));
ok('保留旧卸载器迁移桥', /customUnInstallCheck/.test(nshSrc));
ok('不依赖 %USERNAME% 展开（NSIS 不支持）', !/%USERNAME%/.test(nshSrc));
ok('以 taskkill 退出码 128 判定进程已消失', /\$R0 == 128/.test(nshSrc));
ok('杀成功分支存在（$R0 == 0）', /\$R0 == 0/.test(nshSrc));
ok('不再用 tasklist/find 文本解析', !/tasklist/.test(nshSrc) && !/find\.exe/.test(nshSrc));
sec('⑩ 便携版自更新接线（路线 B）');
const portableSrc = fs.readFileSync('electron-app/portable-updater.js', 'utf8');
ok('存在 portable-updater 模块', portableSrc.length > 2000);
ok('main.js 引入模块', /require\('\.\/portable-updater\.js'\)/.test(main));
ok('存在 PORTABLE_MODE 开关（SNODE_UPDATE_MODE=installer 可回退）', /SNODE_UPDATE_MODE/.test(main));
ok('检查更新走便携分支', /if \(PORTABLE_MODE\) return runPortableUpdateCheck\(\)/.test(main));
ok('下载走便携分支', /if \(PORTABLE_MODE\) \{ startPortableDownload\(\); return; \}/.test(main));
ok('安装走便携分支', /applyPortableUpdate\('user-confirm'\)/.test(main));
ok('自动安装也走便携分支', /applyPortableUpdate\('manual-check'\)/.test(main));
ok('清单来自 OSS releases/latest/portable.json', /releases\/latest\/portable\.json/.test(main));
ok('GitHub 回退取 release 资产里的 portable.json', /pickPortableAsset/.test(main));
ok('下载后校验 sha512', /sha512Base64\(zipFile\)/.test(main) && /sha512 校验失败/.test(main));
ok('解压后再替换', /portable\.extractZip\(/.test(main) && /portable\.findExtractRoot\(/.test(main));
ok('替换后 app.exit 保证文件不占用', /setTimeout\(function \(\) \{ app\.exit\(0\); \}, 300\)/.test(main));
ok('模块支持 tar 解压并回退 PowerShell', /tar\.exe/.test(portableSrc) && /Expand-Archive/.test(portableSrc));
ok('替换命令不用 /MIR（不删旧文件）', /\/E \/IS \/IT/.test(portableSrc) && !/\/MIR/.test(portableSrc));
ok('构建产出 zip 目标', /target: zip/.test(fs.readFileSync('electron-app/electron-builder.yml', 'utf8')));
ok('CI 生成并镜像 portable.json', /Generate portable manifest/.test(fs.readFileSync('.github/workflows/release.yml', 'utf8')));

sec('⑫ 旧版本迁移桥（安装器忽略卸载失败）');
const nsh = fs.readFileSync('electron-app/installer.nsh', 'utf8');
ok('installer.nsh 定义 customUnInstallCheck', /!macro customUnInstallCheck\b/.test(nsh));
ok('同时覆盖 CurrentUser 分支', /!macro customUnInstallCheckCurrentUser\b/.test(nsh));
ok('宏体不再 Quit（而是继续覆盖安装）', !/customUnInstallCheck[\s\S]{0,200}Quit/.test(nsh));


const preload = fs.readFileSync('electron-app/preload.js', 'utf8');

sec('⑪ 打包清单包含所有本地 require');
const builderYml = fs.readFileSync('electron-app/electron-builder.yml', 'utf8');
const localRequires = Array.from(main.matchAll(/require\('\.\/([\w.-]+\.js)'\)/g)).map(m => m[1]);
const missing = Array.from(new Set(localRequires)).filter(n => !new RegExp('(^|\\s)-\\s+' + n.replace('.', '\\.') + '$', 'm').test(builderYml));
ok('main.js 的本地 require 都在 files 列表里', missing.length === 0, missing.join(','));

const launcher = fs.readFileSync('斯诺德跑团/启动台.html', 'utf8');
const engine = fs.readFileSync('斯诺德跑团/panel_engine.js', 'utf8');

sec('① 主进程接线（静态断言）');
ok('autoInstallOnAppQuit = false（改由延迟拉起安装器）', /autoInstallOnAppQuit\s*=\s*false/.test(main));
ok('发现新版本后自动下载（不再等用户点下载）', /自动开始下载 v/.test(main) && /autoUpdater\.downloadUpdate\(\)/.test(main));
ok('下载完成后手动检查走立即安装', /if \(manualCheckRequested\) maybeInstallNow\(\);/.test(main));
ok('存在 maybeInstallNow（走延迟拉起）', /function maybeInstallNow/.test(main) && /launchInstallerDelayed\('manual-check'\)/.test(main));
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




sec('⑨ 安装前剥离旧卸载器（绕过静默卸载返回 2）');
ok('存在 removeOldUninstaller', /function removeOldUninstaller\(reason\)/.test(main));
ok('匹配 Uninstall *.exe', /Uninstall/.test(main));
ok('在拉起安装器前调用', /installerLaunched = true;[\s\S]{0,120}removeOldUninstaller\(reason\)/.test(main));
ok('剥离有日志与容错', /uninstaller-stripped/.test(main) && /uninstaller-remove-failed/.test(main));
{
  const re = /^Uninstall\s.*\.exe$/i;
  ok('正则可命中「Uninstall 斯诺德跑团.exe」', re.test('Uninstall 斯诺德跑团.exe'));
  ok('正则可命中「Uninstall Snowd.exe」', re.test('Uninstall Snowd.exe'));
  ok('正则不误伤主程序', !re.test('斯诺德跑团.exe'));
}

sec('⑧ 延迟安装命令必须真的能执行（8074/8075 的线上崩溃点）');
ok('没有 Python 写法 chr(34) 残留', !/chr\(/.test(main));
ok('没有非法的 app.getPath("localAppData")', !/getPath\("localAppData"\)/.test(main));
ok('spawn 带 windowsVerbatimArguments（否则 cmd 的 & 链不执行）', /windowsVerbatimArguments:\s*true/.test(main));
{
  const cmdSrc = main.match(/var q = String\.fromCharCode\(34\);\s*\n\s*var cmd = [^\n]+;/);
  const spawnOpts = main.match(/spawn\("cmd\.exe", \["\/c", cmd\], \{[^}]+\}\)/);
  ok('能从 main.js 提取命令构造', !!cmdSrc);
  ok('能从 main.js 提取 spawn 选项', !!spawnOpts);
  if (cmdSrc && spawnOpts) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snode-inst-'));
    const markerFile = path.join(tmp, 'ran.txt');
    const bat = path.join(tmp, 'fake installer.bat');
    fs.writeFileSync(bat, '@echo off\r\n> "' + markerFile + '" echo ok\r\n');
    try {
      const build = new Function('delay', 'file', cmdSrc[0] + '\nreturn cmd;');
      const verbatim = /windowsVerbatimArguments:\s*true/.test(spawnOpts[0]);
      spawnSync('cmd.exe', ['/c', build(1, bat)], { encoding: 'utf8', windowsVerbatimArguments: verbatim });
      ok('延迟安装命令真实执行（含空格路径）', fs.existsSync(markerFile));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}

sec('⑥ 临时目录加固 / 更新缓存清理');
ok('关闭差分下载（OSS 不支持 multipart/byteranges）', /autoUpdater\.disableDifferentialDownload = true/.test(main));
ok('关闭 web 安装器', /autoUpdater\.disableWebInstaller = true/.test(main));
ok('存在 resolveSafeTempDir（不依赖 TEMP 自身）', /function resolveSafeTempDir\(\)/.test(main) && /process\.env\.LOCALAPPDATA/.test(main));
ok('启动时归一化 process.env.TEMP/TMP', /function ensureProcessTemp\(\)/.test(main) && /process\.env\.TEMP = safe/.test(main) && /ensureProcessTemp\(\);/.test(main));
ok('存在 purgeUpdaterCache（装完清理）', /function purgeUpdaterCache\(reason\)/.test(main));
ok('存在 purgeStaleUpdaterCache（7 天保留）', /function purgeStaleUpdaterCache\(\)/.test(main) && /UPDATER_CACHE_KEEP_MS = 7 \* 24/.test(main));
ok('清理前检查是否有正在进行的更新', /function updaterBusy\(\)/.test(main) && /if \(updaterBusy\(\)\) return 0;/.test(main));
ok('装完（版本匹配）后调用清理', /updater-install-applied[\s\S]{0,300}purgeUpdaterCache\('post-install'\)/.test(main));
ok('启动时清理过期缓存', /purgeStaleUpdaterCache\(\);/.test(main));
ok('清理保留 update-info.json', /entries\[i\]\.name === "update-info\.json"/.test(main));
ok('清理目标取自 app-update.yml 的 updaterCacheDirName', /updaterCacheDirName:\\s\*/.test(main));

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
ok('安装前写入待安装版本（launchInstallerDelayed 内）', /function launchInstallerDelayed[\s\S]{0,600}markInstallAttempt\(pendingUpdate/.test(main));
ok('版本没变会报 update-install-not-applied', /updater-install-not-applied/.test(main));
ok('updater 日志保留消息体', /info:\s*\(m\)\s*=>\s*diagnostics\.log\('updater-info',\s*\{\s*msg:/.test(main));
ok('诊断白名单允许 msg/source/percent', /'msg'[\s\S]{0,40}'source'[\s\S]{0,40}'percent'/.test(fs.readFileSync('electron-app/desktop-diagnostics.js', 'utf8')));

console.log('\n' + '─'.repeat(52));
console.log((fail === 0 ? '✅ 全自动更新流程验收通过（策略 B）' : '❌ 存在失败项') + '  ' + pass + 'P / ' + fail + 'F');
process.exit(fail === 0 ? 0 : 1);
