#!/usr/bin/env python3
"""Golden tests for image skill extract (fixture only — never writes 法师 site files)."""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from extract_skill_images import extract_images  # noqa: E402

EXPECTED_NAMES = {
    "裁剪生命之线",
    "真名显露",
    "宿命环·回溯",
    "宿命环·现界",
    "宿命环·未来",
    "必中真眼",
    "命运抉择",
    "预言学派序列",
}


def file_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    mage_html = ROOT / "职业页" / "法师.html"
    mage_json = ROOT / "职业页" / "数据" / "法师.json"
    sha_before = {str(p): file_sha(p) for p in (mage_html, mage_json) if p.exists()}

    pngs = sorted((ROOT / "测试型更新").glob("*.png"))
    lines = ROOT / "测试型更新" / "预言七阶.ocr.json"
    data = extract_images(pngs, lines)
    out = ROOT / "scripts" / "extracts" / "_image_fixtures" / "法师_预言_七阶_from_png.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    names = {s["name"] for s in data["skills"]}
    missing = EXPECTED_NAMES - names
    assert not missing, f"missing skill names: {missing}"

    with_cost = [s for s in data["skills"] if (s.get("cost") or [])]
    # Color dots from image sampling may attach; require at least some costs OR dots detected
    dots_total = sum(info["dots"] for info in data["meta"]["per_image"])
    assert dots_total > 0 or with_cost, "expected color dots or cost arrays"

    for p, sha in sha_before.items():
        assert file_sha(Path(p)) == sha, f"site file mutated: {p}"

    assert data["meta"].get("fixture_only") is True
    print("[GOLDEN PASS] image extract")
    print(f"  skills={len(names)} dots_total={dots_total} → {out.relative_to(ROOT)}")
    print("  mage site files unchanged")


if __name__ == "__main__":
    main()
