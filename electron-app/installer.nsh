; electron-builder NSIS 自定义脚本
; - 处理 /S 标志实现静默安装
; - 完成页"创建桌面快捷方式"复选框

!macro customInit
  ; 处理 /S 标志实现静默安装
  ${GetParameters} $R0
  ${GetOptions} $R0 "/S" $R1
  ${IfNot} ${Errors}
    SetSilent silent
  ${EndIf}
!macroend

; 桌面快捷方式复选框 — 借用 MUI_FINISHPAGE_SHOWREADME
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_TEXT "创建桌面快捷方式"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION createDesktopShortcutFn

Function createDesktopShortcutFn
  CreateShortCut "$DESKTOP\斯诺德跑团.lnk" "$INSTDIR\${PRODUCT_NAME}.exe"
FunctionEnd
