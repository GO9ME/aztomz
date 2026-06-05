@echo off
title Hermes Gateway - hangeut cron
setlocal

REM ============================================================
REM  hangeut - Hermes (gugumi-bot) manual start + cron auto-run
REM  Double-click this file:
REM   - if already running -> just reports (nothing to do)
REM   - if stopped         -> starts it (background, else foreground)
REM  If your path differs, edit the HERMES_HOME line below.
REM ============================================================

set "HERMES_HOME=E:\workspace\side_project\hermes"
set "HX=%HERMES_HOME%\hermes-agent\venv\Scripts\hermes.exe"

echo ================================================================
echo   Hermes (gugumi-bot) starter  -  cron auto-run
echo   - Mon  06:30  : hangeut weekly trend refresh
echo   - Daily 07:00 : pulse "category of the day"
echo ================================================================
echo.

if not exist "%HX%" goto :nohermes
cd /d "%HERMES_HOME%"

echo [1/2] Checking gateway status...
"%HX%" gateway status
echo.

"%HX%" gateway status | findstr /C:"process running" >nul
if not errorlevel 1 goto :already

echo [2/2] Not running - starting background service...
"%HX%" gateway start
timeout /t 2 >nul
"%HX%" gateway status | findstr /C:"process running" >nul
if not errorlevel 1 goto :started

echo.
echo  Background start failed - running in THIS window instead.
echo  ** Keep this window OPEN. Closing it stops the gateway. **
echo.
"%HX%" gateway run
echo.
echo  Gateway stopped.
goto :end

:already
echo ----------------------------------------------------------------
echo  [OK] Already running - cron fires automatically.
echo       Auto-start on login is also registered, so usually
echo       you do not even need to run this. All good.
echo ----------------------------------------------------------------
goto :end

:started
echo.
echo  [OK] Started in background - cron keeps running even if you
echo       close this window.
goto :end

:nohermes
echo [ERROR] hermes executable not found:
echo        %HX%
echo        Edit the HERMES_HOME path inside this .bat file.

:end
echo.
pause
