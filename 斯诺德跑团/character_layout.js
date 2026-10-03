/* Structural worksheet reader: section labels and column headings define ability tables. */
var SNOWD_CHARACTER_LAYOUT = (function () {
  function normalize(v) {
    return String(v == null ? "" : v).replace(/[\s\u00a0\u3000]+/g,"").replace(/：/g,":").replace(/（/g,"(").replace(/）/g,")").trim();
  }
  function point(ref) {
    var m=String(ref||"").match(/^([A-Z]+)(\d+)$/),col=0;
    if(!m)return null;
    for(var i=0;i<m[1].length;i++)col=col*26+m[1].charCodeAt(i)-64;
    return {col:col-1,row:Number(m[2])};
  }
  function ref(col,row) {
    var s="";col++;
    while(col>0){col--;s=String.fromCharCode(65+col%26)+s;col=Math.floor(col/26);}
    return s+row;
  }
  function box(range) {
    if(typeof range!=="string")return range;
    var parts=range.split(":"),a=point(parts[0]),b=point(parts[1]||parts[0]);
    return a&&b?{left:a.col,right:b.col,top:a.row,bottom:b.row}:null;
  }
  function grid(parsed) {
    var cells=parsed.cells||{},byRow={},all=[],maxRow=0,maxCol=0,merges=(parsed.merges||[]).map(box).filter(Boolean);
    Object.keys(cells).forEach(function(k){
      var p=point(k),t=normalize(cells[k]);if(!p)return;
      if(!t)return;
      maxRow=Math.max(maxRow,p.row);maxCol=Math.max(maxCol,p.col);var item={ref:k,row:p.row,col:p.col,text:t,value:String(cells[k])};
      all.push(item);if(!byRow[p.row])byRow[p.row]=[];byRow[p.row].push(item);
    });
    all.sort(function(a,b){return a.row-b.row||a.col-b.col;});
    Object.keys(byRow).forEach(function(r){byRow[r].sort(function(a,b){return a.col-b.col;});});
    function span(k) {
      var p=point(k);
      for(var i=0;i<merges.length;i++){var m=merges[i];if(p.col>=m.left&&p.col<=m.right&&p.row>=m.top&&p.row<=m.bottom)return m;}
      return {left:p.col,right:p.col,top:p.row,bottom:p.row};
    }
    function value(col,row) {
      var k=ref(col,row);if(cells[k]!==undefined&&cells[k]!=="")return String(cells[k]);
      var m=span(k);return String(cells[ref(m.left,m.top)]||"");
    }
    return {cells:cells,all:all,byRow:byRow,maxRow:maxRow,maxCol:maxCol,span:span,value:value};
  }
  var aliases={
    name:["技能名称","技能名","能力名称","法术名称","天赋名称","天赋名","配方名称","图纸名称","名称"],
    tier:["阶位","天赋阶位"],
    tm:["施展时间","施放时间","施展动作","施放动作","动作","使用时间"],
    range:["施展距离","施放距离","距离","范围","射程"],
    dur:["持续时间","持续"],
    dr:["疲劳值消耗","疲劳消耗","消耗","费用","FP消耗"],
    src:["来源","技能来源","职业来源","所属职业","类别"],
    ds:["效果","描述","说明","技能效果","技能描述"]
  };
  function field(text) {
    for(var key in aliases)if(aliases[key].indexOf(text)>=0)return key;
    return "";
  }
  function skillTitle(text) {return /^(?:技能列表|技能栏|技能表|职业技能列表|法术列表)$/.test(titleKey(text))||extraTitle(text);}
  function caption(text) {
    text=titleKey(text);
    if(typeof SNOWD_CHARACTER_CLASSES!=="undefined"){var c=SNOWD_CHARACTER_CLASSES.title(text);if(c)return c.slot===1?"sub":"main";}
    if(/^(?:子职业|副职业)(?:技能)?(?:[（(].*[）)])?$/.test(text))return "sub";
    if(/^(?:主职业|附赠职业)(?:技能)?(?:[（(].*[）)])?$/.test(text))return "main";
    return "";
  }
  function tierLabel(text) {
    var m=text.match(/^([一二三四五六七1-7])阶(?:天赋树|天赋栏|天赋列表|天赋)(?:[（(](\d+)[）)])?$/);
    return m?{tier:(/^[1-7]$/.test(m[1])?"一二三四五六七".charAt(Number(m[1])-1):m[1])+"阶",capacity:m[2]?Number(m[2]):5}:null;
  }
  function otherTitle(text) {
    return /^(?:属性信息|职业信息|基本信息|角色信息|装备栏|装备列表|装备信息|物品列表|货币信息|背景信息|角色补充字段|装备补充列表|额外专长列表|未分类字段|导入排除记录|导入备注|天赋列表|天赋树|专业列表|图纸(?:列表|[（(].*[）)])?)$/.test(titleKey(text))||blueprintTitle(text);
  }
  function nearestAnchor(g,item) {
    var found=null;
    g.all.forEach(function(a){
      if(a.row>=item.row||(!skillTitle(a.text)&&!caption(a.text)))return;
      var b=g.span(a.ref),fits=item.col>=b.left&&item.col<=b.right;
      if(!fits&&a.col!==item.col)return;
      if(g.all.some(function(x){return x.row>a.row&&x.row<item.row&&x.col===item.col&&otherTitle(x.text);}))return;
      if(!found||a.row>found.row)found=a;
    });
    return found;
  }
  function skillSections(g) {
    var sections=[];
    g.all.forEach(function(n){
      if(aliases.name.indexOf(n.text)<0)return;
      var anchor=nearestAnchor(g,n),span=anchor?g.span(anchor.ref):null;
      var right=span&&span.right-n.col>=4?span.right:g.maxCol;
      var row=g.byRow[n.row]||[];
      row.forEach(function(c){if(c.col>n.col&&aliases.name.indexOf(c.text)>=0)right=Math.min(right,c.col-1);});
      var fields={name:n.col},specific=0;
      row.forEach(function(c){
        if(c.col<n.col||c.col>right)return;
        var key=field(c.text);if(!key||key==="name")return;
        if(fields[key]===undefined){fields[key]=c.col;if(key==="tm"||key==="range"||key==="dur")specific++;}
      });
      row.forEach(function(c){if(c.col<n.col||c.col>right||field(c.text))return;var parts=c.value.split(/[\/\r\n]+/).map(normalize),keys=[];parts.forEach(function(p){var k=field(p);if(k&&keys.indexOf(k)<0)keys.push(k);});var remaining=keys.filter(function(k){return fields[k]===undefined;});if(keys.length>1&&remaining.length===1){fields[remaining[0]]=c.col;if(["tm","range","dur"].indexOf(remaining[0])>=0)specific++;}});
      var count=Object.keys(fields).length-1,strong=n.text!=="名称";
      if((strong&&specific>=1&&count>=2)||(anchor&&count>=2&&specific>=1)||(!strong&&specific>=2&&count>=3)||(anchor&&strong&&fields.ds!==undefined&&!/^(?:天赋名称|天赋名|配方名称|图纸名称)$/.test(n.text))){
        var endCol=Math.max.apply(null,Object.keys(fields).map(function(k){return fields[k];}));
        sections.push({header:n.ref,row:n.row,start:n.row+1,end:g.maxRow+1,nameCol:n.col,right:span&&span.right-n.col>=4?right:endCol,fields:fields,place:anchor?caption(anchor.text)||"main":"main",anchor:anchor?anchor.ref:"",ownerClassIndex:anchor?ownerOf(anchor.text):0});
      }
    });
    // Some legacy subclasses repeat only a caption and retain the preceding column schema.
    g.all.filter(function(a){return !!caption(a.text);}).forEach(function(a){
      var nextHeader=sections.filter(function(s){return s.nameCol===a.col&&s.row>a.row;}).sort(function(x,y){return x.row-y.row;})[0];
      if(nextHeader&&!g.all.some(function(x){return x.col===a.col&&x.row>a.row&&x.row<nextHeader.row&&!caption(x.text)&&!otherTitle(x.text)&&aliases.name.indexOf(x.text)<0;}))return;
      var previous=sections.filter(function(s){return s.nameCol===a.col&&s.row<a.row;}).sort(function(x,y){return y.row-x.row;})[0];
      if(!previous)return;
      var nextRow=g.byRow[a.row+1]||[],knownHeaders=nextRow.filter(function(c){return c.col>=a.col&&c.col<=previous.right&&!!field(c.text);}).length;
      if(knownHeaders>=2){
        if(!g.headerProblems)g.headerProblems=[];
        g.headerProblems.push({kind:"layout-unrecognized",cellRef:a.ref,place:caption(a.text),note:"“"+a.value+"”区域的列标题不完整，不能按原列顺序猜测技能。请核对技能名称等表头。"});
        return;
      }
      sections.push({header:a.ref,row:a.row,start:a.row+1,end:g.maxRow+1,nameCol:a.col,right:previous.right,fields:Object.assign({},previous.fields),place:caption(a.text),anchor:a.ref,inherited:true,ownerClassIndex:ownerOf(a.text)});
    });
    sections.forEach(function(s){
      if(s.anchor)return;
      var first=sections.filter(function(x){return x.nameCol===s.nameCol;}).reduce(function(n,x){return Math.min(n,x.row);},s.row);
      var parent=g.all.filter(function(a){return a.col===s.nameCol&&a.row>=first-1&&a.row<s.row&&!!caption(a.text);}).sort(function(a,b){return b.row-a.row;})[0];
      if(parent)s.place=caption(parent.text);
    });
    sections.sort(function(a,b){return a.row-b.row||a.nameCol-b.nameCol;});
    sections.forEach(function(s){
      sections.forEach(function(next){
        if(next.row>s.row&&next.nameCol>=s.nameCol&&next.nameCol<=s.right)s.end=Math.min(s.end,next.row);
      });
      g.all.forEach(function(a){
        if(a.row<=s.row||a.row>=s.end||a.col!==s.nameCol)return;
        if(caption(a.text)||skillTitle(a.text)||otherTitle(a.text)){s.end=a.row;return;}
        if(aliases.name.indexOf(a.text)>=0&&(g.byRow[a.row]||[]).some(function(c){return c.col>a.col&&c.col<=s.right&&!!field(c.text);}))s.end=a.row;
      });
    });
    return sections;
  }
  function talentSections(g) {
    var heads=g.all.filter(function(a){return !!tierLabel(a.text);}),groups={},out=[];
    heads.forEach(function(h){if(!groups[h.col])groups[h.col]=[];groups[h.col].push(h);});
    Object.keys(groups).forEach(function(col){
      var group=groups[col].sort(function(a,b){return a.row-b.row;});
      group.forEach(function(h,i){
        var label=tierLabel(h.text),span=g.span(h.ref);
        var hasTitle=g.all.some(function(a){return a.row<h.row&&h.row-a.row<=80&&/^(?:天赋列表|天赋树|通用天赋树)$/.test(a.text)&&h.col>=g.span(a.ref).left&&h.col<=g.span(a.ref).right;});
        if(group.length<2&&!hasTitle)return;
        var end=i+1<group.length?group[i+1].row:g.maxRow+1;
        var boundary=false;
        g.all.forEach(function(a){if(a.row>h.row&&a.row<end&&a.col===h.col&&otherTitle(a.text)){end=a.row;boundary=true;}});
        if(i===group.length-1&&!boundary)end=Math.min(end,h.row+Math.max(1,label.capacity)+1);
        var fields={name:h.col},start=h.row+1;
        var header=(g.byRow[start]||[]).filter(function(c){return c.col>=span.left&&c.col<=span.right;});
        var nameHeader=header.filter(function(c){return /^(?:天赋名称|天赋名|技能名称|名称)$/.test(c.text);})[0];
        if(nameHeader){fields.name=nameHeader.col;header.forEach(function(c){var k=field(c.text);if(k&&k!=="name")fields[k]=c.col;});start++;}
        out.push({header:h.ref,start:start,end:end,nameCol:fields.name,fields:fields,place:"talent",tier:label.tier,right:span.right,inferredDescription:true,capacity:label.capacity});
      });
    });
    return out;
  }
  function detect(parsed) {
    var g=grid(parsed),skills=skillSections(g),talents=talentSections(g),simple=simpleSections(g),issues=[];
    talents=talents.concat(simple.filter(function(s){return s.place==="talent";}));
    issues=issues.concat(g.headerProblems||[]);
    var skillTitles=g.all.filter(function(a){return skillTitle(a.text);});
    skillTitles.forEach(function(a){
      var span=g.span(a.ref);
      var captions=g.all.filter(function(x){return x.row>a.row&&x.col===a.col&&!!caption(x.text);}).sort(function(x,y){return x.row-y.row;});
      var first=captions[0],limit=g.maxRow+1;
      if(first&&caption(first.text)==="sub")limit=first.row;
      else if(first&&captions[1])limit=captions[1].row;
      g.all.forEach(function(x){if(x.row>a.row&&x.col===a.col&&otherTitle(x.text))limit=Math.min(limit,x.row);});
      if(!skills.some(function(s){return s.row>a.row&&s.row<limit&&s.nameCol>=span.left&&s.nameCol<=span.right;}))
        issues.push({kind:"layout-unrecognized",cellRef:a.ref,place:"main",note:"找到技能列表标题，但该区域未识别完整技能表头。请保留技能名称、施展时间、距离等列标题后重试。"});
    });
    if(!talents.length)g.all.filter(function(a){return /^(?:天赋列表|天赋树)$/.test(a.text);}).forEach(function(a){issues.push({kind:"layout-unrecognized",cellRef:a.ref,place:"talent",note:"找到天赋标题，但未识别同一区域的阶位或表头。请映射名称和说明列。"});});
    if(!skills.length&&!talents.length&&!simple.length)issues.push({kind:"layout-unrecognized",cellRef:"__sheet__",note:"尚未识别能力区块。请指定数据范围与名称列，或明确确认此工作表没有要导入的能力。"});
    return {grid:g,skills:skills,talents:talents,blueprints:simple.filter(function(s){return s.place==="blueprint";}),issues:issues};
  }
  function readAbilities(parsed,classes) {
    var layout=applyMappings(parsed,detect(parsed)),g=layout.grid,skills=[],talents=[],blueprints=[],used={};
    layout.skills=layout.skills.concat(auxiliarySections(g,classes));
    function read(section,list) {
      for(var r=section.start;r<section.end;r++){
        var cell=ref(section.nameCol,r),raw=g.cells[cell],name=raw==null?"":String(raw).trim(),n=normalize(name);
        if(!n||/^(?:-|—|\/\/.*)$/.test(n)||used[cell])continue;
        if(aliases.name.indexOf(n)>=0||/^(?:天赋名称|天赋名|来源|属性值需求|特殊条件)$/.test(n)||isBoundary(n))continue;
        used[cell]=true;
        var visible={name:name,src:"",tier:section.tier||"",tm:"",range:"",dur:"",dr:"",ds:"",sheet:parsed.sheetName||"",cellRef:cell,region:section.place,place:section.place},fieldRefs={name:cell};
        var nameSpan=g.span(cell),mergedNotes=[],mergeSeen={};
        ["src","tm","range","dur","dr","ds","tier"].forEach(function(k){
          if(section.fields[k]===undefined)return;
          var col=section.fields[k],sourceRef=ref(col,r),sourceSpan=g.span(sourceRef);
          if(sourceSpan.left===nameSpan.left&&sourceSpan.top===nameSpan.top&&!g.cells[sourceRef])return;
          var covered=Object.keys(section.fields).filter(function(key){return section.fields[key]>=sourceSpan.left&&section.fields[key]<=sourceSpan.right;});
          var actual=covered.filter(function(key){return !!g.cells[ref(section.fields[key],r)];});
          if(covered.length>1&&actual.length<=1&&g.value(col,r)){
            var id=ref(sourceSpan.left,sourceSpan.top)+":"+ref(sourceSpan.right,sourceSpan.bottom);
            if(!mergeSeen[id]){mergedNotes.push({range:id,raw:g.value(col,r),fields:covered,status:"pending",suggestion:"ds"});mergeSeen[id]=true;}
            fieldRefs[k]=ref(sourceSpan.left,sourceSpan.top);return;
          }
          visible[k]=g.value(col,r);fieldRefs[k]=g.cells[sourceRef]?sourceRef:ref(sourceSpan.left,sourceSpan.top);
          if(k==="ds"&&nameSpan.bottom>r){
            var parts=visible.ds?[visible.ds]:[];
            for(var rr=r+1;rr<=Math.min(nameSpan.bottom,section.end-1);rr++){var v=g.cells[ref(col,rr)];if(v&&parts.indexOf(v)<0)parts.push(String(v));}
            visible.ds=parts.join("\n");
          }
        });
        if(section.inferredDescription&&section.fields.ds===undefined){
          var next=(g.byRow[r]||[]).find(function(a){return a.col>nameSpan.right&&a.col<=section.right&&!isBoundary(a.text);});
          if(next){visible.ds=next.value;fieldRefs.ds=next.ref;}
        }
        var sub=section.place==="sub"?((classes&&classes[1]&&classes[1].name)||"子职业"):"";
        var original={name:name,src:visible.src,tm:visible.tm,range:visible.range,dur:visible.dur,dr:visible.dr,ds:visible.ds,tier:visible.tier};
        list.push({n:name,src:visible.src,tm:visible.tm,range:visible.range,dur:visible.dur,dr:visible.dr,ds:visible.ds,note:section.place==="blueprint"?visible.ds:"",cost:"",tier:visible.tier,sub:sub,place:section.place,region:section.place,cellRef:cell,locked:false,
          ownerClassIndex:section.ownerClassIndex===undefined?(section.place==="sub"?1:0):section.ownerClassIndex,mergedNotes:mergedNotes,origin:section.origin||null,requiresEquipment:section.requiresEquipment||"",resolution:section.auxiliary?"custom":undefined,free:section.auxiliary?null:undefined,occupies:section.auxiliary||section.ownerClassIndex===2?null:undefined,
          provenance:{sheet:parsed.sheetName||"",fields:fieldRefs,section:section.header,evidence:section.evidence||(section.manual?"玩家确认映射":"区块标题与列标题")},
          original:original,_visible:visible});
      }
    }
    layout.skills.forEach(function(s){read(s,skills);});
    layout.talents.forEach(function(s){read(s,talents);});
    layout.blueprints.forEach(function(s){read(s,blueprints);});
    return {skills:skills,talents:talents,blueprints:blueprints,issues:layout.issues,sections:{skills:layout.skills,talents:layout.talents,blueprints:layout.blueprints}};
  }
  function findLabel(parsed,keywords) {
    var g=grid(parsed),keys=keywords.map(normalize);
    for(var k=0;k<keys.length;k++)for(var i=0;i<g.all.length;i++)if(g.all[i].text===keys[k])return g.all[i].ref;
    for(var k2=0;k2<keys.length;k2++)for(var j=0;j<g.all.length;j++){
      var v=g.all[j].text,key=keys[k2];
      // Only short label variants are accepted; prose containing a label is not a field.
      if(v.length>24)continue;
      if(v===key+":"||v.indexOf(key+"(")===0||v.indexOf(key+"（")===0)return g.all[j].ref;
    }
    return null;
  }


  function ownerOf(text){var c=typeof SNOWD_CHARACTER_CLASSES!=="undefined"?SNOWD_CHARACTER_CLASSES.title(text):null;return c?c.slot:null;}
  function auxiliarySections(g,classes){
    var out=[];
    g.all.filter(function(a){return /^.{1,20}进阶(?:战术|能力|特性)表\(已习得\)$/.test(a.text)||/^战术家(?:的)?棋局战术$/.test(a.text);}).forEach(function(h){
      var span=g.span(h.ref),end=g.maxRow+1;g.all.forEach(function(a){if(a.row>h.row&&a.col===h.col&&(/^(?:额外|宠物|战术家(?:的)?棋局战术)$/.test(a.text)||/^(?:目前|当前)(?:经验|技能点)/.test(a.text)))end=Math.min(end,a.row);});
      var equipment=/棋局/.test(h.text),source=equipment?"战术家的棋局":h.text.replace(/进阶.*$/,""),owner=(classes||[]).findIndex(function(c){return c.name===source;});
      out.push({header:h.ref,start:span.bottom+1,end:end,nameCol:h.col,right:span.right>h.col?span.right:h.col+3,fields:{name:h.col,ds:h.col+1},place:"main",ownerClassIndex:owner<0?0:owner,auxiliary:true,origin:{type:equipment?"equipment":"advancement",label:source,declared:true},requiresEquipment:equipment?source:"",evidence:equipment?"已装备道具的战术说明":"表格明确标注已习得"});
    });return out;
  }
  function candidatesFromNotes(parsed,read){
    var g=grid(parsed),owned=(read.skills||[]).concat(read.talents||[]),used={};
    owned.forEach(function(e){Object.keys(e.provenance&&e.provenance.fields||{}).forEach(function(k){used[e.provenance.fields[k]]=true;});});
    var out=[];
    g.all.forEach(function(a){
      if(used[a.ref]||a.row<30)return;
      if(a.value.length<=25&&typeof SNOWD_CHARACTER_IO!=="undefined"&&SNOWD_CHARACTER_IO.candidates(a.value).some(function(c){return c.cls==="特殊专长";})&&!((read.feats||[]).some(function(e){return e.name===a.value;}))){
        out.push({uid:"candidate-"+a.ref,kind:"feat",name:a.value,raw:a.value,cellRef:a.ref,sheet:parsed.sheetName,status:"pending",note:"发现区块之外的专长名称，请确认是否已拥有。"});return;
      }
      if(a.row>=115&&a.value.length<=100&&/[\s、,，]/.test(a.value)){
        var words=a.value.trim().split(/[\s、,，]+/).filter(Boolean);
        var matches=words.filter(function(n){return owned.some(function(e){return e.n===n;});});
        if(words.length>=3&&words.length<=12&&matches.length>=2)out.push({uid:"candidate-"+a.ref,kind:"ability-list",raw:a.value,cellRef:a.ref,sheet:parsed.sheetName,status:"pending",items:words.map(function(n){var e=owned.find(function(e){return e.n===n;});return {name:n,existingUid:e&&e.uid||"",alreadyListed:!!e};}),note:"散列能力备注包含已有条目和未归属名称，请确认用途。"});
      }
    });
    (read.feats||[]).forEach(function(feat){
      var names=String(feat.name||"").split(/[\/|+、]/).map(function(n){return n.trim();}).filter(function(n){return n&&SNOWD_CHARACTER_IO.candidates(n).some(function(c){return c.cls==="特殊专长";});});
      if(names.length>=2)out.push({uid:"candidate-feat-"+feat.cellRef,kind:"feat-options",raw:feat.name,cellRef:feat.cellRef,sheet:parsed.sheetName,status:"pending",items:names.map(function(n){return {name:n};}),note:"同一专长格包含多个名称，须确认实际已选项；其余原文保留为备选。"});
    });return out;
  }

  function blueprintTitle(text) { return /^(?:图纸|图纸列表|配方列表|配方|专业列表)(?:\(.*\))?$/.test(titleKey(text)); }
  function titleKey(text) {
    return normalize(text).replace(/(?:当前槽位|占用数量|容量|槽位数量|当前占用)[:：]?\d+(?:\/\d+)?(?:个|项)?$/, "").trim();
  }
  function extraTitle(text) { return /^(?:额外能力|额外技能|特殊能力|自定义技能|自定义能力|剧情技能|剧情能力|主持人授予)(?:列表|栏)?$/.test(titleKey(text)); }
  function isBoundary(text) { return otherTitle(text)||skillTitle(text)||!!caption(text)||!!tierLabel(text)||blueprintTitle(text); }
  function simpleSections(g) {
    var out=[];
    g.all.filter(function(a){return blueprintTitle(a.text);}).forEach(function(a){
      var span=g.span(a.ref),fields={name:a.col},start=span.bottom+1;
      var row=g.byRow[start]||[],head=row.find(function(c){return c.col>=span.left&&c.col<=Math.max(span.right,span.left+8)&&/^(?:名称|配方名称|图纸名称)$/.test(c.text);});
      if(head&&span.right===span.left)span=Object.assign({},span,{right:Math.max.apply(null,row.filter(function(c){return c.col>=head.col&&c.col<=head.col+8&&field(c.text);}).map(function(c){return c.col;}))});
      if(head){fields.name=head.col;row.forEach(function(c){var k=field(c.text);if(k&&c.col>=span.left&&c.col<=span.right)fields[k]=c.col;});start++;}
      var end=g.maxRow+1;
      g.all.forEach(function(x){if(x.row>=start&&x.col>=span.left&&x.col<=span.right&&isBoundary(x.text))end=Math.min(end,x.row);});
      out.push({header:a.ref,start:start,end:end,nameCol:fields.name,right:span.right,fields:fields,place:"blueprint",inferredDescription:true,evidence:"专业或配方区标题"});
    });
    g.all.filter(function(a){return /^(?:天赋列表|天赋树|额外天赋|特殊天赋)$/.test(titleKey(a.text));}).forEach(function(a){
      var span=g.span(a.ref),start=span.bottom+1,row=g.byRow[start]||[];
      if(span.right===span.left)span=Object.assign({},span,{right:Math.max.apply(null,[span.left].concat(row.filter(function(c){return c.col>=span.left&&c.col<=span.left+8&&field(c.text);}).map(function(c){return c.col;})))});
      if(row.some(function(c){return c.col>=span.left&&c.col<=span.right&&!!tierLabel(c.text);}))return;
      var head=row.find(function(c){return c.col>=span.left&&c.col<=span.right&&/^(?:天赋名称|天赋名|能力名称|名称)$/.test(c.text);});
      if(!head)return;
      var fields={name:head.col};row.forEach(function(c){var k=field(c.text);if(k&&c.col>=span.left&&c.col<=span.right)fields[k]=c.col;});
      if(fields.ds===undefined&&fields.src===undefined)return;
      var end=g.maxRow+1;g.all.forEach(function(x){if(x.row>start&&x.col>=span.left&&x.col<=span.right&&isBoundary(x.text))end=Math.min(end,x.row);});
      out.push({header:head.ref,start:start+1,end:end,nameCol:head.col,right:span.right,fields:fields,place:"talent",tier:"",evidence:"无阶位天赋表头"});
    });
    return out;
  }
  function mappingSection(g,m,sheetName) {
    if(m.sheet&&m.sheet!==sheetName)return null;
    var b=box(m.range);if(!b||b.top<1||b.bottom<b.top||b.right<b.left)throw new Error("映射范围无效");
    var fields={},input=m.fields||{};
    Object.keys(input).forEach(function(k){
      if(!aliases[k])return;var p=point(String(input[k]).toUpperCase()+"1");
      if(!p||p.col<b.left||p.col>b.right)throw new Error("映射列必须位于选择范围内："+k);
      fields[k]=p.col;
    });
    if(fields.name===undefined)throw new Error("请选择名称列");
    if(["main","sub","talent","blueprint"].indexOf(m.place)<0)throw new Error("请选择有效栏位");
    return {header:ref(b.left,b.top),start:b.top,end:b.bottom+1,nameCol:fields.name,right:b.right,fields:fields,place:m.place,tier:m.tier||"",ownerClassIndex:m.ownerClassIndex===undefined?(m.place==="sub"?1:0):m.ownerClassIndex,manual:true,evidence:"玩家确认的列映射"};
  }
  function overlap(a,b) { return a.start<b.end&&b.start<a.end&&a.nameCol<=b.right&&b.nameCol<=a.right; }
  function mappingSignature(parsed,m) {
    var g=grid(parsed),b=box(m.range);if(!b)return "";
    var near=g.all.filter(function(a){return a.row>=Math.max(1,b.top-3)&&a.row<=b.top&&a.col>=b.left&&a.col<=b.right;});
    return near.filter(function(a){return isBoundary(a.text)||!!field(a.text);}).map(function(a){return (a.row-b.top)+":"+a.col+":"+a.text;}).join("|");
  }
  function applyMappings(parsed,layout) {
    var g=layout.grid,skip=parsed.ignoredLayoutRegions||[],mappings=parsed.layoutMappings||[];
    layout.blueprints=layout.blueprints||[];
    mappings.forEach(function(m){
      var s=mappingSection(g,m,parsed.sheetName||"");if(!s)return;
      if(m.signature&&mappingSignature(parsed,m)!==m.signature)throw new Error("表头结构已经变化，请重新确认映射范围");
      ["skills","talents","blueprints"].forEach(function(k){layout[k]=layout[k].filter(function(a){return !overlap(a,s);});});
      (s.place==="talent"?layout.talents:s.place==="blueprint"?layout.blueprints:layout.skills).push(s);
      layout.issues=layout.issues.filter(function(i){var p=point(i.cellRef||"");return !p||p.col<s.nameCol||p.col>s.right||p.row>s.start||p.row<s.start-3;});
    });
    if(layout.skills.length||layout.talents.length||layout.blueprints.length)layout.issues=layout.issues.filter(function(i){return i.cellRef!=="__sheet__";});
    skip.forEach(function(id){
      layout.issues=layout.issues.filter(function(i){return i.cellRef!==id;});
    });
    return layout;
  }
  function readMappedLabel(parsed,labels,valid) {
    var g=grid(parsed),key=findLabel(parsed,labels);if(!key)return null;
    var p=point(key),span=g.span(key),row=g.byRow[p.row]||[];
    var next=row.filter(function(c){return c.col>span.right&&!isBoundary(c.text);});
    for(var i=0;i<next.length;i++){
      if(next[i].col>span.right+3)break;
      if(!valid||valid(next[i].value))return {value:next[i].value,cellRef:next[i].ref,labelRef:key};
    }
    return null;
  }
  function supplemental(parsed) {
    var g=grid(parsed),feats=[],issues=[],values={},refs={};
    var head=g.all.find(function(a){return a.text==="特殊专长";});
    if(head){
      var area=g.span(head.ref),end=g.maxRow+1;
      g.all.forEach(function(a){if(a.row>area.bottom&&a.col===area.left&&/^(?:装备栏|装备信息|装备列表|背包)$/.test(a.text))end=Math.min(end,a.row);});
      g.all.filter(function(a){return a.row>area.bottom&&a.row<end&&a.col>=area.left&&a.col<=area.right&&/^(?:4级|8级|12级|13级|六阶)$/.test(a.text);}).forEach(function(a){
        var span=g.span(a.ref),candidate=(g.byRow[a.row]||[]).find(function(c){return c.col>span.right&&c.col<=area.right&&!/^[+-]?(?:\d+(?:\.\d+)?|-|—)$/.test(c.text)&&!isBoundary(c.text);});
        if(candidate)feats.push({name:candidate.value.trim(),level:a.text==="六阶"?"六阶":Number(a.text.replace("级","")),cellRef:candidate.ref});
      });
    }
    var key=readMappedLabel(parsed,["关键属性"],function(v){return /^(?:力量|敏捷|体质|智力|感知|魅力|意志|幸运)$/.test(normalize(v));});
    if(key){values.keyAttr=normalize(key.value);refs.keyAttr=key.cellRef;}
    var currencyHead=g.all.find(function(a){return a.text==="货币"||a.text==="货币信息";});
    if(currencyHead){
      var area=g.span(currencyHead.ref),bottom=g.maxRow+1;
      g.all.forEach(function(a){if(a.row>area.bottom&&a.col>=area.left&&a.col<=area.right&&/^(?:装备栏|装备信息|装备列表|武器|防具|配饰|背包)$/.test(a.text))bottom=Math.min(bottom,a.row);});
      bottom=Math.min(bottom,area.bottom+12);
      var region=g.all.filter(function(a){return a.row>area.bottom&&a.row<bottom&&a.col>=area.left&&a.col<=area.right;});
      var mapped={};
      ["金币","银币","铜币"].forEach(function(label){
        var a=region.find(function(x){return x.text===label;});if(!a)return;
        var span=g.span(a.ref),candidate=region.find(function(x){return x.row===a.row&&x.col>span.right&&Number.isFinite(Number(x.value));});
        if(!candidate)candidate=region.find(function(x){return x.col===a.col&&x.row===span.bottom+1&&Number.isFinite(Number(x.value));});
        if(candidate){mapped[label]=Number(candidate.value);refs[label]=candidate.ref;}
      });
      values.currency=mapped;
      var assigned=Object.keys(mapped).map(function(k){return refs[k];});
      var unknown=region.filter(function(a){return /^[+-]?\d+(?:\.\d+)?$/.test(a.text)&&assigned.indexOf(a.ref)<0;});
      if(unknown.length)issues.push({kind:"field-unmapped",field:"currency",cellRef:currencyHead.ref,note:"货币区有数值但缺少明确币种，请确认对应币种或保留为未分类数值。",values:unknown.map(function(a){return {cellRef:a.ref,value:a.value};})});
    }
    return {feats:head?feats:null,values:values,refs:refs,issues:issues};
  }

  return {candidatesFromNotes:candidatesFromNotes,auxiliarySections:auxiliarySections,supplemental:supplemental,mappingSignature:mappingSignature,mappingSection:mappingSection,normalize:normalize,point:point,ref:ref,grid:grid,detect:detect,readAbilities:readAbilities,findLabel:findLabel};
})();
