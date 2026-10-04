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
REM because another process still holds it — the build must stop here: a package with
REM no record of it is how a stale artifact reaches a release looking perfectly fine.
REM A run-stamped fallback keeps one build from blocking the next.
REM
REM Both checks are made by looking for THIS run's token in the file. Two things make
REM anything else unsafe: a `>` redirect onto a locked file does not run its command
REM and does not set ERRORLEVEL, and a log left over from an earlier build still says
REM START and DONE. A per-run token is the only marker neither can fake.
set BUILD_LOG=apk.log
goto :stamp

:stamp
set BUILD_TOKEN=TO-%RANDOM%%RANDOM%
echo %BUILD_TOKEN% START %DATE% %TIME% > %BUILD_LOG%
findstr /C:"%BUILD_TOKEN%" %BUILD_LOG% > nul 2>&1
if not errorlevel 1 goto :logged
set BUILD_LOG=apk-%RANDOM%-%RANDOM%.log
echo %BUILD_TOKEN% START %DATE% %TIME% > %BUILD_LOG%
findstr /C:"%BUILD_TOKEN%" %BUILD_LOG% > nul 2>&1
if errorlevel 1 goto :nolog
:logged
call npm.cmd run build || goto :failed
powershell -ExecutionPolicy Bypass -File scripts\build-android.ps1 >> %BUILD_LOG% 2>&1
set RC=%ERRORLEVEL%
REM A redirect that cannot write sets ERRORLEVEL, and the Gradle daemon started by the
REM build holds the log for a moment after this script's child returns — so the ERRORLEVEL
REM is cleared here and the build script's own verdict is the only thing that decides it.
echo %BUILD_TOKEN% EXIT=%RC% >> %BUILD_LOG%
ver > nul
REM `build-android.ps1` is the authority: it throws unless the APK exists, carries the
REM bundle this run produced, and has been copied into release\ under this version.
REM Re-deriving any of that here would be a second copy of the rule, in a language that
REM cannot parse a path with a space in it reliably.
if not "%RC%"=="0" goto :failed
echo %BUILD_TOKEN% DONE %DATE% %TIME% >> %BUILD_LOG%
exit /b 0
:nolog
echo FAILED — no build log could be written, so nothing was built
exit /b 1
:failed
echo %BUILD_TOKEN% FAILED — no APK produced >> %BUILD_LOG%
exit /b 1