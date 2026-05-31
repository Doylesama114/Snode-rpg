var fs=require('fs');
var c=fs.readFileSync('斯诺德跑团/角色创建页.html','utf8');

// Find and replace the entire showPersonalityPicker + helper functions
var start=c.indexOf('function showPersonalityPicker(bg){');
var end=c.indexOf('function renderBgStep(c) {',start);
if(start<0||end<0){console.log('Blocks not found');process.exit(1);}

// Build clean replacement using Array.join to avoid ANY quoting issues
var L='String.fromCharCode';

var fn=[
'function showPersonalityPicker(bg){',
'  if(!bg||!bg.name)return;',
'  var data=BG_PERSONALITY[bg.name];',
'  if(!data||(!data.traits.length&&!data.ideals.length&&!data.bonds.length&&!data.flaws.length))return;',
'  var Q='+L+'(34),S='+L+'(39);',
'  var o=document.createElement("div");',
'  o.style.cssText="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center";',
'  window._persOverlay=o;',
'  var b=document.createElement("div");',
'  b.style.cssText="background:#fffdf8;border-radius:10px;padding:24px;max-width:600px;width:95%;max-height:85vh;overflow-y:auto;border:2px solid #d8d2c4;box-shadow:0 8px 32px rgba(0,0,0,0.3)";',
'  var h=[];',
'  h.push("'+L+'(104)+'+L+'(51)+" style=margin-bottom:4px;color:#1f2522'+L+'(62)+'编辑个性特征 — "+bg.name+"'+L+'(60)+L+'(47)+L+'(104)+L+'(51)+L+'(62));',
'  h.push("'+L+'(112)+" style=font-size:13px;color:#69706b;margin-bottom:16px'+L+'(62)+'选择或自定义角色的个性特征'+L+'(60)+L+'(47)+L+'(112)+L+'(62));',
'  function sec(label,key,items,count){',
'    h.push("'+L+'(100)+L+'(105)+L+'(118)+" style=margin-bottom:14px'+L+'(62));',
'    h.push("'+L+'(108)+L+'(97)+L+'(98)+L+'(101)+L+'(108)+" style=font-size:14px;font-weight:bold;color:#1f2522;display:block;margin-bottom:4px'+L+'(62)+'"+label+"（选"+count+"项）'+L+'(60)+L+'(47)+L+'(108)+L+'(97)+L+'(98)+L+'(101)+L+'(108)+L+'(62));',
'    var ex=CHAR[key]||"";',
'    var ep=ex.split(/[；;]/);',
'    for(var i=0;i<count;i++){',
'      h.push("'+L+'(115)+L+'(101)+L+'(108)+L+'(101)+L+'(99)+L+'(116)+" id='+S+'pers_"+key+"_"+i+S+" onchange='+S+'updatePersonalityCustom()'+S+" style='+S+'width:100%;padding:6px;margin-bottom:4px;border:1px solid #d8d2c4;border-radius:4px;font-size:13px'+S+''+L+'(62));',
'      h.push("'+L+'(111)+L+'(112)+L+'(116)+L+'(105)+L+'(111)+L+'(110)+" value='+S+S+''+L+'(62)+'—— 暂不选择 ——'+L+'(60)+L+'(47)+L+'(111)+L+'(112)+L+'(116)+L+'(105)+L+'(111)+L+'(110)+L+'(62));',
'      for(var j=0;j<items.length;j++){',
'        var it=items[j];',
'        var sel=(ep[i]||"").trim()===it?" selected":"";',
'        h.push("'+L+'(111)+L+'(112)+L+'(116)+L+'(105)+L+'(111)+L+'(110)+" value='+S++it.replace(/'+S+'/g,Q+39+Q)+S+'+sel+''+L+'(62)+'"+it+"'+L+'(60)+L+'(47)+L+'(111)+L+'(112)+L+'(116)+L+'(105)+L+'(111)+L+'(110)+L+'(62));',
'      }',
'      h.push("'+L+'(111)+L+'(112)+L+'(116)+L+'(105)+L+'(111)+L+'(110)+" value='+S+'__custom__'+S+''+L+'(62)+'自定义...'+L+'(60)+L+'(47)+L+'(111)+L+'(112)+L+'(116)+L+'(105)+L+'(111)+L+'(110)+L+'(62));',
'      h.push("'+L+'(60)+L+'(47)+L+'(115)+L+'(101)+L+'(108)+L+'(101)+L+'(99)+L+'(116)+L+'(62));',
'      h.push("'+L+'(105)+L+'(110)+L+'(112)+L+'(117)+L+'(116)+" id='+S+'pers_"+key+"_"+i+"_custom'+S+" placeholder='+S+'输入自定义内容...'+S+" style='+S+'width:100%;padding:6px;margin-top:2px;border:1px solid #d8d2c4;border-radius:4px;font-size:13px;display:none'+S+" value='+S++(ep[i]||"").replace(/'+S+'/g,Q+39+Q)+S+''+L+'(62));',
'    }',
'    h.push("'+L+'(60)+L+'(47)+L+'(100)+L+'(105)+L+'(118)+L+'(62));',
'  }',
'  sec("特点","personality",data.traits,2);',
'  sec("理念","ideals",data.ideals,1);',
'  sec("羁绊","bonds",data.bonds,1);',
'  sec("缺陷","flaws",data.flaws,1);',
'  h.push("'+L+'(100)+L+'(105)+L+'(118)+" style=margin-top:18px;display:flex;gap:8px;justify-content:flex-end'+L+'(62));',
'  h.push("'+L+'(98)+L+'(117)+L+'(116)+L+'(116)+L+'(111)+L+'(110)+" onclick='+S+'if(window._persOverlay)window._persOverlay.remove()'+S+" style=padding:8px 16px;background:#d8d2c4;color:#69706b;border:none;border-radius:6px;cursor:pointer;font-size:14px'+L+'(62)+'跳过'+L+'(60)+L+'(47)+L+'(98)+L+'(117)+L+'(116)+L+'(116)+L+'(111)+L+'(110)+L+'(62));',
'  h.push("'+L+'(98)+L+'(117)+L+'(116)+L+'(116)+L+'(111)+L+'(110)+" onclick='+S+'confirmPersonalityPicker()'+S+" style=padding:8px 16px;background:#4caf50;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:bold'+L+'(62)+'确认'+L+'(60)+L+'(47)+L+'(98)+L+'(117)+L+'(116)+L+'(116)+L+'(111)+L+'(110)+L+'(62));',
'  h.push("'+L+'(60)+L+'(47)+L+'(100)+L+'(105)+L+'(118)+L+'(62));',
'  b.innerHTML=h.join("");',
'  o.appendChild(b);',
'  document.body.appendChild(o);',
'  updatePersonalityCustom();',
'}',
'function updatePersonalityCustom(){',
'  var ks=["personality","personality","ideals","bonds","flaws"];',
'  for(var i=0;i<ks.length;i++){',
'    var s=document.getElementById("pers_"+ks[i]+"_"+(i<2?i:0));',
'    var c=document.getElementById("pers_"+ks[i]+"_"+(i<2?i:0)+"_custom");',
'    if(s&&c)c.style.display=s.value==="__custom__"?"block":"none";',
'  }',
'}',
'function confirmPersonalityPicker(){',
'  var m={personality:["personality","personality"],ideals:["ideals"],bonds:["bonds"],flaws:["flaws"]};',
'  for(var k in m){',
'    var p=[];',
'    for(var i=0;i<m[k].length;i++){',
'      var s=document.getElementById("pers_"+m[k][i]+"_"+(i<2?i:0));',
'      var c=document.getElementById("pers_"+m[k][i]+"_"+(i<2?i:0)+"_custom");',
'      if(!s)continue;',
'      var v=s.value==="__custom__"?(c?c.value:""):s.value;',
'      if(v&&v!=="__custom__")p.push(v);',
'    }',
'    CHAR[k]=p.join("；")||CHAR[k]||"";',
'  }',
'  if(window._persOverlay)window._persOverlay.remove();window._persOverlay=null;',
'}'
].join('\n');

c=c.substring(0,start)+fn+'\n'+c.substring(end);
fs.writeFileSync('斯诺德跑团/角色创建页.html',c);
console.log('Rewritten showPersonalityPicker with pure String.fromCharCode, size:',c.length);
