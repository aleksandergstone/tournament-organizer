import re, collections
for lang in ['en', 'pl', 'de', 'es']:
    path = f'C:/Users/Aleksander G/Desktop/tournament-organizer/src/i18n/{lang}.ts'
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    keys = re.findall(r"'([^']+)'\s*:", c)
    dups = [k for k, v in collections.Counter(keys).items() if v > 1]
    print(f'{lang}: {len(dups)} duplicates')
    for d in sorted(dups):
        print(f'  {d}')
print('Done')
