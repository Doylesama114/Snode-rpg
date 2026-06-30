@echo off
chcp 65001 >nul
echo ========================================
echo   🛑 一键关闭游戏服务器
echo ========================================
echo.
echo 正在关闭以下服务：
echo   1. 后端服务器 (Node.js)
echo   2. 前端开发服务器 (Vite)
echo   3. ngrok 隧道
echo.
pause

echo.
echo ========================================
echo   关闭服务中...
echo ========================================
echo.

REM 关闭 Node.js 进程（后端服务器）
echo [1/3] 关闭后端服务器...
taskkill /F /IM node.exe >nul 2>&1
if errorlevel 1 (
    echo [提示] 未找到运行中的后端服务器
) else (
    echo [完成] 后端服务器已关闭
)
echo.

REM 关闭 ngrok 进程
echo [2/3] 关闭 ngrok 隧道...
taskkill /F /IM ngrok.exe >nul 2>&1
if errorlevel 1 (
    echo [提示] 未找到运行中的 ngrok 隧道
) else (
    echo [完成] ngrok 隧道已关闭
)
echo.

REM 关闭所有命令行窗口（除了当前窗口）
echo [3/3] 关闭相关命令行窗口...
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq cmd.exe" /FO LIST ^| find "PID:"') do (
    if not %%a==%PID% (
        taskkill /F /PID %%a >nul 2>&1
    )
)
echo [完成] 命令行窗口已关闭
echo.

echo ========================================
echo   ✓ 所有服务已关闭！
echo ========================================
echo.
echo 💡 提示：
echo   - 如果需要重新启动，运行 start-all.bat
echo   - 如果有进程未关闭，请手动关闭窗口
echo.
pause
