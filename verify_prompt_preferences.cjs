'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const { pathToFileURL } = require('url');
const { chromium, _electron } = require('playwright');
const { DesktopSettings } = require('./electron-app/desktop-settings');
const { launch, js, navigate, waitFor, root } = require('./scripts/desktop_test_helpers.cjs');
let passed = 0;
function pass(name) { passed++; console.log('PASS ' + name); }
(async function () {
  const scratch = path.join(root,'_scratch'); fs.mkdirSync(scratch,{recursive:true});
  const dir = fs.mkdtempSync(path.join(scratch,'prompt-store-'));
  try {
    const file = path.join(dir,'settings.json');
    fs.writeFileSync(file,JSON.stringify({autoUpdate:false,compatibilityMode:true,custom:'keep'}));
    const store = new DesktopSettings(file);
    assert.deepEqual(store.preferences({launcher:'skipped'}).onboardingSeen,{launcher:'skipped'});
    store.switches({onboardingEnabled:false,advisorAutoTipsEnabled:true});
    store.patchRoot({autoUpdate:true});
    const data = JSON.parse(fs.readFileSync(file));
    assert.equal(data.compatibilityMode,true); assert.equal(data.custom,'keep'); assert.equal(data.promptPreferences.onboardingEnabled,false);
    assert.equal(store.claimTip().claimed,true); assert.equal(store.claimTip().claimed,false);
    const before = fs.readFileSync(file,'utf8'); assert.throws(()=>store.switches({autoUpdate:false})); assert.equal(fs.readFileSync(file,'utf8'),before);
    fs.writeFileSync(file,'invalid'); assert.throws(()=>store.switches({onboardingEnabled:false})); assert.equal(fs.readFileSync(file,'utf8'),'invalid');
    pass('atomic settings merge, legacy migration, global tip interval, corruption and IPC field validation');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }

  if (!process.argv.includes("--desktop-only")) {
  const browser = await chromium.launch({headless:true});
  try {
    const context = await browser.newContext(), page = await context.newPage();
    await page.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
    await page.goto(pathToFileURL(path.join(root,'斯诺德跑团/启动台.html')).href);
    await page.waitForSelector('#onboardBox');
    await page.waitForTimeout(800);
    assert.equal(await page.locator('#onboardBox').count(),1);
    assert.equal(await page.evaluate(()=>SnowdPreferences.get().onboardingSeen.launcher),'shown');
    await page.reload(); await page.waitForTimeout(900); assert.equal(await page.locator('#onboardBox').count(),0);
    pass('first shown guide is remembered even without completion; delayed auto does not duplicate');
    await page.locator('#promptSettingsToggle').click();
    await page.locator('#onboardingEnabledToggle').uncheck();
    await page.waitForFunction(()=>!SnowdPreferences.get().onboardingEnabled);
    await page.getByRole('button',{name:'重看启动台引导',exact:true}).click();
    await page.waitForSelector('#onboardBox');
    assert.equal(await page.evaluate(()=>SnowdPreferences.get().onboardingEnabled),false);
    await page.getByRole('button',{name:'跳过引导',exact:true}).click();
    await page.reload(); await page.waitForTimeout(800); assert.equal(await page.locator('#onboardBox').count(),0);
    pass('visible launcher switch persists; manual replay is one-off and leaves automatic mode disabled');
    for (const width of [360,390,1440]) {
      await page.setViewportSize({width,height:900}); await page.locator('#promptSettingsToggle').click();
      const rectangle = await page.locator('#promptSettingsCard').boundingBox();
      assert.ok(rectangle.x>=0 && rectangle.x+rectangle.width<=width+1);
      assert.equal(await page.locator('#onboardingEnabledToggle').isVisible(),true);
      await page.keyboard.press('Escape');
    }
    pass('launcher preference dialog fits 360/390/1440 widths');
    await page.setViewportSize({width:390,height:900});
    await page.evaluate(()=>{window.SNOWD_ADVISOR_TIPS={tips:['TEST TIP'],rules:[]};});
    await page.addScriptTag({path:path.join(root,'斯诺德跑团/advisor-mobile-entry.js')});
    await page.waitForSelector('#_snowd_adv_mobile_ball');
    assert.equal(await page.locator('#_snowd_adv_mobile_tip._show').count(),0);
    await page.evaluate(()=>SnowdPreferences.set({advisorAutoTipsEnabled:true}));
    await page.waitForSelector('#_snowd_adv_mobile_tip._show',{timeout:5000});
    await page.evaluate(()=>SnowdPreferences.set({advisorAutoTipsEnabled:false}));
    await page.waitForTimeout(100); assert.equal(await page.locator('#_snowd_adv_mobile_tip._show').count(),0);
    assert.equal(await page.locator('#_snowd_adv_mobile_ball').count(),1);
    pass('mobile auto tips stop immediately while manual advisor entry remains');
    await context.close();
    const blocked = await browser.newContext(), unavailable = await blocked.newPage();
    await unavailable.addInitScript(()=>{Storage.prototype.setItem=function(){throw new Error('blocked storage')};});
    await unavailable.goto(pathToFileURL(path.join(root,'斯诺德跑团/启动台.html')).href);
    await unavailable.waitForFunction(()=>!!window.SnowdPreferences);
    const failure = await unavailable.evaluate(()=>SnowdPreferences.set({onboardingEnabled:false}));
    assert.equal(failure.ok,false); assert.equal(await unavailable.evaluate(()=>SnowdPreferences.get().onboardingEnabled),false);
    assert.match(await unavailable.locator('#promptSettingsStatus').textContent(),/未保存|无法/);
    pass('storage failure is visible and cannot report a temporary choice as persisted');
    await blocked.close();
  } finally { await browser.close(); }
  }

  const test = await launch(); let reopened;
  try {
    await waitFor(test.app,()=>js(test.app,'!!window.SnowdPreferences && !!document.getElementById("_snowd_advisor_ball")'));
    await js(test.app,'SnowdPreferences.set({onboardingEnabled:false,advisorAutoTipsEnabled:false})');
    assert.equal(await js(test.app,'!!document.getElementById("onboardBox")'),false);
    await js(test.app,'void window.open("../职业页/法师.html","_blank")');
    const child = await waitFor(test.app,()=>test.app.evaluate(({app})=>{
      const r=[...app.__snodeDesktop.lifecycle.records.values()].find(r=>r.role==='preview'&&r.lastGood);return r?r.win.id:false;
    }));
    await waitFor(test.app,()=>js(test.app,'!!window.SnowdPreferences',child));
    assert.equal(await js(test.app,'SnowdPreferences.get().onboardingEnabled',child),false);
    await js(test.app,'SnowdPreferences.set({advisorAutoTipsEnabled:true})');
    await waitFor(test.app,()=>js(test.app,'SnowdPreferences.get().advisorAutoTipsEnabled',child));
    await js(test.app,'SnowdPreferences.set({advisorAutoTipsEnabled:false})',child);
    await waitFor(test.app,()=>js(test.app,'!SnowdPreferences.get().advisorAutoTipsEnabled'));
    pass('main and real child windows share durable preferences and update each other immediately');
    await test.app.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).destroy(),child);

    // A pending automatic suggestion must never reappear or contaminate the manual request.
    await test.app.evaluate(({ipcMain,app})=>{
      app.__promptCalls=[];
      ipcMain.removeHandler('advisor-advise-stream');
      ipcMain.handle('advisor-advise-stream',async(event,payload)=>{
        app.__promptCalls.push(payload.queryKind||'manual');
        if(payload.queryKind==='chargen_bubble'){
          return new Promise(resolve=>{app.__finishAuto=()=>{if(!event.sender.isDestroyed())event.sender.send('advisor-stream-chunk',{delta:'OLD AUTO',streamId:payload.__streamId});resolve({ok:true,answer:'OLD AUTO'});};});
        }
        event.sender.send('advisor-stream-chunk',{delta:'MANUAL ANSWER',streamId:payload.__streamId});
        return {ok:true,answer:'MANUAL ANSWER'};
      });
    });
    await navigate(test.app,'斯诺德跑团/角色创建页.html');
    await waitFor(test.app,()=>js(test.app,'!!document.getElementById("_snowd_advisor_ball")'));
    await js(test.app,'CHAR.className="战士";window.dispatchEvent(new Event("snowd-chargen-change"));void 0');
    assert.deepEqual(await test.app.evaluate(({app})=>app.__promptCalls),[]);
    await js(test.app,'SnowdPreferences.set({advisorAutoTipsEnabled:true})');
    await waitFor(test.app,()=>test.app.evaluate(({app})=>app.__promptCalls.includes('chargen_bubble')));
    await js(test.app,'SnowdPreferences.set({advisorAutoTipsEnabled:false})');
    await js(test.app,'document.getElementById("_snowd_advisor_ball").click();document.getElementById("_snowd_adv_chargen_help").click();void 0');
    await waitFor(test.app,()=>js(test.app,'document.getElementById("_snowd_adv_msgs").textContent.includes("MANUAL ANSWER")'));
    await test.app.evaluate(({app})=>app.__finishAuto());
    await new Promise(r=>setTimeout(r,150));
    assert.equal(await js(test.app,'!document.getElementById("_snowd_advisor_tip").classList.contains("_hidden")'),false);
    assert.equal(await js(test.app,'document.getElementById("_snowd_adv_msgs").textContent.includes("OLD AUTO")'),false);
    pass('disabled auto requests stay silent; pending auto responses do not pollute manual wizard answers');

    await navigate(test.app,'斯诺德跑团/启动台.html');
    await test.app.evaluate(({app})=>app.__snodeDesktop.desktopSettings.patchRoot({customKeep:'retained'}));
    fs.writeFileSync(path.join(test.profile,'http-cache-version'),'1.0.7000');
    await test.app.close();
    reopened=await _electron.launch({executablePath:test.executablePath,args:test.args,env:test.env});
    await waitFor(reopened,()=>js(reopened,'!!window.SnowdPreferences && !!document.getElementById("_snowd_advisor_ball")'));
    assert.equal(await js(reopened,'SnowdPreferences.get().onboardingEnabled'),false);
    assert.equal(await js(reopened,'SnowdPreferences.get().advisorAutoTipsEnabled'),false);
    assert.equal(await js(reopened,'!!document.getElementById("onboardBox")'),false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(test.profile,'snowd-settings.json'))).customKeep,'retained');
    pass('same-profile full application restart retains off switches and unrelated settings');
  } catch (error) {
    console.error('MOCK CALLS',await test.app.evaluate(({app})=>app.__promptCalls));
    console.error('WINDOWS',await test.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(w=>({url:w.webContents.getURL(),crashed:w.webContents.isCrashed()}))));
    console.error('LOG',fs.readFileSync(path.join(test.profile,'diagnostics/desktop.log'),'utf8').slice(-1600));
    try { console.error('PAGE',await js(test.app,'({prefs:window.SnowdPreferences&&SnowdPreferences.get(),text:document.body.innerText.slice(0,200)})')); } catch (_) {}
    throw error;
  } finally {
    if(reopened){await reopened.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy())).catch(()=>{});await reopened.close().catch(()=>{});}
    await test.close();
  }
  console.log('Prompt preferences: '+passed+' groups passed');
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
