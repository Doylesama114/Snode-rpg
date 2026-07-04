# 更新日志

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
