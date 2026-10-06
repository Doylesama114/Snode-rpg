# 手机 AI 顾问连接维护

2026-10-06 / v1.0.8044。

实际证据：v8043 APK 与 Pages 顾问页保留 __ADVISOR_API_BASE__。当仓库 ADVISOR_API_BASE 为空时，Android 发布只从 OSS 的 advisor-endpoint.txt 取地址；OSS 返回403导致没有注入。Pages 独立资源构建也未提供地址，客户端因此显示未配置。公开 FC 服务本身健康检查200、手机 Origin跨域预检204，真实问答正常。

唯一公开默认配置在 斯诺德跑团/advisor-service.js，只有版本和 HTTPS 地址，没有 API 密钥。scripts/prepare-advisor-config.cjs 供网页部署与资源构建使用，支持显式 ADVISOR_API_BASE 覆盖及已知公开地址备选。默认地址改变时必须复核后端公开触发器、/api/health 的 service字段、OPTIONS 与实际 /api/advise。

顾问页在聊天脚本前载入服务配置。APK构建将覆盖值在服务脚本前注入；原始网页部署生成公开配置文件。手机生产不回退 localhost，不再以已停用的 OSS 地址文件作为唯一来源。构建拒绝非法地址及包含凭据的 URL。

客户端健康检查的期限覆盖响应头与完整 JSON 体。检查需要 ok=true 且 service=snode-advisor，不能把普通200网页认为在线。重连期间复用同一检查，旧请求迟到不覆盖新状态。失败状态可恢复，不永久卡在连接中。

SSE事件解析器直接调用(event,payload)回调；兼容CRLF、跨块UTF8和末尾无分隔符。done完成回复并停止读取；error和超时恢复发送按钮。没有done的半截回复显示中断，不自动再生成同一问题。网关直接返回JSON时使用该回复。非流式兜底同样有完整响应期限。

保留_snowd_adv_mobile_session_v1及_snowd_adv_last_snapshot。流式回调绑定本次消息对象并受settled保护，避免旧请求在新问答中冒泡。不改自动小贴士偏好。

验证：node verify_mobile_advisor.cjs（10组，地址配置、备选地址、响应/响应体超时、重连、分块SSE、JSON网关、服务器错误、半截回复及聊天/角色快照保留）；已接入verify_all。--root允许直接验证正式APK解出的资源。线上验证用无玩家隐私的普通测试问题。前端浏览器模拟不能宣称Android真机验证。

涉及顶部重连按钮，验证360/390/1440视口及正式包。客户端脚本修改需刷新顾问HTML的脚本查询版本，并同步electron-app镜像。

连接配置在页面初始化前可用，避免在线后仍显示旧的“未配置”引导。修正共享皮肤隐藏顾问标题/状态的问题，让重连与在线状态在手机上可见。
