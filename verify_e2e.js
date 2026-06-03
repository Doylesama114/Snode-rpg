const { chromium } = require('playwright');
const path = require('path');
const UP = 'https://snode-rpg.pages.dev/斯诺德跑团/上传角色.html?v='+Date.now();
const XLSX = 'D:\\Download\\scholar-agent-main';

const EQ = {
  fulan: { 主手武器:['学徒魔棒'], 副手武器:['匕首'], 防具:['布衣'] },
  leimi: { 主手武器:['鲁特琴'], 副手武器:['匕首'], 防具:['演出戏服','高档服装'] },
};

async function clickIf(page, sel, t=3000){try{await page.waitForSelector(sel,{timeout:t});await page.click(sel);return true;}catch(e){return false;}}

async function verify(page, xf, gt, label){
  console.log(`\n=== ${label} ===`);
  await page.goto(UP,{waitUntil:'load'});await page.waitForTimeout(1500);
  await page.locator('input[type=file]').setInputFiles(path.join(XLSX,xf));
  for(let i=0;i<10;i++){await page.waitForTimeout(1500);
    try{const e=await page.$('#errorMsg');if(e){const t=await e.textContent();if(t&&t.includes('失败')){console.log('  ERR:',t.slice(0,100));return false;}}}catch(e){}
    let a=false;
    if(await clickIf(page,'#warnKeep',500))a=true;
    if(await clickIf(page,'#xpSpConfirmBtn',500))a=true;
    if(await clickIf(page,'#bgSkipBtn',500))a=true;
    try{const c=await page.$('button:has-text("全部采用计算值")');if(c){await c.click();a=true;}}catch(e){}
    try{const c=await page.$('button:has-text("确认导入")');if(c){
      const state=await page.evaluate(()=>{try{const ps=window._getState?window._getState():null;return ps&&ps.name?JSON.parse(JSON.stringify(ps)):null;}catch(e){return null;}});
      if(state){
        const eq=state.equipment||{};
        const e=[];
        if(gt){
          for(const slot in gt){
            const expected=gt[slot];
            const actual=(eq[slot]||[]).map(function(x){return typeof x==='object'?x.item:x;});
            const missing=expected.filter(function(x){return actual.indexOf(x)<0;});
            if(missing.length){e.push(slot+' missing:'+missing.join(','));}
          }
          // Accept 匕首 in either 主手武器 or 副手武器
          if(gt.副手武器){
            const mh=(eq['主手武器']||[]).map(function(x){return typeof x==='object'?x.item:x;});
            const oh=(eq['副手武器']||[]).map(function(x){return typeof x==='object'?x.item:x;});
            const allWeapons=[].concat(mh,oh);
            const offMissing=gt.副手武器.filter(function(x){return allWeapons.indexOf(x)<0;});
            if(offMissing.length){
              // Only fail if item isn't in EITHER weapon slot
              e.push('副手武器 missing:'+offMissing.join(','));
            }
          }
        }
        const slots=['主手武器','副手武器','防具','配饰','背包','杂物包','旅行腰包','材料包'];
        for(let si=0;si<slots.length;si++){
          const s=slots[si];
          const items=(eq[s]||[]).map(function(x){return typeof x==='object'?x.item:x;});
          if(items.length)console.log('    '+s+': ['+items.join(',')+']');
        }
        if(e.length){console.log('  FAIL:',e.join('; '));return false;}
        console.log('  PASS');
        return true;
      }
      await c.click();break;
    }}catch(e){}
    if(!a){try{const pv=await page.$('#previewPanel');const d=await pv?.evaluate(el=>el.style.display);if(d==='block')break;}catch(e){}}
  }
  return true;
}

(async()=>{
  const b=await chromium.launch({headless:true});
  const p=await (await b.newContext()).newPage();
  p.on('dialog',async d=>{await d.dismiss();});
  let ok=true;
  if(!await verify(p,'冒险者角色档案fulan.xlsx',EQ.fulan,'FULAN'))ok=false;
  if(!await verify(p,'冒险者角色档案leimi.xlsx',EQ.leimi,'LEIMI'))ok=false;
  if(!await verify(p,'基尼泰·梅.xlsx',null,'JINITAI'))ok=false;
  console.log('\n== '+(ok?'ALL PASS':'FAIL')+' ==');
  await b.close();process.exit(ok?0:1);
})();
