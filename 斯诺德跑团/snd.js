// snd.js — Lightweight sound manager for 斯诺德跑团
// Zero dependencies, Web Audio API synthesis

(function(){
var audioCtx=null;
function getCtx(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext);audioCtx.resume();return audioCtx;}

function playTone(f,d,v,t,s){
  var ctx=getCtx(),osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type=t||'sine';osc.frequency.setValueAtTime(f,ctx.currentTime);
  if(s)osc.frequency.linearRampToValueAtTime(f+s,ctx.currentTime+d);
  gain.gain.setValueAtTime(v,ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+d);
  osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+d+.05);
}

function playNoise(d,v,f1,f2){
  var ctx=getCtx(),len=ctx.sampleRate*d|0,buf=ctx.createBuffer(1,len,ctx.sampleRate);
  var data=buf.getChannelData(0);
  for(var i=0;i<len;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/len,2)*v;
  var src=ctx.createBufferSource(),flt=ctx.createBiquadFilter(),gn=ctx.createGain();
  src.buffer=buf;flt.type='bandpass';
  flt.frequency.setValueAtTime(f1,ctx.currentTime);
  flt.frequency.linearRampToValueAtTime(f2,ctx.currentTime+d);
  flt.Q.value=2;gn.gain.setValueAtTime(1,ctx.currentTime);
  gn.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+d);
  src.connect(flt);flt.connect(gn);gn.connect(ctx.destination);
  src.start();src.stop(ctx.currentTime+d+.05);
}

var SOUNDS={
  click:   function(){playTone(800,0.06,0.12,'sine',-300)},
  hover:   function(){playTone(550,0.03,0.06,'sine',100)},
  success: function(){playTone(880,0.08,0.15,'triangle',200);setTimeout(function(){playTone(1320,0.1,0.12,'triangle',0)},60)},
  error:   function(){playTone(200,0.2,0.15,'sawtooth',-80)},
  expand:  function(){playNoise(0.3,0.15,2000,600);setTimeout(function(){playTone(600,0.2,0.1,'sine',400)},50);setTimeout(function(){playTone(1000,0.15,0.08,'triangle',0)},120)},
  step:    function(){playTone(1500,0.04,0.1,'sine',-200)},
  toggle:  function(){playTone(60,0.25,0.1,'sine',-20)},
  pageIn:  function(){playTone(440,0.15,0.08,'triangle',100)}
};

window.snd={
  muted: localStorage._snowd_mute==='1',
  play: function(name){
    if(this.muted)return;
    var fn=SOUNDS[name];
    if(fn)fn();
  },
  toggle: function(){
    this.muted=!this.muted;
    localStorage._snowd_mute=this.muted?'1':'0';
    var b=document.getElementById('muteToggle');
    if(b)b.textContent=this.muted?'🔇':'🔊';
    return this.muted;
  }
};

document.addEventListener('click',function(e){
  if(snd.muted)return;
  var el=e.target.closest('.btn, .card, [onclick], button:not(#themeToggle):not(#muteToggle), .chip, .adv-card');
  if(el)snd.play('click');
});
document.addEventListener('mouseenter',function(e){
  if(snd.muted)return;
  if(e.target.closest('.adv-card'))snd.play('hover');
},true);
})();
