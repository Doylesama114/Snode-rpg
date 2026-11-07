# AI 助理数据源接入方案（v1 · 数据层细则）

- 日期：2026-11-08
- 状态：**已并入《顾问 6.0 实施方案（合并稿）》的 §5**，本文件保留为数据层细则（切块、映射、manifest 细节）
- 执行口径以合并稿为准：`docs/plans/2026-11-08-advisor-6.0-merged.md`
- 关联：`docs/advisor-5.0-audit-plan.md`、`docs/migration/50_交接/审阅包_20261029/lab/data/`、`advisor/`

## 1. 目标

| 目标 | 现状 | 目标值 |
|---|---|---|
| 规则类问题可答 | 实测「检定规则」→「资料未收录」 | 40 条规则题命中 ≥ 90% |
| 索引与发布同步 | 索引 2026-10-18，包 1.0.8104 | 每次发版自动重建，版本戳一致 |
| 技能内容最新 | 11.04 新技能 0 命中 | 与 `职业页/数据` 一致 |

## 2. 数据源结论

| 领域 | 采用 | 理由 |
|---|---|---|
| 规则正文 | **lab 的 `rule-*.json`**（10-30 快照） | 116 节 + 104 关键词 + 35 状态 + 15 幕间 + 等级/兼职/名望/声望/色彩，覆盖 12 章 |
| 技能池 | `职业页/数据/*.json`（8104） | lab 无基础职业技能；现有索引已过期 |
| 职业/进阶/专长/物品/背景/种族 | lab 结构 + advisor 叙述字段合并 | lab 事实整齐，advisor 叙述更全 |
| 建卡选择组 | lab `choice-map.json`（85 组 / 449 技能） | 比现有 `choice_groups.json` 细 |

**不做整库替换**：lab 是 10-30 快照且位于 `docs/migration`（不入库），只能作为「规则语料的结构模板 + 一次性快照」。

## 3. 落地步骤

### P0-1 快照入库（0.5 天）

```
advisor/source/lab-20261030/
  rule-sections.json  rule-keywords.json  rule-states.json
  rule-interludes.json rule-levels.json  rule-multiclass.json
  rule-marks.json     rule-mark-rules.json rule-renown.json rule-reputation.json
  classes.json adv-paths.json adv-abilities.json feats.json
  items.json backgrounds.json races.json choice-map.json
  _meta.json   # 来源路径、抓取日期、缺失项（11.04 内容）、BOM 处理说明
```

验收：`_meta.json` 中记录每个文件 sha256；文件数 18 个；不引用 `docs/migration` 原路径。

### P0-2 规则块生成器（1 天）

新增 `scripts/build-advisor-rules-from-lab.mjs`：

1. `rule-sections.json` → 116 个 chunk：`{id:"rule:<sheet>:<ord>", sheet, ord, title, body, parts, anchor, keywords}`
2. `rule-keywords.json` → 104 张关键词卡（term/category/definition）
3. `rule-states/interludes/levels/multiclass/marks/renown/reputation` → 结构化事实层 `advisor/rules/facts/*.json`
4. 锚点映射表（写死并校验）：

| lab sheet / 文件 | help.html 锚点 |
|---|---|
| 基本规则 | `#s0` |
| 检定规则 | `#s1` |
| 战斗规则 | `#s2` |
| 冒险规则 | `#s-adventure` |
| 升级规则（rule-levels） | `#s3` |
| 兼职规则（rule-multiclass） | `#s4` |
| 幕间规则（rule-interludes） | `#s5` |
| 技能点/色彩（rule-marks/mark-rules） | `#s6` |
| 异常状态（rule-states） | `#s7` |
| 关键词（rule-keywords） | `#s8` |
| 名望/声望（rule-renown/reputation） | `#s9` |
| 其他规则 | `#s10` |

输出：`advisor/rules/chunks.jsonl` + `advisor/rules/index.json`（含 buildTime、sourceVersion、counts）。

### P0-3 检索升级（1 天）

- 新增 `scripts/advisor-search-prose.mjs`：BM25（自建倒排，零依赖）+ 标题命中加权 + `sheet`/`section` 过滤；
- `advisor-retrieve.mjs` 增加 `searchProse(query, {section, limit})`，与现有 `scoreText` 并存（结构化检索不动）；
- 路由：`intent=rules` 时先走 prose 检索，命中则注入 chunk + 锚点；未命中才回「资料未收录」。

### P0-4 引用与验收（0.5 天）

- 答案末尾输出 `【出处】规则手册 · 检定规则 #s1`（可点击）；
- 用 40 条规则题（12 章 × 3 + 4 条跨章）对照，记录命中率与首字延迟。

### P1 技能与实体（1.5 天）

- `build-advisor-skills-from-pages.mjs`：`职业页/数据/*.json` → `advisor/skills/*_index.json`（替代 10-18 旧索引）；
- `build-advisor-facts-from-lab.mjs`：classes/adv-paths/adv-abilities/feats/items/backgrounds/races → advisor 现有层，保留 advisor 叙述字段（合并策略：lab 优先数值，advisor 优先描述）；
- `choice-map.json` → `advisor/chargen/choice_groups.json`（结构对齐后再替换）。

### P1-2 版本戳与门禁（0.5 天）

新增 `scripts/verify_advisor_index_fresh.py`：

1. `advisor/rules/index.json.sourceVersion` 必须等于包版本（`electron-app/package.json`）；
2. `advisor/skills/*` 的 `builtFrom` 哈希必须与 `职业页/数据/*.json` 一致；
3. 失败即门禁红。

## 4. 风险与对策

| 风险 | 对策 |
|---|---|
| lab 结构变更 / 缺失 11.04 | 只做一次性快照；后续以 `源文件/` 为真值重建 |
| 切块粒度影响精度 | 先做「整节 vs 小节」A/B，用同一批题对比 |
| BM25 对同义改写无效 | 第二阶段再加 embedding/上下文增强（Anthropic Contextual Retrieval 路线） |
| 规则文本与 HTML 不一致 | 生成器同时输出「lab 与 help.html 章节标题对照表」，不一致时告警 |

## 5. 验收（可量化）

```
规则 40 题命中率        ≥ 90%（当前 ≈ 0）
引用可点击率            100%
首字延迟 P50 / P95      < 2.5s / < 6s
索引版本戳               == 包版本（门禁）
11.04 新技能命中         3/3（机敏光环/逆流技巧/极大逆境）
```

## 6. 排期

| 阶段 | 内容 | 天 |
|---|---|---|
| P0-1/2 | 快照 + 规则块 | 1.5 |
| P0-3/4 | 检索 + 引用 + 40 题验收 | 1.5 |
| P1 | 技能/实体重建 + 门禁 | 2.0 |
| 合计 | | **5 天** |
