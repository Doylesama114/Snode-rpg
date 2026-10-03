'use strict';
const api = window.electronAPI;
const status = document.getElementById('status');
if (!api) status.textContent = '桌面桥接不可用，请重新启动程序或重新安装。';
if (api) {
  api.desktopStatus().then(s => {
    document.getElementById('reason').textContent = s.message || '页面加载失败。未处理的恢复草稿仍被保留。';
  }).catch(() => {});
  document.querySelectorAll('button').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      if (button.dataset.action === 'export') {
        const r = await api.exportDiagnostics();
        status.textContent = r.canceled ? '已取消导出' : r.ok ? '诊断已导出' : r.error;
      } else if (button.dataset.action === 'compatibility') {
        const r = await api.setCompatibilityMode(true);
        status.textContent = r.ok ? '已启用，请关闭程序后重新打开。' : r.error;
      } else await api.desktopAction(button.dataset.action);
    } catch (_) { status.textContent = '操作失败，请重新启动程序。'; }
    button.disabled = false;
  }));
}

window.__desktopErrorReady = !!api;
