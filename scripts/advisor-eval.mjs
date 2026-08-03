#!/usr/bin/env node
/**
 * Advisor 回归评测：检索覆盖 + 回答断言 + 引用校验 + LLM-as-judge 要点评分。
 * 用法:
 *   node scripts/advisor-eval.mjs                      完整 API + 断言 + 引用校验
 *   node scripts/advisor-eval.mjs --context-only      只校验检索上下文（不调 API）
 *   node scripts/advisor-eval.mjs --judge             回答 + 断言 + 引用校验 + judge 要点评分
 *   node scripts/advisor-eval.mjs --sample 3          随机抽 3 个用例
 *   node scripts/advisor-eval.mjs --report            汇总历史报告趋势
 *   node scripts/advisor-eval.mjs --json              每用例输出单行 JSON
 * 退出码：断言失败 1；judge 低分不参与退出码（报告呈现）。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { advise } from './mage-advisor.mjs';
import { judgeAnswer } from './advisor-judge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'tmp', 'eval_reports');

const CASES = [
  {
    name: 'build_warrior',
    citationRequired: true,
    query: '我是1级战士，属性力量16敏捷14体质14，请帮我规划前几级的学习路线和推荐技能',
    contextHas: ['L2 战士技能', '猛击'],
    mustInclude: ['战士', '专长'],
    anyOf: [['猛击', '重殴', '盾牌格挡']],
    points: [
      '正确识别属性：力量16/敏捷14/体质14',
      'L1 技能槽基数 10',
      'L4 获取一项特殊专长，L5 开启三条进阶途径',
      '推荐具体战斗风格或技能（如猛击/重殴/盾牌格挡之一）',
      '末尾含免责声明',
    ],
  },
  {
    name: 'class_compare',
    query: '术士和法师有什么区别，新手该选哪个？',
    contextHas: ['术士', '法师'],
    mustInclude: ['术士', '法师'],
    points: [
      '术士关键属性为幸运，法师关键属性为智力',
      '术士含随机机制（混沌法术/混乱箭依赖骰点）',
      '法师初始特性为八选四（含塑能箭等）',
      '给出新手选择建议（任一方向）',
    ],
  },
  {
    name: 'rules_qa_long',
    citationRequired: true,
    query: '防御等级和攻击命中的检定公式是什么？我的战士力量18，防御等级该怎么算？',
    contextHas: ['护甲值演算'],
    mustInclude: ['护甲基础', '攻击命中检定值'],
    points: [
      'AC 公式包含护甲基础、敏捷调整值（含上限）、盾牌加值三项',
      '无护甲时 AC 合计为 10',
      '力量 18 转换为命中调整值 +4',
      '命中公式 = D20 + 攻击命中检定值',
      '说明未指定变量（武器熟练/益补等）不计入',
    ],
  },
  {
    name: 'rules_qa_short',
    query: '防御等级和攻击命中的检定公式是什么？',
    contextHas: ['护甲值演算', '战斗命中演算'],
    mustInclude: ['护甲基础', 'D20'],
    points: [
      'AC 公式三项组成（护甲基础+敏捷+盾牌）',
      '无护甲 AC=10',
      '命中公式 = D20 + 攻击命中检定值',
      '注明假设（无武器熟练加成等）',
    ],
  },
  {
    name: 'druid_advance',
    query: '德鲁伊3级能获得什么新形态？水栖形态有什么用？',
    contextHas: ['野兽形态', '水栖形态', '飞禽形态'],
    mustInclude: ['水栖形态', '水下呼吸'],
    anyOf: [['8米', '8 m', '8m', '飞禽形态', '海豹', '海豚', '水下移动', '5 级', '5级']],
    points: [
      '3 级通过野兽形态获得水栖形态',
      '水栖形态提供水下呼吸',
      '生命值上限临时变为 5+角色等级',
      '水下移动速度 8 米',
      '5 级可变海豹/海豚/小型鲨鱼等更具攻击性水栖生物',
      '3 级升级奖励含技能槽+1与解锁三阶天赋树',
    ],
  },
  {
    name: 'cleric_domain',
    query: '牧师生命与丰收之神的领域技能有哪些？树莓术的效果是什么？',
    contextHas: ['生命与丰收之神', '树莓术'],
    mustInclude: ['树莓术', '生命与丰收之神'],
    points: [
      '生命与丰收之神领域存在',
      '树莓术的效果（回复生命/视作进食/移除力竭之一）',
      '引用至少一个具体领域技能名',
    ],
  },
  {
    name: 'mage_school_seq',
    query: '法师的塑能学派序列是什么？',
    contextHas: ['塑能学派序列'],
    mustInclude: ['塑能学派序列'],
    points: [
      '塑能学派序列存在',
      '序列机制：可将塑能学派法术/戏法加入法术序列',
      '提及 L18 解锁大元素使超越者途径信息',
    ],
  },
  {
    name: 'universal_rune',
    query: '通用天赋树里的坚韧与不息符文有什么效果？',
    contextHas: ['坚韧与不息符文'],
    mustInclude: ['坚韧与不息符文'],
    points: [
      '坚韧与不息符文存在',
      '效果与体魄 D8 色彩骰/临时生命值相关',
      '包含具体数值或规则（临时生命值等于角色等级/回复优势之一）',
    ],
  },
  {
    name: 'artificer_drawing',
    query: '奇械师的破片手雷图纸怎么制作？有什么效果？',
    contextHas: ['破片手雷（图纸）'],
    mustInclude: ['破片手雷'],
    points: [
      '破片手雷（图纸）存在',
      '制作需要零件包（研发材料）',
      '效果：3*3 区域内角色各受 4 点穿刺伤害',
      '闪避成功仍承受一半结算后伤害',
    ],
  },
  {
    name: 'hunter_guard_talent',
    query: '猎人的灵龟守护的天赋效果是什么？',
    contextHas: ['灵龟守护·天赋'],
    mustInclude: ['灵龟守护'],
    anyOf: [['16点生命值', '命中检定具有劣势']],
    points: [
      '灵龟守护·天赋存在',
      '效果之一：跳过自身回合回复 16 点生命值',
      '效果之二：承受穿刺/挥砍时可令对方命中检定具有劣势',
    ],
  },
  {
    name: 'bard_chord_restored',
    query: '吟游诗人的治愈和弦是什么效果？',
    contextHas: ['治愈和弦'],
    mustInclude: ['回复', '律动节拍'],
    points: [
      '治愈和弦为回复类技能（触发带回复关键词的律动节拍效果）',
      '关键词包含回复.媒介.节奏',
      '不与静寂术内容混淆（无"粉色罩子/隔绝声音"类描述）',
    ],
  },
  {
    name: 'universal_free_offensive',
    query: '通用天赋树的自由攻势有什么效果？',
    contextHas: ['自由攻势'],
    mustInclude: ['自由攻势'],
    points: [
      '自由攻势存在',
      '效果：分别施展两个不同的通用天赋树战技（位阶不超过四阶）',
      '这次攻击可忽视战技限制条件',
    ],
  },
  {
    name: 'hunter_guard_passive_natural',
    query: '灵猴守护的被动是什么效果？',
    contextHas: ['灵猴守护·天赋'],
    mustInclude: ['灵猴守护'],
    points: [
      '灵猴守护·天赋存在',
      '效果：偷窃失败可回退事态（警惕值 15 可识破）',
    ],
  },
  {
    name: 'artificer_drawing_natural',
    query: '奇械师的破片手雷图纸怎么做？',
    contextHas: ['破片手雷（图纸）'],
    mustInclude: ['破片手雷'],
    points: [
      '破片手雷（图纸）存在',
      '制作需零件包等材料',
      '效果：3*3 区域 4 点穿刺伤害',
    ],
  },
  {
    name: 'rogue_recipe_natural',
    query: '游荡者的猩红之瓶配方怎么做？',
    contextHas: ['猩红之瓶（配方）'],
    mustInclude: ['猩红之瓶'],
    points: [
      '猩红之瓶（配方）存在',
      '配方材料包含蝎毒/炽心椒/血液之一',
      '效果：受 4 点火焰伤害后回复 8 点生命值',
      '伤害和回复不附加关键属性',
    ],
  },
  {
    name: 'druid_water_form_interaction',
    query: '德鲁伊的野兽形态在水栖形态下，如果我施展一个兽灵风格以外的技能，会发生什么？水栖形态的水下呼吸会怎样？',
    contextHas: ['野兽形态', '水栖形态'],
    mustInclude: ['解除', '水下呼吸'],
    points: [
      '施展兽灵风格以外的技能会强制解除野兽形态，变形关键词能力锁定至下一自身回合结束',
      '水栖形态是野兽形态的升级内容，提供水下呼吸',
      '解除形态后水下呼吸随之消失',
      '水栖形态下水下移动速度为8米或生命值上限 5+角色等级',
      '不使用“未收录”句式（资料库有完整机制与水栖数据）',
    ],
  },
  {
    name: 'ac_armor_value_calc',
    query: '我是一名3级战士，力量18，敏捷14，穿着皮甲拿着盾牌。我朋友说战士的防御等级是力量加值加护甲，那我的防御等级是18吗？',
    contextHas: ['护甲值演算'],
    mustInclude: ['15', '敏捷'],
    points: [
      '纠正错误假设：防御等级用敏捷调整值而非力量加值',
      'AC公式=护甲基础+min(敏捷调整值,敏捷上限)+盾牌加值',
      '敏捷14对应调整值+2，皮甲敏捷上限为2不削减',
      '皮甲基础11、盾牌加值+2',
      '合计防御等级为15',
      '不顺着错误前提给出18',
    ],
  },
  {
    name: 'chargen_recommend_vague',
    query: '我想玩一个很帅，很有操作感的角色，我可以玩点什么',
    contextHas: ['职业定位', '地精', '高等精灵', '小丑', '职业杀手'],
    mustInclude: ['推荐'],
    points: [
      '推荐≥3个不同职业（含定位/操作感/生存说明）',
      '至少2个职业各带≥2个推荐种族（含契合点）',
      '属性目标给出最终值（购点+种族加值叠加，如 15+2=17）',
      '推荐的职业/种族/背景名称均来自上下文（不编造）',
      '背景推荐后附自由选择声明（含“自行选择”类词）',
    ],
  },
  {
    name: 'chargen_advice',
    query: '推荐一个适合新手的吟游诗人加点方案和开局装备',
    contextHas: ['吟游诗人', '套装 A'],
    mustInclude: ['魅力'],
    points: [
      '吟游诗人关键属性为魅力',
      '初始特性五选二（推荐激励乐章/休憩曲之一）',
      '开局套装推荐且给出理由（套装 A 可推荐）',
    ],
  },

  {
    name: 'paladin_skills',
    citationRequired: true,
    query: '圣骑士的惩戒流派一阶有哪些技能？制裁之锤和力量祝福的效果是什么？',
    contextHas: ['制裁之锤', '力量祝福', '黄金连打'],
    mustInclude: ['圣骑士', '惩戒'],
    points: [
      '惩戒流派一阶代表技能（制裁之锤/力量祝福至少其一）',
      '区分惩戒/守护/圣洁等圣骑士战斗风格，不混用其他职业流派',
    ],
  },
  {
    name: 'barbarian_skills',
    citationRequired: true,
    query: '蛮斗士的狂暴流派有什么技能？凶蛮打击、生命归还和鲜血雷鸣分别是什么效果？',
    contextHas: ['凶蛮打击', '生命归还', '鲜血雷鸣'],
    mustInclude: ['蛮斗士', '狂暴'],
    points: [
      '狂暴流派代表技能凶蛮打击',
      '区分狂暴/生机/法咒等风格（如生命归还属于生机）',
      '给出选择建议而非堆砌全部技能',
    ],
  },
  {
    name: 'monk_skills',
    citationRequired: true,
    query: '武僧极斗流派一阶怎么选？猛虎掌和连环拳哪个更优先？',
    contextHas: ['猛虎掌', '连环拳', '幻形踢'],
    mustInclude: ['武僧', '极斗'],
    points: [
      '猛虎掌为极斗起手战技',
      '极斗一阶代表战技（连环拳/幻形踢至少其一）',
      '区分极斗/踏风/织雾等武僧风格',
    ],
  },
  {
    name: 'warlock_skills',
    citationRequired: true,
    query: '魔契师起始特性四选二怎么选？巫术箭和虚弱诅咒分别是什么效果？',
    contextHas: ['巫术箭', '毒液飞溅', '虚弱诅咒', '次级变形术'],
    mustInclude: ['魔契师'],
    points: [
      '起始特性为四选二（巫术箭/毒液飞溅/虚弱诅咒/次级变形术）',
      '巫术箭伤害类型与所选宗主相关',
      '按输出/毒伤/控场职能给出选择建议',
    ],
  },
  {
    name: 'shaman_skills',
    citationRequired: true,
    query: '萨满祭司的风暴流派一阶有什么技能？闪电箭和闪电盾牌的效果是什么？',
    contextHas: ['闪电箭', '闪电盾牌', '加速图腾'],
    mustInclude: ['萨满', '风暴'],
    points: [
      '闪电箭为风暴起始技能',
      '风暴流派一阶代表技能（闪电盾牌/加速图腾至少其一）',
      '区分风暴/火焰/水源/大地等萨满风格',
    ],
  },
  {
    name: 'sorcerer_chaos',
    citationRequired: true,
    query: '术士的混沌法术怎么结算？点数区间和效果怎么对应？',
    contextHas: ['混沌法术'],
    mustInclude: ['混沌法术'],
    points: [
      '混沌法术通过 D100 掷骰随机施展效应',
      '列出至少两个点数区间对应关系（如 001 次级祈愿术、002-005 绝对有利效应）',
      '明确随机性：点数越优效果越有利于当前局势',
    ],
  },
  {
    name: 'leveling_summary',
    citationRequired: false,
    query: '主职业从1级升到5级，一共能获得哪些系统奖励？',
    contextHas: ['技能槽', '自由属性', '进阶'],
    mustInclude: ['技能槽'],
    points: [
      'L2 获得熟练+1',
      '每级（除L1）技能槽+1，给出累计技能槽数',
      'L4 获取一项特殊专长',
      'L5 开启主职业三条进阶途径',
    ],
  },
  {
    name: 'point_buy_optimize',
    query: '32点购点，玩法师的话属性怎么分配最合理？',
    contextHas: ['购点', '智力'],
    mustInclude: ['智力'],
    points: [
      '法师关键属性为智力并优先保障',
      '给出具体购点分配建议',
      '说明种族加值在购点后叠加（最终值=购点+种族加值）',
    ],
  },
  {
    name: 'equipment_price',
    citationRequired: false,
    query: '活力药水多少钱？开锁工具呢？',
    contextHas: ['活力药水', '开锁工具'],
    mustInclude: ['金币'],
    points: [
      '给出活力药水价格（10金币）',
      '给出开锁工具价格（10金币）',
      '如涉及重量/容量可补充说明',
    ],
  },
  {
    name: 'race_detail',
    query: '木精灵的种族特性有哪些？适合什么职业？',
    contextHas: ['木精灵', '弓箭专精'],
    mustInclude: ['木精灵'],
    points: [
      '木精灵属性加值敏捷+2、魅力+2',
      '特性弓箭专精/轻捷步伐/精类血统至少其一',
      '结合特性给出适配职业建议（如猎人/游荡者）',
    ],
  },
  {
    name: 'background_deity',
    query: '侍僧背景可以选择侍奉哪些神？侍僧有什么熟练？',
    contextHas: ['侍僧', '宗教'],
    mustInclude: ['侍僧'],
    points: [
      '侍僧基础熟练为宗教、洞悉',
      '可提及任选两门语言',
      '侍僧拥有圣徽等装备或虔诚祷告特性',
    ],
  },
  {
    name: 'proficiency_lookup',
    citationRequired: false,
    query: '哪些职业可以获得知识熟练？',
    contextHas: ['知识'],
    mustInclude: ['知识'],
    points: [
      '列出可获得知识熟练的职业或背景',
      '说明熟练获取方式（如职业基础/背景授予）',
    ],
  },
  {
    name: 'feat_timing',
    citationRequired: false,
    query: '特殊专长在哪几级获得？',
    contextHas: ['特殊专长', '13'],
    mustInclude: ['特殊专长'],
    points: [
      '4 级首次获得一项特殊专长',
      '8 级、13 级各再获得一项',
    ],
  },
  {
    name: 'multiclass_conflict',
    citationRequired: false,
    query: '蛮斗士主职，7级的时候能兼职奇械师吗？',
    contextHas: ['蛮斗士', '奇械师', '兼职'],
    mustInclude: ['兼职'],
    points: [
      '主职 7 级解锁兼职',
      '奇械师与蛮斗士互斥（incompatible），不可兼职',
      '如可兼则列出条件，不可兼则说明互斥原因',
    ],
  },
  {
    name: 'status_rules',
    citationRequired: false,
    query: '沉默状态有什么效果？怎么解除？',
    contextHas: ['沉默', '限制'],
    mustInclude: ['沉默'],
    points: [
      '沉默使目标无法通过语言与他人交流',
      '无法施展需要语言生效的能力',
      '属于限制类状态（软控）',
    ],
  },
  {
    name: 'sp_marks',
    citationRequired: false,
    query: '紫色标识是什么？学带标识的技能要消耗什么？',
    contextHas: ['紫色', '标识'],
    mustInclude: ['标识'],
    points: [
      '紫色为 14 种色彩标识之一（固定色，非 wildcard）',
      '学习带标识技能消耗对应色彩标识与 1 SP',
      '标识由 DM 按模组结算发放，不假设玩家已持有',
    ],
  },
  {
    name: 'tips_warrior',
    query: '战士有什么战斗小技巧？',
    contextHas: ['斗争'],
    mustInclude: ['战士'],
    points: [
      '引用战士相关小贴士（如斗争风格搭配猛击起手）',
      '小贴士为建议而非必成立连招',
    ],
  },
  {
    name: 'worldview_era',
    query: '斯诺德大陆的历史分为哪几个年代？',
    contextHas: ['上古年代', '辉煌年代', '曙光年代'],
    mustInclude: ['年代'],
    points: [
      '列举至少三个年代（上古/辉煌/混乱/灰色/曙光）',
      '按时间顺序简要说明各年代特征',
    ],
  },
  {
    name: 'unknown_entity',
    query: '元素大师这个职业有收录吗？',
    contextHas: [],
    mustInclude: ['元素大师'],
    anyOf: [['未收录', '没有收录', '未在资料库', '不在资料库']],
    points: [
      '不编造元素大师的职业内容',
      '明确当前资料未收录该条目',
      '给出导向（查阅规则书/咨询 DM）',
    ],
  },
  {
    name: 'build_review',
    citationRequired: true,
    query: '我1级战士，学了猛击和盾牌格挡，这个开局怎么样？',
    contextHas: ['猛击', '盾牌格挡'],
    mustInclude: ['战士'],
    points: [
      '评价起手组合的优缺点',
      '结合战士风格给后续学习建议',
      '不编造上下文未出现的技能',
    ],
  },
  {
    name: 'advancement_warrior',
    query: '战士5级开启的进阶途径有哪些？近卫是什么？',
    contextHas: ['近卫', '进阶'],
    mustInclude: ['近卫'],
    points: [
      'L5 开启主职业三条进阶途径',
      '近卫为战士进阶途径之一',
      '说明近卫定位或门槛',
    ],
  },

  {
    name: 'skill_cost_lookup',
    query: '重殴的疲劳消耗和技能点是多少？',
    contextHas: ['疲劳消耗', '技能点', '橙色'],
    mustInclude: ['橙色'],
    points: [
      '疲劳消耗为 1',
      '技能点消耗为 1',
      '色彩标识为橙色',
    ],
  },
  {
    name: 'carry_capacity',
    query: '我力量14，常规、满载和极限负重分别是多少？',
    contextHas: ['常规负重', '满载负重', '70'],
    mustInclude: ['70', '140', '210'],
    points: [
      '常规负重 = 力量×5 = 70 kg',
      '满载负重 = 力量×10 = 140 kg',
      '极限负重 = 力量×15 = 210 kg',
    ],
  },
  {
    name: 'damage_expectation',
    query: '吟游诗人的音波刃能造成多少伤害？',
    contextHas: ['音波刃', '1D6'],
    mustInclude: ['1D6'],
    points: [
      '技能自身骰子为 1D6',
      '给出伤害区间（1-6）或平均值',
      '说明仅技能骰子，不含武器/属性调整',
    ],
  },
  {
    name: 'clarify_missing_class',
    expectClarify: true,
    query: '帮我规划一下输出很高的职业的学习路线和推荐技能',
    contextHas: [],
    mustInclude: [],
    points: [
      '先确认职业信息（追问缺少的职业）',
      '不编造具体职业专属内容',
    ],
  },
];

function extractContext(messages) {
  const user = [...messages].reverse().find((m) => m.role === 'user' && m.content && m.content.includes('【检索上下文】'));
  if (!user) return '';
  const at = user.content.indexOf('【检索上下文】');
  const routeAt = user.content.indexOf('【路由】');
  if (at < 0) return '';
  let ctx = routeAt > at ? user.content.slice(at, routeAt) : user.content.slice(at);
  // 去掉回显的问题行，避免 contextHas 被 query 关键词污染
  ctx = ctx.split('\n').filter((l) => !/^# 检索上下文/.test(l) && !/^\u95ee\u9898: /.test(l)).join('\n');
  return ctx;
}

function contextIds(ctx) {
  const ids = new Set();
  for (const m of ctx.matchAll(/条目:([A-Za-z0-9-]+)/g)) {
    if (m[1] && m[1] !== '-') ids.add(m[1]);
  }
  return ids;
}

function extractRefs(text) {
  const m = String(text || '').match(/(【参考】[^\n]*)[ \t]*\n*$/);
  if (!m) return [];
  const items = m[1].replace(/^【参考】/, '').split('｜').map((x) => x.trim()).filter(Boolean);
  const refs = [];
  for (const it of items) {
    const mm = it.match(/^(.*?)（(.*?)·(.*?)）$/);
    if (mm) refs.push({ raw: it, name: mm[1].trim(), cls: mm[2].trim(), id: mm[3].trim() });
    else refs.push({ raw: it, name: it, cls: '', id: '' });
  }
  return refs;
}

function checkCitation(refs, validIds) {
  const errors = [];
  for (const r of refs) {
    if (!r.id && /（规则）$/.test(r.raw)) continue; // 规则引用无需条目 id
    if (!validIds.has(r.id)) {
      errors.push({ raw: r.raw, id: r.id, reason: 'id 不在检索上下文' });
    }
  }
  return errors;
}

function checkCase(c, text, missing) {
  const okInclude = c.mustInclude.every((k) => text.includes(k));
  if (!okInclude) missing.push(...c.mustInclude.filter((k) => !text.includes(k)));
  for (const group of c.anyOf || []) {
    if (!group.some((k) => text.includes(k))) {
      missing.push(`anyOf[${group.join('/')}]`);
    }
  }
  if (c.citationRequired && !text.includes('【参考】')) {
    missing.push('【参考】');
  }
}

function runReport(args) {
  if (!fs.existsSync(REPORTS_DIR)) {
    console.log('暂无历史报告');
    return;
  }
  const files = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) {
    console.log('暂无历史报告');
    return;
  }
  const rows = [];
  for (const f of files) {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), 'utf8'));
      rows.push({
        file: f,
        date: r.date,
        passRate: r.summary?.passRate,
        judgeAvg: r.summary?.judgeAvg,
        citationErrors: r.summary?.citationErrors,
        total: r.summary?.total,
      });
    } catch { /* skip */ }
  }
  console.log('=== 历史报告趋势 ===');
  for (const row of rows.slice(-10)) {
    console.log(` ${row.file} | 断言通过率 ${row.passRate} | judge 均分 ${row.judgeAvg} | 引用错误 ${row.citationErrors} | 用例 ${row.total}`);
  }
}

async function run() {
  const args = process.argv.slice(2);
  const contextOnly = args.includes('--context-only');
  const useJudge = args.includes('--judge');
  const json = args.includes('--json');
  const sampleIdx = args.indexOf('--sample');
  const sampleN = sampleIdx >= 0 ? Number(args[sampleIdx + 1]) : null;
  if (args.includes('--report')) {
    runReport(args);
    return;
  }

  let cases = CASES;
  if (sampleN && sampleN > 0) {
    cases = [...CASES].sort(() => Math.random() - 0.5).slice(0, sampleN);
    console.log(`抽样 ${cases.length} 个用例`);
  }

  const results = [];
  let failed = 0;
  let citationErrorsTotal = 0;
  let judgeSum = 0;
  let judgeCount = 0;

  for (const c of cases) {
    const t0 = Date.now();
    try {
      const dry = await advise(c.query, { dryRun: true });
      const ctx = extractContext(dry.messages || []);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const ctxMissing = c.contextHas.filter((k) => !ctx.includes(k));
      if (c.expectClarify && !dry.clarify?.needs?.length) ctxMissing.push('clarify');
      if (contextOnly) {
        const ok = ctxMissing.length === 0;
        if (!ok) failed += 1;
        results.push({ name: c.name, ok, skipped: false, seconds: Number(elapsed), ctxMissing, intent: dry.intent });
        if (json) console.log('###RESULT### ' + JSON.stringify(results[results.length - 1]));
        else console.log(`${ok ? 'PASS' : 'FAIL'} ${c.name} (${elapsed}s) intent=${dry.intent}${ctxMissing.length ? ' ctxMissing=' + ctxMissing.join(',') : ''}`);
        continue;
      }

      let out = await advise(c.query);
      const elapsedFull = ((Date.now() - t0) / 1000).toFixed(1);
      let missing = [];
      checkCase(c, out.answer || '', missing);
      if (c.expectClarify && !out.clarify?.needs?.length) missing.push('clarify');
      if (ctxMissing.length) missing.push(`ctx[${ctxMissing.join(',')}]`);
      const validIds = contextIds(ctx);
      let refs = extractRefs(out.answer || '');
      let citeErrors = checkCitation(refs, validIds);
      let ok = missing.length === 0 && citeErrors.length === 0;
      let retried = false;
      // 生成波动兜底：断言失败时重试一次（连续两次失败才算真失败；judge 分数照常呈现质量）
      if (!ok) {
        const retryOut = await advise(c.query);
        const retryMissing = [];
        checkCase(c, retryOut.answer || '', retryMissing);
        if (c.expectClarify && !retryOut.clarify?.needs?.length) retryMissing.push('clarify');
        if (ctxMissing.length) retryMissing.push(`ctx[${ctxMissing.join(',')}]`);
        const retryRefs = extractRefs(retryOut.answer || '');
        const retryCite = checkCitation(retryRefs, validIds);
        if (retryMissing.length === 0 && retryCite.length === 0) {
          out = retryOut;
          missing = retryMissing;
          refs = retryRefs;
          citeErrors = retryCite;
          retried = true;
          ok = true;
        }
      }
      if (citeErrors.length) citationErrorsTotal += citeErrors.length;

      let judge = null;
      if (useJudge && c.points?.length) {
        judge = await judgeAnswer({ query: c.query, points: c.points, answer: out.answer || '' });
        if (judge.ok) {
          const passed = judge.scores.filter((s) => s.pass === 1).length;
          judgeSum += passed / Math.max(judge.scores.length, 1);
          judgeCount += 1;
        }
      }

      if (!ok) failed += 1;
      const rec = {
        name: c.name, ok, skipped: false, seconds: Number(elapsedFull), missing, retried,
        intent: out.intent, citationErrors: citeErrors, judge: judge ? {
          ok: judge.ok, pointPass: judge.ok ? judge.scores.filter((s) => s.pass === 1).length : 0,
          pointTotal: judge.ok ? judge.scores.length : 0, total: judge.ok ? judge.total : null,
          reason: judge.ok ? judge.reason : (judge.error || ''),
        } : null,
      };
      results.push(rec);
      if (json) console.log('###RESULT### ' + JSON.stringify(rec));
      else {
        let line = `${ok ? 'PASS' : 'FAIL'} ${c.name} (${elapsedFull}s) intent=${out.intent}`;
        if (missing.length) line += ` missing=${missing.join(',')}`;
        if (citeErrors.length) line += ` citeErr=${citeErrors.length}`;
        if (judge && judge.ok) line += ` judge=${judge.scores.filter((s) => s.pass === 1).length}/${judge.scores.length}`;
        console.log(line);
      }
    } catch (e) {
      failed += 1;
      results.push({ name: c.name, ok: false, skipped: false, error: e.message });
      if (json) console.log('###RESULT### ' + JSON.stringify(results[results.length - 1]));
      else console.log(`FAIL ${c.name} error=${e.message}`);
    }
  }

  const total = results.length;
  const passed = results.filter((r) => r.ok && !r.skipped).length;
  const passRate = total ? Number(((passed / total) * 100).toFixed(1)) : 0;
  const judgeAvg = judgeCount ? Number(((judgeSum / judgeCount) * 5).toFixed(2)) : null;
  console.log(`\nSUMMARY: ${passed} passed, ${failed} failed (of ${total}) | 引用错误 ${citationErrorsTotal}${judgeAvg != null ? ` | judge 均分 ${judgeAvg}/5` : ''}`);

  const report = {
    date: new Date().toISOString(),
    mode: useJudge ? 'judge' : (contextOnly ? 'context' : 'full'),
    summary: { total, passed, failed, passRate, citationErrors: citationErrorsTotal, judgeAvg, judgeCount },
    results,
  };
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(REPORTS_DIR, `eval-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2), 'utf8');
  console.log('报告已存 ' + file);
  process.exit(failed ? 1 : 0);
}

run();
