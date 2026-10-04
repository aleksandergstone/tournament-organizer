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
REM The log is the only evidence this build did anything. If it cannot be written —
REM because another process still holds apk.log open — the build must stop here: a
REM package with no record of it is how a stale artifact reaches a release looking
REM perfectly fine. A run-stamped fallback keeps one build from blocking the next.
REM Labels rather than nested blocks, because a variable used inside a block is
REM expanded when the block is parsed, not when the line runs.
set BUILD_LOG=apk.log
echo START %DATE% %TIME% > %BUILD_LOG%
if not errorlevel 1 goto :logged
set BUILD_LOG=apk-%RANDOM%-%RANDOM%.log
echo START %DATE% %TIME% > %BUILD_LOG%
if errorlevel 1 goto :nolog
:logged
call npm.cmd run build || goto :failed
powershell -ExecutionPolicy Bypass -File scripts\build-android.ps1 >> %BUILD_LOG% 2>&1
set RC=%ERRORLEVEL%
echo EXIT=%RC% >> %BUILD_LOG%
if not "%RC%"=="0" goto :failed
echo DONE %DATE% %TIME% >> %BUILD_LOG%
exit /b 0
:nolog
echo FAILED — no build log could be written, so nothing was built
exit /b 1
:failed
echo FAILED — no APK produced >> %BUILD_LOG%
exit /b 1