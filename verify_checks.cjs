var fs=require('fs');
var html=fs.readFileSync('斯诺德跑团/上传角色.html','utf8');

var checks=[];
checks.push('RACE_LANGS inline: ' + html.includes('var RACE_LANGS='));
checks.push('cn function exists: ' + html.includes('function cn(ref)'));
checks.push('Race cleanup exists: ' + html.includes('.replace(/[!！]+$/'));
checks.push('Class dedup: ' + html.includes('_usedClasses'));

// Verify the duplicate lines are removed
var hasDuplicate = html.includes('s.classes[1].styles[0]=c("E"+(rr2+2))||c("E"+(rr2+3));}\n    if(!s.classes[1].level)s.classes[1].level=cn("D"+(rr2+2))');
checks.push('No duplicate lines 333-334: ' + !hasDuplicate);

// Verify parse with acorn
var acorn=require('acorn');
var m=html.match(/<script>\s*\n([\s\S]*?)<\/script>/);
try {
  acorn.parse(m[1], {ecmaVersion:2020});
  checks.push('Script parses OK: true');
} catch(e) {
  checks.push('Script parse error: ' + e.message);
}

checks.forEach(function(c){ console.log(c); });
