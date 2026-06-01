; electron-builder NSIS 静默安装支持
; electron-builder 默认不处理 /S 标志，需要手动在 customInit 中添加
!macro customInit
  ${GetParameters} $R0
  ${GetOptions} $R0 "/S" $R1
  ${IfNot} ${Errors}
    SetSilent silent
  ${EndIf}
!macroend
