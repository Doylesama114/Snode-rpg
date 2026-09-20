# -*- coding: utf-8 -*-
from pathlib import Path
import json

data = json.loads(Path(r"D:\Download\scholar-agent-main\scripts\_tmp_adv_branch_map.json").read_text(encoding="utf-8"))
out = []
out.append("=== PRIEST BRANCHES ===")
for b in data["priest_blocks"]:
    out.append(f"P{b['index']} ({b['para_start']}-{b['para_end']}): " + " / ".join(b["cards"]))
out.append("")
out.append("=== WARLOCK BRANCHES ===")
for b in data["warlock_blocks"]:
    out.append(f"W{b['index']} ({b['para_start']}-{b['para_end']}): " + " / ".join(b["cards"]))
out.append("")
out.append("=== INTRO ===")
for line in data.get("intro", [])[:40]:
    out.append(line)
out.append("")
out.append("=== DEITY-LIKE NEAR ===")
for line in data.get("deity_like_near_sections", [])[:50]:
    out.append(line)
out.append("")
out.append("=== CLASS DOCX KEYWORD HITS ===")
for k, v in data.items():
    if k.startswith("class_docx_"):
        out.append(k)
        for h in v.get("keyword_hits_sample", [])[:40]:
            out.append("  " + h)

Path(r"D:\Download\scholar-agent-main\scripts\_tmp_adv_branch_summary.txt").write_text("\n".join(out), encoding="utf-8")
print("ok")
