# Installs the Android build toolchain into tools/ next to the repo.
# Run: powershell -ExecutionPolicy Bypass -File scripts/setup-android-toolchain.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$tools = Join-Path $root 'tools'
New-Item -ItemType Directory -Force -Path $tools | Out-Null

function Get-File($url, $out) {
  if (Test-Path $out) { Write-Host "have $(Split-Path -Leaf $out)"; return }
  Write-Host "downloading $url"
  Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
}

# JDK 21 (Temurin) — portable, no admin rights needed. Capacitor 8 compiles its
# Android library with source/target 21, so 17 is not enough.
$jdk = Join-Path $tools 'jdk21'
if (-not (Test-Path (Join-Path $jdk 'bin\java.exe'))) {
  Get-File 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse' (Join-Path $tools 'jdk21.zip')
  Write-Host 'unpacking JDK'
  Expand-Archive -Path (Join-Path $tools 'jdk21.zip') -DestinationPath $tools -Force
  $dir = Get-ChildItem $tools -Directory -Filter 'jdk-21*' | Select-Object -First 1
  Move-Item $dir.FullName $jdk -Force
  Remove-Item (Join-Path $tools 'jdk21.zip') -Force
}

# Android command-line tools.
$sdk = Join-Path $tools 'android-sdk'
if (-not (Test-Path (Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'))) {
  Get-File 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip' (Join-Path $tools 'cmdline-tools.zip')
  Write-Host 'unpacking command-line tools'
  $tmp = Join-Path $tools 'cmdline-tmp'
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  Expand-Archive -Path (Join-Path $tools 'cmdline-tools.zip') -DestinationPath $tmp -Force
  New-Item -ItemType Directory -Force -Path (Join-Path $sdk 'cmdline-tools') | Out-Null
  Move-Item (Join-Path $tmp 'cmdline-tools') (Join-Path $sdk 'cmdline-tools\latest') -Force
  Remove-Item $tmp -Recurse -Force
  Remove-Item (Join-Path $tools 'cmdline-tools.zip') -Force
}

$env:JAVA_HOME = $jdk
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:Path = "$jdk\bin;$sdk\cmdline-tools\latest\bin;$sdk\platform-tools;$env:Path"

Write-Host 'accepting licences'
1..20 | ForEach-Object { 'y' } | & (Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat') --sdk_root=$sdk --licenses | Out-Null
Write-Host 'installing platform + build tools'
& (Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat') --sdk_root=$sdk 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0'
Write-Host 'toolchain ready'
& (Join-Path $jdk 'bin\java.exe') -version
