#!/bin/bash

# Test script for pushing to remote repository
# Usage: ./test-push-remote.sh <supabase-url> <repo-id> <jwt-token>
#
# Example:
# ./test-push-remote.sh \
#   "https://xejcpvimktcxcvowbhom.supabase.co/functions/v1/bit-objects" \
#   "550e8400-e29b-41d4-a716-446655440000" \
#   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Parse arguments
if [ "$#" -lt 3 ]; then
    log_error "Usage: $0 <supabase-url> <repo-id> <jwt-token>"
    echo ""
    echo "Example:"
    echo "  $0 \\"
    echo "    'https://xejcpvimktcxcvowbhom.supabase.co/functions/v1/bit-objects' \\"
    echo "    '550e8400-e29b-41d4-a716-446655440000' \\"
    echo "    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'"
    exit 1
fi

SUPABASE_URL="$1"
REPO_ID="$2"
JWT_TOKEN="$3"

# Get the absolute path to the CLI
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_PATH="$SCRIPT_DIR/cli/index.js"

if [ ! -f "$CLI_PATH" ]; then
    log_error "CLI not found at $CLI_PATH"
    exit 1
fi

log_info "Using CLI at: $CLI_PATH"

# Create a temporary test directory
TEST_DIR=$(mktemp -d)
log_info "Created test directory: $TEST_DIR"

# Cleanup function
cleanup() {
    log_info "Cleaning up test directory..."
    rm -rf "$TEST_DIR"
}

# Register cleanup on exit
trap cleanup EXIT

# Change to test directory
cd "$TEST_DIR"
log_info "Changed to test directory"

# Initialize repository
log_info "Initializing bit repository..."
node "$CLI_PATH" init
log_success "Repository initialized"

# Authenticate
log_info "Authenticating..."
export BIT_TOKEN="$JWT_TOKEN"
node "$CLI_PATH" whoami
log_success "Authentication successful"

# Add remote
log_info "Adding remote 'origin'..."
node "$CLI_PATH" remote add origin "$SUPABASE_URL" "$REPO_ID"
log_success "Remote added"

# Verify remote
log_info "Verifying remote configuration..."
node "$CLI_PATH" remote -v

# Create test files
log_info "Creating test files..."

cat > README.md << 'EOF'
# Test Repository

This repository was created by the automated push test script.

## Test Information

- Created: $(date)
- Purpose: Testing CLI push functionality
- Status: ✅ Successfully pushed

## Files Included

1. `README.md` - This file
2. `app.js` - Main application file
3. `src/config.js` - Configuration
4. `src/utils.js` - Utility functions
5. `.gitignore` - Ignore rules

## Next Steps

- Verify files appear in the Hub
- Try cloning this repository
- Make changes and push again
EOF

cat > app.js << 'EOF'
const { config } = require('./src/config');
const { formatDate } = require('./src/utils');

console.log(`Application: ${config.name}`);
console.log(`Version: ${config.version}`);
console.log(`Started at: ${formatDate(new Date())}`);

function main() {
    console.log('Running main application...');
    console.log('All systems operational!');
}

if (require.main === module) {
    main();
}

module.exports = { main };
EOF

mkdir -p src

cat > src/config.js << 'EOF'
module.exports = {
    config: {
        name: 'Test Application',
        version: '1.0.0',
        environment: 'test',
        debug: true
    }
};
EOF

cat > src/utils.js << 'EOF'
function formatDate(date) {
    return date.toISOString();
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    formatDate,
    delay
};
EOF

cat > .gitignore << 'EOF'
node_modules/
.env
.DS_Store
*.log
dist/
build/
EOF

log_success "Test files created"

# Show file structure
log_info "File structure:"
find . -name '.bit' -prune -o -type f -print | sed 's|^\./||' | sort | sed 's/^/  /'

# Stage files
log_info "Staging files..."
node "$CLI_PATH" add .
log_success "Files staged"

# Show status
log_info "Repository status:"
node "$CLI_PATH" status

# Create first commit
log_info "Creating initial commit..."
node "$CLI_PATH" commit -m "Initial commit: Add project structure and test files"
log_success "Initial commit created"

# Show log
log_info "Commit history:"
node "$CLI_PATH" log

# Push to remote
log_info "Pushing to remote repository..."
node "$CLI_PATH" push-remote origin refs/heads/main
log_success "Push completed successfully!"

echo ""
log_success "======================================"
log_success "TEST COMPLETED SUCCESSFULLY!"
log_success "======================================"
echo ""
log_info "Next steps:"
echo "  1. Check your Hub to verify files appear"
echo "  2. Try cloning the repository:"
echo "     node $CLI_PATH clone-remote '$SUPABASE_URL' '$REPO_ID' test-clone"
echo "  3. Make changes and push again to test updates"
echo ""

# Test making a second commit
log_info "Creating second commit to test update..."

echo "" >> README.md
echo "## Update $(date)" >> README.md
echo "" >> README.md
echo "This line was added in a second commit to test incremental pushes." >> README.md

cat > src/features.js << 'EOF'
module.exports = {
    features: {
        authentication: true,
        fileUpload: true,
        remoteSync: true
    }
};
EOF

node "$CLI_PATH" add .
node "$CLI_PATH" commit -m "Add features configuration and update README"
log_success "Second commit created"

log_info "Pushing second commit..."
node "$CLI_PATH" push-remote
log_success "Second push completed!"

echo ""
log_success "======================================"
log_success "ALL TESTS PASSED!"
log_success "======================================"
echo ""
log_info "Repository ID: $REPO_ID"
log_info "Total commits: 2"
log_info "Files: 7 (README.md, app.js, .gitignore, src/config.js, src/utils.js, src/features.js)"
echo ""
log_info "Check your Hub to see both commits and all files!"
