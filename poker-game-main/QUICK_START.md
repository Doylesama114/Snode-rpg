# 🚀 快速开始指南

## 📋 前置要求

在开始之前，请确保已安装：

- ✅ [Node.js](https://nodejs.org/) (v16 或更高版本)
- ✅ [pnpm](https://pnpm.io/) (运行 `npm install -g pnpm` 安装)
- ⚠️ [ngrok](https://ngrok.com/) (可选，仅互联网联机需要)

---

## 🎮 方式1：一键启动（推荐）

### 本地开发测试

```bash
1. 双击 start-local.bat
2. 等待服务启动（约10秒）
3. 浏览器自动打开 http://localhost:5173
4. 开始游戏！
```

### 互联网联机

```bash
1. 双击 start-all.bat
2. 等待所有服务启动（约15秒）
3. 在 ngrok 窗口找到 "Forwarding" 地址
4. 复制 https://xxx.ngrok-free.dev 地址
5. 更新 src/config/multiplayer.ts 中的 production 地址
6. 双击 update-github.bat 推送更新
7. 等待 2-3 分钟部署完成
8. 访问 https://doylesama114.github.io/poker-game/
```

### 关闭服务

```bash
双击 stop-all.bat
```

---

## 🛠️ 方式2：手动启动

### 第一次使用

```bash
# 1. 安装前端依赖
pnpm install

# 2. 安装后端依赖
cd server
npm install
cd ..
```

### 启动服务

```bash
# 终端1：启动后端
cd server
node index.js

# 终端2：启动前端
pnpm run dev

# 终端3：启动 ngrok（可选）
ngrok http 3001
```

---

## 🎯 测试联机功能

### 本地测试（同一台电脑）

1. 打开浏览器访问 `http://localhost:5173`
2. 按 `Ctrl+Shift+N` 打开无痕窗口
3. 在无痕窗口访问 `http://localhost:5173`
4. 窗口1：点击"联机对战" → "创建房间"
5. 窗口2：点击"联机对战" → "加入房间" → 输入房间ID
6. 开始游戏！

⚠️ **重要**：必须使用无痕模式，避免 localStorage 冲突

### 局域网测试（同一网络）

1. 查看你的局域网IP：
   ```bash
   ipconfig
   # 找到 IPv4 地址，例如：192.168.1.100
   ```

2. 你的电脑访问：`http://localhost:5173`
3. 朋友的电脑访问：`http://192.168.1.100:5173`
4. 创建/加入房间，开始游戏！

### 互联网测试（不同网络）

1. 确保 ngrok 正在运行
2. 确保已更新配置并推送到 GitHub
3. 你访问：`https://doylesama114.github.io/poker-game/`
4. 朋友访问：`https://doylesama114.github.io/poker-game/`
5. 创建/加入房间，开始游戏！

---

## 🔧 常见问题

### Q: 启动失败，提示"未找到 Node.js"

**A**: 请先安装 Node.js
- 下载地址：https://nodejs.org/
- 安装后重启命令行

### Q: 启动失败，提示"未找到 pnpm"

**A**: 运行以下命令安装：
```bash
npm install -g pnpm
```

### Q: ngrok 启动失败

**A**: 需要配置 authtoken
```bash
# 1. 访问 https://dashboard.ngrok.com/
# 2. 复制你的 authtoken
# 3. 运行：
ngrok config add-authtoken 你的token
```

### Q: 无法连接到后端

**A**: 检查以下几点：
1. 后端服务是否正在运行（应该看到"服务器运行在端口 3001"）
2. 防火墙是否阻止了连接
3. 端口 3001 是否被其他程序占用

### Q: 朋友无法访问我的游戏

**A**: 
- 本地测试：确保在同一局域网
- 互联网：确保 ngrok 正在运行且配置正确

### Q: 如何更新代码到 GitHub？

**A**: 
```bash
# 方式1：快速更新
双击 update-github.bat

# 方式2：自定义提交信息
双击 update-github-custom.bat
```

---

## 📝 脚本说明

| 脚本 | 功能 | 使用场景 |
|------|------|----------|
| start-all.bat | 启动所有服务 | 互联网联机 |
| start-local.bat | 启动本地服务 | 本地开发测试 |
| stop-all.bat | 关闭所有服务 | 结束开发 |
| update-github.bat | 快速更新 | 日常代码更新 |
| update-github-custom.bat | 自定义更新 | 重要功能更新 |

---

## 🎉 开始游戏

现在你已经准备好了！

- **本地玩**：双击 `start-local.bat`
- **联机玩**：双击 `start-all.bat`
- **在线玩**：访问 https://doylesama114.github.io/poker-game/

祝你游戏愉快！🎮

---

## 📚 更多信息

- 完整文档：[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)
- 更新日志：[CHANGELOG.md](./CHANGELOG.md)
- 游戏规则：查看文档中的"游戏规则"章节
