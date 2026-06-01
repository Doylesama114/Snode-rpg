// 斯诺德跑团 - 更新日志
var SNOWD_CHANGELOG = [

  {
    version: '1.0.541',
    date: '2026-06-01',
    changes: [
      '修复更新静默安装(quitAndInstall改为true)',
      '修复GitHub Pages未开启问题'
    ]
  },


  {
    version: '1.0.540',
    date: '2026-06-01',
    changes: [
      '修复更新日志停止在v1.0.535',
      '修复GitHub Pages部署(加入index.html)',
      '修复bump-version.js自动同步changelog.js'
    ]
  },


  {
    version: '1.0.539',
    date: '2026-06-01',
    changes: [
      '安装器可选安装目录',
      '更新完全静默无弹窗',
      'Cloudflare Pages国内镜像站点',
      'index.html自动跳转启动台'
    ]
  },


  {
    version: '1.0.538',
    date: '2026-06-01',
    changes: [
      '更新全部md文档到v1.0.537状态'
    ]
  },


  {
    version: '1.0.537',
    date: '2026-06-01',
    changes: [
      'Gitee mirror新增上传latest.yml'
    ]
  },


  {
    version: '1.0.536',
    date: '2026-06-01',
    changes: [
      '修复bump-version.js changelog写入匹配条件(= [)'
    ]
  },

  {
    version: '1.0.535',
    date: '2026-06-01',
    changes: [
      '修复CN镜像Gitee用户名(Doylesama114→007)'
    ]
  },
  {
    version: '1.0.534',
    date: '2026-06-01',
    changes: [
      '修复CN镜像按钮被Electron拦截(白名单加gitee.com)'
    ]
  },
  {
    version: '1.0.533',
    date: '2026-06-01',
    changes: [
      '修复changelog.js双括号语法错误导致按钮无响应',
      '修复bump-version注入逻辑'
    ]
  },
  {
    version: '1.0.532',
    date: '2026-06-01',
    changes: [
      '修复浏览器XHR Title头含中文报错'
    ]
  },
  {
    version: '1.0.531',
    date: '2026-06-01',
    changes: [
      '修复IPC发送Bug时Title头含中文报错'
    ]
  },
  {
    version: '1.0.530',
    date: '2026-06-01',
    changes: [
      '捉虫按钮改用IPC桥接(main进程发网络请求)',
      '发送按钮内联反馈(替代alert)'
    ]
  },

  {
    version: '1.0.529',
    date: '2026-06-01',
    changes: [
      '捉虫按钮完全改用createElement+addEventListener'
    ]
  },

  {
    version: '1.0.528',
    date: '2026-06-01',
    changes: [
      '捉虫发送按钮改用内联onclick事件修复'
    ]
  },

  {
    version: '1.0.527',
    date: '2026-06-01',
    changes: [
      '捉虫按钮改用弹窗替代prompt修复点击无反应',
      '更新日志自动追加功能'
    ]
  },

  {
    version: '1.0.520',
    date: '2026-06-01',
    changes: [
      '🐛 Bug反馈按钮改用邮件方式（更稳定）',
      '⚡ 自动更新改为静默安装，无需用户操作',
      '📋 新增更新日志弹窗',
      '🌐 新增国内镜像加速下载',
    ]
  },
  {
    version: '1.0.514',
    date: '2026-06-01',
    changes: [
      '🔧 修复自动更新文件名不匹配问题',
      '📦 改用 NSIS 安装器格式',
      '🤖 新增 bump-version.js 一键版本号同步',
    ]
  },
  {
    version: '1.0.510',
    date: '2026-06-01',
    changes: [
      '🔄 修复 app-update.yml 缺失问题',
      '➕ 新增 publish 配置',
    ]
  },
  {
    version: '1.0.56',
    date: '2026-05-31',
    changes: [
      '📁 核心文件直接提交到 electron-app',
      '🛠 修复打包时使用旧文件的问题',
    ]
  },
  {
    version: '1.0.54',
    date: '2026-05-31',
    changes: [
      '⚡ Electron IPC 自动更新 + 下载完成自动重启',
      '🐛 启动台版本号显示 + 检查更新反馈',
    ]
  },
];

function showChangelog(showLatest) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;overflow-y:auto';
  
  var modal = document.createElement('div');
  modal.style.cssText = 'background:#fffdf8;border-radius:12px;padding:24px 28px;max-width:520px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 16px 48px rgba(0,0,0,0.2);font-family:"Microsoft YaHei",sans-serif;color:#1f2522';

  var html = '<h2 style="margin:0 0 4px;font-size:22px">📋 更新日志</h2>';
  html += '<div style="font-size:13px;color:#69706b;margin-bottom:16px">斯诺德跑团 · 版本历史</div>';

  for (var i = 0; i < SNOWD_CHANGELOG.length; i++) {
    var v = SNOWD_CHANGELOG[i];
    var isNew = showLatest && i === 0;
    html += '<div style="background:'+(isNew?'#f6f4ef':'#fff')+';border:1px solid '+(isNew?'#a46d1f':'#d8d2c4')+';border-radius:8px;padding:14px 16px;margin-bottom:10px">';
    html += '<div style="font-size:16px;font-weight:bold;color:'+(isNew?'#a46d1f':'#1f2522')+'">v' + v.version + (isNew?' <span style="font-size:12px;color:#c62828">🆕 最新</span>':'') + '</div>';
    html += '<div style="font-size:12px;color:#69706b;margin-bottom:8px">' + v.date + '</div>';
    for (var j = 0; j < v.changes.length; j++) {
      html += '<div style="font-size:14px;line-height:1.8;color:#1f2522">' + v.changes[j] + '</div>';
    }
    html += '</div>';
  }

  html += '<div style="text-align:center;margin-top:12px"><button id="_snowd_changelog_close" style="padding:8px 24px;background:#a46d1f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:15px">关闭</button></div>';
  modal.innerHTML = html;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById('_snowd_changelog_close').onclick = function(e) { e.stopPropagation(); overlay.remove(); };
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
}
