const fs = require('fs');
const content = fs.readFileSync('D:/Download/scholar-agent-main/poker-game-main/server/card-seed.json', 'utf8');

// Split by card objects (top-level array elements)
const lines = content.split('\n');
let currentCard = null;
let braceDepth = 0;
let inCard = false;
let inString = false;
let escaped = false;
let results = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!inCard) {
    if (line.includes('"id": "card_')) {
      inCard = true;
      currentCard = { id: '', name: '', type: '', effects: [] };
      braceDepth = 1;
      const idMatch = line.match(/"id":\s*"([^"]+)"/);
      if (idMatch) currentCard.id = idMatch[1];
      const nameMatch = line.match(/"name":\s*"([^"]+)"/);
      if (nameMatch) currentCard.name = nameMatch[1];
      const typeMatch = line.match(/"type":\s*"([^"]+)"/);
      if (typeMatch) currentCard.type = typeMatch[1];
    }
    continue;
  }

  // Track brace depth for this card
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (!inString) {
      if (c === '{') braceDepth++;
      if (c === '}') braceDepth--;
    }
  }
  
  if (braceDepth === 0) {
    // End of card - process it
    inCard = false;
    // Check if this card has 回合 in effects
    // We already captured what we need from the card header
    currentCard = null;
    continue;
  }
  
  // Look for timing+description pairs within effects
  if (line.includes('"timing"') && currentCard) {
    const timingMatch = line.match(/"timing":\s*"([^"]+)"/);
    if (timingMatch) {
      currentCard._lastTiming = timingMatch[1];
    }
  }
  if (line.includes('"description"') && currentCard) {
    const descMatch = line.match(/"description":\s*"([^"]+)"/);
    if (descMatch && descMatch[1].includes('回合') && currentCard._lastTiming) {
      const typeMatch = line.match(/"type":\s*"([^"]+)"/);
      results.push({
        id: currentCard.id,
        name: currentCard.name,
        type: currentCard.type,
        timing: currentCard._lastTiming || 'unknown',
        effectType: typeMatch ? typeMatch[1] : 'unknown',
        description: descMatch[1]
      });
    }
    currentCard._lastTiming = null;
  }
}

console.log('Total cards with round-related effects: ' + results.length);
for (const r of results) {
  console.log('---');
  console.log('ID: ' + r.id);
  console.log('Name: ' + r.name);
  console.log('Type: ' + r.type);
  console.log('Timing: ' + r.timing);
  console.log('EffectType: ' + r.effectType);
  console.log('Desc: ' + r.description);
}
