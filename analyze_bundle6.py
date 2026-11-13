import json
import re

with open('dist/bundle-analysis.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

match = re.search(r'const data = ({.*?});', content, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    
    print('nodeMetas keys:', list(data.get('nodeMetas', {}).keys())[:10])
    for k, v in list(data.get('nodeMetas', {}).items())[:5]:
        print(f'  {k}: {v}')
    
    print()
    print('nodeParts keys:', list(data.get('nodeParts', {}).keys())[:10])
    for k, v in list(data.get('nodeParts', {}).items())[:5]:
        print(f'  {k}: {v}')
    
    print()
    print('env:', data.get('env', {}))
    
else:
    print('Data section not found')