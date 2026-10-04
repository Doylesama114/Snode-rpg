# Android 移动资源更新

2026-10-05 / v1.0.8042。

## 故障证据

实际请求 mobile/version.json、核心 ZIP、桌面最新版本清单和 OSS 网页均返回 HTTP 403。清单 XML 的 Code 为 UserDisable、EC 为 0003-00000801。阿里云说明此错误表示账户禁用，欠费是一种可能原因：[官方说明](https://www.alibabacloud.com/help/zh/oss/user-guide/0003-00000801)。客户端无法支付或恢复账户。

旧 UpdateManager 仅请求 OSS，失败返回 null 并静默加载旧版本。新包下载失败也静默回退。首次安装没有离线内容，资源不可达时无法进入。原生页面仍用 LOAD_DEFAULT / clearCache(false)，缺少缓存响应头；旧页面、新脚本和样式可能混用。启动台移动更新入口实际使用桌面 exe 清单。

## 更新事务

MobileUpdateEngine 是实际 Android 调用的 Java 引擎，JVM 测试直接运行同一类。清单要求三段数字版本、core/poker 两包、非零长度、SHA-256 和受限地址。包下载必须精确满足长度和哈希，随后限制解压大小、拒绝路径越界及重复文件，验证三个应用入口。

新资源写到 .staging 独立目录，生成文件清单收据。启动时核对每个文件长度及 HTML/JS/CSS/JSON 哈希。资源全部就绪才重命名目录，写入临时版本指针并 fsync，使用 Android POSIX 原子 rename 替换当前指针。版本指针损坏时可读取 previous 中仍完整的版本；旧格式兼容。版本比较阻止降级。更新在进程内串行执行。

保留当前及前一已验证目录，并额外固定 WebView 正在使用的目录；玩家连续推迟刷新也不会被清理。清理只在应用私有 mobile/packages 下进行，不删除角色存储、偏好或 WebView 数据。

## 运行与渠道

APK 从 dist_mobile 将两 ZIP 和清单打进 bootstrap 资产，按同一校验逻辑安装内置资源。先打开可用本地资源，再后台检查三条清单渠道；候选按版本排序，同版本候选下载失败后继续尝试其他清单。远端全部失效仍可使用本地内容，给出警告。更新完成后由用户保存角色再重新加载，稍后选择在下次启动生效。

保持 https://appassets.androidplatform.net 来源不变。FilesPathHandler 返回 Cache-Control: no-store，WebView 使用 LOAD_NO_CACHE，资源切换 clearCache(true)，不清理 DOM storage。

启动台手动检查调用 mobileBridge.checkResourceUpdate，Android 下载选择 APK。跳过网页版自动定时检查，避免重新加载后两秒再次检查形成循环。旧 bridge 显示升级原生更新器的路径。

## 发布

Release 上传 APK、core/poker ZIP 与 mobile-version.json；OSS 副本仅在两 ZIP 成功后发布清单，不允许清单指向上传失败的资源。OSS 可选镜像失败在日志中保留，不能作为主发布完成的依据。

GitHub Pages 构建独立 ZIP 与清单，一次部署原子切换，哈希与该渠道自身的 ZIP 对应；不可混用不同构建的清单和 ZIP。同版本候选失败会尝试 Release 清单。APK 打包资源与 Release 的 ZIP 来自同一次构建。

原有客户端缺少备用更新器，需要用户下载 APK 覆盖安装一次。禁止建议卸载或清除应用数据来解决问题。账号所有者恢复 OSS 后重跑镜像。

## 验证

- node verify_mobile_update.cjs：实际构建/解压 ZIP、SHA 与长度、真实包页面、Android 原生桥调用、APK 下载、旧 bridge、360/390/1440 视口、存档和偏好保留。
- gradle testDebugUnitTest -PskipBootstrap=true：15 个实际引擎场景，包括 403、备源、坏哈希、下载中断、缺入口、同版本旧缓存迁移、损坏脚本修复、损坏版本指针、拒绝降级、路径越界、推迟刷新保护。
- 主分支独立 native-update 流水线须先通过再打标签；正式 Android 构建再次运行单元测试。Windows 桌面与完整业务回归保留。
- 发布后核对 APK 签名/包名、APK bootstrap 内清单和 ZIP 哈希、Release ZIP 与清单、Pages ZIP 与清单及网页版本，记录 OSS 真实状态。

没有连接 Android 真机，浏览器模拟和 JVM 原生事务测试不能描述为 Android 真机端到端验证。
