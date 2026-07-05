export interface GameSettings {
  skipAnimations: boolean
}

const STORAGE_KEY = 'gameSettings'

const DEFAULTS: GameSettings = {
  skipAnimations: false,
}

export function loadGameSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<GameSettings>
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveGameSettings(settings: GameSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function shouldSkipAnimations(): boolean {
  return loadGameSettings().skipAnimations
}
