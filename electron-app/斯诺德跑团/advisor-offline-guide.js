/* 顾问「未连接服务」落地引导（v1.0.8016）
 * 独立文件，不修改 advisor-chat.js：仅在未配置服务时，在消息区追加一块引导面板。
 */
(function () {
  function resolveApi() {
    var v = String(window.SNODE_ADVISOR_API || '').trim();
    if (v && v !== '__ADVISOR_API_BASE__') return v.replace(/\/+$/, '');
    try {
      var m = document.querySelector('meta[name="advisor-api"]');
      if (m && m.content) return String(m.content).replace(/\/+$/, '');
      var lv = localStorage.getItem('_snowd_adv_api');
      if (lv) return String(lv).replace(/\/+$/, '');
    } catch (e) { /* ignore */ }
    return '';
  }
  function pick(list) {
    for (var i = 0; i < list.length; i++) { var e = document.querySelector(list[i]); if (e) return e; }
    return null;
  }
  function buildBrief() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!/^char_/.test(k)) continue;
        var d = JSON.parse(localStorage.getItem(k) || 'null');
        if (!d || typeof d !== 'object') continue;
        var parts = [];
        if (d.name) parts.push('角色：' + d.name);
        if (d.class || d.className) parts.push('职业：' + (d.class || d.className));
        if (d.level) parts.push('等级：' + d.level);
        if (d.race) parts.push('种族：' + d.race);
        var attrs = d.attrs || d.attributes || d.attr;
        if (attrs && typeof attrs === 'object') {
          var a = [];
          for (var key in attrs) { if (attrs[key] !== '' && attrs[key] != null) a.push(key + ' ' + attrs[key]); }
          if (a.length) parts.push('属性：' + a.join(' / '));
        }
        if (parts.length) out.push(parts.join('，'));
      }
    } catch (e) { /* ignore */ }
    return out.slice(0, 3).join('\n');
  }
  function render() {
    if (resolveApi()) return;
    if (document.getElementById('advOfflineGuide')) return;
    var host = pick(['.msgs', '#messages', '.messages', '.msg-list', '.chat-body', '.app']);
    if (!host) return;
    var brief = buildBrief();
    var text = (brief ? '【我的角色】\n' + brief + '\n\n' : '') + '【我的问题】\n（在这里写你的问题，例如：战士 3 级怎么加点？）';
    var box = document.createElement('div');
    box.id = 'advOfflineGuide';
    box.style.cssText = 'margin:12px 4px;padding:12px 14px;border:1px solid #d8d2c4;border-radius:10px;background:#fffdf8;line-height:1.75;font-size:13.5px;color:#4a4238';
    var html = '';
    html += '<div style="font-weight:bold;margin-bottom:6px">顾问需要连接一个 AI 服务（当前未配置）</div>';
    html += '<div style="margin-bottom:8px">这个顾问的资料来自软件内置的规则库；问答由你自己的 AI 服务生成。三步即可使用：</div>';
    html += '<div>① 点下面按钮，复制你的问题（含角色简报）</div>';
    html += '<div>② 粘贴到任意 AI 客户端（或直接发给 DM）</div>';
    html += '<div>③ 把回答带回来，对照规则页 / 职业页核对</div>';
    box.innerHTML = html;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '📋 复制我的问题 + 角色简报';
    btn.style.cssText = 'margin-top:10px;padding:7px 12px;border:1px solid #b9903f;border-radius:8px;background:#f3e6c9;color:#6d5223;cursor:pointer;font-size:13px';
    btn.onclick = function () {
      function done() { btn.textContent = '✅ 已复制，去粘贴吧'; }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { window.prompt('复制下面的内容：', text); }
        document.body.removeChild(ta);
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
        else fallback();
      } catch (e) { fallback(); }
    };
    box.appendChild(btn);
    host.appendChild(box);
    if (host.scrollTo) host.scrollTop = host.scrollHeight;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
  setTimeout(render, 600);
})();
