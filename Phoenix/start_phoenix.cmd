@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 scripts\phoenix_local.py run
) else (
  python scripts\phoenix_local.py run
)
if errorlevel 1 pause
endlocal
