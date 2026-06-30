@echo off
echo ========================================
echo 卡牌游戏联机功能安装脚本
echo ========================================
echo.

echo [1/3] 安装前端依赖...
call pnpm add socket.io-client
if %errorlevel% neq 0 (
    echo 错误: 前端依赖安装失败
    pause
    exit /b 1
)
echo 前端依赖安装完成!
echo.

echo [2/3] 安装后端依赖...
cd server
call pnpm install
if %errorlevel% neq 0 (
    echo 错误: 后端依赖安装失败
    cd ..
    pause
    exit /b 1
)
cd ..
echo 后端依赖安装完成!
echo.

echo [3/3] 安装完成!
echo.
echo ========================================
echo 启动说明:
echo ========================================
echo 1. 启动后端服务器:
echo    cd server
echo    pnpm start
echo.
echo 2. 启动前端 (新终端):
echo    pnpm run dev
echo.
echo 3. 访问 http://localhost:5173
echo    点击 "联机对战" 开始游戏
echo ========================================
echo.
pause
