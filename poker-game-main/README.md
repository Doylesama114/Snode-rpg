# 🎮 卡牌对战游戏

一个基于 Vue 3 + TypeScript 的回合制卡牌对战游戏，支持单机AI对战和在线联机对战。

## 🌐 在线试玩

**游戏地址**: https://doylesama114.github.io/poker-game/

随时随地，打开浏览器即可开始游戏！

## ✨ 特色功能

- 🃏 **15张独特卡牌** - 每张只有1份，包含单位、环境、战术三种类型
- ⚔️ **复杂效果系统** - 部署效果、持续效果、叠加效果
- 🎯 **策略性玩法** - 槽位选择、目标选择、重铸系统
- 🌐 **联机对战** - 基于 WebSocket 的实时对战
- 🔧 **内网穿透支持** - 支持 Sakura FRP，可与互联网上的朋友对战

## 🚀 快速开始

### 方式1：一键启动（推荐）

```bash
# 启动所有服务（前端 + 后端 + ngrok）
双击 start-all.bat

# 或只启动本地服务（前端 + 后端）
双击 start-local.bat

# 关闭所有服务
双击 stop-all.bat
```

### 方式2：手动启动

#### 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖
cd server
npm install
```

#### 启动游戏

```bash
# 1. 启动后端服务器（新终端）
cd server
npm start

# 2. 启动前端（新终端）
npm run dev
```

### 测试联机功能

1. 打开浏览器访问 `http://localhost:5173`
2. 打开无痕窗口（Ctrl+Shift+N）访问 `http://localhost:5173`
3. 窗口1: 联机对战 → 创建房间
4. 窗口2: 联机对战 → 加入房间
5. 开始游戏！

⚠️ **重要**: 测试联机时必须使用无痕模式，避免标签页之间的存储冲突。

## 📚 完整文档

详细的项目文档、技术架构、开发历史和常见问题，请查看：

**[📖 PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)**

包含内容：
- 项目概述和技术架构
- 核心功能详解
- 文件结构说明
- 游戏规则
- 联机系统指南
- 完整的开发历史和修复记录
- 快速开始指南
- 常见问题解答

## 🎯 游戏规则（简要）

- **牌组**: 15张卡牌，每张1份
- **起始**: 3张手牌，4点费用
- **回合**: 抽牌 → 选择出牌/重铸 → 执行操作
- **胜利**: 填满6个槽位触发最后一回合，战力高者获胜

## 🛠️ 开发工具

### 一键脚本

项目提供了便捷的批处理脚本：

- **start-all.bat** - 启动所有服务（前端 + 后端 + ngrok）
- **start-local.bat** - 启动本地服务（前端 + 后端）
- **stop-all.bat** - 关闭所有服务
- **update-github.bat** - 快速更新到 GitHub
- **update-github-custom.bat** - 自定义提交信息更新

### 使用方法

1. **开发测试**：双击 `start-local.bat`
2. **互联网联机**：双击 `start-all.bat`
3. **关闭服务**：双击 `stop-all.bat`
4. **更新代码**：双击 `update-github.bat`

## 🛠️ 技术栈

- **前端**: Vue 3, TypeScript, Vite, UnoCSS
- **后端**: Node.js, Express, Socket.IO
- **部署**: GitHub Pages (前端), ngrok (后端)
- **架构**: 权威服务器（Authoritative Server）
- **实时通信**: WebSocket

## 📁 项目结构

```
├── src/
│   ├── composables/      # 游戏逻辑
│   ├── views/Game/       # 游戏界面
│   ├── data/            # 卡牌数据
│   ├── game/            # 效果管理
│   └── types/           # 类型定义
├── server/              # 后端服务器
└── PROJECT_DOCUMENTATION.md  # 完整文档
```

## 🐛 问题反馈

如遇到问题，请查看 [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) 的"常见问题"章节。

## 📝 更新日志

详见 [CHANGELOG.md](./CHANGELOG.md)

## 📄 许可证

见 [LICENSE](./LICENSE) 文件

---

**开始游戏**: `npm run dev` (前端) + `cd server && npm start` (后端)

**完整文档**: [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)
