const { chromium } = require('playwright');
const path = require('path');
const UP = `file:///${'D:\\Download\\scholar-agent-main\\斯诺德跑团'.replace(/\\/g, '/')}/上传角色.html`;

const GT = {
  fulan:{name:'芙兰',race:'血族',mc:'法师',ml:6,sc:'战士',sl:4,bg:'运动员',xp:700,st:{力量:16,敏捷:14,体质:14,智力:16,感知:8,魅力:10,意志:8,幸运:8},sk:['魔法武器','法术护盾','大师之手','闪现术','敲击术','迟缓术','石锥术','锐化武器','火焰箭','火球术','次级幻影','镜像','炎爆术','猛击','冲锋','顺劈斩','急速冲锋','二连斩'],tl:['重整旗鼓','负重前行','冥想','平常心','预知梦','勤俭持家','战斗心得','动作如潮'],noXtra:true,storyLong:true},
  leimi:{name:'蕾米',race:'血族',mc:'吟游诗人',ml:8,sc:'法师',sl:3,bg:'艺人',xp:300,hp:56,fp:20,st:{力量:8,敏捷:8,体质:14,智力:15,感知:8,魅力:20,意志:8,幸运:15},sk:['风之和弦','交友术','激励乐章','雷鸣和弦','快速拨弦','错拍干扰','振奋光环','净化间奏','音波刃','无律之音','惑人低语','轻快小调','不谐和音','士气如虹','闪现术','法术护盾','次级幻影','命令术'],tl:['我的舞台','先发制人','冥想','预知梦','休憩曲','踏歌前行','战斗心得','法术精通','救赎乐章'],noXtra:true,storyLong:true,noBardSub:true},
  jinitai:{name:'基尼泰·梅',race:'人类',mc:'牧师',ml:6,sc:'牧师',sl:1,bg:'画师',hp:29,fp:13,st:{力量:9,敏捷:12,体质:12,智力:14,感知:15,魅力:16,意志:9,幸运:14},sk:['绘彩术','治疗术','恢复术','缤纷调味','油腻术','迷幻手稿','幻境','七彩炫光','物件定位术','艺术之眼'],tl:['音画同调','冥想','闲暇时光','勤俭持家','奇械雏形','情绪调色','多才多艺','画家工具大师','阶段性调整'],noXtra:true,storyLong:true},
};

function dump(s) {
  return {
    name:s.name,race:s.race,bg:s.background,xp:s.xp,hp:s.hp,fp:s.fp,
    cls:s.classes.map(function(c){return{name:c.name,level:c.level,styles:(c.styles||[]).filter(Boolean)};}),
    attrs:s.attrs,story:s.story||'',
    skills:(s.skills||[]).map(function(sk){return sk.n||sk.name||'';}).filter(Boolean),
    tl:(s.talent_tree||[]).map(function(t){return{n:t.n||t.name||'',tier:t.tier||''};}),
  };
}

async function go(page, xf, gt) {
  console.log(`\n=== ${xf} ===`);

  await page.locator('#fileInput').setInputFiles(path.join('D:\\Download\\scholar-agent-main', xf));
  await page.waitForTimeout(1200);
  try{await page.waitForSelector('#warnKeep',{timeout:2500});await page.click('#warnKeep');await page.waitForTimeout(500);}catch{}
  try{await page.waitForSelector('#xpInput',{timeout:3500});await page.click('#xpSpConfirmBtn');}catch{}
  await page.waitForTimeout(600);
  try{await page.waitForSelector('#bgSkipBtn',{timeout:2500});await page.click('#bgSkipBtn');}catch{}
  await page.waitForTimeout(600);
  try{var cb=await page.$('button:has-text("全部采用计算值")');if(cb){await cb.click();await page.waitForTimeout(400);}}catch{}

  // Capture state BEFORE confirm (confirmImport redirects)
  var raw=await page.evaluate(function(){
    var ps=window._getState?window._getState():null;
    if(ps&&ps.name)return JSON.parse(JSON.stringify(ps));
    return null;
  });

  try{await page.waitForSelector('button:has-text("确认导入")',{timeout:2500});await page.click('button:has-text("确认导入")');}catch{}
  await page.waitForTimeout(1500);

  // Fallback: read from localStorage
  if(!raw){raw=await page.evaluate(function(){
    var kk=[];for(var i=0;i<localStorage.length;i++)kk.push(localStorage.key(i));
    for(var j=0;j<kk.length;j++){var k=kk[j];if(k.indexOf('char_')===0)try{return JSON.parse(localStorage.getItem(k));}catch(e){}}
    return null;
  });}
  if(!raw){console.log('  FAIL: no state');return false;}
  var s=dump(raw);
  if(!s.name){console.log('  FAIL: no name');return false;}

  var e=[];
  if(s.name!==gt.name)e.push('name');
  if(s.race!==gt.race)e.push('race');
  if(s.bg!==gt.bg)e.push('bg');
  var mc=s.cls[0];if(mc){if(mc.name!==gt.mc)e.push('mc:'+mc.name);if(mc.level!==gt.ml)e.push('mLv:'+mc.level);}else e.push('noMc');
  if(gt.sc){var sc=s.cls[1];if(sc&&sc.name){if(sc.name!==gt.sc)e.push('sc:'+sc.name);if(sc.level!==gt.sl)e.push('sLv:'+sc.level);}else e.push('noSc');}
  if(gt.xp&&s.xp!==gt.xp)e.push('xp:'+s.xp);
  if(gt.noXtra){var xc=s.cls[2];if(xc&&xc.name&&xc.level>0)e.push('XTRA:'+xc.name+'Lv'+xc.level);}
  if(gt.storyLong&&s.story){if(s.story==='背景故事'||s.story==='故事'||s.story.length<10)e.push('storyBad:'+(s.story||'').slice(0,20));}
  var et=s.tl.filter(function(t){return!t.tier;});
  if(s.tl.length>0&&et.length===s.tl.length)e.push('noTiers:'+s.tl.length);
  if(gt.noBardSub){var sc2=s.cls[1];if(sc2&&sc2.styles){var bad=sc2.styles.filter(function(st){return['诙谐','激昂','灵动','舒缓','集中'].indexOf(st)>=0;});if(bad.length>0)e.push('bardSub:'+bad.join(','));}}
  if(s.attrs)for(var k in gt.st)if(s.attrs[k]!==gt.st[k])e.push('a'+k+':'+s.attrs[k]);
  var ms=gt.sk.filter(function(sk){return s.skills.indexOf(sk)<0;});if(ms.length)e.push('msSk:'+ms.slice(0,2));
  var mt=gt.tl.filter(function(t){return s.tl.map(function(x){return x.n;}).indexOf(t)<0;});if(mt.length)e.push('msTl:'+mt.slice(0,2));

  var p=e.length===0;
  console.log(p?'  PASS '+mc.name+'Lv'+mc.level+'/'+(s.cls[1]?s.cls[1].name:'-')+'Lv'+(s.cls[1]?s.cls[1].level:'-')+' sk:'+s.skills.length+' tl:'+s.tl.length+' hp:'+s.hp+' fp:'+s.fp+' st:'+(s.story||'').slice(0,25):'  FAIL('+e.length+'):'+e.join(';'));
  if(!p)console.log('  state:',JSON.stringify({cls:s.cls,story:(s.story||'').slice(0,60),tlTiers:et.slice(0,3).map(function(t){return t.tier;}).join(','),xl:s.skills.length,tlN:s.tl.length}));
  return p;
}

(async()=>{
  var b=await chromium.launch({headless:true});var ok=true;
  var tests=[{f:'冒险者角色档案fulan.xlsx',g:GT.fulan},{f:'冒险者角色档案leimi.xlsx',g:GT.leimi},{f:'基尼泰·梅.xlsx',g:GT.jinitai}];
  for(var i=0;i<tests.length;i++){var t=tests[i];var c=await b.newContext();var p=await c.newPage();p.on('dialog',async function(d){await d.dismiss();});await p.goto(UP,{waitUntil:'load'});await p.waitForTimeout(500);if(!await go(p,t.f,t.g))ok=false;await c.close();}
  console.log('\n== '+(ok?'ALL PASS':'SOME FAIL')+' ==');
  await b.close();process.exit(ok?0:1);
})();
