'use strict';

function applicationMenu(app, Menu) {
  return Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'zoom' },
      { role: 'close' }, { type: 'separator' }, { role: 'front' }] },
  ]);
}

// Ad-hoc distributions use replacement downloads. Squirrel.Mac requires a
// Developer ID signature to install automatic updates.
function macReleaseUpdate(release, currentVersion, arch) {
  const version = String(release.tag_name || '').replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('无法获取 Mac 版本信息');
  const next = version.split('.').map(Number);
  const current = currentVersion.split('.').map(Number);
  let newer = false;
  for (let i = 0; i < 3; i++) {
    if (next[i] === current[i]) continue;
    newer = next[i] > current[i];
    break;
  }
  if (!newer) return { status: 'uptodate' };
  const assets = release.assets || [];
  const stem = `Snode-RPG-${version}-mac-${arch}`;
  const asset = assets.find(item => item.name === `${stem}.dmg`) ||
    assets.find(item => item.name === `${stem}.zip`);
  // 某版本可能只发 Windows/Android（例如本轮 mac 延后），此时不是故障，
  // 而是"本平台暂无可装包"，用中性态避免每次启动弹红色错误。
  if (!asset) return { status: 'uptodate', version, platformMissing: true,
    message: 'v' + version + ' 暂未提供 Mac ' + arch + ' 安装包，当前版本可继续使用' };
  const url = asset.browser_download_url;
  if (typeof url !== 'string' || !url.startsWith('https://github.com/Doylesama114/Snode-rpg/releases/download/')) {
    throw new Error('Mac 安装包下载地址无效');
  }
  return { status: 'available', version, url,
    message: `发现 Mac 新版本 v${version}，下载后替换应用即可更新` };
}

module.exports = { applicationMenu, macReleaseUpdate };
