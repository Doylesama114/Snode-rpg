(function () {
  'use strict';
  var prefs = window.SnowdPreferences;
  if (!prefs || document.getElementById('promptSettingsCard')) return;
  var file = decodeURIComponent(location.pathname.split('/').pop() || '');
  if (file !== '启动台.html' && file !== '设置.html') return;
  var launcher = file === '启动台.html', overlay, toggle;
  var card = document.createElement('section'); card.id = 'promptSettingsCard'; card.className = 'card';
  card.style.cssText = 'padding:20px;border-radius:10px;box-sizing:border-box;font:15px system-ui;line-height:1.6';
  var title = document.createElement('h2'); title.id = 'promptSettingsTitle'; title.textContent = '提示设置'; title.style.fontSize = '20px'; card.appendChild(title);
  var intro = document.createElement('p'); intro.textContent = '保存到本机，重启和正常升级后保留。'; card.appendChild(intro);
  var inputs = {};
  function row(key, label, description) {
    var wrap = document.createElement('label'); wrap.style.cssText = 'display:flex;gap:12px;align-items:flex-start;margin:18px 0;cursor:pointer';
    var input = document.createElement('input'); input.type = 'checkbox'; input.id = key + 'Toggle'; input.disabled = true;
    input.style.cssText = 'width:20px;height:20px;margin-top:4px;flex-shrink:0'; inputs[key] = input;
    var text = document.createElement('span'), heading = document.createElement('strong'), desc = document.createElement('span');
    heading.textContent = label; desc.textContent = description; desc.style.cssText = 'display:block;font-size:13px;opacity:.8';
    text.appendChild(heading); text.appendChild(desc); wrap.appendChild(input); wrap.appendChild(text); card.appendChild(wrap);
    input.onchange = async function () {
      input.disabled = true;
      var patch = {}; patch[key] = input.checked;
      var r = await prefs.set(patch);
      status.textContent = r.ok ? '已保存' : r.error; input.disabled = false;
    };
  }
  row('onboardingEnabled', '自动新手引导', '首次进入相关页面时展示一次。关闭后不再自动出现。');
  row('advisorAutoTipsEnabled', '顾问自动提示', '随机小贴士和建卡主动建议。关闭后仍可手动打开顾问与提问。');
  var status = document.createElement('p'); status.id = 'promptSettingsStatus'; status.setAttribute('role','status'); status.style.fontSize = '13px';
  card.appendChild(status);
  var replay = document.createElement('button'); replay.type = 'button'; replay.className = 'btn'; replay.textContent = '重看启动台引导';
  replay.style.cssText = 'padding:8px 12px;cursor:pointer;margin-right:8px';
  replay.onclick = function () {
    if (overlay) overlay.style.display = 'none';
    if (window.Onboard) window.Onboard.run('launcher', { manual: true });
  }; card.appendChild(replay);
  function paint() {
    var data = prefs.get(), saved = prefs.status();
    Object.keys(inputs).forEach(function (key) { inputs[key].checked = data[key]; });
    status.textContent = saved.error || '';
  }
  prefs.subscribe(paint);
  prefs.ready.then(function () { paint(); Object.keys(inputs).forEach(function (key) { inputs[key].disabled = false; }); });
  if (launcher) {
    overlay = document.createElement('div'); overlay.id = 'promptSettingsOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:#0009;display:none;align-items:center;justify-content:center;padding:12px;box-sizing:border-box';
    card.style.cssText += ';width:500px;max-width:100%;max-height:calc(100vh - 24px);overflow:auto;background:#fff8e8;color:#3a2a13;box-shadow:0 12px 35px #0006';
    card.setAttribute('role','dialog'); card.setAttribute('aria-modal','true'); card.setAttribute('aria-labelledby','promptSettingsTitle');
    toggle = document.createElement('button'); toggle.type = 'button'; toggle.id = 'promptSettingsToggle'; toggle.textContent = '提示设置';
    toggle.style.cssText = 'background:transparent;color:inherit;border:1px solid #a8802f;border-radius:6px;padding:5px 8px;cursor:pointer;white-space:nowrap';
    toggle.onclick = function () { overlay.style.display = 'flex'; inputs.onboardingEnabled.focus(); };
    var host = document.querySelector('.top-ops') || document.body; host.appendChild(toggle);
    var close = document.createElement('button'); close.type = 'button'; close.className = 'btn'; close.textContent = '关闭'; close.style.cssText = replay.style.cssText;
    function hide() { overlay.style.display = 'none'; toggle.focus(); }
    close.onclick = hide; card.appendChild(close);
    document.addEventListener('keydown',function(event){ if(event.key === 'Escape' && overlay.style.display === 'flex'){event.preventDefault();event.stopPropagation();hide();} },true);
    overlay.appendChild(card); document.body.appendChild(overlay);
  } else {
    (document.querySelector('.wrap') || document.body).appendChild(card);
  }
})();
