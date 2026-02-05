#!/bin/bash

# YouTube Video Notes Extension - Build Script
# Creates a distributable package for Chrome Web Store

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building YouTube Video Notes Extension${NC}"

# Get version from manifest.json
VERSION=$(grep '"version"' manifest.json | head -1 | awk -F'"' '{print $4}')
echo -e "${YELLOW}Version: $VERSION${NC}"

# Create dist directory
rm -rf dist
mkdir -p dist

# Copy all necessary files to dist
echo -e "${YELLOW}Copying files...${NC}"
cp manifest.json dist/
cp content.js dist/
cp styles.css dist/
cp -r icons dist/
cp README.md dist/ 2>/dev/null || echo "README.md not found, skipping..."

# Create zip file
ZIP_NAME="youtube-video-notes-v${VERSION}.zip"
echo -e "${YELLOW}Creating zip file: $ZIP_NAME${NC}"
cd dist
zip -r "../$ZIP_NAME" *
cd ..

# Move zip to dist folder
mv "$ZIP_NAME" dist/

echo -e "${GREEN}✓ Build complete!${NC}"
echo -e "${GREEN}Distribution package created: dist/$ZIP_NAME${NC}"
echo ""
echo "To upload to Chrome Web Store:"
echo "1. Go to https://chrome.google.com/webstore/devconsole"
echo "2. Create new extension or update existing"
echo "3. Upload dist/$ZIP_NAME"
