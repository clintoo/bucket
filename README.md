# Bucket - A Complete Git & GitHub Clone

A full-featured implementation of Git version control and GitHub-style repository hosting, built from scratch as an educational project to deeply understand how distributed version control systems work.

## 📋 Table of Contents

- [Overview](#overview)
- [Project Architecture](#project-architecture)
- [CLI Tool - "bit"](#cli-tool---bit)
  - [Core Git Operations](#core-git-operations)
  - [Remote Operations](#remote-operations)
  - [Installation & Usage](#installation--usage)
- [Web Hub - "BitHub Lite"](#web-hub---bithub-lite)
  - [Features](#features)
  - [Technology Stack](#technology-stack)
  - [Getting Started](#getting-started)
- [How It Works](#how-it-works)
  - [Object Storage](#object-storage)
  - [Commit Structure](#commit-structure)
  - [Remote Synchronization](#remote-synchronization)
  - [Authentication & Authorization](#authentication--authorization)
- [Database Schema](#database-schema)
- [API Architecture](#api-architecture)
- [Development](#development)
- [Learning Objectives](#learning-objectives)
- [License](#license)

---

## Overview

**Bucket** is a comprehensive reimplementation of Git and GitHub from the ground up, consisting of two main components:

1. **CLI Tool (`bit`)** - A command-line version control system that mimics Git's core functionality
2. **Web Hub (`hub/`)** - A web-based repository hosting platform similar to GitHub

This project demonstrates a deep understanding of:
- Content-addressable storage using SHA-1 hashing
- Directed acyclic graph (DAG) structures for commit history
- Tree and blob object models
- Remote synchronization protocols
- Modern full-stack web development
- Authentication and authorization patterns

---

## Project Architecture

```
bucket/
├── cli/                          # Command-line Git clone
│   ├── index.js                  # Main CLI entry point with command routing
│   ├── commands/                 # Individual command implementations
│   │   ├── init.js              # Initialize repository
│   │   ├── add.js               # Stage files
│   │   ├── commit.js            # Create commits
│   │   ├── status.js            # Show working tree status
│   │   ├── log.js               # Display commit history
│   │   ├── diff.js              # Show changes
│   │   ├── clone.js             # Clone local repository
│   │   ├── push.js              # Push to local repository
│   │   ├── pull.js              # Pull from local repository
│   │   ├── merge.js             # Fast-forward merge
│   │   ├── rm.js                # Remove files
│   │   ├── mv.js                # Move/rename files
│   │   ├── restore.js           # Restore files from index
│   │   ├── remote.js            # Manage remote repositories
│   │   ├── login.js             # Authenticate with remote
│   │   ├── push-remote.js       # Push to remote server
│   │   ├── pull-remote.js       # Pull from remote server
│   │   └── clone-remote.js      # Clone from remote server
│   └── lib/                      # Core library modules
│       ├── repo.js              # Repository operations (HEAD, refs, index)
│       ├── objects.js           # Object storage (hash, get, save)
│       ├── files.js             # File system utilities
│       ├── config.js            # Configuration management
│       ├── remote.js            # Remote communication (HTTP/REST)
│       └── utils.js             # Utility functions
│
├── hub/                          # Web application (GitHub clone)
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── pages/               # Page components
│   │   │   ├── Auth.tsx         # Authentication page
│   │   │   ├── Dashboard.tsx    # User dashboard
│   │   │   ├── Repository.tsx   # Repository viewer
│   │   │   ├── Profile.tsx      # User profile
│   │   │   └── Settings.tsx     # Repository settings
│   │   ├── integrations/        # Supabase integration
│   │   └── lib/                 # Utilities
│   ├── supabase/
│   │   ├── functions/           # Edge Functions (API endpoints)
│   │   │   ├── bit-objects/     # Object storage API
│   │   │   ├── bit-refs/        # References API
│   │   │   ├── bit-repos/       # Repository management API
│   │   │   └── upload-file/     # File upload handler
│   │   └── migrations/          # Database schema migrations
│   └── public/                  # Static assets
│
├── package.json                  # CLI package configuration
└── test-cli-remote.sh           # Integration test script
```

---

## CLI Tool - "bit"

The `bit` CLI is a functional Git clone implemented in Node.js that provides all essential version control operations.

### Core Git Operations

#### Repository Management
```bash
bit init [--path <path>] [--branch <name>]
```
Initialize a new repository with a `.bit` directory containing:
- `objects/` - Content-addressable object store (commits and blobs)
- `refs/heads/` - Branch references
- `HEAD` - Current branch pointer
- `index` - Staging area (JSON file mapping paths to blob hashes)

#### Staging & Committing
```bash
bit add <path>              # Stage files (supports directories, globs)
bit rm <path>               # Remove files from working tree and index
bit mv <src> <dst>          # Move/rename files
bit status                  # Show working tree status
bit commit -m "message"     # Create a commit from staged changes
bit commit --allow-empty    # Create commit even with no changes
```

The staging process:
1. Reads file content as a Buffer (binary-safe)
2. Computes SHA-1 hash of content
3. Stores blob in `objects/xx/yyyyyy...` (2-char fanout directory)
4. Updates index JSON with `{ "path/to/file": "hash" }`

#### History & Inspection
```bash
bit log                     # Show commit history (reverse chronological)
bit diff [path]            # Show unstaged changes
bit restore <path>         # Restore file from index
```

#### Local Collaboration
```bash
bit clone <src> <dest>     # Copy repository to new location
bit push <dest>            # Push objects and refs to another local repo
bit pull <src>             # Pull objects and refs from another local repo
bit merge <commit>         # Fast-forward merge to specified commit
```

### Remote Operations

The CLI supports pushing/pulling to a remote server (the Hub):

#### Authentication
```bash
bit login <token>          # Save JWT token for authentication
bit whoami                 # Display current authentication status
```

The token is stored in `~/.bit/token` and can also be set via `BIT_TOKEN` environment variable.

#### Remote Management
```bash
bit remote add <name> <url> <repoId>  # Register a remote
bit remote list                        # List configured remotes
bit remote get-url <name>              # Get remote URL
```

Configuration is stored in `.bit/config` as JSON:
```json
{
  "remotes": {
    "origin": {
      "url": "https://api.example.com/functions/v1/bit-objects",
      "repoId": "uuid-of-repo"
    }
  }
}
```

#### Synchronization
```bash
bit push-remote [remote] [branch]     # Push commits to remote server
bit pull-remote [remote] [branch]     # Pull commits from remote server
bit clone-remote <url> <repoId> [dir] # Clone from remote server
```

**Push Process:**
1. Reads local HEAD to determine current commit
2. Fetches remote refs to find what's already pushed
3. Walks commit history backward, collecting all commits and blobs not on remote
4. Uploads objects in topological order (oldest first)
5. Updates remote ref using Compare-and-Swap (CAS) for conflict prevention

**Pull Process:**
1. Fetches remote refs to find latest commit
2. Downloads all missing objects from remote
3. Writes objects to local `.bit/objects/`
4. Fast-forward merges local ref to remote commit

### Installation & Usage

**Prerequisites:**
- Node.js 18+ (supports ES modules and async/await)
- npm or similar package manager

**Install Dependencies:**
```bash
npm install
```

**Link CLI Globally (Optional):**
```bash
npm link
```

Now you can use `bit` command anywhere:
```bash
bit init
echo "console.log('Hello')" > app.js
bit add app.js
bit commit -m "Initial commit"
bit log
```

**Without Linking:**
```bash
node cli/index.js init
node cli/index.js add .
node cli/index.js commit -m "Initial commit"
```

---

## Web Hub - "BitHub Lite"

The Hub is a modern web application that provides a GitHub-like interface for managing repositories, complete with user authentication, file browsing, and social features.

### Features

#### 🔐 User Management
- **Authentication**: Email/password signup and login via Supabase Auth
- **User Profiles**: Customizable username, bio, and avatar
- **Profile Pages**: Public profile pages showing user's repositories

#### 📦 Repository Management
- **Create Repositories**: Initialize new repositories with name and description
- **Repository Dashboard**: View all repositories with metadata
- **Repository Settings**: Configure name, description, default branch, visibility
- **Repository Viewer**: Browse repository contents and file tree
- **File Operations**: Upload files (text and binary), view file contents, download files
- **README Rendering**: Automatic markdown rendering for README.md files

#### ⭐ Social Features
- **Star Repositories**: Bookmark interesting repositories
- **Starred Feed**: View all starred repositories in one place
- **Public Discovery**: Browse public repositories from other users

#### 🎨 User Experience
- **Dark/Light Mode**: Toggle between themes with persistent preference
- **Responsive Design**: Mobile-friendly interface
- **Real-time Updates**: Instant feedback using React Query for caching
- **Accessible Components**: Built with Radix UI primitives for WCAG compliance

### Technology Stack

**Frontend Framework & Tools:**
- **React 18** - Modern UI library with concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool and dev server (HMR, ESM)
- **React Router v6** - Client-side routing with data loading

**UI Components & Styling:**
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality component library built on Radix UI
- **Radix UI** - Unstyled, accessible component primitives
- **Lucide Icons** - Beautiful icon set
- **next-themes** - Theme management (dark/light mode)

**State Management & Data Fetching:**
- **TanStack Query (React Query)** - Async state management, caching, and synchronization
- **React Hook Form** - Performant form handling with validation
- **Zod** - TypeScript-first schema validation

**Backend & Database:**
- **Supabase** - Backend-as-a-Service (BaaS) platform
  - PostgreSQL database with Row Level Security (RLS)
  - Authentication with JWT tokens
  - Storage buckets for file uploads
  - Edge Functions (Deno-based serverless functions)
  - Real-time subscriptions

**Supabase Edge Functions (API Endpoints):**
- `bit-objects` - Handle GET/PUT/HEAD operations for Git objects
- `bit-refs` - Manage branch references with CAS
- `bit-repos` - Repository CRUD operations
- `upload-file` - Handle file uploads to repositories

### Getting Started

**Prerequisites:**
- Node.js 18+
- Supabase account (free tier available)

**1. Clone Repository:**
```bash
git clone https://github.com/clintoo/bucket.git
cd bucket/hub
```

**2. Install Dependencies:**
```bash
npm install
```

**3. Set Up Supabase:**

Create a new Supabase project at https://supabase.com and note:
- Project URL
- Anon/Public API Key

**4. Configure Environment:**

Create `hub/.env` file:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**5. Run Database Migrations:**

The migrations in `hub/supabase/migrations/` set up:
- `profiles` table - User profiles
- `repositories` table - Repository metadata
- `files` table - File storage
- `stars` table - Repository stars
- `repos` table - Remote repository metadata
- `refs` table - Branch references
- Storage bucket for objects

Apply these via Supabase Dashboard or CLI.

**6. Start Development Server:**
```bash
npm run dev
```

Visit `http://localhost:5173`

**Available Scripts:**
- `npm run dev` - Start dev server (Vite)
- `npm run build` - Production build
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

---

## How It Works

### Object Storage

The system uses **content-addressable storage** where every object is identified by its SHA-1 hash (40 hex characters).

**Storage Layout:**
```
.bit/objects/
├── ab/
│   ├── cdef0123456789... (blob object)
│   └── 12345678901234... (commit object)
├── cd/
│   └── ef0123456789ab... (another object)
...
```

The 2-character fanout directory reduces filesystem strain and improves lookup performance.

**Object Types:**

1. **Blob Objects** - File contents (text or binary)
   - Stored as raw bytes
   - Hash computed from content directly
   - Binary-safe using Node.js Buffers

2. **Commit Objects** - Snapshots of the repository state
   - Stored as JSON
   - Contains metadata and tree (mapping of paths to blob hashes)

### Commit Structure

Each commit is a JSON object with this structure:

```json
{
  "message": "Add authentication system",
  "timestamp": "2025-10-22T18:12:00.000Z",
  "parent": "abc123def456...",  // null for first commit
  "tree": {
    "src/auth.js": "blob-hash-1",
    "src/utils.js": "blob-hash-2",
    "README.md": "blob-hash-3"
  },
  "author": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "committer": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

The commit is serialized to JSON, hashed, and stored just like a blob. The hash becomes the commit ID.

**Commit Graph:**
```
main: abc123 -> def456 -> 789ghi
               ↑
             parent
```

Each commit points to its parent, forming a directed acyclic graph (DAG).

### Remote Synchronization

Communication between CLI and Hub uses HTTP REST API with JWT authentication.

**API Endpoints:**

1. **Object Storage API** (`bit-objects` function)
   - `HEAD /repos/:repoId/objects/:hash` - Check if object exists
   - `GET /repos/:repoId/objects/:hash` - Download object
   - `PUT /repos/:repoId/objects/:hash` - Upload object

2. **References API** (`bit-refs` function)
   - `GET /repos/:repoId/refs` - List all refs
   - `PUT /repos/:repoId/refs/:name` - Update ref with CAS

**Push Algorithm:**
```
1. Authenticate with JWT token
2. Get remote refs to determine what's already pushed
3. Walk commit history from HEAD back to common ancestor:
   - For each commit:
     - Check if remote has it (HEAD request)
     - If not, add to upload queue
     - Add all tree blobs to upload queue
4. Upload objects in reverse order (oldest first)
5. Update remote ref using Compare-and-Swap:
   - Send old hash and new hash
   - Server verifies old hash matches current
   - Prevents race conditions in concurrent pushes
```

**Pull Algorithm:**
```
1. Authenticate with JWT token
2. Get remote refs to find target commit
3. Walk commit history from remote commit:
   - For each commit:
     - Check if local repo has it
     - If not, download and store
     - Download all tree blobs
4. Fast-forward local ref to remote commit
```

### Authentication & Authorization

**JWT-Based Authentication:**
1. User signs up/logs in via Supabase Auth
2. Receives JWT token with claims:
   ```json
   {
     "sub": "user-uuid",
     "email": "user@example.com",
     "exp": 1729624320
   }
   ```
3. CLI stores token in `~/.bit/token` or `BIT_TOKEN` env var
4. Every API request includes `Authorization: Bearer <token>`

**Authorization Rules (Row Level Security):**

Database policies enforce:
- Users can only create/modify their own repositories
- Commit author email must match authenticated user
- Public repositories are readable by anyone
- Private repositories only visible to owner
- Stars can be created/deleted by authenticated users

**Edge Function Validation:**
```typescript
// Extract user from token
const { data: { user }, error } = await supabase.auth.getUser();

// Verify repo ownership for mutations
if (repo.owner_id !== user.id) {
  return new Response("Forbidden", { status: 403 });
}

// Validate commit authorship
if (commit.author.email !== user.email) {
  return new Response("Author mismatch", { status: 403 });
}
```

---

## Database Schema

The Hub uses PostgreSQL via Supabase with these main tables:

### `profiles`
Stores user profile information.
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `repositories`
Repository metadata for the web UI.
```sql
CREATE TABLE repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  default_branch TEXT DEFAULT 'main',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, name)
);
```

### `files`
File storage for repository contents (used by web UI).
```sql
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT,
  is_binary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repo_id, path)
);
```

### `stars`
Many-to-many relationship for starred repositories.
```sql
CREATE TABLE stars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  repo_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, repo_id)
);
```

### `repos`
Backend repository metadata for CLI push/pull operations.
```sql
CREATE TABLE repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `refs`
Branch references for CLI operations.
```sql
CREATE TABLE refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID REFERENCES repos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,  -- e.g., "refs/heads/main"
  hash TEXT NOT NULL,  -- commit hash (40 hex chars)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repo_id, name)
);
```

### Storage Buckets

**`bit-objects`** - Stores Git objects (commits and blobs)
- Path structure: `repos/:repoId/objects/:prefix/:hash`
- Example: `repos/abc-123/objects/ab/cdef0123456789...`

---

## API Architecture

The Hub exposes serverless Edge Functions (deployed on Deno) that implement a Git-compatible protocol:

### Object Storage API

**Endpoint:** `bit-objects` Edge Function

**Operations:**

1. **Check Object Existence**
   ```
   HEAD /repos/:repoId/objects/:hash
   Authorization: Bearer <token>
   
   Response: 200 OK (exists) or 404 Not Found
   ```

2. **Download Object**
   ```
   GET /repos/:repoId/objects/:hash
   Authorization: Bearer <token>
   
   Response: 200 OK
   Content-Type: application/octet-stream
   Body: <object-data>
   ```

3. **Upload Object**
   ```
   PUT /repos/:repoId/objects/:hash
   Authorization: Bearer <token>
   Content-Type: application/octet-stream
   Body: <object-data>
   
   Response: 200 OK
   Body: {"ok": true}
   ```

   Validation:
   - Verifies hash format (40 hex chars)
   - Checks repository ownership
   - Validates commit author email matches authenticated user
   - Stores in Supabase Storage bucket

### References API

**Endpoint:** `bit-refs` Edge Function

**Operations:**

1. **List References**
   ```
   GET /repos/:repoId/refs
   Authorization: Bearer <token>
   
   Response: 200 OK
   Body: [
     {"name": "refs/heads/main", "hash": "abc123..."},
     {"name": "refs/heads/dev", "hash": "def456..."}
   ]
   ```

2. **Update Reference (with CAS)**
   ```
   PUT /repos/:repoId/refs/:refName
   Authorization: Bearer <token>
   Body: {
     "oldHash": "abc123...",  // null for new refs
     "newHash": "def456..."
   }
   
   Response: 200 OK
   Body: {"ok": true}
   
   Error: 409 Conflict (CAS failed - someone else updated ref)
   ```

   Compare-and-Swap (CAS) ensures atomic updates:
   ```sql
   UPDATE refs 
   SET hash = :newHash, updated_at = NOW()
   WHERE repo_id = :repoId 
     AND name = :refName 
     AND hash = :oldHash;
   ```

---

## Development

### Running the Full Stack

**Terminal 1 - Hub (Web UI):**
```bash
cd hub
npm install
npm run dev
# Runs on http://localhost:5173
```

**Terminal 2 - Test CLI:**
```bash
# Create a test repository
mkdir /tmp/test-repo
cd /tmp/test-repo
node /path/to/bucket/cli/index.js init

# Make some commits
echo "Hello" > file.txt
node /path/to/bucket/cli/index.js add file.txt
node /path/to/bucket/cli/index.js commit -m "Add file"

# Authenticate with Hub
export BIT_TOKEN="your-jwt-token-from-web-ui"

# Add remote (get repo ID from web UI)
node /path/to/bucket/cli/index.js remote add origin \
  https://your-project.supabase.co/functions/v1/bit-objects \
  your-repo-uuid

# Push to remote
node /path/to/bucket/cli/index.js push-remote origin refs/heads/main
```

### Integration Testing

The `test-cli-remote.sh` script provides end-to-end testing:

```bash
export BIT_TOKEN="your-token"
./test-cli-remote.sh your-repo-uuid
```

This script:
1. Creates a new test repository
2. Commits files
3. Pushes to remote
4. Clones to a new location
5. Verifies contents match

### Debugging

**CLI Debugging:**
- Check `.bit/` directory structure
- Inspect `.bit/index` (staged files JSON)
- View `.bit/objects/` contents
- Examine commit objects: `cat .bit/objects/ab/cdef...`

**Hub Debugging:**
- Use browser DevTools Network tab to inspect API calls
- Check Supabase Dashboard > Database > Table Editor
- View Edge Function logs in Supabase Dashboard > Edge Functions
- Use React DevTools to inspect component state

---

## Learning Objectives

This project was built to deeply understand:

### Version Control Internals
- ✅ **Content-Addressable Storage** - Why Git uses SHA-1 hashing and how it enables deduplication
- ✅ **Object Model** - The relationship between blobs, trees, and commits
- ✅ **DAG Structure** - How commit graphs enable branching and merging
- ✅ **Index/Staging Area** - Why Git has a three-stage workflow (working tree → index → commits)
- ✅ **References** - How branches and tags are just pointers to commits

### Distributed Systems
- ✅ **Remote Protocols** - Designing efficient sync protocols with minimal data transfer
- ✅ **Object Transfer** - Incremental push/pull by comparing object graphs
- ✅ **Compare-and-Swap** - Preventing race conditions in concurrent updates
- ✅ **Conflict Resolution** - Detecting diverged histories and handling fast-forward merges

### Full-Stack Web Development
- ✅ **Modern React Patterns** - Hooks, Context API, compound components
- ✅ **Type Safety** - TypeScript for catching errors at compile time
- ✅ **State Management** - React Query for server state, local state with hooks
- ✅ **Backend-as-a-Service** - Leveraging Supabase for rapid development
- ✅ **Edge Functions** - Serverless APIs with Deno runtime
- ✅ **Database Design** - Schema modeling with PostgreSQL, foreign keys, indexes
- ✅ **Row Level Security** - Database-level authorization with policies
- ✅ **File Storage** - Handling binary uploads with cloud storage

### Software Engineering Practices
- ✅ **CLI Design** - Building intuitive command-line interfaces with Commander.js
- ✅ **Error Handling** - Graceful degradation and helpful error messages
- ✅ **Code Organization** - Modular architecture with clear separation of concerns
- ✅ **API Design** - RESTful conventions, HTTP status codes, CORS
- ✅ **Testing** - Integration tests validating end-to-end workflows

---

## License

This project is open source and available for educational purposes. Feel free to study, modify, and learn from the code.

**Note:** This is an educational project. For production use, consider mature solutions like Git, Gitea, GitLab, or GitHub.

---

## Acknowledgments

Built with inspiration from:
- [Git Internals](https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain) - Understanding Git's architecture
- [Gitlet](http://gitlet.maryrosecook.com/) - A Git implementation in JavaScript
- [Building Git](https://shop.jcoglan.com/building-git/) - Comprehensive guide to implementing Git

**Created by:** [@clintoo](https://github.com/clintoo)

---

**Questions or issues?** Open an issue on GitHub or reach out via the repository discussions.
