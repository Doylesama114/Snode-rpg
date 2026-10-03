#!/usr/bin/env python3
"""Repair documented effect gaps without deleting or renumbering existing definitions.
Default is a dry run. --apply regenerates JSON, HTML, effects, panel data and mirrors.
"""
from __future__ import annotations
import argparse,copy,json,re,shutil,sys,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'scripts'))
import class_sync_core as C
import extract_class_docx as E
import extract_unit_tables as U
import apply_cleric_domains as D
from apply_class_extract import extract_to_block
from cleric_domain_config import docx_path
def dump(value):return json.dumps(value,ensure_ascii=False,indent=2)+'\n'
def update(skill,block):
    fields=dict(block['fields'])
    if block['mark_dots']:fields['标识']='●'*len(block['mark_dots'])
    skill.update(fields=fields,description=block['description'],level_upgrades=block['level_upgrades'],
                 cost=C.cost_json(block['mark_dots']),flavor=block['flavor'])
    if fields.get('关键词'):
        skill['tags']=C.tags_from_keywords(fields['关键词'])
        if skill.get('type')!='starting':skill['type']=C.skill_type_from_keywords(fields['关键词'])
    elif block['mark_dots']:
        skill['type']='天赋';skill['tags']=[]
    C.apply_run_metadata(skill,block)
    skill['source']=dict(skill.get('source') or {},kind='docx',para_start=block['source_span']['start'],para_end=block['source_span']['end'])
def main():
    apply=argparse.ArgumentParser();apply.add_argument('--apply',action='store_true');args=apply.parse_args()
    fixture=json.loads((ROOT/'scripts/skill_effects_cases.json').read_text(encoding='utf8'))['cases']
    classes=[r['name'] for r in json.loads((ROOT/'职业页/数据/classes.json').read_text(encoding='utf8'))]
    data={cn:json.loads((ROOT/'职业页/数据'/f'{cn}.json').read_text(encoding='utf8')) for cn in classes}
    domain=json.loads((ROOT/'职业页/数据/牧师·神圣领域.json').read_text(encoding='utf8'))
    before={cn:[(s['id'],s['name']) for s in d['skills']] for cn,d in data.items()}
    cache={};updated=[];added=[]
    def parse(path,start):
        key=str(path)
        if key not in cache:
            ps=C.extract_paragraphs(path);cache[key]=(ps,E.discover_skill_names(ps))
        ps,names=cache[key];b=C.extract_skill_block(ps,start,names)
        if not b:raise ValueError(f'Missing source block: {path.name}:{start}')
        return b
    def allocate(dom):
        used={s['id'] for s in dom['skills']};prefix='pr-d-'+dom['id']+'-'
        i=max((int(x[len(prefix):]) for x in used if x.startswith(prefix) and x[len(prefix):].isdigit()),default=0)+1
        return prefix+str(i)
    for case in fixture:
        dn=case.get('deity');cls=case['class']
        dom=domain['domains'][dn] if dn else None
        pool=dom['skills'] if dn else data[cls]['skills']
        hits=[s for s in pool if s['name']==case['name'] and (not case['id'] or s['id']==case['id'])]
        if len(hits)>1:raise ValueError(case)
        block=parse(ROOT/case['source_file'],case['source_start'])
        if hits:s=hits[0]
        else:
            assert dn and case['name'] in ('规划路线','秘法习得','通感者')
            # Frozen fixture supplies explicit style/tier context for these three new definitions.
            context={'规划路线':('先见','一阶'),'秘法习得':('启迪','二阶'),'通感者':('幻彩','三阶')}
            style,tier=context[case['name']]
            s={'id':allocate(dom),'name':case['name'],'style':style,'tier':tier,'kind':'skill','deity':dn}
            pool.append(s);added.append(s['id'])
        old=copy.deepcopy(s);update(s,block)
        if s!=old:updated.append(s['id'])
    # Restore independent starting features and remove their text from the preceding skill.
    for dn,parent,features in [
        ('知识与智慧之神','阅读魔法',['预习课程','知识传导']),
        ('艺术与创造之神','绘彩术',['同调协手'])]:
        dom=domain['domains'][dn];path=docx_path(dn)
        if str(path) not in cache:parse(path,next(s['source']['para_start'] for s in dom['skills'] if s['name']==parent))
        ps,names=cache[str(path)]
        for nm in [parent]+features:
            positions=[i for i,p in enumerate(ps) if p['text']==nm and C.is_skill_header(ps,i,names)]
            if len(positions)!=1:raise ValueError((dn,nm,positions))
            hits=[s for s in dom['skills'] if s['name']==nm]
            if hits:s=hits[0]
            else:
                s={'id':allocate(dom),'name':nm,'style':'','tier':'起始','kind':'starting','deity':dn}
                dom['skills'].append(s);added.append(s['id'])
            update(s,parse(path,positions[0]))

    protected_mage = {
        "\u53d8\u5f62\u672f\u00b7\u67ad\u718a", "\u53d8\u5f62\u672f\u00b7\u9c7c", "\u53d8\u5f62\u672f\u00b7\u9e1f", "\u56db\u81c2\u672f", "\u7206\u88c2\u672f",
        "\u77f3\u5316\u672f", "\u7a7f\u5899\u672f", "\u8f6f\u6ce5\u5f62\u6001", "\u9690\u533f\u4f20\u8baf\u672f", "\u5492\u6cd5\u5b66\u6d3e\u5e8f\u5217"}
    source_report = {}
    for cn, doc in data.items():
        path = ROOT / f"\u57fa\u7840\u804c\u4e1a-{cn}.docx"
        if str(path) not in cache:
            ps = C.extract_paragraphs(path); cache[str(path)] = (ps, E.discover_skill_names(ps))
        ps, discovered = cache[str(path)]
        names = discovered | {s["name"] for s in doc["skills"]}
        index = C.build_docx_index(ps, names)
        used = set(); refreshed = []; preserved = []
        for skill in doc["skills"]:
            if (cn == "\u6cd5\u5e08" and skill["name"] in protected_mage) or (
                cn == "\u730e\u4eba" and skill["name"] in {"\u7075\u9f9f\u5b88\u62a4\u00b7\u5929\u8d4b","\u7075\u7334\u5b88\u62a4\u00b7\u5929\u8d4b","\u7075\u72d0\u5b88\u62a4\u00b7\u5929\u8d4b"}
            ) or (cn == "\u53ec\u5524\u5e08" and skill["name"] == "\u84dd\u7130\u672f"):
                preserved.append(skill["name"]); continue
            block = C.pick_block(index, skill, used)
            if not block:
                raise ValueError(f"Unexplained missing source: {cn}/{skill['name']}")
            if cn == "\u6cd5\u5e08" and skill["name"] == "\u53ec\u5524\u9ab7\u9ac5\u58eb\u5175":
                # Explicit documented source typo, preserve the approved correction.
                block = json.loads(json.dumps(block, ensure_ascii=False).replace("先攻时序人非人值6", "先攻时序值6"))
            old = copy.deepcopy(skill);update(skill, block)
            if skill != old:refreshed.append(skill["id"])
        source_report[cn] = {"updated":len(refreshed),"preserved":preserved}

    import extract_cleric_domains as domain_extract
    for dn, dom in domain["domains"].items():
        path = docx_path(dn)
        if str(path) not in cache:
            ps = C.extract_paragraphs(path);cache[str(path)] = (ps,E.discover_skill_names(ps))
        ps,names = cache[str(path)]
        index = C.build_docx_index(ps,names | {s["name"] for s in dom["skills"]})
        initial = {s["name"]:s for s in domain_extract.extract_domain(dn)["initial_feats"]}
        used = set()
        for skill in dom["skills"]:
            if skill.get("kind") == "initial_feat":
                src = initial.get(skill["name"])
                if not src:raise ValueError(f"Unexplained missing initial feature: {dn}/{skill['name']}")
                skill["description"] = src["description"]
                continue
            block = C.pick_block(index,skill,used)
            if not block:raise ValueError(f"Unexplained missing domain source: {dn}/{skill['name']}")
            update(skill,block)
    # The new multiline-upgrade parser also repairs the existing general-talent regression.
    general_path = ROOT/"\u804c\u4e1a\u9875/\u6570\u636e/\u901a\u7528\u5929\u8d4b\u6811.json"
    general = json.loads(general_path.read_text(encoding="utf8"))
    general_paras = C.extract_paragraphs(ROOT/"\u901a\u7528\u5929\u8d4b\u6811.docx")
    general_index = C.build_docx_index(general_paras,{s["name"] for s in general["skills"]})
    for skill in general["skills"]:
        if skill["name"] == "\u9965\u997f\u6e38\u620f":
            block = C.pick_block(general_index,skill,set())
            if not block:raise ValueError("Missing general talent source")
            update(skill,block)
    print(json.dumps({"source_coverage":source_report},ensure_ascii=False))
    # Canonical IDs with explicit old aliases; player instance UIDs remain unchanged.
    for s in data['战舞者']['skills']:
        if s['id'].startswith('zw-'):s['legacy_ids']=[s['id'].replace('zw-','wd-',1)]
    writes={}
    def queue(path,content):
        rel=path.relative_to(ROOT)
        old=path.read_text(encoding="utf8") if path.exists() else None
        if old==content:
            writes.pop(str(rel),None);return
        if path.suffix==".json" and old is not None and json.loads(old)==json.loads(content):
            writes.pop(str(rel),None);return
        writes[str(rel)]=content
    queue(general_path,dump(general))
    general_skill = next(s for s in general["skills"] if s["name"] == "\u9965\u997f\u6e38\u620f")
    gb = extract_to_block(general_skill)
    ghp = ROOT/"\u804c\u4e1a\u9875/\u901a\u7528\u5929\u8d4b\u6811.html"
    gh = C.patch_html(ghp.read_text(encoding="utf8"),general_skill["id"],C.build_detail_html(gb),
                     C.build_data_search(gb,general_skill.get("style",""),C.tier_label_from_skill(general_skill),general_skill.get("tags",[])),
                     C.build_skill_data_attrs(general_skill,gb["mark_dots"],"\u901a\u7528"))
    queue(ghp,gh)
    gfp = ROOT/"\u65af\u8bfa\u5fb7\u8dd1\u56e2/skill_effects_\u901a\u7528\u5929\u8d4b\u6811.json"
    gfx = json.loads(gfp.read_text(encoding="utf8"))
    for rows in gfx.values():
        for i,row in enumerate(rows):
            if row["id"] == general_skill["id"]:
                rows[i] = C.json_to_fx_entry(general_skill,"\u901a\u7528\u5929\u8d4b\u6811")
    queue(gfp,dump(gfx))
    for cn,doc in data.items():
        for s in doc['skills']:U.enrich_skill(s)
        assert [(s['id'],s['name']) for s in doc['skills']]==before[cn]
        queue(ROOT/'职业页/数据'/f'{cn}.json',dump(doc))
        old_html=(ROOT/'职业页'/f'{cn}.html').read_text(encoding='utf8');h=old_html
        for s in doc['skills']:
            block=extract_to_block(s);detail=C.build_detail_html(block,{'unit_tables':s.get('unit_tables',[]),'roll_tables':s.get('roll_tables',[])})
            search=C.append_tables_to_search(C.build_data_search(block,s.get('style',''),C.tier_label_from_skill(s),s.get('tags',[])),s)
            h=C.patch_html(h,s['id'],detail,search,C.build_skill_data_attrs(s,block['mark_dots'],cn))
        queue(ROOT/'职业页'/f'{cn}.html',h)
        effects=[C.json_to_fx_entry(s,cn) for s in doc['skills']]
        queue(ROOT/'斯诺德跑团'/f'skill_effects_{cn}.json',dump({cn:effects}))
    ph,nh=[],[]
    for dn,dom in domain['domains'].items():
        for s in dom['skills']:U.enrich_skill(s)
        a,b=D.build_domain_panel_html(dn,dom['id'],dom['skills'],dom.get('combat_styles',[]))
        ph.append(a);nh.append(b)
    queue(ROOT/'职业页/数据/牧师·神圣领域.json',dump(domain))
    current=writes.get('职业页\\牧师.html',writes.get('职业页/牧师.html',(ROOT/'职业页/牧师.html').read_text(encoding='utf8')))
    h=D.inject_html(current,D.build_chips_html(domain['pantheon']),''.join(ph),''.join(nh))
    queue(ROOT/'职业页/牧师.html',h)
    print(json.dumps({'apply':args.apply,'refreshed':len(updated),'added':added,'files':list(writes)},ensure_ascii=False,indent=2))
    if args.apply:
        for rel,content in writes.items():
            src=ROOT/rel;src.write_text(content,encoding='utf8',newline='\n')
            dst=ROOT/'electron-app'/rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
        for script in ("build_panel_skill_data.py","gen_skill_index.py"):
            subprocess.check_call([sys.executable,"-B","-X","utf8",str(ROOT/"scripts"/script)],cwd=ROOT)
        subprocess.check_call(["node",str(ROOT/"scripts/build_class_search_index.js")],cwd=ROOT)
        for name in ("search-index.json","search-index.js"):
            shutil.copy2(ROOT/"职业页"/name,ROOT/"electron-app/职业页"/name)
if __name__=='__main__':main()
