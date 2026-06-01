```python
# Extraction script for 魔契师 data from panel files
import json
import re
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
BASE = r'D:\Download\scholar-agent-main'

# 1. Parse REF_CLASSES from panel_data.js line 1
with open(os.path.join(BASE, '斯诺德跑团', 'panel_data.js'), 'r', encoding='utf-8') as f:
    txt = f.read()
lines = txt.splitlines()

# Find JSON.parse('...') in line 1
idx = lines[0].find("JSON.parse('")
end = lines[0].rfind("')")
if idx >= 0 and end > idx:
    js_str = lines[0][idx+12:end]
    # The JSON string uses \\' for escaping single quotes inside
    js_str = js_str.replace("\\'", "'")
    data = json.loads(js_str)
    print('=== REF_CLASSES 魔契师 ===')
    mqs = data.get('魔契师', {})
    print(json.dumps(mqs, ensure_ascii=False, indent=2))
else:
    print('FAILED to match JSON.parse in line 1')
    print('Line 1 last 200 chars:', repr(lines[0][-200:]))

# 2. Parse REF_SUBCLASS_REQS from panel_data.js line 4
m2 = re.match(r'var REF_SUBCLASS_REQS = (.+?);', lines[3])
if m2:
    sub_reqs = json.loads(m2.group(1))
    print('\n=== REF_SUBCLASS_REQS 魔契师 ===')
    mqs_sub = sub_reqs.get('魔契师', {})
    print(json.dumps(mqs_sub, ensure_ascii=False, indent=2))

# 3. Check REF_SUBCLASS_REQS attrs for other classes
print('\n=== REF_SUBCLASS_REQS attrs for other classes ===')
for cls in ['蛮斗士','战士','法师','牧师','圣骑士','吟游诗人','猎人','德鲁伊']:
    entry = sub_reqs.get(cls, {})
    print(f'{cls}: attrs={entry.get("attrs", "N/A")}, attrAlt={entry.get("attrAlt", "N/A")}')

# 4. Check _REF_CLASSES in 上传角色.html
with open(os.path.join(BASE, '斯诺德跑团', '上传角色.html'), 'r', encoding='utf-8') as f:
    html = f.read()
html_lines = html.splitlines()
for i, line in enumerate(html_lines):
    if '_REF_CLASSES' in line:
        # Find 魔契师 portion (brace-enclosed, might have nested braces)
        idx_start = line.find('"魔契师":{')
        if idx_start >= 0:
            # Find matching closing brace
            depth = 0
            idx_end = idx_start
            for j in range(idx_start, len(line)):
                if line[j] == '{':
                    depth += 1
                elif line[j] == '}':
                    depth -= 1
                    if depth == 0:
                        idx_end = j + 1
                        break
            print(f'\n=== _REF_CLASSES 魔契师 (line {i+1}) ===')
            print(line[idx_start:idx_end])
        break
```
