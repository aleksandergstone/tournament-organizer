@echo off
REM Builds the Windows installer.
REM
REM Run through a scheduled task, not from a terminal: a build killed with the shell
REM that launched it loses half an hour of packing and leaves a truncated
REM win-unpacked behind that looks like progress.
REM
REM The task points at C:\to, a junction to this folder. A task passes its command
REM unquoted, so a path containing a space never launches — this one does. The cd
REM is still needed: a task has no working directory, and without it the build would
REM start in System32 and fail instantly with a log nobody finds.
cd /d C:\to
echo START %DATE% %TIME% > eb.log
call npx.cmd electron-builder --win --publish never >> eb.log 2>&1
echo EXIT=%ERRORLEVEL% >> eb.log
echo DONE %DATE% %TIME% >> eb.log