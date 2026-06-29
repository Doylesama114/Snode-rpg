// 联机服务器配置

// 从localStorage读取保存的配置
function getSavedServerUrl(): string | null {
  try {
    return localStorage.getItem('multiplayer_server_url')
  } catch {
    return null
  }
}

// 保存配置到localStorage
export function saveServerUrl(url: string): void {
  try {
    localStorage.setItem('multiplayer_server_url', url)
  } catch (e) {
    console.error('无法保存服务器配置:', e)
  }
}

// 获取服务器地址
export function getServerUrl(): string {
  // 优先使用保存的配置
  const saved = getSavedServerUrl()
  if (saved) {
    return saved
  }
  
  // 检查是否在生产环境（GitHub Pages）
  if (import.meta.env.PROD) {
    // 生产环境默认使用配置的后端地址
    return SERVER_CONFIG.production
  }
  
  // 开发环境：根据当前主机自动选择
  const hostname = window.location.hostname
  
  // 如果访问的是localhost，使用localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001'
  }
  
  // 如果访问的是 ngrok 域名，使用配置的后端地址
  if (hostname.includes('ngrok-free.app') || hostname.includes('ngrok-free.dev') || hostname.includes('ngrok.io')) {
    // 使用配置的 ngrok/FRP 后端地址
    return SERVER_CONFIG.frp
  }
  
  // 如果访问的是Sakura FRP域名，使用对应的后端地址
  if (hostname.includes('natfrp.cloud') || hostname.includes('frp')) {
    // 使用配置的FRP后端地址
    return SERVER_CONFIG.frp
  }
  
  // 如果访问的是局域网IP，使用相同的IP
  return `http://${hostname}:3001`
}

// 手动配置（如果需要）
export const SERVER_CONFIG = {
  // 本地测试
  local: 'http://localhost:3001',
  
  // 局域网（替换为你的IP）
  lan: 'http://192.168.1.7:3001',
  
  // ngrok 或 Sakura FRP（替换为你的实际地址）
  // ngrok 格式：https://abc123.ngrok-free.app
  // Sakura FRP 格式1（HTTP隧道）：http://你的后端域名.natfrp.cloud
  // Sakura FRP 格式2（TCP隧道）：http://节点域名:分配的端口
  frp: 'https://hildred-sufferable-karly.ngrok-free.dev',
  
  // 生产环境（GitHub Pages / Electron）默认后端地址
  production: 'https://poker-server-5lyl.onrender.com',
  
  // 互联网（需要部署后填写）
  internet: 'https://your-server.com:3001'
}

// 当前使用的模式
export type ServerMode = 'auto' | 'local' | 'lan' | 'frp' | 'internet'

// 获取指定模式的服务器地址
export function getServerUrlByMode(mode: ServerMode = 'auto'): string {
  switch (mode) {
    case 'local':
      return SERVER_CONFIG.local
    case 'lan':
      return SERVER_CONFIG.lan
    case 'frp':
      return SERVER_CONFIG.frp
    case 'internet':
      return SERVER_CONFIG.internet
    case 'auto':
    default:
      return getServerUrl()
  }
}
