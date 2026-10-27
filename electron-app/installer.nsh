; electron-builder NSIS custom script (ASCII only)
; oneClick installer: the only form electron-updater supports for auto-update.
; preInit pins InstallLocation to D:\SnodeRPG (HKCU only: perMachine=false, no elevation).

!include "WinVer.nsh"

!macro preInit
  SetRegView 64
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\SnodeRPG"
!macroend

!macro customInit
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "This build requires Windows 10/11 64-bit."
    SetErrorLevel 1
    Quit
  ${EndIf}
!macroend

; Migration bridge: old (<=1.0.8082) installs may have a broken uninstaller that returns
; non-zero when the installer runs it with --updated. Historically that aborted the whole
; update with "Failed to uninstall old application files". These macros instruct
; handleUninstallResult to skip its failure check, so the installer just overwrites the
; files in place instead of quitting. Stale leftovers are harmless.
!macro customUnInstallCheck
  DetailPrint "customUnInstallCheck: ignoring old uninstaller failure, continue overwrite"
!macroend

!macro customUnInstallCheckCurrentUser
  DetailPrint "customUnInstallCheckCurrentUser: ignoring old uninstaller failure"
!macroend
