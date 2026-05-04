#!/bin/bash
# Zenith Software Factory — Universal Unix/macOS Source Installer
# Enforces the 20 Pillars and builds the Industrial Suite from local source

SET_COLOR_CYAN="\033[0;36m"
SET_COLOR_GREEN="\033[0;32m"
SET_COLOR_RESET="\033[0m"

echo -e "\n${SET_COLOR_CYAN}Zenith 🧬 Deploying Software Factory from Local Source...${SET_COLOR_RESET}"

# 1. Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "🛑 Error: Node.js is required. Please install it first."
    exit 1
fi

# 2. Build and Link Pi Core Agent (from Source to preserve Antigravity)
echo -e "Zenith 🛠️  Building and Linking Pi Core from Source..."
npm install
npm run build

echo -e "Zenith 🛠️  Linking Global Binary..."
# Link specifically from the coding-agent package which provides the binary
cd packages/coding-agent
npm link --force
cd ../..

# 3. Register Zenith Industrial Suite
# Assumes the script is run from the root of the cloned repo
GENOME_PATH="$(pwd)/.pi"

if [ ! -d "$GENOME_PATH" ]; then
    echo -e "🛑 Error: Could not find Zenith Genome at $GENOME_PATH"
    exit 1
fi

echo -e "Zenith 🛠️  Registering Industrial Genome..."
pi install "$GENOME_PATH"

echo -e "\n${SET_COLOR_GREEN}Zenith ✅ Factory Deployed Successfully.${SET_COLOR_RESET}"
echo -e "${SET_COLOR_GREEN}Type 'pi' to begin construction.\n${SET_COLOR_RESET}"
