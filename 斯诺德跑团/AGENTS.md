本轮更新 v1.0.8048 2026-10-09

最新技能树已同步到网页、角色面板和顾问索引；旧技能ID保留。骑士牧、幸运牧及奇械师沿用原版。法师变化五阶9条完整程序规则不以占位原文覆盖。新增能力详见 docs/releases/v1.0.8048.md。

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
items_data.js → 导出立绘.js → panel_data.js → skill_index.js → character_import_schema.js → character_structure.js → character_class_data.js → character_classes.js → character_stats.js → character_workbook_cache.js → character_io.js → character_layout.js → character_fields.js → character_export.js → character_review_ui.js → character_import_ui.js → panel_engine.js
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
- character_io.js 统一解码 OOXML、识别角色表、读写 _SNODE_META v3，兼容 v1/v2。
- 导入顺序：原始单元格 → 本文件元数据关联 → 当前技能索引 → 默认值；禁止恢复 _LAST_META_ROWS 全局暂存。
- src/cls 为职业来源，via/grantedBy 为获取途径，place/sub 为栏位，free 与 occupies 独立；占栏判定优先 occupies。
- 天赋 tier 来自同列 O/R 的物理阶位标题，catalogTier 来自当前数据；不得恢复旧 SKILL_TIER/SKILL_LOOKUP 单名表。
- 详情与转换按 UID 定位条目，以来源 + 技能 ID 读取规则；同名未确认只展示原文与补选入口。
- 修改根目录角色脚本后同步 electron-app；更新技能数据后运行 python -X utf8 scripts/gen_skill_index.py。
- 回归：node verify_character_import_roundtrip.cjs；桌面/浮层：node verify_character_import_roundtrip.cjs --electron；全量：node verify_all.mjs。


## 上传页区块识别维护 2026-10-02

- 上传页在 character_io.js 后加载 character_layout.js；该模块只按区块标题、列标题和合并单元格结构识别技能与天赋。
- 不得恢复从正文 substring 命中技能列表标题、固定 B/K/O/R 列扫技能或依照技能数据库白名单丢弃自定义能力。
- 技能列由表头决定，天赋阶位来自同一区域标题；行列移动、空行和两字母列引用须保持兼容。
- 无法识别声明的技能区时必须显示问题并阻止静默保存不完整角色。其他字段仍需按需求逐步结构化。
- OOXML _xHHHH_ 文本转义只在解码入口处理一次，保留转义后的字面文本。
- 回归：node verify_character_import_roundtrip.cjs --electron --fixture <真实档案路径>；不将个人角色附件写进仓库。

## 异形表与额外能力维护 2026-10-02
- character_io.js 写出 _SNODE_META v3，读取兼容 v1/v2；元数据覆盖技能、天赋、配方、确认状态及排除/未分类记录。
- resolution=custom 禁止自动绑定同名目录；deferred 决定只对同一名称、来源、阶位指纹有效。
- free 和 occupies 可为 null；面板须显示待确认数。确认编辑不调用学习、扣点或奖励函数。
- 原始文本和 provenance.fields 保留字段位置；名称归一化只用于匹配，不直接改写玩家名称。
- 带槽位数量的标题仍是区块边界；配方按区域分类，不凭单一后缀移动。
- 手动映射须预览并确认；个人方案只保存结构，结构变化后重新核对。多个同等角色表须明确选择。
- 导出保护实际能力区；额外能力可见写出，未标阶位天赋不强行归入一阶。
- 门禁：node verify_character_unusual_import.cjs [--fixture <个人文件路径>]；全量已集成。个人角色文件不得提交。


## 技能完整详情维护 2026 10 02

- panel_data.js 从职业 JSON 与牧师领域 JSON 一起生成，不得在文件后追加旧的领域数组覆盖新产物。
- 已学天赋保留玩家 UID、来源、规范技能 ID 和完整规则。天赋格子与效果列表点击按 UID 定位，不能只按名称取第一项。
- 学习详情、已学天赋、技能详情及战斗抽屉使用 formatSkillDetailHtml 展示完整正文、升级、选项、随机表和单位数据；自定义及待确认能力仍显示玩家原文。
- 单位结构化不完整时保留 lines 中尚未展示的内容。不得为了去重把无替代展示的原始数据隐藏。
- 战舞者规范 ID 使用 zw 前缀，旧 wd ID 通过 legacy_ids 和索引 aliases 兼容；别名可以扩充 byKey，但不能增添重复技能条目或修改玩家 UID。
- 重建面板必须尊重职业 JSON 的既有阶位；导航阶位只用于缺失字段补全。
- 全量门禁已纳入独立的效果完整性与实际详情检查；另执行 node verify_skill_effects_e2e.cjs --electron 验证桌面壳。

## 完整角色字段与进阶职业维护 2026-10-03
- character_fields.js 读取实际字段布局；数值分 missing/valid/invalid/uncached，0 是有效值，禁止恢复生命疲劳小于 50 的过滤。
- character_stats.js 统一计算与读取，校验不改角色。导入填写值 fixed 与 rules 明确区分；当前生命/疲劳独立，未知规则不得用默认职业或 0 代替。
- character_classes.js 保留显示名/等级；进阶规则基础须确认，同名主副栏的含义须确认。确认不能调用升级、学习、扣点或奖励。
- variant 保留玩家名称与参数，baseDefinition 只指定参考规则；附赠 ownerClassIndex=2 不自动计入主职业槽位。
- 只导入明确的已学战术；装备能力保留 requiresEquipment。参考、敌人、发展方向留在 supportingSheets，散列名单须逐条确认。
- 跨列文字仅存 mergedNotes；确认后才拆该合并，不能作为施展时间/距离广播。未知消耗禁止 parseFloat 截断后自动扣除。
- 两个导出入口调用 character_export.js；原工作簿缓存保存完再跳转。缓存丢失回退需保留可移植参考表与补充区，不声称保住原图像/格式。
- characterState 仍放 _SNODE_META v3，使用 schemaVersion=1 对象；可见修改/清空优先，不能因隐藏 JSON 而复活删除条目。
- 门禁：node verify_character_integrity_import.cjs [--electron] [--fixture <个人路径>]，以及既有两套角色回归和 verify_all.mjs。个人原件只读，不进入仓库。

## 通用上传边界维护 2026-10-03
- 结构识别由 character_import_schema.js / character_structure.js 提供词汇、主体、区块、候选与证据。禁止以正文包含关键词、文件名、C4/B17打分选择角色表。
- 标签和值读取须遵守主体与区块；空字段不得跨入下一标签，同名多候选须待确认。不能把关键属性值“智力”当成智力标签。
- 天赋/技能读取范围与游戏容量独立，超出容量完整保留并提示。补充列表名称不得成为新的结构分支；规则关联放数据中。
- buildStateLegacyTemplate 只对完整匹配的标准模板启用；结构化导入不依赖旧坐标填值，不补属性10。
- 转置表 orientation=columns 使用 fieldRows / recordColumns，读取与写回保持方向。
- importFieldBindings 需有确认与标签/区块/主体证据；改变依据须重新确认。角色范围变化不带入另一个主体的确认和身份。
- importCoverage 记录每个非空单元格去向；importUnreviewed 保留未读内容，缓存缺失时仍需可见保存原文。原始缓存完整不等于已识别完整。
- 装备 activation 分 always/unknown/owned/equipped；一次消耗独立于原规则，不能将X永久改成某一次数字。
- 门禁 node verify_character_general_import.cjs [--electron]；180开发变换不能称盲测，留出布局及真实文件独立报告。个人附件只读、不提交。
