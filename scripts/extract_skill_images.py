#!/usr/bin/env python3
"""
Extract skill cards from screenshot PNGs into isomorphic extract JSON.

Uses Pillow for ● color sampling; OCR via pytesseract or paddleocr when available.
If OCR engines are missing, accepts --lines-json (pre-OCR line dump) for offline tests.

Usage:
  python scripts/extract_skill_images.py --dir 测试型更新 --out scripts/extracts/_image_fixtures/法师_预言_七阶_from_png.json
  python scripts/test_extract_skill_images_golden.py
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from class_sync_core import COLOR_TABLE, HEX2NAME, FIELD_ORDER, skill_type_from_keywords  # noqa: E402
from extract_class_docx import cost_meta  # noqa: E402

FIELD_PREFIXES = [f"{k}：" for k in FIELD_ORDER] + ["费用：", "描述："]
KNOWN_HEX = [COLOR_TABLE[k] for k in COLOR_TABLE]


def rgb_to_hex(r: int, g: int, b: int) -> str:
    return f"#{r:02X}{g:02X}{b:02X}"


def nearest_palette(hex_c: str) -> str:
    h = hex_c.lstrip("#")
    if len(h) != 6:
        return hex_c
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    best, best_d = None, 1e18
    for ph in set(KNOWN_HEX):
        p = ph.lstrip("#")
        pr, pg, pb = int(p[0:2], 16), int(p[2:4], 16), int(p[4:6], 16)
        d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
        if d < best_d:
            best_d, best = d, ph
    return best or hex_c


def detect_color_dots(image_path: Path, min_sat: float = 35.0) -> list[dict]:
    """Find saturated near-circular blobs; return {x,y,hex,r}."""
    try:
        from PIL import Image
    except ImportError as e:
        raise SystemExit("Pillow required: pip install pillow") from e

    im = Image.open(image_path).convert("RGB")
    w, h = im.size
    # Downscale for speed
    scale = max(1, max(w, h) // 900)
    small = im.resize((w // scale, h // scale))
    sw, sh = small.size
    pix = small.load()

    visited = [[False] * sw for _ in range(sh)]
    dots = []

    def sat(r, g, b):
        mx, mn = max(r, g, b), min(r, g, b)
        if mx == 0:
            return 0.0
        return (mx - mn) / mx * 100.0

    for y in range(sh):
        for x in range(sw):
            if visited[y][x]:
                continue
            r, g, b = pix[x, y]
            if sat(r, g, b) < min_sat:
                visited[y][x] = True
                continue
            # flood fill
            stack = [(x, y)]
            cells = []
            visited[y][x] = True
            while stack:
                cx, cy = stack.pop()
                cells.append((cx, cy, pix[cx, cy]))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < sw and 0 <= ny < sh and not visited[ny][nx]:
                        rr, gg, bb = pix[nx, ny]
                        if sat(rr, gg, bb) >= min_sat:
                            visited[ny][nx] = True
                            stack.append((nx, ny))
                        else:
                            visited[ny][nx] = True
            if 8 <= len(cells) <= 400:
                xs = [c[0] for c in cells]
                ys = [c[1] for c in cells]
                bw, bh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
                if bw == 0 or bh == 0:
                    continue
                ratio = max(bw, bh) / max(1, min(bw, bh))
                if ratio > 2.2:
                    continue
                # average color of high-sat core
                rs = sum(c[2][0] for c in cells) // len(cells)
                gs = sum(c[2][1] for c in cells) // len(cells)
                bs = sum(c[2][2] for c in cells) // len(cells)
                # skip near-white / near-black background noise lightly
                if max(rs, gs, bs) < 40:
                    continue
                hx = nearest_palette(rgb_to_hex(rs, gs, bs))
                dots.append({
                    "x": (min(xs) + max(xs)) / 2 * scale,
                    "y": (min(ys) + max(ys)) / 2 * scale,
                    "hex": hx,
                    "r": max(bw, bh) * scale / 2,
                })
    # merge nearby
    dots.sort(key=lambda d: (d["y"], d["x"]))
    merged = []
    for d in dots:
        if merged and abs(merged[-1]["y"] - d["y"]) < 12 and abs(merged[-1]["x"] - d["x"]) < 12:
            continue
        merged.append(d)
    return merged


def ocr_lines(image_path: Path) -> list[dict]:
    """Return [{text, y, x}] sorted by reading order."""
    # Try paddleocr
    try:
        from paddleocr import PaddleOCR  # type: ignore
        ocr = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)
        result = ocr.ocr(str(image_path), cls=True)
        lines = []
        for block in result or []:
            for item in block or []:
                box, (txt, _conf) = item
                ys = [p[1] for p in box]
                xs = [p[0] for p in box]
                lines.append({"text": txt.strip(), "y": sum(ys) / 4, "x": min(xs)})
        lines.sort(key=lambda L: (L["y"], L["x"]))
        return [L for L in lines if L["text"]]
    except Exception:
        pass

    # Try pytesseract
    try:
        import pytesseract
        from PIL import Image
        data = pytesseract.image_to_data(
            Image.open(image_path), lang="chi_sim+eng", output_type=pytesseract.Output.DICT
        )
        rows: dict[int, list] = defaultdict(list)
        n = len(data["text"])
        for i in range(n):
            txt = (data["text"][i] or "").strip()
            if not txt:
                continue
            rows[data["line_num"][i]].append(
                (data["left"][i], data["top"][i], txt)
            )
        lines = []
        for _ln, parts in sorted(rows.items()):
            parts.sort()
            text = "".join(p[2] for p in parts)
            y = sum(p[1] for p in parts) / len(parts)
            x = parts[0][0]
            lines.append({"text": text, "y": y, "x": x})
        return lines
    except Exception:
        pass

    return []


def load_lines_json(path: Path) -> list[dict]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, dict) and "lines" in raw:
        raw = raw["lines"]
    out = []
    for i, item in enumerate(raw):
        if isinstance(item, str):
            out.append({"text": item, "y": float(i * 20), "x": 0.0})
        else:
            out.append({
                "text": item.get("text", ""),
                "y": float(item.get("y", i * 20)),
                "x": float(item.get("x", 0)),
            })
    return [L for L in out if L["text"].strip()]


def split_field_line(text: str) -> tuple[str | None, str]:
    for pref in FIELD_PREFIXES:
        if text.startswith(pref):
            return pref[:-1], text[len(pref):].strip()
    return None, text


def parse_skills_from_lines(lines: list[dict], dots: list[dict], image_name: str) -> list[dict]:
    """Assemble skills using field prefixes; attach nearby color dots to 标识 rows."""
    texts = [L["text"] for L in lines]
    skills = []
    i = 0
    while i < len(texts):
        t = texts[i]
        # Skill title: short line not a field, next lines have fields
        if (
            len(t) <= 24
            and "：" not in t
            and not t.startswith("七阶")
            and not t.startswith("技能名称")
            and i + 1 < len(texts)
        ):
            window = texts[i + 1 : i + 10]
            if any(any(w.startswith(p) for p in FIELD_PREFIXES) for w in window):
                name = t
                fields: dict[str, str] = {}
                desc: list[str] = []
                level_upgrades: list[dict] = []
                cost: list[str] = []
                mark_y = None
                j = i + 1
                phase = "fields"
                while j < len(texts):
                    line = texts[j]
                    # next skill title heuristic
                    if (
                        j > i + 2
                        and len(line) <= 24
                        and "：" not in line
                        and any(
                            any(texts[k].startswith(p) for p in ("前置条件：", "额外条件：", "关键词："))
                            for k in range(j + 1, min(j + 6, len(texts)))
                        )
                    ):
                        break
                    fk, val = split_field_line(line)
                    if fk in ("标识", "费用"):
                        mark_y = lines[j]["y"]
                        # attach dots near this y
                        near = [d for d in dots if abs(d["y"] - mark_y) < 28]
                        near.sort(key=lambda d: d["x"])
                        cost = [d["hex"] for d in near]
                        phase = "post"
                        j += 1
                        continue
                    if fk == "描述":
                        if val:
                            fields["描述"] = val
                        phase = "post"
                        j += 1
                        continue
                    if fk:
                        fields[fk] = val
                        phase = "fields"
                        j += 1
                        continue
                    if phase == "post":
                        m = re.match(r"^你的(.+?)等级到达(\d+)级时[：:](.+)$", line)
                        if m:
                            level_upgrades.append({
                                "class": m.group(1),
                                "level": int(m.group(2)),
                                "text": m.group(3),
                                "label": f"你的{m.group(1)}等级到达{m.group(2)}级时：",
                            })
                        else:
                            desc.append(line)
                    j += 1

                if fields.get("关键词") or fields.get("施展时间") or fields.get("前置条件"):
                    skills.append({
                        "name": name,
                        "style": "预言",
                        "tier": "七阶",
                        "type": skill_type_from_keywords(fields.get("关键词", "")),
                        "fields": fields,
                        "cost": cost,
                        "cost_meta": cost_meta(cost),
                        "description": desc,
                        "level_upgrades": level_upgrades,
                        "flavor": "",
                        "source": {"kind": "image", "image": image_name, "mark_y": mark_y},
                    })
                i = j
                continue
        i += 1
    return skills


def extract_images(paths: list[Path], lines_json: Path | None = None) -> dict:
    all_skills = []
    per_image = []
    for p in paths:
        dots = detect_color_dots(p)
        if lines_json and lines_json.exists():
            # shared lines file OR per-image sidecar
            side = lines_json
            per = p.with_suffix(".ocr.json")
            if per.exists():
                side = per
            lines = load_lines_json(side)
        else:
            lines = ocr_lines(p)
            # allow per-image sidecar fallback
            side = p.with_suffix(".ocr.json")
            if not lines and side.exists():
                lines = load_lines_json(side)
        skills = parse_skills_from_lines(lines, dots, p.name) if lines else []
        # If no OCR lines, still record dots for fixture diagnostics
        per_image.append({
            "image": p.name,
            "dots": len(dots),
            "dot_hexes": [d["hex"] for d in dots[:40]],
            "ocr_lines": len(lines),
            "skills": len(skills),
        })
        all_skills.extend(skills)

    # dedupe by name keep richer
    best = {}
    for s in all_skills:
        k = s["name"]
        score = (len(s.get("fields") or {}), len(s.get("cost") or []), len(s.get("description") or []))
        if k not in best or score > (
            len(best[k].get("fields") or {}),
            len(best[k].get("cost") or []),
            len(best[k].get("description") or []),
        ):
            best[k] = s

    return {
        "meta": {
            "class_name": "法师",
            "style_hint": "预言",
            "tier_hint": "七阶",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "images": [str(p.name) for p in paths],
            "per_image": per_image,
            "skill_count": len(best),
            "fixture_only": True,
            "note": "DO NOT apply to production 法师 data",
        },
        "skills": list(best.values()),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", type=Path, default=ROOT / "测试型更新")
    ap.add_argument("--out", type=Path, default=ROOT / "scripts" / "extracts" / "_image_fixtures" / "法师_预言_七阶_from_png.json")
    ap.add_argument("--lines-json", type=Path, default=None, help="Optional OCR lines dump")
    args = ap.parse_args()

    paths = sorted(args.dir.glob("*.png"))
    if not paths:
        raise SystemExit(f"no png in {args.dir}")
    data = extract_images(paths, args.lines_json)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[IMAGE EXTRACT] skills={data['meta']['skill_count']} → {args.out.relative_to(ROOT)}")
    for info in data["meta"]["per_image"]:
        print(f"  {info['image']}: dots={info['dots']} ocr_lines={info['ocr_lines']} skills={info['skills']}")
    for s in data["skills"]:
        print(f"  - {s['name']} cost={len(s.get('cost') or [])}")


if __name__ == "__main__":
    main()
