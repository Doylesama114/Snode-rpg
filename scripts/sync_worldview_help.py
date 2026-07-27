# -*- coding: utf-8 -*-
"""
Sync 斯诺德世界观架构.docx into 斯诺德跑团/help.html as an in-page
「规则 / 世界观」翻页 pane. Also extracts the map image and mirrors to electron-app.
"""
from __future__ import annotations

import html as html_lib
import re
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCX = ROOT / "斯诺德世界观架构.docx"
HELP = ROOT / "斯诺德跑团" / "help.html"
MEDIA_DIR = ROOT / "斯诺德跑团" / "help-media"
MAP_NAME = "world-map.png"
ELECTRON_DIR = ROOT / "electron-app" / "斯诺德跑团"

# Sidebar / top-level chapters (match docx TOC body headings)
TOP_CHAPTERS = [
    "欢迎来到斯诺德",
    "年代记",
    "雷恩王国",
    "其他古老的文明",
    "斯诺德地图志",
]

# Secondary chapter titles under 雷恩王国 (with optional trailing dot in source)
SUB_CHAPTER_PREFIXES = (
    "雷恩王国的历史",
    "雷恩王国的国土面积",
    "雷恩王国的人口",
    "雷恩王国的地域与形势",
    "雷恩王国的节日",
    "雷恩王国的宗教信仰",
    "雷恩王国的异教神灵",
    "雷恩王国的邪恶神灵",
    "雷恩王国的邪恶神祇",
    "雷恩王国的商业贸易",
    "雷恩王国的律法",
    "雷恩王国的周边政权",
    "雷恩王国的组织势力",
)

ERA_RE = re.compile(r"^.+年代（.+）$")
def looks_like_festival(text: str) -> bool:
    # e.g. 新年（1月1日） / 光明节（三月初）
    return "（" in text and ("月" in text or "末" in text or "初" in text) and len(text) <= 28
TOC_DOTS_RE = re.compile(r"[.…]{3,}\s*\d+\s*$|[.]{5,}")
SLUG_NON = re.compile(r"[^\w\u4e00-\u9fff]+", re.UNICODE)

BEGIN_PANE = "<!-- WORLDVIEW-PANE -->"
END_PANE = "<!-- /WORLDVIEW-PANE -->"
BEGIN_CSS = "/* HELP-PAGER-CSS */"
END_CSS = "/* /HELP-PAGER-CSS */"
BEGIN_TTS_CSS = "/* HELP-TTS-CSS */"
END_TTS_CSS = "/* /HELP-TTS-CSS */"
BEGIN_JS = "<!-- HELP-PAGER-SCRIPT -->"
END_JS = "<!-- /HELP-PAGER-SCRIPT -->"

TTS_CSS = """
.tts-toolbar{
  background:#fffdf8;border:1px solid #d8d2c4;border-radius:10px;
  padding:14px 16px;margin:0 0 16px;
}
.tts-toolbar-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.tts-btn{
  border:1px solid #d8d2c4;background:#fff;color:#1f2522;
  border-radius:6px;padding:6px 12px;font-size:13px;cursor:pointer;font-family:inherit;
}
.tts-btn:hover:not(:disabled){border-color:#a46d1f;color:#a46d1f}
.tts-btn:disabled{opacity:.45;cursor:not-allowed}
.tts-btn-primary{background:#a46d1f;color:#fff;border-color:#a46d1f}
.tts-btn-primary:hover:not(:disabled){background:#c0852f;border-color:#c0852f;color:#fff}
.tts-btn-primary.active{box-shadow:0 0 0 2px rgba(164,109,31,.25)}
.tts-btn-section{
  margin-left:10px;padding:2px 8px;font-size:12px;font-weight:normal;
  vertical-align:middle;
}
.tts-hint{margin:8px 0 0;font-size:12px;color:#69706b;line-height:1.6}
.tts-clickable{cursor:pointer}
.tts-clickable:hover{background:rgba(164,109,31,.06);border-radius:4px}
.tts-no-speak{cursor:default}
.tts-speaking{
  outline:2px solid rgba(164,109,31,.55);
  background:rgba(164,109,31,.08);border-radius:4px;
}
.help-tts-toast{
  position:fixed;left:50%;bottom:28px;transform:translateX(-50%);
  background:rgba(20,20,20,.92);color:#fff;padding:10px 16px;border-radius:8px;
  font-size:13px;z-index:9999;opacity:0;pointer-events:none;transition:opacity .2s;
}
.help-tts-toast.show{opacity:1}
@media (prefers-color-scheme:dark){
  .tts-toolbar{background:#24272b;border-color:#3a3d40}
  .tts-btn{background:#1a1d20;border-color:#3a3d40;color:#e8e6e3}
  .tts-btn:hover:not(:disabled){border-color:#d4a54a;color:#d4a54a}
  .tts-btn-primary{background:#d4a54a;color:#1a1d20;border-color:#d4a54a}
  .tts-hint{color:#9d9b98}
  .tts-clickable:hover{background:rgba(212,165,74,.12)}
  .tts-speaking{outline-color:rgba(212,165,74,.55);background:rgba(212,165,74,.12)}
}
html.dark .tts-toolbar{background:#24272b;border-color:#3a3d40}
html.dark .tts-btn{background:#1a1d20;border-color:#3a3d40;color:#e8e6e3}
html.dark .tts-btn:hover:not(:disabled){border-color:#d4a54a;color:#d4a54a}
html.dark .tts-btn-primary{background:#d4a54a;color:#1a1d20;border-color:#d4a54a}
html.dark .tts-hint{color:#9d9b98}
html.dark .tts-clickable:hover{background:rgba(212,165,74,.12)}
html.dark .tts-speaking{outline-color:rgba(212,165,74,.55);background:rgba(212,165,74,.12)}
"""

PAGER_CSS = """
.help-pager{display:flex;gap:8px;margin:0 0 16px;flex-wrap:wrap}
.help-pager button{
  border:1px solid #d8d2c4;background:#fffdf8;color:#1f2522;
  border-radius:8px;padding:8px 16px;font-size:14px;cursor:pointer;
  font-family:inherit;
}
.help-pager button:hover{border-color:#a46d1f;color:#a46d1f}
.help-pager button.active{background:#a46d1f;color:#fff;border-color:#a46d1f}
.help-pane-hidden{display:none !important}
.help-content img{max-width:100%;height:auto;border-radius:8px;margin:12px 0;display:block}
.section h4{font-size:14px;font-weight:bold;margin:14px 0 6px;color:#a46d1f}
@media (prefers-color-scheme:dark){
  .help-pager button{background:#24272b;border-color:#3a3d40;color:#e8e6e3}
  .help-pager button:hover{border-color:#d4a54a;color:#d4a54a}
  .help-pager button.active{background:#d4a54a;color:#1a1d20;border-color:#d4a54a}
  .section h4{color:#d4a54a}
}
html.dark .help-pager button{background:#24272b;border-color:#3a3d40;color:#e8e6e3}
html.dark .help-pager button:hover{border-color:#d4a54a;color:#d4a54a}
html.dark .help-pager button.active{background:#d4a54a;color:#1a1d20;border-color:#d4a54a}
html.dark .section h4{color:#d4a54a}
"""

PAGER_JS = r"""
<script id="help-pager-script">
(function(){
  function qs(name){
    try{
      var u = new URL(location.href);
      return u.searchParams.get(name) || "";
    }catch(e){ return ""; }
  }
  function setView(view, push){
    view = (view === "world") ? "world" : "rules";
    var prev = document.body.getAttribute("data-help-view") || "rules";
    document.body.setAttribute("data-help-view", view);
    var rules = document.getElementById("help-pane-rules");
    var world = document.getElementById("help-pane-world");
    if(rules) rules.classList.toggle("help-pane-hidden", view !== "rules");
    if(world) world.classList.toggle("help-pane-hidden", view !== "world");
    document.querySelectorAll(".help-pager button").forEach(function(btn){
      btn.classList.toggle("active", btn.getAttribute("data-view") === view);
    });
    var sub = document.getElementById("help-subtitle");
    if(sub){
      sub.textContent = view === "world"
        ? "斯诺德世界观 · 设定集"
        : "斯诺德规则 · 冒险者手册";
    }
    if(prev === "world" && view !== "world" && window.HelpWorldTts && window.HelpWorldTts.stop){
      window.HelpWorldTts.stop();
    }
    if(push){
      try{
        var u = new URL(location.href);
        if(view === "rules") u.searchParams.delete("view");
        else u.searchParams.set("view", "world");
        history.replaceState(null, "", u.pathname + u.search + u.hash);
      }catch(e){}
    }
  }
  document.querySelectorAll(".help-pager button").forEach(function(btn){
    btn.addEventListener("click", function(){
      setView(btn.getAttribute("data-view"), true);
      window.scrollTo(0, 0);
    });
  });
  var initial = qs("view");
  if(!initial && location.hash && location.hash.indexOf("w-") === 1){
    initial = "world";
  }
  setView(initial === "world" ? "world" : "rules", false);
})();
</script>
"""


def esc(s: str) -> str:
    return html_lib.escape(s, quote=True)


def slugify(title: str) -> str:
    t = title.strip().rstrip(".")
    t = SLUG_NON.sub("-", t).strip("-")
    return t[:48] or "sec"


def extract_paragraphs(docx: Path) -> list[str]:
    with zipfile.ZipFile(docx) as zf:
        xml = zf.read("word/document.xml").decode("utf-8")
    paras: list[str] = []
    for pxml in re.findall(r"<w:p[\s\S]*?</w:p>", xml):
        parts = re.findall(r"<w:t[^>]*>(.*?)</w:t>", pxml)
        if not parts:
            continue
        text = "".join(parts).strip()
        if text:
            paras.append(text)
    return paras


def extract_map(docx: Path, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(docx) as zf:
        media = [n for n in zf.namelist() if n.startswith("word/media/") and not n.endswith("/")]
        if not media:
            return False
        # Prefer largest image (map)
        media.sort(key=lambda n: zf.getinfo(n).file_size, reverse=True)
        data = zf.read(media[0])
        dest.write_bytes(data)
        return True


def is_toc_line(text: str) -> bool:
    if TOC_DOTS_RE.search(text):
        return True
    # merged TOC rows like "...32雷恩王国的组织势力......45"
    if text.count("...") >= 2 and any(ch.isdigit() for ch in text):
        return True
    return False


def normalize_title(text: str) -> str:
    return text.strip().rstrip(".")


def split_glued_heading(text: str) -> list[str]:
    """Split rare '标题.正文…' glued paragraphs from the docx."""
    for p in SUB_CHAPTER_PREFIXES:
        glue = p + "."
        if text.startswith(glue) and len(text) > len(glue) + 8:
            rest = text[len(glue) :]
            if rest and not rest[0].isspace() and rest[0] not in ".…":
                return [glue, rest]
    return [text]


def classify(text: str) -> str:
    """Return: skip | top | sub | era | entry | bullet | para"""
    if text == "世界观架构":
        return "skip"
    if is_toc_line(text):
        return "skip"
    nt = normalize_title(text)
    if nt in TOP_CHAPTERS:
        return "top"
    # Exact sub-chapter titles only (do NOT use startswith — body text also begins with these)
    if any(nt == p or text == p or text == p + "." for p in SUB_CHAPTER_PREFIXES):
        return "sub"
    if ERA_RE.match(text) or ERA_RE.match(nt):
        return "era"
    if text.startswith("·"):
        return "bullet"
    # Short titled entries (festivals, deities, orgs, empires) often end with '.'
    if len(nt) <= 28 and (
        text.endswith(".")
        or looks_like_festival(text)
        or looks_like_festival(nt)
        or nt.endswith("之神")
        or nt.endswith("女神")
        or nt
        in (
            "死神",
            "九柱神",
            "秘党",
            "黑暗世界",
            "谋杀屋",
            "五海王者",
            "印记协会",
            "印象协会",
        )
    ):
        return "entry"
    if len(nt) <= 22 and not text.endswith("。") and not text.endswith("；") and "，" not in text[:8]:
        # short non-sentence headings without trailing period
        if any(
            k in nt
            for k in (
                "帝国",
                "王朝",
                "公国",
                "联邦",
                "联盟",
                "森林",
                "骑士团",
                "评议会",
                "工作室",
                "报刊",
                "周刊",
                "协会",
                "秘社",
                "战线",
                "中队",
                "关",
                "寺",
                "宗",
            )
        ):
            return "entry"
    return "para"


def build_world_pane(paras: list[str], map_rel: str) -> tuple[str, list[tuple[str, str]]]:
    """Return (pane_inner_html without outer markers, toc list of (id, title))."""
    toc: list[tuple[str, str]] = []
    body: list[str] = []
    open_section = False
    used_ids: set[str] = set()

    def close_section() -> None:
        nonlocal open_section
        if open_section:
            body.append("</div>\n")
            open_section = False

    def unique_id(base: str) -> str:
        sid = f"w-{base}"
        n = 2
        while sid in used_ids:
            sid = f"w-{base}-{n}"
            n += 1
        used_ids.add(sid)
        return sid

    for raw in paras:
        for text in split_glued_heading(raw):
            kind = classify(text)
            if kind == "skip":
                continue
            if kind == "top":
                close_section()
                title = normalize_title(text)
                sid = unique_id(slugify(title))
                toc.append((sid, title))
                body.append(f'<div class="section" id="{sid}"><h2>{esc(title)}</h2>\n')
                open_section = True
                if title == "斯诺德地图志":
                    body.append(
                        f'<div class="p"><img src="{esc(map_rel)}" alt="斯诺德地图" loading="lazy" /></div>\n'
                    )
                continue
            if not open_section:
                # orphan content before first top — wrap under intro
                sid = unique_id("intro")
                toc.append((sid, "前言"))
                body.append(f'<div class="section" id="{sid}"><h2>前言</h2>\n')
                open_section = True
            if kind == "sub":
                body.append(f"<h3>{esc(normalize_title(text))}</h3>\n")
            elif kind == "era":
                body.append(f"<h3>{esc(text)}</h3>\n")
            elif kind == "entry":
                body.append(f"<h4>{esc(normalize_title(text))}</h4>\n")
            elif kind == "bullet":
                body.append(f'<div class="p">{esc(text)}</div>\n')
            else:
                body.append(f'<div class="p">{esc(text)}</div>\n')

    close_section()

    toc_html = ['<nav class="toc"><div class="toc-title">世界观目录</div>\n']
    for sid, title in toc:
        toc_html.append(f'<a href="#{sid}">{esc(title)}</a>\n')
    toc_html.append("</nav>")

    pane = (
        '<div class="help-layout help-pane-hidden" id="help-pane-world">\n'
        f'<aside class="toc-sidebar">{"".join(toc_html)}</aside>\n'
        f'<main class="help-content">\n{"".join(body)}</main>\n'
        "</div>\n"
    )
    return pane, toc


def ensure_pager_css(html: str) -> str:
    block = f"{BEGIN_CSS}\n{PAGER_CSS}{END_CSS}\n"
    if BEGIN_CSS in html:
        html = re.sub(
            re.escape(BEGIN_CSS) + r".*?" + re.escape(END_CSS) + r"\n?",
            block,
            html,
            count=1,
            flags=re.S,
        )
        return html
    idx = html.find("</style>")
    if idx == -1:
        raise SystemExit("no </style> in help.html")
    return html[:idx] + block + html[idx:]


def ensure_tts_css(html: str) -> str:
    block = f"{BEGIN_TTS_CSS}\n{TTS_CSS}{END_TTS_CSS}\n"
    if BEGIN_TTS_CSS in html:
        html = re.sub(
            re.escape(BEGIN_TTS_CSS) + r".*?" + re.escape(END_TTS_CSS) + r"\n?",
            block,
            html,
            count=1,
            flags=re.S,
        )
        return html
    # Prefer after pager CSS block
    if END_CSS in html:
        return html.replace(END_CSS + "\n", END_CSS + "\n" + block, 1)
    idx = html.find("</style>")
    if idx == -1:
        raise SystemExit("no </style> in help.html")
    return html[:idx] + block + html[idx:]


def ensure_pager_ui(html: str) -> str:
    pager = (
        '<div class="help-pager" role="tablist" aria-label="帮助翻页">'
        '<button type="button" class="active" data-view="rules" role="tab">规则手册</button>'
        '<button type="button" data-view="world" role="tab">世界观架构</button>'
        "</div>\n"
    )
    if 'class="help-pager"' not in html:
        # insert after subtitle
        html = html.replace(
            '<div class="subtitle">斯诺德规则 · 冒险者手册</div>',
            '<div class="subtitle" id="help-subtitle">斯诺德规则 · 冒险者手册</div>\n' + pager,
            1,
        )
    else:
        # ensure subtitle has id
        html = html.replace(
            '<div class="subtitle">斯诺德规则 · 冒险者手册</div>',
            '<div class="subtitle" id="help-subtitle">斯诺德规则 · 冒险者手册</div>',
            1,
        )

    # Wrap existing help-layout as rules pane if not yet wrapped
    if 'id="help-pane-rules"' not in html:
        html = html.replace(
            '<div class="help-layout">',
            '<div class="help-layout" id="help-pane-rules">',
            1,
        )
    return html


def inject_world_pane(html: str, pane: str) -> str:
    block = f"{BEGIN_PANE}\n{pane}{END_PANE}\n"
    if BEGIN_PANE in html:
        html = re.sub(
            re.escape(BEGIN_PANE) + r".*?" + re.escape(END_PANE) + r"\n?",
            block,
            html,
            count=1,
            flags=re.S,
        )
        return html
    # Insert after rules pane closes: find </main></div> that ends help-layout rules
    # Prefer inserting before scroll script / after first help-layout close following help-content
    marker = "</main></div>\n\n<script>window.addEventListener('scroll'"
    if marker in html:
        return html.replace(marker, "</main></div>\n" + block + "\n<script>window.addEventListener('scroll'", 1)
    # fallback: before first <script> after help content
    idx = html.find("</main></div>")
    if idx == -1:
        raise SystemExit("cannot find rules pane end")
    end = idx + len("</main></div>")
    return html[:end] + "\n" + block + html[end:]


def ensure_pager_js(html: str) -> str:
    block = f"{BEGIN_JS}\n{PAGER_JS}\n{END_JS}\n"
    if BEGIN_JS in html:
        html = re.sub(
            re.escape(BEGIN_JS) + r".*?" + re.escape(END_JS) + r"\n?",
            block,
            html,
            count=1,
            flags=re.S,
        )
        return html
    if "</body>" in html:
        return html.replace("</body>", block + "</body>", 1)
    return html + block


def ensure_tts_script(html: str) -> str:
    tag = '<script src="help-tts.js"></script>'
    if "help-tts.js" in html:
        return html
    # After pager script block if present
    if END_JS in html:
        return html.replace(END_JS + "\n", END_JS + "\n" + tag + "\n", 1)
    if "</body>" in html:
        return html.replace("</body>", tag + "\n</body>", 1)
    return html + tag + "\n"


def mirror_to_electron() -> None:
    ELECTRON_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(HELP, ELECTRON_DIR / "help.html")
    tts_js = ROOT / "斯诺德跑团" / "help-tts.js"
    if tts_js.exists():
        shutil.copy2(tts_js, ELECTRON_DIR / "help-tts.js")
    media_src = MEDIA_DIR
    media_dst = ELECTRON_DIR / "help-media"
    if media_src.exists():
        if media_dst.exists():
            shutil.rmtree(media_dst)
        shutil.copytree(media_src, media_dst)
    print("mirrored help.html + help-tts.js + help-media → electron-app/斯诺德跑团/")


def verify(html: str, toc: list[tuple[str, str]]) -> None:
    errors = []
    if 'id="help-pane-world"' not in html:
        errors.append("missing help-pane-world")
    if 'id="help-pane-rules"' not in html:
        errors.append("missing help-pane-rules")
    if "help-pager" not in html:
        errors.append("missing help-pager")
    if "help-tts.js" not in html:
        errors.append("missing help-tts.js script")
    if BEGIN_TTS_CSS not in html:
        errors.append("missing HELP-TTS-CSS")
    if "欢迎来到斯诺德" not in html:
        errors.append("missing 欢迎来到斯诺德")
    if "斯诺德地图志" not in html:
        errors.append("missing 斯诺德地图志")
    if "雷恩王国" not in html:
        errors.append("missing 雷恩王国")
    map_path = MEDIA_DIR / MAP_NAME
    if not map_path.exists() or map_path.stat().st_size < 1000:
        errors.append("world-map.png missing/too small")
    if f'src="help-media/{MAP_NAME}"' not in html:
        errors.append("map img src missing")
    if len(toc) < 4:
        errors.append(f"toc too short: {toc}")
    e_help = ELECTRON_DIR / "help.html"
    e_map = ELECTRON_DIR / "help-media" / MAP_NAME
    e_tts = ELECTRON_DIR / "help-tts.js"
    if not e_help.exists():
        errors.append("electron help.html missing")
    elif e_help.stat().st_size != HELP.stat().st_size:
        errors.append("electron help.html size mismatch")
    if not e_map.exists():
        errors.append("electron map missing")
    if not e_tts.exists():
        errors.append("electron help-tts.js missing")
    if errors:
        raise SystemExit("VERIFY FAIL:\n- " + "\n- ".join(errors))
    print("VERIFY PASS")
    print("world toc:", ", ".join(t for _, t in toc))


def main() -> None:
    if not DOCX.exists():
        raise SystemExit(f"missing {DOCX}")
    if not HELP.exists():
        raise SystemExit(f"missing {HELP}")

    paras = extract_paragraphs(DOCX)
    print(f"extracted {len(paras)} paragraphs")

    map_path = MEDIA_DIR / MAP_NAME
    if extract_map(DOCX, map_path):
        print(f"wrote {map_path.relative_to(ROOT)} ({map_path.stat().st_size} bytes)")
    else:
        print("WARN: no media in docx")

    pane, toc = build_world_pane(paras, f"help-media/{MAP_NAME}")
    html = HELP.read_text(encoding="utf-8")
    html = ensure_pager_css(html)
    html = ensure_tts_css(html)
    html = ensure_pager_ui(html)
    html = inject_world_pane(html, pane)
    html = ensure_pager_js(html)
    html = ensure_tts_script(html)
    HELP.write_text(html, encoding="utf-8")
    print(f"updated {HELP.relative_to(ROOT)}")

    mirror_to_electron()
    verify(html, toc)


if __name__ == "__main__":
    main()
