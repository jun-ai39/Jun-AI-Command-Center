@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 scripts\phoenix_local.py setup
) else (
  python scripts\phoenix_local.py setup
)
if errorlevel 1 pause
endlocal
