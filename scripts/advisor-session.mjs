/**
 * Advisor 2.0 — in-memory conversation session helpers (server-side).
 * Client persists turns in sessionStorage; main process validates on receive.
 */

export const MAX_CONVERSATION_TURNS = 3;
export const MAX_TURN_USER_CHARS = 2000;
export const MAX_TURN_ASSISTANT_CHARS = 800;

/**
 * @param {unknown} raw
 * @returns {{ user: string, assistant: string, ts?: number }[]}
 */
export function normalizeConversationHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const user = String(item.user || '').trim().slice(0, MAX_TURN_USER_CHARS);
    const assistant = String(item.assistant || '').trim().slice(0, MAX_TURN_ASSISTANT_CHARS);
    if (!user && !assistant) continue;
    out.push({
      user,
      assistant,
      ts: typeof item.ts === 'number' ? item.ts : undefined,
    });
  }
  return out.slice(-MAX_CONVERSATION_TURNS);
}

/**
 * @param {{ user: string, assistant: string }[]} turns
 */
export function summarizeSessionForPlanner(turns) {
  if (!turns?.length) return '';
  return turns.map((t, i) => {
    const u = (t.user || '').slice(0, 120);
    const a = (t.assistant || '').slice(0, 160);
    return `[${i + 1}] 用户：${u}${u.length >= 120 ? '…' : ''}\n助理：${a}${a.length >= 160 ? '…' : ''}`;
  }).join('\n');
}

/**
 * @param {{ user: string, assistant: string }[]} turns
 * @param {string} query
 */
export function isFullListFollowUp(turns, query) {
  const q = String(query || '');
  if (!/全列|全部|完整|详细|列出来|都列|逐项/.test(q)) return false;
  if (!turns?.length) return false;
  const last = turns[turns.length - 1];
  const prior = `${last.user || ''} ${last.assistant || ''}`;
  return /技能|法术|战技|流派|戏法|可选|有哪些/.test(prior);
}
