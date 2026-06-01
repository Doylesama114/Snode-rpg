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

## Debug Checklist（每次修复后检查）

- [ ] 现象可复现（Playwright 重现原始 bug）
- [ ] 根因已通过代码追踪确认（不猜，亲自走到失败的代码行）
- [ ] 修复方案遵循项目现有模式（不引入新的依赖或范式）
- [ ] 线上部署验证（Playwright 在 pages.dev 上执行）
- [ ] 至少 2 种输入场景测试（单关键词 + 多关键词 + 空结果）
- [ ] electron-app 同步检查
- [ ] Git push + Pages 部署确认
