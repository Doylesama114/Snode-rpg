# 根目录重构与真值管理方案（v2）

- 日期：2026-11-08（v2 调整：并入顾问 6.0 的产物目录、评审稿归档、npm scripts）
- 状态：待评审（未执行）
- 影响：替换 `文件整理规范.md` v1 中「verify 脚本必须留根目录」「源文件必须留根目录」两条强制条款
- 关联：`docs/plans/2026-11-08-advisor-6.0-merged.md`

## 1. 现状（实测）

| 项 | 数值 |
|---|---|
| 根目录文件 | **158 个 / 62.4 MB** |
| `.mjs` | 51（50 个 `verify_*` + `describe_screenshot`） |
| `.cjs` | 15（角色导入 / 桌面 / 移动顾问回归） |
| `.docx` | 30（30.9 MB，管线比对基准） |
| `.xlsx` | 15（10.1 MB，规则/角色档案） |
| `.md` | 16（855 KB，含 3 份 100 KB+） |
| 顶层目录 | 41 个（8 个「更新内容」+ 10 个杂项/备份） |
| `package.json` | 只有依赖，**没有 scripts**（`node verify_all.mjs` 全靠口口相传） |

引用面（决定迁移风险）：

| 引用关系 | 数量 |
|---|---|
| `scripts/` 中按 `ROOT / "*.docx|xlsx"` 读文件 | **109 个脚本、190 处** |
| `verify_all.mjs` spawn 的根脚本 | **44 处** |
| `.github/workflows/release.yml` 引用的根脚本 | **5 个**（`verify_desktop_*` / `verify_prompt_preferences`） |

## 2. 目标结构

```
/
  AGENTS.md            # ≤4 KB：入口、命令、地图（重写）
  README.md            # 新增：项目地图 + 快速开始
  package.json         # 新增 scripts：verify / verify:advisor / verify:quick
  bump-version.js  changelog.js  index.html  .gitignore
  verify_all.mjs       # 门禁薄壳（内部 → verify/）
  文件整理规范.md        # v2（根保留，强制规范）

  源文件/               # 真值层（唯一权威）
    职业/  规则/  角色档案/  素材/
    更新内容/YYYYMMDD/   8 个『XX更新内容』逐次归档
    manifest.json         sha256 + 来源 + 导入日期 + 版本
    README.md             更新流程（sync_truth 用法）

  verify/              # 50 个 verify_*.mjs + 15 个 *.cjs
  tools/               # check_refs.mjs / sync_truth.py / archive_files.mjs
  scripts/             # 数据管线
  advisor/             # 见 §3.3（新增 source/ rules/ eval/ routes.json）
  docs/
    governance/        文件整理规范、工作规则、ADR
    guides/            后续更新教程、职业页同步手册、设计风格规范
    architecture/      项目文档（拆分后）
    releases/          发布说明（现有）
    plans/             本文件、合并稿、评审稿 reviews/
    archive/           过期 md（旧会话、debug-journal、卡牌进度…）
  斯诺德跑团/ 职业页/ electron-app/ mobile/ poker-game-main/
  snode-combat/ advisor-server/ music/ .github/
```

根目录白名单（v2，共 9 个文件 + 目录）：`AGENTS.md`、`README.md`、`package.json`、`package-lock.json`、`bump-version.js`、`changelog.js`、`index.html`、`verify_all.mjs`、`.gitignore`、`文件整理规范.md`。

## 3. 迁移映射

### 3.1 门禁脚本（65 个）

| 现状 | 目标 | 需要改 |
|---|---|---|
| `verify_*.mjs` × 50 | `verify/` | `verify_all.mjs` 44 处；release.yml 5 处 |
| `verify_*.cjs` × 15 | `verify/` | `verify_all.mjs` 中对应 spawn |
| `describe_screenshot.mjs` | `tools/` | 文档引用 |

`verify_all.mjs` 留根做薄壳：`const V = join(BASE, 'verify');`，对外命令不变（`node verify_all.mjs`），CI 与文档零改动。

### 3.2 真值源（45 个文件，109 脚本 / 190 处引用）——最高风险

三步降风险，**不直接搬**：

1. 新增 `scripts/source_paths.py`：`source_path(name)` 按 `源文件/职业 → 源文件/规则 → 源文件/角色档案 → 根目录` 查找；
2. codemod：`ROOT / "<文件名>"` → `source_path("<文件名>")`（190 处，模式单一），**保留根目录回退**，先不移动文件；
3. 全量门禁绿后，`git mv` 到 `源文件/`，删除回退分支。

验收：`python -X utf8 scripts/verify_panel_data_sync.py` 等全绿 + 门禁 913P 0F。

### 3.3 顾问产物（配合 6.0 方案）

| 目录 | 内容 | 是否入库 |
|---|---|---|
| `advisor/source/lab-20261030/` | 18 个 lab JSON 快照 + `_meta.json` | 入 |
| `advisor/rules/chunks.jsonl` + `facts/` + `index.json` | 规则语料与索引 | 入（约 1–2 MB） |
| `advisor/eval/cases/` | 200 条用例（12 族分层、capability 标签） | 入 |
| `advisor/routes.json` | 12 族路由表 | 入 |
| `advisor/manifest.json` | 每份索引的 sha256 / 条目数 | 入 |
| `advisor/traces/` | 线上 trace JSONL | **不入**（`.gitignore`） |
| `tmp/eval_reports/` | eval 报告（现有） | 不入（已在 gitignore） |

### 3.4 更新内容目录（8 个）

`2026.10.15更新内容/`、`10.22…10.27更新内容/`、`11.04更新内容/` → `源文件/更新内容/YYYYMMDD/`；最新一次同时覆盖为规范名（`源文件/职业/基础职业-战士.docx` 等）并写入 manifest。

### 3.5 杂项与评审稿

| 目录 | 处理 |
|---|---|
| `文档归档/` `发布版文档/` `tmp_rules/` `docx_extracted/` | → `docs/archive/` 或 `备份区/2026-11/` |
| `基础职业技能表/` `牧师子分支/` `角色系统/` | 盘点：仍被引用则迁入 `职业页/` 或 `源文件/`，否则归档 |
| `仅供娱乐，不用同步至git/顾问AI优化方案/` | **不入库**；评审后把 HTML/PDF 转存 `docs/plans/reviews/2026-11-08-advisor-6.0.pdf`（若你同意） |
| `poker-game-main/` `snode-combat/` | 保持子项目原位 |
| `lab/` `deepseek-harness/` `备份区/` `tmp/` `测试型更新/` | 已 gitignore，保持 |

## 4. 真值管理

### 4.1 manifest

```json
{ "generated": "2026-11-08T12:00:00+08:00",
  "items": [
    { "path": "职业/基础职业-战士.docx", "sha256": "…", "bytes": 12345,
      "source": "更新内容/20261104/基础职业-战士.docx",
      "imported_at": "2026-11-04", "app_version": "1.0.8099" }
  ] }
```

### 4.2 更新流程

1. 新素材放 `源文件/更新内容/YYYYMMDD/`；
2. `python tools/sync_truth.py --from 更新内容/20261104` → 覆盖规范名 + 旧文件进 `备份区/2026-11/` + 重写 manifest；
3. 门禁：`verify_source_manifest.py` 断言清单与磁盘一致、无孤儿文件。

### 4.3 新增门禁

| 脚本 | 断言 |
|---|---|
| `verify_source_manifest.py` | manifest 每项存在且 sha256 匹配；`源文件/` 无未登记文件 |
| `verify_advisor_index_fresh.py` | `rules/index.json.sourceVersion == 包版本`；技能索引哈希 == `职业页/数据/*.json` |
| `tools/check_refs.mjs` | 迁移期专用：全仓字符串引用无死链 |

## 5. 文档重写与归档

| 文档 | 现状 | 处理 |
|---|---|---|
| 根 `AGENTS.md` | 2 KB | **重写**：30 秒入口 + 命令 + 地图 + 禁止事项，≤4 KB |
| `斯诺德跑团/AGENTS.md` | 13 KB | 保留项目知识；长期约定迁 `docs/governance/` |
| `项目文档.md` | 164 KB | 拆 `docs/architecture/{frontend,data,release,testing}.md` + 根索引 |
| `后续更新教程.md` | 127 KB | 拆 `docs/guides/release.md` + `docs/archive/release-history.md` |
| `工作规则.md` | 14 KB | 迁 `docs/governance/`，更新发版流程 |
| `文件整理规范.md` | 7 KB | 升 v2（本方案），迁 `docs/governance/`，根留副本 |
| `职业页同步手册.md` 32 KB / `设计风格规范.md` 9 KB | 有效 | 迁 `docs/guides/` |
| `旧会话延续上下文.md` 219 KB | 过期 | `docs/archive/` |
| `通用天赋树.md` 205 KB | 内容数据 | `源文件/规则/` |
| `debug-journal.md` / `卡牌效果实现进度.md` / `关键词系统注意事项.md` | 过期 | `docs/archive/` |
| 4 份历史方案（编排/向导/预览套娃/世界观缺口） | 历史 | `docs/archive/` |

## 6. 执行顺序（每阶段跑门禁）

| 阶段 | 内容 | 风险 | 天 |
|---|---|---|---|
| 0 | 盘点 + `tools/check_refs.mjs` + 生成「文件 → 目标位置」清单（可勾选） | 低 | 0.5 |
| 1 | 文档归档/重写 + `docs/plans/` 归位 + `package.json` scripts | 低 | 1 |
| 2 | `verify/` 迁移（65 脚本 + verify_all + workflow） | 中 | 0.5 |
| 3 | `source_path()` + codemod（190 处，不动文件） | 中 | 1 |
| 4 | 真值迁移 + manifest + 门禁 | 高 | 1 |
| 5 | 更新内容归档 + 杂项分流 + 评审稿转存 | 低 | 0.5 |
| 合计 | | | **4.5 天** |

## 7. 风险与回滚

| 风险 | 对策 |
|---|---|
| 109 脚本路径断链 | 解析器带根回退；每批 codemod 后跑对应 verify_* |
| 门禁移动导致 CI 红 | `verify_all.mjs` 薄壳保证根入口不变；先分支全量跑 |
| 文档拆分丢内容 | 按标题切 + 行数总和校验 |
| 误删 | 一律 `git mv` + 归档 `备份区/`，不 `rm` |
| 顾问产物入库使仓库变大 | 只入 chunks/用例/路由（约 1–2 MB），向量与 trace 不入 |

## 8. 不做什么

- 不合并 `electron-app/` 镜像；
- 不动 `docs/migration`（2451 文件，历史迁移资料）；
- 不动 `lab/`、`deepseek-harness/`、`备份区/`（已 gitignore）；
- 不重命名产品目录（`斯诺德跑团/`、`职业页/`）。

## 附录：第一阶段盘点结果（2026-11-08）

自动清单：[root-move-map.md](root-move-map.md)（158 个根文件 + 47 个目录）

| 分类 | 数量 |
|---|---|
| `verify/` | 65（50 mjs + 15 cjs） |
| 源文件/职业 | 20 |
| 源文件/规则 | 10 |
| 源文件/角色档案 | 9 |
| 源文件/素材 | 6 |
| docs/guides | 3 |
| docs/archive | 8 |
| docs/governance | 1 |
| docs/architecture（拆分） | 1 |
| 根保留 | 10 |
| 待盘点 | 5 个目录 |

待人类拍板的 5 项：`_backup/`（191 个已跟踪文件）、`基础职业技能表/`、`牧师子分支/`、`角色系统/`、`斯诺德全职业技能树_Win7特供版/`。

## 阶段 1 执行记录（2026-11-11）

已用 `git mv` 归档 8 份过期文档到 `docs/archive/`：

```
旧会话延续上下文.md          219 KB（历史会话）
debug-journal.md            10 KB
卡牌效果实现进度.md           35 KB
关键词系统注意事项.md          5 KB
编排提案_战斗规则与冒险规则.md   7 KB
方案_新手向导设计.md           9 KB
修复方案_预览套娃叠加.md       7 KB
缺口清单_世界观.md            3 KB
```

同步更新 `scripts/archive_files.mjs` 的 `KEEP_ROOT_FILES`（移除已迁走的 4 项）。

**暂缓迁移（需要先做引用清扫）**：

| 文档 | 原因 |
|---|---|
| `职业页同步手册.md` | 被 `后续更新教程.md`、`项目文档.md`、`docs/build-advisor-spec.md` 等 15 处按名引用 |
| `设计风格规范.md` | 被 `guild-ui.js/.css`、`common.css` 等 10 处注释按名引用（含 electron 镜像） |
| `后续更新教程.md` | 有 electron-app 镜像，移动需同步改 sync 路径 |
| `项目文档.md` | 164 KB，需先拆分再迁入 `docs/architecture/` |

## 阶段 2 执行记录（2026-11-11）

`verify_*.mjs` / `verify_*.cjs` 共 **64 个**已 `git mv` 到 `verify/`；`verify_all.mjs` 留在根做薄壳。

| 改动 | 数量 |
|---|---|
| `verify_all.mjs` spawn 路径改为 `VERIFY_DIR` | 48 处 |
| `.github/workflows/release.yml` 改为 `node verify/verify_*.cjs` | 8 处 |
| 脚本内 `__dirname` 根路径改为 `path.resolve(__dirname,'..')` | 8 个文件 |
| 脚本内 `import.meta.url` 根路径补 `..` | 2 个文件 |
| 脚本内 `./scripts/...`、`./electron-app/...`、`./斯诺德跑团/...` 改为 `../` | 18 处 |
| `verify_skill_anchor.py` | 留在根（Python，未被移动） |

验收：`node verify_all.mjs` → **Clean 57/57 · Errors 4（既有基线）· Tests 913P 0F**。

顺带修正：`verify_all.mjs` 初次批量替换误把 `verify_all.mjs` 自身与 `verify_skill_anchor.py` 指向 `verify/`，已恢复。

## 阶段 3–4 执行记录（2026-11-11）

### 3a 解析器与 codemod

- 新增 `scripts/source_paths.py`：`source_path(name)` 依次查 `源文件/{职业,规则,角色档案,素材}`，回退根目录；
- codemod 41 个脚本的 `ROOT / "x.docx"` / `os.path.join(ROOT, ...)`；
- 补丁 25 个脚本的 f-string 形式 `ROOT / f"基础职业-{CLASS}.docx"`；
- 修正 21 个文件的 `__future__` 导入顺序；
- 门禁在文件未移动前保持基线（回退生效）。

### 4 真值迁移

| 目录 | 文件数 |
|---|---|
| `源文件/职业/` | 20（18 基础职业 + 已公布进阶 + 进阶途径） |
| `源文件/规则/` | 18（神圣领域 ×6、世界观、专长、天赋树、规则 xlsx 等） |
| `源文件/角色档案/` | 9 |
| `源文件/素材/` | 6（png） |
| 合计 | **53 / 54.9 MB** |

根目录 docx/xlsx/png/rar 归零。

### 迁移后修掉的 5 处路径问题

| 脚本 | 问题 | 修法 |
|---|---|---|
| `scripts/verify_class_weapon_profs.py` | `ROOT.glob('基础职业-*.docx')` | 改为先 glob `源文件/职业`，回退根目录 |
| `scripts/verify_skill_effects_complete.py` | `ROOT/dom['source_file']` | 改 `source_path(...)` |
| `verify_skill_anchor.py` | `Path('基础职业-X.docx')` + 找不到 `source_paths` | 改 `source_path`，并注入 `scripts/` 到 `sys.path` |
| `verify/verify_rules_sync.mjs` | 根目录 xlsx 路径 | 双候选（源文件优先） |
| `scripts/build_creation_flow_data.py` 等 | 裸相对路径 `SRC = 'x.xlsx'` | 改 `source_path` |

### 真值清单

- `源文件/manifest.json`：53 条（sha256/大小/分类/导入日期）；
- `scripts/verify_source_manifest.py`：清单与磁盘一致 + 无孤儿文件，已接入 `verify_all.mjs`；
- 门禁输出：`OK 真值清单一致：53 个文件`。

### 规范升 v2

`文件整理规范.md` 已改为：根目录只放「入口 + 发布链路 + 门禁薄壳 + 强制规范」，真值进 `源文件/`、校验脚本进 `verify/`；新增 §1.1 真值管理（manifest / source_path / 更新流程）。

验收：`node verify_all.mjs` → **Clean 57/57 · Errors 4 · Tests 913P 0F**。

## 阶段 5 执行记录（2026-11-11）

8 个「更新内容」目录迁入 `源文件/更新内容/YYYYMMDD/`：

```
2026.10.15更新内容 → 20261015      10.22内容更新 → 20261022
10.23–10.27更新内容 → 20261023–27  11.04更新内容 → 20261104
```

| 改动 | 说明 |
|---|---|
| `source_paths.py` | 支持 `10.24更新内容/x.docx` 与 `2026.10.15更新内容/x.docx` 两种写法 |
| `sync_help_from_xlsx.py` | `ROOT / '10.25更新内容' / ...` → `source_path(...)` |
| `verify_skill_text_format.py` | 额外 docx（奇械师·炽擎）改走 `source_path` |
| `scripts/build_source_manifest.py` | 新增，可重复生成清单（含 更新内容） |
| `源文件/manifest.json` | 71 个文件 / 57.2 MB（职业 20、规则 18、角色档案 9、素材 6、更新内容 18） |

验收：`node verify_all.mjs` → **Clean 57/57 · Errors 4 · Tests 913P 0F**；真值清单 OK。

## 阶段 6 执行记录（2026-11-16）

### 归档 5 个目录（移出 git，落在 备份区/2026-11/）

| 目录 | 说明 |
|---|---|
| _backup/ | 历史备份，191 个已跟踪文件 |
| 基础职业技能表/ | 重复的 docx 导出；脚本已改用 源文件/职业 |
| 牧师子分支/ | 神圣领域 docx 超集；4 份独有文件已并入 源文件/规则 |
| 角色系统/ | 旧版源码（105 MB） |
| 斯诺德全职业技能树_Win7特供版/ | 旧打包产物 |

### 合并与修正

- 从 牧师子分支 补入 4 份独有领域 docx（季风、幸运女神争锋、战争与谋略、隐秘与变化争锋），源文件/规则 现有 10 份神圣领域；
- source_paths.py 支持 牧师子分支/ 前缀；
- cleric_domain_config.py / fix_description_mark_colors.py 的 DOMAIN_DIR 改为优先 源文件/规则；
- 5 个 apply_skill_desc_sync*.py / gen_skill_desc_expect.py 改读真值 docx；
- 源文件/manifest.json 更新为 75 个文件 / 57.4 MB。

验收：node verify_all.mjs → Clean 57/57 · Errors 4 · Tests 913P 0F；真值清单 OK。

## 阶段 1b 执行记录（2026-11-19）

### 文档拆分

| 原文件 | 去向 | 行数 |
|---|---|---|
| 项目文档.md（164 KB, 2357 行正文） | docs/architecture/01-overview.md | 127 |
| | docs/architecture/02-frontend.md | 353 |
| | docs/architecture/03-features.md | 114 |
| | docs/architecture/04-build-release.md | 160 |
| | docs/archive/dev-history.md | 1603 |
| 后续更新教程.md（127 KB） | docs/guides/release-guide.md（1416 行） | |
| | docs/archive/release-history.md（580 行） | |
| 工作规则.md | docs/governance/work-rules.md | |
| 职业页同步手册.md | docs/guides/职业页同步手册.md | |
| 设计风格规范.md | docs/guides/设计风格规范.md | |

拆分校验：分桶合计 2357 行 == 原文正文 2357 行（零丢失）。

### 根目录文档

| 文件 | 大小 | 说明 |
|---|---|---|
| AGENTS.md | 4 KB | 重写：A 盘符策略 + B 目录地图/命令/约定/文档入口 |
| README.md | 1 KB | 新增：快速开始与目录概览 |
| 文件整理规范.md | 7 KB | v2，文档行改为新路径 |
| 项目文档.md | 1 KB | 索引（导航 + 维护约定） |

根目录 md 从 16 份 / 855 KB 降到 4 份 / 13 KB（正文全在 docs/）。

### 配套

- scripts/archive_files.mjs 的 KEEP_ROOT_FILES 同步为新的根目录白名单；
- docs/architecture、docs/guides 内对旧文件名的引用改为新路径（3 个文件）。

验收：node verify_all.mjs → Clean 57/57 · Errors 4 · Tests 913P 0F。
