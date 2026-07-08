# Advisor 4.0 — Tools 规格

> **版本**：1.0  
> **落地版本**：v1.0.7063  
> **模块**：`scripts/advisor-tools.mjs`

## 目标

在 LLM 生成自由文本之前，由 **纯函数** 产出可验证的「路线骨架」，减少门槛/等级事实胡编。

## API

| 函数 | 输入 | 输出 |
|------|------|------|
| `resolveEntity(name)` | 进阶名或职业名 | `{ type, name, meta }` |
| `getLevelingTable(from, to)` | 等级区间 | L0 主职升级行 + 专长窗 + L5 进阶解锁 |
| `getAdvancementBrief(name)` | documented 进阶名 | 门槛、条件、天赋名、心得节点 |
| `outlineGrowthRoadmap(goal, opts)` | `parseRoadmapGoal` 结果 + store/ctx | 六段式 `sections[]` |
| `formatRoadmapOutline(outline)` | outline 对象 | Markdown 注入检索上下文 |

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
