const fs = require('fs');
const path = require('path');

// Read docx XML
const xml = fs.readFileSync(path.join(process.env.TEMP, 'docx_ext2/word/document.xml'), 'utf8');

// Extract all text runs with their colors
const runs = [];
const runRe = /<w:r>([\s\S]*?)<\/w:r>/g;
let rm;
while ((rm = runRe.exec(xml))) {
    const runXml = rm[1];
    const colorMatch = runXml.match(/<w:color w:val="([^"]+)"/);
    const textMatch = runXml.match(/<w:t[^>]*>(.*?)<\/w:t>/);
    const color = colorMatch ? colorMatch[1] : 'default';
    const text = textMatch ? textMatch[1] : '';
    if (text) runs.push({ text, color });
}

// Build full text and find sections
const fullText = runs.map(r => r.text).join('');
const sections = fullText.split(/-------------------------------------------------------/).filter(s => s.trim());

// Find feat names and check for dots
const results = [];
for (const s of sections) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    
    // Extract feat name (first ~2-15 chars before 前置条件)
    const nameMatch = trimmed.match(/^(.{1,30}?)前置条件/);
    if (!nameMatch) continue;
    const name = nameMatch[1].replace(/[\r\n]/g, '').trim();
    
    // Check if this section has dots
    if (!trimmed.includes(String.fromCharCode(0x25CF))) continue;
    
    // Find the dot segment and its surrounding text
    const dotIdx = trimmed.indexOf(String.fromCharCode(0x25CF));
    const context = trimmed.substring(Math.max(0, dotIdx - 40), Math.min(trimmed.length, dotIdx + 100));
    
    // Find colored dots in the XML (within this section's runs)
    // Map each run to its text position
    let pos = 0;
    const runMap = [];
    for (const r of runs) {
        const start = pos;
        pos += r.text.length;
        if (start < fullText.indexOf(trimmed) + trimmed.length && start >= fullText.indexOf(trimmed)) {
            runMap.push(r);
        }
    }
    
    // Find runs with dots and non-default colors
    const coloredDots = [];
    for (const r of runMap) {
        if (r.text.includes(String.fromCharCode(0x25CF)) && r.color !== 'default' && r.color !== 'auto') {
            const count = (r.text.match(new RegExp(String.fromCharCode(0x25CF), 'g')) || []).length;
            coloredDots.push({ color: r.color, count });
        }
    }
    
    results.push({ name, context: context.replace(/[\r\n]/g, ' '), coloredDots });
}

console.log(`=== Colored Dot Analysis (${results.length} feats with dots) ===\n`);
for (const r of results) {
    console.log(`FEAT: ${r.name}`);
    if (r.coloredDots.length > 0) {
        console.log(`  COLORS: ${r.coloredDots.map(d => `#${d.color}×${d.count}`).join(', ')}`);
    } else {
        console.log(`  NO COLOR (plain dots)`);
    }
    console.log(`  CONTEXT: ...${r.context}...`);
    console.log();
}
