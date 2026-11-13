import re
import json

with open('dist/bundle-analysis.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

match = re.search(r'var data = (\[.*?\]);', content, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    data = sorted(data, key=lambda x: x.get('size', 0), reverse=True)
    for item in data[:40]:
        name = item.get('name', 'unknown')
        size = item.get('size', 0)
        gzip = item.get('gzipSize', 0)
        print(f'{size/1024:.1f}KB ({gzip/1024:.1f}KB gzip) - {name}')
else:
    print('Data section not found')