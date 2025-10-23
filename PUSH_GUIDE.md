# Guide: Pushing Code to Remote Repository

This guide shows you how to push code to your remote repository using the `bit` CLI, just like with Git.

## Prerequisites

1. **Authentication Token**: Get your JWT token from the Hub
2. **Repository Created**: Create a repository in the Hub web interface
3. **CLI Installed**: Have the `bit` CLI ready

## Step-by-Step Example

### 1. Get Your Authentication Token

The access token is your authentication key for the CLI. Here's the easiest way to get it:

**Easiest Method: From Hub Settings** ⭐

1. Log in to your Hub web interface
2. Go to **Settings** (user menu → Settings)
3. Scroll to **Developer Settings**
4. Click the **Copy** button next to "Access Token"

**Alternative: Browser Console**

```javascript
// Open browser console (F12) on your Hub
const {
  data: { session },
} = await supabase.auth.getSession();
console.log(session.access_token);
```

**Note:** This is your Supabase Auth access token (JWT). It's the same token used for all API authentication.

### 2. Set Up Authentication

Choose one of these methods:

**Method 1: Environment Variable (Temporary)** 🔄

```bash
export BIT_TOKEN="YOUR_ACCESS_TOKEN"
node /workspaces/bucket/cli/index.js whoami
# Token is active for this terminal session only
```

**Method 2: Login Command (Permanent)** 💾

```bash
# Saves token to ~/.bit/token
node /workspaces/bucket/cli/index.js login YOUR_ACCESS_TOKEN
node /workspaces/bucket/cli/index.js whoami
# Token persists across terminal sessions
```

Verify authentication:

```bash
node /workspaces/bucket/cli/index.js whoami
# Should show: Logged in as: your-email@example.com
```

**Which method should I use?**

- Use **Method 1** (env variable) for quick testing or temporary access
- Use **Method 2** (login command) for regular daily use
- Both methods work exactly the same way!

### 3. Create a Repository in the Hub

1. Go to your Hub web interface (http://localhost:5173 or your deployed URL)
2. Click "New Repository"
3. Fill in:
   - Name: e.g., "my-project"
   - Description: e.g., "My awesome project"
4. Click "Create Repository"
5. **Important**: Copy the Repository ID (UUID) from the URL or settings page
   - URL format: `https://your-hub.com/repo/YOUR_REPO_ID`

### 4. Create or Navigate to Your Local Project

```bash
# Create a new project
mkdir ~/my-project
cd ~/my-project

# Or use an existing project
cd ~/path/to/your/project
```

### 5. Initialize Bit Repository

```bash
node /workspaces/bucket/cli/index.js init

# Or if you've linked the CLI globally:
bit init
```

### 6. Add Your Remote

```bash
# Replace with your values:
# - REMOTE_NAME: typically "origin"
# - SUPABASE_URL: your Supabase project URL
# - REPO_ID: the UUID from step 3

node /workspaces/bucket/cli/index.js remote add origin \
  https://YOUR_PROJECT.supabase.co/functions/v1/bit-objects \
  YOUR_REPO_ID

# Example:
node /workspaces/bucket/cli/index.js remote add origin \
  https://xejcpvimktcxcvowbhom.supabase.co/functions/v1/bit-objects \
  550e8400-e29b-41d4-a716-446655440000
```

Verify remote:

```bash
node /workspaces/bucket/cli/index.js remote -v
# Should show: origin https://your-project.supabase.co/... (repo: uuid)
```

### 7. Stage and Commit Your Files

```bash
# Create some files
echo "# My Project" > README.md
echo "console.log('Hello World')" > app.js
mkdir src
echo "export const version = '1.0.0'" > src/config.js

# Stage all files
node /workspaces/bucket/cli/index.js add .

# Check status
node /workspaces/bucket/cli/index.js status

# Commit
node /workspaces/bucket/cli/index.js commit -m "Initial commit"

# View history
node /workspaces/bucket/cli/index.js log
```

### 8. Push to Remote

```bash
# Push to the remote repository
node /workspaces/bucket/cli/index.js push-remote origin refs/heads/main

# Or simply:
node /workspaces/bucket/cli/index.js push-remote
# (defaults to "origin" and current branch)
```

You should see output like:

```
Pushing refs/heads/main to origin...
Uploading 4 object(s)...
Updating ref refs/heads/main...
Push complete!
```

### 9. Verify in the Hub

1. Go to your Hub web interface
2. Navigate to your repository
3. You should see:
   - Your files listed
   - README.md rendered
   - Commit information
   - Branch information

## Making Additional Changes

After the initial push, you can continue working:

```bash
# Make changes
echo "console.log('Updated')" > app.js
echo "New feature" > feature.js

# Stage changes
node /workspaces/bucket/cli/index.js add .

# Commit
node /workspaces/bucket/cli/index.js commit -m "Add new feature"

# Push
node /workspaces/bucket/cli/index.js push-remote

# Output: "Everything up-to-date" or "Uploading X object(s)..."
```

## Common Commands Summary

```bash
# Authentication
bit login <token>              # Save auth token
bit whoami                     # Check authentication status

# Remote management
bit remote add <name> <url> <repoId>   # Add remote
bit remote list                        # List remotes
bit remote -v                          # List with details
bit remote get-url <name>              # Get remote URL

# Basic workflow
bit init                       # Initialize repo
bit add <path>                 # Stage files
bit commit -m "message"        # Create commit
bit status                     # Check status
bit log                        # View history
bit diff [path]               # View changes

# Remote operations
bit push-remote [remote] [branch]     # Push to remote
bit pull-remote [remote] [branch]     # Pull from remote
bit clone-remote <url> <repoId> [dir] # Clone from remote
```

## Troubleshooting

### "Not authenticated" Error

```bash
# Check authentication
bit whoami

# If not logged in, login again
bit login YOUR_JWT_TOKEN

# Or set environment variable
export BIT_TOKEN="YOUR_JWT_TOKEN"
```

### "Repo not found" Error

- Verify the repository exists in the Hub
- Check that the repo ID is correct
- Ensure you're the owner of the repository

### "Forbidden" Error

- Make sure you're authenticated with the correct account
- Verify you're the owner of the repository (for now, only the owner can push)
- Check that your JWT token hasn't expired

If you previously saw a "row-level security policy" error during push, this is now returned as a clearer "Forbidden" error. To fix:

1. Re-copy your Access Token from Hub → Settings → Developer Settings
2. Ensure you're logged in as the repository's owner
3. Run:

```bash
bit login YOUR_JWT_TOKEN
bit whoami
# confirm the email matches the repo owner

# retry push
bit push-remote origin refs/heads/main
```

Note: Collaborator write access is coming soon. Until then, only the repo owner can push.

### "CAS_FAILED" Error

This means someone else pushed to the same branch. Pull first:

```bash
bit pull-remote origin refs/heads/main
# Then push again
bit push-remote origin refs/heads/main
```

### Token Expired

JWT tokens expire after a certain time. Get a new token from the Hub:

1. Log out and log back in to the Hub
2. Get the new token
3. Run `bit login NEW_TOKEN`

## Full Example Script

Here's a complete script you can run:

```bash
#!/bin/bash

# Configuration
REPO_NAME="my-test-project"
SUPABASE_URL="https://your-project.supabase.co/functions/v1/bit-objects"
REPO_ID="your-repo-uuid"
JWT_TOKEN="your-jwt-token"

# Create project directory
mkdir -p ~/test-projects/$REPO_NAME
cd ~/test-projects/$REPO_NAME

# Initialize bit repo
bit init

# Authenticate
bit login "$JWT_TOKEN"

# Add remote
bit remote add origin "$SUPABASE_URL" "$REPO_ID"

# Create files
cat > README.md << 'EOF'
# My Test Project

This is a test project pushed via the bit CLI.

## Features
- Feature 1
- Feature 2
EOF

cat > app.js << 'EOF'
console.log('Hello from bit!');

function main() {
  console.log('Application started');
}

main();
EOF

mkdir src
cat > src/config.js << 'EOF'
export const config = {
  version: '1.0.0',
  name: 'My Test Project'
};
EOF

# Stage and commit
bit add .
bit commit -m "Initial commit: Add README and basic app structure"

# Push to remote
bit push-remote origin refs/heads/main

echo "Push complete! Check your Hub to see the files."
```

## Next Steps

- Clone the repository from another location using `bit clone-remote`
- Try pushing from multiple clones to test CAS conflict resolution
- Experiment with branches (once branch support is added)
- Upload files via the web UI and pull them to your local repo

## Tips

1. **Always commit before pushing**: Uncommitted changes won't be pushed
2. **Check status regularly**: Use `bit status` to see what's staged
3. **View history**: Use `bit log` to see your commits before pushing
4. **Test locally first**: Use `bit clone` and `bit push` to test with local repos before pushing to remote
5. **Keep token secure**: Don't commit your JWT token to any repository

Enjoy using your Git-like version control system!
