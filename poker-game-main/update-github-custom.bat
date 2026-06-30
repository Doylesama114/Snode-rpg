@echo off
chcp 65001 >nul
echo ========================================
echo   一键更新 GitHub 项目（自定义提交信息）
echo ========================================
echo.

REM 检查是否有未提交的更改
git status --short >nul 2>&1
if errorlevel 1 (
    echo [错误] 当前目录不是 Git 仓库
    pause
    exit /b 1
)

echo [1/5] 检查更改...
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

echo [2/5] 请输入提交信息（描述你做了什么修改）：
set /p COMMIT_MSG="> "

if "%COMMIT_MSG%"=="" (
    echo [错误] 提交信息不能为空
    pause
    exit /b 1
)

echo.
echo [3/5] 添加所有更改...
git add .
if errorlevel 1 (
    echo [错误] 添加文件失败
    pause
    exit /b 1
)
echo [完成] 文件已添加
echo.

echo [4/5] 提交更改...
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo [错误] 提交失败
    pause
    exit /b 1
)
echo [完成] 更改已提交
echo.

echo [5/5] 推送到 GitHub...
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
echo 提交信息: %COMMIT_MSG%
echo.
echo GitHub Actions 将自动部署到：
echo https://doylesama114.github.io/poker-game/
echo.
echo 预计 2-3 分钟后部署完成
echo.
pause
