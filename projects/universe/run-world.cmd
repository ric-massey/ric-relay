@echo off
rem run-world.cmd -- the world that is left running.
rem
rem Ric, 2026-11-09: "i wanted to start a world and let it run and check in on it
rem every once in a while with the chance of something crazy happening".
rem
rem Double-click it, or let it start with Windows (autostart.ps1 install). It is
rem the SAME world every time: it lives in runs\eternal\, is saved there every
rem five minutes and when this window is closed with Ctrl-C, and the next start
rem carries on from the same tick. To begin a different world, move or delete
rem that folder first -- nothing here ever deletes it.
rem
rem   watch it on this machine   http://localhost:8787/
rem   on the wifi                the address this window prints
rem   from anywhere              the website's viewer, Live World tab -- only if
rem                              the site password has been stored once with
rem                                  python ..\cs\creds.py set ric-terminal/universe
rem                              (type it, Enter, Ctrl-Z, Enter). It is read from
rem                              Windows Credential Manager below and is never
rem                              written to a file or printed.
rem
rem It runs at the lowest CPU priority and stands still while a game is open.
rem STREAMING.md has the rest.

title Universe world
cd /d "%~dp0"

set "UNIVERSE_TOKEN="
for /f "usebackq delims=" %%t in (`python ..\cs\creds.py get ric-terminal/universe 2^>nul`) do set "UNIVERSE_TOKEN=%%t"
set "PUSH="
if defined UNIVERSE_TOKEN set "PUSH=--push https://training-log.rmbuster82.workers.dev/universe --push-every 30"
if not defined UNIVERSE_TOKEN echo   (no site password stored, so this world is on the wifi only -- see the top of this file)

node world-stream.mjs --keep runs/eternal --size 258 --temp0 4 --p0 3 --lit --hold ^
  --yield-to cs2.exe,VALORANT-Win64-Shipping.exe --low --port 8787 %PUSH%

echo.
echo   The world has stopped. Close this window, or press a key to see the line above again.
pause >nul
