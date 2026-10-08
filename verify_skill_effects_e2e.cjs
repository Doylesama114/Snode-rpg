/* Real card/detail regressions; isolated Chromium and optional Electron 22 profiles. */
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const {pathToFileURL}=require('url'),{chromium,_electron}=require('playwright');
const root=__dirname,fixture=JSON.parse(fs.readFileSync(path.join(root,'scripts/skill_effects_cases.json'),'utf8')).cases;
const classes=JSON.parse(fs.readFileSync(path.join(root,'职业页/数据/classes.json'),'utf8')).map(x=>x.name);
const domainData=JSON.parse(fs.readFileSync(path.join(root,'职业页/数据/牧师·神圣领域.json'),'utf8'));
const domains=domainData.domains;
const canonicalDeity=name=>domainData.pantheon.find(d=>d.name===name||(d.aliases||[]).includes(name))?.name||name;
const base={};for(const cls of classes)base[cls]=JSON.parse(fs.readFileSync(path.join(root,'职业页/数据',cls+'.json'),'utf8')).skills;
const cases=fixture.map(c=>({...c,deity:c.deity?canonicalDeity(c.deity):c.deity,id:c.id||domains[canonicalDeity(c.deity)].skills.find(s=>s.name===c.name).id}));
let passes=0;const failures=[];
function norm(s){return String(s||'').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase()}
function check(label,actual,expected){const n=norm(actual);for(const e of expected)if(!n.includes(norm(e)))failures.push(label+': '+e.slice(0,75));passes++}
async function configure(page){await page.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());page.on('pageerror',e=>failures.push('renderer '+e.message))}
async function cardChecks(page,label){
 for(const cls of classes){
  await page.goto(pathToFileURL(path.join(root,'职业页',cls+'.html')).href,{waitUntil:'load'});
  await page.evaluate(()=>window.__snowdLazySkills&&window.__snowdLazySkills.hydrateAll(document));
  const pool=base[cls].concat(cls==='牧师'?Object.values(domains).flatMap(d=>d.skills):[]);
  for(const c of cases.filter(c=>c.class===cls||(cls==='牧师'&&c.deity))){
   if(c.deity)await page.locator('button.deity-chip[data-deity="'+c.deity+'"]').click();
   const art=page.locator('#'+c.id);await art.scrollIntoViewIfNeeded();
   check(label+' card '+c.name,await art.innerText(),c.expected);
  }
  for(const s of pool.filter(s=>s.unit_tables&&s.unit_tables.length)){
   if(s.deity)await page.locator('button.deity-chip[data-deity="'+s.deity+'"]').click();
   const art=page.locator('#'+s.id);await art.scrollIntoViewIfNeeded();
   check(label+' unit '+s.name,await art.innerText(),s.unit_tables.flatMap(u=>u.lines).filter(x=>norm(x)!=='固有技能'));
  }
 }
}
async function details(page,label,width,setWidth){
 await setWidth(width);
 await page.goto(pathToFileURL(path.join(root,'斯诺德跑团/角色面板.html')).href,{waitUntil:'load'});
 for(const c of cases){
  const src=c.deity?'牧师·神圣领域':c.class;
  const result=await page.evaluate(({c,src})=>{
   const data=resolveSkillData({src,id:c.id,n:c.name}).data;
   if(!data)return {error:'unresolved'};
   showSkillDetail(src,c.name,c.id);
   const preview=document.getElementById('modalOverlay');
   const learning=preview.innerText;
   const copy=JSON.parse(JSON.stringify(state));
   copy.classes=[{name:c.class==='牧师·神圣领域'?'牧师':c.class,level:20},{name:'',level:0}];
   copy.skills=[];copy.talent_tree=[{uid:'effect-check-uid',n:c.name,src,id:c.id,tier:data.tier||'一阶'}];
   const saved=state;state=copy;T=SB_buildTestData(copy);
   showTalentDetail(T.talents[0].tier,c.name,'effect-check-uid');
   const learned=document.getElementById('sdTable').innerText;
   state=saved;
   const box=preview.firstElementChild.getBoundingClientRect();
   preview.remove();document.getElementById('skillOverlay').classList.remove('show');
   return {learning,learned,overflow:box.left<-1||box.right>innerWidth+1};
  },{c,src});
  if(result.error){failures.push(label+' unresolved '+c.name);continue}
  check(label+' '+width+' learn '+c.name,result.learning,c.expected);
  check(label+' '+width+' learned '+c.name,result.learned,c.expected);
  if(result.overflow)failures.push(label+' '+width+' overflowing detail '+c.name);
 }
 const extra=await page.evaluate(()=>{
  const rows=SKILL_DATA['战舞者'];const aliases=rows.flatMap(s=>(s.legacy_ids||[]).map(old=>({s,old})));
  const bad=aliases.filter(({s,old})=>resolveSkillData({src:'战舞者',id:old,n:s.name}).data!==s||SNOWD_CHARACTER_IO.resolve({src:'战舞者',id:old,n:s.name}).pick?.id!==s.id);
  const data=SKILL_DATA['法师'].find(s=>s.name==='召唤火元素'),u=data.unit_tables[0];
  const partial={...data,description:u.lines,unit_tables:[{...u,abilities:u.abilities.slice(0,1),notes:[]}]};
  showSkillPreview('partial fixture','','',formatSkillDetailHtml(partial));
  const fallback=document.getElementById('modalOverlay').innerText;document.getElementById('modalOverlay').remove();
  return {aliases:aliases.length,bad:bad.length,fallback,expected:u.lines.filter(x=>x!=='固有技能：')};
 });
 assert.equal(extra.aliases,54);assert.equal(extra.bad,0);
 check(label+' partial structured fallback',extra.fallback,extra.expected);
 console.log(label+' '+width+' details checked');
}
(async()=>{
 let browser,electron,temp;
 try{
  browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext({viewport:{width:1440,height:900}}),page=await ctx.newPage();
  await configure(page);await cardChecks(page,'Chromium');
  for(const width of [360,390,1440])await details(page,'Chromium',width,w=>page.setViewportSize({width:w,height:900}));
  await ctx.close();await browser.close();browser=null;
  if(process.argv.includes('--electron')){
   const scratch=path.resolve(root,'_scratch');fs.mkdirSync(scratch,{recursive:true});
   temp=fs.mkdtempSync(path.join(scratch,'skill-effects-electron-'));
   const profile=path.join(temp,'profile'),boot=path.join(temp,'bootstrap.cjs');fs.mkdirSync(profile);
   fs.writeFileSync(boot,"const {app,BrowserWindow}=require('electron');app.disableHardwareAcceleration();app.setPath('userData',"+JSON.stringify(profile)+");app.setPath('sessionData',"+JSON.stringify(profile)+");app.whenReady().then(()=>{new BrowserWindow({show:false,width:1440,height:900,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}}).loadURL('about:blank')});app.on('window-all-closed',()=>app.quit());");
   electron=await _electron.launch({executablePath:require('./electron-app/node_modules/electron'),args:[boot]});
   const p=await electron.firstWindow();await configure(p);
   for(const width of [360,390,1440])await details(p,'Electron',width,async w=>{await electron.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setContentSize(width,900),w);await p.waitForFunction(w=>innerWidth===w,w)});
   await electron.close();electron=null;
  }
 }catch(e){failures.push(e.stack)}
 finally{
  if(browser)await browser.close();if(electron)await electron.close();
  if(temp){const resolved=path.resolve(temp),parent=path.resolve(root,'_scratch')+path.sep;if(!resolved.startsWith(parent)||!path.basename(resolved).startsWith('skill-effects-electron-'))throw Error('Unsafe cleanup path');fs.rmSync(resolved,{recursive:true,force:true,maxRetries:3})}
 }
 console.log('Skill effects: '+passes+' checks, '+failures.length+' failures');
 failures.slice(0,35).forEach(f=>console.error(f));if(failures.length)process.exitCode=1;
})();
