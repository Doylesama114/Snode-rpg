// Character import/export gate; independent Excel fixtures generated with SheetJS.
(function regressionTest() {
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),{pathToFileURL}=require('url');
const {chromium,_electron}=require('playwright'),XLSX=require('xlsx'),root=__dirname,dir=path.join(root,'斯诺德跑团');
const failures=[];let passed=0,browser,electron;
async function check(name,fn){try{await fn();passed++;console.log('PASS '+name);}catch(e){failures.push(name+': '+e.message);console.error('FAIL '+name+'\n'+e.stack);}}
function encode(book,sst=true){return XLSX.write(book,{bookType:'xlsx',type:'buffer',bookSST:sst,compression:true});}
async function importBytes(page,bytes){
 return page.evaluate(async b64=>{
  const p=await parseXLSX(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer),s=buildState(p);
  autoCorrect(s);return {state:s,meta:p.meta,sheetName:p.sheetName,sheetPath:p.sheetPath,cells:p.cells};
 },Buffer.from(bytes).toString('base64'));
}
async function exportState(page,input,buffer){
 return Buffer.from(await page.evaluate(async({s,b})=>{
  Object.assign(state,s);delete state._uploadedXlsxBuf;
  if(b)state._uploadedXlsxBuf=Uint8Array.from(atob(b),c=>c.charCodeAt(0)).buffer;
  await exportXlsxFromState(state);
  const blob=window.__ioBlobs[window.__ioBlobs.length-1];if(!blob)throw Error('no exported workbook');
  const bytes=new Uint8Array(await blob.arrayBuffer());let raw='';for(const v of bytes)raw+=String.fromCharCode(v);return btoa(raw);
 },{s:input,b:buffer?Buffer.from(buffer).toString('base64'):null}),'base64');
}
function initBlobs(){window.__ioBlobs=[];URL.createObjectURL=b=>{window.__ioBlobs.push(b);return 'blob:io-test';};HTMLAnchorElement.prototype.click=function(){};}
async function configure(page){await page.addInitScript(initBlobs);await page.goto(pathToFileURL(path.join(dir,'角色面板.html')).href,{waitUntil:'load'});}
(async()=>{
try {
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 await ctx.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const panel=await ctx.newPage(),upload=await ctx.newPage(),pageErrors=[];
 panel.on('pageerror',e=>pageErrors.push('panel '+e.message));upload.on('pageerror',e=>pageErrors.push('upload '+e.message));
 await configure(panel);await upload.addInitScript(initBlobs);
 await upload.goto(pathToFileURL(path.join(dir,'上传角色.html')).href,{waitUntil:'load'});
 const initial=await panel.evaluate(()=>{
  const s=JSON.parse(JSON.stringify(state));s.name='导入回归角色';s.race='人类';s.background='法师学徒';s.hp=50;s.fp=30;
  s.attrs={'力量':12,'敏捷':12,'体质':12,'智力':14,'感知':12,'魅力':12,'意志':12,'幸运':12};
  s.classes=[{name:'法师',level:12,keyAttr:'智力',styles:['塑能','咒法','','']},{name:'战士',level:3,styles:['斗争','','','']},{name:'',level:0,styles:['','','','']}];
  s.skills=[
   {n:'冲锋',src:'战士',id:'w-starting-skill-2',sub:'',uid:'charge',place:'main',kind:'技能',free:false,occupies:true,via:'冲锋手',growthBy:'main',ds:'玩家自定义 <说明> & 内容'},
   {n:'魔法飞弹',src:'召唤师',id:'sm-starting-skill-1',sub:'',uid:'bolt',place:'main',kind:'技能',free:false,occupies:true,via:'镜子大师',growthBy:'main',selectedOptions:{test:['A','B']}},
   {n:'冲锋',src:'战士',id:'w-starting-skill-2',sub:'战士',uid:'sub-charge',place:'sub',kind:'技能',free:true,occupies:true,via:'自定义专长'},
   {n:'光亮术',src:'法师',sub:'',uid:'free-light',place:'main',free:true,occupies:false,freeSlot:true,grantedBy:'法师学徒',via:'法师学徒',locked:false}
  ];
  const picks=['道具大师','以刃承伤'].map(n=>SKILL_DATA['通用'].find(t=>t.name===n));
  const others=SKILL_DATA['通用'].filter(t=>String(t.tier||'').startsWith('五阶')&&!picks.includes(t)).slice(0,4);
  s.talent_tree=picks.concat(others).map((t,i)=>({n:t.name,src:'通用',cls:'通用',id:t.id,tier:'五阶',uid:'talent-'+i,place:'talent',kind:'天赋',via:'直接习得',growthBy:'main',locked:i===0,choices:{pick:i}}));
  s.unlocked_tiers=['一阶','二阶','三阶','四阶','五阶'];s.extra_slots=['五阶'];s.importIssues=[];return s;
 });
 const bytes=await exportState(panel,initial),book=XLSX.read(bytes,{type:'buffer'}),sheetName=book.SheetNames.find(n=>n!=='_SNODE_META');
 const baseline=await importBytes(upload,bytes);
 function stable(s){
  for(const old of initial.skills.concat(initial.talent_tree)){
   const entry=s.skills.concat(s.talent_tree).find(x=>x.uid===old.uid);
   assert.ok(entry,'missing UID '+old.uid);assert.equal(entry.n,old.n);assert.equal(entry.src,old.src);
   if(old.via)assert.equal(entry.via,old.via);
   if(old.selectedOptions)assert.deepEqual(entry.selectedOptions,old.selectedOptions);
   if(old.choices)assert.deepEqual(entry.choices,old.choices);
  }
  assert.deepEqual(s.unlocked_tiers,initial.unlocked_tiers);assert.deepEqual(s.extra_slots,initial.extra_slots);
 }
 await check('outdated tiers / UID / free / options / overflow',async()=>{
  stable(baseline.state);assert.equal(baseline.state._metaStats.edited,0);assert.equal(baseline.state.talent_tree.length,6,JSON.stringify(baseline.state.talent_tree.map(e=>e.n)));
  for(const n of ['道具大师','以刃承伤'])assert.equal(baseline.state.talent_tree.find(t=>t.n===n).tier,'五阶');
  const f=baseline.state.skills.find(s=>s.uid==='free-light');assert.equal(f.free,true);assert.equal(f.occupies,false);assert.equal(f.freeSlot,true);
  const sub=baseline.state.skills.find(s=>s.uid==='sub-charge');assert.equal(sub.sub,'战士');assert.equal(sub.free,true);assert.equal(sub.occupies,true);
 });
 await check('three full cycles preserve identity',async()=>{
  let s=baseline.state,buf=bytes;for(let i=0;i<3;i++){buf=await exportState(panel,s,buf);s=(await importBytes(upload,buf)).state;stable(s);assert.equal(s._metaStats.edited,0);}
 });
 await check('Excel shared strings and sparse cells',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'}),meta=b.Sheets._SNODE_META;
  for(const k of Object.keys(meta))if(!k.startsWith('!')&&meta[k].v==='')delete meta[k];
  const r=await importBytes(upload,encode(b));assert.equal(r.meta.status,'ok');stable(r.state);assert.equal(r.state._metaStats.edited,0,JSON.stringify({issues:r.state.importIssues.filter(i=>i.kind==="visible-edited"),visible:r.state.skills.map(e=>({n:e.n,visible:e._visible})),baseline:r.meta.rows.filter(m=>m.sheet!=="__STATE__").map(m=>({n:m.name,baseline:m._baseline}))}));
 });
 await check('inline strings without sharedStrings',async()=>{
  const buf=encode(XLSX.read(bytes,{type:'buffer'}),false),r=await importBytes(upload,buf);stable(r.state);assert.equal(r.meta.status,'ok');
  stable((await importBytes(upload,await exportState(panel,r.state,buf))).state);
 });
 await check('notes before character preserved on export',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'});XLSX.utils.book_append_sheet(b,XLSX.utils.aoa_to_sheet([['笔记','A&B <C>'],['状态',-12]]),'笔记');b.SheetNames=['笔记',sheetName,'_SNODE_META'];
  const buf=encode(b),r=await importBytes(upload,buf);assert.equal(r.sheetName,sheetName);stable(r.state);
  const after=XLSX.read(await exportState(panel,r.state,buf),{type:'buffer'});
  assert.equal(after.Sheets['笔记'].B1.v,'A&B <C>');assert.equal(after.Sheets['笔记'].B2.v,-12);assert.equal(after.SheetNames.filter(n=>n==='_SNODE_META').length,1);
 });
 await check('adding metadata does not overwrite notes',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'});delete b.Sheets._SNODE_META;b.SheetNames=b.SheetNames.filter(n=>n!=='_SNODE_META');
  XLSX.utils.book_append_sheet(b,XLSX.utils.aoa_to_sheet([['笔记','保留']]),'笔记');
  const buf=encode(b),r=await importBytes(upload,buf),after=XLSX.read(await exportState(panel,r.state,buf),{type:'buffer'});
  assert.equal(after.Sheets['笔记'].B1.v,'保留');assert.equal(after.SheetNames.filter(n=>n==='_SNODE_META').length,1);
 });
 await check('ten attachments produce unique relationships',async()=>{
  const result=await panel.evaluate(()=>{
   const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
   const entries=[
    {name:'xl/workbook.xml',text:'<workbook xmlns="'+ns+'" xmlns:r="'+rel+'"><sheets><sheet name="角色" sheetId="1" r:id="rId1"/><sheet name="笔记" sheetId="2" r:id="rId2"/></sheets></workbook>'},
    {name:'xl/_rels/workbook.xml.rels',text:'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="'+rel+'/worksheet"/><Relationship Id="rId2" Target="worksheets/sheet2.xml" Type="'+rel+'/worksheet"/></Relationships>'},
    {name:'[Content_Types].xml',text:'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'},
    {name:'xl/worksheets/sheet1.xml',text:'<worksheet xmlns="'+ns+'"><sheetData/></worksheet>'},
    {name:'xl/worksheets/sheet2.xml',text:'<worksheet xmlns="'+ns+'"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>保留笔记</t></is></c></row></sheetData></worksheet>'}
   ];const s={skills:[],talent_tree:[]};let result;for(let i=0;i<10;i++)result=attachSkillMetaSheet(entries,s);
   const man=SNOWD_CHARACTER_IO.manifest(entries[0].text,entries[1].text);
   return {ids:man.rels.map(r=>r.getAttribute('Id')),sheets:man.list.map(s=>s.name),path:result.path,note:entries.find(e=>e.name==='xl/worksheets/sheet2.xml').text};
  });assert.equal(new Set(result.ids).size,result.ids.length);assert.equal(result.sheets.filter(n=>n==='_SNODE_META').length,1);assert.equal(result.path,'xl/worksheets/sheet3.xml');assert.ok(result.note.includes('保留笔记'));
 });
 await check('negative/scientific/cache/rich text/entities',async()=>{
  const r=await upload.evaluate(()=>SNOWD_CHARACTER_IO.sheet('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="2"><c r="A2"><v>-12.5</v></c><c r="B2"><f>SUM(A1:A2)</f><v>-2E+3</v></c><c t="inlineStr" r="C2"><is><r><t>A&amp;B</t></r><r><t> &lt;C&gt; &#x4E2D;</t></r></is></c><c r="D2"><v>0</v></c></row></sheetData></worksheet>',[]));
  assert.equal(r.cells.A2,'-12.5');assert.equal(r.cells.B2,'-2E+3');assert.equal(r.cells.C2,'A&B <C> 中');assert.equal(r.cells.D2,'0');assert.equal(r.formulas.B2.cached,true);
 });
 await check('duplicate names within source + duplicate cross-class IDs',async()=>{
  const r=await upload.evaluate(()=>{
   const io=SNOWD_CHARACTER_IO,dupes=Object.keys(SNOWD_SKILL_INDEX.byName).filter(n=>io.candidates(n).filter(c=>c.cls==='牧师·神圣领域').length>1),n=dupes[0],cs=io.candidates(n).filter(c=>c.cls==='牧师·神圣领域');
   return {noId:io.resolve({n,src:'牧师·神圣领域'}).pick,id:io.resolve({n,src:'牧师·神圣领域',id:cs[1].id}).pick,expected:cs[1],duplicateId:SNOWD_SKILL_INDEX.byId['p-skill-123'].map(i=>SNOWD_SKILL_INDEX.rows[i][2])};
  });assert.equal(r.noId,null);assert.equal(r.id.id,r.expected.id);assert.equal(new Set(r.duplicateId).size,2);
 });
 await check('ambiguous source never inferred from character class',async()=>{
  const r=await upload.evaluate(()=>{
   const s={skills:[{n:'魔法飞弹',sub:'',src:''}],talent_tree:[],classes:[{name:'法师',level:12},{name:'术士',level:3}],importIssues:[]};autoCorrect(s);return s;
  });assert.equal(r.skills[0].src,'');assert.ok(!r.skills[0].id);assert.ok(r.importIssues.some(i=>i.kind==='ambiguous'&&i.uid===r.skills[0].uid));
 });
 await check('move / replacement / deletion',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'}),sh=b.Sheets[sheetName];
  for(const col of ['B','D','E','F','H','I','J']){sh[col+'132']=sh[col+'123'];delete sh[col+'123'];}
  let r=await importBytes(upload,encode(b));assert.equal(r.state.skills.find(e=>e.uid==='charge').cellRef,'B132');
  const b2=XLSX.read(bytes,{type:'buffer'});b2.Sheets[sheetName].B123={t:'s',v:'自定义新技能'};
  r=await importBytes(upload,encode(b2));assert.ok(!r.state.skills.some(e=>e.uid==='charge'));assert.ok(r.state.skills.some(e=>e.n==='自定义新技能'&&e.uid!=='charge'));
  delete b2.Sheets[sheetName].B123;r=await importBytes(upload,encode(b2));assert.ok(!r.state.skills.some(e=>e.uid==='charge'));
 });
 await check('metadata isolation between parsed files',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'});delete b.Sheets._SNODE_META;b.SheetNames=b.SheetNames.filter(n=>n!=='_SNODE_META');
  const r=await upload.evaluate(async({a,b})=>{
   const buf=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer;
   const pa=await parseXLSX(buf(a)),pb=await parseXLSX(buf(b)),sa=buildState(pa),sb=buildState(pb);autoCorrect(sa);autoCorrect(sb);return {sa,sb};
  },{a:bytes.toString('base64'),b:encode(b).toString('base64')});stable(r.sa);assert.ok(!r.sb.skills.some(e=>e.uid==='charge'));assert.equal(r.sb.talent_tree.length,5);
 });
 await check('invalid and unsupported metadata are visible issues',async()=>{
  for(const version of ['broken','99']){
   const b=XLSX.read(bytes,{type:'buffer'}),m=b.Sheets._SNODE_META;
   if(version==='broken')delete m.A1;else m.R2={t:'s',v:version};
   const r=await importBytes(upload,encode(b));assert.ok(r.state.skills.some(e=>e.n==='冲锋'));assert.ok(r.state.importIssues.some(i=>i.kind.startsWith('metadata-')));
  }
 });

 await check('metadata v1 compatibility preserves talent and skill UIDs',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'}),m=b.Sheets._SNODE_META;
  for(const k of Object.keys(m))if(/^[ST]\d+$/.test(k))delete m[k];
  m['!ref']='A1:R'+XLSX.utils.decode_range(m['!ref']).e.r;
  for(let row=2;row<=20;row++)if(m['R'+row])m['R'+row]={t:'s',v:'1'};
  const r=await importBytes(upload,encode(b));
  for(const old of initial.skills.concat(initial.talent_tree))assert.ok(r.state.skills.concat(r.state.talent_tree).some(e=>e.uid===old.uid),old.uid);
  assert.equal(r.state._metaStats.edited,0,JSON.stringify({issues:r.state.importIssues.filter(i=>i.kind==="visible-edited"),visible:r.state.skills.map(e=>({n:e.n,visible:e._visible})),baseline:r.meta.rows.filter(m=>m.sheet!=="__STATE__").map(m=>({n:m.name,baseline:m._baseline}))}));assert.equal(r.state.talent_tree.find(e=>e.n==='\u9053\u5177\u5927\u5e08').tier,'\u4e94\u9636');
 });
 await check('same name different domain IDs roundtrip separately',async()=>{
  const s=structuredClone(initial),choices=await upload.evaluate(()=>{
   const io=SNOWD_CHARACTER_IO,n=Object.keys(SNOWD_SKILL_INDEX.byName).find(n=>io.candidates(n).filter(c=>c.cls==='\u7267\u5e08\u00b7\u795e\u5723\u9886\u57df').length>1);
   return io.candidates(n).filter(c=>c.cls==='\u7267\u5e08\u00b7\u795e\u5723\u9886\u57df').slice(0,2);
  });
  s.skills=choices.map((c,i)=>({n:c.name,src:c.cls,id:c.id,sub:'',uid:'domain-'+i,place:'main'}));
  const r=(await importBytes(upload,await exportState(panel,s))).state;
  for(const [i,c]of choices.entries())assert.equal(r.skills.find(e=>e.uid==='domain-'+i).id,c.id);
 });
 await check('edited cost and description keep identity and visible text',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'});b.Sheets[sheetName].H123={t:'s',v:'9'};b.Sheets[sheetName].J123={t:'s',v:'\u73a9\u5bb6\u4fee\u6539 & <\u6587\u672c>'};
  const r=(await importBytes(upload,encode(b))).state,e=r.skills.find(e=>e.uid==='charge');assert.equal(e.ds,'\u73a9\u5bb6\u4fee\u6539 & <\u6587\u672c>');assert.equal(e.cost,'9');assert.ok(r.importIssues.some(i=>i.kind==='visible-edited'&&i.uid==='charge'));
 });
 await check('manual talent move and catalog change stay separate',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'});b.Sheets[sheetName].O157=b.Sheets[sheetName].O150;delete b.Sheets[sheetName].O150;
  const r=(await importBytes(upload,encode(b))).state,e=r.talent_tree.find(e=>e.uid==='talent-0');assert.equal(e.tier,'\u516d\u9636');assert.equal(e.catalogTier,'\u4e94\u9636');assert.ok(r.importIssues.some(i=>i.kind==='catalog-changed'&&i.uid==='talent-0'));
 });
 await check('unknown skills retained with raw data through export',async()=>{
  const s=structuredClone(initial);s.skills=[{n:'\u56e2\u5185\u539f\u521b\u62db\u5f0f',src:'\u81ea\u5b9a\u4e49\u804c\u4e1a',uid:'homebrew',sub:'',ds:'\u5b8c\u6574\u63cf\u8ff0 <\u53ec\u5524\u7269> & \u6570\u636e',free:true,occupies:true,choices:{weapon:'\u5251'}}];
  const r=(await importBytes(upload,await exportState(panel,s))).state,e=r.skills.find(e=>e.uid==='homebrew');assert.equal(e.ds,s.skills[0].ds);assert.deepEqual(e.choices,s.skills[0].choices);assert.equal(e.src,'\u81ea\u5b9a\u4e49\u804c\u4e1a');
 });
 await check('explicit occupancy and conversion preserve independent metadata',async()=>{
  const r=await panel.evaluate(()=>{
   const e={n:'\u51b2\u950b',id:'w-starting-skill-2',src:'\u6218\u58eb',uid:'test-id',free:true,occupies:true,grantedBy:'\u6cd5\u5e08\u5b66\u5f92',selectedOptions:{a:1},ds:'\u539f\u6587'};
   const p=entryToPanelSkill(e),back=panelSkillToEntry(p);
   return {occupant:isMainSkillOccupant(p),back,bad:resolveSkillData({n:'\u51b2\u950b',src:'\u6cd5\u5e08',id:'w-starting-skill-2'}).data};
  });assert.equal(r.occupant,true);assert.equal(r.back.id,'w-starting-skill-2');assert.deepEqual(r.back.selectedOptions,{a:1});assert.equal(r.back.ds,'\u539f\u6587');assert.equal(r.bad,null);
 });
 await check('new classes are recognized by upload',async()=>{
  for(const name of ['\u53ec\u5524\u5e08','\u8c0b\u58eb','\u6218\u821e\u8005']){
   const b=XLSX.read(bytes,{type:'buffer'});b.Sheets[sheetName].B17={t:'s',v:name};
   const r=(await importBytes(upload,encode(b))).state;assert.equal(r.classes[0].name,name);
  }
 });
 await check('upload-page export includes metadata and actual row references',async()=>{
  const r=baseline.state;
  const buf=await upload.evaluate(async({s,b64})=>{
   s._uploadedXlsxBuf=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer;
   await exportXlsxFromState(s);const bytes=new Uint8Array(await window.__ioBlobs.at(-1).arrayBuffer());let raw='';for(const v of bytes)raw+=String.fromCharCode(v);return btoa(raw);
  },{s:r,b64:bytes.toString('base64')});
  const output=Buffer.from(buf,'base64'),b=XLSX.read(output,{type:'buffer'});assert.ok(b.Sheets._SNODE_META);stable((await importBytes(upload,output)).state);
 });


 await check('visible same-name rows select by UID and preserve raw summary',async()=>{
  const result=await panel.evaluate(()=>{
   state.skills=[{n:'\u9b54\u6cd5\u98de\u5f39',src:'\u6cd5\u5e08',uid:'mage-row',ds:'\u6cd5\u5e08\u72ec\u6709\u539f\u6587',tm:'\u4e3b\u8981\u52a8\u4f5c',sub:''},{n:'\u9b54\u6cd5\u98de\u5f39',src:'\u53ec\u5524\u5e08',id:'sm-starting-skill-1',uid:'summoner-row',ds:'\u53ec\u5524\u5e08\u72ec\u6709\u539f\u6587',tm:'\u6b21\u8981\u52a8\u4f5c',sub:''}];
   SB_reinit();renderSkillTables();
   const second=document.querySelector('#mainSkillBody tr[data-uid="summoner-row"]');showSkillDetailRow(second);
   const text=document.getElementById('sdTable').textContent,meta=curDetailSkill.sk;
   document.getElementById('skillOverlay').classList.remove('show');
   return {text,meta,summary:second.textContent};
  });assert.equal(result.meta.uid,'summoner-row');assert.equal(result.meta.cast,'\u6b21\u8981\u52a8\u4f5c');assert.ok(result.text.includes('\u53ec\u5524\u5e08\u72ec\u6709\u539f\u6587'));assert.ok(!result.text.includes('\u6cd5\u5e08\u72ec\u6709\u539f\u6587'));assert.ok(result.summary.includes('\u53ec\u5524\u5e08\u72ec\u6709\u539f\u6587'));
 });


 await check('legacy style in I column and dynamic subclass rows',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'}),sh=b.Sheets[sheetName];
  sh.I123={t:'s',v:'\u6597\u4e89'};sh.B147={t:'s',v:'\u5b50\u804c\u4e1a\uff08\u6218\u58eb\uff09'};
  for(const col of ['B','D','E','F','H','I','J']){sh[col+'149']=sh[col+'168'];delete sh[col+'168'];}
  delete sh.B166;
  const r=await importBytes(upload,encode(b));assert.notEqual(r.state.skills.find(e=>e.cellRef==='B123').src,'\u6597\u4e89');assert.equal(r.state.skills.find(e=>e.cellRef==='B123').rawCategory,'\u6597\u4e89');assert.ok(r.state.skills.some(e=>e.place==='sub'&&e.cellRef==='B149'));
 });
 await check('R-column talent layout preserved on export/readback',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'}),sh=b.Sheets[sheetName];
  for(let row=120;row<=170;row++)if(sh['O'+row]){sh['R'+row]=sh['O'+row];delete sh['O'+row];}
  const buf=encode(b),r=await importBytes(upload,buf);
  assert.ok(r.state.talent_tree.some(e=>e.cellRef==='R150'));stable(r.state);
  const out=await exportState(panel,r.state,buf),after=XLSX.read(out,{type:'buffer'});
  assert.equal(after.Sheets[sheetName].R150.v,'\u9053\u5177\u5927\u5e08');
  const again=(await importBytes(upload,out)).state;stable(again);assert.equal(again._metaStats.edited,0,JSON.stringify(again.importIssues.filter(i=>i.kind==="visible-edited")));
 });
 await check('populated template outranks an empty template',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'}),sh=structuredClone(b.Sheets[sheetName]);
  delete sh.C4;delete sh.B17;XLSX.utils.book_append_sheet(b,sh,'\u7a7a\u767d\u6a21\u677f');b.SheetNames=['\u7a7a\u767d\u6a21\u677f',sheetName,'_SNODE_META'];
  const r=await importBytes(upload,encode(b));assert.equal(r.sheetName,sheetName);stable(r.state);
 });
 await check('clearing source preserves raw choice instead of hidden source override',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'});delete b.Sheets[sheetName].I124;
  const r=(await importBytes(upload,encode(b))).state,e=r.skills.find(e=>e.uid==='bolt');assert.equal(e.src,'');assert.ok(!e.id);assert.ok(r.importIssues.some(i=>i.kind==='ambiguous'&&i.uid==='bolt'));
 });


 await check('panel resolver search supports partial names and typos',async()=>{
  const r=await panel.evaluate(()=>({partial:SNOWD_CHARACTER_IO.search('\u9b54\u6cd5\u98de'),typo:SNOWD_CHARACTER_IO.search('\u9b54\u6cd5\u98de\u65e6')}));
  assert.ok(r.partial.some(c=>c.name==='\u9b54\u6cd5\u98de\u5f39'));assert.ok(r.typo.some(c=>c.name==='\u9b54\u6cd5\u98de\u5f39'));
 });


 await check('skill overflow restores every raw field and duplicate-name UID',async()=>{
  const s=structuredClone(initial);
  s.skills=Array.from({length:42},(_,i)=>({n:i>=40?'\u540c\u540d\u6ea2\u51fa\u62db\u5f0f':'\u81ea\u5b9a\u4e49'+i,src:'\u81ea\u5b9a\u4e49\u804c\u4e1a',uid:'overflow-'+i,sub:'',place:'main',tm:'\u4e3b\u8981\u52a8\u4f5c',range:'18\u7c73',dur:'3\u8f6e',dr:'4',ds:'\u539f\u59cb\u5b8c\u6574\u5185\u5bb9-'+i,choices:{pick:i}}));
  const r=(await importBytes(upload,await exportState(panel,s))).state;assert.equal(r.skills.length,42);
  for(const i of [40,41]){const e=r.skills.find(e=>e.uid==='overflow-'+i);assert.equal(e.ds,'\u539f\u59cb\u5b8c\u6574\u5185\u5bb9-'+i);assert.equal(e.tm,'\u4e3b\u8981\u52a8\u4f5c');assert.equal(e.range,'18\u7c73');assert.deepEqual(e.choices,{pick:i});assert.equal(e.writtenToVisible,false);}
 });


 function moveAbilityCells(book,rowOffset,colOffset){
  const sh=book.Sheets[sheetName],moved={};
  for(const key of Object.keys(sh)){
   if(key.startsWith('!'))continue;const p=XLSX.utils.decode_cell(key);
   if(p.r>=119&&p.r<=208){moved[XLSX.utils.encode_cell({r:p.r+rowOffset,c:p.c+colOffset})]=sh[key];delete sh[key];}
  }
  Object.assign(sh,moved);
  sh['!merges']=(sh['!merges']||[]).map(m=>m.s.r>=119&&m.e.r<=208?{s:{r:m.s.r+rowOffset,c:m.s.c+colOffset},e:{r:m.e.r+rowOffset,c:m.e.c+colOffset}}:m);
  const refs=Object.keys(sh).filter(k=>!k.startsWith('!')).map(k=>XLSX.utils.decode_cell(k));
  sh['!ref']=XLSX.utils.encode_range({s:{r:Math.min(...refs.map(p=>p.r)),c:Math.min(...refs.map(p=>p.c))},e:{r:Math.max(...refs.map(p=>p.r)),c:Math.max(...refs.map(p=>p.c))}});
 }
 await check('section words in prose and K-column fields are not abilities',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'}),sh=b.Sheets[sheetName];
  sh.H18={t:'s',v:'\u8be5\u4e13\u957f\u5141\u8bb8\u73a9\u5bb6\u4ece\u5176\u4ed6\u804c\u4e1a\u7684\u6280\u80fd\u5217\u8868\u6311\u9009\u80fd\u529b\u3002'};
  sh.H19={t:'s',v:'\u6b63\u6587\u63d0\u5230\u5929\u8d4b\u6811\uff0c\u4e0d\u662f\u533a\u57df\u6807\u9898\u3002'};
  sh.K125={t:'s',v:'\u540d\u79f0'};sh.K126={t:'s',v:'\u91d1\u5e01'};
  const r=(await importBytes(upload,encode(b))).state;stable(r);
  assert.equal(r.skills.length,initial.skills.length);assert.equal(r.talent_tree.length,initial.talent_tree.length);
  assert.ok(!r.skills.some(e=>['\u540d\u79f0','\u7c7b\u522b','\u529b\u91cf','\u654f\u6377','\u91d1\u5e01'].includes(e.n)));
 });
 await check('skill and talent regions can move rows and columns',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'});moveAbilityCells(b,35,6);
  const r=(await importBytes(upload,encode(b))).state;stable(r);
  assert.equal(r.skills.find(e=>e.uid==='charge').cellRef,'H158');
  assert.equal(r.talent_tree.find(e=>e.uid==='talent-0').cellRef,'U185');
  assert.equal(r.skills.find(e=>e.uid==='sub-charge').place,'sub');
  assert.equal(r.skills.length,initial.skills.length);
 });

 await check('blank rows between section captions and headings do not break recognition',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'}),sh=b.Sheets[sheetName],shifted={};
  for(const key of Object.keys(sh)){if(key.startsWith('!'))continue;const p=XLSX.utils.decode_cell(key);if(p.r>=121){shifted[XLSX.utils.encode_cell({r:p.r+12,c:p.c})]=sh[key];delete sh[key];}}
  Object.assign(sh,shifted);sh['!merges']=(sh['!merges']||[]).map(m=>m.s.r>=121?{s:{r:m.s.r+12,c:m.s.c},e:{r:m.e.r+12,c:m.e.c}}:m);
  const used=XLSX.utils.decode_range(sh['!ref']);used.e.r+=12;sh['!ref']=XLSX.utils.encode_range(used);
  const r=(await importBytes(upload,encode(b))).state;stable(r);assert.equal(r._importLayoutIssues.length,0);
  assert.equal(r.skills.find(e=>e.uid==='charge').cellRef,'B135');
 });

 await check('ability columns beyond Z do not require template coordinates',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'});moveAbilityCells(b,5,28);
  const r=(await importBytes(upload,encode(b))).state;stable(r);
  assert.equal(r.skills.find(e=>e.uid==='charge').cellRef,'AD128');
  assert.equal(r.talent_tree.find(e=>e.uid==='talent-0').cellRef,'AQ155');
 });
 await check('skill columns reordered by headers retain source and visible baseline',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'}),sh=b.Sheets[sheetName];
  for(let row=122;row<=209;row++){
   if(row>165&&row<167)continue;
   for(const [a,c]of [['D','I'],['E','H']]){const v=sh[a+row];sh[a+row]=sh[c+row];sh[c+row]=v;}
  }
  const r=await importBytes(upload,encode(b));stable(r.state);
  assert.equal(r.state.skills.find(e=>e.uid==='charge').src,'\u6218\u58eb');
  assert.equal(r.state.skills.find(e=>e.uid==='charge').range,'X\u7c73');
  assert.equal(r.state._metaStats.edited,0);
 });
 await check('unknown custom abilities remain in validated tables',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'}),sh=b.Sheets[sheetName];
  sh.B136={t:'s',v:'\u73a9\u5bb6\u81ea\u5b9a\u4e49\u80fd\u529b'};sh.J136={t:'s',v:'\u4fdd\u7559\u5b8c\u6574\u539f\u6587'};
  const r=(await importBytes(upload,encode(b))).state;
  const e=r.skills.find(e=>e.n==='\u73a9\u5bb6\u81ea\u5b9a\u4e49\u80fd\u529b');assert.ok(e);assert.equal(e.ds,'\u4fdd\u7559\u5b8c\u6574\u539f\u6587');
 });
 await check('OOXML encoded line breaks and literal escapes decode once',async()=>{
  const r=await upload.evaluate(()=>{
   const x=SNOWD_CHARACTER_IO.sheet('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>\u6301\u7eed\u65f6\u95f4_x000D_</t></is></c><c r="B1" t="inlineStr"><is><t>_x005F_x0041_</t></is></c></row></sheetData></worksheet>',[]);
   return {header:SNOWD_CHARACTER_LAYOUT.normalize(x.cells.A1),literal:x.cells.B1};
  });assert.equal(r.header,'\u6301\u7eed\u65f6\u95f4');assert.equal(r.literal,'_x0041_');
 });
 await check('unrecognized skill headings are reported and cannot silently save',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'}),sh=b.Sheets[sheetName];
  for(const col of ['B','D','E','F','H','I','J']){sh[col+'122']={t:'s',v:'\u672a\u77e5\u5217-'+col};sh[col+'167']={t:'s',v:'\u672a\u77e5\u5217-'+col};}
  const r=(await importBytes(upload,encode(b))).state;assert.ok(r._importLayoutIssues.length);assert.ok(r.importIssues.some(i=>i.kind==='layout-unrecognized'));
  const count=await upload.evaluate(s=>{pendingState=s;let note='';const original=SD_alert;SD_alert=text=>{note=text;};const before=localStorage.length;confirmImport();SD_alert=original;return {delta:localStorage.length-before,note};},r);
  assert.equal(count.delta,0);assert.ok(count.note.includes('\u8868\u5934'));
 });

 await check('a missing main table header is reported even when the sub table is valid',async()=>{
  const b=XLSX.read(bytes,{type:'buffer'});b.Sheets[sheetName].B122={t:'s',v:'\u62db\u5f0f\u6807\u9898'};
  const r=(await importBytes(upload,encode(b))).state;assert.ok(r._importLayoutIssues.length);assert.ok(r.skills.some(e=>e.place==='sub'));
 });

 const fixtureIndex=process.argv.indexOf('--fixture');
 if(fixtureIndex>=0){
  await check('real attachment has 9 skills and 5 talents without field-label abilities',async()=>{
   const sourceBytes=fs.readFileSync(process.argv[fixtureIndex+1]),result=(await importBytes(upload,sourceBytes)).state;
   assert.equal(result.skills.length,9);assert.equal(result.talent_tree.length,5);
   assert.ok(!result.skills.some(e=>['\u540d\u79f0','\u7c7b\u522b','\u529b\u91cf','\u654f\u6377','\u4f53\u8d28','\u667a\u529b','\u611f\u77e5','\u9b45\u529b','\u610f\u5fd7','\u5e78\u8fd0','\u9644\u8d60\u804c\u4e1a','\u5c5e\u6027\u4fe1\u606f'].includes(e.n)));
   assert.equal(result._metaStats.applied,5);assert.equal(result._metaStats.edited,0);
   assert.equal(result.skills.find(e=>e.n==='\u6d3b\u706b\u7130').via,'\u9b54\u6cd5\u4e13\u5bb6');
   assert.ok(result.skills.some(e=>e.n==='\u85e4\u66fc\u4e4b\u5899'));assert.equal(result.importIssues.filter(i=>i.kind==='typo-candidate').length,1);
  });
 }

 await check('source dialog targets UID / independent free and occupies',async()=>{
  await upload.evaluate(s=>{pendingState=s;openIssueResolver('bolt',s);},baseline.state);
  const box=upload.locator('#characterIssueDialog'),label=await box.locator('select[aria-label="技能候选"] option').filter({hasText:'召唤师'}).first().textContent();
  await box.getByLabel('技能候选').selectOption({label});await box.getByLabel('免费获得').check();await box.getByLabel('占用栏位').check();await box.getByRole('button',{name:'保存',exact:true}).click();
  const r=await upload.evaluate(()=>pendingState.skills.find(e=>e.uid==='bolt'));assert.equal(r.src,'召唤师');assert.equal(r.free,true);assert.equal(r.occupies,true);assert.equal(r.freeSlot,false);
 });
 await check('real upload -> confirm -> save -> panel reopen',async()=>{
  await upload.locator('#fileInput').setInputFiles({name:'fixture.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:bytes});
  await upload.locator('#xpSpConfirmBtn').click();
  await upload.waitForFunction(()=>document.getElementById('previewPanel').style.display==='block'||Array.from(document.querySelectorAll('button')).some(b=>b.getAttribute('onclick')==='confirmImport()'&&b.offsetParent));

  assert.equal(await upload.locator('#errorMsg').isVisible(),false,await upload.locator('#errorMsg').innerText());
  await upload.locator('button[onclick="confirmImport()"]:visible').last().click();
  const saved=await upload.evaluate(()=>{const id=pendingState._charName;return {id,json:localStorage.getItem('char_'+id+'_slot1')};});stable(JSON.parse(saved.json));
  await panel.evaluate(({id,json})=>{localStorage.setItem('char_'+id+'_slot1',json);},saved);
  await panel.goto(pathToFileURL(path.join(dir,'角色面板.html')).href+'?char='+encodeURIComponent(saved.id)+'&slot=1',{waitUntil:'load'});stable(await panel.evaluate(()=>state));
 });
 async function visualChecks(p,setWidth){
  for(const width of [360,390,1440]){
   await setWidth(width);
   await p.evaluate(()=>{state.classes[0]={name:'法师',level:12,styles:['咒法','变形','',''],keyAttr:'智力'};state.skills=[{n:'变形术·野猪',src:'法师',sub:'',uid:'unit-test'},{n:'玩家技能',src:'',sub:'',uid:'raw-test',ds:'玩家完整说明 & <原文>'}];SB_reinit();renderSkillTables();});
   await p.locator('#mainSkillBody tr[data-name="变形术·野猪"]').click();
   const actual=await p.locator('#sdTable').innerText();assert.ok(actual.includes('野猪'));assert.ok(actual.includes('生命值'));assert.ok(actual.includes('力量'),actual);
   await p.evaluate(()=>document.getElementById('skillOverlay').classList.remove('show'));
   await p.evaluate(()=>showSkillDetail('法师','变形术·野猪'));assert.ok((await p.locator('#modalOverlay').innerText()).includes('生命值'));await p.evaluate(()=>closeReplaceModal());
   await p.evaluate(()=>openIssueResolver('raw-test',state));
   const dims=await p.locator('#characterIssueDialog section').evaluate(e=>({right:e.getBoundingClientRect().right,left:e.getBoundingClientRect().left,width:innerWidth,sw:e.scrollWidth,cw:e.clientWidth}));
   assert.ok(dims.right<=dims.width+1&&dims.left>=0&&dims.sw<=dims.cw+1);await p.keyboard.press('Escape');assert.equal(await p.locator('#characterIssueDialog').count(),0);
  }
 }
 await check('Chromium visible details and dialog 360/390/1440',()=>visualChecks(panel,w=>panel.setViewportSize({width:w,height:900})));
 await check('no unhandled renderer errors',async()=>assert.deepEqual(pageErrors,[]));
 await ctx.close();await browser.close();browser=null;
 if(process.argv.includes('--electron')){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'character-io-electron-')),profile=path.join(tmp,'profile'),boot=path.join(tmp,'bootstrap.cjs');
  fs.mkdirSync(profile);fs.writeFileSync(boot,`const {app,BrowserWindow}=require('electron');app.disableHardwareAcceleration();app.setPath('userData',${JSON.stringify(profile)});app.setPath('sessionData',${JSON.stringify(profile)});app.whenReady().then(()=>{const w=new BrowserWindow({show:false,width:1440,height:900,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});w.loadURL('about:blank');});app.on('window-all-closed',()=>app.quit());`);
  try{
   electron=await _electron.launch({executablePath:require('./electron-app/node_modules/electron'),args:[boot]});
   const p=await electron.firstWindow();await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());await configure(p);
   await check('Electron 22 import/export and UI 360/390/1440',async()=>{
    await p.goto(pathToFileURL(path.join(dir,'上传角色.html')).href,{waitUntil:'load'});stable((await importBytes(p,bytes)).state);await configure(p);
    assert.ok(XLSX.read(await exportState(p,initial),{type:'buffer'}).Sheets._SNODE_META);
    await visualChecks(p,async w=>{await electron.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setContentSize(width,900),w);await p.waitForFunction(w=>innerWidth===w,w,{timeout:5000,polling:50});});
   });
  }finally{
   if(electron){await electron.close();electron=null;}
   const resolved=path.resolve(tmp),expected=path.resolve(os.tmpdir())+path.sep;
   if(!resolved.startsWith(expected)||!path.basename(resolved).startsWith('character-io-electron-'))throw Error('unexpected temporary path');
   fs.rmSync(resolved,{recursive:true,force:true,maxRetries:3});
  }
 }
}catch(e){failures.push(e.stack);console.error(e.stack);}
finally{if(browser)await browser.close();if(electron)await electron.close();}
console.log('Character I/O: '+passed+'P '+failures.length+'F');if(failures.length)process.exitCode=1;
})();
})();
