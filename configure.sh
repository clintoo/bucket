#!/bin/bash

# Interactive configuration helper for bit CLI
# This script helps you set up authentication and remote repository

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Get CLI path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="node $SCRIPT_DIR/cli/index.js"

clear
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                              ║${NC}"
echo -e "${CYAN}║              BIT CLI - Configuration Helper                  ║${NC}"
echo -e "${CYAN}║                                                              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Check if already in a repo
echo -e "${BLUE}━━━ Step 1: Repository Check ━━━${NC}"
if [ -d ".bit" ]; then
    echo -e "${GREEN}✓ Found existing .bit repository${NC}"
    read -p "Use this repository? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Please navigate to your project directory first${NC}"
        exit 0
    fi
else
    echo -e "${YELLOW}No .bit repository found in current directory${NC}"
    read -p "Initialize new repository here? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        $CLI init
        echo -e "${GREEN}✓ Repository initialized${NC}"
    else
        echo -e "${YELLOW}Please navigate to your project directory and run again${NC}"
        exit 0
    fi
fi
echo ""

# Step 2: Authentication
echo -e "${BLUE}━━━ Step 2: Authentication ━━━${NC}"
echo "To get your access token:"
echo "  ${GREEN}Easiest way:${NC}"
echo "    1. Open your Hub in browser"
echo "    2. Go to Settings (user menu → Settings)"
echo "    3. Scroll to 'Developer Settings'"
echo "    4. Click 'Copy' button next to Access Token"
echo ""
echo "  ${YELLOW}Alternative:${NC}"
echo "    1. Open DevTools (F12) → Console"
echo "    2. Run: const { data: { session } } = await supabase.auth.getSession(); console.log(session.access_token)"
echo "    3. Copy the token"
echo ""
read -p "Do you have your access token ready? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    read -p "Paste your access token: " JWT_TOKEN
    
    if [ -z "$JWT_TOKEN" ]; then
        echo -e "${RED}✗ No token provided${NC}"
        exit 1
    fi
    
    export BIT_TOKEN="$JWT_TOKEN"
    
    # Test authentication
    echo -e "${BLUE}Testing authentication...${NC}"
    if $CLI whoami 2>/dev/null; then
        echo -e "${GREEN}✓ Authentication successful${NC}"
    else
        echo -e "${RED}✗ Authentication failed. Please check your token${NC}"
        exit 1
    fi
    else
        echo -e "${YELLOW}Please get your access token first and run this script again${NC}"
        echo "Easiest way: Hub → Settings → Developer Settings → Copy token"
        exit 0
    fi
    echo ""

# Step 3: Remote Configuration
echo -e "${BLUE}━━━ Step 3: Remote Repository ━━━${NC}"

# Check existing remote
if $CLI remote list 2>/dev/null | grep -q "origin"; then
    echo -e "${GREEN}✓ Remote 'origin' already configured${NC}"
    $CLI remote -v
    read -p "Reconfigure remote? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}Using existing remote${NC}"
        echo ""
        echo -e "${CYAN}═══════════════════════════════════════${NC}"
        echo -e "${GREEN}Configuration complete!${NC}"
        echo -e "${CYAN}═══════════════════════════════════════${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Stage files:  bit add ."
        echo "  2. Commit:       bit commit -m 'Your message'"
        echo "  3. Push:         bit push-remote"
        exit 0
    fi
fi

echo ""
echo "To get your repository information:"
echo "  1. Go to your Hub web interface"
echo "  2. Create or open a repository"
echo "  3. Copy the Repository ID from the URL"
echo "     Example: https://your-hub.com/repo/550e8400-e29b-41d4-a716-446655440000"
echo "                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^"
echo "  4. Your Supabase URL is in your project settings"
echo ""

read -p "Enter your Supabase project URL (e.g., xejcpvimktcxcvowbhom.supabase.co): " SUPABASE_URL

if [ -z "$SUPABASE_URL" ]; then
    echo -e "${RED}✗ No URL provided${NC}"
    exit 1
fi

# Add https:// if not present
if [[ ! $SUPABASE_URL =~ ^https?:// ]]; then
    SUPABASE_URL="https://${SUPABASE_URL}"
fi

# Add path if not present
if [[ ! $SUPABASE_URL =~ /functions/v1/bit-objects$ ]]; then
    SUPABASE_URL="${SUPABASE_URL}/functions/v1/bit-objects"
fi

read -p "Enter your Repository ID (UUID): " REPO_ID

if [ -z "$REPO_ID" ]; then
    echo -e "${RED}✗ No Repository ID provided${NC}"
    exit 1
fi

# Validate UUID format (basic check)
if [[ ! $REPO_ID =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
    echo -e "${YELLOW}⚠ Warning: Repository ID doesn't look like a valid UUID${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

echo ""
echo -e "${BLUE}Adding remote...${NC}"
$CLI remote add origin "$SUPABASE_URL" "$REPO_ID"
echo -e "${GREEN}✓ Remote configured${NC}"
echo ""

# Show configuration
echo -e "${BLUE}Current configuration:${NC}"
$CLI remote -v
echo ""

# Summary
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                              ║${NC}"
echo -e "${CYAN}║                  Configuration Complete!                    ║${NC}"
echo -e "${CYAN}║                                                              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓ Repository initialized${NC}"
echo -e "${GREEN}✓ Authentication configured${NC}"
echo -e "${GREEN}✓ Remote 'origin' configured${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo -e "  ${CYAN}1.${NC} Check status:"
echo "     ${YELLOW}bit status${NC}"
echo ""
echo -e "  ${CYAN}2.${NC} Stage your files:"
echo "     ${YELLOW}bit add .${NC}"
echo ""
echo -e "  ${CYAN}3.${NC} Create a commit:"
echo "     ${YELLOW}bit commit -m \"Initial commit\"${NC}"
echo ""
echo -e "  ${CYAN}4.${NC} Push to remote:"
echo "     ${YELLOW}bit push-remote${NC}"
echo ""
echo -e "${BLUE}Tips:${NC}"
echo "  • Save token in env: export BIT_TOKEN=\"your-token\""
echo "  • View history:      bit log"
echo "  • Check remotes:     bit remote -v"
echo "  • Get help:          see QUICK_REFERENCE.txt"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
