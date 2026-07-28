# PROJECT KNOWLEDGE BASE — 斯诺德跑团（角色系统）

**Generated:** 2026-07-29
**Module:** Character creation, sheet rendering, save management, xlsx export
**Version:** v1.0.7132

## OVERVIEW
独立 RPG 角色管理系统。纯前端（HTML+JS+CSS），localStorage 持久化，零外部依赖。14 职业、8 属性、装备槽位、天赋树、技能学习、xlsx 导入导出。

## STRUCTURE
```
斯诺德跑团/
├── 角色面板.html      # 薄壳加载器 (115行) — <link> + <script src> only
├── panel.css           # 全部样式 (290行)
├── panel_data.js       # 全量数据 (~1160行) — REF_CLASSES/REF_RACES/SKILL_DATA...
├── panel_engine.js     # 纯引擎 (~6430行) — 126函数 + xlsx导出 + save/load
├── 导出立绘.js          # OOXML portrait embedding
├── tests.html          # 运行时测试 (46断言) — 加载 data + engine 后跑
├── verify.html         # 验证总控 — 自动检测所有数据定义/函数存在
├── 启动台.html          # 统一入口 (→ 角色系统 / 职业技能 / 帮助)
├── 主页.html            # 角色管理主页 (选择/创建/上传)
├── 角色创建页.html       # 多步骤向导 (种族→职业→属性→装备→导出)
├── 上传角色.html         # xlsx 解析导入 + SKILL_LOOKUP模糊匹配 + 阶位检测
├── 角色选择页.html       # localStorage char_* 扫描列表
├── 角色存档页.html       # 每角色3存档位
└── 帮助.html            # 规则文档 (9章节)
```

## LOAD ORDER (CRITICAL)
```
items_data.js → 导出立绘.js → panel_data.js → panel_engine.js
     ↓              ↓              ↓               ↓
  SKILL_DATA    injectPortrait   REF_* + data    All 126 functions
```
**脚本必须在 `</body>` 之前加载** — `render()` 需要完整 DOM。

## WHERE TO LOOK
| Task | File | Line/Area |
|------|------|-----------|
| HP计算 | panel_engine.js | `function calcTotalHP` (~line 1268) |
| FP计算 | panel_engine.js | `function calcTotalFP` (~line 1311) |
| 装备槽位规则 | panel_engine.js | `function canPlaceInSlot` (~line 2163) |
| 渲染主函数 | panel_engine.js | `function render()` (~line 3745) |
| 技能学习 | panel_engine.js | `function learnSkill()` (~line 5000) |
| xlsx导出 | panel_engine.js | `exportXlsxFromState` (~line 6300) |
| 存档导入导出 | panel_engine.js | `exportAllSaves()` / `importSaves()` (末尾) |
| 职业定义数据 | panel_data.js | `REF_CLASSES = JSON.parse(...)` (line 1) |
| 种族数据 | panel_data.js | `REF_RACES = JSON.parse(...)` (line 1) |
| 升级表 | panel_data.js | `LEVEL_TABLE = {...}` |
| 特殊专长 | panel_data.js | `SPECIAL_FEATS = {...}` |

## CONVENTIONS
- 函数命名: camelCase (`calcTotalHP`, `canPlaceInSlot`)
- 全局变量: `var` (非 const/let)，兼容旧浏览器
- 中文属性名: `state.attrs["力量"]` 等
- 装备容器: `state.containerItems["背包"] = "已解锁"` / `""`
- SP 技能点: 颜色名映射 (`"红色": "#FF0000"`)
- 数据声明: `JSON.parse('...')` 或内联 JS 对象字面量

## GOTCHAS
1. **`calcTotalHP`: con modifier 加了两次** — base + `(ml-1)` 各一次
2. **`calcTotalFP`: `ka` 参数传入但不使用** — 仅用 `kv` 值
3. **背景 `hp_bonus` 是字符串** — `"+1"` 需 `parseInt`
4. **法师技能槽翻倍** — `calcSkillSlots` 对 `level > 1` 的法师 ×2
5. **SKILL_DATA vs JSON 文件结构不同** — JSON: `{id, name, skills:[]}`, SKILL_DATA: `{"职业名": [...]}`
6. **`render()` 中 7 个嵌套函数已提升** — `getArmorAC`, `getItemWeight`, `parseWeight`, `resolveWeight`, `isTierUnlocked`, `getTierUnlockCost`, `getTierMinLevel` 均为模块顶层

## ANTI-PATTERNS
- ❌ 不要把脚本放在 `<head>` — DOM 未就绪时 `render()` 会 crash
- ❌ 不要用 PowerShell 操作文件内容 — UTF-8 中文会被破坏
- ❌ 不要用 AI Agent 的 `edit` 工具操作超大单行 — JSON.parse 内容可能损坏
- ❌ 不要改 `state` 对象的初始化顺序 — 依赖链不确定

## TESTS
```
node verify_all.mjs    # Playwright 全量验证 (40页面 + 46断言)
node verify.mjs        # HTTP 版快速验证
浏览器打开 tests.html   # 手动跑测试
```

## GIT
```
05bd932  v1.0.542: 修复NSIS静默安装(/S处理) + GitHub Pages部署(action方式)
15ceed2  v1.0.541: 修复静默安装 quitAndInstall(true)
323e431  v1.0.540: 修复更新日志同步 + GitHub Pages部署
ee5d862  v1.0.539: 安装可选目录 + 更新静默 + Cloudflare Pages镜像
b0d148d  第四波：Playwright验证环境
f37e670  第三波：数据提取 + 核心测试
5c7d15e  第二波：拆分为4文件 + 导入导出
6fbb889  初始提交
```
