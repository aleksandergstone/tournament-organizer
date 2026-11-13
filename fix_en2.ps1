$enPath = 'C:\Users\Aleksander G\Desktop\tournament-organizer\src\i18n\en.ts'
$keysPath = 'C:\Users\Aleksander G\Desktop\tournament-organizer\sailing_keys.txt'

$enLines = Get-Content $enPath
$keys = Get-Content $keysPath

# Find index of 'sailing.not.team' line
$idx = -1
for ($i = 0; $i -lt $enLines.Count; $i++) {
    if ($enLines[$i] -match "sailing\.not\.team.*No fleet racing, no match racing") { $idx = $i; break }
}
if ($idx -eq -1) { Write-Error 'Could not find sailing.not.team'; exit 1 }

# Build new lines
$newLines = New-Object System.Collections.Generic.List[string]
for ($i = 0; $i -lt $enLines.Count; $i++) {
    $newLines.Add($enLines[$i])
    if ($i -eq $idx) {
        foreach ($k in $keys) { $newLines.Add($k) }
    }
}

# Clean up the comment line that traps keys
for ($i = 0; $i -lt $newLines.Count; $i++) {
    if ($newLines[$i] -match 'sailing format meanings') {
        $newLines[$i] = '  // ---- sailing format meanings ----'
        break
    }
}

Set-Content -Path $enPath -Value $newLines
Write-Output ('Done. Total lines: ' + $newLines.Count)
