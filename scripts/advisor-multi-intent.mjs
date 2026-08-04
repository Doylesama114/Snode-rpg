/**
 * 多意图 / 矛盾意图检测：
 * 当一次询问里塞了多个领域的问题，或目标互相冲突时，返回检测原因；
 * 调用方应引导用户先想清楚“你到底要干嘛”（基本规则第六条）。
 */

const DOMAINS = {
  class: /战士|法师|牧师|猎人|圣骑士|游荡者|德鲁伊|武僧|吟游诗人|术士|萨满祭司|蛮斗士|魔契师|奇械师|职业/,
  char: /加点|属性|天赋|进阶|专长|build|流派|配装|技能槽|技能点|车卡|创建角色|角色/,
  rule: /规则|检定|AC|护甲|防御|伤害|负重|状态|豁免|命中|暴击/,
  world: /世界|王国|首都|北境|南境|西境|东境|城市|神|历史|地理|地图|大陆|位面/,
  entity: /种族|背景|装备|物品|道具/,
};

const CLASS_NAMES = /战士|法师|牧师|猎人|圣骑士|游荡者|德鲁伊|武僧|吟游诗人|术士|萨满祭司|蛮斗士|魔契师|奇械师/;
const CONNECTORS = /还有|另外|顺便|同时|以及|加上|再问|又问|既想.*又想|既要.*又要|想问.*又/;
const CONFLICT_CONN = /但|但是|可是|然而|却|又想|又不想|既要|又要|不想.*又想|又想.*不想/;

const CONFLICT_PAIRS = [
  [/输出|伤害|爆发|攻击|高伤/, /肉|抗挽|生存|坦|承伤|血厚|防御|脆/],
  [/简单|省心|不费脑|轻松|无脑|不用动脑/, /复杂|操作|连招|机制|动脑|研究|花心思/],
  [/近战|贴脸|战士|蛮斗士/, /法术|法系|远程|施法|魔法|法师|术士/],
  [/前期/, /后期/],
];

/**
 * @param {string} query
 * @returns {string|null} 'conflict' | 'multi' | null
 */
export function detectMultiIntent(query) {
  const q = String(query || '').trim();
  if (!q || q.length > 200) return null;

  // 0) 通用矛盾：“又想…又不想…”等明确否定对拗
  const WANT_NOT_WANT = /又想.*又不想|又不想.*又想|既想.*又不想|既要.*又不要/;
  if (WANT_NOT_WANT.test(q) && /法|魔|战|肉|简单|复杂|远程|近战|伤害|防御|职业|玩|技能|输出|存活/.test(q)) {
    return 'conflict';
  }

  // 1) 目标互相矛盾：同一对“既要 A 又要 B”且带转折/取舍连接词
  for (const [sideA, sideB] of CONFLICT_PAIRS) {
    if (sideA.test(q) && sideB.test(q) && CONFLICT_CONN.test(q)) {
      return 'conflict';
    }
  }

  // 2) 带“还有/另外/顺便/同时/以及”等连接词，且横跨至少两个领域 → 多意图
  if (CONNECTORS.test(q)) {
    const found = [];
    for (const [name, re] of Object.entries(DOMAINS)) {
      if (re.test(q)) found.push(name);
    }
    if (found.length >= 2) return 'multi';
  }

  // 3) 不同问句里出现多个不同职业名（同一句里的“还是/对比”不算）
  const segments = q.split(/[??]/).map((s) => s.trim()).filter(Boolean);
  if (segments.length >= 2) {
    const classes = [];
    for (const seg of segments) {
      const names = [];
      for (const m of seg.matchAll(new RegExp(CLASS_NAMES.source, 'g'))) {
        const name = m[0];
        if (!names.includes(name)) names.push(name);
      }
      classes.push(names);
    }
    const distinct = new Set(classes.flat());
    if (distinct.size >= 2 && classes.every((names) => names.length > 0)) {
      return 'multi';
    }
  }

  return null;
}
