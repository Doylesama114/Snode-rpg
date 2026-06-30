@echo off
echo ========================================
echo   启动 ngrok 双隧道
echo ========================================
echo.
echo 请确保：
echo 1. 后端服务运行在 3001 端口
echo 2. 前端服务运行在 5173 端口
echo 3. 已配置 authtoken
echo.
echo 按任意键开始启动...
pause >nul

echo.
echo 正在启动 ngrok 隧道...
echo.

ngrok start --all --config=ngrok-config.yml

pause
