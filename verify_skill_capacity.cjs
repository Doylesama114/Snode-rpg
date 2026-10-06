'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const {chromium}=require('playwright'),desktop=require('./scripts/desktop_test_helpers.cjs');
let count=0;function pass(n){count++;console.log('PASS '+n);}
const root=process.argv.includes('--root')?path.resolve(process.argv[process.argv.indexOf('--root')+1]):__dirname;
async function checkPage(p) {
 await p.evaluate(()=>{
  Object.assign(state,JSON.parse(JSON.stringify(STATE_DEFAULTS)));
  state.classes=[{name:'法师',level:6,styles:['','','','']},{name:'',level:0,styles:['','','','']},{name:'',level:0,styles:['','','','']}];
  state.skills=[];state.talent_tree=[];state.sp_points=100;state.color_marks={};
  MARK_COLOR_NAMES.forEach(n=>state.color_marks[n]=true);state.unlocked_tiers=['一阶','二阶','三阶'];
  window.__slotMsgs=[];SB_toast=m=>__slotMsgs.push(m);
 });
 assert.equal(await p.evaluate(()=>calcSkillSlots(0)),20);pass('sixth-level mage retains the correct 20-slot capacity');
 const g=await p.evaluate(()=>{
  state.talent_tree=[{n:'威力惊人',src:'通用',uid:'duplicate-one',tier:'一阶'},{n:'威力惊人',src:'通用',uid:'duplicate-two',tier:'一阶'}];
  return getChoiceGroupStatus(CHOICE_GROUPS.find(g=>g.marker==='抉择B'),'通用');
 });
 assert.equal(g.count,1);assert.equal(g.full,false);
 await p.evaluate(()=>{if(!document.getElementById('learnPanel').classList.contains('show'))toggleLearnMode();renderLearnPanel();expandAllGroups();});
 let button=p.locator('#learnResults button').filter({hasText:'学习'});
 const candidate=p.locator('#learnResults button[onclick*="learnSkill"][onclick*="负重前行"]');
 assert.equal(await candidate.count(),1);await candidate.click();
 assert.equal(await p.evaluate(()=>getChoiceGroupStatus(CHOICE_GROUPS.find(g=>g.marker==='抉择B'),'通用').count),2);
 assert.equal(await p.evaluate(()=>state.talent_tree.filter(t=>t.uid==='duplicate-one'||t.uid==='duplicate-two').length),2);
 pass('duplicate records do not fill a choice group; actual UI learning succeeds and preserves both UIDs');
 assert.equal(await p.locator('#learnResults button[onclick*="learnSkill"][onclick*="纵身一跃"]').count(),0);
 assert(await p.evaluate(()=>document.getElementById('learnResults').textContent.includes('本抉择组选项已满')));
 pass('a genuinely full choice group remains locked with a precise reason');
 const foreign=await p.evaluate(()=>{
  state.talent_tree=[{n:'威力惊人',src:'法师',uid:'foreign'},{n:'负重前行',src:'通用',uid:'custom',resolution:'custom'}];
  return getChoiceGroupStatus(CHOICE_GROUPS.find(g=>g.marker==='抉择B'),'通用').count;
 });assert.equal(foreign,0);
 await p.evaluate(()=>{renderLearnResults();});
 assert.equal(await p.locator('#learnResults button[onclick*="learnSkill"][onclick*="威力惊人"]').count(),1);
 pass('same-name foreign/custom abilities do not consume common choice options or falsely mark them learned');
 const counts=await p.evaluate(()=>{
  state.skills=Array.from({length:19},(_,i)=>({n:'旧技能'+i,src:'法师',uid:'old-'+i,sub:'',locked:true}));
  state.skills.push({n:'',src:'法师',locked:true,uid:'empty-a'},{n:'   ',src:'法师',locked:true,uid:'empty-b'});
  state.skills.push({n:'免费戏法',src:'法师',occupies:false},{n:'附赠能力',src:'战士',ownerClassIndex:2,sub:'战士'});
  return {main:countOccupiedSkillSlots(0),sub:countOccupiedSkillSlots(1)};
 });assert.equal(counts.main,19);assert.equal(counts.sub,0);
 await p.evaluate(()=>learnSkill('法师','魔法飞弹',0));
 assert.equal(await p.evaluate(()=>countOccupiedSkillSlots(0)),20);
 assert.equal(await p.evaluate(()=>state.skills.filter(s=>s.uid&&s.uid.startsWith('old-')).length),19);
 assert.equal(await p.evaluate(()=>state.skills.find(s=>s.uid==='empty-a').n),'');
 pass('empty legacy rows, free abilities and attached professions do not block the last real slot');
 await p.evaluate(()=>{
  state.skills=Array.from({length:20},(_,i)=>({n:'已学'+i,src:'法师',sub:'',locked:false,uid:'full-'+i}));
  learnSkill('法师','魔法飞弹',0);
 });assert(await p.locator('#modalOverlay').isVisible());
 assert.equal(await p.evaluate(()=>countOccupiedSkillSlots(0)),20);
 await p.evaluate(()=>closeReplaceModal());pass('genuine 20-slot fullness opens replacement and does not overflow');
 const locks=await p.evaluate(()=>({a:isRuleLockedAbility(SKILL_DATA.法师.find(x=>x.name==='防护法阵')),
  b:isRuleLockedAbility(SKILL_DATA.法师.find(x=>x.name==='奥术轰炸')),
  c:isRuleLockedAbility(SKILL_DATA.法师.find(x=>x.name==='命运抉择'))}));
 assert.equal(locks.a,false);assert.equal(locks.b,false);assert.equal(locks.c,true);pass('unrelated cannot/coverage text no longer creates permanent locks; real permanent rules stay locked');
 const zero=await p.evaluate(()=>{state.skills=[];state.classes[0].level=0;window.__slotMsgs=[];learnSkill('法师','魔法飞弹',0);return __slotMsgs;});
 assert(zero.some(m=>m.includes('职业名称和等级')));assert(!zero.some(m=>m.includes('所有技能均已锁定')));
 pass('zero/unknown capacity has an actionable message instead of a false all-locked claim');
 await p.evaluate(()=>{state.classes[0].level=6;render();});
 assert((await p.locator('#skillSlotNote').textContent()).includes('/ 20 栏'));pass('panel shows actual occupied count and capacity');
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:1000}});
  await p.goto(pathToFileURL(path.join(root,'斯诺德跑团/角色面板.html')).href,{waitUntil:'load'});
  await checkPage(p);
  if(process.argv.includes('--electron')){
   const native=await desktop.launch();
   try{await desktop.navigate(native.app,'斯诺德跑团/角色面板.html');await desktop.waitFor(native.app,()=>desktop.js(native.app,'typeof getChoiceGroupStatus==="function"'));await checkPage(await native.app.firstWindow());}
   finally{await native.close();}
  }
 }finally{await browser.close();}
 console.log('Skill capacity/choice limits: '+count+' groups passed');
})().catch(e=>{console.error(e);process.exitCode=1});
