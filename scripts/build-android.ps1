# Builds the Android APK from the same sources as the desktop app.
#
#   powershell -ExecutionPolicy Bypass -File scripts/build-android.ps1            # release APK
#   powershell -ExecutionPolicy Bypass -File scripts/build-android.ps1 -Debug     # debug APK
#
# Expects the toolchain installed by scripts/setup-android-toolchain.ps1
# (JDK 21 + Android SDK under tools/), and a keystore described in
# android/keystore.properties for a signed release build.
param([switch]$Debug)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$tools = Join-Path $root 'tools'
$env:JAVA_HOME = Join-Path $tools 'jdk21'
$env:ANDROID_HOME = Join-Path $tools 'android-sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

# 0. Release the Gradle daemon.
#
# The daemon keeps file handles on the Android assets it packaged last time, and
# `cap sync` then fails with a sharing violation ("used by another process") while
# still exiting through the build. Gradle sees unchanged inputs, repackages the
# previous bundle under today's file name, and prints BUILD SUCCESSFUL — a stale
# release that looks perfect. Stopping the daemon first costs a few seconds and
# makes the sync possible at all; the check after it turns any remaining failure
# into a stopped build rather than a wrong artifact.
Write-Host 'stopping the Gradle daemon…'
& (Join-Path $root 'android\gradlew.bat') -p (Join-Path $root 'android') --stop | Out-Host
# `--stop` asks politely, and a daemon that was killed mid-task can decline. A
# surviving JVM keeps its handles on the very files `cap sync` is about to copy, so
# the copy fails with a sharing violation and the build goes on to package the
# previous bundle. Only JVMs from this project's own JDK are touched.
Get-Process java -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -and $_.Path.StartsWith((Join-Path $tools 'jdk21')) } |
  ForEach-Object { Write-Host "  stopping a lingering Gradle JVM (pid $($_.Id))"; Stop-Process -Id $_.Id -Force }
Start-Sleep -Milliseconds 800

# 1. The web bundle both platforms share.
Push-Location $root
Write-Host 'building the shared web app…'
& npm.cmd run build | Out-Host
# A native command that fails does not raise, and $ErrorActionPreference does not
# see it either: the script would carry on to sync and package whatever was left
# in dist/ — yesterday's bundle — and still print "BUILD SUCCESSFUL" at the end.
# That is the silent half-failure this project has been bitten by.
if ($LASTEXITCODE -ne 0) { throw "npm run build failed (exit $LASTEXITCODE); nothing was packaged" }
Write-Host 'syncing into the Android project…'
& node node_modules\@capacitor\cli\bin\capacitor sync android | Out-Host
if ($LASTEXITCODE -ne 0) { throw "capacitor sync failed (exit $LASTEXITCODE); the APK would hold a stale bundle" }
Pop-Location

# 2. The APK.
$task = if ($Debug) { 'assembleDebug' } else { 'assembleRelease' }
Write-Host "gradle $task…"
& (Join-Path $root 'android\gradlew.bat') -p (Join-Path $root 'android') $task
if ($LASTEXITCODE -ne 0) { throw "gradle $task failed" }

# 3. One artifact, next to the desktop installers, named like them.
# This used to silently re-serialise the version the way electron-builder does,
# which hid the very drift this release fixes: "1.4.01" was written as 1.4.1 and
# nobody saw the mismatch. package.json is now required to hold canonical semver,
# so a version that would be rewritten is a bug to fix at the source, not to
# paper over here. Fail loudly instead.
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
if ($version -notmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)((?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$') {
  throw "package.json version '$version' is not canonical semver; fix it instead of letting the artifact name be rewritten"
}
$variant = if ($Debug) { 'debug' } else { 'release' }
$built = Join-Path $root "android\app\build\outputs\apk\$variant\app-$variant.apk"
$target = Join-Path $root "release\Tournament-Organizer-$version-android-$variant.apk"

# 4. The APK must carry the bundle that was just built.
#
# Gradle answers "up to date" from its own inputs, and the web bundle reaches it
# only through `cap sync`. If that copy silently does not happen, the build is a
# success and the artifact is yesterday's app under today's file name — which is
# worse than a failed build, because nothing looks wrong. So the bundle inside
# the APK is compared with the bundle on disk, and a mismatch stops the release.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$expected = (Get-ChildItem (Join-Path $root 'dist\assets') -Filter 'index-*.js' | Select-Object -First 1).Name
$zip = [IO.Compression.ZipFile]::OpenRead($built)
try {
  $inside = ($zip.Entries | Where-Object { $_.FullName -match 'assets/public/assets/index-[^/]+\.js$' } |
    Select-Object -First 1).FullName
} finally {
  $zip.Dispose()
}
$actual = if ($inside) { Split-Path $inside -Leaf } else { '(none)' }
if (-not $expected -or $actual -ne $expected) {
  # ASCII only inside this string: PowerShell 5.1 reads a BOM-less .ps1 as ANSI,
  # and a UTF-8 em dash lands on 0x94, which is a curly quote there and ends the
  # string early. A build script that cannot be parsed is a failed release.
  throw "the APK holds $actual but dist/ has $expected - a stale app was produced; fix the sync before releasing"
}
Write-Host "APK carries $actual"

New-Item -ItemType Directory -Force -Path (Join-Path $root 'release') | Out-Null
Copy-Item $built $target -Force
$size = [math]::Round((Get-Item $target).Length / 1MB, 1)
Write-Host "APK: $target ($size MB)"
