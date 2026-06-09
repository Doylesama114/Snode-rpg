// snd.js — ZzFX-powered sound manager for 斯诺德跑团
// Zero dependencies, <1KB engine, Web Audio API synthesis
// MIT License — ZzFX by Frank Force https://github.com/KilledByAPixel/ZzFX

// === ZzFXMicro engine (minified) ===
let zzfxX=0,zzfxV,zzfxW,zzfxU;const zzfx=(...o)=>{let e=zzfxX++,t=o[0]??0,n=o[1]??0,s=o[2]??0,r=o[3]??.1,i=o[4]??.1,a=o[5]??0,c=o[6]??0,l=o[7]??0,u=o[8]??0,f=o[9]??0,d=o[10]??0,h=o[11]??0,p=o[12]??0,g=o[13]??0,v=o[14]??0,b=o[15]??0,m=o[16]??0,w=o[17]??0,x=o[18]??0,E=o[19]??0,C=o[20]??0,D=o[21]??0,A=o[22]??0,O=o[23]??0,q=44100,y=2*q,B=t=>(t>0?1:-1)*t**(B?2:1),P,R,S,T,k=.01,j,N,F,I=.1*e*.01*e*.01,K,L,M,H,_,G,Q,W;if(!(zzfxX>1e7&&I>.01)){let U=zzfxV?zzfxV.buffer:null;(zzfxV=zzfxV||new AudioContext).resume();if(i+=I*e,isNaN(q)||isNaN(n)||isNaN(s)||isNaN(r)||isNaN(i)||isNaN(a)||isNaN(c)||isNaN(l)||isNaN(u)||isNaN(f)||isNaN(d)||isNaN(h)||isNaN(p)||isNaN(g)||isNaN(v)||isNaN(b)||isNaN(m)||isNaN(w)||isNaN(x)||isNaN(E)||isNaN(C)||isNaN(D))return;if(!U||U.length<((i+.1)*q+2>>0)){(U=zzfxV.createBuffer(1,(i+.1)*q+2>>0,q)).getChannelData(0).fill(0);zzfxW=Math.min(zzfxW??zzfxV.sampleRate/q,1);for(M=Math.min(i*q+2>>0,U.length),G=zzfxW<1?Math.round(M*zzfxW):M,H=s*(2**(n/12)),_=2**(p/12),Q=2**(h/12),W=2**(x/12),K=0;K<G;K++){for(P=K/G,R=0,S=0,T=0,N=0,L=0,j=0,k=0,F=0,J=c;J<=l;J++){I=Math.min(1,P/(r+(J>c?0:J!=c?r:r*i/u)*(1/J)))**(a+.05*(J>c?0:J-c)),F+=(B(K*f/(q))*d+v)*(1-I)*I,B(K*f/(q)+.25)*b*m*I*(1-I);let X=K*g/(q),_Y=B(X)*w*(1-B(1*X))*x*(B(2.6*X)**2+.1)*.2,_Z=B(X*V)**2*C*(1-B(2*X))*D,NL=B(X*E)**2*A*(1-B(.5*X))*O+L*(B(K*zzfxW/u)**2*.99+.01);L+=B(K/(n?q:q/zzfxW))/(1+20*Math.max(0,K/(zzfxW*q)-1)**2)*(L>1?1:L>1?1:L);let Y=1+(N>0?.05*Math.sin(K/1e3*N)**2:0);T=(T+F*(1-Y)+L*Y)/2,L=0}k=T**(2+(w>0?.5:0))*Math.min(1,K*.04)*.5+(j?j*.1*Math.sin(1e3*P**2)*B(P*3)**2:1)*(K<G?U.getChannelData(0)[K]||0:0),j=Math.max(0,k-j*(1-1e-4)),R=S<.5&&k>.01?R+1:0,S+=P>(r+i*.7)?(1-S)*.1:S*.9,N=K/q,N>r+i/2&&(U.getChannelData(0)[K]=Math.tanh(k* (1+_* (1+Math.sin(N*Math.PI*2*H+(N-Q)**6*10*Math.sin(N*W*3))* (1-B(N*f/(q))*g)*v))))}}};zzfxV.buffer=U}zzfxW=Math.min(zzfxW??zzfxV.sampleRate/q,1);let Z=new AudioBufferSourceNode(zzfxV,{buffer:U,playbackRate:zzfxW,detune:0});if(Z.connect(zzfxV.destination),D>0){let oe=zzfxV.createBiquadFilter();oe.type=E==0?"lowpass":E==1?"highpass":E==2?"bandpass":E==3?"lowshelf":E==4?"highshelf":E==5?"peaking":"notch",oe.frequency.value=D,oe.Q.value=C,oe.gain.value=A,Z.disconnect(),Z.connect(oe),oe.connect(zzfxV.destination)}Z.start(zzfxV.currentTime+(o[24]??0)),Z.stop(zzfxV.currentTime+i);let te={stop:()=>{try{Z.stop()}catch(e){}}};return te}};

// === Sound presets ===
var SND_PRESETS={
  click:   [.5,,925,.02,.04,.3,1,.5,,6.3,-400,.09,.17],
  hover:   [.15,,550,.01,.02,.1,,.3,,,50,.01],
  success: [.4,,1125,.03,.2,.5,,.6,,6,-200,.09,.17],
  error:   [.3,,220,.08,.15,.6,1,,-0.4,2],
  expand:  [.6,,650,.03,.25,.5,1,1.4,,100,.04,.2,1400],
  step:    [.3,,1640,.01,.04,.2,2,1.2,,,200,.02],
  toggle:  [.25,,45,.15,.25,1,1,,-0.3,,200,.06],
  pageIn:  [.35,,440,.1,.2,.3,,.3,,,,.1,800],
};

// === Sound manager ===
window.snd=window.snd||{
  muted: localStorage._snowd_mute==='1',
  init: function(){
    this.muted=localStorage._snowd_mute==='1';
    // Universal click listener
    var self=this;
    document.addEventListener('click',function(e){
      if(self.muted)return;
      var el=e.target.closest('.btn, .card, [onclick], button:not(#themeToggle), .chip, .adv-card');
      if(el)self.play('click');
    });
    // Hover listener for adv-card
    document.addEventListener('mouseenter',function(e){
      if(self.muted)return;
      if(e.target.closest('.adv-card'))self.play('hover');
    },true);
  },
  play: function(name){
    if(this.muted)return;
    var p=SND_PRESETS[name];
    if(p)zzfx(...p);
  },
  toggle: function(){
    this.muted=!this.muted;
    localStorage._snowd_mute=this.muted?'1':'0';
    var b=document.getElementById('muteToggle');
    if(b)b.textContent=this.muted?'🔇':'🔊';
    return this.muted;
  }
};
snd.init();
