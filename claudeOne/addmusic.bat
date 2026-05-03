@echo off
cd /d "%~dp0"

echo.
echo ============================================
echo   claudeOne - Add Music Launcher
echo ============================================
echo.

echo [1/3] Starting backend server...
start "claudeOne-Backend" cmd /c "cd /d %~dp0server && node server.js"
echo        Backend: http://localhost:3001
echo.

echo [2/3] Scanning music/ folder...
node "%~dp0scripts\scan-music.js"

if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Music scan failed. Check the music/ folder.
)

echo.
echo [3/3] Opening browser...
start "" "http://localhost:3001"

echo.
echo ============================================
echo  All services started!
echo.
echo  Frontend : http://localhost:3001
echo  API      : http://localhost:3001/api/ascii
echo  Health   : http://localhost:3001/api/health
echo.
echo  Add new music to music/ folder,
echo  then run addmusic.bat again to update.
echo ============================================
echo.
pause
