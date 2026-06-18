# sync-class-from-docx

## Description
Complete workflow for syncing class skill data from docx to HTML + structured JSON. Covers: docx extraction, field correction, Playwright verification, user Q&A for unclear mechanics, and structured skill effects JSON generation.

## When to Use
- User says "做 {职业} {风格} {阶位} 技能" or similar
- User asks to "对照 docx 修正" any class page
- User wants to add new skills to skill_effects JSON

## Workflow Overview

```
Phase 1: DOCX Extraction  →  Phase 1B: Handle Missing Skills  →  Phase 2: Compare & Fix HTML  →  Phase 2B: Sync Data JSON
Phase 3: Playwright Verify  →  Phase 4: User Q&A  →  Phase 5: Write skill_effects JSON  →  Phase 6: Update Schema
```

---

## Phase 1: Extract Data from Docx

Use this Python snippet to extract skills from the target tier/section of a docx file:

```python
import zipfile, re
from xml.etree import ElementTree as ET

ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
docx = r'D:\Download\scholar-agent-main\基础职业-{职业名}.docx'

with zipfile.ZipFile(docx) as z:
    xml = z.read('word/document.xml')
tree = ET.fromstring(xml)
paras = []
for p in tree.iter(f'{{{ns}}}t'):
    paras.append(p.text or '')

# Rebuild paragraphs (text runs are split by formatting)
lines = []
buf = ''
for t in paras:
    if t == '': 
        if buf: lines.append(buf); buf = ''
    else: buf += t
if buf: lines.append(buf)
```

**Key extraction parameters:**
- `{职业名}` = the class name in Chinese (战士, 法师, etc.)
- Find the tier section header (e.g., "三阶天赋树")
- Each skill is: name line → field lines (施展时间/距离/持续/FP/关键词/条件/限制/费用/描述)
- Stop when you hit the next tier header or style header

### ⚠️ CRITICAL: Always Read Raw Docx Lines Directly

**NEVER trust automated skill-name-to-field matching scripts.** The docx has two occurrences of each skill name:
1. **Skill list** (at tier header): just the name, followed by other skill names
2. **Actual skill entry** (further down): name + full field data

Automated scripts that search for a skill name and grab the NEXT N lines will frequently:
- Pick up the WRONG skill's fields (matching the list entry instead of the real entry)
- Attribute one skill's 关键词/前置条件 to another skill
- Miss the actual skill entry entirely when multiple skills share similar names

**Always do this instead:**
```bash
python -c "
# Dump ALL raw lines around every occurrence of a skill name
for i,p in enumerate(paras):
    if p.strip() == 'TARGET_SKILL_NAME':
        print(f'=== L{i} ===')
        for j in range(i, min(i+22, len(paras))):
            l = paras[j].strip()
            if l: print(f'  L{j}: {l[:200]}')
        print()
"
```

**Then visually verify**: the correct occurrence is the one that has `前置条件：`, `施展时间：`, `关键词：` etc. within the first 5 lines after the name. The skill-list occurrence will just have other skill names after it.

This is NOT a data volume issue — it's an accuracy issue. Reading 5-6 skills' raw lines is ~30 lines each, negligible to read.

**Field mapping:**
| Docx field | HTML `<span class="field">` |
|-----------|--------------------------------|
| 施展时间：VALUE | `<span class="field">施展时间：</span>VALUE` |
| 施展距离：VALUE | `<span class="field">施展距离：</span>VALUE` |
| 持续时间：VALUE | `<span class="field">持续时间：</span>VALUE` |
| 疲劳消耗：VALUE | `<span class="field">疲劳消耗：</span>VALUE` |
| 关键词：VALUE | `<span class="field">关键词：</span>VALUE` |
| 施展条件：VALUE | `<span class="field">施展条件：</span>VALUE` |
| 施展限制：VALUE | `<span class="field">施展限制：</span>VALUE` |
| 费用：VALUE | `<span class="field">费用：</span>{dots}` |
| 前置条件：VALUE | `<span class="field">前置条件：</span>VALUE` |
| 额外条件：VALUE | `<span class="field">额外条件：</span>VALUE` |

---

## Phase 1B: Handle Missing Skills (Entire Tier Missing from HTML)

**Before Phase 2 comparison, check whether the HTML even contains the target skills.** It's common for higher tiers to be entirely absent from the HTML — the docx has the data but it was never transcribed.

### How to Detect
1. After Phase 1, grep for the skill IDs in the HTML (e.g., `m-skill-1-6-\d`)
2. If **zero results**: the entire tier is missing → create from scratch
3. If partial: create missing ones, compare existing ones

### Creating From Scratch: 4 Things to Create

#### A. Content Section
Insert before the closing `</section>` of the current style. Template per skill:
```html
<article class="skill" id="m-skill-{style}-{tier}-{index}" data-search="{styleName} {tierName} {skillName} {keywords...}">
<h4>{skillName} <span class="chip" style="background:rgba(0,0,0,0.08);border-color:{styleColor}">{styleName} · {tierName}</span></h4>
<div class="chips">{keyword chips}</div>
<div class="detail">
  <p><span class="field">前置条件：</span>{prereq}</p>  <p><span class="field">额外条件：</span>{extra}</p>
  <p><span class="field">施展时间：</span>{time}</p>  <p><span class="field">施展距离：</span>{range}</p>  <p><span class="field">持续时间：</span>{duration}</p>  <p><span class="field">疲劳消耗：</span>{fp}</p>
  <p><span class="field">关键词：</span>{keywords}</p>  <p><span class="field">施展条件：</span>{condition}</p>  <p><span class="field">施展限制：</span>{limit}</p>
  <p><span class="field">费用：</span>{cost dots}</p>  <p><span class="field">描述：</span>{flavor}</p>
  {description paragraphs + level upgrades}
</div>
</article>
```

#### B. Nav Sidebar
Insert `<details class="nav-tier">` before the closing `</details>` of the style group:
```html
<details class="nav-tier"><summary class="tier-summary"><a href="#m-tier-{style}-{tier}">{tierName}</a></summary>
<a class="skill-link" href="#m-skill-{style}-{tier}-1">...</a>
</details>
```

#### C. Data JSON
Append new entries to `职业页/数据/{职业名}.json`:
```python
{'id':'m-skill-X-Y-Z','name':'...','type':'...','style':'...','tier':N,
 'tags':[...], 'fields':{'施展时间':'...','施展距离':'...',...}}
```

#### D. Skill Effects JSON
Append to `斯诺德跑团/skill_effects_{职业名}.json` during Phase 5 as usual.

### Key Points
- **Cost dots**: `<span style="font-size:1.5em;color:#XXXXXX">●</span>` format
- **Style colors**: 塑能=#FFA387, 咒法=#B3E7FF, 预言=#AFFFE6, 防护=#FBFF81, 附魔=#D0A5FF, 死灵=#FFFFFF, 幻术=#FFCBFF, 变化=#FFC47D
- **data-search**: style + tier + skill name + all keyword chips
- **No duplicate `<p>技能名</p>`** — skills created from scratch don't have this bug
- **Choice notes**: add `<div class="choice-note">抉择：A/B</div>` before tier `</div>`
- **Unlock text**: copy from adjacent tiers; verify tier unlock XP against docx

---

## Phase 2: Compare & Fix

For each skill found in Phase 1, find the corresponding `<article id="...">` in `职业页/{职业名}.html` and compare EVERY field.

### 15-Point Checklist

| # | Check | Method |
|---|-------|--------|
| 1 | Skill name | `<h4>` vs docx |
| 2-10 | All field values | Compare against Phase 1 output |
| 11 | ⚠️ Cost dot count & colors | Count `●` and verify hex colors |
| 12 | Description text | Compare `<p>` content paragraph-by-paragraph |
| 13 | Level upgrades | Check `<span class="field">你的X级时：</span>` |
| 14 | Contamination | Check if next section's headers leaked into detail div |
| 15 | Duplicate `<p>` skill name | Remove `<p>技能名</p>` from start of detail |

### Cost Dot Colors
| Color | Hex |
|-------|-----|
| 红 | #FF0000 |
| 橙 | #EE822F |
| 黄 | #FFF32F |
| 绿 | #00FA99 |
| 青 | #00B0F0 |
| 蓝 | #B3F9FF |
| 紫 | #B94BFF |
| 粉 | #FFB7E3 |
| 棕 | #843F0B |
| 白 | #FFFFFF |
| 黑 | #595959 |
| 无色 | #D9D9D9 |

### Fix Tool
Use the `edit` tool for each fix. Match exact file content (indentation, smart quotes, etc.). Test after each edit.

---

## Phase 2B: Sync Data JSON

After fixing HTML, sync `职业页/数据/{职业名}.json` with the corrected field values.

### Automated: 1:1 Field Mapping (Batch Script)
These fields have a direct 1:1 mapping between skill_effects JSON and data JSON — safe to batch-sync:

| data JSON field | skill_effects source |
|-----------------|---------------------|
| `fields.施展时间` | `cast.time` |
| `fields.施展距离` | `cast.range` |
| `fields.持续时间` | `cast.duration` |
| `fields.疲劳消耗` | `cost.fp` |

```python
import json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

data = json.load(open(r'职业页/数据/{职业名}.json', 'r', encoding='utf-8'))
fx = json.load(open(r'斯诺德跑团/skill_effects_{职业名}.json', 'r', encoding='utf-8'))

fx_by_id = {s['id']: s for s in fx['{职业名}']}
fixes = 0

for skill in data['skills']:
    sid = skill['id']
    if sid not in fx_by_id:
        continue
    f = fx_by_id[sid]
    df = skill.get('fields', {})
    cast = f.get('cast', {})
    cost = f.get('cost', {})
    
    for fname, key in [('施展时间','time'),('施展距离','range'),('持续时间','duration')]:
        exp = cast.get(key, '')
        if exp and df.get(fname, '') != exp:
            df[fname] = exp
            fixes += 1
    
    fp = cost.get('fp')
    if fp is not None and fp >= 0:
        fp_str = str(fp)
        if df.get('疲劳消耗', '') != fp_str:
            df['疲劳消耗'] = fp_str
            fixes += 1

json.dump(data, open(r'职业页/数据/{职业名}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print(f'Fixed {fixes} field values')
```

### Manual: Keywords, Tags, Descriptions
These fields require human judgment during Phase 2 because:
- **关键词**: data JSON includes type prefix (`战技.近战攻击`), compound keywords (`短休/长休`), and豁免 DCs — none of which exist in skill_effects tags. Only the person doing the docx comparison knows which keywords are errors.
- **tags**: data JSON tags match the full keyword set, not the AI-facing simplified subset.
- **描述 / level_upgrades**: Content, not structural — only fix when Phase 2 comparison found explicit text errors.

**How to fix manually**: during Phase 2, when you find a keyword/tag/description error via docx comparison:
1. Fix it in the HTML with `edit` (Phase 2)
2. **Immediately** fix the same error in `数据/{职业名}.json` with `edit` (same tool, same corrected value)
3. This keeps both files in sync as you go, rather than trying to batch-fix later

### ⚠️ Keyword Format Difference
| File | Keywords format | Example |
|------|----------------|---------|
| `数据/{name}.json` → `fields.关键词` | Type prefix + full keywords | `战技.近战攻击` |
| `skill_effects_{name}.json` → `tags` | AI-facing subset (no type, no DCs) | `["近战攻击"]` |
| `职业页/{name}.html` → `<span class="field">关键词：</span>` | Same as docx | `战技.近战攻击` |

**Never use `'.'.join(fx_tags)` to rebuild data JSON's 关键词** — fx_tags is a simplified subset that lacks type prefix,豁免 DCs, and compound keywords.

---

## Phase 3: Playwright Verify

Run Playwright test against the live site. Wait 50s for Cloudflare Pages deployment.

```python
import asyncio, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        page = await b.new_page()
        pcount = fcount = 0
        
        await page.goto('https://snode-rpg.pages.dev/{class_page_url}', wait_until='networkidle')
        await page.wait_for_timeout(2000)
        
        # For each fixed skill:
        for sid, field, expected, name in tests:
            loc = page.locator(f'#{sid} .detail p')
            texts = await loc.all_text_contents()
            found = any(f'{field}：{expected}' in t for t in texts)
            if found: pcount += 1; print(f'PASS {name}: {field}={expected}')
            else: fcount += 1
        
        print(f'\nResult: {pcount} pass / {fcount} fail')
        await b.close()

asyncio.run(main())
```

**Commit**: `git add "职业页/{职业名}.html" && git commit -m "fix: ..." && git push`

---

## Phase 4: User Q&A for Unclear Mechanics

**BEFORE writing JSON effects, ask the user about anything unclear in the skill's mechanics.**

### What to Ask About

| Signal | Question to Ask |
|--------|----------------|
| skill mentions "附加属性" | Which attribute? STR/DEX/key attr? |
| skill mentions "优势" | Hit advantage or damage advantage? |
| skill mentions an unusual range | How does "X米" or grid coordinate work? |
| skill has conditionals | What happens when condition NOT met? |
| skill mentions a game term you don't fully know | Ask for clarification. Reference the help page (§7 异常状态) to verify status effects. |
| skill mentions "每个自身回合" | Once per own turn? Does reaction count? |
| skill mentions "每场战斗限一次" | Per encounter? Reset on short rest? |
| skill has a D100 random table | Is it worth fully expanding? |

### How to Ask
Use `question` tool with concise options. Don't over-ask — only genuine uncertainties. Use the existing help page and schema for reference before asking.

---

## Phase 5: Write Skill Effects JSON

Open `斯诺德跑团/skill_effects_{职业名}.json` and append new skill entries.

### JSON Template

```json
{
  "id": "w-skill-1-3-1",
  "name": "二连斩",
  "class": "战士",
  "style": "斗争风格",
  "tier": "三阶天赋树",
  "type": "战技",
  "tags": ["近战攻击", "连续攻击"],
  "cost": { "fp": 4, "sp": ["橙", "黑"] },
  "cast": { "time": "1动作", "range": "近战", "duration": "立即" },
  "prerequisite": "...",
  "extra_condition": "...",
  "requirement": "...",
  "restriction": "...",
  "effects": [
    "效果描述一行一条",
    "优势用（2D20取高）",
    "伤害骰用 XdY 格式",
    "L{等级}: 升级描述"
  ],
  "upgrades": [
    { "level": 8, "change": "描述" }
  ]
}
```

### Effects Writing Rules
- **One effect per line**, natural language, not over-structured
- **优势/劣势** must include dice notation: `（2D20取高）`, `（3D20取最低）`
- **伤害骰**: `1D6`, `2D10+力量调整值`
- **固定加伤**: `+5`, `+10`
- **暴击**: `（暴击时全部加总伤害×2）`
- **升级**: `L{level}: {change description}`
- **状态赋予**: use exact status names from help page §7
- **免疫/减伤**: `完全免疫{type}伤害`, `{type}伤害减半`

---

## Phase 6: Update Schema

If a new mechanical pattern was discovered in this batch, update `skill_effects_schema.md`:

- Add new effect prefix to the table
- Add new game rule clarification
- Add new color or status reference
- Update examples if a better pattern emerged

---

## Reference: Key Files

| File | Purpose |
|------|---------|
| `基础职业/{name}.docx` | Ground truth for all skill data |
| `职业页/{name}.html` | HTML skill page (target for fixes) |
| `职业页/数据/{name}.json` | Data JSON for site rendering/filtering (sync after HTML fix) |
| `斯诺德跑团/skill_effects_{name}.json` | Structured skill data for AI assistant |
| `斯诺德跑团/skill_effects_schema.md` | JSON schema documentation |
| `斯诺德跑团/帮助.html` | Game rules reference (§7 异常状态, §8 关键词) |

---

## Quick Start per Class

### 战士 (Warrior)
- **Docx**: `基础职业-战士.docx`
- **HTML**: `职业页/战士.html`
- **Starting skills**: w-starting-skill-1~4
- **斗争风格 tier 1**: w-skill-1-1-1~2
- **斗争风格 tier 2**: w-skill-1-2-1~3
- **斗争风格 tier 3**: w-skill-1-3-1,2,4 (note: 1-3-3 is the choice note, not a skill)
- **斗争风格 tier 4**: w-skill-1-4-1~2
- **斗争风格 tier 5**: w-skill-1-5-1

### 萨满祭司 (Shaman)
- **Docx**: `基础职业-萨满祭司.docx`
- **HTML**: `职业页/萨满祭司.html`
- **Skills**: sa-skill-1~102

### 法师 (Mage)
- **Docx**: `基础职业-法师.docx`
- **HTML**: `职业页/法师.html`
- **Skills**: m-skill-{style}-{tier}-{index}

### 吟游诗人 (Bard)
- **Docx**: `基础职业-吟游诗人.docx`
- **HTML**: `职业页/吟游诗人.html`
- **Skills**: b-skill-1~119

(Extend for all 14 classes as needed)
