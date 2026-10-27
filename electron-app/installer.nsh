; electron-builder NSIS custom script (ASCII only, avoid encoding issues)
; oneClick installer: electron-updater supported auto-update path.
; preInit pins the install directory to D:\SnodeRPG for both install and update.

!include "WinVer.nsh"

!macro preInit
  SetRegView 64
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\SnodeRPG"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\SnodeRPG"
!macroend

!macro customInit
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "This build requires Windows 10/11 64-bit."
    SetErrorLevel 1
    Quit
  ${EndIf}
!macroend
