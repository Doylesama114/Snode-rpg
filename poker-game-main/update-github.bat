@echo off
chcp 65001 >nul
echo ========================================
echo   一键更新 GitHub 项目
echo ========================================
echo.

REM 检查是否有未提交的更改
git status --short >nul 2>&1
if errorlevel 1 (
    echo [错误] 当前目录不是 Git 仓库
    pause
    exit /b 1
)

echo [1/4] 检查更改...
git status --short
echo.

REM 如果没有更改，提示并退出
git diff-index --quiet HEAD --
if %errorlevel% equ 0 (
    echo [提示] 没有需要提交的更改
    echo.
    pause
    exit /b 0
)

echo [2/4] 添加所有更改...
git add .
if errorlevel 1 (
    echo [错误] 添加文件失败
    pause
    exit /b 1
)
echo [完成] 文件已添加
echo.

REM 获取当前日期和时间
for /f "tokens=1-3 delims=/ " %%a in ('date /t') do (
    set DATE=%%a-%%b-%%c
)
for /f "tokens=1-2 delims=: " %%a in ('time /t') do (
    set TIME=%%a:%%b
)

echo [3/4] 提交更改...
git commit -m "Update: %DATE% %TIME%"
if errorlevel 1 (
    echo [错误] 提交失败
    pause
    exit /b 1
)
echo [完成] 更改已提交
echo.

echo [4/4] 推送到 GitHub...
git push
if errorlevel 1 (
    echo.
    echo [错误] 推送失败，可能的原因：
    echo   1. 网络连接问题
    echo   2. 需要配置 Git 凭据
    echo   3. 远程仓库地址错误
    echo.
    echo 请检查网络连接后重试
    pause
    exit /b 1
)

echo.
echo ========================================
echo   ✓ 成功更新到 GitHub！
echo ========================================
echo.
echo 提交信息: Update: %DATE% %TIME%
echo.
echo GitHub Actions 将自动部署到：
echo https://doylesama114.github.io/poker-game/
echo.
echo 预计 2-3 分钟后部署完成
echo.
pause
