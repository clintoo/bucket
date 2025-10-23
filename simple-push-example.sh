#!/bin/bash

# Simple example: Push a project to remote repository
# Edit the variables below with your values, then run: ./simple-push-example.sh

# ============================================================================
# CONFIGURATION - EDIT THESE VALUES
# ============================================================================

# Your Supabase project URL (get from Supabase Dashboard)
SUPABASE_URL="https://xejcpvimktcxcvowbhom.supabase.co/functions/v1/bit-objects"

# Your repository ID (get from Hub after creating a repo)
REPO_ID="your-repo-uuid-here"

# Your JWT token (get from browser console or DevTools)
JWT_TOKEN="your-jwt-token-here"

# ============================================================================
# MAIN SCRIPT - NO NEED TO EDIT BELOW
# ============================================================================

# Get CLI path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="node $SCRIPT_DIR/cli/index.js"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Starting push example...${NC}"

# Check if we're in a git repo (to avoid confusion)
if [ -d ".git" ]; then
    echo "Warning: This directory has a .git folder. Make sure you want to use 'bit' here."
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Initialize if needed
if [ ! -d ".bit" ]; then
    echo -e "${BLUE}Initializing bit repository...${NC}"
    $CLI init
fi

# Set token
export BIT_TOKEN="$JWT_TOKEN"

# Check authentication
echo -e "${BLUE}Checking authentication...${NC}"
$CLI whoami

# Add remote if not exists
if ! $CLI remote list | grep -q "origin"; then
    echo -e "${BLUE}Adding remote...${NC}"
    $CLI remote add origin "$SUPABASE_URL" "$REPO_ID"
else
    echo -e "${GREEN}Remote 'origin' already exists${NC}"
fi

# Show current status
echo -e "${BLUE}Current status:${NC}"
$CLI status

# Stage all files
echo -e "${BLUE}Staging files...${NC}"
$CLI add .

# Show what will be committed
echo -e "${BLUE}Files to be committed:${NC}"
$CLI status

# Commit
echo -e "${BLUE}Creating commit...${NC}"
read -p "Enter commit message: " COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="Update from $(date)"
fi
$CLI commit -m "$COMMIT_MSG"

# Show log
echo -e "${BLUE}Commit history:${NC}"
$CLI log

# Push
echo -e "${BLUE}Pushing to remote...${NC}"
$CLI push-remote origin refs/heads/main

echo -e "${GREEN}Done! Check your Hub to see the changes.${NC}"
