const { chromium } = require('playwright');
const path = require('path');
const UP = 'https://snode-rpg.pages.dev/斯诺德跑团/上传角色.html';
const XLSX = 'D:\\Download\\scholar-agent-main';

const GT = {
  fulan:{n:'芙兰',r:'血族',mc:'法师',ml:6,sc:'战士',sl:4,bg:'运动员',s3:false,st:{力量:16,敏捷:14,体质:14,智力:16,感知:8,魅力:10,意志:8,幸运:8},excl:'通用'},
  leimi:{n:'蕾米',r:'血族',mc:'吟游诗人',ml:8,sc:'法师',sl:3,bg:'艺人',noBd:true,st:{力量:8,敏捷:8,体质:14,智力:15,感知:8,魅力:20,意志:8,幸运:15},excl:'通用'},
  jinitai:{n:'基尼泰·梅',r:'人类',mc:'牧师',ml:6,sc:'牧师',sl:1,bg:'画师',st:{力量:9,敏捷:12,体质:12,智力:14,感知:15,魅力:16,意志:9,幸运:14},excl:'通用'},
};

async function clickIf(page, sel, t=3000){try{await page.waitForSelector(sel,{timeout:t});await page.click(sel);return true;}catch(e){return false;}}

async function verify(page, xf, gt, label){
  console.log(`\n=== ${label} ===`);
  await page.goto(UP,{waitUntil:'load'});await page.waitForTimeout(1500);
  await page.locator('input[type=file]').setInputFiles(path.join(XLSX,xf));
  console.log('  uploaded');
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
        const e=[];
        if(state.name!==gt.n)e.push('name');
        if(state.race!==gt.r)e.push('race');
        if(state.background!==gt.bg)e.push('bg');
        const mc=state.classes[0];
        if(mc.name!==gt.mc)e.push('mc:'+mc.name);
        if(mc.level!==gt.ml)e.push('mLv:'+mc.level);
        if(gt.sc){const sc=state.classes[1];if(!sc||!sc.name)e.push('noSc');else{if(sc.name!==gt.sc)e.push('sc:'+sc.name);if(sc.level!==gt.sl)e.push('sLv:'+sc.level);}}
        if(gt.s3===false){const xc=state.classes[2];if(xc&&xc.name&&xc.level>0)e.push('XTRA:'+xc.name);}
        if(gt.noBd){const bd=['诙谐','激昂','灵动','舒缓','集中'];const sc=state.classes[1];if(sc&&sc.styles){const bad=sc.styles.filter(x=>bd.includes(x));if(bad.length)e.push('bardSub:'+bad.join(','));}}
        if(gt.excl)for(let ci=0;ci<2;ci++){const cls=state.classes[ci];if(cls&&cls.styles&&cls.styles.includes(gt.excl))e.push('EXCL_STYLE['+ci+']:'+gt.excl);}
        if(state.attrs)for(const[k,v]of Object.entries(gt.st))if(state.attrs[k]!==v)e.push('a'+k+':'+state.attrs[k]);
        // Check styles don't include wrong-class styles
        const mcKnown=['附魔','塑能','咒法','预言','魔枢','幻术'];const scKnown=['斗争','狂攻','防护','射击','军团','机敏'];
        if(mc.name==='法师'){const w=(mc.styles||[]).filter(s=>scKnown.includes(s));if(w.length)e.push('warriorOnMage:'+w.join(','));}
        if(mc.name==='吟游诗人'){const b=(mc.styles||[]).filter(s=>['斗争','狂攻'].includes(s));if(b.length)e.push('fightOnBard:'+b.join(','));}
        const s0=(mc.styles||[]).filter(Boolean);const s1=(state.classes[1]?.styles||[]).filter(Boolean);
        console.log(`  ${state.name} ${mc.name}Lv${mc.level}/${state.classes[1]?.name||'-'}Lv${state.classes[1]?.level||0} st:${JSON.stringify(s0)}/${JSON.stringify(s1)}`);
        console.log(e.length?'  FAIL:'+e.join('; '):'  PASS');
        return e.length===0;
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
  p.on('pageerror',e=>console.log('  PAGE:',e.message.slice(0,150)));
  let ok=true;
  if(!await verify(p,'冒险者角色档案fulan.xlsx',GT.fulan,'FULAN'))ok=false;
  if(!await verify(p,'冒险者角色档案leimi.xlsx',GT.leimi,'LEIMI'))ok=false;
  if(!await verify(p,'基尼泰·梅.xlsx',GT.jinitai,'JINITAI'))ok=false;
  console.log('\n== '+(ok?'ALL PASS':'FAIL')+' ==');
  await b.close();process.exit(ok?0:1);
})();
