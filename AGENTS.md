# AGENTS.md — 工作区与项目约定

> 对本工作区内所有 AI 代理（DSH / Claude Code / Cursor / Codex 等）强制生效。
> 分两部分：A. 盘符与临时文件（工作区级）；B. 项目结构与命令（仓库级）。
> 文件落位见 [文件整理规范.md](文件整理规范.md)；重构背景见 [docs/plans/2026-11-08-root-reorg.md](docs/plans/2026-11-08-root-reorg.md)。

---

## A. 盘符与临时文件（工作区级）

### A0. 最高优先级：C 盘只读不写

禁止在 C 盘（C:\ 开头）创建、写入、追加任何文件或目录。完整规范见 D:/AI-FILE-POLICY.md。

### A1. 路径真值表

| 用途 | 唯一允许位置 | 环境变量 |
| --- | --- | --- |
| 进程临时目录 | D:/dsh-temp | TMP / TEMP |
| DSH 主目录（会话/附件） | D:/dsh-home | DSH_HOME |
| 包管理器缓存 | D:/dsh-cache/<tool> | npm_config_cache / PNPM_HOME / PIP_CACHE_DIR |
| 本工作区 | D:/Download/scholar-agent-main | — |
| 临时脚本与产物 | 本工作区 _scratch/（不入库） | — |

### A2. 行为规则

1. 临时目录一律用环境变量或 os.tmpdir()/tempfile，禁止硬编码用户目录；
2. 新建缓存、日志、构建产物目录时，根路径必须来自环境变量或配置；
3. 脚本中禁止字面量 C 盘路径（读取系统依赖除外）；
4. 工具默认写 C 盘时先改环境变量，改不动才改源码并在提交信息里说明；
5. 任务收尾清理自己产生的临时文件。

### A3. 自检

    pwsh -File D:/dsh-tools/check-c-writes.ps1

退出码 0 = 通过。

---

## B. 项目结构与命令（斯诺德跑团）

### B1. 目录地图

| 目录 | 职责 | 备注 |
| --- | --- | --- |
| 源文件/ | 真值：docx / xlsx / png（职业、规则、角色档案、素材、更新内容） | 唯一权威，带 manifest.json（sha256） |
| scripts/ | 数据管线与校验（Python / mjs） | 读真值统一用 source_path() |
| verify/ | 64 个校验脚本（verify_*.mjs / *.cjs） | 由根目录 verify_all.mjs 调度 |
| 斯诺德跑团/ | 前端站点（零构建） | 改后同步 electron-app/斯诺德跑团/ |
| 职业页/ | 职业技能树子站 | 同上同步 |
| electron-app/ | 桌面壳（镜像目录） | 勿直接改，改根目录再同步 |
| advisor/ + advisor-server/ | AI 顾问知识库与 FC 服务 | 规则语料在 advisor/rules/ |
| docs/ | 文档：architecture / guides / governance / archive / plans / releases | 根目录不再堆文档 |
| 备份区/ _scratch/ tmp/ lab/ | 本地归档 / 临时 / 实测（gitignore） | 不入库 |

### B2. 常用命令

    # 全量门禁（必须绿：Clean 57/57 · Errors 4 基线 · Tests 913P 0F）
    node verify_all.mjs

    # 真值清单（改过 源文件/ 后必跑）
    python -X utf8 scripts/build_source_manifest.py
    python -X utf8 scripts/verify_source_manifest.py

    # 顾问规则语料（改过 help.html 后）
    python -X utf8 scripts/build_advisor_rules_from_help.py
    node scripts/advisor-rules-baseline.mjs

    # 发版
    node bump-version.js 版本号 "说明"

### B3. 关键约定

1. 真值只改 源文件/：根目录不得再出现 docx/xlsx/png；脚本用 from source_paths import source_path 读取；
2. 校验脚本放 verify/：新增校验写进 verify/，并在 verify_all.mjs 注册；
3. 根目录只放：AGENTS.md、README.md、文件整理规范.md、项目文档.md（索引）、发布链路（bump-version.js / changelog.js / package*.json / index.html）、门禁入口 verify_all.mjs；
4. 文档不往根目录堆：架构进 docs/architecture/，指南进 docs/guides/，规则进 docs/governance/，过期进 docs/archive/；
5. 镜像同步：改 斯诺德跑团/ 或 职业页/ 后同步 electron-app/ 对应目录（node electron-app/sync-check.js 校验）；
6. 禁改超大单行文件（panel_data.js 等）：用脚本改；中文文件禁止用 PowerShell 直接改内容。

### B4. 文档入口

| 想知道 | 看 |
| --- | --- |
| 项目概览 / 数据源 / 前端结构 | docs/architecture/ |
| 发布流程 | docs/guides/release-guide.md |
| 职业页同步 | docs/guides/职业页同步手册.md |
| 设计规范 | docs/guides/设计风格规范.md |
| 工作规则 / 文件落位 | docs/governance/work-rules.md / 文件整理规范.md |
| 历史与归档 | docs/archive/ |
