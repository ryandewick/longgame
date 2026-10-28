@echo off
rem Long Game: starts a local copy on this computer and opens it in the browser. Double-click this file.
rem
rem The work is done by tools\local-copy\launch.ts, which Node runs directly. This file only makes sure there is a
rem Node that can run it, and keeps the window open when something goes wrong so that the message can be read.

rem Keep the variables set here out of the window this was started from.
setlocal

rem Work from this file's own folder, wherever it was started from. /d also changes drive.
cd /d "%~dp0"
title Long Game

rem "where" fails when there is no node on the PATH.
where node >nul 2>nul
if errorlevel 1 (
  echo Long Game needs Node.js, and this computer does not have it.
  echo Install the LTS version from https://nodejs.org/ and run this again.
  goto failed
)

rem The launcher is written in TypeScript, which Node runs as it is from version 22.18 on, and the project is built
rem and tested on Node 24.11 and newer, so that is the oldest it accepts. An older Node would
rem stop on the first line with a syntax error, so the version is checked here, where it can be said in words.
node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 24 || (major === 24 && minor >= 11) ? 0 : 1)"
if errorlevel 1 (
  rem "for /f" is how a batch file reads a command's output: here, the version this computer has.
  for /f "delims=" %%v in ('node -v') do echo Long Game needs Node.js 24.11 or newer. This computer has %%v.
  echo Install the LTS version from https://nodejs.org/ and run this again.
  goto failed
)

rem "Long Game.bat prepare" only installs and builds when that is needed, and starts nothing. The desktop shortcut
rem (tools\local-copy\open-app.ps1) runs it so that the work, and any problem, shows in this window; it then opens
rem Long Game in a window of its own.
if /i "%~1"=="prepare" (
  node tools\local-copy\launch.ts --prepare
  if errorlevel 1 goto failed
  endlocal
  exit /b 0
)

rem Installs and builds when that is needed (the first run, or after the code changes), starts the server on
rem http://localhost:8765/ and opens the browser. Saves are kept in the .data folder beside this file.
rem To use another port, set LONGGAME_PORT before running this.
node tools\local-copy\launch.ts
if errorlevel 1 goto failed

endlocal
exit /b 0

:failed
echo.
echo Long Game did not start. Press any key to close this window.
rem Without the pause a double-clicked window would close before the message could be read.
pause >nul
endlocal
exit /b 1
