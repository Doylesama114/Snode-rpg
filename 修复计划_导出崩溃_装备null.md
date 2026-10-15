# 修复计划 · 导入的角色卡导出时崩溃：`Cannot read properties of null (reading 'items')`

> **只做计划，未改任何文件。** 崩溃点已定位到具体行；null 的**产生源头**列为第 0 步先确认（有 3 个候选）。

## 一、现象与定性

| 项 | 内容 |
| --- | --- |
| 报错 | `导出失败: Cannot read properties of null (reading 'items')` |
| 触发 | **导出**（不是导入）· 用的是**他自己导入的角色卡** |
| 性质 | **数据里混入了 `null` 条目** ✗ + **导出代码对其无防护** ✗ → 一条坏数据让**整张卡导出失败** ✗ |
| 影响 | 用户**无法导出**该角色；面板/其他功能可能正常（那是读路径另有防护 ✓） |

## 二、崩溃点（已精确定位到行）

| # | 文件:行 | 代码 | 说明 |
| --- | --- | --- | --- |
| **1** | `斯诺德跑团/character_export.js:28` | `(state.equipment[group.slot]\|\|[]).reduce(function(out,e){ return e.items ? … })` | **首崩点** ✓：`e === null` → `e.items` 抛错 ✓✓ |
| 2 | `斯诺德跑团/character_export.js:33` | `(state.equipment[slot]\|\|[]).forEach(function(e,i){ if(!e.items && …` | 同型无防护 ✗（崩在 1 之后就会轮到它 ✓） |
| 3 | `斯诺德跑团/character_io.js:580` | `payload.equipment[slot].forEach(function(e){ if(e.items) …` | 读元数据/合并时同型 ✗ |
| 4 | `斯诺德跑团/character_io.js:581` | `state.equipment[slot].forEach(function(e){ var list=e.items\|\|[e]; …` | 同型 ✗ |

> 其他 `.items` 访问点（`panel_engine.js:2760/2895/2943/4643/5198/5368`、`角色面板.html` 多处）**都有 `|| []` / `|| {}` 防护** ✓，所以只有**导出链路**会整卡失败 ✓ —— 与"只有导出报错"的现象一致 ✓✓。

## 三、null 从哪来（第 0 步必须先确认）

### 三个候选源头（按可能性排序）

| # | 候选 | 依据 | 如何确认 |
| --- | --- | --- | --- |
| **A** | **卡片的隐藏元数据里就带着 `null`** | `_SNODE_META` 会存 `state`（装备数组等）；若历史导出把空位写成 `null`，再导入即原样带回 | 取该卡 xlsx → 解 `_SNODE_META` → 看 `equipment.*` 数组元素是否有 `null` |
| **B** | **导入解析时把空行/空单元格推成了 `null`** | `character_fields.js:92` 会 `push({…})`；空槽位处理若有分支漏了跳过，就会留下 `null`/`undefined` | 用该卡跑一次导入 → 直接 `JSON.stringify(state.equipment)` 看元素 |
| **C** | **面板编辑/材料包操作留下空洞** | `panel_engine.js:4643` 重建材料包时会 `push({type, items})`；增删条目时可能出现空位 | 面板里增删一次装备 → 再导出，看是否复现 |

> 注意区分 ✗：`undefined`（稀疏数组）报的是 "reading 'items' **of undefined**" ✗，而用户看到的是 **of null** ✓ → 说明是**显式的 `null`** ✓ → 更偏向 **A / B** ✓。

## 四、修复方案（三层，缺一不可）

### 第 1 层 · 导出侧：**不再因一条坏数据整卡失败**（必须 ✓）

- 在 `character_export.js` 第 28/33 行与 `character_io.js` 580/581 行的循环内，**先做条目归一化**：
  ```js
  function normEquipEntry(e){ return (e && typeof e === "object") ? e : null; }   // 统一过滤
  ```
  → 对 `null` / `undefined` / 非对象（字符串、数字）**跳过但计数** ✓
- **不得静默丢弃** ✓：把被跳过的条目计入 `state._exportSkipped`（或返回诊断列表 ✓），导出完成后用 toast 明确告知：
  > 「导出成功；已跳过 N 条无效装备条目（槽位：主手/材料包…）」
- 同时给 `e.uid`、`e.name`、`e.item` 等**后续访问**统一走同一归一化结果 ✓（避免修了 `.items` 又在下一行崩 ✗）。

### 第 2 层 · 导入侧：**堵住 null 产生点**（根因 ✓）

- 按第 0 步结论定位后，在产生处**改为不 push**（空槽位跳过 ✓）或 push **合法默认对象** ✓；
- `character_io.js` 读取/合并元数据时，对 `payload.equipment` 与 `state.equipment` 的每个数组**做一次清洗** ✓：
  ```js
  arr = (arr || []).filter(normEquipEntry);   // 载入即自愈
  ```
- **载入时清洗**同时覆盖**老存档 / localStorage / 老卡片** ✓ —— 用户不必重新导入就能恢复导出 ✓✓（对他最重要 ✓）。

### 第 3 层 · 报错可读化（体验 ✓）

- 现在抛的是**原始 TypeError** ✗（`panel_engine.js:8052` 直接把它 toast 出去 ✗）→ 改为：
  - 捕获后**归类**：数据类错误 → 「角色数据中有 N 处异常，已跳过；如需完整体检请用『数据自检』」✓
  - **附上下文**：出错槽位、条目索引、条目类型（便于用户回报 ✓）；
  - `console.error` 保留**完整堆栈** ✓（便于后续排查 ✓）。

## 五、验证方案

| # | 用例 | 期望 |
| --- | --- | --- |
| 1 | **用用户那张卡**（导入 → 导出） | 导出成功 ✓ 或给出「跳过 N 条」的明确提示 ✓ **不再抛 TypeError** ✓ |
| 2 | 构造 `equipment.主手 = [null, {…}]` | 导出成功 ✓ 合法条目完整写出 ✓ 坏条目被跳过且计数 ✓ |
| 3 | 构造 `[undefined]`（稀疏 ✓）/ `["字符串"]` / `[42]` | 同上，均不崩溃 ✓ |
| 4 | 材料包 `[null]` / `{items:null}` | 同上 ✓（材料包走 `panel_engine.js` 路径 ✓） |
| 5 | **导入 → 导出 → 再导入**（往返 ✓） | 合法条目逐条保真 ✓ UID/来源/字段不丢 ✓ |
| 6 | **老存档自愈**：localStorage 里放一份含 null 的 state → 载入 → 导出 | 载入即清洗 ✓ 导出正常 ✓ |
| 7 | 门禁 | `node verify_all.mjs` 无新增错误 ✓；**建议新增**一条「装备数组含 null 时导出不崩」的回归 ✓（现有 `verify_character_import_roundtrip.cjs` 32 项里没有这一例 ✗） |
| 8 | 面板/顾问回归 | 装备区显示、材料包增删、顾问读取均不受影响 ✓ |

## 六、细节清单（实施时逐条对照）

1. **改动面**：`斯诺德跑团/character_export.js` · `斯诺德跑团/character_io.js` ·（如源头在解析）`斯诺德跑团/character_fields.js` · `character_layout.js` —— **全部要同步 `electron-app/` 镜像** ✓。
2. **禁用** ✗：不用 PowerShell 改中文文件 ✗；`panel_engine.js` 属超大文件 ✓ 若需改**用脚本** ✓。
3. **不要动**的语义 ✗：`resolveSkillData` 的解析规则 ✗ · `_SNODE_META` 结构 ✗ · UID 与 `provenance` ✗ · `free/occupies` 语义 ✗ —— 本次只做**空值防护与清洗** ✓。
4. **归一化判定**：只认可 `typeof e === "object" && e !== null && !Array.isArray(e)` ✓；数组/字符串/数字一律视为坏条目 ✓。
5. **跳过要可见** ✓：任何"跳过"都必须**计数 + 提示 + 可查**（不要静默 ✗）。
6. **诊断字段命名**：用**非下划线**字段（`exportSkipped` ✓ 而非 `_exportSkipped` ✗）—— 存档快照会丢弃 `_` 前缀键 ✓。
7. **备份**：改前把 3～4 个文件复制到 `备份区/2026-10/` ✓。
8. **回归脚本**：新增 `verify_export_bad_equipment.cjs`（构造 null/undefined/非对象 → 断言导出成功且合法条目数不变 ✓）。

## 七、风险

| 风险 | 处理 |
| --- | --- |
| 清洗过度把**合法条目**也滤掉 ✗ | 归一化只认"非对象/空" ✓；用往返测试断言**合法条目数不变** ✓ |
| 用户卡里的坏数据其实是**有价值的信息** ✗ | 跳过时**保留到诊断区**（如 `exportSkipped` 列表 ✓）+ 提示 ✓，不直接从内存抹掉 ✗ |
| 只修导出、不修源头 → 下次导入又出现 ✗ | **三层一起做** ✓（导出防护 + 导入堵源 + 载入自愈 ✓） |
| 定位不到源头（第 0 步失败 ✗） | 至少第 1、3 层能**立刻让用户能导出** ✓；源头另开一轮 ✓ |

## 八、需要你提供（能把定位从"3 个候选"收敛到 1 个）

1. **那张角色卡的 xlsx 文件**（或它的 `_SNODE_META` 片段 ✓）—— 我可只读分析 ✓ 不写入仓库 ✓（按 AGENTS：个人角色附件不入库 ✓）。
2. 或者**在浏览器控制台**跑一行给我们看结果 ✓：
   ```js
   JSON.stringify(Object.entries(state.equipment).map(([k,v]) => [k, (v||[]).map(x => x === null ? "NULL" : typeof x)]))
   ```
3. 复现路径确认：**是"导入后直接导出"就报错** ✓，还是"导入 → 面板里改过装备 → 再导出"才报错 ✗？（这直接决定是候选 A/B ✓ 还是 C ✗）