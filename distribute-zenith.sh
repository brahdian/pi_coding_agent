#!/bin/bash
# Zenith Industrial Suite — Distribution Builder
# Produces a portable installer for the full Software Factory

SET_COLOR_CYAN="\033[0;36m"
SET_COLOR_GREEN="\033[0;32m"
SET_COLOR_RESET="\033[0m"

echo -e "${SET_COLOR_CYAN}Zenith 🧬 Building Industrial Distribution Kit...${SET_COLOR_RESET}"

DIST_DIR="./zenith-dist"
mkdir -p "$DIST_DIR/genome"

# 1. Capture the Factory Genome (.pi folder)
echo -e "Zenith 🛠️  Capturing Genome (Worker, Subagents, Swarm, Prompts)..."
cp -r .pi/* "$DIST_DIR/genome/"

# 2. Create the Universal Installer (sh/ps1)
echo -e "Zenith 🛠️  Generating Professional Installers..."

cat << 'EOF' > "$DIST_DIR/install.sh"
#!/bin/bash
# Zenith Software Factory — Unix/macOS Installer
SET_COLOR_CYAN="\033[0;36m"
SET_COLOR_GREEN="\033[0;32m"
SET_COLOR_RESET="\033[0m"

echo -e "${SET_COLOR_CYAN}Zenith 🧬 Deploying Software Factory...${SET_COLOR_RESET}"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required. Please install it first."
    exit 1
fi

# Install Pi Coding Agent
echo -e "Zenith 🛠️  Installing Pi Core Agent..."
npm install -g @mariozechner/pi-coding-agent

# Install Zenith Industrial Suite
GENOME_PATH="$(cd "$(dirname "$0")/genome" && pwd)"
echo -e "Zenith 🛠️  Registering Industrial Genome at $GENOME_PATH..."
pi install "$GENOME_PATH"

echo -e "${SET_COLOR_GREEN}Zenith ✅ Factory Deployed. Type 'pi' to begin construction.${SET_COLOR_RESET}"
EOF

chmod +x "$DIST_DIR/install.sh"

cat << 'EOF' > "$DIST_DIR/install.ps1"
# Zenith Software Factory — Windows Installer
Write-Host "Zenith 🧬 Deploying Software Factory..." -ForegroundColor Cyan

# Check for Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is required. Please install it first." -ForegroundColor Red
    exit 1
}

# Install Pi Coding Agent
Write-Host "Zenith 🛠️ Installing Pi Core Agent..."
npm install -g @mariozechner/pi-coding-agent

# Install Zenith Industrial Suite
$GenomePath = Join-Path $PSScriptRoot "genome"
Write-Host "Zenith 🛠️ Registering Industrial Genome..."
pi install "$GenomePath"

Write-Host "Zenith ✅ Factory Deployed. Type 'pi' to begin construction." -ForegroundColor Green
EOF

# 3. Create the ZIP Archive (The "Installer" container)
echo -e "Zenith 🛠️  Packaging for distribution..."
zip -r zenith-factory-v1.zip "$DIST_DIR" &> /dev/null

echo -e "${SET_COLOR_GREEN}Zenith ✅ Distribution Kit Ready: zenith-factory-v1.zip${SET_COLOR_RESET}"
echo -e "This ZIP contains the full worker suite, subagents, and all 28+ industrial prompts."
