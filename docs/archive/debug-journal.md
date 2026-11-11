# 斯诺德项目 Debug 日志

> 记录每次调试修复的全过程，积累项目专属排错经验。

---

## #1 — 首页全局搜索高亮失效 (2026-06-01)

### 现象

职业页首页新增的全局搜索功能上线后，搜索结果中**匹配关键词完全没有高亮效果**，搜索"猛击"返回 10 条结果，但 `.search-highlight` 元素数量为 0。

### 诊断过程

#### Step 1 — 代码静态审查 (`首页.html`)

定位到 `renderResults()` 函数末尾：

```javascript
var terms = input.value.trim().split(/\s+/).filter(Boolean);
if (terms.length > 0) {
  _applyHighlights(resId, terms);  // ← 调用 common.js 的全局高亮函数
}
```

#### Step 2 — 追踪 `_applyHighlights` → `common.js`

```javascript
function _applyHighlights(viewId, terms) {
  var skills = _q(viewId, ".skill:not(.hidden):not(.filter-hidden)");
  // ...
}

function _q(viewId, sel) {
  var wrapper = document.getElementById(viewId);
  if (wrapper) return wrapper.querySelectorAll(sel);
  return document.querySelectorAll(sel);
}
```

`viewId` = `'search-results-wrap'`（搜索结果容器的 ID）。
在 `#search-results-wrap` 内查找 `.skill` 元素 → **0 个结果**。

#### Step 3 — 确认根因

搜索结果用的是 `<a class="search-result-item">`，不是 `<article class="skill">`。
`_applyHighlights` 的设计目标是个别职业页的技能卡片（`.skill`），不适用于全局搜索的结果结构。

**根因**: 全局搜索的渲染层（`.search-result-item`）与高亮层（查找 `.skill`）使用了不同的 CSS 选择器，导致高亮逻辑完全跳过。

#### Step 4 — Playwright 线上验证

| 检测项 | 结果 |
|--------|------|
| `_q` 查找 `.skill` 元素数 | **0** |
| 搜索结果数 | 10 |
| `.search-highlight` 元素数 | **0** |
| Console 错误 | 无 |

#### Step 5 — 附加问题扫描

在审查过程中发现两个附带问题：
1. **空结果无提示**: `items.length === 0` 时只输出空 `<div>`，用户得不到反馈
2. **common.css 重复定义**: 第 432–442 行和 445–455 行的 `.search-highlight` + `@keyframes search-blink` 完全重复

### 修复方案

#### 修复 1：内联高亮替换 DOM 遍历

不再调用 `_applyHighlights`，改为在 HTML 生成阶段直接用正则替换：

```javascript
function highlightText(text, terms) {
  if (!terms || terms.length === 0) return text;
  var result = text;
  terms.forEach(function(t) {
    if (!t) return;
    var escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var regex = new RegExp('(' + escaped + ')', 'gi');
    result = result.replace(regex, '<span class="search-highlight">$1</span>');
  });
  return result;
}

function renderResults(items) {
  if (items.length === 0) {
    resultsDiv.innerHTML = '<div class="search-status">没有找到匹配的技能</div>';
    return;
  }
  var terms = input.value.trim().split(/\s+/).filter(Boolean);
  resultsDiv.innerHTML = items.map(function(it) {
    var hlName = highlightText(it.skillName, terms);
    var hlSnippet = highlightText(it.snippet, terms);
    var hlStyle = highlightText(it.style, terms);
    return '<a class="search-result-item" href="' + it.classname + '.html#' + it.skillId + '">' +
      '<div class="result-class">' + it.classname + '</div>' +
      '<div class="result-name">' + hlName + '</div>' +
      '<div class="result-meta"><span>' + hlStyle + '</span><span>' + it.tier + '</span></div>' +
      '<div class="result-snippet">' + hlSnippet + '</div>' +
    '</a>';
  }).join('');
}
```

**为什么不用 DOM TreeWalker**（如 `_applyHighlights` 的做法）：
- 全局搜索结果是动态生成的 HTML 字符串，写入 innerHTML 后走 TreeWalker 相当于做两次 DOM 操作
- 正则替换在字符串层面一步到位，性能更好，代码更简单

#### 修复 2：空结果提示

`items.length === 0` 时显示 `"没有找到匹配的技能"`。

#### 修复 3：删除重复 CSS

`common.css` 第 445–455 行删除。

### 验证结果

| 检测项 | 修复前 | 修复后 |
|--------|--------|--------|
| 搜索"猛击"高亮数 | 0 | 9 |
| 搜索"近战 攻击"高亮数 | 0 | 135 |
| 空结果提示 | 空白 | "没有找到匹配的技能" |
| 结果导航点击 | ✅ | ✅ |
| Escape 关闭 | ✅ | ✅ |

### Lessons Learned

1. **复用的陷阱**：`_applyHighlights` 是为职业页技能卡片设计的，直接用于全局搜索的结果结构必然失败。复用时必须确认 DOM 结构兼容。
2. **字符串层面高亮优于 DOM 遍历**：对于动态生成的内容，在 HTML 字符串阶段就做好高亮，比插入 DOM 后再遍历更可靠。
3. **Playwright = 最好的 QA 工具**：对线上部署的静态 HTML 站点，直接用 Playwright 做端到端验证比任何单元测试都可靠。
4. **同步检查 electron-app**：源文件改了但 electron-app 镜像没改是常见遗漏，需要在修复 checklist 中显式检查。
5. **线上测试要绕过 CDN 缓存**：Cloudflare Pages 有缓存，需要加 `?v=` 参数或用硬刷新确保拿到最新版本。

---

## #3 — 卡组构筑与筛选：两套「关键词」逻辑 (2026-07-05)

### 背景

v1.0.6100 起卡组必须恰好 15 张方可保存并进局；v1.0.6101 增加卡池筛选侧栏。职业页关键词为 **OR**，卡组构筑关键词为 **AND**，文档与实现须区分，避免 Agent 复用错逻辑。

### 要点

| 系统 | 文件 | 关键词逻辑 |
|------|------|-----------|
| 职业技能浏览 | `职业页/filter.js` | 多选 OR |
| 卡组构筑 | `deckPoolFilter.ts` | 关键词 AND；类别/属性 OR |

### Lessons Learned

1. **同名概念不同规则**：「关键词筛选」在 TRPG 技能页与卡牌构筑页含义不同，MD 须分节说明（见 `关键词系统注意事项.md` §10）。
2. **校验分层**：构筑页允许临时 >15 张，保存与进局各一层校验（`deckValidation.ts` + 路由 guard + 联机 composable）。
3. **发版三件套**：poker 改动后 `pnpm build` → `robocopy dist` → `bump-version.js`，并更新根目录三 MD。

---

## #4 — 音效：跑团与扑克共用静音键 (2026-07-05)

### 背景

v1.0.6104 引入 Kenney CC0 样本。跑团 `snd.js` 与扑克 `sound.ts` 均读取 `localStorage._snowd_mute`（`'1'` = 静音）。启动台 🔊 切换后，卡组编辑页应同步静音。

### 要点

| 系统 | 入口 | 样本路径 |
|------|------|---------|
| 跑团 UI | `snd.js` | `斯诺德跑团/audio/ui/` |
| 卡组编辑 | `sound.ts` | `poker-game-main/public/audio/cards/` |
| 充能 | `snd.playRef('charge')` | 仍 Web Audio 合成 |

样本加载失败时跑团回退合成；扑克静默跳过。发布前须 `VITE_ELECTRON=1 pnpm run build` 并 robocopy 到 `electron-app/poker-game`，且 `bump-version.js` 会同步 `斯诺德跑团/` → `electron-app/`。

---

## Debug Checklist（每次修复后检查）

- [ ] 现象可复现（Playwright 重现原始 bug）
- [ ] 根因已通过代码追踪确认（不猜，亲自走到失败的代码行）
- [ ] 修复方案遵循项目现有模式（不引入新的依赖或范式）
- [ ] 线上部署验证（Playwright 在 pages.dev 上执行）
- [ ] 至少 2 种输入场景测试（单关键词 + 多关键词 + 空结果）
- [ ] electron-app 同步检查
- [ ] Git push + Pages 部署确认

---

## #2 — 批量费用颜色误改：跳过 Phase 1 锚点的代价 (2026-06-29)

### 现象

萨满祭司火焰 T2/T3 的 "对照修正" 上线后 Playwright 验证发现：原本正确的费用颜色（紫/黄/青/橙/棕等）全部被改成了蓝色 (`#00B0F0`)。

### 诊断过程

#### Step 1 — 回溯 Phase 1 方法
SKILL.md 规定两种提取方式：
- **方法 A（强制）**：输出 raw paras 索引切片 → 肉眼确认 前置条件/施展时间 → 逐字段提取
- **方法 B（禁止）**：XML body-element 自动化脚本匹配（SKILL.md 第 85 行："NEVER trust automated scripts"）

实际使用了方法 B：遍历 `<w:body>` 子元素，搜索技能名 → 在所在 body 内查找费用和颜色。

#### Step 2 — 定位根因
docx 中每个技能名出现两次：
1. **Tier 标题列表**（如 "熔岩武器火炬图腾沸腾点燃炽焰武力"）——在同一个 body element 内
2. **实际技能条目**（含 前置条件/施展时间/费用/描述）——在另一个 body element 内

XML body-element 脚本以技能名为 key 匹配，命中的是 **tier 标题列表所在的 body**（该 body 恰好包含某个技能的完整费用数据），而非目标技能的实际条目。所有 13 个输出均为"红+蓝"，因为恰好命中了召唤火元素所在的 body。

#### Step 3 — 正确提取
用 raw paras 重建文本（逐 `<w:p>` 合并），逐技能定位"费用：●"行，再用 run-level 颜色提取确认。结果：7 种不同颜色组合，仅 1 个技能为红+蓝。

### Lessons Learned
1. **SKILL.md 的警告是血写成的**——"NEVER trust automated scripts"不是建议，是铁律
2. **全相同输出 = 警报**——13 个技能全输出"红+蓝"应立刻怀疑方法学而非信任结果
3. **Phase 1 锚点不可跳过**——输出 raw paras 切片 + 肉眼确认 前置条件/施展时间，这 30 秒的核实能避免 30 分钟的修复

---

## #5 — 26.06.30 色彩标识：面板范围与 DM 待办 (2026-07-06)

### 结论

本软件为**辅助跑团**角色卡工具，非跑团引擎。v1.0.6118 在 `panel_engine.js` 完成：`sp_points` + `color_marks`、wildcard 学习校验、1 SP 学/卸逻辑、移除旧 14 色 SP 弹窗。

**刻意不做**：冥想、关键偏好、专长及各职业「游玩结束授予标识 ●」等效果的自动实现——由 DM 桌面团结算，面板通过 GM 作弊或未来 **DM 结算 UI** 写状态。

### 待办

DM 团队奖励结算页：扫描已学天赋/专长 → 生成分放清单 → 批量更新 `color_marks` / `sp_points`。

### Lessons Learned

1. **辅助软件 ≠ 规则引擎**：多数「标识 ●」文案是 DM 提醒，不是 panel 自动化。
2. **学习链路与效果链路分离**：cost 驱动 `canLearnSkill` 即可；grant 类效果走 DM 结算。
3. **文档同步**：根目录 MD +《职业页同步手册》§一待办。
