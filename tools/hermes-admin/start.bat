@echo off
chcp 65001 >nul
REM hermes-admin — 로컬 관리 콘솔 실행. 127.0.0.1 전용.
setlocal
cd /d "%~dp0"

set "HERMES_HOME=E:\workspace\side_project\hermes"
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"
if "%HERMES_ADMIN_PORT%"=="" set "HERMES_ADMIN_PORT=7766"

REM 토큰 생성 후 브라우저 자동 오픈(서버 기동을 잠깐 기다림)
for /f %%i in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N')"') do set "HERMES_ADMIN_TOKEN=%%i"
start "" cmd /c "timeout /t 1 >nul & start """" ""http://127.0.0.1:%HERMES_ADMIN_PORT%/?t=%HERMES_ADMIN_TOKEN%"""

node server.mjs
endlocal
