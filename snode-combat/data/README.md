# 战斗数据（P0 首批）

当前为游荡者 P0 首批数据卡，全部为 draft，编码前需要与 schema 一起 review。

## 目录
- `cards/abilities/`：9 张游荡者 P0 能力卡
- `cards/statuses/`：7 张 P0 状态卡
- `cards/monsters/`：3 张教学怪物卡
- `encounters/`：1 场教学遭遇

## 引用关系
- 能力卡中的 `condition.name` / `statusLayers.name` 引用状态卡英文 ID：
  - `bleeding` 流血
  - `poisoned` 中毒
  - `blinded` 致盲
  - `slowed` 减速
  - `confused` 困惑
  - `disarmed` 缴械
  - `prone` 击倒
- 怪物卡只使用引擎内置动作 `core.basicAttack`。
- 遭遇卡引用怪物卡 ID：`goblin` / `wolf` / `bandit`。

## 状态
- 所有卡片 `reviewStatus: draft`。
- 尚未开始 core 实现；卡片与 `docs/data-schema.md` 可能有实现期微调。
