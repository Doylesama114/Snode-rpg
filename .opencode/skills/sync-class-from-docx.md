# sync-class-from-docx

## Description
Sync a class (职业) from an updated `.docx` file into the Snode-rpg project. Extracts skill data, regenerates JSON + HTML, audits cost colors and description text, fixes panel references, bumps version, updates docs, and pushes to git.

## When to Use
- User says "update {class} from docx", "sync {class} with docx", "regenerate {class} from docx"
- A `.docx` file in the repo root has been updated
- User wants to add/update a class's skill data

## Workflow

### Phase 1: Extract docx

**Goal**: Extract full text + cost dot colors from `基础职业-{class}.docx`.

```bash
python -c "
import zipfile, xml.etree.ElementTree as ET, json
path = '基础职业-{class}.docx'
ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
with zipfile.ZipFile(path) as z:
    with z.open('word/document.xml') as f:
        tree = ET.parse(f)
root = tree.getroot()
paragraphs = []
for p in root.iter(ns + 'p'):
    para_text = []
    para_colors = []
    for r in p.iter(ns + 'r'):
        color = None
        rpr = r.find(ns + 'rPr')
        if rpr is not None:
            color_el = rpr.find(ns + 'color')
            if color_el is not None:
                v = color_el.get(ns + 'val') or color_el.get('val')
                color = v
        texts = [t.text for t in r.iter(ns + 't') if t.text]
        if texts:
            ft = ''.join(texts)
            para_text.append(ft)
            if color: para_colors.append({'t': ft, 'c': color})
    if para_text:
        paragraphs.append({'text': ''.join(para_text), 'colors': para_colors})
with open('_{class}_raw.json', 'w', encoding='utf-8') as f:
    json.dump(paragraphs, f, ensure_ascii=False)
print(f'Extracted {len(paragraphs)} paragraphs')
"
```

**Deliverable**: `_{class}_raw.json` — all paragraphs with text + color annotations.

### Phase 2: Parse to Structured JSON

**Goal**: Convert raw paragraphs → `_mqishi_parsed.json` (116 skills, 4 styles). Delegate to `ultrabrain` agent.

```
task(category="ultrabrain", run_in_background=false,
  prompt="Write a Python script that parses _{class}_raw.json into _mqishi_parsed.json.
  Identify: class metadata (HP/FP/proficiencies/equipment/feats), styles, tiers,
  skills with ALL fields (施展时间, 施展距离, 持续时间, 疲劳消耗, 关键词, 前置条件, 
  额外条件, 施展条件, 施展限制, 费用 colors, description, level_upgrades, flavor).
  Output format: { class: {...}, skills: [{name, style, tier, fields, cost, description, level_upgrades}] }")
```

**Deliverable**: `_mqishi_parsed.json` — full structured skill data.

### Phase 3: Generate Target JSON

**Goal**: Convert parsed JSON → `职业页/数据/{class}.json` with proper `p-skill-N` IDs, tags from keywords, cost in target format.

```python
# _gen_json.py — convert _mqishi_parsed.json → 职业页/数据/{class}.json
import json
with open('_mqishi_parsed.json', 'r', encoding='utf-8') as f:
    parsed = json.load(f)

sorted_skills = sorted(parsed['skills'],
    key=lambda s: (['起始特性','魔契','邪念','咒能','秘术'].index(s['style']),
                   ['起始特性','一阶天赋树','二阶天赋树','三阶天赋树','四阶天赋树'].index(s['tier'])))

new_skills = []
for i, s in enumerate(sorted_skills):
    keywords = s['fields'].get('关键词', '')
    tags = [kw.strip() for kw in keywords.split('.') if kw.strip()]
    fields = {k: v for k, v in s['fields'].items() if k != '关键词'}
    cost = [{
        'color': '#' + c['color'], 'count': c['count'],
        'name': color_name(c['color']), 'id': color_name(c['color'])
    } for c in s.get('cost', [])]

    new_skills.append({
        'id': f'p-skill-{i+1}', 'name': s['name'], 'tags': tags,
        'fields': fields, 'description': s.get('description', []),
        'cost': cost, 'style': s['style'], 'tier': s['tier'],
        'level_upgrades': s.get('level_upgrades', []),
        'flavor': s.get('flavor')
    })

output = {'id': '{class}', 'name': '{class}', 'skills': new_skills}
with open('职业页/数据/{class}.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)
```

### Phase 4: Generate HTML

**Goal**: Generate `职业页/{class}.html` with nav + skill cards for tiers 1-2 + starting characteristics.

Use `_gen_html.py` as template. Key conventions:
- ID prefix: `pt-` (魔契师), varies per class
- Nav: `<details class="nav-group">` per style, `<details class="nav-tier">` per tier
- Cards: `<article class="skill" id="p-skill-N" data-search="...">` 
- Cost dots: `<span style="font-size:1.5em;color:#XXXXXX">●</span>`
- Light colors (#FFFFFF, #B3F9FF, #FFF32F, #FFB7E3, #D9D9D9, #00FA99) need `text-shadow`
- Filter: IIFE calling `createFilterController('view-pact', 'pt')`
- Subtitle: "{styles}风格 · 一至二阶 · 技能详情 · 关键词搜索"

### Phase 5: Audit & Fix

**5a. Cost color audit** — Compare docx dots vs JSON cost:
```python
# Extract ALL cost dots with colors from docx XML
# Compare to JSON cost entries
# Fix D9D9D9 fallbacks → actual docx colors
```

**5b. Description dot audit** — Find skills with ● in description/level_upgrades:
```python
# Search for chr(0x25CF) in description and level_upgrades
# Extract colors from docx for these dots
# Replace plain ● with <span style="color:#XXXXXX">●</span>
```

**5c. Garbage text audit** — Find skills with merged section headers:
```python
# Search for '---------------------------------------------------------------------' in description/level_upgrades
# Search for '魔契师天赋树', '风格', '阶天赋树职业等级' in text
# Truncate at first garbage marker
```

**5d. Missing description audit** — Find talent skills with 0 description lines:
```python
# Skills with no '施展时间' field and 0 description lines
# Extract description from docx for each
```

### Phase 6: Update Panel Data

**Goal**: Fix `斯诺德跑团/panel_data.js` and `斯诺德跑团/上传角色.html`.

Check and fix:
- `REF_CLASSES.{class}`: `key_attr`, `armor`, `weapons`, `saves`, `skills` — often scrambled
- `REF_SUBCLASS_REQS.{class}`: `attrs` should have key attribute requirement
- `上传角色.html` `_REF_CLASSES.{class}`: `key` must match `key_attr`
- Fix typos like 魔契约师 → 魔契师

### Phase 7: Update Aggregate Files

- `职业页/数据/style_mappings.json` — add all skill → style/tier/name mappings
- `职业页/数据/classes.json` — update style count if changed

### Phase 8: Sync to electron-app

Copy ALL modified files:
```
职业页/数据/{class}.json → electron-app/职业页/数据/
职业页/{class}.html → electron-app/职业页/
职业页/数据/style_mappings.json → electron-app/职业页/数据/
职业页/数据/classes.json → electron-app/职业页/数据/
斯诺德跑团/panel_data.js → electron-app/斯诺德跑团/
斯诺德跑团/上传角色.html → electron-app/斯诺德跑团/
```

### Phase 9: Bump Version & Release

```bash
node bump-version.js X.Y.Z "改动描述1;改动描述2"

# Update 后续更新教程.md version
# Update 项目文档.md version + add history entry

git add -A && git commit -m "bump: vX.Y.Z — {summary}"
git tag vX.Y.Z && git push origin master --tags
```

## Gotchas

1. **Root `changelog.js` is the master source** — `bump-version.js` reads from ROOT, NOT from `斯诺德跑团/`. Fix the ROOT file.
2. **Docx cost dots are U+25CF** — use `chr(0x25CF)` in Python
3. **D9D9D9 is fallback** — any cost with D9D9D9 likely has a real color in the docx
4. **Description dots need color spans** — plain ● renders as default text color, may differ from docx
5. **Talent skills lack description** — parser often misses description for skills without 施展时间
6. **Level upgrade garbage** — last level_upgrade may have next section merged in
7. **Electron-app is deployment mirror** — always sync after modifying source files
8. **PowerShell mangles Chinese output** — use `$env:PYTHONIOENCODING='utf-8'` or write to file
