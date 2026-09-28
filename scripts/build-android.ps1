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

# 1. The web bundle both platforms share.
Push-Location $root
Write-Host 'building the shared web app…'
& npm.cmd run build | Out-Host
Write-Host 'syncing into the Android project…'
& node node_modules\@capacitor\cli\bin\capacitor sync android | Out-Host
Pop-Location

# 2. The APK.
$task = if ($Debug) { 'assembleDebug' } else { 'assembleRelease' }
Write-Host "gradle $task…"
& (Join-Path $root 'android\gradlew.bat') -p (Join-Path $root 'android') $task
if ($LASTEXITCODE -ne 0) { throw "gradle $task failed" }

# 3. One artifact, next to the desktop installers, named like them.
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$variant = if ($Debug) { 'debug' } else { 'release' }
$built = Join-Path $root "android\app\build\outputs\apk\$variant\app-$variant.apk"
$target = Join-Path $root "release\Tournament-Organizer-$version-android-$variant.apk"
New-Item -ItemType Directory -Force -Path (Join-Path $root 'release') | Out-Null
Copy-Item $built $target -Force
$size = [math]::Round((Get-Item $target).Length / 1MB, 1)
Write-Host "APK: $target ($size MB)"
