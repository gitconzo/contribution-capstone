#!/bin/bash
# -------------------------------------------
# Contribution Capstone - Frontend Reset Script
# -------------------------------------------

set -e  # Exit immediately on error

echo "Resetting frontend environment..."

# Quit VS Code and any Node processes that might lock node_modules
osascript -e 'quit app "Visual Studio Code"' >/dev/null 2>&1 || true
pkill -f node >/dev/null 2>&1 || true
pkill -f npm >/dev/null 2>&1 || true
pkill -f "Code" >/dev/null 2>&1 || true

# Move to project frontend folder
cd "$(dirname "$0")"

# Move node_modules (instant unlink) before deletion
if [ -d "node_modules" ]; then
  echo "Moving node_modules to temp folder..."
  mv node_modules _tmp_nodemods
  sudo rm -rf _tmp_nodemods >/dev/null 2>&1 || true
fi

# Remove package-lock.json
if [ -f "package-lock.json" ]; then
  echo "🧾 Removing package-lock.json..."
  rm -f package-lock.json
fi

# Clean npm cache
echo "Cleaning npm cache..."
npm cache clean --force

# Check Node.js version
echo "🔍 Checking Node version..."
NODE_VERSION=$(node -v 2>/dev/null || echo "none")

if [[ "$NODE_VERSION" != "v20.19.5" ]]; then
  echo "Node.js version is $NODE_VERSION (expected v20.19.5)"
  echo "Installing correct Node.js version with nvm..."
  if command -v nvm >/dev/null 2>&1; then
    nvm install 20.19.5
    nvm use 20.19.5
  else
    echo "nvm not found. Please install nvm first: https://github.com/nvm-sh/nvm"
    exit 1
  fi
else
  echo "Node.js v20.19.5 already active."
fi

# 7️⃣ Install dependencies cleanly
echo "Installing dependencies"
npm install --legacy-peer-deps

# Done
echo "➡️  You can now start the frontend with: npm start"
