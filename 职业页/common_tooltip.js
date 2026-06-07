// common_tooltip.js — 异常状态 / 关键词 hover tooltip
// 引用此文件后，页面中匹配的文本会自动获得 tooltip 效果
// 桌面端: hover 显示；移动端: 长按(0.5s)显示 tooltip，短按仍触发关键词筛选

var RULE_TOOLTIPS = {
  // === 持续状态 ===
  "灼烧": "每个轮次开始时受到1D4火焰伤害。可花费附赠动作扑灭(敏15)。可叠加。长休前未移除→重伤-恶性创伤。",
  "中毒": "掷D3定层数，每轮受到层数剧毒伤害，再掷D3获得额外层数。可叠加。长休前未移除→死亡裁定。",
  "流血": "掷D3定层数，每轮失去层数生命值，再掷D3获得额外层数。可叠加。长休前未移除→死亡裁定。",
  "霜冻": "承受一定层数后进入冻结状态。通常来源于NPC单位或环境影响。",
  "感染": "承受一定层数后，根据最大生命值的百分比损失生命值。通常来源于NPC单位或环境影响。",

  // === 限制状态 ===
  "减速": "位移步数减半(向下取整)，其他角色对目标攻击命中具有优势。",
  "禁锢": "无法执行位移(含带有位移或空中关键词的能力)。其他角色攻击命中具有优势。",
  "致盲": "无法通过视觉获取信息，无法使用指向性能力。其他角色攻击命中优势。位移时需掷D4决定方向。",
  "耳鸣": "无法通过听觉获取信息，无法聆听检定，察觉检定劣势。但命令术等通过听觉触发的能力无法对目标生效。",
  "沉默": "无法通过语言交流，无法施展需要语言来生效的能力。",
  "麻痹": "位移步数减半，攻击命中优势，无法响应反应动作。",
  "困惑": "无法借机攻击，下个自身回合第一个行动必定失败。",
  "压制": "来源不移动则目标也无法移动(含位移/空中)。目标对来源攻击劣势。目标可花附赠进行力量/敏捷对抗解除。",
  "击倒": "需花附赠站起，否则无法移动(含位移)。攻击命中劣势，其他角色对其攻击优势。",
  "击退": "向后方倒飞一段距离，不触发借机攻击。",
  "魅惑": "跳过下个自身回合，改为朝来源进行一次基础移动。期间无法执行反应动作。受伤害或刺激后解除。",
  "恐惧": "掷D6决定效果：D1=漫无目的逃窜，D2-5=朝反方向逃跑，D6=原地跳过回合。受伤害或刺激后解除。",
  "混乱": "掷D6决定效果：D1=攻击最近角色，D2-5=迷茫跳过回合，D6=攻击最近友方。受伤害或刺激后解除。",
  "忏悔": "陷入自责，对外界熟视无睹。受伤害或刺激后解除。",
  "昏睡": "陷入沉睡，对外界熟视无睹。每轮开始时进行难度15-X的体质豁免(X=体质调整值)。受伤害或刺激后解除。",
  "醉酒": "近战攻击命中19即暴击；攻击失败则自身击倒；大失败必定攻击己方。",
  "缴械": "无法使用持有的物件发起攻击或使用物件的特殊效果。",

  // === 失能状态 ===
  "瘫痪": "跳过下个自身回合，持续时间内无法执行任何动作。受伤害或刺激后解除。",
  "震撼": "跳过下个自身回合，持续时间内无法执行任何动作。受暴击伤害或刺激后解除。",
  "冻结": "跳过下个自身回合，持续时间内无法执行任何动作。冻结会移除全部灼烧，受火焰伤害时解除。",
  "眩晕": "跳过下个自身回合，持续时间内无法执行任何动作。自身回合开始时需进行难度15意志豁免，豁免失败再次跳过(仅触发一次)。",
  "击晕": "等同于眩晕状态，但持续时间仅为1轮。",

  // === 创伤状态 ===
  "重伤": "永久性负面状态，大多数无法通过回复手段或解除异常状态的能力消除。",
  "恶性创伤": "生命回复减半，力/敏/体检定豁免对抗劣势。回复X点生命后移除(X=最大生命值)，最大生命值永久-1D4。",
  "脑部创伤": "疲劳回复减半，无法专注，智/感检定豁免对抗劣势。回复X点疲劳后移除(X=最大疲劳值)，最大疲劳值永久-1。",
  "耳聋": "始终处于耳鸣状态，察觉检定劣势，警惕值-2。",
  "目盲": "始终处于致盲状态，需视觉的检定(洞悉/察觉/攻击命中)劣势，警惕值-5。",
  "失语": "始终处于沉默状态。",
  "手部断肢": "需要手部完成的行动具有劣势。",
  "腿部断肢": "需要腿部完成的行动具有劣势，基础移动速度减半(向下取整)，其他角色对其攻击命中优势。",
  "疯狂": "承受某种心理疾病的持续影响，可能导致无法控制自身行为、夸张举止甚至攻击队友。",

  // === 关键词规则(精简) ===
  "战技": "纯粹的武艺所带来的战斗技巧。",
  "法术": "通过神奇的魔法衍化的术式。",
  "戏法": "虽不如法术精妙，但同样变化万千。",
  "神术": "来自于神祇等伟大存在的恩赐。",
  "异能": "源自内心、本质与超维时空而诞生的神奇力量。",
  "功法": "修行者所施展的术法。",
  "绝学": "通过心灵力量和感悟所淬炼的精华，是功法更深层次的奥义。",
  "科技": "思维与逻辑的碰撞而创造的工艺。带有这类关键词的效果不会触发关键属性。",
  "AOE": "对一定范围内生效的攻击手段，默认由目标进行难度15敏捷豁免，闪避成功仍受一半伤害。",
  "光环": "以自身为中心持续生效的效果，每名角色通常仅能同时维持一个光环。",
  "专注": "必须花费注意力来维持的精密效果，进入惑控或失能状态，或执行另一专注效果时中断先前的专注。",
  "引导": "必须通过多个动作来维持的效果，进行移动或执行其他动作时立即中断。",
  "速攻": "优先级高于反应动作和其他行动，在结算速攻效果后再结算其他角色施展的效果。",
  "迅捷": "不会触发借机攻击的效果。",
  "位移": "在具有移动轨迹的情况下进行一段距离上的变化。",
  "跃迁": "在没有移动轨迹的情况下进行一段距离上的变迁。",
  "增益": "提供正面增幅效果的能力，包括强化属性、获得额外行动及提升伤害等。",
  "回复": "回复生命值或疲劳值的效果。",
  "护盾": "生成能够抵挡伤害的效果，护盾数值不同于临时生命值。",
  "防御": "能够抵挡或减免伤害数值的效果。",
  "净化": "移除角色当前承受的负面状态的效果。",
  "诅咒": "对角色持续造成负面影响的效果，通常来源于巫毒、邪神诅咒和黑魔法。",
  "穿甲": "破坏角色防御等级、护盾或护甲值等能力的效果。",
  "超杀": "单次造成超过目标最大生命值的伤害值效果。",
  "惑控": "能够使目标短暂失去角色控制权的效果。",
  "幻象": "产生并非真实存在的效果。",
  "变形": "使目标的性质发生变化。",
  "充能": "拥有使用次数的特殊效果，每次使用消耗对应充能，全部消耗后失去效果。",
  "处决技": "如果这次攻击的理论最大伤害值能击杀目标，忽略对方的反制手段直接消灭目标。",
  "终结技": "强大的连击技能，攻击目标必须花费两个需要反应动作的能力抵消其中一个才能使另一个生效。",
  "唯一性": "同一名角色仅能维持一个效果；多名角色同名效果对单一目标仅会生效一次。",
  "无加成": "这个效果不会受到关键属性的影响，也不会附加其他增益效果。",
  "壁垒": "获得临时防御值，优先于生命值承受伤害。",
  "摧残": "使目标获得永久性Debuff，持续至被净化为止。",
};

// === Application logic ===
(function(){
  if(window._tooltipApplied)return;
  window._tooltipApplied=true;

  // Scan all text nodes in the page body and wrap matched keywords
  function applyTooltips(root){
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null,false);
    var texts=[];
    while(walker.nextNode())texts.push(walker.currentNode);
    for(var i=0;i<texts.length;i++){
      var node=texts[i];
      var parent=node.parentNode;
      // Skip already processed, script, style, and existing tooltip spans
      if(!parent||parent.nodeName==='SCRIPT'||parent.nodeName==='STYLE')continue;
      if(parent.classList&&parent.classList.contains('tt'))continue;
      // Skip chip elements (they have click handlers for filtering)
      if(parent.classList&&parent.classList.contains('chip'))continue;

      var text=node.nodeValue;
      var replaced=false;
      for(var key in RULE_TOOLTIPS){
        if(text.indexOf(key)>=0){
          // Only replace if not inside a chip (chips handle it separately)
          var span='<span class="tt" data-tt="'+RULE_TOOLTIPS[key].replace(/"/g,'&quot;')+'">'+key+'</span>';
          text=text.split(key).join(span);
          replaced=true;
        }
      }
      if(replaced){
        var wrapper=document.createElement('span');
        wrapper.innerHTML=text;
        parent.replaceChild(wrapper,node);
      }
    }

    // For .chip elements: add tooltip on hover/longpress without break click
    var chips=root.querySelectorAll('.chips .chip');
    for(var i=0;i<chips.length;i++){
      var chip=chips[i];
      var kw=chip.textContent.trim();
      if(RULE_TOOLTIPS[kw]){
        chip.setAttribute('data-tt',RULE_TOOLTIPS[kw]);
        chip.classList.add('tt');
        // Mobile long-press
        chip.addEventListener('touchstart',function(e){
          var el=e.currentTarget;
          el._touchStart=Date.now();
        });
        chip.addEventListener('touchend',function(e){
          var el=e.currentTarget;
          if(el._touchStart&&Date.now()-el._touchStart>500){
            e.preventDefault();
            e.stopPropagation();
            el.classList.add('tt-show');
            setTimeout(function(){el.classList.remove('tt-show');},3000);
          }
        });
      }
    }
  }

  if(document.readyState==='complete')applyTooltips(document.body);
  else window.addEventListener('load',function(){applyTooltips(document.body);});
})();
