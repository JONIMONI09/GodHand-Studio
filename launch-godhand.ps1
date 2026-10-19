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

Set-Location -Path $PSScriptRoot

$nodeModules = Join-Path $PSScriptRoot "dashboard\node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "[*] dashboard/node_modules not found. Installing frontend dependencies..." -ForegroundColor Yellow
    npm --prefix dashboard install
}

$distIndex = Join-Path $PSScriptRoot "dashboard\dist\index.html"
if (-not (Test-Path $distIndex)) {
    Write-Host "[*] dashboard/dist not found. Compiling frontend bundle..." -ForegroundColor Yellow
    npm run build --prefix dashboard
}

$port = if ($env:PORT) { $env:PORT } else { 3000 }
$url = "http://localhost:$port"

Write-Host "[*] Tip: To connect localhost with https://project-910a2a4c-fa54-4621-b21.web.app," -ForegroundColor Magenta
Write-Host "    run: npx --yes cloudflared tunnel --url http://localhost:3000" -ForegroundColor Magenta
Write-Host ""
Write-Host "[*] Launching browser at $url..." -ForegroundColor Green
Start-Process $url

Write-Host "[*] Starting Express Server on port $port..." -ForegroundColor Green
node dashboard/server.js
