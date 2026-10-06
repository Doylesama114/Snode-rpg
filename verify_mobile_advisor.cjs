'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
const desktop=require('./scripts/desktop_test_helpers.cjs');
const project=__dirname,rootIdx=process.argv.indexOf('--root'),root=rootIdx<0?project:path.resolve(project,process.argv[rootIdx+1]);
const endpoint=require('./斯诺德跑团/advisor-service.js').baseUrl;
let groups=0;function pass(name){groups++;console.log('PASS '+name);}
async function pageFor(browser,mode='stream',extra={},native){
 const p=native?await native.app.firstWindow():await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));p._errors=errors;
 await p.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='appassets.androidplatform.net'){
   const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));
   if(!f.startsWith(root+path.sep)||!fs.existsSync(f))return route.fulfill({status:404,body:'missing'});
   const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'}[path.extname(f)]||'application/octet-stream';
   return route.fulfill({contentType:mime,body:fs.readFileSync(f)});
  }
  if(u.protocol==='file:')return route.continue();
  if(u.pathname==='/api/health')return route.fulfill({json:{ok:true,service:'snode-advisor'}});
  return route.abort();
 });
 await p.addInitScript(({mode,extra,endpoint})=>{
  window.mobileBridge={isAvailable:()=>true,openExternal:()=>{}};
  window.SNODE_ADVISOR_API=extra.stale?'https://stale.example.invalid':'__ADVISOR_API_BASE__';
  localStorage.setItem('_snowd_adv_last_snapshot',JSON.stringify({name:'回归测试角色',classes:[{name:'战士',level:1}]}));
  window.__calls=[];window.__healthCalls=0;window.__retryHealth=false;
  const original=window.fetch;
  window.fetch=(url,options={})=>{
   if(String(url).endsWith('/api/health')){
    window.__healthCalls++;
    if(extra.stale&&String(url).includes('stale.example'))return Promise.resolve(new Response('{}',{status:403}));
    if(extra.healthHang&&!window.__retryHealth)return new Promise(()=>{});
    if(extra.bodyHang&&!window.__retryHealth)return Promise.resolve(new Response(new ReadableStream({start(){}}),{headers:{'Content-Type':'application/json'}}));
    return original(url,options);
   }
   if(String(url).endsWith('/api/advise')){
    window.__calls.push({url:String(url),body:JSON.parse(options.body||'{}'),accept:options.headers.Accept});
    if(mode==='hang')return new Promise(()=>{});
    if(mode==='json')return Promise.resolve(new Response(JSON.stringify({answer:'JSON 正常回复'}),{headers:{'Content-Type':'application/json'}}));
    let text;
    if(mode==='error')text='event: error\ndata: {"message":"服务繁忙，请稍后重试"}\n\n';
    else if(mode==='partial')text='event: delta\ndata: {"delta":"半截回复"}\n\n';
    else text='event: delta\r\ndata: {"delta":"中文流式🙂"}\r\n\r\nevent: done\r\ndata: {"answer":"中文流式🙂已完成"}\r\n\r\n';
    const bytes=new TextEncoder().encode(text);
    return Promise.resolve(new Response(new ReadableStream({start(controller){
     for(let i=0;i<bytes.length;i+=3)controller.enqueue(bytes.slice(i,i+3));controller.close();
    }}),{headers:{'Content-Type':'text/event-stream'}}));
   }
   return original(url,options);
  };
 },{mode,extra,endpoint});
 if(native){await desktop.navigate(native.app,'斯诺德跑团/顾问.html');await desktop.waitFor(native.app,()=>desktop.js(native.app,'!!document.getElementById(\"reconnectBtn\")'));}
 else await p.goto('https://appassets.androidplatform.net/'+encodeURI('斯诺德跑团/顾问.html'),{waitUntil:'load'});
 return p;
}
async function send(p,text='检查连接'){
 await p.locator('#input').fill(text);await p.locator('#send').click();
 await p.waitForFunction(()=>!document.getElementById('send').disabled);
}
(async()=>{
 if(process.argv.includes('--electron-only')){
  const native=await desktop.launch();
  try{
   for(const width of[360,390,1440]){
    await native.app.evaluate(({BrowserWindow},width)=>{const w=BrowserWindow.getAllWindows()[0];w.setMinimumSize(1,1);w.webContents.setBackgroundThrottling(false);w.setContentSize(width,844);},width);
    const p=await pageFor(null,'stream',{},native);
    await p.waitForFunction(()=>document.getElementById('statusText').textContent==='在线');
    await send(p);
    assert((await p.locator('.msg._ai .bubble').last().textContent()).includes('已完成'));
    assert(await p.locator('#statusText').isVisible());
    assert.equal(await p.locator('#advOfflineGuide').count(),0);
    await p.screenshot({path:path.join(project,'screenshots','advisor8044-electron-'+width+'.png')});
    pass('real Electron '+width+' connection, visible status and streamed answer');
    await p.unroute('**/*');
   }
  }finally{await native.close();}
  console.log('Mobile advisor Electron: '+groups+' groups passed');return;
 }
 const b=await chromium.launch({headless:true});
 try {
  let p=await pageFor(b);await p.waitForFunction(()=>document.getElementById('statusText').textContent==='在线');
  await send(p);
  assert((await p.locator('.msg._ai .bubble').textContent()).includes('中文流式🙂已完成'));
  let calls=await p.evaluate(()=>window.__calls);assert.equal(calls.length,1);assert(calls[0].url.startsWith(endpoint));
  assert.equal(calls[0].body.snapshot.name,'回归测试角色');
  assert.equal((await p.evaluate(()=>JSON.parse(localStorage.getItem('_snowd_adv_mobile_session_v1')))).messages.length,2);
  assert.deepEqual(p._errors,[]);assert.equal(await p.locator('#advOfflineGuide').count(),0);pass('unconfigured Android page uses shipped service, accepts split UTF-8/CRLF SSE once, retains snapshot/session');
  for(const width of[360,390,1440]){
   await p.setViewportSize({width,height:844});
   assert(await p.locator('#reconnectBtn').isVisible());
   assert(await p.locator('#statusText').isVisible());
   assert(await p.locator('.hdr-title h1').isVisible());
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await p.screenshot({path:path.join(project,'screenshots','advisor8044-'+width+'.png')});
  }
  pass('connection controls fit three viewports');
  await p.close();
  p=await pageFor(b,'stream',{stale:true});await p.waitForFunction(()=>document.getElementById('statusText').textContent==='在线');await send(p);
  assert((await p.evaluate(()=>window.__calls[0].url)).startsWith(endpoint));pass('stale configured endpoint falls back to healthy public service');await p.close();
  for(const key of['healthHang','bodyHang']){
   p=await pageFor(b,'stream',{[key]:true});await p.clock.install();await p.clock.fastForward(11000);
   await p.waitForFunction(()=>document.getElementById('statusText').textContent.includes('超时'));
   assert.equal(await p.locator('#reconnectBtn').isDisabled(),false);
   await p.evaluate(()=>window.__retryHealth=true);await p.locator('#reconnectBtn').click();
   await p.waitForFunction(()=>document.getElementById('statusText').textContent==='在线');
   pass(key+' is bounded and manual reconnection recovers');await p.close();
  }
  p=await pageFor(b,'json');await p.waitForFunction(()=>document.getElementById('statusText').textContent==='在线');await send(p);
  assert((await p.locator('.msg._ai .bubble').textContent()).includes('JSON 正常回复'));
  assert.equal(await p.evaluate(()=>window.__calls.length),1);pass('gateway JSON reply is accepted without repeat generation');await p.close();
  for(const mode of['error','partial']){
   p=await pageFor(b,mode);await p.waitForFunction(()=>document.getElementById('statusText').textContent==='在线');await send(p);
   assert.equal(await p.locator('.msg._err').count(),1);
   assert.equal(await p.evaluate(()=>window.__calls.length),1);
   assert.equal(await p.locator('#send').isDisabled(),false);
   pass(mode+' replies show recoverable failure without duplicate requests');await p.close();
  }
  p=await pageFor(b,'hang');await p.waitForFunction(()=>document.getElementById('statusText').textContent==='在线');
  await p.clock.install();await p.locator('#input').fill('超时测试');await p.locator('#send').click();
  await p.waitForFunction(()=>window.__calls.length===1);await p.clock.fastForward(151000);
  await p.waitForFunction(()=>!document.getElementById('send').disabled);
  assert((await p.locator('.msg._err').textContent()).includes('超时'));
  pass('stalled answer releases send state on deadline even when fetch ignores abort');await p.close();
  const config=require('./scripts/prepare-advisor-config.cjs');
  assert.equal(config.loadConfig('').baseUrl,endpoint);assert.throws(()=>config.validate('not-a-url'));
  assert.throws(()=>config.validate('http://example.com'));assert.throws(()=>config.validate('https://user:pass@example.com'));
  pass('production build defaults work without OSS and invalid/insecure/credential URL configuration is rejected');
  console.log('Mobile advisor: '+groups+' groups passed');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
