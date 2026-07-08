# Advisor 4.0 实施路线

> **基线版本**：v1.0.7060（通用 build_roadmap）  
> **目标**：修复「答非所问 / 会话污染 / 实体漏检」，建立可回归的成长路线质量闭环  
> **原则**：不 fine-tune 模型；以 **实体解析 → 上下文结构 → 作答契约 → Golden CI** 为主  
> **状态**：7061 batch1 + 7062 batch2（7063–7065）已实施；7066 工具层待做

---

## 1. 问题诊断（来自真实对话 + 本地 dry-run）

| 用户问句 | 期望 | 当前行为 | 根因 |
|----------|------|----------|------|
| 我想玩飞贼，成长路线 | 按等级排路线（游荡者 L1–5 → 飞贼） | 罗列六项天赋 / 扯法师 | `parseRoadmapGoal` 无职业时 **默认主职=法师**；prompt 未禁止能力全文 |
| 我现在只说飞贼 | 仅围绕飞贼规划 | 仍建议法师 | 多轮 history 未做 **目标重置** |
| 飞贼（首轮） | 识别为 documented 进阶 | 偶发「未收录」 | `advisor-router-utils.pickAdvancementName` **硬编码名单缺飞贼**（与 retrieve 不一致） |
| 元素大师怎么规划 | 明确「未收录」+ 相近选项 | 编造智力门槛 | 无 **unknown_entity** 硬闸门 |
| 高输出法师 | 分阶段 + 取向追问或塑能方向 | 只列几个法术名 | `orientation_only` 模式未区分；L2 抽样偏关键词 |

**本地复现（7060）**：

```text
「我想玩飞贼，我该怎么安排我的成长路线？」
→ isBuildRoadmapQuery: true ✓
→ parseRoadmapGoal.mainClass: "法师" ✗（应为「游荡者」）
→ intent: build_roadmap ✓

「我想玩飞贼」（无路线/技能词）
→ isBuildRoadmapQuery: false ✗
```

---

## 2. 总体架构调整

```
用户问句 + history
      ↓
[7061] resolveGoal()          ← 统一实体解析 + 主职推断 + 路线触发词
      ↓
[7061/7065] roadmapMode       ← dual_class | advancement_primary | orientation
      ↓
[7062/7065] buildRoadmapCtx   ← L0 升级表 + L3 门槛 + 心得节点（非天赋全文）
      ↓
[7062] prompt 作答契约        ← 强制章节；禁止能力 dump
      ↓
[7063] session goalOverride   ← 「只说 X」时丢弃冲突主职
      ↓
LLM
      ↓
[7064] golden CI              ← 检索 + prompt + 禁词/必含词
```

**不做**：为每个进阶写 kit JSON（7060 已否决）。  
**可选后置**：`advisor-tools.mjs` 内部工具层（7066），对齐 dnd-oracle 思路。

---

## 3. 分版本实施路线

### v1.0.7061 — 实体与目标解析（P0，约 1–2 天）

**目标**：问「飞贼成长路线」时，检索上下文主职为游荡者；「想玩飞贼」也能进 roadmap。

| 模块 | 修改内容 |
|------|----------|
| `scripts/advisor-entities.mjs`（新建或扩展现有） | `resolveAdvancementName(query)`：唯一实现，读 `advancements.json` + `advancement_skills.json`，长名优先 |
| `scripts/advisor-router-utils.mjs` | 删除硬编码 `ADVANCEMENT_NAMES`；改为 re-export `resolveAdvancementName` |
| `scripts/advisor-build-roadmap.mjs` | `parseRoadmapGoal`：有 `advancementName` 时从 `advancements.json.sourceClasses[0]` 推断 `mainClass`；仅 orientation 问句才默认法师 |
| 同上 | `isBuildRoadmapQuery` / `isPanelRoadmapQuery`：触发词增加 `成长\|安排\|怎么玩\|想成为`；「想玩 + 已知进阶名」视为 roadmap |
| `scripts/advisor-router.mjs` | `routeIntent`：在 general 打分前，若 `resolveAdvancementName` 命中且含规划类词 → `build_roadmap` |
| `scripts/validate-advisor-roadmap.mjs` | 新增用例：`飞贼成长路线` → mainClass=游荡者；`想玩飞贼` → build_roadmap |

**验收**：

```bash
node scripts/validate-advisor-roadmap.mjs
node scripts/mage-advisor.mjs --dry-run --json "我想玩飞贼，我该怎么安排我的成长路线"
# formatContext 中主职应为游荡者，含飞贼 L3 门槛 敏捷15/感知15
```

---

### v1.0.7062 — 成长路线作答契约（P0，约 1–2 天）

**目标**：同一 intent 下，**路线**与**百科**彻底分离；模型不得把天赋 summary 当正文。

| 模块 | 修改内容 |
|------|----------|
| `scripts/advisor-prompt.mjs` | `build_roadmap` profile 增加 **强制章节**（见 §4）与 **禁止项**（不得逐条复述 L3 天赋全文；不得引入上下文未出现主职） |
| `scripts/advisor-build-roadmap.mjs` | `formatRoadmapContext` 增加 `### 作答形态（硬约束）` 块，与 prompt 一致 |
| `scripts/advisor-build-roadmap.mjs` | `buildGenericRoadmapContext` 注入 `levelingHints`：L3 开进阶、L4/L8/L13 专长窗、每级 +1 属性（来自 `rules/leveling.json` 摘要） |
| `scripts/advisor-retrieve.mjs` | L3 `documentedSkills` 在 roadmap 模式下只输出：**门槛 + 心得等级节点 + 天赋名列表（一行）**，不注入完整 summary |
| `docs/advisor-3.0-roadmap-spec.md` | 增补「作答契约」一节，指向 4.0 |

**验收**：人工 review dry-run prompt；`formatContext` 含「作答形态」且 L3 飞贼无长 summary。

---

### v1.0.7063 — 会话目标隔离（P1，约 1 天）

**目标**：用户说「我现在只说飞贼 / 不是法师了」时，规划不再引用上一轮法师框架。

| 模块 | 修改内容 |
|------|----------|
| `scripts/advisor-session.mjs` | `extractGoalOverride(query, history)`：识别否定/聚焦句式，返回 `{ advancementName?, mainClass?, dropHistoryClasses?: string[] }` |
| `scripts/advisor-planner.mjs` | `planFromRules` / LLM planner 输入合并 `goalOverride`；覆盖 `ctx.className` |
| `scripts/advisor-build-roadmap.mjs` | `parseRoadmapGoal` 接受 `goalOverride` 参数 |
| `electron-app/斯诺德跑团/advisor-widget.js` 等 | IPC 透传 `goalOverride`（若服务端算则 widget 可不改） |
| `scripts/validate-advisor-planner.mjs` | 多轮用例：上一轮法师 → 本轮「只说飞贼」→ plan.mainClass=游荡者 |

---

### v1.0.7064 — Golden 对话回归 + 未知实体闸门（P1，约 2 天）

**目标**：用真实失败对话做 CI；未收录进阶禁止编造。

| 模块 | 修改内容 |
|------|----------|
| `advisor/golden/conversations.json`（新建） | 存放金样例：`id`, `query`, `history?`, `expectIntent`, `expectMainClass`, `mustInclude[]`, `mustNotInclude[]` |
| `scripts/validate-advisor-golden.mjs`（新建） | 对每条跑 `planFromRules` + `retrieve` + `formatContext` + prompt profile 检查（**不调 LLM**） |
| `scripts/advisor-build-roadmap.mjs` | `resolveAdvancementName` 未命中但问句像进阶名 → 标记 `unknownAdvancement: true` |
| `scripts/advisor-prompt.mjs` | 新增 `unknown_entity` 短 profile：仅说明未收录 + 建议问 DM + 可选列相近 documented 进阶 |
| `scripts/advisor-router.mjs` | 未知进阶 + 规划词 → `build_roadmap` + `unknownAdvancement` flag，或独立 `unknown_entity` |

**首批 golden 用例（来自用户对话）**：

1. `我想玩飞贼，我该怎么安排我的成长路线` — must: 游荡者, 敏捷, 感知, L5/L1-4; mustNot: 智力15, 法师（主职）
2. `我现在只说飞贼`（history 含法师）— mustNot: 兼职法师
3. `元素大师怎么规划` — must: 未收录; mustNot: 智力18（编造）
4. `高输出法师技能和成长路线` — must: 分阶段, 塑能或流派; mustNot: 仅列 3 个法术名完事
5. `主法+子战→魔剑士` — 回归 7060 用例仍 pass

**验收**：

```bash
node scripts/validate-advisor-golden.mjs
node scripts/validate-advisor-roadmap.mjs
node scripts/validate-advisor-planner.mjs
```

---

### v1.0.7065 — 进阶导向 Roadmap 模式（P1，约 2 天）

**目标**：「只玩飞贼」类问题走 **advancement_primary**，上下文以源主职 L2 + L0 为主，而非法师 L2 抽样。

| 模块 | 修改内容 |
|------|----------|
| `scripts/advisor-build-roadmap.mjs` | `inferRoadmapMode(goal)` → `dual_class` \| `advancement_primary` \| `orientation_only` |
| 同上 | `getRoadmapRouteConfig`：advancement_primary 时 layers = L0 + sourceClass L2 + L3 + L4；**不注入法师 L2** |
| 同上 | `buildGenericRoadmapContext` 增加 `advancementPrimary: true` 与 `sourceClasses` |
| `scripts/advisor-prompt.mjs` | advancement_primary 附加说明：L1–4 写源主职升级；L5+ 写进阶门槛与心得节点 |
| `docs/advisor-4.0-plan.md` | 更新为「部分已实施」 |

**验收**：飞贼路线 context 含 L2-rogue（或游荡者对应 layer）、L0 升级摘要，不含「L2 法师技能」。

---

### v1.0.7066 — 内部工具层（P2，可选，约 3 天）

**目标**：关键事实由纯函数生成，LLM 只负责润色与取舍说明。

| 模块 | 修改内容 |
|------|----------|
| `scripts/advisor-tools.mjs`（新建） | `resolveEntity(name)`, `getLevelingTable(from,to)`, `getAdvancementBrief(name)`, `outlineGrowthRoadmap(goal)` |
| `scripts/advisor-retrieve.mjs` | roadmap 任务先调 `outlineGrowthRoadmap`，结果写入 `_roadmapOutline` |
| `scripts/advisor-prompt.mjs` | 有 outline 时要求「在 outline 骨架上补充理由，勿改事实性门槛」 |
| `docs/advisor-4.0-tools-spec.md`（新建） | 工具 schema 与示例 |

**说明**：此阶段为增强项；7061–7065 已应解决用户反馈的主问题。

---

## 4. 成长路线作答契约（7062 核心）

回答 **必须** 包含以下章节（标题可微调，内容不得缺失）：

1. **目标确认** — 进阶名 / 主职 / 是否有子职；无快照时默认从 L1 规划  
2. **基础阶段（主职 L1–4）** — 每级关注：熟练+1、属性+1、技能槽+1、专长窗（L4）、属性上限  
3. **进阶门槛与时机** — 主职 L5 可择进阶；列出 L3 文档中的属性/行为条件（不得编造）  
4. **进阶后节点** — 仅列 **心得/等级奖励**（如飞贼 L5/10/15），不展开六项天赋机制  
5. **技能与专长方向** — 每阶段 2–4 个 **方向或代表技能名**（来自 L2 抽样），附取舍理由  
6. **免责声明** — 固定句「仅作参考…」

**禁止**：

- 把 L3 `talents[].summary` 当正文逐条粘贴（除非用户明确问「飞贼有哪些能力/效果」→ 改走 `advancement` intent）  
- 引入上下文未出现的默认主职（尤其法师）  
- 把进阶与 L7 兼职混为一谈  

**与 intent 分工**：

| 用户意图 | intent | 输出形态 |
|----------|--------|----------|
| 成长路线 / 怎么规划 / 想玩 X | `build_roadmap` | §4 六段式 |
| X 有哪些能力 / 效果是什么 | `advancement` | 门槛 + 天赋说明 |
| X 有哪些技能可选 | `class_skills` / catalog | 目录/列表 |

---

## 5. 版本与文档变更清单

| 版本 | 主题 | 主要文件 | 验证脚本 |
|------|------|----------|----------|
| **7061** | 实体/目标解析 | router-utils, build-roadmap, router | validate-advisor-roadmap |
| **7062** | 作答契约 | prompt, build-roadmap, retrieve | validate-advisor-roadmap + 人工 prompt review |
| **7063** | 会话隔离 | session, planner, build-roadmap | validate-advisor-planner |
| **7064** | Golden + 未知实体 | golden/*, validate-golden, prompt, router | validate-advisor-golden（新） |
| **7065** | advancement_primary | build-roadmap, prompt | validate-advisor-roadmap + golden |
| **7066** | 工具层（可选） | advisor-tools, retrieve, prompt | validate-advisor-tools（新） |

每个版本发布时同步：

- `node bump-version.js 1.0.70xx "..."`  
- `项目文档.md` §12 追加条目  
- `后续更新教程.md` 若涉及顾问行为变更则更新  

---

## 6. 实施优先级与排期建议

| 优先级 | 版本 | 理由 |
|--------|------|------|
| **P0 立即** | 7061 + 7062 | 直接对应飞贼/法师污染与答非所问；改动集中、风险低 |
| **P1 紧随其后** | 7063 + 7064 | 多轮体验 + 可持续回归；防止改 A 坏 B |
| **P1** | 7065 | 飞贼类「单进阶目标」体验完整 |
| **P2 按需** | 7066 | 事实层进一步硬化；适合资料继续膨胀时 |

**建议第一批合并发布**：若人力紧，可将 7061+7062 同 PR 发布为 **7061**，7063+7064 为 **7062**（对外的「Advisor 4.0 alpha / beta」），内部仍按上表 atomic commit。

---

## 7. 不在此路线内（明确排除）

- 不恢复 widget 预设按钮（7060 已移除）  
- 不为每个进阶新增 `build_kits/*.json`  
- 不对 DeepSeek 做 fine-tune  
- 不强制 LLM 输出 JSON（7062 用 prompt 章节约束即可；7066 可选 server-side outline）

---

## 8. 成功标准（Advisor 4.0 完成定义）

1. 用户对话 §1 中 5 条 golden **检索层 100% pass**（7064）  
2. 飞贼成长路线 dry-run context：**主职=游荡者**，含 L3 门槛，**不含法师 L2 大段**  
3. 「元素大师」：**未收录**声明，无编造属性  
4. 多轮「只说飞贼」：**mustNot 法师**（7063）  
5. 7060 魔剑士/魔弹射手回归用例 **不回归**

---

## 9. 参考（外部，非本仓库）

- 结构化工具：[dnd-oracle](https://github.com/gregario/dnd-oracle)  
- RAG + 引用：[dnd-rag](https://github.com/ZacStryker/dnd-rag)  
- 持续评测：RAGAS / Giskard RAGET  
- 生产 RAG 分块：[Elysiate RAG guide](https://www.elysiate.com/blog/rag-systems-production-guide-chunking-retrieval-2025)
