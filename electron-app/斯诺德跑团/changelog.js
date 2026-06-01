// 斯诺德跑团 - 更新日志
var SNOWD_CHANGELOG = [

  {
    version: '1.0.550',
    date: '2026-06-01',
    changes: [
      '语言系统更新至18种语言:30种族映射+翼空族通用语可选',
      '修复saveCharacter中RACE_LANGS数组变异bug'
    ]
  },


  {
    version: '1.0.549',
    date: '2026-06-01',
    changes: [
      '首页全局搜索高亮修复(selector错配)',
      '新增空搜索结果提示',
      '清理common.css重复CSS',
      'electron-app首页同步全局搜索功能',
      '新增debug-journal.md和debug-snode skill'
    ]
  },


  {
    version: '1.0.548',
    date: '2026-06-01',
    changes: [
      '更新日志关闭按钮移至弹窗右上角(修复主源文件)'
    ]
  },


  {
    version: '1.0.547',
    date: '2026-06-01',
    changes: [
      '更新日志关闭按钮移至弹窗右上角'
    ]
  },


  {
    version: '1.0.546',
    date: '2026-06-01',
    changes: [
      '修复魔契师51处数据错误:清理29处垃圾文本+补充22个天赋技能缺失描述'
    ]
  },


  {
    version: '1.0.545',
    date: '2026-06-01',
    changes: [
      '魔契师数据全面更新:4风格含秘术116技能',
      'REF_CLASSES字段修正+key_attr→魅力',
      'REF_SUBCLASS_REQS attrs修复',
      '28技能费用颜色docx校正',
      '描述/升级文本技能点颜色修正',
      '错别字魔契约师→魔契师'
    ]
  },


  {
    version: '1.0.543',
    date: '2026-06-01',
    changes: [
      '首次安装可自选是否创建桌面快捷方式'
    ]
  },


  {
    version: '1.0.542',
    date: '2026-06-01',
    changes: [
      '修复静默安装(NSIS customInit /S)',
      '修复GitHub Pages部署(改用actions/deploy-pages)'
    ]
  },


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

  // 右上角关闭按钮（插入到弹窗内部标题之前）
  html = html.replace('<h2 style="margin:0 0 4px;font-size:22px">📋 更新日志</h2>',
    '<button id="_clog_close" style="position:absolute;top:14px;right:16px;width:32px;height:32px;border:none;background:#f6f4ef;border-radius:50%;cursor:pointer;font-size:18px;line-height:1;color:#69706b;display:flex;align-items:center;justify-content:center;transition:all 0.15s;z-index:1" onmouseover="this.style.background=\'#d8d2c4\';this.style.color=\'#c62828\'" onmouseout="this.style.background=\'#f6f4ef\';this.style.color=\'#69706b\'">✕</button>\n  <h2 style="margin:0 0 4px;font-size:22px">📋 更新日志</h2>');

  modal.innerHTML = html;
  modal.style.position = 'relative';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById('_clog_close').onclick = function(e) { e.stopPropagation(); overlay.remove(); };
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
}
