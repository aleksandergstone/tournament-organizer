$base = 'C:\Users\Aleksander G\Desktop\tournament-organizer\src\i18n'

$files = @(
  @{ path = "$base\en.ts"; keysFile = $null; cleanupOnly = $true },
  @{ path = "$base\pl.ts"; keysFile = 'C:\Users\Aleksander G\Desktop\tournament-organizer\sailing_keys_pl.txt'; cleanupOnly = $false },
  @{ path = "$base\de.ts"; keysFile = 'C:\Users\Aleksander G\Desktop\tournament-organizer\sailing_keys_de.txt'; cleanupOnly = $false },
  @{ path = "$base\es.ts"; keysFile = 'C:\Users\Aleksander G\Desktop\tournament-organizer\sailing_keys_es.txt'; cleanupOnly = $false },
)

foreach ($f in $files) {
  Write-Output ("Processing {0}" -f $f.path)
  $lines = Get-Content $f.path

  # Find sailing.not.team line
  $idx = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "'sailing\.not\.team':") { $idx = $i; break }
  }
  if ($idx -eq -1) { Write-Error ("Could not find sailing.not.team in {0}" -f $f.path); exit 1 }

  # Insert keys if not cleanup-only
  if (-not $f.cleanupOnly) {
    $keys = Get-Content $f.keysFile
    $newLines = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $lines.Count; $i++) {
      $newLines.Add($lines[$i])
      if ($i -eq $idx) {
        foreach ($k in $keys) { $newLines.Add($k) }
      }
    }
    $lines = $newLines.ToArray()
  }

  # Clean up the comment line that traps keys (must contain embedded sailing.meaning key)
  $commentFound = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '// ---- sailing format meanings' -and $lines[$i] -match 'sailing\.meaning') {
      $lines[$i] = '  // ---- sailing format meanings ----'
      $commentFound = $true
      break
    }
  }
  if (-not $commentFound) {
    Write-Output ('  Warning: comment line with embedded keys not found in {0}' -f $f.path)
  }

  Set-Content -Path $f.path -Value $lines
  Write-Output ('  Done. Total lines: {0}' -f $lines.Count)
}

Write-Output 'All files processed'
