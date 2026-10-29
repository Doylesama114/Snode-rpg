; electron-builder NSIS custom script (ASCII only, keep it that way)
; oneClick installer. Updates normally go through the portable zip path; this
; installer is for fresh installs and for migrating very old clients.

; Every run appends a diagnostic log to:
;   %APPDATA%\snowd-skill-tree\installer-logs\setup-<version>.log
; The desktop app bundles those files when the user exports diagnostics (desktop tools).

!include "WinVer.nsh"

Var /GLOBAL SnowdLogFile
Var /GLOBAL SnowdLogOn

; Write one line to the installer log (no-op if it cannot be opened).
!macro SnowdLogLine _TEXT
  ${If} $SnowdLogOn == "1"
    FileWrite $9 "${_TEXT}$\r$\n"
  ${EndIf}
!macroend

!macro SnowdLogOpen
  StrCpy $SnowdLogOn "0"
  CreateDirectory "$APPDATA\snowd-skill-tree\installer-logs"
  StrCpy $SnowdLogFile "$APPDATA\snowd-skill-tree\installer-logs\setup-${VERSION}.log"
  ClearErrors
  FileOpen $9 "$SnowdLogFile" a
  ${IfNot} ${Errors}
    StrCpy $SnowdLogOn "1"
    FileWrite $9 "$\r$\n=== run ===$\r$\n"
    nsExec::ExecToStack `"$SYSDIR\\cmd.exe" /C echo %DATE% %TIME%`
    Pop $0
    Pop $4
    FileWrite $9 "time: $4$\r$\n"
    FileWrite $9 "version: ${VERSION}$\r$\n"
    FileWrite $9 "installdir: $INSTDIR$\r$\n"
    FileWrite $9 "exedir: $EXEDIR$\r$\n"
    FileWrite $9 "cmdline: $CMDLINE$\r$\n"
    FileWrite $9 "appdata: $APPDATA$\r$\n"
    FileWrite $9 "temp: $TEMP$\r$\n"
    DetailPrint "snowd installer log: $SnowdLogFile"
  ${EndIf}
!macroend

!macro SnowdLogClose
  ${If} $SnowdLogOn == "1"
    FileClose $9
    StrCpy $SnowdLogOn "0"
  ${EndIf}
!macroend

; Dump the current state of the target executable + integrity info into the log.
!macro SnowdLogProbe _TAG
  ${If} $SnowdLogOn == "1"
    FileWrite $9 "[${_TAG}]$\r$\n"
    nsExec::ExecToStack `"$SYSDIR\cmd.exe" /C whoami /groups`
    Pop $0
    Pop $1
    FileWrite $9 "whoami-groups: $1$\r$\n"
    nsExec::ExecToStack `"$SYSDIR\cmd.exe" /C tasklist /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO CSV /NH`
    Pop $0
    Pop $2
    FileWrite $9 "tasklist-exit: $0$\r$\n"
    FileWrite $9 "tasklist: $2$\r$\n"
    nsExec::ExecToStack `"$SYSDIR\cmd.exe" /C tasklist /FO CSV /NH | "$SYSDIR\find.exe" /I "${APP_EXECUTABLE_FILENAME}"`
    Pop $0
    Pop $3
    FileWrite $9 "find-exit: $0$\r$\n"
    FileWrite $9 "find-out: $3$\r$\n"
  ${EndIf}
!macroend

!macro customInit
  !insertmacro SnowdLogOpen
  !insertmacro SnowdLogProbe init
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
  !insertmacro SnowdLogLine "uninstall-old: ignoring non-zero result (migration bridge)"
!macroend

!macro customUnInstallCheckCurrentUser
  DetailPrint "customUnInstallCheckCurrentUser: ignoring old uninstaller failure"
  !insertmacro SnowdLogLine "uninstall-old-current-user: ignoring non-zero result"
!macroend

; --- Running-app check (override electron-builder default) ------------
; Loop condition is taskkill's own exit code ('did it actually die?'):
;   0 = killed, 128 = no such process -> done; anything else -> retry, then explain.
!macro customCheckAppRunning
  ${If} $SnowdLogOn != "1"
    !insertmacro SnowdLogOpen
    !insertmacro SnowdLogProbe check-app-before
  ${EndIf}
  StrCpy $R9 0
  SnowdKillLoop:
    IntOp $R9 $R9 + 1
    nsExec::Exec `"$SYSDIR\taskkill.exe" /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
    Pop $R0
    ${If} $SnowdLogOn == "1"
      FileWrite $9 "kill-attempt-$R9 exit=$R0$\r$\n"
    ${EndIf}
    ${If} $R0 == 0
      Goto SnowdKillDone
    ${EndIf}
    ${If} $R0 == 128
      Goto SnowdKillDone
    ${EndIf}
    Sleep 1000
    ${If} $R9 < 20
      Goto SnowdKillLoop
    ${EndIf}
    !insertmacro SnowdLogProbe check-app-failed
    ${If} $SnowdLogOn == "1"
      FileClose $9
      StrCpy $SnowdLogOn "0"
    ${EndIf}
    MessageBox MB_OK|MB_ICONSTOP "Snowd RPG is still running and cannot be closed automatically.$\r$\n$\r$\nPlease send us the log file:$\r$\n$SnowdLogFile$\r$\n$\r$\n1) Open Task Manager and end every Snowd RPG.exe process, then run this installer again.$\r$\n2) If it still fails, right-click the installer and choose Run as administrator."
    Quit
  SnowdKillDone:
  !insertmacro SnowdLogLine "check-app: killed or absent, continuing"
  Sleep 800
!macroend