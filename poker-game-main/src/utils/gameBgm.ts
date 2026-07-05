import { loadGameSettings } from '@/utils/gameSettings'

export type BgmTrack = 'hall' | 'battle' | 'end'

const TRACK_FILES: Record<BgmTrack, string> = {
  hall: 'music/HALL1.wav',
  battle: 'music/Battle1.wav',
  end: 'music/END1.wav',
}

let audio: HTMLAudioElement | null = null
let currentTrack: BgmTrack | null = null

function trackUrl(track: BgmTrack): string {
  return `${import.meta.env.BASE_URL}${TRACK_FILES[track]}`
}

function effectiveVolume(): number {
  const s = loadGameSettings()
  if (s.bgmMuted) return 0
  return s.bgmVolume
}

export function refreshBgmVolume(): void {
  if (audio) audio.volume = effectiveVolume()
}

export function stopBgm(): void {
  if (!audio) return
  audio.pause()
  audio.src = ''
  audio = null
  currentTrack = null
}

export function playBgm(track: BgmTrack): void {
  if (currentTrack === track && audio) {
    refreshBgmVolume()
    if (audio.paused) void audio.play().catch(() => {})
    return
  }
  stopBgm()
  audio = new Audio(trackUrl(track))
  audio.loop = true
  audio.volume = effectiveVolume()
  currentTrack = track
  void audio.play().catch(() => {})
}

export function syncBattleBgm(isFinalRound: boolean): void {
  playBgm(isFinalRound ? 'end' : 'battle')
}

const HALL_ROUTES = new Set(['/', '/deck-builder', '/multiplayer', '/account-setup', '/settings'])

export function syncRouteBgm(path: string): void {
  if (HALL_ROUTES.has(path)) {
    playBgm('hall')
    return
  }
  if (path === '/new-game' || path === '/game/multiplayer') {
    playBgm('battle')
    return
  }
  stopBgm()
}
