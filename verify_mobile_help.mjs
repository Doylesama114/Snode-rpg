import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import desktop from './scripts/desktop_test_helpers.cjs';
const root=process.cwd(), out=path.join(root,'screenshots');
const rootArg=process.argv.indexOf('--root');
const contentRoot=rootArg>=0?path.resolve(root,process.argv[rootArg+1]):root;
fs.mkdirSync(out,{recursive:true});
let pass=0,fail=0;
function ok(name,condition,extra='') {
  if(condition){pass++;console.log('PASS '+name);}
  else{fail++;console.error('FAIL '+name+' '+extra);}
}
const url=pathToFileURL(path.join(contentRoot,'斯诺德跑团/help.html')).href;
const rectScript=()=> {
 const pane=document.querySelector('#help-pane-world'),toc=pane.querySelector('.toc-sidebar'),content=pane.querySelector('.help-content');
 const r=e=>{const q=e.getBoundingClientRect();return {x:q.x,y:q.y,w:q.width,h:q.height,bottom:q.bottom};};
 const links=[...toc.querySelectorAll('a[href^="#w-"]')],ids=links.map(a=>decodeURIComponent(a.hash.slice(1)));
 const first=content.querySelector('.p');
 return {width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,toc:r(toc),content:r(content),first:r(first),
  unique:ids.length===new Set(ids).size,allTargets:ids.every(id=>document.getElementById(id)),
  chapters:content.querySelectorAll('.section[id]').length,mainLinks:toc.querySelectorAll('.toc > a').length,
  tocScroll:toc.querySelector('.toc').scrollWidth>toc.querySelector('.toc').clientWidth,
  count:links.length,groups:toc.querySelectorAll('.toc-sub').length};
};
async function worldChecks(p,width,mode) {
 await p.waitForTimeout(1200);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.locator('[data-view="world"]').click();
 await p.waitForTimeout(250);
 const st=await p.evaluate(rectScript),prefix=mode+' '+width;
 ok(prefix+' world view exclusively visible',await p.locator('#help-pane-world').isVisible() && !await p.locator('#help-pane-rules').isVisible());
 ok(prefix+' no horizontal page overflow',st.overflow<=1,JSON.stringify(st));
 ok(prefix+' all chapters/targets kept without duplicate child links',st.unique&&st.allTargets&&st.mainLinks===st.chapters,JSON.stringify(st));
 if(width<=860){
  ok(prefix+' world TOC height below 110px',st.toc.h<=110,JSON.stringify(st));
  ok(prefix+' text has usable width and starts below compact TOC',st.content.w>=width*0.8&&st.content.y>=st.toc.bottom-1&&st.first.y<760,JSON.stringify(st));
  ok(prefix+' all navigation links can scroll horizontally',st.tocScroll);
 } else ok(prefix+' desktop keeps side navigation and wide text',st.content.x>st.toc.x+st.toc.w&&st.content.w>600,JSON.stringify(st));
 const count=st.count;await p.waitForTimeout(650);
 ok(prefix+' delayed initialization does not grow TOC', (await p.evaluate(rectScript)).count===count);
 const sub=p.locator('#help-pane-world .toc-sub a').first();
 const id=await sub.getAttribute('href');await sub.scrollIntoViewIfNeeded();await sub.click();
 await p.waitForTimeout(900);
 const jump=await p.evaluate(hash=>{
  const el=document.getElementById(decodeURIComponent(hash.slice(1))),toc=document.querySelector('#help-pane-world .toc-sidebar');
  const r=el.getBoundingClientRect(),t=toc.getBoundingClientRect();
  const x=Math.max(4,Math.min(innerWidth-4,r.left+r.width/2)),y=Math.max(4,Math.min(innerHeight-4,r.top+12));
  const hit=document.elementFromPoint(x,y);
  return {top:r.top,tocBottom:t.bottom,visible:!!hit&&(el.contains(hit)||el===hit),hash:decodeURIComponent(location.hash),
   active:document.querySelector('#help-pane-world .toc a.toc-active')?.getAttribute('href')};
 },id);
 ok(prefix+' child chapter jump reveals the heading',jump.visible&&jump.top>=0&&jump.top<300,JSON.stringify(jump));
 if(width<=640)ok(prefix+' sticky TOC does not cover target heading',jump.top>=jump.tocBottom-2,JSON.stringify(jump));
 await p.screenshot({path:path.join(out,'help8043-'+mode+'-'+width+'.png')});
 await p.locator('[data-view="rules"]').click();
 ok(prefix+' switching back reveals rules and hides world',await p.locator('#help-pane-rules').isVisible()&&!await p.locator('#help-pane-world').isVisible());
 ok(prefix+' no renderer errors',errors.length===0,errors.join(';'));
}
let browser;
try {
 browser=await chromium.launch({headless:true});
 if(!process.argv.includes('--electron-only')){
 const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await p.goto(url,{waitUntil:'load'});await p.waitForTimeout(1200);
 const st=await p.evaluate(()=>{
  const toc=document.querySelector('#help-pane-rules .toc-sidebar'),content=document.querySelector('#help-pane-rules .help-content'),link=toc.querySelector('a'),nav=toc.querySelector('.toc');
  return {position:getComputedStyle(toc).position,top:content.getBoundingClientRect().top,font:getComputedStyle(content).fontSize,height:link.getBoundingClientRect().height,scroll:nav.scrollWidth>nav.clientWidth};
 });
 ok('rules sticky navigation and readable text retained',st.position==='sticky'&&st.top<700&&parseFloat(st.font)>=16&&st.height>=32&&st.scroll,JSON.stringify(st));
 await p.locator('#help-pane-rules .toc a').nth(4).evaluate(a=>a.click());
 await p.waitForTimeout(900);ok('rules anchor jump/highlight retained',await p.evaluate(()=>scrollY>300&&!!document.querySelector('#help-pane-rules .toc a.toc-active')));
 await p.close();
 for(const width of [360,390,640,768,1440]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:width<=768,hasTouch:width<=768});
  await page.goto(url,{waitUntil:'load'});await worldChecks(page,width,'browser');await page.close();
 }
 const deep=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
 await deep.goto(url+'?view=world',{waitUntil:'load'});await deep.waitForTimeout(1200);
 ok('direct world link has compact navigation and visible content',(await deep.evaluate(rectScript)).toc.h<110&&await deep.locator('#help-pane-world').isVisible());
 const contrast=()=>{
  const paragraph=document.querySelector('#help-pane-world .section .p'),card=paragraph.closest('.section');
  const rgb=s=>(s.match(/[0-9.]+/g)||[]).slice(0,3).map(Number);
  const luminance=c=>c.map(v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);}).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
  const fg=luminance(rgb(getComputedStyle(paragraph).color)),style=getComputedStyle(card);
  const stops=style.backgroundImage.match(/rgba?\([^)]+\)/g)||[style.backgroundColor];
  return Math.min(...stops.map(s=>{const bg=luminance(rgb(s));return (Math.max(fg,bg)+0.05)/(Math.min(fg,bg)+0.05);}));
 };
 for(const system of ['light','dark']){
  await deep.emulateMedia({colorScheme:system});
  for(const appTheme of ['light','dark']){
   await deep.evaluate(theme=>document.documentElement.classList.toggle('dark',theme==='dark'),appTheme);
   const ratio=await deep.evaluate(contrast);
   ok('world text contrast in OS '+system+' / app '+appTheme,ratio>=4.5,String(ratio));
  }
 }
 await deep.evaluate(()=>document.documentElement.classList.remove('dark'));
 await deep.screenshot({path:path.join(out,'help8043-dark.png')});await deep.close();
 }
 if(process.argv.includes('--electron')||process.argv.includes('--electron-only')){
  const t=await desktop.launch();
  try {
   for(const width of [360,390,1440]){
    await t.app.evaluate(({BrowserWindow},width)=>{const win=BrowserWindow.getAllWindows()[0];win.setMinimumSize(1,1);win.webContents.setBackgroundThrottling(false);win.setContentSize(width,844);},width);
    await desktop.navigate(t.app,'斯诺德跑团/help.html');
    await desktop.waitFor(t.app,()=>desktop.js(t.app,'!!document.getElementById("help-pane-world")'));
    const page=await t.app.firstWindow();
    await page.evaluate(()=>{
      // Hidden Electron windows do not advance compositor scroll animations.
      // Exercise the same click handler and target geometry with instant scrolling.
      {
        const scroll=Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView=function(options){
          return scroll.call(this,typeof options==='object'?{...options,behavior:'instant'}:options);
        };
        document.documentElement.style.scrollBehavior='auto';
      }
    });
    await worldChecks(page,width,'electron');
   }
  } finally {await t.close();}
 }
} finally {if(browser)await browser.close();}
console.log('Help mobile/world checks: '+pass+'P '+fail+'F');
process.exitCode=fail?1:0;
