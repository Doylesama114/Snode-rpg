# Advisor 3.0 — Build Roadmap 规格

## 目标

为「主法 + 子战 → 魔剑士」等长线 build 提供**分阶段路线图**（前期/中期/后期），替代 catalog 式短列表；面板绑定快照时附加 build 评价与缺口分析。

## 意图

| 字段 | 值 |
|------|-----|
| intent | `build_roadmap` |
| answerStyle | `roadmap` |
| promptProfile | `build_roadmap` |

与 `build_review` 区分：无快照的纯规划问句走 `build_roadmap`；**绑定 L6 快照**且问句含「怎么评价当前 build」+ 魔剑士等 kit 关键词时，同样升级为 `build_roadmap`（注入快照评价与缺口）。

## 面板（7058）

- `isPanelRoadmapQuery(query, { snapshot })` 统一判定
- Widget 绑定角色时显示预设：「评价当前 build」「魔剑士全路线规划」
- roadmap 回答 `max_tokens` 提升至 6144

## Build Kit

| kit | 路径 | 主职 + 子职 |
|-----|------|-------------|
| 魔剑士 | `advisor/build_kits/magic_sword.json` | 法师 + 战士 |
| 魔弹射手 | `advisor/build_kits/magic_bullet.json` | 法师 + 猎人 |

扩展新 kit：新增 JSON + `ROADMAP_GOAL_PATTERNS` / `KIT_ALIASES`；`getRoadmapRouteConfig` 按子职注入对应 L2 层。

## 数据校验

```bash
node scripts/validate-advisor-build-kit.mjs
```

校验 kit 内技能名是否收录、流派是否与 L2 索引一致（起手/无 style 除外）。

## 模块

| 文件 | 职责 |
|------|------|
| `scripts/advisor-build-roadmap.mjs` | 加载 kit、解析技能/专长、阶段判定、快照缺口分析、格式化上下文 |
| `scripts/advisor-planner.mjs` | `planFromRules` 优先 `build_roadmap` |
| `scripts/advisor-router.mjs` | `build_roadmap` 路由与 L2 层 |
| `scripts/advisor-retrieve.mjs` | `_roadmap` / `_roadmapText` 注入 |
| `scripts/advisor-prompt.mjs` | 长文 roadmap 模板 |

## 阶段判定

`getBuildPhaseBand(mainLevel)`：

- early：L1–3（一–二阶重心）
- mid：L4–8（三–四阶重心）
- late：L9+（五阶及以上）

## 测试

```bash
node scripts/validate-advisor-roadmap.mjs
node scripts/mage-advisor.mjs --dry-run --json "我想玩一个主职业法师，子职业战士的角色，然后想进阶魔剑士，我该怎么选择我的技能"
node scripts/mage-advisor.mjs --dry-run --json "我是魔剑士 build，当前技能怎么选" --snapshot advisor/snapshots/mock-magic-sword-l6.json
```
