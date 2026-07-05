export type FloatKind = 'power' | 'cost' | 'destroy'

export interface CombatFloat {
  kind: FloatKind
  text: string
}

/** 从单条效果文案解析战力/费用/摧毁飘字 */
export function parseCombatFloats(segment: string): CombatFloat[] {
  const s = segment.trim()
  if (!s) return []
  const out: CombatFloat[] = []

  if (/被摧毁/.test(s)) {
    const m = s.match(/(.+?)被摧毁/)
    out.push({ kind: 'destroy', text: m?.[1] ? `${m[1].trim()} 被摧毁` : '被摧毁' })
  }

  const powerDelta = s.match(/战力([+-]\d+)/)
  if (powerDelta) {
    const n = powerDelta[1]
    out.push({ kind: 'power', text: `战力 ${n.startsWith('+') || n.startsWith('-') ? n : `+${n}`}` })
  } else {
    const powerArrow = s.match(/战力(\d+)→(\d+)/)
    if (powerArrow) {
      const delta = Number(powerArrow[2]) - Number(powerArrow[1])
      if (delta !== 0) {
        out.push({ kind: 'power', text: `战力 ${delta > 0 ? '+' : ''}${delta}` })
      }
    }
  }

  const costRestore = s.match(/恢复(\d+)(?:点能量|费用)/)
  if (costRestore) {
    out.push({ kind: 'cost', text: `+${costRestore[1]} 费用` })
  } else if (/恢复2费用/.test(s)) {
    out.push({ kind: 'cost', text: '+2 费用' })
  } else {
    const costDelta = s.match(/费用([+-]\d+)/)
    if (costDelta) {
      out.push({ kind: 'cost', text: `费用 ${costDelta[1]}` })
    } else {
      const energy = s.match(/能量([+-]\d+)/)
      if (energy) {
        out.push({ kind: 'cost', text: `费用 ${energy[1]}` })
      }
    }
  }

  return out
}

export function parseCombatFloatsFromMessage(message: string): CombatFloat[] {
  const parts = message.split('|').map(p => p.trim())
  const seen = new Set<string>()
  const result: CombatFloat[] = []
  for (const part of parts) {
    for (const f of parseCombatFloats(part)) {
      const key = `${f.kind}:${f.text}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push(f)
      }
    }
  }
  return result.slice(0, 8)
}
