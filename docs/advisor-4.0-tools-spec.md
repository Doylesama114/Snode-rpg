# Advisor 4.0 — Tools 规格

> **版本**：1.0  
> **落地版本**：v1.0.7070  
> **模块**：`scripts/advisor-tools.mjs` · `scripts/advisor-query-tools.mjs`

## 目标

在 LLM 生成自由文本之前，由 **纯函数** 产出可验证的「路线骨架」与结构化事实块，减少门槛/等级/数值胡编。

## API（7063 + 7065 + 7066 + 7067）

| 函数 | 输入 | 输出 |
|------|------|------|
| `resolveEntity(name)` | 进阶名或职业名 | `{ type, name, meta }` |
| `getLevelingTable(from, to)` | 等级区间 | L0 主职升级行 + 专长窗 + L5 进阶解锁 |
| `getAdvancementBrief(name)` | documented 进阶名 | 门槛、条件、天赋名、心得节点 |
| `outlineGrowthRoadmap(goal, opts)` | `parseRoadmapGoal` 结果 + store/ctx | 六段式 `sections[]` |
| `formatRoadmapOutline(outline)` | outline 对象 | Markdown 注入检索上下文 |
| `lookupSkill(name)` | 精确技能名 | 所属职业 + 摘要 + 前置（7065） |
| `intersectSkills(classA, classB)` | 两职业名 | 同名技能完整列表（7065） |
| `listClassesByWeaponProf(query)` | 锤子/锤类等 | 面板类别 + 职业列表（7065） |
| `detectStructuredQuestion(query)` | 用户问句 | intent 或 null（7065+） |
| `buildStructuredToolContext(detected)` | detect 结果 | 注入 prompt 的 Tools 文本（7065+） |
| `summarizeChargenHp()` | — | L1 HP 矩阵 + 语料最优组合（7066） |
| `outlineProficiencyRoadmap(class, targets)` | 职业 + 目标父熟练 | 子项全集 + L1 专精 + 升级窗口 + 等级粗估（7066） |
| `lookupStatus(name)` | 状态名 | status_conditions 定义 + appliesStatuses 技能列表（7067） |
| `aggregateSkillByName(name)` | 技能名 | 跨职业收录 + 效果是否一致（7067） |
| `summarizeFeatWindows()` | — | L4/L8/L13 特殊专长里程碑（7067） |
| `parseCombatScenarioFromQuery(query)` | 战斗问句 | 结构化场景参数（7068） |
| `resolveCombatScenario(params)` | 属性/武器/Buff | 分解式命中加值 + 合计（7068） |
| `lookupEquipment(name)` | 装备/消耗品名 | 效果/价格/要求（7070） |
| `searchEquipment(query, opts)` | 类别/关键词 | 装备列表检索（7070） |
| `optimizePointBuy(constraints)` | 购点约束 | 32 点最优分配（7071） |
| `summarizeLevelingRange(from, to)` | 等级区间 | 累计熟练/技能槽/专长（7071） |

## 数据流

```
parseRoadmapGoal → buildGenericRoadmapContext
                 → outlineGrowthRoadmap (事实骨架)
                 → formatRoadmapContext + formatRoadmapOutline → LLM
```

## 约束

- LLM prompt：`有路线骨架时勿改事实性门槛与等级节点`
- `unknown_advancement` 模式：骨架仅含未收录声明 + 一般 L0 框架 + 相近进阶名

## 验证

```bash
node scripts/validate-advisor-tools.mjs
node scripts/validate-advisor-golden.mjs
```
