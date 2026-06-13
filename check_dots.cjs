const fs = require('fs');
const html = fs.readFileSync('D:/Download/scholar-agent-main/职业页/特殊专长.html', 'utf8');
const names = ['质朴', '共享钱袋', '技能点礼包', '龙棋选手', '创伤后成长', '绿拇指'];

for (const n of names) {
    const re = new RegExp('<article[^>]*?id="(feat-\\d+)"[^>]*?>\\s*<h4>' + n + '</h4>[\\s\\S]*?</article>');
    const m = html.match(re);
    if (m) {
        const art = m[0];
        const featId = m[1];
        const hasColorSpan = /style="[^"]*color:[^"]*"/.test(art);
        const colorCount = (art.match(/style="[^"]*color:#([0-9A-Fa-f]+)[^"]*"/g) || []);
        const colors = colorCount.map(c => {
            const cm = c.match(/color:#([0-9A-Fa-f]+)/i);
            return cm ? '#' + cm[1].toUpperCase() : '?';
        });
        
        // Extract all ● characters and their color context
        const dotRe = /(<span[^>]*?style="[^"]*?color:#([0-9A-Fa-f]+)[^"]*?"[^>]*?>\u25CF<\/span>)|(\u25CF)/g;
        let dm;
        const foundDots = [];
        while ((dm = dotRe.exec(art))) {
            if (dm[1]) {
                foundDots.push({ color: '#' + dm[2].toUpperCase(), hasSpan: true });
            } else if (dm[3]) {
                foundDots.push({ color: 'NONE', hasSpan: false });
            }
        }
        
        console.log(`${featId} ${n}:`);
        console.log(`  Has color spans: ${hasColorSpan}`);
        console.log(`  Unique colors: ${[...new Set(colors)].join(', ') || 'none'}`);
        console.log(`  Dots: ${foundDots.map(d => d.color + (d.hasSpan ? '[span]' : '[RAW]')).join(', ')}`);
        if (foundDots.some(d => !d.hasSpan)) {
            console.log(`  ** HAS BARE DOTS - NEEDS FIX **`);
        }
        console.log();
    } else {
        console.log(`${n}: NOT FOUND`);
    }
}
