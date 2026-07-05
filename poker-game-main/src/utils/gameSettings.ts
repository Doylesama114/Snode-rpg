export interface GameSettings {
  skipAnimations: boolean
  /** 0–1 linear gain; default 0.7 (~−3 dB vs full scale) */
  bgmVolume: number
  bgmMuted: boolean
}

const STORAGE_KEY = 'gameSettings'

const DEFAULTS: GameSettings = {
  skipAnimations: false,
  bgmVolume: 0.7,
  bgmMuted: false,
}

function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return DEFAULTS.bgmVolume
  return Math.min(1, Math.max(0, v))
}

export function loadGameSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<GameSettings>
    return {
      ...DEFAULTS,
      ...parsed,
      bgmVolume: clampVolume(parsed.bgmVolume ?? DEFAULTS.bgmVolume),
      bgmMuted: parsed.bgmMuted ?? DEFAULTS.bgmMuted,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveGameSettings(settings: GameSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...settings,
    bgmVolume: clampVolume(settings.bgmVolume),
  }))
}

export function shouldSkipAnimations(): boolean {
  return loadGameSettings().skipAnimations
}
