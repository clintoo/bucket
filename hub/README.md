# BitHub Lite

A lightweight, GitHub-inspired web application for managing git repositories, built as a learning project to understand how Git works under the hood.

## Overview

BitHub Lite is a modern web-based repository management platform that provides core version control features in a clean, user-friendly interface. Users can create repositories, upload and manage files, star their favorite projects, and collaborate through a GitHub-like experience.

## Core Features

### Repository Management
- **Create Repositories**: Initialize new repositories with names and descriptions
- **Repository Dashboard**: View all your repositories with last updated timestamps
- **Repository Settings**: Configure repository properties including name, description, and default branch
- **Public Access**: All repositories are publicly accessible for viewing

### File Management
- **File Upload**: Upload both text and binary files to your repositories
- **File Viewer**: Browse and view file contents directly in the browser
- **Binary File Support**: Handle binary files with download capabilities
- **README Rendering**: Automatic markdown rendering for README.md files

### User Features
- **User Authentication**: Secure sign-up and login powered by Supabase Auth
- **User Profiles**: Customizable profiles with username, bio, and avatar
- **Repository Starring**: Star repositories you find interesting
- **Starred Repository Feed**: View all repositories you've starred in one place

### UI/UX
- **Dark/Light Theme**: Toggle between dark and light mode
- **Responsive Design**: Fully responsive interface that works on all devices
- **Modern Components**: Built with shadcn-ui for a polished, accessible experience
- **Real-time Updates**: Instant feedback and updates across the application

## Technology Stack

**Frontend:**
- **React 18** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first styling
- **shadcn-ui** - High-quality component library
- **Radix UI** - Accessible component primitives
- **TanStack Query** - Data fetching and caching
- **React Markdown** - Markdown rendering

**Backend:**
- **Supabase** - Backend-as-a-Service platform
  - PostgreSQL database
  - Authentication and authorization
  - Row Level Security (RLS) policies
  - File storage for avatars and repository files
  - Edge functions for serverless operations

**Database Schema:**
- `profiles` - User profiles with username, bio, and avatar
- `repositories` - Repository metadata and ownership
- `files` - File storage with support for text and binary content
- `stars` - Repository starring relationships

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or bun package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/clintoo/bithub-lite.git
cd bithub-lite
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file with your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
bithub-lite/
├── src/
│   ├── components/      # Reusable UI components
│   ├── contexts/        # React contexts (theme, etc.)
│   ├── hooks/           # Custom React hooks
│   ├── integrations/    # Third-party integrations (Supabase)
│   ├── lib/             # Utility functions
│   ├── pages/           # Page components
│   │   ├── Auth.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Profile.tsx
│   │   ├── Repository.tsx
│   │   └── Settings.tsx
│   ├── App.tsx          # Main application component
│   └── main.tsx         # Application entry point
├── supabase/
│   ├── functions/       # Edge functions
│   └── migrations/      # Database migrations
└── public/              # Static assets

```

## Learning Goals

This project was created to explore and understand:
- How Git works internally (object storage, commits, branches)
- Building a full-stack application with modern React
- Implementing authentication and authorization
- Working with a Backend-as-a-Service (BaaS) platform
- Creating a responsive, accessible UI with shadcn-ui
- Managing file uploads and storage
- Implementing social features (stars, profiles)

## License

This project is open source and available for educational purposes.
