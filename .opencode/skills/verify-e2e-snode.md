# verify-e2e-snode

## Description
End-to-end Playwright verification workflow for character upload → panel display data consistency. Uploads xlsx character files to the live site, captures parsed state, opens the character panel, and compares DOM data against ground truth. Fix → deploy → verify loop.

## When to Use
- After any change to `上传角色.html`, `panel_engine.js`, or `panel_data.js`
- User wants to verify that uploaded characters display correctly in the panel
- User says "verify", "check data", "compare with ground truth", "E2E test"
- Before releasing a new version

## Prerequisites
- Playwright installed (`npm install playwright`)
- Live site deployed: `https://snode-rpg.pages.dev/斯诺德跑团/`
- Test xlsx files in project root

## Workflow (Fix → Deploy → Verify Loop)

### Step 1: Write/Run Verification Script
```
1. Open `https://snode-rpg.pages.dev/斯诺德跑团/上传角色.html`
2. Upload test xlsx via `page.locator('input[type=file]').setInputFiles(xlsxPath)`
3. Handle dialogs in order:
   - `#warnKeep` (tier violation) → click
   - `#xpSpConfirmBtn` (XP/SP picker) → click
   - `#bgSkipBtn` (background picker) → click
   - `button:has-text("全部采用计算值")` → click
4. Capture state via `window._getState()` before clicking "确认导入"
5. Open panel: `角色面板.html?char=NAME&slot=1`
6. Read DOM: `#class-row`, `#feat-list`, `#talent-grid`, `#skill-table-body`, `#attr-grid`, `#story-block`
7. Compare against ground truth
```

### Step 2: Analyze Discrepancies
- Compare each field against ground truth
- Common failures and fixes:
  | Symptom | Likely Cause | Fix Location |
  |---------|-------------|--------------|
  | Skills count = 0 | `findCell("技能列表")` returns null | Check xlsx regex parser |
  | Attrs all 10 | `scanLabelNum` matches wrong row | Use direct row fallback |
  | Styles include "通用" | `autoCalcStyles` counts universal talents | Add `.filter(s=>s!=="通用")` |
  | Extra class in slot 3 | `findClassNameNear` fallback | Remove fallback |
  | Story = "背景故事" | `scanLabel` matches section header | Read H16 directly |
  | Level = 46/47/50 | `cn()` returns string index | Use `parseInt(cells[])` |
  | Subclass deduped | Stripped name comparison | Compare `_rawName` |
  | Brace error "Illegal return" | Unmatched `{`/`}` | Count braces, fix balance |

### Step 3: Fix Code
- Modify `上传角色.html` or `panel_engine.js`
- Verify braces: `node -e "... new (require('vm').Script)(s)"`
- Add direct row fallbacks for edge cases

### Step 4: Deploy
```bash
# Sync mirror
Copy-Item "斯诺德跑团\上传角色.html" "electron-app\斯诺德跑团\上传角色.html" -Force

# Commit and push
git add "斯诺德跑团/上传角色.html" "electron-app/斯诺德跑团/上传角色.html"
git commit -m "fix: description"
git push origin master

# Wait for deploy (~3-4 minutes for Cloudflare Pages)
Start-Sleep -Seconds 240
```

### Step 5: Re-Verify
- Run verification script again
- If all pass → done
- If still failing → go to Step 2

## Verification Script Template

```javascript
const { chromium } = require('playwright');
const path = require('path');
const BASE = 'https://snode-rpg.pages.dev/斯诺德跑团';
const UPLOAD = BASE + '/上传角色.html';

// Ground truth for each test character
const GT = {
  label: { n:'name', r:'race', mc:'主Class', ml:level, sc:'子Class', sl:level,
           bg:'background', s3:false, noBd:true, stMin:20,
           st:{力量:10,敏捷:10,...},
           excludeStyle:'通用' },
};

async function verifyOne(page, xlsxFile, gt, label) {
  await page.goto(UPLOAD, {waitUntil:'load'});
  await page.waitForTimeout(1500);
  await page.locator('input[type=file]').setInputFiles(path.join(XLSX_DIR, xlsxFile));
  
  // Dialog handling loop (up to 10 iterations)
  for(let i=0; i<10; i++) {
    await page.waitForTimeout(1500);
    // Handle each dialog type...
    // Capture state via window._getState()
    // Compare against ground truth
  }
}

(async() => {
  const browser = await chromium.launch({headless:true});
  const page = await (await browser.newContext()).newPage();
  page.on('dialog', async d => { await d.dismiss(); });
  
  let ok = true;
  if(!await verifyOne(page, 'file1.xlsx', GT.char1, 'CHAR1')) ok = false;
  if(!await verifyOne(page, 'file2.xlsx', GT.char2, 'CHAR2')) ok = false;
  
  console.log('\n=== ' + (ok ? 'ALL PASS' : 'SOME FAIL') + ' ===');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
```

## Test Files
- `冒险者角色档案fulan.xlsx` — 血族 法师/战士, background=运动员
- `冒险者角色档案leimi.xlsx` — 血族 吟游诗人/法师, background=艺人
- `基尼泰·梅.xlsx` — 人类 牧师/牧师, background=画师, format=异常(R列天赋)

## Key Ground Truth Data
See `D:\Download\scholar-agent-main\.opencode\plans\extract_mqs.md` for xlsx extraction patterns.
