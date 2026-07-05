import type { Router } from 'vue-router'

/** 各页面 ESC 应返回的上一级（`launcher` = 启动台） */
const ESC_PARENT: Record<string, string | 'launcher' | null> = {
  '/': 'launcher',
  '/new-game': '/',
  '/multiplayer': '/',
  '/game/multiplayer': '/multiplayer',
  '/deck-builder': '/',
  '/settings': '/',
  '/card-game': '/',
  '/account-setup': null,
}

type EscHandler = () => boolean

const escHandlers: EscHandler[] = []

/** 子页面可注册 ESC 优先处理（如关闭弹窗），返回 true 表示已消费 */
export function registerEscHandler(handler: EscHandler): () => void {
  escHandlers.push(handler)
  return () => {
    const i = escHandlers.indexOf(handler)
    if (i >= 0) escHandlers.splice(i, 1)
  }
}

/** 从 poker-game 目录解析启动台 URL（不依赖浏览器 history） */
export function resolveLauncherUrl(): string | null {
  const href = window.location.href.split('#')[0]
  if (!href.includes('poker-game')) return null
  if (href.includes('/electron-app/poker-game')) {
    return href.replace(/\/electron-app\/poker-game\/index\.html?$/, '/electron-app/斯诺德跑团/启动台.html')
  }
  return href.replace(/poker-game\/index\.html?$/, '斯诺德跑团/启动台.html')
}

export function navigateToLauncher() {
  const launcher = resolveLauncherUrl()
  if (launcher) {
    window.location.href = launcher
    return
  }
  if (window.history.length > 1) {
    window.history.back()
  }
}

export function navigateEscParent(router: Router): boolean {
  const path = router.currentRoute.value.path
  const parent = ESC_PARENT[path] ?? '/'

  if (parent === null) return false

  if (parent === 'launcher') {
    navigateToLauncher()
    return true
  }

  // replace 避免历史栈来回弹跳
  router.replace(parent)
  return true
}

export function handleGlobalEscape(router: Router): void {
  for (let i = escHandlers.length - 1; i >= 0; i--) {
    if (escHandlers[i]()) return
  }
  navigateEscParent(router)
}
