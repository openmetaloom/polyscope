#!/bin/bash
set -e

echo "🚀 PolyScope Vercel Deployment Script"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for required commands
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}Error: Vercel CLI not found${NC}"
    echo "Install with: npm i -g vercel"
    exit 1
fi

# Check if logged in
if ! vercel whoami &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Vercel. Please login:${NC}"
    vercel login
fi

# Check environment variables
echo ""
echo "🔍 Checking environment variables..."

if [ -z "$API_KEYS" ]; then
    echo -e "${YELLOW}Warning: API_KEYS not set in environment${NC}"
    read -p "Enter API_KEYS (comma-separated): " API_KEYS
    export API_KEYS
fi

if [ -z "$ADMIN_API_KEY" ]; then
    echo -e "${YELLOW}Warning: ADMIN_API_KEY not set${NC}"
    read -p "Enter ADMIN_API_KEY: " ADMIN_API_KEY
    export ADMIN_API_KEY
fi

# Prompt for optional variables
echo ""
echo "🔧 Optional environment variables:"
read -p "BANKR_API_KEY (optional): " BANKR_API_KEY
read -p "CORS_ORIGIN (default: *): " CORS_ORIGIN

CORS_ORIGIN=${CORS_ORIGIN:-*}

# Set environment variables in Vercel
echo ""
echo "📦 Setting up Vercel environment variables..."

echo "Setting API_KEYS..."
echo "$API_KEYS" | vercel env add API_KEYS production

echo "Setting ADMIN_API_KEY..."
echo "$ADMIN_API_KEY" | vercel env add ADMIN_API_KEY production

if [ -n "$BANKR_API_KEY" ]; then
    echo "Setting BANKR_API_KEY..."
    echo "$BANKR_API_KEY" | vercel env add BANKR_API_KEY production
fi

echo "Setting CORS_ORIGIN..."
echo "$CORS_ORIGIN" | vercel env add CORS_ORIGIN production

echo "Setting NODE_ENV..."
echo "production" | vercel env add NODE_ENV production

# Build and deploy
echo ""
echo "🏗️  Building and deploying..."

vercel --prod

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Your app should be available at:"
vercel ls | grep -E "^\s+https://" | head -1
echo ""
echo "Test the deployment with:"
echo "  curl -H \"X-API-Key: <your-key>\" <url>/api/v1/health"