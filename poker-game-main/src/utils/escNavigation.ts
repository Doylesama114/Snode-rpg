import type { Router } from 'vue-router'

/** 各页面 ESC 应返回的上一级（`launcher` = 启动台） */
const ESC_PARENT: Record<string, string | 'launcher' | null> = {
  '/': 'launcher',
  '/new-game': '/',
  '/multiplayer': '/',
  '/game/multiplayer': '/multiplayer',
  '/deck-builder': '/',
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

export function navigateToLauncher() {
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

  router.push(parent)
  return true
}

export function handleGlobalEscape(router: Router): void {
  for (let i = escHandlers.length - 1; i >= 0; i--) {
    if (escHandlers[i]()) return
  }
  navigateEscParent(router)
}
