// snd.js — Sound manager for 斯诺德跑团 (sample + synth fallback)
(function(){
var audioCtx=null;
var sampleBase='';
var buffers={};
var loading=null;
var DB_ATTEN=Math.pow(10,-10/20);

function getScriptBase(){
  var el=document.currentScript||document.querySelector('script[src*="snd.js"]');
  if(!el||!el.src)return '';
  return el.src.replace(/[^/]+$/,'');
}

function getCtx(){
  if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext);
  audioCtx.resume();
  return audioCtx;
}

function playTone(f,d,v,t,s){
  var ctx=getCtx(),osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type=t||'sine';osc.frequency.setValueAtTime(f,ctx.currentTime);
  if(s)osc.frequency.linearRampToValueAtTime(f+s,ctx.currentTime+d);
  gain.gain.setValueAtTime(v*DB_ATTEN,ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+d);
  osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+d+.05);
}

function playNoise(d,v,f1,f2){
  var ctx=getCtx(),len=ctx.sampleRate*d|0,buf=ctx.createBuffer(1,len,ctx.sampleRate);
  var data=buf.getChannelData(0);
  for(var i=0;i<len;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/len,2)*v*DB_ATTEN;
  var src=ctx.createBufferSource(),flt=ctx.createBiquadFilter(),gn=ctx.createGain();
  src.buffer=buf;flt.type='bandpass';
  flt.frequency.setValueAtTime(f1,ctx.currentTime);
  flt.frequency.linearRampToValueAtTime(f2,ctx.currentTime+d);
  flt.Q.value=2;gn.gain.setValueAtTime(1,ctx.currentTime);
  gn.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+d);
  src.connect(flt);flt.connect(gn);gn.connect(ctx.destination);
  src.start();src.stop(ctx.currentTime+d+.05);
}

var SYNTH={
  click:function(){playTone(400,0.05,0.1,'triangle',-200)},
  success:function(){playTone(880,0.08,0.15,'triangle',200);setTimeout(function(){playTone(1320,0.1,0.12,'triangle',0)},60)},
  error:function(){playTone(200,0.2,0.15,'sawtooth',-80)},
  expand:function(){playNoise(0.3,0.15,2000,600);setTimeout(function(){playTone(600,0.2,0.1,'sine',400)},50);setTimeout(function(){playTone(1000,0.15,0.08,'triangle',0)},120)},
  step:function(){playTone(1500,0.04,0.1,'sine',-200)},
  toggle:function(){playTone(60,0.25,0.1,'sine',-20)},
  pageIn:function(){playTone(440,0.15,0.08,'triangle',100)},
  charge:function(){
    var ctx=getCtx(),osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type='triangle';osc.frequency.setValueAtTime(200,ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800,ctx.currentTime+2);
    gain.gain.setValueAtTime(0.04*DB_ATTEN,ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12*DB_ATTEN,ctx.currentTime+2);
    osc.connect(gain);gain.connect(ctx.destination);osc.start();
    return {stop:function(){try{osc.stop();gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.05)}catch(e){}}};
  }
};

var SAMPLE_FILES={
  click:'click.ogg',success:'success.ogg',error:'error.ogg',expand:'expand.ogg',
  step:'step.ogg',toggle:'toggle.ogg',pageIn:'pageIn.ogg'
};

var SAMPLE_GAIN={
  click:0.55,success:0.7,error:0.65,expand:0.6,step:0.5,toggle:0.55,pageIn:0.45
};

function loadSamples(){
  if(loading)return loading;
  sampleBase=getScriptBase()+'audio/ui/';
  loading=Promise.all(Object.keys(SAMPLE_FILES).map(function(name){
    var url=sampleBase+SAMPLE_FILES[name];
    return fetch(url).then(function(r){
      if(!r.ok)throw new Error('missing '+url);
      return r.arrayBuffer();
    }).then(function(ab){
      return getCtx().decodeAudioData(ab);
    }).then(function(buf){buffers[name]=buf}).catch(function(){});
  }));
  return loading;
}

function playSample(name){
  var buf=buffers[name];
  if(!buf)return false;
  var ctx=getCtx(),src=ctx.createBufferSource(),gain=ctx.createGain();
  src.buffer=buf;
  gain.gain.value=(SAMPLE_GAIN[name]||0.6)*DB_ATTEN;
  src.connect(gain);gain.connect(ctx.destination);
  src.start();
  return true;
}

function playSound(name){
  if(name==='charge')return SYNTH.charge();
  if(!playSample(name)&&SYNTH[name])SYNTH[name]();
}

sampleBase=getScriptBase()+'audio/ui/';
loadSamples();

window.snd={
  muted:localStorage._snowd_mute==='1',
  ready:false,
  play:function(name){
    if(this.muted)return;
    playSound(name);
  },
  playRef:function(name){
    if(this.muted)return null;
    if(name==='charge')return SYNTH.charge();
    this.play(name);
    return null;
  },
  toggle:function(){
    this.muted=!this.muted;
    localStorage._snowd_mute=this.muted?'1':'0';
    var b=document.getElementById('muteToggle');
    if(b)b.textContent=this.muted?'🔇':'🔊';
    return this.muted;
  }
};

loadSamples().then(function(){window.snd.ready=true});

document.addEventListener('click',function(e){
  if(snd.muted||!e.target.closest)return;
  var el=e.target.closest('.btn, .card, [onclick], button:not(#themeToggle):not(#muteToggle), .chip, .adv-card');
  if(el)snd.play('click');
});

(function(){
  var h=document.documentElement;
  var s=localStorage.getItem('_snowd_theme');
  if(s==='dark')h.classList.add('dark');
  else if(s==='light')h.classList.remove('dark');
  else if(window.matchMedia('(prefers-color-scheme:dark)').matches)h.classList.add('dark');
})();
})();
