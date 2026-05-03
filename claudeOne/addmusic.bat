@echo off
chcp 65001 >nul
setlocal EnableExtensions

cd /d "%~dp0" || (
    echo [错误] 无法进入脚本目录：%~dp0
    pause
    exit /b 1
)

set "PORT=3001"
set "URL=http://localhost:%PORT%"

echo.
echo ============================================
echo   claudeOne - 音乐扫描启动器
echo ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Node.js。请先安装 Node.js，或把 node 加入 PATH。
    echo 下载地址：https://nodejs.org/
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0server\server.js" (
    echo [错误] 找不到后端文件：%~dp0server\server.js
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0scripts\scan-music.js" (
    echo [错误] 找不到扫描脚本：%~dp0scripts\scan-music.js
    echo.
    pause
    exit /b 1
)

echo [1/3] 正在启动后端服务...
call :find_server
if defined SERVER_PID (
    echo        服务已在运行：%URL% PID=%SERVER_PID%
) else (
    start "claudeOne-Backend" cmd /k "cd /d ""%~dp0server"" && node server.js"
    echo        后端地址：%URL%
    timeout /t 2 /nobreak >nul
)
echo.

echo [2/3] 正在扫描 music 文件夹...
node "%~dp0scripts\scan-music.js"
set "SCAN_ERROR=%ERRORLEVEL%"

if not "%SCAN_ERROR%"=="0" (
    echo.
    echo [警告] 音乐扫描失败，请检查 music 文件夹或上面的错误信息。
)

echo.
echo [3/3] 正在打开浏览器...
start "" "%URL%"

echo.
echo ============================================
echo  启动流程已完成。
echo.
echo  前端  ：%URL%
echo  接口  ：%URL%/api/ascii
echo  健康  ：%URL%/api/health
echo.
echo  如需添加新音乐，请将文件放入 music 文件夹，
echo  然后重新运行 addmusic.bat 即可更新。
echo ============================================
echo.
pause
exit /b %SCAN_ERROR%

:find_server
set "SERVER_PID="
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /r /c:":%PORT% .*LISTENING"') do (
    set "SERVER_PID=%%a"
    exit /b 0
)
exit /b 1
