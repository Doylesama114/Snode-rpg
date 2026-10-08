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
  if (!asset) return { status: 'error', message: `v${version} 的 Mac ${arch} 安装包尚未发布。` };
  const url = asset.browser_download_url;
  if (typeof url !== 'string' || !url.startsWith('https://github.com/Doylesama114/Snode-rpg/releases/download/')) {
    throw new Error('Mac 安装包下载地址无效');
  }
  return { status: 'available', version, url,
    message: `发现 Mac 新版本 v${version}，下载后替换应用即可更新` };
}

module.exports = { applicationMenu, macReleaseUpdate };
