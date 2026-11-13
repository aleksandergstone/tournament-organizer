import re
with open('dist/bundle-analysis.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

for pattern in ['var data =', 'const data =', 'window.data =', 'modules:', '"modules"']:
    idx = content.find(pattern)
    if idx >= 0:
        print(f'Found {pattern} at {idx}')
        print(content[idx:idx+200])
        print('---')