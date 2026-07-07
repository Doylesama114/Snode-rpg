/**
 * Phase 4″ — 创建页陪跑：分步骤冒泡问法（服务端生成 query，避免客户端推销口径不一致）。
 */
import { buildChargenLedger } from './advisor-chargen-ledger.mjs';

function featNames(char) {
  const list = char?.selectedFeatures || [];
  return list.map((f) => (typeof f === 'string' ? f : (f?.n || f?.name || ''))).filter(Boolean);
}

/**
 * @param {{ step?: number, stepLabel?: string, char?: object }} snapshot
 */
export function buildChargenBubbleQuery(snapshot) {
  if (!snapshot) return '当前车卡步骤请给出陪跑建议。';
  const step = snapshot.step ?? 0;
  const label = snapshot.stepLabel || '';
  const char = snapshot.char || {};
  const ledger = buildChargenLedger(char, { step });
  const feats = featNames(char);
  const featMax = char.className === '法师' ? 4 : 2;

  const commonTail = '不要 Markdown。不要替用户指定未选项名称；不要「必拿/强烈建议选 XXX」。';

  if (step === 0) {
    return [
      `当前车卡步骤「${label}」。`,
      '规则：L1 法师同时获得奥法学者、知识传承、魔法学派三项专精能力（非三选一）；本步请为奥法学者、知识传承各选 1 子熟练；魔法学派 L1 已拥有，对立学派后续在角色面板配置。',
      '请根据已选专精子项说明 trade-off；若尚未选满，只提示待完成项，勿推销具体子项名称。',
      commonTail,
    ].join('');
  }

  if (step === 1) {
    if (feats.length >= featMax) {
      return [
        `当前车卡步骤「${label}」。用户已选满 ${featMax} 项起始特性：${feats.join('、')}。`,
        '请评价这套组合的整体风格、优点与缺口（缺位移/缺控/缺生存等）；不要推荐改选或推销其他未选特性。',
        '可结合上下文中的起始特性标签；2～3 点，共不超过120字。',
        commonTail,
      ].join('');
    }
    if (feats.length > 0) {
      return [
        `当前车卡步骤「${label}」。已选 ${feats.length}/${featMax}：${feats.join('、')}。`,
        '请简述已选项倾向；提示选满后可评价整体组合；禁止列出「还应选 XXX」的硬性清单。',
        commonTail,
      ].join('');
    }
    return [
      `当前车卡步骤「${label}」。尚未选择起始特性。`,
      '请说明本步规则（8 选 4）及选满后才会评价组合；不要预先推销具体特性名称。',
      commonTail,
    ].join('');
  }

  if (step === 2) {
    return [
      `当前车卡步骤「${label}」。`,
      '请结合【车卡熟练账本】中已有熟练与兼职 +6 进度，说明选种族时应优先补什么（属性/语言/不重复熟练）；不要固定推销某几个种族名，除非上下文实体卡与用户缺口强相关。',
      commonTail,
    ].join('');
  }

  if (step === 3) {
    return [
      `当前车卡步骤「${label}」。`,
      '请根据法师智力优先 15 的购点目标，结合已选种族加值给出 2～3 条分配思路；不要替用户填数字。',
      commonTail,
    ].join('');
  }

  if (step === 4) {
    const warn = ledger.overlapWarnings.length
      ? `优先在开头用 1 句说明重复熟练提醒：${ledger.overlapWarnings[0].message}`
      : '';
    return [
      `当前车卡步骤「${label}」。`,
      warn,
      '请结合账本中尚未覆盖的熟练方向给建议；若候选与已有熟练重叠，须说明合法但建议拓宽。',
      commonTail,
    ].join('');
  }

  if (step === 5) {
    return [
      `当前车卡步骤「${label}」。`,
      '请结合账本缺口与兼职 +6 进度推荐背景方向；若背景 grant 会与已有熟练重复，须提示 trade-off；不要机械列举固定背景清单。',
      commonTail,
    ].join('');
  }

  if (step === 6) {
    return [
      `当前车卡步骤「${label}」。`,
      '请结合已选 build 方向简评套装 A/B/C/D 取向；2～3 点。',
      commonTail,
    ].join('');
  }

  if (step === 7) {
    return [
      `当前车卡步骤「${label}」。`,
      '请对当前角色摘要做总评：风格、优点、后续升级可补方向；不要替用户改选。',
      commonTail,
    ].join('');
  }

  return [
    `当前车卡步骤「${label}」。`,
    '请根据已选内容与账本给出 2～3 条陪跑建议。',
    commonTail,
  ].join('');
}
