@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0" || (
    echo [错误] 无法进入脚本目录：%~dp0
    pause
    exit /b 1
)

set "PORT=3001"
set "URL=http://localhost:%PORT%"

:menu
cls
call :check_status
echo.
echo   ============================================
echo     claudeOne - 控制面板
echo     服务状态：!STATUS!
echo   ============================================
echo.
echo     [1] 启动服务 + 扫描音乐 + 打开浏览器
echo     [2] 仅启动服务
echo     [3] 仅扫描音乐 更新播放列表
echo     [4] 重启服务
echo     [5] 停止服务
echo     [0] 退出
echo.
set /p "choice=   请选择: "

if "!choice!"=="1" goto start_all
if "!choice!"=="2" goto start_server_only
if "!choice!"=="3" goto scan_only
if "!choice!"=="4" goto restart_server
if "!choice!"=="5" goto stop_server_only
if "!choice!"=="0" exit /b 0
echo 无效选择，请重新输入。
timeout /t 1 /nobreak >nul
goto menu

:start_all
echo.
echo [1/3] 正在启动服务...
call :do_start
if errorlevel 1 (
    pause
    goto menu
)
echo.
echo [2/3] 正在扫描音乐文件夹...
call :do_scan
if errorlevel 1 (
    pause
    goto menu
)
echo.
echo [3/3] 正在打开浏览器...
start "" "%URL%"
echo.
echo 全部完成：%URL%
echo.
pause
goto menu

:start_server_only
echo.
echo 正在启动服务...
call :do_start
echo.
pause
goto menu

:scan_only
echo.
call :do_scan
echo.
if errorlevel 1 (
    echo 扫描失败，请查看上面的错误信息。
) else (
    echo 扫描完成，刷新浏览器查看更新。
)
echo.
pause
goto menu

:restart_server
echo.
echo 正在重启服务...
call :do_stop
timeout /t 2 /nobreak >nul
call :do_start
echo.
pause
goto menu

:stop_server_only
echo.
echo 正在停止服务...
call :do_stop
echo.
echo 如果没有其他服务占用端口，%URL% 现在将无法访问。
echo.
pause
goto menu

:check_status
call :find_server
if defined SERVER_PID (
    set "STATUS=运行中 PID=!SERVER_PID!"
) else (
    set "STATUS=已停止"
)
exit /b 0

:find_server
set "SERVER_PID="
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /r /c:":%PORT% .*LISTENING"') do (
    set "SERVER_PID=%%a"
    exit /b 0
)
exit /b 1

:ensure_node
where node >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Node.js。请先安装 Node.js，或把 node 加入 PATH。
    echo 下载地址：https://nodejs.org/
    exit /b 1
)
exit /b 0

:do_start
call :ensure_node
if errorlevel 1 exit /b 1

if not exist "%~dp0server\server.js" (
    echo [错误] 找不到后端文件：%~dp0server\server.js
    exit /b 1
)

call :find_server
if defined SERVER_PID (
    echo   服务已在运行：%URL% PID=!SERVER_PID!
    exit /b 0
)

start "claudeOne-Server" cmd /k "cd /d ""%~dp0server"" && node server.js"
echo   正在启动服务：%URL%
timeout /t 2 /nobreak >nul
exit /b 0

:do_stop
call :find_server
if defined SERVER_PID (
    echo   正在停止服务 PID=!SERVER_PID!
    taskkill /PID !SERVER_PID! /F >nul 2>&1
    if errorlevel 1 (
        echo   停止失败，请检查该 PID 是否仍在运行。
        exit /b 1
    )
    echo   服务已停止。
    exit /b 0
)
echo   服务未在运行。
exit /b 0

:do_scan
call :ensure_node
if errorlevel 1 exit /b 1

if not exist "%~dp0scripts\scan-music.js" (
    echo [错误] 找不到扫描脚本：%~dp0scripts\scan-music.js
    exit /b 1
)

node "%~dp0scripts\scan-music.js"
set "SCAN_CODE=%ERRORLEVEL%"
if not "!SCAN_CODE!"=="0" (
    echo [错误] 扫描音乐失败。
)
exit /b !SCAN_CODE!
