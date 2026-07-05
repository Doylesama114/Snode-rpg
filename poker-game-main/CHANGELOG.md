# 更新日志

> **斯诺德对决已完成** — 148 张卡牌效果已全部实现，用户可进行单机/联机游戏，测试游戏逻辑是否正确。

## [1.0.6082] - 2026-07-05

### 修复
- **ESC 导航**：子页面用 `router.replace` 返回上级；主页直接跳转启动台 URL，不再在两页间来回弹
- **单机部署/回合**：修复 `deployCard` 中未定义 `fieldOwner` 导致出牌后崩溃、无法「结束回合」
- **场上卡牌详情**：悬停 Teleport 浮层 + 点击查看详情（单机/联机）；部署选格时不误触详情

### 功能
- **单机开局**：新增人数选择弹窗（2/3/4 人）再开始游戏
- **联机创建房间**：人数选择标签更清晰

## [1.0.6081] - 2026-07-05

### 修复
- **单机部署**：修复选手牌后点击场上部署格无反应（`gameState.value` 未解包）

### 功能 / UX
- **卡组管理**：整页滚动浏览 148 张卡池；替换后自动保存
- **2–4 人牌桌**：单机/联机布局支持滚动；3/4 人局己方区域占满整行
- **联机 3+ 人**：修复全员准备/决策判定（原仅检查 2 人导致无法进下一回合）
- **测试**：`scripts/test-n-players.mjs`

## [1.0.6080] - 2026-07-05

### 功能
- **卡组管理页**：148 张卡池搜索/筛选、逐槽「更换」、效果摘要、点击卡牌弹出详情（点空白关闭）
- **ESC 导航**：按页面层级返回（单机/联机/卡组 → 主页，联机对局 → 大厅，主页 → 启动台），不再使用浏览器历史后退

## [1.0.6079] - 2026-07-05

### 修复
- **Electron 白屏**：启动台「斯诺德对决」链接路径错误（`../electron-app/poker-game` → 打包环境下 `../poker-game`）

## [1.0.6078] - 2026-07-05

### 里程碑发版 + UX
- 首页移除扑克牌背景，统一米色界面
- 「管理卡组」仅保留在卡牌游戏首页
- 新增 `scripts/verify-full.mjs` 全量验证脚本

## [1.0.6077] - 2026-07-05

### 卡牌效果批次 5E — 终批 148/148
- **旗鱼**：`onBatchReveal` + `batchHighestFreeDeploy`
- **矮人烈酒**：`moveOpponentBatchRevealToDeckBottom` + `forceRandomHandPlay`（`batchResolveOnly`）
- **测试**：`scripts/test-5e.mjs`（11/11）

## [1.0.6076] - 2026-07-05

### P0 盖牌批次引擎专批
- **批次结算**：`resolveRevealBatch` / `buildRevealBatch` / `RevealBatchEntry`
- **旗鱼就绪**：`batchHighestFreeDeploy`（本批战力最高退还打出费用）
- **矮人烈酒就绪**：`moveOpponentBatchRevealToDeckBottom` + `forceRandomHandPlay` + `batchResolveOnly`
- **联机**：`revealAllCards` 接入批次结算；战术延迟揭示至下回合展示
- **测试**：`scripts/test-engine-p0.mjs`（11/11）

## [1.0.6068] - 2026-07-05

### 卡牌效果批次 4X — 宿主部署进阶
- **板甲**：deployOnHostOnly（士兵/职业者关键词宿主）
- **三叉戟**：宿主为水属性单位时额外 +2（`hostBonusIfHostAttribute`）
- **攀岩爱好者**：可选土环境宿主 +3（`allowNormalDeploy` + `hostDeploySelfBonus`）
- **引擎**：`computeHostDeployDelta`、`requiresMandatoryHostDeploy`
- **测试**：`scripts/test-4x.mjs`（11/11）

## [1.0.6067] - 2026-07-05

### 卡牌效果批次 4W — 宿主部署扩展
- **洋葱**：速攻 deployOnHostOnly（农田/载具）
- **渔网**：速攻 deployOnHostOnly（仅单位宿主）
- **短柄斧**：非 quickPlay 宿主专属部署（士兵/蛮斗士/战士/冒险者）
- **引擎**：`requireHostCardType`、`applyDeployOntoHost`+`stackedBonus`、`handleHostOnlyDeploy`
- **测试**：`scripts/test-4w.mjs`（10/10）

## [1.0.6066] - 2026-07-05

### 卡牌效果批次 4V — 速攻作物
- **玉米/胡萝卜/卷心菜**：`deployOnHostOnly` 仅能部署在「农田/载具」关键词宿主上
- **引擎**：`getQuickPlayHostTargets`、`requiresDeployOnHost`、`isValidDeployOnHost`
- **测试**：`scripts/test-4v.mjs`（14/14）

## [1.0.6065] - 2026-07-05

### 卡牌效果批次 4U — 财富宝石三件套
- **红宝石**：`unplayable` + `setPowerIfFieldKeyword`（场上贵族→3 战力）
- **蓝宝石**：`setPowerIfHandNames`（手牌含红宝石→2 战力）
- **绿宝石**：`setPowerIfHandNames`（手牌含红宝石+蓝宝石→4 战力）
- **测试**：`scripts/test-4u.mjs`（13/13）

## [1.0.6064] - 2026-07-05

### 卡牌效果批次 4T + 终局/不可打出引擎
- **食人魔**：onGameEnd `destroyRandomOther` 随机消灭一张其他己方牌
- **纪念照**：`unplayable` + `setPowerIfFieldNames`（环境+摄像机+游客→4 战力）
- **金矿**：`unplayable` + `setPowerIfOnlyHandCard`（唯一手牌→7 计入 bonusPower）
- **引擎**：`triggerGameEndEffects` 两遍（先消灭再设战力）、手牌终局效果
- **测试**：`scripts/test-4t.mjs`（12/12）

## [1.0.6063] - 2026-07-05

### 卡牌效果批次 4S + 跨玩家部署引擎
- **礁石**：`crossPlayerDeploy` 部署到有 water 环境牌的玩家场上
- **兽栏**：补 `createSlot`（载具关键词额外槽）
- **荒野**：onField 怪兽 +3（纳入 structured 进度）
- **引擎**：`selectCrossPlayerSlot` 阶段、`targetPlayerIndex` 联机协议、终局计数按目标玩家场
- **测试**：`scripts/test-4s.mjs`（11/11）

## [1.0.6062] - 2026-07-05

### 卡牌效果批次 4R
- **搬运工**：`deployFromHand` 至多 2 张「物件」单位从手牌部署到额外槽位
- **锻炉**：`onReforge` 重铸行动时自身战力 +2（可叠加）
- **贫民窟**：`debuffAheadPlayers` 终局若落后，领先玩家总战力 -4
- **引擎**：`triggerReforgeEffects` 接入 SP/MP 重铸流程
- **测试**：`scripts/test-4r.mjs`（9/9）

## [1.0.6061] - 2026-07-04

### 卡牌效果批次 4Q
- **蛮斗士**：`playRequirement` 牌库中不得含战术牌
- **蛇颈龙**：`grantUntargetable` 场上有水环境时其他玩家不可选中
- **仲夏节庆典**：onDeploy `requireKeywords` 吟游诗人/鲁特琴/篝火/晴天齐全 +22
- **引擎**：`untargetableByOthers` 接入 destroy 目标过滤与战力重算
- **测试**：`scripts/test-4q.mjs`（10/10）

## [1.0.6060] - 2026-07-04

### 卡牌效果批次 4P
- **武僧**：onOtherPlay `triggerPlayedCardType: tactic` 每打出战术 +1（可叠加）
- **溪流**：`searchFromHandOrDeck` 手牌/牌库检索名称含「鱼」的首张单位并部署
- **帆船**：`playRequirement` 需场上水环境才能打出（复制环境效果待后续批次）
- **引擎**：`meetsPlayRequirements` 接入 SP/MP/Client 出牌校验
- **测试**：`scripts/test-4p.mjs`（9/9）

## [1.0.6059] - 2026-07-04

### 卡牌效果批次 4O
- **猎人**：`conditionalPlayCost` 有自然环境时费用 0
- **游客**：`modifyPowerByUniqueAttributes` onGameEnd（含手牌）
- **药剂师**：`grantTacticPlayFree` 下一张药剂战术不占用行动
- **测试**：`scripts/test-4o.mjs`（9/9）

## [1.0.6058] - 2026-07-04

### 卡牌效果批次 4N
- **奴隶**：`excludeFromFieldCount` 不计入终局 6 张
- **蔓生怪**：`conditionalPlayCost` 有木环境时费用为 1
- **珊瑚元素**：`requireAllFieldAttributes` 水+光环境 onDeploy +3
- **引擎**：`countMainFieldCardsForLimit` 统一终局计数
- **测试**：`scripts/test-4n.mjs`（9/9）

## [1.0.6057] - 2026-07-04

### 卡牌效果批次 4M
- **萨满祭司**：`grantAttributePlayBonus` 风/火/水/土单位各 +1
- **珍珠商人**：`setD6MinForCardName` 贝壳 D6≥5 必出珍珠
- **海港**：`createSlot` + 船名词限制 + 部署 +3 + 不计终局数量
- **测试**：`scripts/test-4m.mjs`（13/13）

## [1.0.6056] - 2026-07-04

### 部署引擎（纯引擎，无卡数据）
- **额外槽位**：`SlotDeployRules` — 关键词/属性限制、`slotDeployedPowerBonus`、`slotExcludeFromFieldCount`
- **部署加成**：`grantAttributePlayBonus`、`applyUnitDeployBonuses` 统一单位进场加成
- **D6 下限**：`setD6MinForCardName`；`rollD6TierValue` 读取 `player.d6MinByCardName`
- **三端对齐**：SP/MP/Client `getAvailableSlotIndices`、`createExtraSlot(effect)`
- **测试**：`scripts/test-deploy-engine.mjs`（18/18）

## [1.0.6055] - 2026-07-04

### 卡牌效果批次 4L
- **海葵/翻车鱼/拾贝鱼人**：场上鱼牌计数 / 野兽打出双倍 buff / 检索贝壳洗牌
- **引擎**：`countMatchingFieldCards`、`buffPlayedCard`、`triggerCount`

## [1.0.6054] - 2026-07-04

### 卡牌效果批次 4K
- **奶牛/螃蟹/退役老兵**：场上名称为前置条件 / 条件抽牌 / 无其他士兵且有居民时自增战力
- **引擎**：`requireFieldName`、`noOtherFieldKeyword`、`requireOtherFieldKeyword`；onReveal `draw`

## [1.0.6053] - 2026-07-04

### 引擎债 + UX
- 环境摧毁、最后一轮限制、`unitPlayPowerBonus` 清除
- 游戏结束浮层、场上卡牌悬停效果详情

## [1.0.0] - 2026-02-12

### 🎉 重大更新

- **互联网联机部署完成**
  - 前端部署到 GitHub Pages
  - 后端使用 ngrok 临时隧道
  - 任何人都可以通过互联网访问和联机对战

### ✨ 新增功能

- GitHub Actions 自动部署工作流
- ngrok 配置支持（包含配置文件和启动脚本）
- 自动后端地址配置（生产/开发环境自动切换）
- 404.html 处理 SPA 路由
- **一键启动脚本**（start-all.bat, start-local.bat）
- **一键关闭脚本**（stop-all.bat）
- **一键更新脚本**（update-github.bat, update-github-custom.bat）

### 🐛 Bug 修复

- 修复 vue-tsc 版本兼容性问题
- 修复路由 base 路径配置错误
- 修复 GitHub Pages 白屏问题
- 修复构建脚本在 CI 环境的执行问题

### 📝 文档更新

- 整合所有文档到 PROJECT_DOCUMENTATION.md
- 删除多余的临时文档文件（9个）
- 更新 README 添加在线试玩链接和一键脚本说明
- 添加部署指南章节
- 创建 CHANGELOG.md 版本历史

### 🔧 优化改进

- 简化项目启动流程（一键启动）
- 简化代码更新流程（一键推送）
- 提升项目可移交性（新手友好）
- 完善错误提示和使用说明

---

## [0.9.0] - 2026-02-11

### 🎯 核心功能完成

- **权威服务器架构重构**
  - 游戏逻辑完全迁移到服务器端
  - 客户端只负责显示和发送请求
  - 防止作弊，确保游戏公平性

### ✨ 新增功能

- 独立决策系统（双方必须同步决策）
- 自动回合管理（双方准备好自动进入下一回合）
- 卡牌同时揭示机制
- 额外槽位效果（驮用马、狮鹫）
- 跳过回合功能

### 🐛 Bug 修复

- 修复操作绑定问题（一方操作影响另一方）
- 修复回合重复前进问题
- 修复卡牌隐藏后无法揭示
- 修复深拷贝场地状态避免污染原始数据
- 修复跳过回合功能失效

### 🔧 优化改进

- 添加详细的调试日志
- 优化决策提示UI
- 改进等待对手提示
- 完善服务器端游戏引擎

---

## [0.8.0] - 2026-02-07

### ✨ 新增功能

- 持久化玩家身份系统
- 玩家离开通知系统
- 断线重连机制
- 房间列表显示所有房间（包括游戏中）

### 🐛 Bug 修复

- 修复房间管理问题
- 修复操作同步问题
- 修复卡牌数据库ID问题
- 修复对手手牌初始化问题
- 修复费用不足卡住问题
- 修复离开游戏问题
- 修复最后一回合规则问题

---

## [0.7.0] - 早期

### ✨ 新增功能

- 联机系统实现
- Socket.IO 后端服务器
- 房间管理系统
- 联机大厅界面
- 服务器配置系统
- Sakura FRP 内网穿透支持

---

## [0.6.0] - 早期

### ✨ 新增功能

- 完整卡牌系统（15张卡牌）
- 卡牌类型系统（单位/环境/战术）
- 关键词系统
- 效果系统（部署/持续/条件效果）
- 槽位选择和目标选择
- 叠加效果（法师、战士、矮人铁匠）

---

## [0.5.0] - 早期

### ✨ 新增功能

- 基础游戏实现
- 2人回合制游戏（玩家 vs AI）
- 8张简单卡牌
- 基本游戏流程

---

## 图例

- 🎉 重大更新
- ✨ 新增功能
- 🐛 Bug 修复
- 🔧 优化改进
- 📝 文档更新
- ⚠️ 重要提示
