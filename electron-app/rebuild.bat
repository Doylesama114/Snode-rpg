@echo off
chcp 65001 >nul
echo ============================================
echo  斯诺德全职业技能树 - 重新打包工具
echo ============================================
echo.
echo 步骤1: 检测职业页文件...
if not exist "..\职业页\首页.html" (
    echo [错误] 找不到 职业页\首页.html
    echo 请确保本脚本位于 electron-app 目录内
    pause
    exit /b 1
)
echo [OK] 文件检测通过
echo.
echo 步骤2: 开始打包...
cd /d "%~dp0"
call npx electron-builder --win portable
echo.
if %errorlevel% equ 0 (
    echo ============================================
    echo  打包成功!
    echo  输出文件: dist\斯诺德全职业技能树.exe
    echo ============================================
    echo.
    echo 你可以将 dist\斯诺德全职业技能树.exe 发送给其他人
    echo 对方双击即可运行，无需安装任何环境
) else (
    echo [错误] 打包失败，请检查错误信息
)
echo.
pause
