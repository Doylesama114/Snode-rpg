# macOS 版本打包与安装

本版沿用线上 Electron 44.5.1，与 Windows 版本共用最新桌面壳、崩溃恢复及顾问逻辑。Mac 版默认生成 DMG 安装程序，分为 Apple 芯片 `arm64` 和 Intel `x64`，产物在 `electron-app/dist/mac/`。用户双击 DMG 后将应用拖入“应用程序”即可安装。

## 在 Windows 上生成 Mac 测试包

```sh
cd electron-app
npm ci
npm run dist:mac -- --zip
```

Windows 必须显式使用 `--zip` 选择测试压缩包；默认 DMG 命令会提示使用 Mac 或云端 Mac 构建。测试压缩包需要 Node.js 和 Python 3.9+；单架构可用 `npm run dist:mac:arm64 -- --zip` 或 `npm run dist:mac:x64 -- --zip`。此路径下载并校验 Electron 官方 Mac 运行时，将应用和正式运行依赖封装为 `app.asar`，在 ZIP 内保留 macOS 的可执行权限及框架符号链接。

产物名称是 `Snode-RPG-<版本>-mac-<架构>-test.zip`。每份 ZIP 都包含 `斯诺德跑团.app`、`首次运行.command` 和 `Mac使用说明.txt`，另有记录校验结果和 SHA-256 的 `.manifest.json`。测试包尚未经过真实 Mac 运行验证；首次启动需在 Mac 上执行随包的签名脚本，不能将它视为已签名、公证的正式发行版。

在 Mac 上使用系统“归档实用工具”解压。在终端输入 `bash `，将解压后的 `首次运行.command` 拖进去，再按回车。脚本只对同文件夹内的本应用清除下载隔离属性、生成本机 ad-hoc 签名并验证，然后启动应用。之后可将 `.app` 拖入“应用程序”并直接打开。

## 在 Mac 上生成 DMG 安装程序

```sh
cd electron-app
npm ci
npm run dist:mac
# 只构建本机所需架构：
npm run dist:mac:arm64
npm run dist:mac:x64
```

Mac 默认使用 `electron-builder.mac.yml` 构建 DMG，并生成 ad-hoc 签名。可以加 `-- --zip` 显式生成上述测试压缩包。DMG 内将应用拖入 Applications 即可安装；ad-hoc 签名不等于 Apple Developer ID 签名，下载后的应用仍可能需要在系统“隐私与安全性”中允许打开。

`.github/workflows/build-mac.yml`（Build macOS Installers）提供手动 Actions 构建、`codex/mac-installer-*` 构建分支及 `v*` tag 构建。Apple 芯片和 Intel 使用对应架构的 Mac runner，构建后校验签名并实际启动打包应用，检查角色创建流程与角色列表。tag 发布会自动将 DMG 上传到该版本的 GitHub Release，用户可以直接下载安装程序。手动／构建分支产物也保留在 Actions 的 Artifacts；其下载包含一层运输用 ZIP，解压后交付其中的 `.dmg` 文件即可。runner 架构标签见 [GitHub 官方说明](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)。

## 功能与配置

- Mac 保留原生编辑菜单及 Cmd+C/V/A 快捷键；关闭全部窗口后保留 Dock 应用，点击 Dock 图标重新打开。
- 本机角色资料由 Electron 存入 `~/Library/Application Support/`，替换应用后仍可继续使用。
- CLI 无需另装 Node.js。先打开应用，再执行 `"/Applications/斯诺德跑团.app/Contents/Resources/snode" chargen flow`。CLI 自动寻找 Mac 的连接文件。
- 发行包只包含 `.env.example`，不读取本机 `.env` 或 Windows 的 `.env.bundle`。使用 AI 顾问时，可将 `Contents/Resources/.env.example` 复制成 `Contents/Resources/.env` 并自行配置 API Key。
- CLI、说明文件和顾问数据统一通过 `extraResources` 放入 `Contents/Resources`，保持标准 Mac 应用目录结构；放在 `Contents` 根目录会导致签名把资源误判为代码。资源位置见 [electron-builder 文档](https://www.electron.build/v26/docs/mac/)。
- Mac 更新采用浏览器下载对应架构的 DMG/ZIP，再退出并替换应用。只发布 Windows 包的版本不会提供 Mac 下载，已有角色资料不受替换影响。

要发行免手动允许打开、支持系统信任的版本，需要在 Mac 上配置 Apple Developer ID 证书与公证凭据，并调整 Mac 配置的签名及公证选项。[electron-builder 官方签名说明](https://www.electron.build/v26/code-signing/)介绍了这条流程。
