const cp = require("child_process");
const fs = require("fs");
const os2 = require("os");
const path = require("path");
const {Readable,Writable} = require("stream");
const Module = require("module");
let tmpC = 0;
const origSpawn = cp.spawn;
cp.spawn = function(...a) {
  const o = a[2] || {};
  const need = o.stdio === undefined || o.stdio === "pipe" || (Array.isArray(o.stdio) && o.stdio.some(s => s === "pipe"));
  if (!need) return origSpawn.apply(this, a);
  tmpC++;
  const td = fs.mkdtempSync(path.join(os2.tmpdir(), "nsm-"));
  const of = path.join(td, "stdout"), ef = path.join(td, "stderr");
  const ofd = fs.openSync(of, "w"), efd = fs.openSync(ef, "w");
  let ns;
  if (o.stdio === undefined || o.stdio === "pipe") ns = ["ignore", ofd, efd];
  else ns = o.stdio.map((s,i) => { if (s !== "pipe") return s; if (i===1) return ofd; if (i===2) return efd; return "ignore"; });
  a[2] = {...o, stdio: ns, _t:td, _o:of, _e:ef, _of:ofd, _ef:efd};
  const c = origSpawn.apply(this, a);
  const inf = a[2];
  const os3 = new Readable({read(){}}), es = new Readable({read(){}});
  const sin = new Writable({write(c,e,cb){cb()}, final(cb){cb()}});
  const cl = () => {
    try{fs.closeSync(inf._of)}catch(e){} try{fs.closeSync(inf._ef)}catch(e){}
    try{const so=fs.readFileSync(inf._o,"utf8"),se=fs.readFileSync(inf._e,"utf8"); os3.push(so); os3.push(null); es.push(se); es.push(null)}catch(e){if(!os3.destroyed)os3.destroy(e);if(!es.destroyed)es.destroy(e)}
    try{fs.rmSync(inf._t,{recursive:true,force:true})}catch(e){}
  };
  c.on("close",cl); c.on("error",cl);
  c.stdout=os3; c.stderr=es; c.stdin=sin;
  return c;
};
const oEF = cp.execFile;
cp.execFile = function(f,a,o,cb) {
  if(typeof a === "function"){cb=a;a=[];o={}}
  if(typeof o === "function"){cb=o;o={}}
  o = o||{};
  const td = fs.mkdtempSync(path.join(os2.tmpdir(),"nsm-"));
  const of = path.join(td,"stdout"), ef = path.join(td,"stderr");
  const ofd = fs.openSync(of,"w"), efd = fs.openSync(ef,"w");
  const c = origSpawn.call(cp, f, a||[], {...o, stdio:["ignore",ofd,efd]});
  if(typeof cb === "function"){
    c.on("close",(code)=>{
      try{fs.closeSync(ofd)}catch(e){} try{fs.closeSync(efd)}catch(e){}
      let so="",se="";
      try{so=fs.readFileSync(of,"utf8")}catch(e){} try{se=fs.readFileSync(ef,"utf8")}catch(e){}
      try{fs.rmSync(td,{recursive:true,force:true})}catch(e){}
      const er = code!==0?new Error("Cmd failed: "+f+" (exit "+code+")"):null;
      if(er){er.code=code;er.stdout=so;er.stderr=se}
      cb(er,so,se);
    });
    c.on("error",(er)=>{try{fs.closeSync(ofd)}catch(e){} try{fs.closeSync(efd)}catch(e){} try{fs.rmSync(td,{recursive:true,force:true})}catch(e){} cb(er,"","")});
  }
  return c;
};
cp.exec = function(cmd,o,cb){
  if(typeof o==="function"){cb=o;o={}}
  o=o||{};
  return cp.execFile(process.env.comspec||"cmd.exe",["/d","/s","/c",cmd],o,cb);
};
const oR = Module.prototype.require;
Module.prototype.require = function(id) {
  const m = oR.apply(this, arguments);
  if ((id === "builder-util" || id.endsWith("builder-util")) && m.spawnAndWrite && !m._nsmP) {
    m._nsmP = true;
    const oSW = m.spawnAndWrite;
    m.spawnAndWrite = function(cmd, args, data, opts) {
      const isMk = cmd && cmd.toLowerCase().includes("makensis");
      if (isMk && data && data.length > 0) {
        const nsiFile = path.join(process.cwd(), "dist", "installer.nsi");
        const blib = path.dirname(require.resolve("app-builder-lib/package.json"));
        const nsisDir = path.join(blib, "templates", "nsis");
        const incLine = '!define MULTIUSER_EXECUTIONLEVEL Standard\n!addincludedir "' + nsisDir + '"\n';
        data = incLine + data;
        fs.writeFileSync(nsiFile, data, "utf8");
        const fArgs = (args || []).filter(a => a !== "-");
        console.error("[nsm] makensis -> " + nsiFile);
        return m.spawn(cmd, [...fArgs, nsiFile], opts);
      }
      return oSW.call(this, cmd, args, data, opts);
    };
  }
  return m;
};
console.error("[nsm] loaded");
