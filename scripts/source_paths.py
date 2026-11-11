"""
源文件路径解析（v1.0.8105 起）：

真值文件（docx/xlsx/png）正在从仓库根目录迁往 源文件/。
这个模块让脚本不必关心文件当前在哪：先找 源文件/ 下的分类目录，找不到再回退根目录。

用法：
    from source_paths import source_path
    DOCX = source_path("基础职业-战士.docx")
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SOURCE_DIRS = [
    ROOT / "源文件" / "职业",
    ROOT / "源文件" / "规则",
    ROOT / "源文件" / "角色档案",
    ROOT / "源文件" / "素材",
    ROOT / "源文件",
]


UPDATE_RE = re.compile(r'^(?:(\d{4})\.)?(\d{1,2})\.(\d{1,2})(?:更新内容|内容更新)[/\\](.+)$')


def source_path(name):
    """返回真值文件路径：优先 源文件/ 分类目录，回退仓库根目录。"""
    m = UPDATE_RE.match(str(name))
    if m:
        y, mo, d, rest = m.groups()
        if not y:
            y = '2026'
        key = '%s%s%s' % (y, str(int(mo)).zfill(2), str(int(d)).zfill(2))
        p = ROOT / '源文件' / '更新内容' / key / rest
        if p.exists():
            return p
    for d in SOURCE_DIRS:
        p = d / name
        if p.exists():
            return p
    return ROOT / name


def source_root():
    return ROOT / "源文件"
