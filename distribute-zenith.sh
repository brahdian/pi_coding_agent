#!/bin/bash
# Zenith Industrial Suite — Distribution Builder
# Produces a portable installer for the full Software Factory

SET_COLOR_CYAN="\033[0;36m"
SET_COLOR_GREEN="\033[0;32m"
SET_COLOR_RESET="\033[0m"

echo -e "${SET_COLOR_CYAN}Zenith 🧬 Building Industrial Distribution Kit...${SET_COLOR_RESET}"

DIST_DIR="./zenith-dist"
mkdir -p "$DIST_DIR/genome"

# 1. Capture the Full Monorepo (Source Code + Genome)
echo -e "Zenith 🛠️  Capturing Monorepo Source (preserving Antigravity logic)..."
# Exclude heavy/unnecessary folders to keep the ZIP manageable
rsync -ar . "$DIST_DIR/source" --exclude node_modules --exclude .git --exclude zenith-dist --exclude "*.zip"

# 2. Create the Universal Installer (sh/ps1)
echo -e "Zenith 🛠️  Generating Industrial Source Installers..."

cat << 'EOF' > "$DIST_DIR/install.sh"
#!/bin/bash
# Zenith Software Factory — Unix/macOS Source-Link Installer
SET_COLOR_CYAN="\033[0;36m"
SET_COLOR_GREEN="\033[0;32m"
SET_COLOR_RESET="\033[0m"

echo -e "${SET_COLOR_CYAN}Zenith 🧬 Deploying Software Factory from Source...${SET_COLOR_RESET}"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required. Please install it first."
    exit 1
fi

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="$BASE_DIR/source"

# Build and Link Pi from the bundled source
echo -e "Zenith 🛠️  Building Pi Core from Source..."
cd "$SOURCE_DIR"
npm install
npm run build

echo -e "Zenith 🛠️  Linking Global Binary..."
cd "$SOURCE_DIR/packages/coding-agent"
npm link --force

# Register Zenith Industrial Suite
echo -e "Zenith 🛠️  Registering Industrial Genome..."
pi install "$SOURCE_DIR/.pi"

echo -e "${SET_COLOR_GREEN}Zenith ✅ Factory Deployed. Type 'pi' to begin construction.${SET_COLOR_RESET}"
EOF

chmod +x "$DIST_DIR/install.sh"

cat << 'EOF' > "$DIST_DIR/install.ps1"
# Zenith Software Factory — Windows Source-Link Installer
Write-Host "Zenith 🧬 Deploying Software Factory from Source..." -ForegroundColor Cyan

# Check for Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is required. Please install it from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

$BaseDir = $PSScriptRoot
$SourceDir = Join-Path $BaseDir "source"

# Build and Link Pi from the bundled source
Write-Host "Zenith 🛠️ Building Pi Core from Source..." -ForegroundColor Gray
Set-Location $SourceDir
npm install
npm run build

Write-Host "Zenith 🛠️ Linking Global Binary..." -ForegroundColor Gray
Set-Location (Join-Path $SourceDir "packages/coding-agent")
npm link --force

# Register Zenith Industrial Suite
Write-Host "Zenith 🛠️ Registering Industrial Genome..." -ForegroundColor Gray
pi install (Join-Path $SourceDir ".pi")

Write-Host "Zenith ✅ Factory Deployed. Type 'pi' to begin construction." -ForegroundColor Green
EOF

# 3. Create the ZIP Archive (The "Installer" container)
echo -e "Zenith 🛠️  Packaging for distribution..."
zip -r zenith-factory-v1.zip "$DIST_DIR" &> /dev/null

echo -e "${SET_COLOR_GREEN}Zenith ✅ Distribution Kit Ready: zenith-factory-v1.zip${SET_COLOR_RESET}"
echo -e "This ZIP contains the full worker suite, subagents, and all 28+ industrial prompts."
