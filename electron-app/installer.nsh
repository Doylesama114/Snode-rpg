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
