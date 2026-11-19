# 构建、部署与发布

> 文件清单、CI/CD、版本发布流程。
> 来源：项目文档.md（拆分于 2026-11-19）

## 13. 文件清单

### 13.1 角色系统（斯诺德跑团/）

| 文件 | 说明 |
|------|------|
| 角色面板.html | 核心角色卡（~2.3MB），含导出引擎，含全部前端逻辑和数据 |
| 角色创建页.html | 创建角色向导，含导出引擎 |
| 上传角色.html | xlsx 角色卡上传/导入，含自动纠错、阶位检测、导出引擎 |
| 角色选择页.html | 角色存档列表 |
| 角色存档页.html | 存档管理 |
| 主页.html | 主页 |
| 启动台.html | 统一入口 |
| 帮助.html | 规则帮助文档 |
| 警告.jpeg | 上传违规警告图片
| 导出立绘.js | OOXML 立绘导出模块（独立 JS） |

### 13.2 职业技能浏览（职业页/）

| 文件 | 说明 |
|------|------|
| 首页.html | 职业选择主页 |
| {职业名}.html | 15 个职业技能详情页 |
| {职业名}·进阶.html | 15 个职业进阶详情页 |
| 通用天赋树.html | 通用天赋树页面 |
| 数据/ | JSON 数据（classes.json, races.json, backgrounds.json, 各职业技能） |
| common.css / common.js / filter.js | 公共资源 |

### 13.3 工具与数据

| 文件 | 说明 |
|------|------|
| build_skill_lookup.js | SKILL_LOOKUP / SKILL_TIER 重建工具 |
| 冒险者角色档案.xlsx | 角色上传模板 |
| 斯诺德物资大全.xlsx | 装备/物品数据 |

### 13.4 打包与发布

| 目录/文件 | 说明 |
|------|------|
| electron-app/ | Electron 桌面版打包项目（含 poker-game 镜像） |
| poker-game-main/ | 斯诺德对决 Vue 源码 |
| 发布版文档/ | 正式发布版本 |
| 斯诺德跑团_v1.044.exe | 最新桌面版（63.6MB） |
| 斯诺德跑团_v1.044.zip | 最新离线版（587KB） |
| 备份区/ | 历史备份，带时间戳 |

> ⚠️ **注意**：`electron-app\职业页\` 是独立副本，修改 `职业页\` 后必须同步到该目录，或直接在 `electron-app\职业页\` 中编辑。

（自 WORKFLOW_SUMMARY.md 合并）

---

## 15. CI/CD 与自动化部署

### 15.1 GitHub Actions 工作流

| 工作流 | 触发条件 | 功能 |
|--------|---------|------|
| `deploy.yml` | push master | 部署到 GitHub Pages（`doylesama114.github.io/Snode-rpg/`） |
| `release.yml` | tag `v*` | 构建 NSIS 安装器 + Android APK → 发布 GitHub Release → 同步阿里云 OSS 镜像（exe/APK/移动资源包） |

### 15.2 自动更新

桌面版内置 `electron-updater`：

- 用户点击「检查更新」→ 先走 GitHub；**失败则自动切换国内镜像**（检查 → 下载 → 重启，全程无需再点按钮）
- 「镜像更新」按钮 → 直接 OSS 优先，同样全自动下载安装
- 每次启动后 3 秒自动执行上述「检查更新 + 自动镜像回退」流程（已去除每 4 小时的定时检查）

**OSS 发版同步**（`.github/workflows/release.yml` → `mirror-oss`）：

- `releases/<tag>/`：exe · latest.yml · blockmap
- `releases/latest/latest.json`：Web 查版本 + 镜像直链
- `releases/latest/latest.yml`：electron-updater generic feed

**OSS 跨域（CORS，可选）**：仅当 **网页版启动台** 在浏览器里直接 `fetch` OSS 的 `latest.json` 时才需要（Bucket → **数据管理** → **跨域设置**，不在「权限管理」里）。若网页继续走 Cloudflare Pages 等现有镜像、**桌面版**用「镜像下载」走 Electron 主进程，则 **不必配置 CORS**。

GitHub Actions Variables：`ALIYUN_OSS_BUCKET` · `ALIYUN_OSS_ENDPOINT` · **`ALIYUN_OSS_PUBLIC_BASE_URL`（须含 `https://` 前缀）**；Secrets：`ALIYUN_OSS_ACCESS_KEY_ID` · `ALIYUN_OSS_ACCESS_KEY_SECRET`。

### 15.3 Cloudflare Pages 国内镜像

- 从 GitHub 仓库自动同步部署
- 域名：`https://snode-rpg.pages.dev`
- 国内用户访问不上 GitHub Pages 时可用此镜像站
- 根目录 `index.html` 自动跳转到 `斯诺德跑团/启动台.html`

### 15.4 Bug 反馈

- 所有页面右下角 🐛 按钮
- Electron 版：IPC → main 进程发 `ntfy.sh` 推送
- 浏览器版：XMLHttpRequest 发 `ntfy.sh`
- 用户手机装 ntfy app 订阅 `snowd-bug-report` 频道即时收到

### 15.5 测试

```bash
node verify_all.mjs    # Playwright 验证 40 页面 + 46 断言
node bump-version.js 1.0.xxx "改动内容"  # 一键版本号 + changelog
```

---
### 15.6 Android 手机版（APK 壳 + OSS 资源包自动更新）

**架构**（无需备案域名：资源全部打包到手机本地，更新走文件下载）：

- `mobile/`：原生 Android 壳（Kotlin + WebView，小 APK 约 5 MB）
- APK 内不包含网页资源；启动时从 OSS `mobile/version.json` 检查版本，下载 core/poker 资源包、校验 SHA-256 后解压到本地加载（断网时使用旧版）
- 每次发版 = 上传新资源包 + 更新 version.json；用户打开 APP 自动更新，**无需重装 APK**、无审核
- 页面导出 xlsx：WebView 中通过 `window.mobileBridge.saveFile` 保存到手机下载目录（panel_engine.js 已适配）

**OSS 产物**（`oss://snode-rpg-releases/mobile/`）：

- `version.json`：当前版本清单（core/poker 的 url + sha256 + size）
- `packages/<version>/core-<version>.zip`（index + 斯诺德跑团 + 职业页，约 8 MB）
- `packages/<version>/poker-<version>.zip`（poker-game，ogg 音乐转码后约 5 MB）
- `apk/Snode-RPG-<version>.apk`：安装包下载链接

**发版**：`release.yml` 的 `build-android` job （ubuntu）自动构建：打包资源包 → 签名 APK → 上传 OSS。GitHub Secrets 需：`MOBILE_KEYSTORE_B64` · `MOBILE_KEYSTORE_PASS` · `MOBILE_KEY_ALIAS` · `MOBILE_KEY_PASS`（一次性生成：`Generate Android Keystore (one-time)` workflow）。

**音频**：卡牌背景音乐已从 wav（69.8 MB）转为 ogg（4.6 MB），`assets/index-*.js` 引用 `.ogg`。

---


## 16. 版本发布流程

> **职业页 / docx 内容更新**请先读 `docs/guides/release-guide.md` **§1.5**（写站 → 验证 → bump），不要跳过验证直接打 tag。

```bash
# 0. 内容已写入 职业页/ 并完成验证（verify_bard_sync / verify_all / 手测）
# 1. 更新版本号 + changelog（会自动同步 changelog.js 到 斯诺德跑团/ 和 electron-app/）
node bump-version.js 1.0.7114 "改动1;改动2"

# 2. 同步 MD 头部版本（docs/guides/release-guide.md、项目文档.md、electron-app 副本）
# 3. 提交 + 打 tag + 推送
git add -A && git commit -m "v1.0.7114: 改动描述"
git tag v1.0.7114 && git push origin master --tags

# 4. 等 GitHub Actions 跑完 → Release 自动发布 → 用户可在启动台点击"检查更新"
```

### 16.1 从 docx 发现新技能到上线（摘要）

```bash
python scripts/extract_class_docx.py --class 吟游诗人
python scripts/diff_class_extract.py --class 吟游诗人 --tier 五阶
python scripts/apply_class_extract.py --class 吟游诗人 --tier 五阶   # 硬门禁
python scripts/verify_bard_sync.py
node verify_all.mjs
# 手测通过后再 bump（§16）
```

详情：`docs/guides/职业页同步手册.md` §四点五 / §四点六。

---


---
