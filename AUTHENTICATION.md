# Authentication Guide

## TL;DR

**Yes, you just use the access token!** It's your Supabase Auth JWT token, and you have two simple ways to use it:

```bash
# Option 1: Environment variable (temporary)
export BIT_TOKEN="your-access-token"
bit push-remote

# Option 2: Login command (saves permanently)
bit login "your-access-token"
bit push-remote
```

Both work exactly the same way. Choose what's convenient for you!

---

## What is the Access Token?

The **access token** is a JWT (JSON Web Token) issued by Supabase Auth when you log in to the Hub. It contains:

- Your user ID
- Your email
- Expiration time
- Cryptographic signature

This token proves you are who you say you are when making API requests.

---

## How to Get Your Access Token

### Method 1: From Hub Settings (Easiest!) ⭐

1. Log in to your Hub web interface
2. Click your profile/user menu
3. Go to **Settings**
4. Scroll down to **Developer Settings**
5. Click the **Copy** button next to "Access Token"
6. Done! ✅

### Method 2: Browser Console (Alternative)

1. Open your Hub in browser
2. Open DevTools (F12)
3. Go to Console tab
4. Paste and run:
   ```javascript
   const {
     data: { session },
   } = await supabase.auth.getSession();
   console.log(session.access_token);
   ```
5. Copy the output token

---

## How to Use the Access Token

### Option 1: Environment Variable (Recommended for Testing)

**Pros:**

- ✅ Quick and easy
- ✅ No files modified on disk
- ✅ Good for trying things out
- ✅ Separate tokens per terminal session

**Cons:**

- ❌ Need to export in each new terminal
- ❌ Lost when terminal closes

**Usage:**

```bash
# Set the token
export BIT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Verify
bit whoami

# Now all commands work
bit push-remote
bit pull-remote
```

**When to use:**

- Testing the CLI
- Temporary access
- Using different accounts in different terminals

---

### Option 2: Login Command (Recommended for Daily Use)

**Pros:**

- ✅ Token saved permanently
- ✅ Works across all terminals
- ✅ Don't need to re-login each time
- ✅ One-time setup

**Cons:**

- ❌ Stored in plain text at `~/.bit/token`
- ❌ Need to login again if token expires

**Usage:**

```bash
# Login once
bit login "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Verify
bit whoami

# Now works in any terminal, any time
bit push-remote
bit pull-remote
```

**When to use:**

- Daily development work
- Single user machine
- You want convenience

---

## Token Priority

The CLI checks for tokens in this order:

1. **`BIT_TOKEN` environment variable** (highest priority)
2. **`~/.bit/token` file** (from `bit login`)

If both are set, the environment variable wins. This lets you override the saved token temporarily.

---

## Token Security

### ⚠️ Important Security Notes:

1. **Don't commit tokens to git**

   ```bash
   # Add to .gitignore
   echo ".bit/token" >> ~/.gitignore
   ```

2. **Don't share tokens publicly**

   - Tokens grant full access to your account
   - Anyone with your token can push/pull repos

3. **Tokens expire**

   - Supabase tokens typically expire after a set time
   - You'll get "Unauthorized" errors when expired
   - Just get a new token from Settings

4. **Regenerate if compromised**
   - If you accidentally expose your token, log out and log back in to the Hub
   - This generates a new token and invalidates the old one

---

## FAQ

### Q: Is this the same as a GitHub Personal Access Token?

**A:** Conceptually yes! It works the same way:

- GitHub: Personal Access Token for CLI/API
- Bucket: Supabase Auth Token for CLI/API

### Q: Can I use both environment variable AND login command?

**A:** Yes! The environment variable takes priority if both are set.

### Q: How long does the token last?

**A:** Depends on your Supabase Auth configuration. Typically:

- Access tokens: 1 hour
- Refresh happens automatically in the web Hub
- CLI needs new token when it expires

### Q: What if my token expires?

**A:** Just get a new one from Settings and run `bit login` again, or export the new token.

### Q: Can I see my token after saving it?

**A:** Yes, it's stored in plain text at `~/.bit/token`:

```bash
cat ~/.bit/token
```

### Q: Can I use different tokens for different projects?

**A:** Yes! Use environment variables:

```bash
# Project 1
cd ~/project1
export BIT_TOKEN="token-1"
bit push-remote

# Project 2
cd ~/project2
export BIT_TOKEN="token-2"
bit push-remote
```

### Q: Is there a way to refresh the token automatically?

**A:** Not currently in the CLI. The web Hub handles token refresh automatically, but the CLI is stateless and only uses the token you provide.

---

## Examples

### Quick Test

```bash
# Get token from Settings → Developer Settings
export BIT_TOKEN="eyJhbG..."

# Test authentication
bit whoami

# Make a commit and push
bit add .
bit commit -m "Test"
bit push-remote
```

### Daily Development Setup

```bash
# One-time setup
bit login "eyJhbG..."

# Now works forever (until token expires)
cd ~/project1
bit push-remote

cd ~/project2
bit push-remote
```

### Multiple Accounts

```bash
# Account 1 (saved)
bit login "token-for-account-1"

# Use account 2 temporarily
export BIT_TOKEN="token-for-account-2"
bit push-remote  # Uses account 2

# Clear env var to go back to account 1
unset BIT_TOKEN
bit push-remote  # Uses account 1
```

---

## Summary

| Method               | Setup                    | Persistence              | Use Case           |
| -------------------- | ------------------------ | ------------------------ | ------------------ |
| Environment Variable | `export BIT_TOKEN="..."` | Current terminal only    | Testing, temporary |
| Login Command        | `bit login "..."`        | All terminals, permanent | Daily development  |

**Recommendation:**

- Start with **environment variable** to test
- Switch to **login command** for regular use

Both use the exact same access token from Hub Settings!

---

## Next Steps

1. Get your token: **Hub → Settings → Developer Settings → Copy**
2. Choose your method: `export BIT_TOKEN="..."` or `bit login "..."`
3. Verify: `bit whoami`
4. Start pushing: `bit push-remote`

That's it! 🚀
