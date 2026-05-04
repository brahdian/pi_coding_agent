# Zenith Software Factory — Universal Windows Installer
# Enforces the 20 Pillars and deploys the Industrial Suite

$ErrorActionPreference = "Stop"

Write-Host "`nZenith 🧬 Deploying Software Factory..." -ForegroundColor Cyan

# 1. Check for Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "🛑 Error: Node.js is required. Please install it from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# 2. Build and Link Pi Core Agent (from Source to preserve Antigravity)
Write-Host "Zenith 🛠️  Building and Linking Pi Core from Source..." -ForegroundColor Gray
npm install
npm run build

Write-Host "Zenith 🛠️  Linking Global Binary..." -ForegroundColor Gray
$AgentPath = Join-Path $PSScriptRoot "packages/coding-agent"
Set-Location $AgentPath
npm link --force
Set-Location $PSScriptRoot

# 3. Register Zenith Industrial Suite
# Assumes the script is run from the root of the cloned repo
$GenomePath = Join-Path $PSScriptRoot ".pi"

if (!(Test-Path $GenomePath)) {
    Write-Host "🛑 Error: Could not find Zenith Genome at $GenomePath" -ForegroundColor Red
    exit 1
}

Write-Host "Zenith 🛠️  Registering Industrial Genome..." -ForegroundColor Gray
pi install "$GenomePath"

Write-Host "`nZenith ✅ Factory Deployed Successfully." -ForegroundColor Green
Write-Host "Type 'pi' in your terminal to begin construction.`n" -ForegroundColor Green
