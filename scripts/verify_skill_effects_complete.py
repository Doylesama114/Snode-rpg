#!/usr/bin/env python3
"""Independent source fixtures, complete skill bodies and per-card rendering gate."""
from __future__ import annotations
import html,json,re,sys,unicodedata,zipfile
from pathlib import Path
from html.parser import HTMLParser
from functools import lru_cache
from xml.etree import ElementTree as ET
ROOT=Path(__file__).resolve().parent.parent
FIXTURE=ROOT/'scripts/skill_effects_cases.json'
NS='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
def norm(text):
    return re.sub(r'[\W_]+','',unicodedata.normalize('NFKC',html.unescape(str(text or '')))).casefold()
@lru_cache(maxsize=None)
def word_lines(path):
    with zipfile.ZipFile(path) as z: tree=ET.fromstring(z.read('word/document.xml'))
    return [t for p in tree.iter(NS+'p') if (t:=''.join(x.text or '' for x in p.iter(NS+'t')).strip())]
def strings(x):
    if isinstance(x,str): return [x]
    if isinstance(x,(int,float)): return [str(x)]
    if isinstance(x,list): return sum((strings(v) for v in x),[])
    if isinstance(x,dict): return sum((strings(v) for k,v in x.items() if k not in ('field_runs','description_entries','line_runs','source','flavor')),[])
    return []
def body(s):
    return norm(''.join(strings({k:s.get(k) for k in ('fields','description','level_upgrades','unit_tables','roll_tables','effects','upgrades','choices')})))
class Cards(HTMLParser):
    def __init__(self):super().__init__(convert_charrefs=True);self.cards={};self.current=None
    def handle_starttag(self,tag,attrs):
        if tag=='article':
            self.current=dict(attrs).get('id')
            if self.current:self.cards[self.current]=[]
    def handle_data(self,data):
        if self.current:self.cards[self.current].append(data)
    def handle_endtag(self,tag):
        if tag=='article':self.current=None
def cards(path):
    p=Cards();p.feed(path.read_text(encoding='utf8'));return {k:norm(''.join(v)) for k,v in p.cards.items()}
def panel_data():
    text=(ROOT/'斯诺德跑团/panel_data.js').read_text(encoding='utf8')
    m=re.search(r'\bvar SKILL_DATA\s*=\s*',text);out,_=json.JSONDecoder().raw_decode(text[m.end():])
    m=re.search(r'SKILL_DATA\["牧师·神圣领域"\]\s*=\s*',text)
    if m:out['牧师·神圣领域'],_=json.JSONDecoder().raw_decode(text[m.end():])
    return out

SOURCE_EXCEPTIONS = {
    "\u6cd5\u5e08": {"\u5492\u6cd5\u5b66\u6d3e\u5e8f\u5217", "\u53d8\u5f62\u672f\u00b7\u67ad\u718a", "\u53d8\u5f62\u672f\u00b7\u9c7c", "\u53d8\u5f62\u672f\u00b7\u9e1f", "\u56db\u81c2\u672f", "\u7206\u88c2\u672f", "\u77f3\u5316\u672f", "\u7a7f\u5899\u672f", "\u8f6f\u6ce5\u5f62\u6001", "\u9690\u533f\u4f20\u8baf\u672f"},
    "\u730e\u4eba": {"\u7075\u9f9f\u5b88\u62a4\u00b7\u5929\u8d4b", "\u7075\u7334\u5b88\u62a4\u00b7\u5929\u8d4b", "\u7075\u72d0\u5b88\u62a4\u00b7\u5929\u8d4b"},
    "\u53ec\u5524\u5e08": {"\u84dd\u7130\u672f"},
}
SOURCE_FIELDS = re.compile(r"^(\u524d\u7f6e\u6761\u4ef6|\u989d\u5916\u6761\u4ef6|\u65bd\u5c55\u65f6\u95f4|\u65bd\u5c55\u8ddd\u79bb|\u6301\u7eed\u65f6\u95f4|\u75b2\u52b3\u6d88\u8017|\u5173\u952e\u8bcd|\u65bd\u5c55\u6761\u4ef6|\u65bd\u5c55\u9650\u5236|\u9650\u5236|\u6807\u8bc6|\u8d39\u7528|\u63cf\u8ff0)[:\uff1a]")
def source_rules(path, pool):
    """Read expected paragraphs independently of the production parser and its end spans."""
    ps=word_lines(path); names={s["name"] for s in pool}
    def title(i):
        return i+1<len(ps) and 1<=len(ps[i])<=30 and not re.search(r"[:\uff1a\uff0c\u3002\uff1b]|^[\u00b7\u2022\u2605]|\d+[.\u3001]",ps[i]) and SOURCE_FIELDS.match(ps[i+1])
    heads=[i for i in range(len(ps)) if title(i)]
    byname={}
    for start in heads:
        byname.setdefault(ps[start],[]).append(start)
    out={}
    for s in pool:
        starts=byname.get(s["name"],[])
        preferred=(s.get("source") or {}).get("para_start")
        if preferred in starts:start=preferred
        elif len(starts)==1:start=starts[0]
        elif s.get("kind")=="initial_feat":
            candidates=[i for i,x in enumerate(ps) if x==s["name"]]
            if len(candidates)!=1:continue
            start=candidates[0]
        else:continue
        end=len(ps)
        for i in range(start+1,len(ps)):
            line=ps[i]
            if i in heads or re.match(r"^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b]\u9636\u5929\u8d4b\u6811",line) or line.startswith("\u6289\u62e9") or (
                line.endswith("\u98ce\u683c") and len(line)<16 and "\uff1a" not in line
            ) or line.endswith("\u5929\u8d4b\u6811"):
                end=i;break
            if s.get("kind")=="initial_feat" and line in names:
                end=i;break
        expected=[]
        for line in ps[start+1:end]:
            if line.startswith("-----") or line in ("\u56fa\u6709\u6280\u80fd\uff1a","\u56fa\u6709\u6280\u80fd","\u4f60\u53ef\u4ee5\u901a\u8fc7\u82b1\u8d39\u6280\u80fd\u70b9\u7684\u65b9\u5f0f\u6765\u83b7\u53d6\u4ee5\u4e0b\u80fd\u529b"):continue
            field=SOURCE_FIELDS.match(line)
            if field:
                if field[1] in ("\u6807\u8bc6","\u8d39\u7528"):continue
                line=line[field.end():]
            if line.startswith("\u4f60\u7684") and re.search(r"\u7ea7\u65f6[:\uff1a]",line):line=re.split(r"\u7ea7\u65f6[:\uff1a]",line,maxsplit=1)[1]
            if s["name"]=="\u53ec\u5524\u9ab7\u9ac5\u58eb\u5175":line=line.replace("\u5148\u653b\u65f6\u5e8f\u4eba\u975e\u4eba\u503c6","\u5148\u653b\u65f6\u5e8f\u503c6")
            if len(norm(line))>=5:expected.append(line)
        out[s["id"]]=expected
    return out

def main():
    errors=[];fixture=json.loads(FIXTURE.read_text(encoding='utf8'));panel=panel_data()
    classes=json.loads((ROOT/'职业页/数据/classes.json').read_text(encoding='utf8'))
    assert len(classes)==18,'Expected eighteen classes'
    docs={};visible={};fx={}
    domain=json.loads((ROOT/'职业页/数据/牧师·神圣领域.json').read_text(encoding='utf8'))
    for cls in [c['name'] for c in classes]:
        docs[cls]=json.loads((ROOT/'职业页/数据'/f'{cls}.json').read_text(encoding='utf8'))['skills']
        visible[cls]=cards(ROOT/'职业页'/f'{cls}.html')
        raw=json.loads((ROOT/'斯诺德跑团'/f'skill_effects_{cls}.json').read_text(encoding='utf8'))
        fx[cls]=raw if isinstance(raw,list) else raw[cls]
        pids={s['id'] for s in panel.get(cls,[])}
        for s in docs[cls]:
            if s['id'] not in pids:errors.append(f'{cls}/{s["name"]}: panel ID missing {s["id"]}')
            if not body(s):errors.append(f'{cls}/{s["name"]}: empty effect')
            if s['id'] not in visible[cls]:errors.append(f'{cls}/{s["name"]}: card missing')

    source_checked=0
    sources=[(cls,ROOT/f"\u57fa\u7840\u804c\u4e1a-{cls}.docx",pool) for cls,pool in docs.items()]
    sources += [(dn,ROOT/dom["source_file"],dom["skills"]) for dn,dom in domain["domains"].items()]
    for cls,path,pool in sources:
        rules=source_rules(path,pool)
        for skill in pool:
            if skill["name"] in SOURCE_EXCEPTIONS.get(cls,set()):continue
            expected=rules.get(skill["id"])
            if expected is None:
                errors.append(f"{cls}/{skill['name']}: unexplained source definition missing")
                continue
            source_checked+=1
            source_class = "牧师·神圣领域" if cls in domain["domains"] else cls
            primary_class = "牧师" if source_class == "牧师·神圣领域" else cls
            pentry = next((s for s in panel.get(source_class, []) if s["id"] == skill["id"]), {})
            channels = {"json": body(skill), "panel": body(pentry),
                        "html": visible[primary_class].get(skill["id"], "")}
            if primary_class == cls:
                channels["fx"] = body(next((s for s in fx[cls] if s["id"] == skill["id"]), {}))
            for line in expected:
                for channel,text in channels.items():
                    if norm(line) not in text:errors.append(f"{cls}/{skill['name']}/{channel}: source rule missing "+line[:60])
    print(f"Independent full-source coverage: {source_checked} definitions; 14 named source exceptions")
    checked=0
    for case in fixture['cases']:
        cls=case['class'];dn=case.get('deity');nm=case['name']
        pool=domain['domains'][dn]['skills'] if dn else docs[cls]
        hits=[s for s in pool if s['name']==nm and (not case.get('id') or s['id']==case['id'])]
        label=f'{dn or cls}/{nm}'
        if len(hits)!=1:errors.append(label+': definition missing/ambiguous');continue
        s=hits[0];sid=s['id'];checked+=1
        source=word_lines(ROOT/case['source_file'])
        # Validate frozen independent expected clauses against the current source too.
        source_text=norm(''.join(source[case['source_start']:case['source_end']]))
        targets={'json':body(s),'html':visible.get('牧师' if dn else cls,{}).get(sid,'')}
        p=next((x for x in panel.get(cls,[]) if x['id']==sid),None)
        targets['panel']=body(p or {})
        if not dn:targets['fx']=body(next((x for x in fx[cls] if x['id']==sid),{}))
        for expected in case['expected']:
            n=norm(expected)
            if n not in source_text:errors.append(label+': fixture no longer matches source '+expected[:35]);continue
            for channel,text in targets.items():
                if n not in text:errors.append(label+'/'+channel+': missing '+expected[:60])
    # Every raw unit paragraph must survive rendered cards and panel payload.
    for cls,pool in list(docs.items())+[(dn,d['skills']) for dn,d in domain['domains'].items()]:
        for s in pool:
            rendered=visible['牧师' if cls in domain['domains'] else cls].get(s['id'],'')
            for u in s.get('unit_tables',[]):
                for line in u.get('lines',[]):
                    if norm(line) in ('固有技能',):continue
                    if norm(line) and norm(line) not in rendered:errors.append(f'{cls}/{s["name"]}: unit line missing '+line[:50])
    print(f'18 classes; {sum(len(x) for x in docs.values())} base definitions; {len(domain["domains"])} domains; {checked}/{len(fixture["cases"])} independent fixtures')
    if errors:
        print(f'FAIL {len(errors)} gaps')
        for e in errors[:45]:print(' - '+e)
        return 1
    print('PASS complete effects, unit text, IDs and root rendering')
    return 0
if __name__=='__main__':sys.exit(main())
