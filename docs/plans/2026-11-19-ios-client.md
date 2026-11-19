# iOS 支持方案（PWA 版，2026-11-19）

- 状态：待执行（未改代码）
- 决策：**不购买 Apple Developer；不做 App Store / TestFlight / 原生壳**；只做 PWA
- 前提：站点已 HTTPS（GitHub Pages / 阿里云 OSS 均可）

## 1. 范围

| 做 | 不做 |
| --- | --- |
| PWA 清单与图标、主屏幕安装 | 原生 iOS 壳（Capacitor/Swift） |
| 离线缓存与版本更新 | TestFlight / App Store 上架 |
| 存储迁移（localStorage → IndexedDB）与备份 | 推送通知 |
| iOS 适配（安全区、视口、输入、手势） | iPad 专属布局 |
| 安装引导页 + 用户自检页 | 付费证书与签名 |

## 2. 交付物

| # | 交付物 | 说明 |
| --- | --- | --- |
| 1 | manifest.webmanifest | name/short_name/start_url/display=standalone/theme/背景色/180·192·512 图标 |
| 2 | 图标 | apple-touch-icon 180、iPad 167、favicon 32/16 |
| 3 | meta 补齐 | apple-mobile-web-app-capable、status-bar-style、theme-color、viewport-fit=cover |
| 4 | service worker | 预缓存核心资源 + 版本号；更新采用「新 SW 就绪 → 提示刷新」 |
| 5 | 存储迁移 | 存档写 IndexedDB，保留 localStorage 迁移；navigator.storage.persist() |
| 6 | 备份入口 | 导出全部存档 / 导入；写失败明确提示剩余配额 |
| 7 | 安装引导页 | 图文：Safari → 分享 → 添加到主屏幕；检测 standalone 时不显示 |
| 8 | 用户自检页 | 显示 iOS 版本、standalone、SW 状态、存储用量与配额、安全区数值，一键复制反馈 |

## 3. 阶段与工期

| 阶段 | 内容 | 工期 |
| --- | --- | --- |
| P0-1 | manifest + 图标 + meta + SW（含离线与更新提示） | 1 天 |
| P0-2 | 存储迁移 IndexedDB + persist + 导出/导入 + 配额提示 | 1.5 天 |
| P0-3 | iOS 适配：safe-area、100dvh、输入 16px、手势与滚动 | 1 天 |
| P0-4 | 安装引导页 + 自检页 + 内测清单 | 0.5 天 |
| P0-5 | 验收：WebKit + Lighthouse + 内测反馈 | 1 天 |
| 合计 | | **5 天** |

## 4. 验收标准

| 项 | 标准 | 验证方式 |
| --- | --- | --- |
| 可安装 | Safari 分享菜单出现「添加到主屏幕」，图标与名称正确 | 内测用户截图 |
| 全屏 | 从主屏幕启动无地址栏，状态栏样式正确 | 内测用户截图 |
| 离线 | 断网后仍能打开启动台与已访问页面 | 内测用户操作 |
| 存储 | 写入 10 个角色存档不报错；配额占用可见 | 自动化 + 内测 |
| 备份 | 导出文件可在「文件」App 中找到并能重新导入 | 内测用户操作 |
| 布局 | 刘海/底部手势条不遮挡导航与 FAB | WebKit 截图 + 内测 |
| 更新 | 发版后重开提示「有新版本，点击刷新」 | WebKit 模拟 |

## 5. 测试方案（无测试机）

| 层级 | 手段 | 覆盖 |
| --- | --- | --- |
| 1 | Playwright WebKit（390×844 / 430×932，touch + iOS UA） | 布局、交互、storage 逻辑 |
| 2 | Lighthouse（Chromium） | manifest、SW、离线可安装性（iOS 差异需人工确认） |
| 3 | 内测用户 + 自检页 | 真机 Safari 行为、存储配额、安装流程 |
| 4 | 现有 bug-report / 反馈通道 | 收集截图与自检 JSON |

自检页输出示例（供反馈）：

    standalone: true/false
    iOS: 17.4 / Safari
    serviceWorker: activated / none
    storage: used 1.2MB / quota 5.0MB
    safeArea: top 59 / bottom 34

## 6. 风险与对策

| 风险 | 对策 |
| --- | --- |
| iOS localStorage 约 5MB | 迁 IndexedDB；写入失败捕获并提示导出 |
| 未安装站点 7 天可能清数据 | 安装引导置顶；设置页提示定期导出 |
| SW 缓存导致旧版本 | 版本号随 bump 更新；检测到新 SW 时提示刷新 |
| 独立模式下文件下载受限 | 导出改走分享/在新标签打开，失败给操作指引 |
| 真机问题难复现 | 自检页 + 截图 + 版本信息，反馈模板固定 |

## 7. 发布方式

- 站点照常发版（GitHub + OSS 镜像）；
- 用户首次访问 → 安装引导 → 添加到主屏幕；
- 无需签名、无需审核、无需付费账号。

## 8. 明确不做

- Apple Developer Program、TestFlight、App Store；
- 原生壳与 IPA 构建；
- 推送通知与后台任务。

## 9. 需要用户配合的事

1. 找 3–5 名 iPhone 内测用户（现有用户即可）；
2. 每人按「安装引导」走一遍，打开自检页并回传截图/JSON；
3. 反馈问题走现有 bug-report 入口，附自检信息。

## 10. 执行记录（2026-11-19）

### 已完成

| 项 | 结果 |
| --- | --- |
| manifest.webmanifest | 已上线（name/short_name/start_url/standalone/icons/theme） |
| 图标 | icons/ 下 6 个（180/167/192/512/1024/32），由脚本生成 |
| SW | sw.js：导航 network-first、静态 cache-first、版本常量、更新不自动接管 |
| pwa.js | 注册 SW、更新提示条、standalone 标记、storage.persist、自检 API |
| 页面 meta | 启动台 / 主页 补齐 manifest、apple-touch-icon、theme-color、viewport-fit=cover |
| 安装引导页 | 安装到主屏幕.html：iOS/Android 步骤 + 自检 + 复制结果 |
| iOS CSS | 安全区（仅独立模式影响 body）、固定元素避让、输入字号（仅 iOS） |
| 门禁 | verify/verify_pwa.mjs 接入 verify_all：Clean 58/58 · Errors 4 · 913P 0F |
| 部署 | GitHub Pages 已发布，manifest/sw/图标/安装页均 200 |

### 未完成（下一步）

- **IndexedDB 迁移**：目前仍用 localStorage，只是加了 persist 与写入失败提示；5MB 上限风险仍在；
- 离线二次验证：需内测用户在真机确认；
- OSS 镜像 web 路径当前返回 403（与本次无关，需单独排查 bucket 策略）。

### 测试入口

- 安装页：https://doylesama114.github.io/Snode-rpg/斯诺德跑团/安装到主屏幕.html
- 说明：docs/guides/ios-内测说明.md

### 2026-11-20 调整（A 方案）

决定：**不要求用户安装**，iOS 用户直接用 Safari 网页。

| 保留 | 移除 |
| --- | --- |
| manifest.webmanifest + icons | sw.js（离线缓存） |
| apple meta / theme-color / viewport-fit | pwa.js（SW 注册、更新提示） |
| guild-ui.css 的 14 行 iOS 适配 | 安装到主屏幕.html |
| 启动台/主页 head 的静态标签 | 站内安装引导（未上线即取消） |

移除原因：SW 对 JS 采用缓存优先，安卓 WebView（appsettings 域名是安全上下文）会注册并可能缓存旧 JS，影响 OTA 更新；且会增加每次发版的版本号维护。

结果：用户零额外操作；自愿「添加到主屏幕」的用户仍能得到正确图标与全屏；无离线能力。
