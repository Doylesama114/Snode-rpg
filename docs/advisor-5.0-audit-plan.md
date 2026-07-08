# Advisor 5.0 — 全面审查与改进计划

> **基线**：v1.0.7064  
> **日期**：2026-07-08  
> **方法**：15 条多角度 dry-run（检索层，无 LLM）+ 语料对照 + 用户 5 题专项分析  
> **脚本**：`node scripts/validate-advisor-audit.mjs`（可纳入 CI，当前 9/15 非 OK）

---

## 1. 核心结论

当前 Advisor 的主要问题 **不是「缺规则书」**，而是 **问题类型与检索能力不匹配**：

| 能力 | 现状 | 典型失败 |
|------|------|----------|
| 单职业 + 单实体 | 较强 | 「牧师武器熟练」✓ |
| 成长路线 / 进阶规划 | 7061–7064 已补强 | 诡术士别名 ✓ |
| **跨职业对比** | 几乎无 | 锤子熟练、法师∩吟游诗人同名技能 ✗ |
| **车卡最优化** | 语料有、不注入 | 初始血量最大化 ✗ |
| **单技能机制精算** | 语料有、路由错 | 窃贼的交易收益/代价 ✗ |
| **战斗数值叠算** | **无规则引擎** | 命中加值叠 Buff ✗ |
| **已加载未注入** | 常见 | status_conditions、weaponProf 表 ✗ |

**改进方向**：从「遇到一个 bug 修一个 regex」升级为 **问题分型 → 专用 Tool → 结构化注入 → Golden 回归矩阵**（延续 4.0 tools 层，扩展到全问法）。

---

## 2. 用户 5 题 — 专项测试结果

### Q1 · 初始血量最大化

**问句**：在创建角色时，怎样构筑可以使我的角色初始血量达到最大值

| 项 | 结果 |
|----|------|
| 路由 | `chargen` |
| 注入 | 仅 L0 + L1 种族/背景 token 匹配，**无 hp 公式、无种族 hpBonus 表** |
| 语料 | ✓ `races.json` 含 `hpBonus`（兽人 4、矮人 3 等）；✓ 各 `*_class.json` 含 `hpFormula.first` |
| 缺口 | **RETRIEVAL_GAP** — 缺少 `chargen_optimization` 意图与 HP 对照表注入 |
| AI 预期行为 | 只能答「请咨询 DM」，或幻觉 |

**应用答法（语料可支撑）**：比较 14 职业 L1 `8+体质调整值`（或职业特例）+ 种族 `hpBonus` + 购点体质上限；蛮斗士/战士等非 8 基底的职业需读 `hpFormula`。

---

### Q2 · 法师几乎全知识/奥秘熟练

**问句**：我想让我的法师能够获取到几乎所有的知识，奥秘的熟练项，我最少升到多少级，学习哪些技能可以做到

| 项 | 结果 |
|----|------|
| 路由 | `leveling`（含「多少级」触发；亦可能 `mage_skills`） |
| 注入 | L0 升级表 + 部分法师实体；**无熟练项来源路线图** |
| 语料 | ✓ `proficiencies.json` 全列表；✓ 奥法学者/知识传承专精；✓ 幕间物语学习法术规则（leveling） |
| 缺口 | **TOOL_GAP** — 需要 `outlineProficiencyRoadmap(法师, 目标=[知识*, 奥秘*])` |
| AI 预期行为 | 泛泛提专精，无法给出「L1 专精 + L? 技能 + 背景 + 升级 prof_cap」的可达路径 |

---

### Q3 · 命中加值叠算

**问句**：力量+3、1 点剑类熟练、1d8 双手剑、魔法武器 + 锐化武器 + 狂怒术 → 命中加值？

| 项 | 结果 |
|----|------|
| 路由 | `chargen`（误路由；应为 `combat_math`） |
| 注入 | **几乎为空**（L0 里程碑文字，无三技能条目） |
| 语料 | 技能摘要散落：`锐化武器` L5「命中+3」在 `mage_index`；`狂怒术` 主要为 STR+2/暴击规则；**无基础攻击公式 JSON** |
| 缺口 | **ENGINE_GAP + RETRIEVAL_GAP + ROUTING_GAP** |
| AI 预期行为 | 必幻觉或拒答 |

**说明**：即使用户指定了数值，系统也缺少：

1. 基础规则：近战命中 = 力量调整值 + 武器熟练 + …（需从战斗章 extract）
2. 结构化 `modifiers[]`：`{ source, type: hit|damage, value, condition }`
3. `resolveCombatScenario(params)` 工具

---

### Q4 · 法师与吟游诗人相同技能

**问句**：法师和吟游诗人有哪些相同的技能

| 项 | 结果 |
|----|------|
| 路由 | `class_skills` ✓ |
| 注入 | 两职业 entity 卡片 + **catalog 分组统计** + L2 各 15 条抽样 |
| 语料 | ✓ 程序交集 **36 个同名**（舞光术、油腻术、次级幻影…） |
| 缺口 | **TOOL_GAP** — catalog 不给交集；L2 topK 抽样 **不会覆盖** 舞光术/油腻术 |
| AI 预期行为 | 猜几个常见法术，**漏掉大部分** |

---

### Q5 · 窃贼的交易 收益与代价

**问句**：窃贼的交易这个技能我一共可以得到多少收益，与此同时我需要支付的代价又是多少

| 项 | 结果 |
|----|------|
| 路由 | `general` ✗（应为 `skill_detail`） |
| 注入 | L0 + L1 背景，**无「窃贼的交易」全文** |
| 语料 | ✓ `rogue_index.json` 含完整 summary（-5 HP 上限换属性/熟练/技能点/专长…；L5/L10 里程碑） |
| 缺口 | **ROUTING_GAP + RETRIEVAL_GAP** — 缺「按技能名精确检索」 |
| AI 预期行为 | 「未收录」或编造数字 |

---

## 3. 补充刁钻题（10 条）与结果摘要

| ID | 问法 | 分型 | 结果 | 主要缺口 |
|----|------|------|------|----------|
| hammer-prof | 哪些初始职业武器熟练含锤子 | 跨职业 lookup | ✗ | weaponProf 表未注入 |
| guishushi | 进阶诡术士基础职业选什么 | 进阶门槛 | ✓ | 7064 已修 |
| silence | 沉默效果 + 哪些技能造成沉默 | 状态规则 | ✗ | status_conditions 已 build 未 inject |
| multiclass | 7 级战士兼职法师条件 | 兼职 | ✓ | multiclass.json |
| level-3-6 | 主职 3→6 级累计奖励 | 升级表 | ✓ | leveling.json |
| feat-timing | 特殊专长哪些等级获得 | 专长 | △ | L4 专长列表有，L8/L13 **窗口文字不完整** |
| unknown-adv | 元素大师成长路线 | 未收录闸门 | △ | 有 L3 但「未收录」字样不稳定 |
| magic-weapon-dup | 魔法武器哪些职业能学 | 技能消歧 | ✗ | 多职业同名技能无聚合 |
| point-buy | 32 购点法师智力 15 体质尽量高 | 车卡演算 | ✓ | point_buy + 法师 context |
| sp-mark | 紫色标识三阶技能要多少 SP | SP 规则 | ✓ | sp_marks |

---

## 4. 问题分型（Advisor 5.0 路由目标）

建议将 `routeIntent` 从「正则抢答」升级为 **分型 + 置信度**：

```
A  实体问答      — 单个种族/背景/职业/技能/专长
B  跨实体对比    — 两职业技能交集、武器熟练对照、兼职兼容表
C  车卡构筑      — 购点、HP/AC 优化、起始装备
D  成长规划      — build_roadmap（已有）
E  升级/熟练规划 — 多少级获得 X 熟练、prof_cap 路径
F  战斗演算      — 命中/伤害/豁免叠算（需引擎）
G  规则查询      — 状态、SP、标识、兼职、升级里程碑
H  面板快照      — L6 已有
I  未知实体闸门  — unknown_entity（已有，需扩覆盖）
```

当前大量 A/B/C/E/F 问法 **落入 general 或 chargen**，只拿到 L0+L1 噪声。

---

## 5. 语料 vs 检索 — 三层缺口

### 5.1 语料未建（CORPUS_GAP）

| 内容 | 源 | 优先级 |
|------|-----|--------|
| 近战/远程 **基础命中公式** | 基础规则 HTML / 战斗章 | P0（Q3） |
| 武器类型 → 熟练类别 | 角色创建页 `wepExact` | P0（锤子题） |
| 附魔/Buff **modifiers 结构化** | skill_effects_*.json | P1 |
| 完整装备/药水/材料 | 职业页/数据/*.json | P2 |
| 背景性格表 | bg_personality.json | P3 |

### 5.2 语料已有、检索未注入（RETRIEVAL_GAP）

| 数据 | 位置 | 应触发问法 |
|------|------|------------|
| 14 职业 weaponProfCategories | equipment_rules / entities | 「哪些职业有 X 武器」 |
| 种族 hpBonus + 职业 hpFormula | races + class json | 「初始血量最大」 |
| status_conditions | rules/ | 「X 状态效果」 |
| 单技能全文 | *_index.json | 问句含精确技能名 |
| proficiencies 全表 | proficiencies.json | 「如何获得 X 熟练」 |

### 5.3 需计算引擎（ENGINE_GAP）

| 场景 | 工具名（建议） |
|------|----------------|
| 命中/伤害叠算 | `resolveCombatScenario({ attrs, profs, weapon, buffs[] })` |
| 购点最优 | `optimizePointBuy(constraints)` — 已有部分 attrs 分析 |
| 等级区间累计奖励 | `getLevelingTable` — **已有**，需扩路由 |
| 技能集合运算 | `intersectSkills(classA, classB)` / `filterClassesByWeapon(cat)` |
| 熟练获取路径 | `outlineProficiencyRoadmap(class, targets[])` |

---

## 6. Advisor 5.0 架构目标

```
问句 + history + snapshot
        ↓
[5.1] classifyQuestion()     ← 分型 A–I，替代纯 regex 抢 intent
        ↓
[5.2] resolveEntities()      ← 技能名/职业名/进阶名/武器别名（扩 ADVANCED_ALIASES）
        ↓
[5.3] runTools(type, entities) ← 见下表
        ↓
[5.4] injectStructuredContext() ← JSON/表格块，不只 L2 抽样
        ↓
[5.5] answerContract(type)   ← 每类固定输出节（含「仅作参考」）
        ↓
LLM
        ↓
[5.6] validate-advisor-audit.mjs + golden/*.json  ← 15+ 条分型回归
```

### 5.0 Tools 扩展（在 7063 `advisor-tools.mjs` 上）

| Tool | 解决问法 | 输入 |
|------|----------|------|
| `lookupSkill(name)` | Q5、魔法武器消歧 | 精确名 → 所属职业 + 全文 + 里程碑 |
| `intersectSkills(a,b)` | Q4 | 两职业 id |
| `listClassesByWeaponProf(query)` | 锤子题 | 锤类/aliases |
| `summarizeChargenHp()` | Q1 | 14 职业 × 种族 hpBonus 矩阵 |
| `outlineProficiencyRoadmap()` | Q2 | 职业 + 目标熟练集合 |
| `resolveCombatScenario()` | Q3 | 结构化战斗参数 |
| `lookupStatus(name)` | 沉默等 | status_conditions |
| `aggregateSkillByName(name)` | 魔法武器多职业 | 跨 index 聚合 |

---

## 7. 分版本实施路线

### v1.0.7065 — 审计基线 + 技能精确检索（P0，1–2 天）

- 纳入 CI：`validate-advisor-audit.mjs`
- 新 intent：`skill_detail` — 问句含 `*_index` 命中技能名 → 注入全文 + 里程碑
- 新 intent：`cross_class_compare` — 检测「A和B相同/共同/区别」
- Tool：`lookupSkill` / `intersectSkills`
- Golden：Q4、Q5、锤子题

### v1.0.7065 — Advisor 5.0 batch1 · Query Tools（26.07.08）

- **`advisor-query-tools.mjs`**：`lookupSkill` / `intersectSkills` / `listClassesByWeaponProf`
- **新 intent**：`skill_detail` · `cross_class_compare` · `class_weapon_prof`
- **Golden**：Q4/Q5/锤子题；**CI**：`validate-advisor-audit.mjs`

### v1.0.7066 — 车卡与熟练规划 Tools（26.07.08）

- Tool：`summarizeChargenHp`（Q1 初始 HP 最大化）
- Tool：`outlineProficiencyRoadmap`（Q2 法师知识/奥秘先行）
- 新 intent：`chargen_hp_optimize` · `proficiency_roadmap`
- 扩展 `formatRegistryClassBasics` 含 weaponProfCategories、L1 生命
- Golden：Q1、Q2；CI batch2 must-pass

### v1.0.7067 — 规则层注入补全（26.07.08）

- Tool：`lookupStatus`（沉默等 status_conditions + appliesStatuses 技能）
- Tool：`aggregateSkillByName`（魔法武器等多职业同名技能）
- Tool：`summarizeFeatWindows`（L4/L8/L13 专长窗）
- 未收录闸门：未知进阶规划 → `unknown_entity` Tools 层
- Golden：沉默 · 专长窗 · 元素大师 · 魔法武器；CI batch3 must-pass

### v1.0.7068 — 战斗规则语料 + 场景引擎 MVP（26.07.08）

- Build：`combat_basics.json` + `combat_skill_modifiers.json`
- Tool：`resolveCombatScenario` / `parseCombatScenarioFromQuery`
- 新 intent：`combat_math`；Q3 分解式 **+7**
- Golden：`user-attack-bonus`；CI batch4 must-pass

### v1.0.7069 — 问题分类器 + 快照联动（P2）✓

- `classifyQuestion()` 替代部分 INTENT_RULES 抢答（`advisor-classifier.mjs`）
- 战斗/熟练问法若有 L6 快照 → 优先读快照 attrs/profs（`mergeSnapshotIntoCombatScenario`）
- 扩展 audit 至 **34** 条；CI batch5 must-pass（snap-build-review · snap-prof-roadmap · snap-combat-hit）

### v1.0.7070 — 语料扩面（P2–P3）✓

- `equipment_catalog_index.json` 全量 index（71 项）+ `consumables_index.json`（150 项）
- `lookupEquipment` / `searchEquipment`；intent `equipment_lookup` · `equipment_search`
- `advisor-feedback-golden.mjs` + bug-report localStorage 联动
- Golden + CI batch6 must-pass

### v1.0.7071 — 购点/升级演算 + 伤害引擎（P1）✓

- `optimizePointBuy()` / `summarizeLevelingRange()`；intent `point_buy_optimize` · `leveling_summary`
- 战斗伤害 flat 加值（`combat_basics.json` damageRoll）
- `validate-advisor-intents.mjs`；Golden + CI batch7 must-pass

### v1.0.7072 — 背景性格 + AC 演算 + 反馈同步（P2–P3）✓

- `build-advisor-bg-personality-index.mjs` → `bg_personality_index.json`（42 背景）
- `advisor-background-tools.mjs`：`lookupBackground()`；intent `background_detail`
- `combat_basics.json` acRules；`resolveAcScenario()`（轻甲 11+敏捷 cap2；盾牌 +2）
- `advisor-feedback-sync.mjs`：pending → 校验 → golden
- Golden + CI batch8 must-pass（侍僧神祇 · 皮甲 AC 13 · 皮甲+盾 AC 15）

### v1.0.7073 — 战斗引擎 Phase2 + 熟练反查（P1–P2）✓

- 弓箭 `categoryHitBonuses` 远程 +2；`resolveFullCombatScenario()` 命中+伤害合并
- `advisor-proficiency-tools.mjs`：`listClassesByProficiency()`；intent `proficiency_lookup`
- Golden + CI batch9 must-pass（命中伤害合并 · 宗教熟练 · 弓箭 +5）

### v1.0.7074 — 车卡 entity bundle + 快照 AC（P2）✓

- `advisor-chargen-entity-tools.mjs`：`lookupStartingGear()` / `lookupRace()` / `background_chargen`
- `mergeSnapshotIntoAcScenario()`；L6 快照 equipment.armor 联动 AC 演算
- Golden + CI batch10 must-pass（牧师起始装 · 血族特性 · 快照 AC 13）

### v1.0.7075 — 反馈闭环 + CI 收口（P2）✓

- `advisor-feedback-lib.mjs` / `advisor-feedback-export.mjs`：inbox → pending 自动 infer mustInclude
- `validate-advisor-feedback.mjs` + `validate-advisor-5-regression.mjs`（Advisor 5.0 全套件）
- Phase5 回归接入 advisor-5-ci；Audit batch11 must-pass（反馈模板三类问法）
- `bug-report.js`：反馈队列 + 问句/意图/必含 字段

### v1.0.7076 — 战斗 Phase 3（P1）✓

- `categoryCritBonuses` 斧类暴击率+1；`combat_skill_modifiers` 扩展瞄准射击
- `mergeSnapshotCombatBuffs()`：L6 快照 skills → 战斗 Buff 自动联动
- Golden + CI batch12 must-pass（斧类暴击 · 瞄准 L8 +10 · 快照 Buff +7）

### v1.0.7077 — 熟练路线泛化（P2）✓

- `outlineProficiencyRoadmap` 任意职业 + 父/单项熟练；`parseProficiencyTargetsFromQuery`
- 分类器/快照不再硬编码法师知识奥秘；`mock-rogue-l6.json`
- Golden + CI batch13 must-pass（牧师宗教自然 · 游荡者巧手 · 快照巧手）

### v1.0.7078 — 战斗 Phase 4 AC Buff（P1）✓

- `acModifier` 支持；守护刻印/穿透射击/硬化铠甲 入 `combat_skill_modifiers.json`
- `validate-advisor-combat-modifiers.mjs`；`mock-cleric-l6.json` 快照 AC Buff
- Golden + CI batch14 must-pass（守护刻印 AC 15 · 穿透射击 +10 · 快照牧师 AC）

### v1.0.7079 — Build 评价 Tools 层（P1）✓

- `advisor-build-review-tools.mjs`：`outlineBuildReview` / kit 位阶内技能候选
- 分类器 `build_review` 与 `build_roadmap` 拆分；`isPanelRoadmapQuery` 排除评价问句
- Golden + CI batch15 must-pass（魔剑士评价 · 快照 Tools · 牧师评价）

### v1.0.7080+ — 后续

## 8. Golden / CI 策略

**原则**：每条 golden = **检索上下文断言**（必含/禁含），不依赖 LLM 措辞。

| 套件 | 文件 | 覆盖 |
|------|------|------|
| 路线/进阶 | `golden/conversations.json` | 已有 7 条 |
| 分型审计 | `validate-advisor-audit.mjs` | **34** 条（7069） |
| Tools 单测 | `validate-advisor-tools.mjs` | 每 tool 2+ case |
| 路由 | `validate-advisor-planner.mjs` | 每 intent 1 case |

**用户 5 题 → 首批必过 golden ID**：

- `user-hp-max`
- `user-mage-knowledge`
- `user-attack-bonus`（7068 后）
- `user-skill-overlap`
- `user-thief-trade`

---

## 9. 对「AI 应朝什么方向改进」的直接回答

1. **从「法师顾问」进化为「全规则结构化顾问」**  
   检索层按 **问题类型** 喂 **表格/清单/演算结果**，而不是 L2 技能抽样 + 希望 LLM 自己推理。

2. **LLM 角色收窄**  
   - 擅长：组织语言、比较取向、给出 build 建议  
   - 不擅长：集合运算、数值叠算、跨 14 职业查表 → **必须用 Tools**

3. **停止 patch-only 文化**  
   每修一题，在 `validate-advisor-audit.mjs` 加一条 + 对应 tool；7065 起 **无 golden 不合并**。

4. **语料建设优先级**  
   P0：战斗基础公式 + 武器类别映射 + 技能 modifier 结构化  
   P2：装备/消耗品大全（问到了再 build）

5. **与用户预期对齐**  
   - Q1/Q2：「最优构筑/最少等级」→ 需要 **explicit optimization tools**，不能只给 raw 数据  
   - Q3：必须 **分解式答案**（基础 + 熟练 + 各 Buff + 前提条件）  
   - Q4/Q5：必须 **完整枚举**，accept partial 列表为失败

---

## 10. 附录：法师 ∩ 吟游诗人 同名技能（语料 ground truth，36 个）

供 Q4 golden `mustInclude` 抽样：

交友术、舞光术、油腻术、传讯术、光亮术、次级幻影、伪造讯息、侦测思想、修复术、催眠图纹、创造水源、创造篝火、反射闪避、召唤箭雨、召唤隐形战仆、回避侦测、封门术、心悦诚服、慷慨术、旋刃魂曲、次元步、七彩炫光、防护箭矢、浮碟术、迷幻手稿、廉价把戏、漂染术、魔法伎俩、睡眠术、缓落术、次级治疗术、风之诗、借速打力、跃动随想曲、八度跳跃、闪烁步伐

（完整列表由 `intersectSkills('法师','吟游诗人')` 生成。）

---

## 11. 立即可执行的验证命令

```bash
# 全量分型审计（当前预期 9/15 非 OK）
node scripts/validate-advisor-audit.mjs

# 原有回归
node scripts/validate-advisor-golden.mjs
node scripts/validate-advisor-tools.mjs
node scripts/validate-advisor-roadmap.mjs

# 单题 dry-run
node scripts/mage-advisor.mjs --dry-run "你的问句"
```
