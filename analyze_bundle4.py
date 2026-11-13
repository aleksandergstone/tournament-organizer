import json
import re

with open('dist/bundle-analysis.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

match = re.search(r'const data = ({.*?});', content, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    
    def collect_modules(node, path=''):
        name = node.get('name', '')
        size = node.get('size', 0)
        gzip = node.get('gzipSize', 0)
        if size > 0 or gzip > 0:
            full_path = f'{path}/{name}' if path else name
            results.append((size, gzip, full_path))
        for child in node.get('children', []):
            collect_modules(child, f'{path}/{name}' if path else name)
    
    results = []
    tree = data.get('tree', {})
    collect_modules(tree)
    
    # Also check the root children
    for child in tree.get('children', []):
        size = child.get('size', 0)
        gzip = child.get('gzipSize', 0)
        name = child.get('name', '')
        if size > 0 or gzip > 0:
            print(f'{size/1024:.1f}KB ({gzip/1024:.1f}KB gzip) - {name}')
    
    print(f'\nTotal modules with size: {len(results)}')
    for size, gzip, name in results[:50]:
        print(f'{size/1024:.1f}KB ({gzip/1024:.1f}KB gzip) - {name}')
else:
    print('Data section not found')