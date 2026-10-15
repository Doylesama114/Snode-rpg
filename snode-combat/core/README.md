# core — 纯规则引擎基础层

无 DOM、无渲染依赖。已实现：

- `types.ts`：属性、方向、动作、单位卡等基础类型
- `geometry.ts`：三种距离函数、8方向、朝向射线、扇形范围模板、直线路径
- `rng.ts`：mulberry32 种子化 RNG，可序列化恢复
- `expression.ts`：骰子/数值表达式解析与求值（1D8、@变量、min/max/floor/ceil；parts 携带 player/auto 掷骰归属）
- `unit.ts`：战斗单位实例（HP/FP/连击点/弹药/状态层/动作预算/双持武器判定）
- `board.ts`：棋盘、地形、占位、8方向寻路（正交1/斜角2）
- `encounter.ts`：先攻、轮次、回合循环、胜负判定
- `cards.ts` / `catalog.ts`：数据卡类型、目录加载与引用校验
- `combatant-factory.ts`：玩家/怪物卡 → UnitInstance，遭遇卡 → Encounter
- `resolver.ts`：目标解析、条件/费用校验、攻击/豁免/AOE结算、P0效果op解释、大失败处理（幸运最低/并列D20）、暴击 before/after 口径、掷骰归属
- `basic-actions.ts`：基础攻击（命中+1连击点）、0动作装填、战后弹药补满
- P0 全部 9 个技能 + P1 主要主动技能与毒药触发已接入 resolver；详见 docs/P1-STATUS.md
- `pve-game.ts`：最小可玩循环（玩家行动 → 自动敌方AI回合 → 胜负）
- `dice-interaction.ts`：从结算事件提取 player/auto 掷骰步骤，供 UI 逐段播放动画
- `action-economy.ts`：回合动作预算与动作文本映射
- `tests/`：Vitest 单元测试（当前 83 个用例）

## 命令
```bash
npm run typecheck
npm test
```

## 规则
- 本层不得 import `render/` 或 `ui/`。
- 掷骰必须通过 `SeededRng`，记录 parts。
- 规则变更先改根目录设计文档与 `docs/rule-decisions.md`。
