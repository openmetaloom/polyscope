#!/bin/bash
set -e

echo "🛠️  PolyScope Local Setup Script"
echo "================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check Node.js version
echo ""
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js not found${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js version must be 18 or higher${NC}"
    echo "Current version: $(node --version)"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ npm $(npm --version)${NC}"

# Check if .env exists
echo ""
if [ -f ".env" ]; then
    echo -e "${YELLOW}.env file already exists${NC}"
    read -p "Overwrite? (y/N): " OVERWRITE
    if [[ ! $OVERWRITE =~ ^[Yy]$ ]]; then
        echo "Keeping existing .env file"
    else
        cp .env.example .env
        echo "Created new .env file from template"
    fi
else
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env file from template${NC}"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Generate development API key
echo ""
echo "🔑 Generating development API key..."
DEV_KEY="dev_$(openssl rand -hex 16)"
echo ""
echo "Your development API key:"
echo -e "${GREEN}$DEV_KEY${NC}"
echo ""
echo "Add this to your .env file:"
echo "API_KEYS=$DEV_KEY"
echo ""

# Check if user wants to edit .env
read -p "Would you like to edit .env now? (y/N): " EDIT_ENV
if [[ $EDIT_ENV =~ ^[Yy]$ ]]; then
    if command -v nano &> /dev/null; then
        nano .env
    elif command -v vim &> /dev/null; then
        vim .env
    else
        echo "Please edit .env manually"
    fi
fi

# Build core package
echo ""
echo "🏗️  Building core package..."
npm run build -w packages/core

# Verify setup
echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your API keys"
echo "  2. Run: npm run dev"
echo "  3. API will be at: http://localhost:3000"
echo "  4. UI will be at:  http://localhost:5173"
echo ""
echo "Test with:"
echo "  curl -H \"X-API-Key: $DEV_KEY\" http://localhost:3000/api/v1/health"