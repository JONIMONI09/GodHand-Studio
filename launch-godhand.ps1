# GodHand Studio Launcher (PowerShell)
# Launches the local Node.js backend on Port 3000 and opens default browser

$Host.UI.RawUI.WindowTitle = "GodHand Studio (Port 3000)"
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "    GodHand Studio - Fabric Minecraft IDE Launcher" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "[!] Error: Node.js was not found in PATH." -ForegroundColor Red
    Write-Host "    Please install Node.js 20+ from https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

$port = 3000
$url = "http://localhost:$port"

Write-Host "[*] Launching browser at $url..." -ForegroundColor Green
Start-Process $url

Write-Host "[*] Starting Express Server on port $port..." -ForegroundColor Green
Set-Location -Path $PSScriptRoot
node dashboard/server.js
