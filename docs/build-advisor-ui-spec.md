# Build Advisor UI 规格（阶段 8A）

> **版本**：0.1.0  
> **状态**：阶段 8A — 待人工验收  
> **依赖**：阶段 6（DeepSeek CLI）、阶段 7（L6 快照）

---

## 1. 范围

| 包含 | 不包含 |
|------|--------|
| Electron 内可拖动悬浮球 + 右侧侧滑对话面板 | 浏览器 file:// 直连 API（待办） |
| IPC 代理 `mage-advisor.mjs`，Key 仅主进程读 `.env` | 快捷 chips |
| 角色面板自动 L6 快照（可关） | 进阶 A 档可视化（8B） |
| 非法师显示「仅法师 MVP」提示 | 写入角色面板 |

---

## 2. 交互

### 2.1 悬浮球

- 默认位置：右下（`bottom: 24px; right: 24px`）
- 可拖动；松手吸附左/右边缘
- 位置持久化：`localStorage._snowd_advisor_pos`
- 单击：打开/关闭侧滑面板
- 拖动阈值 ~8px，避免误触

### 2.2 侧滑面板

- 宽 400px，高 `min(70vh, 100%)`，自右侧滑入
- 标题「Build 顾问」；最小化/关闭
- 上下文条：纯咨询 / 已绑定角色名·职业·等级
- 非法师：顶部黄条「当前仅支持法师 build 顾问，其他职业后续开放」
- 对话区：纯文本，`white-space: pre-wrap`，不渲染 Markdown
- 输入框 + 发送；Enter 发送，Shift+Enter 换行
- 无快捷 chips

### 2.3 页面可见性

| 页面 | 悬浮球 |
|------|--------|
| 启动台、角色系统、帮助、职业页（file:// 同域） | 显示 |
| `poker-game` / 斯诺德对决 | **隐藏** |
| 非 Electron | 显示但发送时提示需 Electron |

---

## 3. 技术

### 3.1 文件

```
斯诺德跑团/advisor-widget.js      # UI（自注入 CSS）
electron-app/preload.js           # electronAPI.advisorAdvise / advisorConfig
electron-app/main.js              # ipcMain.handle advisor-advise
scripts/mage-advisor.mjs          # 复用 advise()
panel_engine.js                   # window.snowdPanel.getSnapshot()
```

### 3.2 IPC

```javascript
// renderer → main
electronAPI.advisorAdvise({ query, snapshot?: object })
// → { ok, answer?, intent?, model?, error? }

electronAPI.advisorConfig()
// → { ok, configured: boolean, model? }
```

### 3.3 L6 绑定

- `角色面板.html` 且 `snowdPanel.hasCharacter()`：默认「使用当前角色」
- 开关持久化：`localStorage._snowd_advisor_use_char`
- 发送时附带 `getSnapshot()` 归一化前的 raw snapshot（main 侧 normalize）

---

## 4. 验收（阶段 8A）

- [ ] Electron 启动台可见悬浮球，对决页不可见
- [ ] 侧滑面板可问答（需 `.env` 中 `DEEPSEEK_API_KEY`）
- [ ] 角色面板绑定角色后，进阶类问题带 L6（如冰霜法师 ✓/✗）
- [ ] 非法师角色显示 MVP 提示但仍可提问
- [ ] Key 不出现在 renderer / 前端 JS
- [ ] `node scripts/validate-advisor-phase8.mjs` 通过

---

## 5. 待办（非 8A）

- 浏览器模式：本地 `advisor-server` 或用户自配代理
- 职业技能树页 script 标签注入（非 Electron 开发）

---

## 6. 阶段 8B — 进阶 A 档

### 6.1 范围

| 包含 | 不包含 |
|------|--------|
| 从 `advancement_details.js` 抽取 A 档技能 → `advisor/advancement_skills.json` | 全 40 条进阶 HTML 解锁（随源数据增量更新） |
| 检索 L3 注入 documented 技能摘要 | 独立进阶技能树页面 |
| 顾问面板「进阶」Tab：浏览 + 搜索 + 展开 | 快捷 chips |

### 6.2 置信度

- 在 `advancement_skills.json` 有条目 → `confidence: documented`（A 档）
- 否则保持 `metadata_only`（B 档）

### 6.3 验收

- [ ] `node scripts/build-advisor-phase8b.mjs` 生成索引
- [ ] `node scripts/validate-advisor-phase8b.mjs` 通过
- [ ] Electron 顾问面板「进阶」Tab 可浏览 40 条，A 档可展开技能
- [ ] 带角色快照时显示属性门槛 ✓/✗
- [ ] 问「预言家有什么技能」检索含 A 档内容
