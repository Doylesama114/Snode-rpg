# PROJECT KNOWLEDGE BASE — 斯诺德跑团（角色系统）

**版本：v1.0.8024** ｜ 部分内容已于本轮更新（世界观 46 章 / 80 目录跳转点 / 移动端向导修复）

## OVERVIEW
纯前端（HTML + JS + CSS）TRPG 工具集，**零构建步骤**，localStorage 持久化；Electron 桌面壳 + Android WebView 移动端；同时部署在 GitHub Pages 与阿里云 OSS 镜像。
核心模块：**角色系统**（建卡 / 面板 / 存档 / xlsx 导入导出）、**职业技能树**（20 基础职业 + 19 条进阶途径）、**帮助**（规则手册 + 世界观架构）、**斯诺德对决**（卡牌对战，独立子站）。

## STRUCTURE（关键文件）
```
斯诺德跑团/
  启动台.html            统一入口（卡片由 JS 生成）
  主页.html              角色管理薄壳（选择 / 创建 / 上传）
  角色创建页.html         7 步建卡向导（职业 → 起始特性 → 种族 → 属性 → 熟练项 → 背景 → 装备）
  角色选择页.html / 角色存档页.html
  角色面板.html           薄壳：panel.css + 数据与引擎
  help.html              规则手册 + 世界观架构（世界观 46 章，含 4 张地图）
  设置.html / 资料库.html / 物资大全.html
  panel_data.js          数据（REF_CLASSES / REF_RACES / SKILL_DATA / REF_SUBCLASS_REQS…）
  panel_engine.js        引擎（126+ 函数、xlsx 导出、存档读写）
  导出立绘.js             OOXML 立绘嵌入
  guild-ui.js/.css        ★ 全站共享 UI 层（导航 / 皮肤 / 返回键 / 表格居中 / FAB 避让）
  onboard.js + onboard_steps.js   ★ 新手向导引擎与步骤文案
  world-toc.js            ★ 帮助页世界观两级目录（运行时按内容生成）
  ui_dialog.js / snd.js / shortcuts.js / bug-report.js
职业页/                   职业技能树子站（common.js / filter-panel.js / filter.js / common_tooltip.js）
advisor/                  AI 顾问知识库（chargen / skills / combos / lore / entities）
scripts/                  数据构建与校验脚本（verify_*.py / build-*.mjs）
electron-app/             桌面壳（★ 是镜像：改根目录后同步，勿直接改）
```

## LOAD ORDER（CRITICAL）
```
items_data.js → 导出立绘.js → panel_data.js → skill_index.js → character_io.js → character_import_ui.js → panel_engine.js
```
脚本必须放在 </body> 之前（render() 需要完整 DOM）；共享层 guild-ui.js 最后注入。
⚠ 校验脚本（verify_panel_data_sync.py 等）用**裸 JS 上下文**解析 panel_data.js：文件顶层不得直接调用浏览器 API（setTimeout / document），必须加 typeof 守卫。

## 关键机制
| 机制 | 位置 | 说明 |
| --- | --- | --- |
| 面板切换互斥 | help.html setView() | #help-pane-rules / #help-pane-world，隐藏用 .help-pane-hidden |
| 世界观插图按需加载 | help.html 注入脚本 | 191 张 JPEG 用 data-src + 透明占位，切到世界观时 __worldImgHydrate() 注入（首屏 24.6MB → 189KB） |
| 世界观两级目录 | world-toc.js | 只追加不覆盖原目录（保住朗读等控件）；标签剔除「朗读」文字但保留元素节点 |
| 新手向导 | onboard.js | 启动台 5 步 / 建卡 3 步 / 空状态 1 步；遮罩 pointer-events:none（不挡按钮）；气泡按真实矩形夹取到视口内；三级存储降级；看过后不再弹（设置页可重看） |
| 表格居中规范 | guild-ui.css | .wrap table + 全站 body.gui-page th/td 水平与垂直居中；.tl 豁免 |
| 职业页懒渲染 | 职业页/*.html | 技能详情放在 template.skill-body；filter-panel.js 的 scanPage() 首屏遍历全部卡片（性能热点） |

## CONVENTIONS
- 零构建：直接改 HTML/JS/CSS，版本号以 ?v= 做缓存失效
- 全局变量用 var；函数 camelCase；中文属性名 state.attrs["力量"]
- **禁改超大单行文件**（panel_data.js 等）——用脚本改；**禁 PowerShell 改中文文件内容**（会破坏编码）
- electron-app/ 与根目录同名文件必须同步
- 发版：node bump-version.js <版本> "<a;b;c>" → node verify_all.mjs → tag → CI → OSS/移动端核验

## TESTS / 验证
```
node verify_all.mjs                              # 全量门禁（63 页面/脚本 + 890 断言）
node verify_perf.mjs                             # 性能基线（DCL/体积/资源/DOM）
node verify_table_center.mjs / verify_rules_layout.mjs / verify_mobile_help.mjs
python -X utf8 scripts/verify_panel_data_sync.py # 三数据源一致性
python -X utf8 scripts/verify_strategist_sync.py # 谋士/职业数据同步
```
浮层类改动（向导 / 弹窗）必须同时跑 360 / 390 / 1440 三视口 + Electron 真机。

## GOTCHAS
1. Electron 下 location.href 会被主进程拦截 → 导航用**点击**；取文件名用 decodeURIComponent(location.pathname.split("/").pop())
2. 帮助页 help-pane-hidden 依赖 CSS 类，**类未定义等于没隐藏**（曾出过 bug）
3. 职业页 filter-panel.js 首屏 scanPage() 遍历全部技能卡 → 法师页约 1s 长任务（延迟该调用会让筛选面板暂时为空，需谨慎）
4. 拆大文件必须**枚举每个全局量的精确边界**：曾误把 SKILL_DATA 移出 panel_data.js → 触发 27 项门禁错误
5. 发版流水线「Upload mobile packages and APK」「Sync release assets to Aliyun OSS」失败时，**先查阿里云 OSS 账号是否欠费 / 密钥是否有效**（曾因欠费导致 8020–8022 三版镜像失败）
6. OSS 上的 latest.yml / mobile/version.json 由 mirror-oss job 维护：该 job 失败 → **App 自动更新会停在旧版本**

## 发布产物（发布后必核五项）
① Release exe ② Release APK ③ latest.yml 的 size 与 exe 精确一致 ④ OSS exe HTTP 200 ⑤ 移动端 mobile/version.json = 新版本


## 角色工作簿导入维护（2026-10-01）
- character_io.js 统一解码 OOXML、识别角色表、读写 _SNODE_META v2，兼容 v1。
- 导入顺序：原始单元格 → 本文件元数据关联 → 当前技能索引 → 默认值；禁止恢复 _LAST_META_ROWS 全局暂存。
- src/cls 为职业来源，via/grantedBy 为获取途径，place/sub 为栏位，free 与 occupies 独立；占栏判定优先 occupies。
- 天赋 tier 来自同列 O/R 的物理阶位标题，catalogTier 来自当前数据；不得恢复旧 SKILL_TIER/SKILL_LOOKUP 单名表。
- 详情与转换按 UID 定位条目，以来源 + 技能 ID 读取规则；同名未确认只展示原文与补选入口。
- 修改根目录角色脚本后同步 electron-app；更新技能数据后运行 python -X utf8 scripts/gen_skill_index.py。
- 回归：node verify_character_import_roundtrip.cjs；桌面/浮层：node verify_character_import_roundtrip.cjs --electron；全量：node verify_all.mjs。
