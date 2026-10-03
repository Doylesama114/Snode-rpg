// Independent unusual-layout and extra-ability gate. Personal fixtures are read only when supplied.
(function(){
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto'),{pathToFileURL}=require('url');
const {chromium}=require('playwright'),X=require('xlsx'),dir=path.join(__dirname,'斯诺德跑团');
let browser,passes=0;const failures=[],errors=[];
async function check(name,fn){try{await fn();passes++;console.log('PASS '+name);}catch(e){failures.push(name+': '+e.message);console.error('FAIL '+name+'\n'+e.stack);}}
function bytes(book){return X.write(book,{bookType:'xlsx',type:'buffer',bookSST:true,compression:true});}
function fixture(){
 const book=X.utils.book_new(),sh=X.utils.aoa_to_sheet([]),v=(ref,value)=>sh[ref]={t:typeof value==='number'?'n':'s',v:value};
 for(const [ref,value]of Object.entries({B2:'基础信息',B3:'玩家名称',C3:'测试玩家',B4:'角色名称',C4:'异形回归',B5:'种族',C5:'人类',K3:'生命值',L3:49,K4:'疲劳值',L4:16,K10:'关键属性',L10:'敏捷',B14:'职业信息',B15:'主职业',B16:'名称',D16:'等级',E16:'风格',B17:'游荡者',D17:6,E17:'魔药',E18:'魅影',B21:'子职业',B22:'名称',D22:'等级',G15:'法师学徒',G18:'特性',H18:'背景提到技能列表，不是技能区标题',I34:'特殊专长',I36:'4级',K36:'健壮',I38:'8级',O34:'货币',O36:140,O38:0,O40:0,B120:'技能列表',B121:'主职业(当前槽位15)',O120:'天赋列表',O121:'一阶天赋树(5)',O128:'二阶天赋树(5)',O135:'三阶天赋树(5)',O142:'四阶天赋树(5)',O149:'五阶天赋树(5)',O156:'六阶天赋树(5)',O163:'七阶天赋树(5)',B141:'子职业()',B149:'图纸(专业槽位) 当前槽位13',B150:'减速毒药(配方)',B151:'菊花茶(配方)',O122:'冥想',O123:'随机应变',O124:'身轻如燕',Q124:'摔落伤害减半',O125:'友谊之证'}))v(ref,value);
 for(const row of [122,142])for(const [col,name]of Object.entries({B:'技能名称',D:'施展时间',E:'施展距离',F:'持续时间',H:'疲劳值消耗',I:'类别',J:'效果'}))v(col+row,name);
 const names=['潜行','疾跑','七彩炫光','赋予黑暗视觉','梦话','掩饰术','梦呓低语','暗影之刃'];
 names.forEach((n,i)=>{let r=123+i;v('B'+r,n);v('D'+r,'0');v('E'+r,'12米');v('F'+r,'立即');v('H'+r,2);if(i<2)v('I'+r,'游荡者');});
 const attrRows={力量:36,敏捷:46,体质:57,智力:62,感知:87,魅力:100,意志:110,幸运:116};
 for(const [n,r]of Object.entries(attrRows)){v('B'+r,n);v('C'+r,n==='敏捷'?17:12);}
 const merges=['B120:M120','B121:M121','B141:M141','B149:F149','I34:M35','I36:J37','K36:M37','I38:J39','K38:M39','O34:S35','O36:P37','O38:P39','O40:P41'].concat([121,128,135,142,149,156,163].map(r=>'O'+r+':S'+r));
 for(let r=122;r<=170;r++)if(![128,135,142,149,156,163].includes(r))merges.push('O'+r+':P'+r,'Q'+r+':R'+r);
 for(let r=122;r<=146;r++)if(r!==141)merges.push('B'+r+':C'+r,'J'+r+':M'+r);
 sh['!merges']=merges.map(X.utils.decode_range);sh['!ref']='B2:S170';X.utils.book_append_sheet(book,sh,'模版');return book;
}
async function imported(p,buffer){return p.evaluate(async b64=>{const parsed=await parseXLSX(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer),s=buildState(parsed);autoCorrect(s);return {s,meta:parsed.meta};},Buffer.from(buffer).toString('base64'));}
async function exported(p,s,buffer){return Buffer.from(await p.evaluate(async({s,b64})=>{state=JSON.parse(JSON.stringify(s));if(b64)state._uploadedXlsxBuf=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer;else delete state._uploadedXlsxBuf;await exportXlsxFromState(state);const a=new Uint8Array(await window.__unusualBlobs.at(-1).arrayBuffer());let v='';for(const n of a)v+=String.fromCharCode(n);return btoa(v);},{s,b64:buffer?Buffer.from(buffer).toString('base64'):null}),'base64');}
function blobInit(){window.__unusualBlobs=[];URL.createObjectURL=b=>{window.__unusualBlobs.push(b);return 'blob:unusual';};HTMLAnchorElement.prototype.click=function(){};}
(async()=>{try{
 browser=await chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());await ctx.addInitScript(blobInit);
 const upload=await ctx.newPage(),panel=await ctx.newPage();for(const p of [upload,panel])p.on('pageerror',e=>errors.push(e.message));
 await upload.goto(pathToFileURL(path.join(dir,'上传角色.html')).href,{waitUntil:'load'});await panel.goto(pathToFileURL(path.join(dir,'角色面板.html')).href,{waitUntil:'load'});
 const source=bytes(fixture()),base=(await imported(upload,source)).s;
 function counts(s){assert.equal(s.skills.length,8);assert.equal(s.talent_tree.length,4);assert.equal(s.blueprints.length,2);assert.equal(s.skills.filter(e=>e.place==='sub').length,0);}
 await check('structural categories, adjacent talent notes and restricted feat values',async()=>{
  counts(base);assert.equal(base.talent_tree.find(e=>e.n==='身轻如燕').ds,'摔落伤害减半');assert.equal(base.special_feats.length,1);assert.equal(base.special_feats[0].name,'健壮');assert.equal(base.classes[0].keyAttr,'敏捷');
  assert.equal(base.blueprints[0].id,'r-skill-52');assert.ok(!base.importIssues.some(i=>i.kind==='typo-candidate'));assert.equal(base.unmappedFields[0].values[0].value,'140');assert.equal(base.currency.金币,0);
 });
 let accepted;
 await check('extra ability confirmed through UI without invented slot policy',async()=>{
  await upload.evaluate(s=>{pendingState=s;openIssueResolver(s.skills.find(e=>e.n==='梦呓低语').uid,s);},base);
  const d=upload.locator('#characterIssueDialog');await d.getByLabel('技能候选').selectOption('__custom');await d.getByLabel('完整效果与说明').fill('主持人定义 <效果> & 原文');await d.getByLabel('召唤物补充说明').fill('召唤单位：测试灵体；生命值 12');
  await d.getByRole('button',{name:'保存',exact:true}).click();accepted=await upload.evaluate(()=>pendingState);
  const e=accepted.skills.find(e=>e.n==='梦呓低语');assert.equal(e.resolution,'custom');assert.equal(e.origin.type,'dm');assert.equal(e.src,'');assert.ok(!e.id);assert.equal(e.tier,'');assert.equal(e.occupies,null);assert.equal(e.free,null);
  assert.ok(!accepted.importIssues.some(i=>i.uid===e.uid&&['unmatched','typo-candidate','ambiguous'].includes(i.kind)));assert.ok(accepted.importIssues.some(i=>i.uid===e.uid&&i.kind==='slot-pending'));
 });
 await check('custom and deferred decisions survive repeated correction',async()=>{
  const r=await upload.evaluate(s=>{const io=SNOWD_CHARACTER_IO;autoCorrect(s);autoCorrect(s);const e=s.skills.find(e=>e.n==='梦话');e.resolution='deferred';e.resolutionFingerprint=io.fingerprint(e);io.removeResolutionIssues(s,e.uid);autoCorrect(s);return {s,custom:io.resolve(s.skills.find(e=>e.n==='梦呓低语')),deferred:e};},accepted);
  assert.equal(r.custom.pick,null);assert.ok(!r.s.importIssues.some(i=>i.uid===r.deferred.uid&&i.kind==='ambiguous'));assert.ok(r.s.skills.some(e=>e.resolution==='custom'));
 });
 await check('actual layout roundtrip preserves 14 UIDs, notes and pending occupancy',async()=>{
  let s=accepted,buf=source;
  for(let n=0;n<3;n++){
   buf=await exported(panel,s,buf);const output=X.read(buf,{type:'buffer'}),sh=output.Sheets.模版;
   assert.equal(sh.B149.v,'图纸(专业槽位) 当前槽位13');assert.equal(sh.B150.v,'减速毒药(配方)');assert.equal(sh.Q124.v,'摔落伤害减半');
   const r=await imported(upload,buf);counts(r.s);for(const old of base.skills.concat(base.talent_tree,base.blueprints))assert.ok(r.s.skills.concat(r.s.talent_tree,r.s.blueprints).some(e=>e.uid===old.uid),old.n);
   const e=r.s.skills.find(e=>e.n==='梦呓低语');assert.equal(e.resolution,'custom');assert.equal(e.occupies,null);assert.equal(e.ds,'主持人定义 <效果> & 原文');assert.equal(e.summonNotes,'召唤单位：测试灵体；生命值 12');assert.equal(r.s._metaStats.edited,0,JSON.stringify(r.s.importIssues));s=r.s;
  }
 });
 await check('upload-side export uses the same layout and v3 identity',async()=>{const out=await exported(upload,accepted,source),r=await imported(upload,out);counts(r.s);assert.equal(r.s.skills.find(e=>e.n==='梦呓低语').uid,accepted.skills.find(e=>e.n==='梦呓低语').uid);});
 await check('custom name matching catalogue never auto-binds',async()=>{
  const r=await upload.evaluate(s=>{const e=s.skills.find(e=>e.n==='梦呓低语');e.n='冲锋';autoCorrect(s);return {e,pick:SNOWD_CHARACTER_IO.resolve(e).pick};},accepted);
  assert.equal(r.pick,null);assert.ok(!r.e.id);assert.equal(r.e.resolution,'custom');
 });
 await check('pending slots are counted separately and custom details include all fields',async()=>{
  const r=await panel.evaluate(s=>{state=s;SB_reinit();renderSkillTables();renderSlotNote();const e=state.skills.find(e=>e.n==='梦呓低语'),row=document.querySelector('#mainSkillBody tr[data-uid="'+e.uid+'"]');showSkillDetailRow(row);const detail=document.getElementById('sdTable').textContent;return {count:countOccupiedSkillSlots(0),note:document.getElementById('skillSlotNote').textContent,detail};},accepted);
  assert.equal(r.count,7);assert.ok(r.note.includes('槽位待确认 1'));assert.ok(r.detail.includes('主持人定义 <效果> & 原文'));assert.ok(r.detail.includes('测试灵体'));assert.ok(r.detail.includes('疲劳消耗'));
 });
 await check('manual mapping recovers a missing header without losing accepted ability',async()=>{
  const b=fixture();b.Sheets.模版.B122={t:'s',v:'招式表头'};const s=(await imported(upload,bytes(b))).s;assert.ok(s._importLayoutIssues.length);
  await upload.evaluate(s=>{pendingState=s;openLayoutResolver(s);},s);
  const d=upload.locator('#characterIssueDialog');await d.getByLabel('数据范围（不含表头）').fill('B123:M140');await d.getByLabel('名称列').selectOption('B');await d.getByLabel('施展时间列').selectOption('D');await d.getByLabel('距离列').selectOption('E');await d.getByLabel('持续时间列').selectOption('F');await d.getByLabel('消耗列').selectOption('H');await d.getByLabel('来源列').selectOption('I');await d.getByLabel('说明列').selectOption('J');await d.getByLabel('方案名称（填写后保存区块映射）').fill('测试区块方案');await d.getByRole('button',{name:'预览区块',exact:true}).click();assert.ok((await d.locator('pre').textContent()).includes('潜行'));
  await d.getByRole('button',{name:'保存映射与字段',exact:true}).click();const r=await upload.evaluate(()=>({s:pendingState,profile:JSON.parse(localStorage.getItem('SNODE_IMPORT_LAYOUT_PROFILES_V1'))}));counts(r.s);assert.equal(r.s._importLayoutIssues.length,0);assert.equal(r.profile[0].name,'测试区块方案');
 });
 await check('explicit currency mapping preserves zero and the original 140',async()=>{
  await imported(upload,source);await upload.evaluate(s=>{pendingState=s;openLayoutResolver(s);},accepted);
  const d=upload.locator('#characterIssueDialog');await d.getByLabel('金币原始单元格').fill('O36');await d.getByLabel('银币原始单元格').fill('O38');await d.getByLabel('铜币原始单元格').fill('O40');await d.getByRole('button',{name:'保存映射与字段',exact:true}).click();const s=await upload.evaluate(()=>pendingState);assert.equal(s.currency.金币,140);assert.equal(s.currency.银币,0);assert.equal(s.unmappedFields.length,0);
  const again=(await imported(upload,await exported(panel,s,source))).s;assert.equal(again.currency.金币,140);counts(again);
 });
 await check('multiple character sheets require explicit selection',async()=>{
  const b=fixture();X.utils.book_append_sheet(b,structuredClone(b.Sheets.模版),'第二角色');b.Sheets.第二角色.C4={t:'s',v:'第二角色'};
  const r=await upload.evaluate(async b64=>{const p=await parseXLSX(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer);const selected=await parseXLSX(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer,{sheetPath:p.sheetChoices.find(s=>s.name==='第二角色').path});return {pending:p.sheetSelectionPending,name:buildState(selected).name,confirmed:selected.sheetSelectionPending};},bytes(b).toString('base64'));
  assert.equal(r.pending,true);assert.equal(r.name,'第二角色');assert.equal(r.confirmed,false);
 });
 await check('unranked custom talents remain visible and roundtrip without an invented tier',async()=>{
  const s=structuredClone(accepted);s.talent_tree.push({n:'剧情祝福',uid:'story-talent',place:'talent',tier:'',resolution:'custom',ds:'完整祝福说明',src:'',occupies:null,free:null,via:'主持人',unit_tables:[{name:'小灵体',head:{hp:10},abilities:[{name:'守护',text:'承受一次攻击'}]}]});
  const r=(await imported(upload,await exported(panel,s))).s,e=r.talent_tree.find(e=>e.uid==='story-talent');assert.ok(e);assert.equal(e.tier,'');assert.equal(e.ds,'完整祝福说明');
  const result=await panel.evaluate(s=>{state=s;SB_reinit();renderTalent();showTalentDetail('未标阶位','剧情祝福','story-talent');return {list:document.getElementById('talentList').textContent,detail:document.getElementById('sdTable').textContent};},r);assert.ok(result.list.includes('剧情祝福'));assert.ok(result.detail.includes('守护'));assert.ok(result.detail.includes('生命值'));
 });
 await check('extra ability dialog fits 360, 390 and 1440 viewports',async()=>{
  for(const width of [360,390,1440]){await panel.setViewportSize({width,height:900});await panel.evaluate(s=>{state=s;openIssueResolver(state.skills.find(e=>e.n==='梦呓低语').uid,state);},accepted);const dims=await panel.locator('#characterIssueDialog section').evaluate(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,width:innerWidth,scroll:e.scrollWidth,client:e.clientWidth}));assert.ok(dims.left>=0&&dims.right<=dims.width+1&&dims.scroll<=dims.client+1);await panel.keyboard.press('Escape');}
 });

 await check('arbitrary sheet cannot silently import an unrecognized ability region',async()=>{
  const b=X.utils.book_new();X.utils.book_append_sheet(b,X.utils.aoa_to_sheet([['姓名','测试'],['条目','剧情能力'],['说明','完整原文']]),'自由表');
  const r=(await imported(upload,bytes(b))).s;assert.ok(r._importLayoutIssues.some(i=>i.cellRef==='__sheet__'));
 });
 await check('explicit exclusions preserve a review record and are not re-imported',async()=>{
  await imported(upload,source);const r=structuredClone(base);await upload.evaluate(s=>{pendingState=s;openIssueResolver(s.blueprints[0].uid,s);},r);
  const d=upload.locator('#characterIssueDialog');await d.getByLabel('技能候选').selectOption('__exclude');await d.getByRole('button',{name:'保存',exact:true}).click();
  const excluded=await upload.evaluate(()=>pendingState);assert.equal(excluded.blueprints.length,1);assert.equal(excluded.importExcluded[0].n,'减速毒药(配方)');
  const again=(await imported(upload,await exported(panel,excluded,source))).s;assert.equal(again.blueprints.length,1);assert.equal(again.importExcluded[0].n,'减速毒药(配方)');
 });
 await check('special prototype-like names remain raw entries without lookup crashes',async()=>{
  const r=await upload.evaluate(s=>{s.skills.push({n:'constructor',uid:'constructor-name',place:'main'});s.skills.push({n:'__proto__',uid:'proto-name',place:'main'});autoCorrect(s);return s;},base);
  assert.ok(r.skills.some(e=>e.n==='__proto__'));assert.ok(r.importIssues.some(i=>i.uid==='proto-name'&&i.kind==='unmatched'));
 });

 await check('nonstandard custom rank is preserved without becoming first tier',async()=>{
  const s=structuredClone(accepted);s.talent_tree.push({n:'觉醒祝福',uid:'nonstandard-rank',place:'talent',tier:'觉醒',resolution:'custom',ds:'完整效果',src:'',occupies:null,free:null});
  const r=(await imported(upload,await exported(panel,s))).s,e=r.talent_tree.find(e=>e.uid==='nonstandard-rank');assert.ok(e);assert.equal(e.tier,'觉醒');assert.equal(e.ds,'完整效果');
 });
 const arg=process.argv.indexOf('--fixture');if(arg>=0)await check('personal fixture: read-only parse and complete roundtrip',async()=>{
  const file=process.argv[arg+1],source=fs.readFileSync(file),before=crypto.createHash('sha256').update(source).digest('hex'),r=(await imported(upload,source)).s;counts(r);assert.equal(r.talent_tree.find(e=>e.n==='身轻如燕').ds,'摔落伤害减半');const e=r.skills.find(e=>e.n==='梦呓低语');
  const accepted=await upload.evaluate(({s,uid})=>{const e=s.skills.find(e=>e.uid===uid);SNOWD_CHARACTER_IO.confirmCustom(e,{originType:'dm',via:'主持人或剧情授予'});autoCorrect(s);return s;},{s:r,uid:e.uid});
  const out=await exported(panel,accepted,source),again=(await imported(upload,out)).s;counts(again);assert.equal(again.skills.find(e=>e.n==='梦呓低语').uid,e.uid);assert.equal(again.skills.find(e=>e.n==='梦呓低语').resolution,'custom');assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before);
 });
 await check('no unhandled page errors',async()=>assert.deepEqual(errors,[]));
}catch(e){failures.push(e.stack);console.error(e.stack);}finally{if(browser)await browser.close();}
console.log('Unusual character import: '+passes+'P '+failures.length+'F');if(failures.length)process.exitCode=1;
})();
})();
