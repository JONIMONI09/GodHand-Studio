@echo off
title GodHand Fabric Studio Launcher (Port 3000)
cd /d "%~dp0"

echo ===================================================
echo     GodHand Studio - Fabric Minecraft IDE Launcher
echo ===================================================
echo.
echo [*] Checking local environment...

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] Error: Node.js was not found in PATH!
    echo     Please install Node.js 20+ from https://nodejs.org
    pause
    exit /b 1
)

echo [*] Starting local GodHand server on http://localhost:3000...
start "" "http://localhost:3000"

node dashboard/server.js
pause
