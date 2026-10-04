'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');
const root = __dirname, scratch = path.resolve(root, '_scratch');
fs.mkdirSync(scratch, { recursive: true });
const dir = fs.mkdtempSync(path.join(scratch, 'mobile-update-test-'));
assert(dir.startsWith(scratch + path.sep));
const version = JSON.parse(fs.readFileSync(path.join(root,'electron-app/package.json'))).version;
let passes = 0;
function pass(name) { console.log('PASS ' + name); passes++; }
function run(cmd,args) {
  const r = spawnSync(cmd,args,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stdout + r.stderr); return r.stdout;
}
(async () => {
 let browser;
 try {
  const out = path.join(dir,'packages'), files = path.join(dir,'files');
  run(process.execPath,['scripts/build-mobile-packages.mjs','--base','https://primary.invalid','--version',version,'--out',out]);
  const manifest = JSON.parse(fs.readFileSync(path.join(out,'version.json')));
  const crypto = require('crypto');
  for (const name of ['core','poker']) {
   const bytes = fs.readFileSync(path.join(out,name+'-'+version+'.zip')), pkg = manifest.packages[name];
   assert.equal(bytes.length,pkg.size); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),pkg.sha256);
   assert(pkg.fallbackUrls[0].includes('/v'+version+'/')); assert(pkg.fallbackUrls[0].endsWith('.zip'));
  }
  assert.equal(manifest.apk.version,version); assert(manifest.apk.url.endsWith('.apk'));
  pass('real mobile packages match manifest sizes, hashes and APK version');
  const unpack = [
   'import sys,zipfile,pathlib',
   'base=pathlib.Path(sys.argv[1]); dest=pathlib.Path(sys.argv[2]).resolve(); dest.mkdir()',
   'for p in base.glob("*.zip"):',
   ' with zipfile.ZipFile(p) as z:',
   '  assert z.testzip() is None',
   '  for e in z.infolist():',
   '   target=(dest/e.filename).resolve(); assert target.is_relative_to(dest)',
   '  z.extractall(dest)'
  ].join('\n');
  run(process.env.PYTHON || 'python',['-B','-X','utf8','-c',unpack,out,files]);
  for (const name of ['index.html','斯诺德跑团/启动台.html','斯诺德跑团/user_preferences.js','斯诺德跑团/prompt_controls.js','poker-game/index.html'])
   assert(fs.statSync(path.join(files,name)).size>0,name);
  pass('actual ZIPs decompress with valid CRC and all application entry/preferences files');
  browser = await chromium.launch({headless:true});
  const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors = [];
  const p = await context.newPage(); p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*',async route=>{
   const u = new URL(route.request().url());
   if(u.hostname==='api.github.com') return route.fulfill({json:{assets:[{name:'Snode-RPG-'+version+'.apk',browser_download_url:'https://example.invalid/app.apk'}]}});
   if(u.hostname!=='appassets.androidplatform.net') return route.abort();
   const f=path.resolve(files,'.'+decodeURIComponent(u.pathname));
   if(!f.startsWith(files+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile())return route.fulfill({status:404,body:'missing '+u.pathname});
   const ext=path.extname(f),mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'}[ext]||'application/octet-stream';
   return route.fulfill({status:200,contentType:mime,headers:{'Cache-Control':'no-store'},body:fs.readFileSync(f)});
  });
  await p.addInitScript(v=>{
   window.__mobileChecks=0;window.__downloads=[];
   window.mobileBridge={
    getAppInfo:()=>JSON.stringify({appVersion:v,resourceVersion:v,updateWarning:''}),
    checkResourceUpdate:()=>{window.__mobileChecks++;return 'checking';},
    openExternal:url=>window.__downloads.push(url)
   };
   if(!localStorage.getItem('_snowd_prompt_preferences_v1'))localStorage.setItem('_snowd_prompt_preferences_v1',JSON.stringify({version:1,revision:1,onboardingEnabled:false,advisorAutoTipsEnabled:false,onboardingSeen:{},lastAdvisorTipAt:0}));
  },version);
  const launcher='https://appassets.androidplatform.net/'+encodeURI('斯诺德跑团/启动台.html');
  await p.goto(launcher,{waitUntil:'load'});await p.waitForTimeout(2300);
  assert.equal(await p.evaluate(()=>window.__mobileChecks),0);
  assert.equal(await p.locator('#autoUpdateLabel').isVisible(),false);
  await p.locator('#updateBtn').click();assert.equal(await p.evaluate(()=>window.__mobileChecks),1);
  pass('Android manual update calls native resources once and avoids automatic reload loops');
  await p.evaluate(()=>window.dispatchEvent(new CustomEvent('snowd-mobile-update',{detail:{status:'warning',message:'HTTP 403: 使用本地资源'}})));
  assert((await p.locator('#updateMsg').textContent()).includes('使用本地资源'));
  await p.locator('#mirrorBtn').click();
  await p.waitForFunction(()=>window.__downloads.length>0);
  assert((await p.evaluate(()=>window.__downloads[0])).endsWith('.apk'));
  pass('native warning is visible and Android download selects APK instead of EXE');
  await p.evaluate(()=>localStorage.setItem('mobile-update-saved-character','{"name":"玩家存档"}'));
  for(const width of [360,390,1440]){
   await p.setViewportSize({width,height:900});
   await p.goto(launcher,{waitUntil:'load'});
   assert.equal(await p.evaluate(()=>APP_VERSION),version);
   assert.equal(await p.evaluate(()=>localStorage.getItem('mobile-update-saved-character')),'{"name":"玩家存档"}');
   assert.equal(await p.evaluate(()=>SnowdPreferences.get().onboardingEnabled),false);
   assert(await p.locator('#mirrorBtn').isVisible());
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   fs.mkdirSync(path.join(root,'screenshots'),{recursive:true});
   await p.screenshot({path:path.join(root,'screenshots','mobile-update-'+version+'-'+width+'.png'),fullPage:true});
  }
  pass('three viewports load packaged resources and retain character storage and prompt preferences');
  await p.evaluate(()=>{delete window.mobileBridge.checkResourceUpdate;checkUpdate();});
  assert((await p.locator('#updateMsg').textContent()).includes('覆盖安装'));
  pass('legacy Android bridge gives an APK upgrade path');
  assert.deepEqual(errors,[]);
  pass('no renderer errors in real mobile package pages');
  console.log('Mobile update browser/package checks: '+passes+'P 0F');
 } finally {
  if(browser)await browser.close();
  assert(dir.startsWith(scratch+path.sep)); fs.rmSync(dir,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
