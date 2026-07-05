const MUTE_KEY = '_snowd_mute'
const BASE = `${import.meta.env.BASE_URL}audio/cards/`

type CardSound = 'cardPlace' | 'cardDraw' | 'deckAdd' | 'deckRemove' | 'saveSuccess' | 'error'

const FILES: Record<CardSound, string> = {
  cardPlace: 'cardPlace.ogg',
  cardDraw: 'cardDraw.ogg',
  deckAdd: 'deckAdd.ogg',
  deckRemove: 'deckRemove.ogg',
  saveSuccess: 'saveSuccess.ogg',
  error: 'error.ogg',
}

const GAIN: Record<CardSound, number> = {
  cardPlace: 0.65,
  cardDraw: 0.6,
  deckAdd: 0.6,
  deckRemove: 0.6,
  saveSuccess: 0.7,
  error: 0.65,
}

let ctx: AudioContext | null = null
const buffers = new Map<CardSound, AudioBuffer>()
let preloadPromise: Promise<void> | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  void ctx.resume()
  return ctx
}

export function isSoundMuted(): boolean {
  return localStorage.getItem(MUTE_KEY) === '1'
}

async function preload(): Promise<void> {
  if (preloadPromise) return preloadPromise
  preloadPromise = Promise.all(
    (Object.keys(FILES) as CardSound[]).map(async name => {
      try {
        const res = await fetch(BASE + FILES[name])
        if (!res.ok) return
        const ab = await res.arrayBuffer()
        buffers.set(name, await getCtx().decodeAudioData(ab))
      } catch {
        /* sample optional */
      }
    }),
  ).then(() => undefined)
  return preloadPromise
}

export function playCardSound(name: CardSound): void {
  if (isSoundMuted()) return
  void preload().then(() => {
    const buf = buffers.get(name)
    if (!buf) return
    const audio = getCtx()
    const src = audio.createBufferSource()
    const gain = audio.createGain()
    src.buffer = buf
    gain.gain.value = GAIN[name]
    src.connect(gain)
    gain.connect(audio.destination)
    src.start()
  })
}

void preload()
