
// Scalar, class, auxiliary-sheet and source-workbook integrity gate.
// Independent, anonymous fixtures are always tested; personal files only when --fixture is provided.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),{pathToFileURL}=require('url');
const {chromium,_electron}=require('playwright'),X=require('xlsx'),root=__dirname,dir=path.join(root,'斯诺德跑团');
let browser,electron,passes=0;const failures=[],errors=[];
async function check(name,fn){try{await fn();passes++;console.log('PASS '+name);}catch(e){failures.push(name+': '+e.message);console.error('FAIL '+name+'\n'+e.stack);}}
const bytes=b=>X.write(b,{bookType:'xlsx',type:'buffer',bookSST:true,compression:true});
function fixture(){
 const b=X.utils.book_new(),s={},v=(ref,value)=>s[ref]={t:typeof value==='number'?'n':'s',v:value};
 Object.entries({B2:'基础信息',B3:'玩家名称',C3:'匿名',B4:'角色名称',C4:'完整导入回归',B5:'种族',C5:'人类',K3:'生命值',L3:216,K4:'疲劳值',L4:28,K7:'防御等级',L7:22,K8:'先攻值',L8:7,K9:'基础速度',L9:'7米/9米',K10:'关键属性',L10:'智力',K11:'攻击命中',L11:0,K12:'法术命中',L12:-2,B14:'职业信息',B15:'主职业',B16:'名称',D16:'等级',E16:'风格',B17:'指挥官',D17:15,B21:'子职业',B22:'名称',D22:'等级',B23:'密探',D23:9,B27:'附赠职业',B28:'名称',D28:'等级',B29:'战士',D29:3,G14:'背景故事',G15:'法师学徒',Q6:'语言',R6:'通用语、精灵语',U33:'目前经验：2030',U34:'目前技能点：3',B34:'属性信息',I44:'装备栏',I46:'武器',K46:'名称',M46:'效果',T46:'磅重',I52:'服饰',K52:'魔钢重铠',M52:'自定义备注',T52:80,I56:'配饰',K56:'战术家的棋局',T56:3,I61:'背包',K61:'治愈药水',T61:'3瓶',B120:'技能列表',B121:'主职业（50）',B122:'技能名称',D122:'施展时间',E122:'施展距离',F122:'持续时间\n疲劳值消耗',H122:'疲劳值消耗',I122:'类别',J122:'效果',B123:'无名战术',D123:'1动作',E123:'12米',F123:'1分钟',H123:0,I123:'长休1',J123:'玩家完整原文',B124:'条件防护',D124:'逆境说明原文',F124:'1分钟',H124:'X',B147:'子职业（20）',B148:'技能名称',D148:'施展时间',E148:'施展距离',F148:'持续时间',H148:'疲劳消耗',J148:'效果',B149:'副职业能力',J149:'副职原文',B175:'战士附赠职业（4）',B176:'技能名称',D176:'施展时间',E176:'施展距离',F176:'持续时间',H176:'疲劳消耗',J176:'效果',B177:'剧情战技',J177:'赠送原文',O120:'天赋列表',O121:'一阶天赋树（5）',O122:'剧情祝福',Q122:'完整祝福说明',U2:'指挥官进阶战术表（已习得）',U3:'测试进阶战术',V3:'完整战术说明',U16:'战术家棋局战术',U17:'堡垒',V17:'装备条件原文'}).forEach(([r,a])=>v(r,a));
 const ar={力量:36,敏捷:46,体质:57,智力:62,感知:87,魅力:100,意志:110,幸运:116};for(const [n,r]of Object.entries(ar)){v('B'+r,n);v('C'+r,n==='智力'?18:12);}
 s['!merges']=['B120:M120','B121:M121','B147:M147','B175:M175','O120:S120','O121:S121','O122:P122','Q122:S122','D124:E124','U2:V2','U16:V16'].map(X.utils.decode_range);s['!ref']='B2:V179';
 X.utils.book_append_sheet(b,s,'角色');X.utils.book_append_sheet(b,X.utils.aoa_to_sheet([['未来计划','时空大法师'],['技能参考','不应成为已学技能']]),'发展方向');X.utils.book_append_sheet(b,X.utils.aoa_to_sheet([['敌人','哥布林']]),'敌人');return b;
}
async function read(p,buffer){const url=pathToFileURL(path.join(dir,'上传角色.html')).href;await p.goto(url,{waitUntil:'load'});return p.evaluate(async b64=>{await ensureSkillDataForExport();const parsed=await parseXLSX(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer);const s=buildState(parsed);autoCorrect(s);return {s,parsed:{cells:parsed.cells,sheetName:parsed.sheetName,merges:parsed.merges,meta:parsed.meta}};},Buffer.from(buffer).toString('base64'));}
function capture(){window.__integrityBlobs=[];URL.createObjectURL=b=>{window.__integrityBlobs.push(b);return 'blob:integrity';};HTMLAnchorElement.prototype.click=function(){};}
async function write(p,s,buffer){return Buffer.from(await p.evaluate(async({s,b64})=>{state=JSON.parse(JSON.stringify(s));if(b64)state._uploadedXlsxBuf=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer;await exportXlsxFromState(state);const a=new Uint8Array(await window.__integrityBlobs.at(-1).arrayBuffer());let raw='';for(const n of a)raw+=String.fromCharCode(n);return btoa(raw);},{s,b64:buffer?Buffer.from(buffer).toString('base64'):null}),'base64');}
function uids(s){return s.skills.concat(s.talent_tree,s.blueprints).map(e=>e.uid).sort();}
async function fit(p,resize,s){for(const w of [360,390,1440]){await resize(w);for(const fn of ['openClassResolver','openCombatStatResolver']){await p.evaluate(({s,fn})=>{state=s;window[fn](state);},{s,fn});const d=await p.locator('#characterIssueDialog section').evaluate(e=>({l:e.getBoundingClientRect().left,r:e.getBoundingClientRect().right,w:innerWidth,s:e.scrollWidth,c:e.clientWidth}));assert.ok(d.l>=0&&d.r<=d.w+1&&d.s<=d.c+1,JSON.stringify(d));await p.keyboard.press('Escape');}}}
(async()=>{try{
 browser=await chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());await ctx.addInitScript(capture);
 const upload=await ctx.newPage(),panel=await ctx.newPage();for(const p of [upload,panel])p.on('pageerror',e=>errors.push(e.message));
 await upload.goto(pathToFileURL(path.join(dir,'上传角色.html')).href,{waitUntil:'load'});await panel.goto(pathToFileURL(path.join(dir,'角色面板.html')).href,{waitUntil:'load'});
 const source=bytes(fixture()),base=(await read(upload,source)).s;
 await check('structural totals, compound duration, gift ownership and real class names',async()=>{
  assert.equal(base.hp,216);assert.equal(base.fp,28);assert.equal(base.combatValues.atk,0);assert.equal(base.combatValues.spell,-2);assert.equal(base.combatValues.ac,22);assert.equal(base.xp,2030);assert.equal(base.sp_points,3);
  assert.deepEqual(base.classes.map(c=>c.name),['指挥官','密探','战士']);assert.equal(base.skills.find(e=>e.n==='无名战术').dur,'1分钟');assert.equal(base.skills.find(e=>e.n==='剧情战技').ownerClassIndex,2);
  assert.equal(base.skills.find(e=>e.n==='条件防护').tm,'');assert.equal(base.skills.find(e=>e.n==='条件防护').range,'');assert.equal(base.skills.find(e=>e.n==='条件防护').mergedNotes[0].raw,'逆境说明原文');
  assert.equal(base.skills.length,6);assert.equal(base.talent_tree.length,1);assert.equal(base.equipment.服饰[0].item,'魔钢重铠');assert.equal(base.equipment.背包[0].weightStatus,'quantity');assert.equal(base.equipment.背包[0].count,3);assert.deepEqual(base.languages,['通用语','精灵语']);assert.equal(base.supportingSheets.length,2);
 });
 await check('validation is pure and panel respects fixed max/current combat values',async()=>{
  const unchanged=await upload.evaluate(s=>{const before=JSON.stringify(s);validateState(s);validateState(s);return before===JSON.stringify(s);},base);assert.ok(unchanged);
  const r=await panel.evaluate(s=>{state=s;state._hpCurrent=13;state._fpCurrent=0;SB_reinit();SB_reinit();renderInit();return {s:state,b:T.battle,init:document.getElementById('initItem').textContent};},base);
  assert.equal(r.s.hp,216);assert.equal(r.s.fp,28);assert.equal(r.s._hpCurrent,13);assert.equal(r.s._fpCurrent,0);assert.equal(r.b.ac,22);assert.equal(r.b.atk,0);assert.equal(r.b.spell,-2);assert.ok(r.init.includes('+7'));
 });
 await check('advanced rule confirmation has no leveling, charges or reward side effects',async()=>{
  await panel.evaluate(s=>{state=s;openClassResolver(state);},base);const d=panel.locator('#characterIssueDialog');
  await d.getByLabel('主职业规则基础', {exact:true}).selectOption('战士');await d.getByLabel('子职业规则基础',{exact:true}).selectOption('吟游诗人');await d.getByRole('button',{name:'保存职业确认',exact:true}).click();
  const s=await panel.evaluate(()=>state);assert.equal(s.classes[0].name,'指挥官');assert.equal(s.classes[1].name,'密探');assert.equal(s.classes[0].baseClass,'战士');assert.equal(s.classes[1].baseClass,'吟游诗人');assert.equal(s.xp,2030);assert.equal(s.sp_points,3);assert.deepEqual(uids(s),uids(base));assert.equal(s.hp,216);
  base.classes=s.classes;
 });
 await check('three source-layout cycles preserve class policy, identity, text, quantity and reference sheets',async()=>{
  let s=structuredClone(base),buf=source;s._hpCurrent=13;s._fpCurrent=0;
  for(let i=0;i<3;i++){
   buf=await write(panel,s,buf);const b=X.read(buf,{type:'buffer'});assert.deepEqual(b.SheetNames.filter(n=>n!=='_SNODE_META'),['角色','发展方向','敌人']);assert.equal(b.Sheets.角色.D124.v,'逆境说明原文');assert.equal(b.Sheets.角色.F123.v,'1分钟');assert.equal(b.Sheets.角色.B177.v,'剧情战技');
   s=(await read(upload,buf)).s;assert.deepEqual(uids(s),uids(base));assert.equal(s.hp,216);assert.equal(s.fp,28);assert.equal(s.classes[0].baseClass,'战士');assert.equal(s.classes[1].baseClass,'吟游诗人');assert.equal(s._hpCurrent,13);assert.equal(s._fpCurrent,0);assert.equal(s.equipment.背包[0].count,3);assert.equal(s.skills.find(e=>e.n==='无名战术').usageLimit,'长休1');assert.equal(s._metaStats.edited,0,JSON.stringify(s.importIssues.filter(i=>i.kind==='visible-edited')));
  }
 });
 await check('explicit rules mode survives both export paths and responds to attribute changes',async()=>{
  const s=await upload.evaluate(s=>{SNOWD_CHARACTER_STATS.set(s,'hp',null,'rules',{origin:'rules'});SNOWD_CHARACTER_STATS.set(s,'fp',null,'rules',{origin:'rules'});SNOWD_CHARACTER_STATS.synchronize(s);return s;},base);
  for(const p of [upload,panel]){
   const r=(await read(upload,await write(p,s,source))).s;assert.equal(r.combatStats.fields.hp.mode,'rules');assert.equal(r.hp,s.hp);
   const changed=await panel.evaluate(s=>{state=s;state.attrs.体质+=2;SB_reinit();return state.hp;},r);assert.ok(changed>s.hp);
  }
 });
 await check('Excel visible zero overrides metadata; cleared/uncached numeric totals remain reviewable',async()=>{
  const b=X.read(await write(panel,base,source),{type:'buffer'});b.Sheets.角色.L3={t:'n',v:0};let s=(await read(upload,bytes(b))).s;assert.equal(s.hp,0);assert.equal(s.combatStats.fields.hp.mode,'fixed');
  delete b.Sheets.角色.L3;s=(await read(upload,bytes(b))).s;assert.equal(s.hp,null);assert.ok(s.importIssues.some(i=>i.kind==='field-cleared'));
  const statuses=await upload.evaluate(()=>['',0,'-2','oops'].map(raw=>SNOWD_CHARACTER_FIELDS.numeric(raw,null,true).status).concat(SNOWD_CHARACTER_FIELDS.numeric('',{cached:false,formula:'1+2'},true).status));assert.deepEqual(statuses,['missing','valid','invalid','invalid','uncached']);
 });
 await check('merged note assignment keeps raw text once and removes only its cross-field merge',async()=>{
  await panel.evaluate(s=>{state=s;openMergedNoteResolver(state.skills.find(e=>e.n==='条件防护').uid,state);},base);const d=panel.locator('#characterIssueDialog');await d.getByRole('button',{name:'保存原文归属',exact:true}).click();
  const s=await panel.evaluate(()=>state),out=await write(panel,s,source),b=X.read(out,{type:'buffer'}),again=(await read(upload,out)).s;
  assert.ok(!b.Sheets.角色['!merges'].some(m=>X.utils.encode_range(m)==='D124:E124'));assert.equal(again.skills.find(e=>e.n==='条件防护').ds,'逆境说明原文');assert.equal(again.skills.find(e=>e.n==='条件防护').tm,'');
 });
 await check('source cache survives page reload and retains auxiliary sheets without an in-memory buffer',async()=>{
  const key=await upload.evaluate(async b64=>SNOWD_CHARACTER_WORKBOOK_CACHE.put(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer),source.toString('base64'));
  const s=structuredClone(base);s.importWorkbookKey=key;await panel.reload({waitUntil:'load'});const out=await write(panel,s);assert.ok(X.read(out,{type:'buffer'}).Sheets.敌人);const fresh=(await read(upload,out)).s;assert.deepEqual(uids(fresh),uids(base));assert.equal(fresh.hp,216);
 });
 await check('portable metadata retains reference sheets when original workbook cache is unavailable',async()=>{
  const s=structuredClone(base);delete s.importWorkbookKey;const out=await write(panel,s);const b=X.read(out,{type:'buffer'});assert.equal(b.Sheets.发展方向.A2.v,'技能参考');assert.equal(b.Sheets.敌人.B1.v,'哥布林');const r=(await read(upload,out)).s;assert.deepEqual(uids(r),uids(base));assert.equal(r.equipment.服饰[0].item,'魔钢重铠');assert.equal(r.equipment.背包[0].count,3);
 });
 await check('class/stat confirmation dialogs fit 360, 390 and 1440 viewports',()=>fit(panel,w=>panel.setViewportSize({width:w,height:900}),base));
 // User-supplied inputs remain outside the repository; expectations come from manual source inspection.
 const personal=[];for(let i=2;i<process.argv.length;i++)if(process.argv[i]==='--fixture')personal.push(process.argv[++i]);
 for(const file of personal)await check('personal read-only workbook: '+path.basename(file),async()=>{
  const source=fs.readFileSync(file),hash=crypto.createHash('sha256').update(source).digest('hex');let s=(await read(upload,source)).s;
  const isGan=path.basename(file).includes('甘九'),isNolan=path.basename(file).includes('诺兰'),isFei=path.basename(file).includes('冯旷');
  const expected=isGan?[216,28,22,24]:isNolan?[86,62,51,31]:isFei?[170,45,49,33]:null;assert.ok(expected,'unknown personal fixture expectation');
  assert.deepEqual([s.hp,s.fp,s.skills.length,s.talent_tree.length],expected);
  if(isNolan){assert.equal(s.skills.filter(e=>e.ownerClassIndex===2).length,3);assert.equal(s.classes[1].name,'法师');assert.equal(s.classes[1].level,6);assert.equal(s.classes[1].levelMeaning,'unconfirmed');assert.ok(s.importCandidates.some(c=>c.name==='仪式魔法'));}
  if(isFei){assert.equal(s.classes[0].name,'指挥官');assert.equal(s.classes[1].name,'密探');assert.equal(s.skills.filter(e=>e.origin&&e.origin.type==='equipment').length,3);assert.equal(s.xp,2030);assert.equal(s.sp_points,3);assert.equal(s.supportingSheets.length,12);assert.equal(s.equipment.配饰.length,5);}
  let buf=source,ids=uids(s);for(let i=0;i<3;i++){buf=await write(i===1?upload:panel,s,buf);s=(await read(upload,buf)).s;assert.deepEqual([s.hp,s.fp,s.skills.length,s.talent_tree.length],expected);assert.deepEqual(uids(s),ids);assert.equal(s._metaStats.edited,0,JSON.stringify(s.importIssues.filter(i=>i.kind==='visible-edited')));}
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash);
 });

 await check('extra feat confirmation is visible and stable through export, with no invented level',async()=>{
  const s=structuredClone(base);s.importCandidates=[{uid:'loose-feat',kind:'feat',name:'仪式魔法',raw:'仪式魔法',cellRef:'O36',sheet:'角色',status:'pending'}];
  await panel.evaluate(s=>{state=s;openImportCandidateResolver('loose-feat',state);},s);const d=panel.locator('#characterIssueDialog');await d.getByLabel('原文用途').selectOption('owned');await d.getByRole('button',{name:'保存用途确认',exact:true}).click();
  let current=await panel.evaluate(()=>state),buf=source;for(let i=0;i<2;i++){buf=await write(panel,current,buf);const b=X.read(buf,{type:'buffer'});assert.ok(Object.values(b.Sheets.角色).some(c=>c&&c.v==='额外专长列表'));current=(await read(upload,buf)).s;const feat=current.special_feats.find(f=>f.name==='仪式魔法');assert.ok(feat);assert.equal(feat.level,null);assert.equal(feat.uid,'feat-loose-feat');}
 });
 await check('repeated-class records require explicit meaning and preserve continuation totals',async()=>{
  const b=fixture();b.Sheets.角色.B17={t:'s',v:'法师'};b.Sheets.角色.B23={t:'s',v:'法师'};b.Sheets.角色.D17={t:'n',v:15};b.Sheets.角色.D23={t:'n',v:6};const source=bytes(b),s=(await read(upload,source)).s;assert.equal(s.classes[1].levelMeaning,'unconfirmed');
  await panel.evaluate(s=>{state=s;openClassResolver(state);},s);const d=panel.locator('#characterIssueDialog');await d.getByLabel('同名职业记录含义').selectOption('continuation');await d.getByLabel('确认后的主职业总等级').fill('16');await d.getByRole('button',{name:'保存职业确认',exact:true}).click();const current=await panel.evaluate(()=>state),r=(await read(upload,await write(panel,current,source))).s;
  assert.equal(r.classes[0].level,15);assert.equal(r.classes[1].level,6);assert.equal(r.classes[0].confirmedTotalLevel,16);assert.equal(r.classes[1].ruleEnabled,false);assert.equal(r.hp,216);assert.equal(r.xp,2030);
 });
 await check('numeric battle use accepts zero and stops variable or unequipped abilities',async()=>{
  const result=await panel.evaluate(s=>{state=s;SB_reinit();S.battle=true;S.fp=28;var messages=[];var original=SD_alert;SD_alert=function(x){messages.push(x);};useSkill('无名战术',state.skills.find(e=>e.n==='无名战术').uid);var afterZero=S.fp;useSkill('条件防护',state.skills.find(e=>e.n==='条件防护').uid);state.equipment.配饰=[];useSkill('堡垒',state.skills.find(e=>e.n==='堡垒').uid);SD_alert=original;return {afterZero:afterZero,fp:S.fp,used:S.usage['无名战术'],messages:messages,skills:SKILLS.main.map(s=>({n:s.n,fp:s.fp,eq:s.requiresEquipment})),battle:S.battle};},base);
  assert.equal(result.afterZero,28);assert.equal(result.fp,28);assert.equal(result.used,1);assert.equal(result.messages.length,2,JSON.stringify(result));
 });
 await check('actual upload saves an unresolved advanced-class draft and reopens with original workbook retained',async()=>{
  await upload.reload({waitUntil:'load'});await upload.evaluate(()=>{window.__importAlerts=[];SD_alert=x=>{__importAlerts.push(x);};});
  await upload.locator('#fileInput').setInputFiles({name:'anonymous-integrity.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:source});await upload.locator('#xpSpConfirmBtn').click();await upload.waitForFunction(()=>pendingState&&!!document.getElementById('importIssuesHost'));
  const before=await upload.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('char_')).length);
  await upload.evaluate(()=>confirmImport());assert.equal(await upload.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('char_')).length),before);assert.ok(await upload.locator('#characterIssueDialog').count());await upload.keyboard.press('Escape');
  await upload.getByRole('button',{name:'保存导入草稿',exact:true}).click();await upload.waitForFunction(()=>pendingState&&pendingState.importWorkbookKey);
  const saved=await upload.evaluate(()=>({id:pendingState._charName,json:localStorage.getItem('char_'+pendingState._charName+'_slot1')}));const s=JSON.parse(saved.json);assert.equal(s.importDraft,true);assert.equal(s.hp,216);assert.equal(s.classes[0].name,'指挥官');assert.ok(s.importWorkbookKey);
  await panel.evaluate(saved=>localStorage.setItem('char_'+saved.id+'_slot1',saved.json),saved);await panel.goto(pathToFileURL(path.join(dir,'角色面板.html')).href+'?char='+encodeURIComponent(saved.id)+'&slot=1',{waitUntil:'load'});const restored=await panel.evaluate(()=>state);assert.equal(restored.importDraft,true);assert.equal(restored.hp,216);const out=await write(panel,restored);assert.ok(X.read(out,{type:'buffer'}).Sheets.敌人);await upload.goto(pathToFileURL(path.join(dir,'上传角色.html')).href,{waitUntil:'load'});
 });

 await check('manual remapping updates untouched duration and retains explicit player text and UID',async()=>{
  const s=(await read(upload,source)).s,e=s.skills.find(e=>e.n==='无名战术'),uid=e.uid;e.dur='';e._visible.dur='';e.ds='玩家编辑的完整效果';
  const r=await upload.evaluate(s=>{const parsed=Object.assign({},pendingParsed);parsed.layoutMappings=[{sheet:parsed.sheetName,range:'B123:M124',place:'main',fields:{name:'B',tm:'D',range:'E',dur:'F',dr:'H',src:'I',ds:'J'}}];rebuildImportLayout(s,parsed);return s;},s);
  const changed=r.skills.find(e=>e.uid===uid);assert.ok(changed);assert.equal(changed.dur,'1分钟');assert.equal(changed.ds,'玩家编辑的完整效果');assert.ok(r.importIssues.some(i=>i.kind==='mapping-conflict'&&i.uid===uid));
 });
 await check('compound feat cell requires chosen option and does not turn backups into owned feats',async()=>{
  const b=fixture();Object.assign(b.Sheets.角色,{I34:{t:'s',v:'特殊专长'},I36:{t:'s',v:'4级'},K36:{t:'s',v:'健壮 / 健美教练'}});b.Sheets.角色['!merges'].push(X.utils.decode_range('I34:M35'),X.utils.decode_range('I36:J37'));const buffer=bytes(b),s=(await read(upload,buffer)).s,c=s.importCandidates.find(c=>c.kind==='feat-options');assert.ok(c);
  await panel.evaluate(({s,uid})=>{state=s;openImportCandidateResolver(uid,state);},{s,uid:c.uid});const d=panel.locator('#characterIssueDialog');await d.getByLabel('原文用途').selectOption('owned');await d.getByLabel('健壮 ',{exact:true}).check();await d.getByRole('button',{name:'保存用途确认',exact:true}).click();
  const selected=await panel.evaluate(()=>state);assert.ok(selected.special_feats.some(f=>f.name==='健壮'));assert.ok(!selected.special_feats.some(f=>f.name==='健美教练'));const r=(await read(upload,await write(panel,selected,buffer))).s;assert.ok(r.special_feats.some(f=>f.name==='健壮'));assert.ok(!r.special_feats.some(f=>f.name==='健美教练'));assert.ok(!r.special_feats.some(f=>f.name==='健壮 / 健美教练'));
 });

 await check('panel save/reload retains a non-first character sheet and never writes over notes',async()=>{
  const b=fixture();X.utils.book_append_sheet(b,X.utils.aoa_to_sheet([['笔记','原始备注不可覆盖']]),'笔记');b.SheetNames=['笔记','角色','发展方向','敌人'];const buffer=bytes(b),s=(await read(upload,buffer)).s;s.name='多表保存回归';s.importWorkbookKey=await panel.evaluate(async b64=>SNOWD_CHARACTER_WORKBOOK_CACHE.put(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer),buffer.toString('base64'));
  const id=await panel.evaluate(s=>{state=s;CURRENT_CHAR=s.name;CURRENT_SLOT=1;saveState();return CURRENT_CHAR;},s);await panel.goto(pathToFileURL(path.join(dir,'角色面板.html')).href+'?char='+encodeURIComponent(id)+'&slot=1',{waitUntil:'load'});const restored=await panel.evaluate(()=>state);assert.equal(restored._xlsxSheetPath,s._xlsxSheetPath);const out=X.read(await write(panel,restored),{type:'buffer'});assert.equal(out.Sheets.笔记.A1.v,'笔记');assert.equal(out.Sheets.笔记.B1.v,'原始备注不可覆盖');assert.equal(out.Sheets.笔记.B17,undefined);assert.equal(out.Sheets.角色.L3.v,216);
 });

 await check('confirmed advanced classes expose their base skill catalogue while retaining display identity',async()=>{
  const r=await panel.evaluate(s=>{state=s;SB_reinit();renderLearnPanel();Object.keys(window._learnCollapsed||{}).forEach(function(k){window._learnCollapsed[k]=false;});renderLearnPanel();return {html:document.getElementById('learnResults').innerHTML,text:document.getElementById('learnResults').textContent,names:state.classes.map(c=>c.name)};},base);
  assert.ok(r.text.includes('指挥官（规则基础：战士）'));assert.ok(r.text.includes('密探（规则基础：吟游诗人）'));assert.deepEqual(r.names,['指挥官','密探','战士']);assert.ok(r.html.includes('showSkillDetail'));
 });

 await check('reopening a confirmed variant keeps its base identity, name and player parameters',async()=>{
  const s=await panel.evaluate(s=>{const pick=SNOWD_CHARACTER_IO.candidates('魔爆术').find(c=>c.cls==='法师');if(!pick)throw Error('missing base definition');const e=s.skills[0];e.n='魔爆术-奥枢强化';e.src=pick.cls;e.id=pick.id;e.resolution='variant';e.baseDefinition={name:pick.name,src:pick.cls,id:pick.id};e.dr='3';e.dur='2回合';state=s;openIssueResolver(e.uid,state);return s;},base);
  const d=panel.locator('#characterIssueDialog');assert.ok((await d.getByLabel('技能候选').inputValue())!=='');await d.getByLabel('完整效果与说明').fill('玩家强化说明');await d.getByRole('button',{name:'保存',exact:true}).click();const current=await panel.evaluate(()=>state),e=current.skills.find(e=>e.uid===s.skills[0].uid);assert.equal(e.n,'魔爆术-奥枢强化');assert.equal(e.resolution,'variant');assert.equal(e.dr,'3');assert.equal(e.dur,'2回合');assert.equal(e.ds,'玩家强化说明');
  const r=(await read(upload,await write(panel,current,source))).s,restored=r.skills.find(n=>n.uid===e.uid);assert.equal(restored.resolution,'variant');assert.deepEqual(restored.baseDefinition,e.baseDefinition);assert.equal(restored.n,e.n);assert.equal(restored.dr,'3');
 });

 await check('missing total labels require confirmation and manual totals get portable visible bindings',async()=>{
  const b=fixture();b.Sheets.角色.K3={t:'s',v:'玩家自定义生命标题'};b.Sheets.角色.K4={t:'s',v:'玩家自定义疲劳标题'};const buffer=bytes(b),s=(await read(upload,buffer)).s;
  assert.ok(s.importIssues.some(i=>i.kind==='field-invalid'&&i.field==='hp'));const fixed=await panel.evaluate(s=>{SNOWD_CHARACTER_STATS.set(s,'hp',321,'fixed',{origin:'manual'});SNOWD_CHARACTER_STATS.set(s,'fp',76,'fixed',{origin:'manual'});return s;},s);
  const r=(await read(upload,await write(panel,fixed,buffer))).s;assert.equal(r.hp,321);assert.equal(r.fp,76);assert.ok(r.fieldSources.scalar.hp.cellRef);assert.equal(r.combatStats.fields.hp.mode,'fixed');
 });
 await check('no unhandled renderer errors',async()=>assert.deepEqual(errors,[]));
 await browser.close();browser=null;
 if(process.argv.includes('--electron')){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'character-integrity-')),profile=path.join(tmp,'profile'),boot=path.join(tmp,'boot.cjs');fs.mkdirSync(profile);
  fs.writeFileSync(boot,"const {app,BrowserWindow}=require('electron');app.disableHardwareAcceleration();app.setPath('userData',"+JSON.stringify(profile)+");app.setPath('sessionData',"+JSON.stringify(profile)+");app.whenReady().then(()=>{const w=new BrowserWindow({show:false,width:1440,height:900,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});w.loadURL('about:blank');});app.on('window-all-closed',()=>app.quit());");
  try{electron=await _electron.launch({executablePath:require('./electron-app/node_modules/electron'),args:[boot]});const p=await electron.firstWindow();await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());await p.addInitScript(capture);await p.goto(pathToFileURL(path.join(dir,'角色面板.html')).href,{waitUntil:'load'});
   await check('Electron combat/class dialogs and exports at 360/390/1440',async()=>{assert.ok(X.read(await write(p,base,source),{type:'buffer'}).Sheets._SNODE_META);await fit(p,async w=>{await electron.evaluate(({BrowserWindow},w)=>BrowserWindow.getAllWindows()[0].setContentSize(w,900),w);await p.waitForFunction(w=>innerWidth===w,w);},base);});
  }finally{if(electron){await electron.close();electron=null;}const target=path.resolve(tmp);assert.ok(target.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(target).startsWith('character-integrity-'));fs.rmSync(target,{recursive:true,force:true,maxRetries:3});}
 }
}catch(e){failures.push(e.stack);console.error(e.stack);}finally{if(browser)await browser.close();if(electron)await electron.close();}
console.log('Character integrity: '+passes+'P '+failures.length+'F');if(failures.length)process.exitCode=1;
})();
