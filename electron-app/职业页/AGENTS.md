# PROJECT KNOWLEDGE BASE — 职业页（职业技能浏览）

**Generated:** 2026-06-02
**Module:** Class skill tree browser — search, filter, navigate
**Version:** v1.0.549

## OVERVIEW
RPG 职业技能索引系统。31 个独立 HTML 文件（14 基础职业 + 14 进阶 + 通用天赋树 + 通用进阶 + 首页）。每个页面自包含 HTML/CSS/JS，通过公共 `common.css` + `filter.js` 共享筛选逻辑。数据源为 docx → 文本提取 → HTML 生成管道。

## STRUCTURE
```
职业页/
├── 首页.html             # 30 卡片网格 (14基础+14进阶+2通用)
├── 通用天赋树.html        # 通用天赋树 (一~七阶)
├── 通用·进阶.html         # 通用进阶途径
├── {职业名}.html          # 14 个基础职业技能页
├── {职业名}·进阶.html      # 14 个进阶页 (lang属性已统一为 zh-CN)
├── common.css             # 公共样式 (457行) — CSS变量 + 响应式
├── common.js              # 公共脚本 (60行) — _clearHighlights / _applyHighlights
├── filter.js              # FilterController 类 (237行) — 关键词筛选+全文搜索
├── advancement_details.js  # 进阶详情数据 (已格式化, ~1427行)
├── advancement_data.json   # 进阶数据
├── advancement_details.json
├── 数据/                   # JSON 数据文件
│   ├── classes.json        # 14职业定义 (关键属性/护甲/武器/豁免)
│   ├── races.json          # 种族数据
│   ├── backgrounds.json    # 背景数据
│   ├── items.json          # 物品库
│   ├── equipment.json      # 装备库
│   └── {职业名}.json        # 各职业技能结构化数据
└── adv_img_*.png           # 进阶页面插图 (10张)
```

## WHERE TO LOOK
| Task | File | Notes |
|------|------|-------|
| 修改筛选逻辑 | `filter.js` | FilterController: IIFE 包裹，通过 `createFilterController(viewId, prefix)` 实例化 |
| 修改搜索高亮 | `common.js` | TreeWalker 遍历文本节点包裹 `<span class="search-highlight">` |
| 修改样式 | `common.css` | CSS 变量体系: `--bg`, `--panel`, `--ink`, `--muted`, `--line`, `--red`, `--green` |
| 修改职业技能数据 | `数据/{职业名}.json` | 结构化 JSON: `{id, name, skills: [{id, name, type, tags, fields, description}]}` |
| 修改职业定义 | `数据/classes.json` | `key_attr`, `armor`, `weapons`, `hp_formula`, `fp_formula` |
| 修改进阶详情 | `advancement_details.js` | `ADVANCEMENT_DETAILS` 数组 (已格式化为可读多行) |
| 添加新职业 | 参考 `战士.html` 模式 | 需同步 `首页.html` 卡片 + `数据/` JSON |

## HTML 页面结构 (每个职业页)
```
<head> → common.css + 页面特有 <style>
<body>
  ← 返回 链接
  <header> → sticky 顶栏 (职业名 + 搜索框)
  <main> → grid 两列
    <nav> → sticky 侧栏 (filter-bar + 风格/阶位/技能链接)
    <div.content>
      section.style → 风格区块
        section.tier → 阶位
          article.skill → 技能卡片
            h4 + span.chip (风格·阶位标签)
            div.chips → span.chip (关键词)
            div.detail → 前置条件/施展时间/费用/描述
  <script> → IIFE createFilterController + 搜索逻辑
```

## FILTER SYSTEM
- **关键词筛选**: OR 逻辑 — 技能包含任一选中关键词即显示
- **全文搜索**: AND 逻辑 — 基于 `data-search` 属性，空格分隔多关键词
- **筛选+搜索叠加**: `.filter-hidden` (筛选) + `.hidden` (搜索) 同时生效
- **导航联动**: 筛选/搜索时同步展开/隐藏目录分组
- **费用圆圈**: `<span style="font-size:1.5em;color:#FF0000">●</span>`，浅色加 `text-shadow` 描边
- **每个职业独立作用域**: IIFE 包裹，前缀系统避免冲突

## CONVENTIONS
- 类名: `.skill`, `.chips .chip`, `.filter-bar`, `.filter-hidden`, `.hidden`
- ID 前缀: 每个职业唯一 (`w-` 战士, `m-` 法师, `r-` 游荡者...)
- `data-search` 属性: 包含技能名+风格+阶位+关键词+描述全文
- `<span class="chip">`: 不含 "风格"/"天赋树" 的为可点击关键词
- `lang="zh-CN"`: 全部页面统一 (进阶页已修复)
- 移动端: ≤860px 平板 / ≤600px 手机 (浮动☰按钮 + 抽屉导航)

## GOTCHAS
1. **JSON vs SKILL_DATA 结构不同** — JSON: `{id, name, skills:[]}`, SKILL_DATA: `{"职业名": [...]}`
2. **费用颜色提取自 docx 字体颜色** — `<w:color w:val="FF0000"/>` → `color:#FF0000`
3. **费用行必须合并到所属技能** — 不能独立成卡片
4. **浅色技能点需 `text-shadow` 描边** — 白色/浅蓝等需额外处理
5. **Script 标签不能有 BOM** — `\uFEFF` 会导致 JS 解析失败
6. **`closest()` 后代选择器冲突** — 使用手动 DOM 遍历替代
7. **进阶页长按查看详情** — 约2秒触发，带进度动画

## ANTI-PATTERNS
- ❌ 不要直接改 `electron-app/职业页/` — 打包时会从根目录覆盖
- ❌ 不要用文档级事件委托 — 用直接绑定 `.addEventListener`
- ❌ 不要混用 `kw-chip` / `data-kw` 格式 — 统一 `class="chip"`

## DATA PIPELINE (添加新职业)
```
docx → ZIP解压 word/document.xml → 提取 <w:t> 文本 → 按 ----- 分段
→ 识别风格/阶位/技能段落 → 生成 HTML 卡片 → 放入 职业页/
→ 同步到 electron-app\职业页\ → 更新 首页.html 卡片 → 打包
```

## GIT
```
005f540  第一波优化：格式化 + lang修正 + 打包加固 + 文档去重
782a658  初始提交：职业技能浏览
```
