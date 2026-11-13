import re, collections

base = 'C:/Users/Aleksander G/Desktop/tournament-organizer/src/i18n'
langs = ['en', 'pl', 'de', 'es']

# Keys to remove (duplicates)
remove_keys = [
    "'format.round-robin':",
    "'format.example.round-robin':",
    "'format.for.round-robin':",
    "'format.not.round-robin':",
    "'format.meaning.round-robin':",
]

# Sailing keys to add (key, english value)
sailing_keys = [
    ("sailing.meaning.round-robin", "Every boat races every other boat once"),
    ("sailing.example.round-robin", "8 boats -> everyone races everyone once"),
    ("sailing.for.round-robin", "Small fleets where every boat should meet every other"),
    ("sailing.not.round-robin", "No knockout, no medal race, no flights"),
    ("sailing.meaning.knockout", "Single-elimination bracket of match races"),
    ("sailing.example.knockout", "8 boats -> quarterfinals, semifinals, final"),
    ("sailing.for.knockout", "One-loss elimination series for a regatta"),
    ("sailing.not.knockout", "No fleet racing, no team racing, no round robin"),
    ("sailing.meaning.group-stage-finals", "Group stage followed by a finals bracket"),
    ("sailing.example.group-stage-finals", "4 groups -> semifinals -> final"),
    ("sailing.for.group-stage-finals", "Large fleets split into groups, then knockout"),
    ("sailing.not.group-stage-finals", "No single fleet, no direct medal race"),
    ("sailing.meaning.flighted-racing", "Fleet split into flights racing separate series"),
    ("sailing.example.flighted-racing", "20 boats -> Gold/Silver flights -> separate series"),
    ("sailing.for.flighted-racing", "Large fleets split into parallel start groups"),
    ("sailing.not.flighted-racing", "No single fleet start, no medal race"),
    ("sailing.meaning.medal-race", "Qualifying series topped by a medal race"),
    ("sailing.example.medal-race", "Top 10 after qualifying -> one double-points decider"),
    ("sailing.for.medal-race", "Olympic-style series with a final medal race"),
    ("sailing.not.medal-race", "No group stage, no flights, no team racing"),
    ("sailing.meaning.custom-regatta", "Fully custom regatta with your own stages"),
    ("sailing.example.custom-regatta", "Your own stages, scoring and discard rules"),
    ("sailing.for.custom-regatta", "Non-standard regatta formats you define yourself"),
    ("sailing.not.custom-regatta", "No preset structure; you build every stage"),
]

for lang in langs:
    path = f'{base}/{lang}.ts'
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Remove duplicate lines (keep first occurrence)
    seen = set()
    new_lines = []
    for line in lines:
        key_match = re.match(r"\s*('([^']+)')\s*:", line)
        if key_match:
            key = key_match.group(2)
            if key in [r.strip("':") for r in remove_keys]:
                if key in seen:
                    continue  # skip duplicate
                seen.add(key)
        new_lines.append(line)
    
    # Find insert point after preset.unseededKnockout.why
    insert_idx = None
    for i in range(len(new_lines) - 1, -1, -1):
        if 'preset.unseededKnockout.why' in new_lines[i]:
            insert_idx = i + 1
            break
    
    if insert_idx is None:
        print(f'{lang}: Could not find insert point')
        continue
    
    # Add sailing keys
    sailing_lines = ['  // ---- sailing format meanings --------------------------------------------']
    for key, value in sailing_keys:
        sailing_lines.append(f"  '{key}': '{value}',")
    
    final = new_lines[:insert_idx] + sailing_lines + new_lines[insert_idx:]
    
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(final)
    
    print(f'{lang}: Fixed')

print('Done!')
