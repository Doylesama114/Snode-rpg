@echo off
chcp 65001 >nul
echo ========================================
echo   🚀 一键启动游戏服务器
echo ========================================
echo.
echo 正在启动以下服务：
echo   1. 后端服务器 (端口 3001)
echo   2. 前端开发服务器 (端口 5173)
echo   3. ngrok 后端隧道
echo.
echo ⚠️  注意：
echo   - 请确保已安装 Node.js 和 pnpm
echo   - 请确保已安装 ngrok 并配置 authtoken
echo   - 三个服务将在独立窗口运行
echo.
pause

REM 检查 Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

REM 检查 pnpm
where pnpm >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 pnpm，请先安装 pnpm
    echo 安装命令: npm install -g pnpm
    pause
    exit /b 1
)

REM 检查 ngrok
where ngrok >nul 2>&1
if errorlevel 1 (
    echo [警告] 未找到 ngrok
    echo 如果需要互联网联机，请安装 ngrok
    echo 下载地址: https://ngrok.com/
    echo.
    echo 按任意键继续（不启动 ngrok）...
    pause >nul
    set SKIP_NGROK=1
) else (
    set SKIP_NGROK=0
)

echo.
echo ========================================
echo   启动服务中...
echo ========================================
echo.

REM 启动后端服务器
echo [1/3] 启动后端服务器...
start "后端服务器 (端口 3001)" cmd /k "cd server && node index.js"
timeout /t 2 /nobreak >nul
echo [完成] 后端服务器已启动
echo.

REM 启动前端开发服务器
echo [2/3] 启动前端开发服务器...
start "前端开发服务器 (端口 5173)" cmd /k "pnpm run dev"
timeout /t 2 /nobreak >nul
echo [完成] 前端开发服务器已启动
echo.

REM 启动 ngrok
if %SKIP_NGROK%==0 (
    echo [3/3] 启动 ngrok 后端隧道...
    start "ngrok 后端隧道" cmd /k "ngrok http 3001"
    timeout /t 2 /nobreak >nul
    echo [完成] ngrok 隧道已启动
    echo.
) else (
    echo [3/3] 跳过 ngrok 启动
    echo.
)

echo ========================================
echo   ✓ 所有服务已启动！
echo ========================================
echo.
echo 📝 服务信息：
echo   - 后端服务器: http://localhost:3001
echo   - 前端服务器: http://localhost:5173
if %SKIP_NGROK%==0 (
    echo   - ngrok 隧道: 查看 ngrok 窗口获取地址
    echo.
    echo 💡 提示：
    echo   1. 在 ngrok 窗口中找到 "Forwarding" 地址
    echo   2. 复制 https://xxx.ngrok-free.dev 地址
    echo   3. 更新 src/config/multiplayer.ts 中的 production 地址
    echo   4. 运行 update-github.bat 推送更新
)
echo.
echo 🎮 开始游戏：
echo   - 本地测试: 打开浏览器访问 http://localhost:5173
echo   - 互联网访问: https://doylesama114.github.io/poker-game/
echo.
echo 🛑 关闭服务：
echo   - 运行 stop-all.bat 或关闭所有命令行窗口
echo.
pause
