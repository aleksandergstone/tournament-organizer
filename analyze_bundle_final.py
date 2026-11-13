import json
import re

with open('dist/bundle-analysis.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

match = re.search(r'const data = ({.*?});', content, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    
    node_metas = data.get('nodeMetas', {})
    node_parts = data.get('nodeParts', {})
    
    # Build module info
    modules = []
    for meta_uid, meta in node_metas.items():
        module_id = meta.get('id', '')
        module_parts = meta.get('moduleParts', {})
        
        # Get size from nodeParts
        total_rendered = 0
        total_gzip = 0
        for chunk_name, part_uid in module_parts.items():
            part = node_parts.get(part_uid, {})
            total_rendered += part.get('renderedLength', 0)
            total_gzip += part.get('gzipLength', 0)
        
        if total_rendered > 0:
            modules.append((total_rendered, total_gzip, module_id, chunk_name))
    
    # Sort by size
    modules.sort(key=lambda x: x[0], reverse=True)
    
    print(f'Total modules: {len(modules)}')
    print()
    
    # Group by package
    packages = {}
    for size, gzip, module_id, chunk_name in modules:
        # Extract package name
        if 'node_modules' in module_id:
            parts = module_id.split('node_modules/')
            if len(parts) > 1:
                pkg = parts[1].split('/')[0]
                if pkg.startswith('@'):
                    pkg = pkg + '/' + parts[1].split('/')[1]
        else:
            pkg = 'app'
        
        if pkg not in packages:
            packages[pkg] = {'size': 0, 'gzip': 0, 'count': 0}
        packages[pkg]['size'] += size
        packages[pkg]['gzip'] += gzip
        packages[pkg]['count'] += 1
    
    print('=== By Package ===')
    for pkg, info in sorted(packages.items(), key=lambda x: x[1]['size'], reverse=True):
        print(f'{info["size"]/1024:.1f}KB ({info["gzip"]/1024:.1f}KB gzip) - {pkg} ({info["count"]} modules)')
    
    print()
    print('=== Top Individual Modules ===')
    for size, gzip, module_id, chunk_name in modules[:30]:
        print(f'{size/1024:.1f}KB ({gzip/1024:.1f}KB gzip) - {module_id}')
else:
    print('Data section not found')