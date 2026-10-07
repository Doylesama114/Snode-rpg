import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import desktop from './scripts/desktop_test_helpers.cjs';
const root=process.cwd(), arg=process.argv.indexOf('--root');
const contentRoot=arg<0?root:path.resolve(root,process.argv[arg+1]);
const out=path.join(root,'screenshots');fs.mkdirSync(out,{recursive:true});
const url=pathToFileURL(path.join(contentRoot,'斯诺德跑团/help.html')).href;
let pass=0,fail=0;
function check(name,ok,detail=''){if(ok){pass++;console.log('PASS '+name);}else{fail++;console.error('FAIL '+name+' '+detail);}}
async function query(p,q,method='click'){
 await p.locator('#help-search-input').fill(q);
 if(method==='enter')await p.locator('#help-search-input').press('Enter');
 else if(method==='search')await p.locator('#help-search-input').evaluate(e=>e.dispatchEvent(new Event('search',{bubbles:true})));
 else await p.locator('#help-search-go').click();
 await p.waitForTimeout(650);
}
async function hit(p){return p.evaluate(()=>{
 const e=document.querySelector('.search-hit-current'),r=e?.getBoundingClientRect();
 const pane=e?.closest('.help-layout'),toc=pane?.querySelector('.toc-sidebar'),st=toc&&getComputedStyle(toc),tr=toc?.getBoundingClientRect();
 const mark=e?.querySelector('.search-highlight'),mr=mark?.getBoundingClientRect();
 const top=document.elementFromPoint(Math.min(innerWidth-3,Math.max(3,mr?.left+3||3)),Math.min(innerHeight-3,Math.max(3,mr?.top+3||3)));
 return {view:document.body.dataset.helpView,status:document.querySelector('#help-search-status').textContent,
  visible:!!e?.getClientRects().length,top:r?.top,marks:[...e?.querySelectorAll('.search-highlight')||[]].map(s=>s.textContent).join(''),
  covered:(st?.position==='sticky'||st?.position==='fixed')&&mr?.top<tr.bottom-2&&tr.left<mr.right&&tr.right>mr.left,
  onscreen:!!mr&&mr.top>=0&&mr.top<innerHeight,card:!!e?.closest('.rcard'),text:e?.textContent,
  hash:decodeURIComponent(location.hash),markVisible:!!top&&!!mark&&(top===mark||mark.contains(top)),controlOnly:!!e?.closest('.tts-hint,.tts-controls,button'),controls:document.querySelectorAll('.tts-btn .search-highlight').length};
});}
async function checks(p,width,mode){
 const prefix=mode+' '+width;const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.waitForTimeout(1300);
 await query(p,'冈格鲁米安纽');let s=await hit(p);
 check(prefix+' rules to world search switches to visible result',s.view==='world'&&s.visible&&s.marks.includes('冈格鲁米安纽'),JSON.stringify(s));
 check(prefix+' result clears sticky TOC and is onscreen',s.onscreen&&!s.covered&&s.markVisible,JSON.stringify(s));
 check(prefix+' world result updates shareable section URL',s.hash.startsWith('#w-')&&await p.evaluate(()=>new URL(location.href).searchParams.get('view')==='world'));
 await p.evaluate(()=>{window.__searchTestScroll=Element.prototype.scrollIntoView;window.__searchTestCalls=0;Element.prototype.scrollIntoView=function(...args){window.__searchTestCalls++;return window.__searchTestScroll.apply(this,args);};const img=document.createElement('img');img.id='search-test-image';img.style.height='1000px';document.querySelector('.search-hit-current').before(img);img.dispatchEvent(new Event('load'));});await p.waitForTimeout(200);s=await hit(p);
 check(prefix+' delayed image does not push result offscreen',s.onscreen&&!s.covered&&s.markVisible,JSON.stringify(s));
 await p.evaluate(()=>{document.dispatchEvent(new Event('touchstart'));window.__searchTestCalls=0;const img=document.getElementById('search-test-image');img.style.height='1500px';img.dispatchEvent(new Event('load'));});await p.waitForTimeout(200);s=await hit(p);
 check(prefix+' user interaction stops automatic repositioning',await p.evaluate(()=>window.__searchTestCalls===0),JSON.stringify(s));
 await p.evaluate(()=>{document.getElementById('search-test-image').remove();Element.prototype.scrollIntoView=window.__searchTestScroll;delete window.__searchTestScroll;delete window.__searchTestCalls;});
 await query(p,'你没有这个熟练项','enter');s=await hit(p);
 check(prefix+' world to rules search shows visible table/card data',s.view==='rules'&&s.visible&&s.marks.includes('你没有这个熟练项'),JSON.stringify(s));
 if(width<=600)check(prefix+' searches mobile cards instead of hidden tables',s.card,JSON.stringify(s));
 check(prefix+' table result is below navigation',s.onscreen&&!s.covered&&s.markVisible,JSON.stringify(s));
 await query(p,'土元素君王','search');s=await hit(p);
 check(prefix+' split inline world text is fully highlighted',s.view==='world'&&s.visible&&s.marks.includes('土元素君王'),JSON.stringify(s));
 await query(p,'生命');const first=await hit(p),count=Number(first.status.split('/')[1]);
 await p.locator('#help-search-next').evaluate(e=>e.click());await p.waitForTimeout(600);const next=await hit(p);
 await p.locator('#help-search-prev').evaluate(e=>e.click());await p.waitForTimeout(600);const prev=await hit(p);
 check(prefix+' next/previous results remain visible and restore first',count>1&&next.status.startsWith('2 /')&&next.visible&&prev.status===first.status&&prev.text===first.text&&prev.visible,JSON.stringify({first:first.status,next:next.status,prev:prev.status}));
 await p.locator('#help-search-input').focus();await p.locator('#help-search-input').press('Enter');
 await p.locator('#help-search-input').evaluate(e=>e.dispatchEvent(new Event('search',{bubbles:true})));await p.waitForTimeout(350);
 check(prefix+' Enter plus keyboard search advances once', (await hit(p)).status.startsWith('2 /'));
 await query(p,'熟练项 d12');s=await hit(p);
 check(prefix+' all keywords match in one rendered block regardless of case',s.visible&&s.marks.toLowerCase().includes('d12')&&s.marks.includes('熟练项'),JSON.stringify(s));
 await p.locator('#help-search-input').fill('不会存在的检索词8046');
 check(prefix+' editing query invalidates old result navigation',await p.locator('#help-search-next').isDisabled()&&await p.locator('.search-hit-current').count()===0);
 await p.locator('#help-search-go').click();await p.waitForTimeout(150);
 check(prefix+' no-results feedback disables navigation',await p.locator('#help-search-status').textContent()==='无结果'&&await p.locator('#help-search-next').isDisabled());
 await p.locator('#help-search-input').fill('');
 check(prefix+' clearing query resets counter and marks',await p.locator('#help-search-status').textContent()===''&&await p.locator('.search-highlight').count()===0);
 await p.locator('#help-search-input').fill('正在拼音输入');
 const composing=await p.locator('#help-search-input').evaluate(e=>{const k=new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true});e.dispatchEvent(k);return k.defaultPrevented;});
 check(prefix+' Chinese IME confirmation is not intercepted',!composing&&await p.locator('#help-search-status').textContent()==='');
 await query(p,'生命');
 const ctl=await p.locator('.tts-btn').count();await query(p,'朗读');
 const prose=await hit(p);
 check(prefix+' control labels excluded while genuine prose remains searchable',prose.visible&&!prose.controlOnly&&prose.controls===0&&await p.locator('.tts-btn').count()===ctl,JSON.stringify(prose));
 await p.evaluate(()=>{
  const el=document.createElement('p');el.id='search-test-late';el.textContent='长段落前文'.repeat(300)+'动态卡片检索回归8046';document.querySelector('#help-pane-rules main').append(el);
  const hidden=document.createElement('p');hidden.style.display='none';hidden.textContent='隐藏检索回归8046';document.querySelector('#help-pane-rules main').append(hidden);
 });
 await query(p,'动态卡片检索回归8046');s=await hit(p);
 check(prefix+' searches newly rendered content without stale index',s.visible&&s.onscreen&&s.markVisible&&s.marks.includes('动态卡片检索回归8046'),JSON.stringify(s));
 await query(p,'隐藏检索回归8046');check(prefix+' excludes hidden content',await p.locator('#help-search-status').textContent()==='无结果');
 await p.locator('#help-search-input').fill('冈格鲁米安纽');await p.locator('#help-search-go').evaluate(e=>e.click());await p.locator('#help-search-input').fill('');await p.waitForTimeout(250);
 check(prefix+' clear cancels pending jump/highlight',await p.locator('.search-hit-current').count()===0&&await p.locator('#help-search-status').textContent()==='');
 await p.evaluate(()=>document.getElementById('search-test-late')?.remove());
 await p.locator('#help-search-input').fill('手机搜索输入');
 for(const scheme of ['light','dark']){
  await p.emulateMedia({colorScheme:scheme});
  for(const dark of [false,true]){
   await p.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
   const contrast=await p.locator('#help-search-input').evaluate(el=>{
    const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
    const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
    const st=getComputedStyle(el),a=lum(rgb(st.color)),b=lum(rgb(st.backgroundColor));
    return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   });
   check(prefix+' readable input OS '+scheme+' app '+(dark?'dark':'light'),contrast>=4.5,String(contrast));
  }
 }
 await p.emulateMedia({colorScheme:'light'});await p.evaluate(()=>document.documentElement.classList.remove('dark'));
 await query(p,'你没有这个熟练项');
 if(mode==='browser')await p.screenshot({path:path.join(out,'help-search8046-'+mode+'-'+width+'.png')});
 check(prefix+' no horizontal page overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 check(prefix+' no renderer errors',errors.length===0,errors.join(';'));
}
let browser;
try{
 if(!process.argv.includes('--electron-only')){
  browser=await chromium.launch({headless:true});
  for(const width of [360,390,1440]){
   const p=await browser.newPage({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
   await p.goto(url,{waitUntil:'load'});await checks(p,width,'browser');await p.close();
  }
 }
 if(process.argv.includes('--electron')||process.argv.includes('--electron-only')){
  const t=await desktop.launch();try{
   for(const width of [360,390,1440]){
    await t.app.evaluate(({BrowserWindow},w)=>{const win=BrowserWindow.getAllWindows()[0];win.setMinimumSize(1,1);win.webContents.setBackgroundThrottling(false);win.setContentSize(w,844);},width);
    await desktop.navigate(t.app,'斯诺德跑团/help.html');
    const p=await t.app.firstWindow();
    await checks(p,width,'electron');
    const png=await t.app.evaluate(async({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];const image=await w.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});return image.toPNG().toString('base64');});
    fs.writeFileSync(path.join(out,'help-search8046-electron-'+width+'.png'),Buffer.from(png,'base64'));
   }
  }finally{await t.close();}
 }
}finally{await browser?.close();}
console.log('Help search checks: '+pass+'P '+fail+'F');process.exitCode=fail?1:0;
