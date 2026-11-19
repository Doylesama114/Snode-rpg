# 前端架构（结构 / 逻辑 / 样式）

> HTML 结构、JS 模块、CSS 体系、筛选与搜索、移动端适配。
> 来源：项目文档.md（拆分于 2026-11-19）

## 3. 系统架构

### 3.1 整体架构

项目采用 **模块化架构**，核心角色系统拆分为 5 个文件：

```
斯诺德跑团/
├── 角色面板.html      # 薄壳加载器 (115行) — <link> + <script src> only
├── panel.css           # 全部样式 (290行)
├── panel_data.js       # 全量数据 (~1160行) — 所有 REF_*/SKILL_DATA 等
├── panel_engine.js     # 纯引擎 (~6430行) — 126函数 + xlsx导出 + save/load
├── 导出立绘.js          # OOXML 立绘嵌入模块
├── bug-report.js       # 全局Bug反馈按钮
├── changelog.js        # 更新日志
├── tests.html          # 运行时测试 (46断言)
├── 启动台.html          # 统一入口（版本号 + 检查更新 + 更新日志 + CN镜像）
├── 角色创建页.html       # 多步骤向导
├── 上传角色.html         # xlsx 导入 + 模糊匹配
├── 角色选择页.html       # localStorage 存档列表
├── 角色存档页.html       # 每角色3存档位
└── 帮助.html            # 规则文档

electron-app/
├── main.js             # Electron 主进程（autoUpdater + IPC + Bug反馈）
├── preload.js          # 渲染进程桥接（IPC通信）
├── package.json        # v1.0.6104, Electron 22
├── poker-game/         # 斯诺德对决构建产物（robocopy 自 poker-game-main/dist）
├── electron-builder.yml # NSIS 安装器配置
└── spawn_monkey_patch.js # Windows spawn补丁（CI 中勿用）

poker-game-main/        # 斯诺德对决 Vue 3 源码
├── src/data/cardDatabase.ts
├── src/game/effectManager.ts
├── src/utils/deckValidation.ts / deckPoolFilter.ts / deckSlots.ts
├── src/views/Game/     # DeckBuilder / Home / MultiplayerLobby / CardGame*
└── server/             # 联机权威服务端

`
启动台.html  ← 统一入口
├── 角色系统（斯诺德跑团/）
│   ├── 角色面板.html      ← 核心角色卡
│   ├── 角色创建页.html     ← 创建向导
│   ├── 上传角色.html       ← xlsx 导入
│   ├── 角色选择页.html     ← 存档列表
│   └── 主页.html          ← 主页
├── 职业技能浏览（职业页/）
│   ├── 首页.html          ← 职业选择
│   ├── {职业名}.html       ← 15 个技能详情页
│   └── {职业名}·进阶.html   ← 15 个进阶详情页
├── 斯诺德对决（electron-app/poker-game/）
│   ├── index.html         ← Vue SPA（hash 路由）
│   └── 卡组构筑 / 单机 / 联机
└── 帮助.html             ← 规则文档
`
<div class="class-view" id="view-{职业ID}">
  <a href="#" class="back-btn">← 返回</a>
  <header>
    <div class="topbar">
      <h1>职业名</h1>
      <input id="{前缀}-search" type="search">
    </div>
  </header>
  <main>
    <nav> 目录导航
      <div class="filter-bar" id="{前缀}-filter-bar"></div>
      <a class="style-link" href="#起始特性">起始特性</a>
      <details class="nav-group">
        <summary><a href="#风格ID">风格名</a></summary>
        <details class="nav-tier">
          <summary><a href="#阶位ID">X阶天赋树</a></summary>
          <a class="skill-link" href="#技能ID">技能名</a>
        </details>
      </details>
    </nav>
    <div class="content">
      <div class="empty" id="{前缀}-empty"></div>
      <section class="style starting"><!-- 起始特性 --></section>
      <section class="style"><!-- 风格1 --></section>
      ...
    </div>
  </main>
  <script>该职业的关键词筛选和搜索逻辑</script>
</div>
`

### 3.3 ID 前缀系统

为避免多职业视图共存时的 ID 冲突，每个职业使用唯一的前缀：

| 职业 | view ID | HTML 前缀 | JS 前缀 |
|------|---------|-----------|---------|
| 战士 | view-warrior | w- | w_ |
| 法师 | view-mage | m- | (独立实现) |
| 游荡者 | view-r | r- | r_ |
| 吟游诗人 | view-bard | b- | b_ |
| 蛮斗士 | view-berserker | be- | be_ |
| 猎人 | view-hunter | h- | h_ |
| 圣骑士 | view-paladin | pa- | pa_ |
| 德鲁伊 | view-druid | d- | (IIFE) |
| 武僧 | view-monk | mo- | (IIFE) |
| 牧师 | view-priest | pr- | (IIFE) |
| 术士 | view-warlock | wl- | (IIFE) |
| 魔契师 | view-pact | pt- | (IIFE) |
| 奇械师 | view-artificer | ar- | (IIFE) |
| 萨满祭司 | view-shaman | sa- | sa_ |
| 通用天赋树 | view-general | - | (IIFE) |

---

## 4. 完整工作流程

### 4.1 步骤一：docx → 文本提取

`python
import zipfile, xml.etree.ElementTree as ET
with zipfile.ZipFile(path) as z:
    with z.open("word/document.xml") as f:
        tree = ET.parse(f)
ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
texts = [t.text for t in tree.iter(ns + "t") if t.text]
full_text = "\n".join(texts)
`

### 4.2 步骤二：段落解析

将文本按 ----- 分割为段落块，识别段落类型：

- **风格段落**：以"风格"结尾的段落名
- **天赋树段落**：以"阶天赋树"结尾的段落
- **技能段落**：包含"前置条件"、"施展时间"等字段
- **描述段落**：纯描述文本（技能间的分隔文字）
- **基础属性段落**：生命值、疲劳值、熟练项、装备

### 4.3 步骤三：HTML 生成

为每个技能生成 HTML 卡片：

`html
<article class="skill" id="w-skill-1" data-search="战技 近战攻击 猛击 ...">
  <h4>技能名 <span class="chip" style="background:#888">风格名 · 位阶</span></h4>
  <div class="chips">
    <span class="chip kw-chip" data-kw="关键词1">关键词1</span>
    <span class="chip kw-chip" data-kw="关键词2">关键词2</span>
  </div>
  <div class="detail">
    <p><span class="field">施展时间：</span>1动作</p>
    <p><span class="field">费用：</span><span style="color:#FF0000">●</span></p>
    <p>描述...</p>
  </div>
</article>
`

### 4.4 步骤四：生成单个职业 HTML

对每个职业，生成包含以下部分的独立 HTML：

1. **导航侧栏**（<nav>）：风格 → 天赋树 → 技能链接的层级结构
2. **技能详情区**（<div class="content">）：按风格分组，显示所有技能
3. **搜索框**（<input type="search">）
4. **关键词筛选栏**（<div class="filter-bar">）
5. **该职业的 JS 筛选逻辑**（IIFE 包裹）

### 4.5 步骤五：合并多职业到单一文件

`html
<div class="class-view active" id="view-mage">...</div>
<div class="class-view" id="view-warrior">...</div>
<div class="class-view" id="view-next">...</div>
`

所有职业共用一个 <header> 顶栏和全局 CSS/JS，使用 showView() 切换显示。

### 4.6 步骤六：添加公共功能

1. **首页**（iew-home）：职业选择卡片网格
2. **showView()**：切换职业视图
3. **关键词筛选**：每个职业独立的 IIFE 隔离
4. **搜索**：全文搜索 + 文本高亮
5. **移动端适配**：浮动目录按钮、抽屉式导航

### 4.7 职业配置模板

每个职业在生成过程中使用统一的配置字典：

```python
CLASS_CONFIG = {
    "mage": {
        "prefix": "m",
        "name": "法师",
        "styles": ["塑能", "咒法", "预言", ...],
        "style_colors": {"塑能": "#FFA387", ...},
        "search_placeholder": "搜索技能、风格、阶位、关键词或正文...",
    },
    "warrior": {
        "prefix": "w",
        "name": "战士",
        "styles": ["斗争", "狂攻", "防护", "射击", "军团", "机敏"],
        "style_colors": {...},
    },
    # ... 其他职业
}
```

### 4.8 添加新职业的步骤（v1.03+）

1. **解析 docx** — 运行解析脚本提取文本结构
2. **生成 HTML** — 生成单一职业的独立 HTML 文件
3. **放入职业页目录** — 将生成的 HTML 文件放入 `职业页/`
4. **同步到 electron-app** — 复制或直接编辑 `electron-app\职业页\` 中的对应文件
5. **更新首页** — 在 `首页.html` 中添加新职业的选择卡片和链接
6. **打包** — 运行 `electron-app\更新打包.bat` 重新生成 exe
7. **发布** — 将新 exe 复制到 `发布版文档\`，更新版本号

（自 WORKFLOW_SUMMARY.md 合并）

---

## 5. HTML 结构详解

### 5.1 首页（view-home）

首页以网格形式展示所有职业的卡片，每个卡片包含职业图标和名称：

`html
<a class="class-card available" data-view="mage">
  <div class="class-icon">🧙</div>
  <div class="class-name">法师</div>
</a>
`

点击卡片时触发 data-view 属性，调用 showView() 切换到对应职业视图。

### 5.2 职业视图（class-view）

每个职业视图包含：返回按钮、顶栏（标题 + 搜索框）、侧栏导航、技能内容区域。

### 5.3 技能卡片结构

`html
<article class="skill" id="w-skill-1" data-search="技能名 风格 位阶 关键词 描述文字">
  <h4>技能名
    <span class="chip" style="background:#888">风格名 · 位阶</span>
  </h4>
  <div class="chips">
    <span class="chip kw-chip" data-kw="关键词1">关键词1</span>
    <span class="chip kw-chip" data-kw="关键词2">关键词2</span>
  </div>
  <div class="detail">
    <p><span class="field">前置条件：</span>...</p>
    <p><span class="field">额外条件：</span>...</p>
    <p><span class="field">施展时间：</span>1动作</p>
    <p><span class="field">费用：</span><span style="font-size:1.5em;color:#FF0000">●</span></p>
    <p>描述文字...</p>
  </div>
</article>
`

---

## 6. JavaScript 功能实现

### 6.1 视图切换（showView）

全局函数 showView(viewId) 控制职业视图的显示与隐藏：

`javascript
function showView(viewId) {
    document.querySelectorAll(".view-home, .class-view").forEach(function(el) {
        el.classList.remove("active");
        el.style.display = "none";
    });
    if (viewId === "home") {
        document.getElementById("view-home").style.display = "";
    } else {
        document.getElementById("view-" + viewId).style.display = "block";
    }
    window.scrollTo(0, 0);
}
`

### 6.2 首页点击事件

通过文档级事件委托捕获职业卡片点击：

`javascript
document.addEventListener("click", function(e) {
    var card = e.target.closest(".class-card.available");
    if (card && card.dataset.view) {
        showView(card.dataset.view);
    }
});
`

### 6.3 返回按钮

返回主页时重置搜索、筛选和高亮状态，调用 _clearHighlights() 清除所有搜索高亮标记。

### 6.4 搜索高亮系统

使用 TreeWalker 遍历文本节点，创建 <span class="search-highlight"> 包裹匹配文本，实现不影响 DOM 结构的高亮效果，带闪烁动画。

---

## 7. CSS 样式体系

### 7.1 CSS 变量

`css
:root {
    --bg: #f6f4ef;
    --panel: #fffdf8;
    --ink: #1f2522;
    --muted: #69706b;
    --line: #d8c2d4;
    --red: #9d2f2f;
    --green: #2f6f5e;
    --gold: #a46d1f;
    --blue: #315f8f;
    --shadow: 0 16px 40px rgba(31, 37, 34, 0.09);
}
`

### 7.2 关键 CSS 类

| 类名 | 作用 |
|------|------|
| .class-view | 职业视图容器，默认 display:none |
| .class-view.active | 激活视图，display:block |
| .filter-hidden | 关键词筛选隐藏 |
| .hidden | 搜索隐藏 |
| .filter-active | 已选中的关键词芯片（绿色高亮） |
| .filter-inactive | 未选中的关键词芯片（半透明） |
| .filter-tag | 筛选栏中的已选标签 |
| .search-highlight | 搜索高亮标记（带闪烁动画） |
| .empty | 无匹配结果提示 |

### 7.3 搜索高亮动画

`css
.search-highlight {
    background: #ffdd00;
    color: #000 !important;
    animation: search-blink 0.8s ease-in-out 3;
}
@keyframes search-blink {
    0%, 100% { background: #ffdd00; }
    50% { background: #ff8800; }
}
`

---
