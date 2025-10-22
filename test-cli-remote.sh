#!/bin/bash
set -e

echo "=== Bit CLI Remote Test ==="
echo ""

# Check if token is set
if [ -z "$BIT_TOKEN" ]; then
  echo "ERROR: BIT_TOKEN environment variable is not set"
  echo "Please set it with: export BIT_TOKEN='your-jwt-token'"
  exit 1
fi

# Check if repo ID is provided
if [ -z "$1" ]; then
  echo "ERROR: Repository ID is required"
  echo "Usage: $0 <REPO_ID>"
  echo ""
  echo "First, create a repository in the web UI and copy its ID"
  exit 1
fi

REPO_ID=$1
REMOTE_URL="https://xejcpvimktcxcvowbhom.supabase.co/functions/v1/bit-objects"
TEST_DIR="/tmp/bit-test-$$"

echo "Creating test directory: $TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo ""
echo "1. Initializing repository..."
node /workspaces/bucket/cli/index.js init

echo ""
echo "2. Creating test files..."
echo "# Test Project" > README.md
echo "console.log('Hello, World!');" > index.js

echo ""
echo "3. Adding files..."
node /workspaces/bucket/cli/index.js add .

echo ""
echo "4. Committing..."
node /workspaces/bucket/cli/index.js commit -m "Initial commit"

echo ""
echo "5. Checking status..."
node /workspaces/bucket/cli/index.js status

echo ""
echo "6. Viewing log..."
node /workspaces/bucket/cli/index.js log

echo ""
echo "7. Adding remote..."
node /workspaces/bucket/cli/index.js remote add origin "$REMOTE_URL" "$REPO_ID"

echo ""
echo "8. Pushing to remote..."
node /workspaces/bucket/cli/index.js push-remote origin refs/heads/main

echo ""
echo "9. Testing clone in a new directory..."
CLONE_DIR="/tmp/bit-clone-$$"
node /workspaces/bucket/cli/index.js clone-remote "$REMOTE_URL" "$REPO_ID" "$CLONE_DIR"

echo ""
echo "10. Verifying cloned repository..."
cd "$CLONE_DIR"
echo "Files:"
ls -la
echo ""
echo "Commit history:"
node /workspaces/bucket/cli/index.js log

echo ""
echo "=== Test completed successfully! ==="
echo "Original repo: $TEST_DIR"
echo "Cloned repo: $CLONE_DIR"
