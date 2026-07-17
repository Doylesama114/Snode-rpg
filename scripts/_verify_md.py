# coding: utf-8
import re, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Read MD
with open(r'D:\Download\scholar-agent-main\通用天赋树.md', 'r', encoding='utf-8') as f:
    md_text = f.read()

# Read HTML
with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'r', encoding='utf-8') as f:
    html_text = f.read()

# Extract talent names from MD (lines starting with "#### ")
md_talents = set()
for m in re.finditer(r'^#### (.+)$', md_text, re.MULTILINE):
    name = m.group(1).strip()
    if '抉择' not in name and '---' not in name:
        md_talents.add(name)
print('MD talents: %d' % len(md_talents))

# Extract talent names from HTML (<h4> tags, excluding choice headers)
html_talents = set()
for m in re.finditer(r'<h4>([^<]+)', html_text):
    name = m.group(1).strip()
    # Remove style chip text
    name = re.sub(r'\s*<span.*', '', name)
    if '抉择' not in name and '你仅能够' not in name:
        html_talents.add(name)
print('HTML talents: %d' % len(html_talents))

# Find differences
only_md = md_talents - html_talents
only_html = html_talents - md_talents
common = md_talents & html_talents
print('Common: %d' % len(common))

if only_md:
    print('\n=== In MD but NOT in HTML (%d) ===' % len(only_md))
    for t in sorted(only_md):
        print('  MISSING: %s' % t)

if only_html:
    print('\n=== In HTML but NOT in MD (%d) ===' % len(only_html))
    for t in sorted(only_html):
        print('  EXTRA: %s' % t)

# Now verify field values for common talents
# Extract key fields from MD for each talent
import json

# Build MD talent data
md_data = {}
current_talent = None
for line in md_text.split('\n'):
    m = re.match(r'^#### (.+)$', line)
    if m:
        current_talent = m.group(1).strip()
        if '抉择' not in current_talent:
            md_data[current_talent] = {}
        continue
    if current_talent and current_talent in md_data:
        m2 = re.match(r'- \*\*(.+?)[：:]\*\*(.*)$', line)
        if m2:
            md_data[current_talent][m2.group(1)] = m2.group(2).strip()

# Check critical fields for each common talent
errors = []
for name in sorted(common):
    if name not in md_data:
        continue
    fields = md_data[name]
    # Find the HTML article for this talent
    # Search for the talent name in data-search
    escaped = re.escape(name)
    pattern = r'data-search="[^"]*%s[^"]*"' % escaped
    match = re.search(pattern, html_text)
    if not match:
        errors.append('%s: not found in HTML data-search' % name)
        continue
    
    ds = match.group(0)
    # Check a few key fields
    for field_name in ['前置条件', '额外条件', '疲劳消耗', '施展条件', '施展限制', '关键词', '施展时间', '持续时间']:
        if field_name not in fields:
            continue
        md_val = fields[field_name]
        # Search for this field in data-search
        search_pattern = '%s：\\s*%s' % (field_name, re.escape(md_val[:40]))
        if not re.search(search_pattern, ds):
            # Try to find it in the detail div
            detail_pattern = r'<article[^>]*%s[^>]*>.*?</article>' % escaped[:10]
            detail_match = re.search(detail_pattern, html_text, re.DOTALL)
            if detail_match:
                block = detail_match.group(0)
                field_html = '%s：%s' % (field_name, md_val[:40])
                if field_html not in block and md_val[:40] not in block:
                    errors.append('%s: field "%s" mismatch. MD="%s..."' % (name, field_name, md_val[:60]))

if errors:
    print('\n=== FIELD MISMATCHES (%d) ===' % len(errors))
    for e in errors[:50]:
        print('  %s' % e)
else:
    print('\n=== ALL FIELD CHECKS PASSED ===')

# Summary
print('\n--- Summary ---')
print('MD: %d talents, HTML: %d talents, Common: %d' % (len(md_talents), len(html_talents), len(common)))
print('Missing from HTML: %d, Extra in HTML: %d' % (len(only_md), len(only_html)))
print('Field errors: %d' % len(errors))
