@echo off
chcp 65001 >nul
echo ========================================
echo   🚀 一键启动本地服务器（不含 ngrok）
echo ========================================
echo.
echo 正在启动以下服务：
echo   1. 后端服务器 (端口 3001)
echo   2. 前端开发服务器 (端口 5173)
echo.
echo 💡 适用场景：
echo   - 本地开发和测试
echo   - 局域网内联机对战
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

echo.
echo ========================================
echo   启动服务中...
echo ========================================
echo.

REM 启动后端服务器
echo [1/2] 启动后端服务器...
start "后端服务器 (端口 3001)" cmd /k "cd server && node index.js"
timeout /t 2 /nobreak >nul
echo [完成] 后端服务器已启动
echo.

REM 启动前端开发服务器
echo [2/2] 启动前端开发服务器...
start "前端开发服务器 (端口 5173)" cmd /k "pnpm run dev"
timeout /t 2 /nobreak >nul
echo [完成] 前端开发服务器已启动
echo.

echo ========================================
echo   ✓ 本地服务已启动！
echo ========================================
echo.
echo 📝 服务信息：
echo   - 后端服务器: http://localhost:3001
echo   - 前端服务器: http://localhost:5173
echo.
echo 🎮 开始游戏：
echo   1. 打开浏览器访问 http://localhost:5173
echo   2. 打开无痕窗口访问 http://localhost:5173
echo   3. 一个窗口创建房间，另一个加入房间
echo   4. 开始游戏！
echo.
echo 🛑 关闭服务：
echo   - 运行 stop-all.bat 或关闭所有命令行窗口
echo.
pause
