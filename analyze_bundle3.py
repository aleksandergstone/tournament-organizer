import json
import re

with open('dist/bundle-analysis.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

match = re.search(r'const data = ({.*?});', content, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    print(json.dumps(data, indent=2)[:5000])
else:
    print('Data section not found')