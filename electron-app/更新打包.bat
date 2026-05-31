@echo off
chcp 65001 >nul
title 斯诺德全职业技能树 - 打包工具
echo ==========================================
echo   斯诺德全职业技能树 - 一键打包
echo ==========================================
echo.

:: 设置路径
set "APP_DIR=%~dp0"
set "PORTABLE_DIR=%APP_DIR%dist\portable"
set "ZIP_FILE=%APP_DIR%斯诺德全职业技能树.zip"

:: 清理旧的输出
if exist "%PORTABLE_DIR%" rmdir /s /q "%PORTABLE_DIR%"
if exist "%ZIP_FILE%" del "%ZIP_FILE%"

echo [1/3] 复制职业页文件...
xcopy /E /Y /I "%APP_DIR%..\职业页" "%APP_DIR%职业页\" >nul
if %ERRORLEVEL% neq 0 ( echo 失败! && pause && exit /b 1 )
echo 完成

echo [2/3] 打包便携版...
cd /d "%APP_DIR%"
call npx electron-builder --win portable --config=electron-builder.yml
if %ERRORLEVEL% neq 0 (
    echo.
    echo electron-builder 失败，尝试直接创建便携目录...
    mkdir "%PORTABLE_DIR%" 2>nul
    mkdir "%PORTABLE_DIR%\resources\app" 2>nul
    xcopy /E /Y /I "node_modules\electron\dist\*" "%PORTABLE_DIR%\" >nul
    xcopy /E /Y /I "main.js" "%PORTABLE_DIR%\resources\app\" >nul
    xcopy /E /Y /I "package.json" "%PORTABLE_DIR%\resources\app\" >nul
    xcopy /E /Y /I "职业页" "%PORTABLE_DIR%\resources\app\职业页\" >nul
    ren "%PORTABLE_DIR%\electron.exe" "斯诺德全职业技能树.exe"
    echo 便携目录创建完成
)

echo [3/3] 压缩为ZIP...
powershell -Command "Compress-Archive -Path '%PORTABLE_DIR%\*' -DestinationPath '%ZIP_FILE%' -Force"
if %ERRORLEVEL% neq 0 ( echo 压缩失败，请手动压缩 dist\portable 文件夹 )
echo.

echo ==========================================
echo 打包完成！
echo.
echo 输出文件：%ZIP_FILE%
echo 便携目录：%PORTABLE_DIR%
echo.
echo 你可以将 ZIP 解压后运行，或双击便携目录中的
echo "斯诺德全职业技能树.exe" 直接使用。
echo ==========================================
pause
