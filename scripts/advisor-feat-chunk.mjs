/**
 * Transform 特殊专长 records into L4 advisor chunks.
 */

const MAGE_FEAT_PATTERNS = [
  { re: /法术|施法|魔法|奥术|仪式|智力|奥秘|戏法|天赋树|法师|魔契师/, relevance: 'high' },
  { re: /技巧专家|强化属性|奇羡珍品|冥想|专注/, relevance: 'medium' },
  { re: /施法者|反制|猎魔/, relevance: 'low' },
];

export function inferMageFeatRelevance(feat) {
  const blob = `${feat.name} ${feat.prerequisite || ''} ${feat.description || ''}`;
  for (const { re, relevance } of MAGE_FEAT_PATTERNS) {
    if (re.test(blob)) return relevance;
  }
  if (/智力属性不是你最低/.test(blob)) return 'high';
  return 'none';
}

export function buildFeatSummary(description, maxLen = 200) {
  const text = (description || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

export function featToChunk(feat) {
  const chunk = {
    id: feat.id,
    name: feat.name,
    prerequisite: feat.prerequisite || '无',
    summary: buildFeatSummary(feat.description),
    description: feat.description || '',
    mageRelevance: inferMageFeatRelevance(feat),
    confidence: 'documented',
    searchText: '',
  };
  chunk.searchText = [chunk.name, chunk.prerequisite, chunk.summary, chunk.mageRelevance].join(' ');
  return chunk;
}
