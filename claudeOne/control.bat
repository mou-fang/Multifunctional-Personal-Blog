@echo off
cd /d "%~dp0"
setlocal enabledelayedexpansion

:menu
cls
call :check_status
echo.
echo   ============================================
echo     claudeOne - Control Panel
echo     Server: !STATUS!
echo   ============================================
echo.
echo     [1] Start Server + Scan Music + Browser
echo     [2] Start Server Only
echo     [3] Scan Music Only (update playlist)
echo     [4] Restart Server
echo     [5] Stop Server
echo     [0] Exit
echo.
set /p choice="   Select: "

if "%choice%"=="1" goto start_all
if "%choice%"=="2" goto start_server_only
if "%choice%"=="3" goto scan_only
if "%choice%"=="4" goto restart_server
if "%choice%"=="5" goto stop_server_only
if "%choice%"=="0" exit /b
echo Invalid selection
timeout /t 1 >nul
goto menu

:: --- Menu actions ---

:start_all
echo.
echo [1/3] Starting server (frontend + backend)...
call :do_start
if !errorlevel! neq 0 goto menu
echo [2/3] Scanning music folder...
call :do_scan
echo [3/3] Opening browser...
start "" "http://localhost:3001"
echo.
echo All done! http://localhost:3001
echo.
pause
goto menu

:start_server_only
echo.
echo Starting server...
call :do_start
timeout /t 1 >nul
goto menu

:scan_only
echo.
call :do_scan
echo.
echo Done! Refresh browser to see changes.
timeout /t 2 >nul
goto menu

:restart_server
echo.
echo Restarting server...
call :do_stop
timeout /t 2 >nul
call :do_start
timeout /t 1 >nul
goto menu

:stop_server_only
echo.
echo Stopping server...
call :do_stop
echo.
echo Server stopped. The page at http://localhost:3001 will no longer load.
echo.
pause
goto menu

:: --- Helpers ---

:check_status
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001.*LISTENING"') do (
    set "STATUS=RUNNING (PID: %%a)"
    exit /b
)
set "STATUS=STOPPED"
exit /b

:do_start
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001.*LISTENING"') do (
    echo   Server already running on http://localhost:3001 (PID: %%a)
    exit /b 0
)
start "claudeOne-Server" cmd /c "cd /d %~dp0server && node server.js"
echo   Server starting on http://localhost:3001 ...
exit /b 0

:do_stop
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001.*LISTENING"') do (
    echo   Stopping server (PID: %%a)...
    taskkill /PID %%a /F >nul 2>&1
    echo   Server stopped.
    exit /b
)
echo   Server is not running.
exit /b

:do_scan
node "%~dp0scripts\scan-music.js"
exit /b
