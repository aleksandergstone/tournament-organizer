@echo off
REM Launches the APK build with the real, spaced project path.
REM
REM A scheduled task passes /tr unquoted, so no amount of escaping puts a space in
REM there — a task command can only be short and space-free. The project path is
REM handed over through an environment variable instead: %CD% expands at runtime,
REM inside the batch file, where quoting is not a problem.
REM
REM C:\to must NOT be used for the same reason the build script rejects it: Vite's
REM root would be the junction while index.html resolves outside it.
set "TOAPP=C:\Users\Aleksander G\Desktop\tournament-organizer"
call "%TOAPP%\build-apk.cmd"
exit /b %ERRORLEVEL%