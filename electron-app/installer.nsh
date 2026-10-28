; electron-builder NSIS custom script (ASCII only, keep it that way)
; oneClick installer. Updates normally go through the portable zip path; this
; installer is for fresh installs and for migrating very old clients.

!include "WinVer.nsh"

!macro customInit
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "This build requires Windows 10/11 64-bit."
    SetErrorLevel 1
    Quit
  ${EndIf}
!macroend

; --- Migration bridge (old uninstallers) -------------------------------
; Old (<=1.0.8082) installs may have a broken uninstaller that returns non-zero
; when the new installer runs it with --updated, which used to abort the update
; with "Failed to uninstall old application files". Skipping the failure check
; lets the installer overwrite files in place instead of quitting.
!macro customUnInstallCheck
  DetailPrint "customUnInstallCheck: ignoring old uninstaller failure, continue overwrite"
!macroend

!macro customUnInstallCheckCurrentUser
  DetailPrint "customUnInstallCheckCurrentUser: ignoring old uninstaller failure"
!macroend

; --- Running-app check (override electron-builder default) ------------
; The default implementation decides by process PATH PREFIX ($INSTDIR) and then
; calls Stop-Process. That fails forever (endless 'cannot be closed' + useless
; retry) when the running app is elevated, shared by another user, or when
; $INSTDIR happens to be a prefix of an unrelated process path.
; This version kills by PROCESS NAME (/T kills children), retries ~20s, and
; finally tells the user exactly what to do.
!macro customCheckAppRunning
  StrCpy $R9 0
  nsExec::Exec `"$SYSDIR\taskkill.exe" /IM "${APP_EXECUTABLE_FILENAME}" /T /FI "USERNAME eq %USERNAME%"`
  Pop $R8
  Sleep 1500
  SnowdKillLoop:
    IntOp $R9 $R9 + 1
    nsExec::Exec `"$SYSDIR\taskkill.exe" /F /T /IM "${APP_EXECUTABLE_FILENAME}" /FI "USERNAME eq %USERNAME%"`
    Pop $R8
    Sleep 1000
    nsExec::Exec `"$SYSDIR\cmd.exe" /C tasklist /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FI "USERNAME eq %USERNAME%" /FO CSV /NH | "$SYSDIR\find.exe" /I "${APP_EXECUTABLE_FILENAME}"`
    Pop $R0
    ${If} $R0 != 0
      Goto SnowdKillDone
    ${EndIf}
    ${If} $R9 < 20
      Goto SnowdKillLoop
    ${EndIf}
    MessageBox MB_OK|MB_ICONSTOP "Snowd RPG is still running and cannot be closed automatically.$\r$\n$\r$\n1) Open Task Manager and end every Snowd RPG.exe process, then run this installer again.$\r$\n2) If it still fails, right-click the installer and choose Run as administrator."
    Quit
  SnowdKillDone:
!macroend
