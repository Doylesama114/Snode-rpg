@echo off
setlocal
if "%SNODE_CLI_MACHINE%"=="1" goto machine
if /I "%~1"=="--json" goto machine
if exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" goto display
goto machine

:display
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\snode-display.ps1" %*
exit /b %ERRORLEVEL%

:machine
set "SNODE_CLI_SCRIPT=%~dp0scripts\snode-cli.mjs"
set "SNODE_CLI_RUNTIME="
for %%F in ("%~dp0*.exe") do if exist "%%~fF" call :candidate "%%~fF"
if defined SNODE_CLI_RUNTIME goto bundled
for %%F in ("%~dp0electron-app\dist\win-unpacked\*.exe") do if exist "%%~fF" call :candidate "%%~fF"
if defined SNODE_CLI_RUNTIME goto bundled
where.exe node.exe >nul 2>nul
if not errorlevel 1 goto system_node
echo Unable to find Snode's bundled runtime or Node.js. 1>&2
exit /b 1

:bundled
set "ELECTRON_RUN_AS_NODE=1"
"%SNODE_CLI_RUNTIME%" "%SNODE_CLI_SCRIPT%" %*
exit /b %ERRORLEVEL%

:system_node
node "%SNODE_CLI_SCRIPT%" %*
exit /b %ERRORLEVEL%

:candidate
set "SNODE_CLI_CANDIDATE=%~n1"
if /I "%SNODE_CLI_CANDIDATE:~0,5%"=="Unins" exit /b 0
set "SNODE_CLI_RUNTIME=%~f1"
exit /b 0
