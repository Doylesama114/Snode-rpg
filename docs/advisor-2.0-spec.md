# Build Advisor 2.0 规格

> **版本**：1.0  
> **状态**：v1 已落地（问答 Tab）  
> **上一版**：阶段 8A UI + 阶段 5 多职业 L2 索引

---

## 1. 目标

解决「句意理解不足」导致的检索偏差，典型问题：

- 用户问「法师和战士有哪些技能可选」，只返回战士、法师 L2 为空
- 首次列举应给 **catalog**（每流派/位阶 2 例 + 总数），追问再给 **full_list**

---

## 2. 产品决策（定稿）

| 项 | 决定 |
|----|------|
| 对话历史 | 要；仅 `sessionStorage` + 内存；关软件不保留 |
| 新对话 | 问答 Tab 顶栏「新对话」按钮 |
| 换角色 | 自动新 session（不弹窗） |
| 换创建页职业 | 自动新 session |
| v1 范围 | **仅问答 Tab**；创建页气泡 history 留 v1.1 |
| 列表策略 | 首次 **catalog**；追问 **full_list** |
| Planner | 轻量 LLM JSON；失败降级 `planFromRules` |
| API Key | 与现顾问共用 `getAdvisorConfig()` |

---

## 3. 架构

```
用户问题 + conversationHistory
        ↓
advisor-planner.mjs  (LLM JSON → planFromRules 降级)
        ↓
advisor-retrieve.mjs (applyPlanToRetrieval: catalog / full_list / 多 L2)
        ↓
advisor-prompt.mjs   (多轮 messages + catalog/full_list 后缀)
        ↓
mage-advisor.mjs → DeepSeek
```

### 3.1 新增模块

| 文件 | 职责 |
|------|------|
| `scripts/advisor-planner.mjs` | 规划 answerStyle、list_skills 任务、多职业 |
| `scripts/advisor-session.mjs` | 服务端校验 history（最多 3 轮） |
| `scripts/validate-advisor-planner.mjs` | 双职业 / catalog / full_list 金样例 |

### 3.2 Plan 结构

```javascript
{
  source: 'planner' | 'rules',
  answerStyle: 'catalog' | 'full_list' | 'recommend',
  tasks: [{ type: 'list_skills', classes: ['法师','战士'], exclude: ['starting'] }],
  intent: 'class_skills',
  promptProfile: 'class_skills'
}
```

### 3.3 检索扩展

- `buildSkillCatalog()` — 按战斗风格×位阶分组，每组 2 例 + count
- `buildSkillFullList()` — 按风格枚举技能名（上限 120/职业）
- `matchAllClassesFromQuery()` — 多职业并列识别
- `applyClassRouteFilter()` — 多职业时并行注入多个 L2 层

---

## 4. UI / IPC

### 4.1 客户端（`advisor-widget.js`）

- `sessionStorage._snowd_adv_chat_session_v1`：`{ id, turns[], bindingKey }`
- `bindingKey`：`char:名|职业|等级` 或 `chargen:职业`
- 发送 payload 增加 `conversationHistory`
- 顶栏「新对话」清空 turns 与 UI

### 4.2 IPC payload

```javascript
electronAPI.advisorAdviseStream({
  query,
  snapshot?,
  chargenState?,
  conversationHistory?: [{ user, assistant, ts? }],
})
```

---

## 5. 验证

```bash
node scripts/validate-advisor-planner.mjs
node scripts/validate-advisor-phase5-regression.mjs
node scripts/mage-advisor.mjs --dry-run --json "那么除了初始特性外，法师和战士有哪些技能我可以选择"
```

---

## 6. 后续 v1.1

- [x] 创建页气泡携带 conversationHistory（`syncChargenBubbleToSession`）
- [x] 角色面板切换事件主动 reset（`snowd-panel-character-change`）
- [x] Planner 缓存同 session 相似问句（`buildPlanCacheKey`）
