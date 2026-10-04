@echo off
REM Builds the signed release APK.
REM
REM The working directory must be the real project path, complete with its space.
REM Both shorter paths break it, in different and equally silent ways:
REM   C:\to (a junction)   — Vite's root becomes C:\to while index.html resolves to the
REM                         real path outside it, so Rollup refuses the bundle.
REM   ...\ALEKSA~1\ (8.3) — the root is the short form and the resolved entry point is
REM                         the long form, so the same comparison fails.
REM When that fails, vite build exits non-zero, `capacitor sync` reports a missing
REM index.html, and gradle still succeeds — packaging a stale app under a new
REM version. The build check below is what turns that into a loud failure.
REM
REM Launched through a scheduled task because a build killed with the terminal that
REM started it leaves a half-written APK. The task quotes the path itself.
cd /d "%~dp0"
echo START %DATE% %TIME% > apk.log
call npm.cmd run build || goto :failed
powershell -ExecutionPolicy Bypass -File scripts\build-android.ps1 >> apk.log 2>&1
set RC=%ERRORLEVEL%
echo EXIT=%RC% >> apk.log
if not "%RC%"=="0" goto :failed
echo DONE %DATE% %TIME% >> apk.log
exit /b 0
:failed
echo FAILED — no APK produced >> apk.log
exit /b 1