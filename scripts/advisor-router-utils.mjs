/**
 * Shared router helpers (avoids circular imports with advisor-retrieve).
 */
const ADVANCEMENT_NAMES = [
  '近卫', '神射手', '刺客', '战斗大师', '武器大师', '冠军', '奥法骑士', '奥术守卫',
  '冰霜法师', '火焰法师', '塑能学者', '咒法大师', '防护师', '幻术师', '亡灵学者',
  '铁拳', '四象', '暗影', '神圣', '自然', '奇械',
];

export function pickAdvancementName(query) {
  for (const name of ADVANCEMENT_NAMES) {
    if (query.includes(name)) return name;
  }
  return null;
}
