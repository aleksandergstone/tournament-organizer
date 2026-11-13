import json
import re

with open('dist/bundle-analysis.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

match = re.search(r'const data = ({.*?});', content, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    print('Keys:', list(data.keys()))
    tree = data.get('tree', {})
    print('Tree keys:', list(tree.keys()))
    root = tree
    print('Root children count:', len(root.get('children', [])))
    if root.get('children'):
        first = root.get('children')[0]
        print('First child keys:', list(first.keys()))
        print('First child name:', first.get('name'))
        print('First child size:', first.get('size'))
        print('First child gzipSize:', first.get('gzipSize'))
else:
    print('Data section not found')