# Build Advisor UI 规格（阶段 8A + Advisor 2.0）

> **版本**：1.1.0  
> **状态**：8A 已验收；Advisor 2.0 v1 已落地（问答 Tab）  
> **依赖**：阶段 6（DeepSeek CLI）、阶段 7（L6 快照）、[advisor-2.0-spec.md](./advisor-2.0-spec.md)

---

## 1. 范围

| 包含 | 不包含 |
|------|--------|
| Electron 内可拖动悬浮球 + 右侧侧滑对话面板 | 浏览器 file:// 直连 API（待办） |
| IPC 代理 `mage-advisor.mjs`，Key 仅主进程读 `.env` | 快捷 chips |
| 角色面板自动 L6 快照（可关） | 写入角色面板 |
| 全职业创建陪跑 + 14 职业 L2 索引（full/partial 分档） | |
| **Advisor 2.0/2.1**：多轮对话、Planner、catalog/full_list、会话闭环 | |
| 问答 Tab「新对话」；换角色/换创建职业/换存档自动 reset session | |

---

## 2. 交互

### 2.1 悬浮球

- 默认位置：右下（`bottom: 24px; right: 24px`）
- 可拖动；松手吸附左/右边缘
- 位置持久化：`localStorage._snowd_advisor_pos`
- 单击：打开/关闭侧滑面板
- 拖动阈值 ~8px，避免误触
- 创建页：悬浮球旁步骤推荐气泡（独立 session，不写入问答 history）

### 2.2 侧滑面板

- 宽 400px，全高，自右侧滑入
- Tab：**问答** / **进阶**
- 顶栏：**新对话** + 关闭
- 上下文条：纯咨询 / 已绑定角色名·职业·等级 / 创建页步骤
- 非 full 档职业：顶部黄条提示资料完善度
- 对话区：纯文本，`white-space: pre-wrap`，不渲染 Markdown
- 输入框 + 发送；Enter 发送，Shift+Enter 换行
- 无快捷 chips

### 2.3 会话（Advisor 2.0）

- 存储：`sessionStorage._snowd_adv_chat_session_v1`（关软件清空）
- 最多保留 **3 轮** user/assistant（发送前 history 传给主进程）
- `bindingKey` 变化（换角色、换创建页职业、开关「使用当前角色」）→ **自动新 session**
- 用户点「新对话」→ 清空 turns 与 UI

### 2.4 页面可见性

| 页面 | 悬浮球 |
|------|--------|
| 启动台、角色系统、帮助、职业页（file:// 同域） | 显示 |
| `poker-game` / 斯诺德对决 | **隐藏** |
| 非 Electron | 显示但发送时提示需 Electron |

---

## 3. 技术

### 3.1 文件

```
斯诺德跑团/advisor-widget.js      # UI（自注入 CSS、session、新对话）
electron-app/preload.js           # electronAPI.advisorAdviseStream
electron-app/main.js              # ipcMain advisor-advise / stream
scripts/mage-advisor.mjs          # advise() 入口
scripts/advisor-planner.mjs       # Planner + 规则降级
scripts/advisor-session.mjs       # history 校验
scripts/advisor-retrieve.mjs      # catalog / full_list / 多 L2
panel_engine.js                   # window.snowdPanel.getSnapshot()
```

### 3.2 IPC

```javascript
// renderer → main
electronAPI.advisorAdviseStream({
  query,
  snapshot?: object,
  chargenState?: object,
  mode?: 'advisor' | 'wizard',
  conversationHistory?: [{ user, assistant, ts? }],
})
// → { ok, answer?, intent?, model?, error? }

electronAPI.advisorConfig()
// → { ok, configured: boolean, model? }
```

### 3.3 L6 绑定

- `角色面板.html` 且 `snowdPanel.hasCharacter()`：默认「使用当前角色」
- 开关持久化：`localStorage._snowd_advisor_use_char`
- 发送时附带 `getSnapshot()`（main 侧 normalize）

---

## 4. 验收

- [x] Electron 启动台可见悬浮球，对决页不可见
- [x] 侧滑面板可问答（需 `.env` 中 `DEEPSEEK_API_KEY`）
- [x] 角色面板绑定角色后，进阶类问题带 L6
- [x] 全职业可问；partial 档有黄条提示
- [x] Key 不出现在 renderer
- [x] 双职业技能问句同时注入 L2-mage + L2-warrior（Advisor 2.0）
- [x] 「新对话」与换角色/换存档自动 reset
- [x] 创建页气泡写入 session，可追问 full_list
- [ ] `node scripts/validate-advisor-phase8.mjs`（已补 2.0/2.1 断言）

---

## 5. 待办

- 浏览器模式：本地 `advisor-server` 或用户自配代理

---

## 6. 阶段 8B — 进阶 A 档

（同前：进阶 Tab + `advancement_skills.json` documented 档）
