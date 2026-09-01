# 🎬 MOVIRAE - Movie Social Network

> **A full-stack social platform for cinephiles** — featuring real-time collaboration, optimistic UI patterns, and seamless third-party API integration.

🌐 **[Live Demo: movirae.vercel.app](https://movirae.vercel.app/)** | Try it now!

## 🎯 Project Overview

MOVIRAE is a **production-ready social network** built with modern full-stack technologies. It demonstrates:

- 🏗️ **Scalable Architecture** - Optimistic operations pattern for instant UI feedback with server synchronization
- 🔄 **Real-time Features** - Server-Sent Events (SSE) for live notifications and activity feeds
- 🔐 **Enterprise Authentication** - Multi-provider auth (Email/Password + Google OAuth 2.0)
- 📡 **Third-party Integrations** - TMDB for movie data, WatchMode for streaming availability
- 🎨 **Modern Frontend** - TypeScript + React 18, fully accessible UI components
- 💾 **Data Persistence** - Prisma ORM with relational database design
- 🚀 **Developer Experience** - Type-safe API routes, automated migrations, linting

## 🌟 Key Highlights

| Feature | Technology | Impact |
|---------|-----------|--------|
| **Instant UI Feedback** | Optimistic Operations Pattern | Zero perceived latency for user actions |
| **Real-time Sync** | Server-Sent Events (SSE) | Live notifications without polling |
| **Social Discovery** | TMDB + WatchMode APIs | Access to 500K+ movies with streaming info |
| **Type Safety** | TypeScript + Prisma | Catch errors at compile time, not production |
| **Performance** | React Query + Next.js caching | Automatic cache invalidation & pagination |
| **Authentication** | NextAuth.js + OAuth | Industry-standard security patterns |

## 🏗️ System Architecture

### Application Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Application                      │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  React Components + TypeScript                          │ │
│ │  ├─ UI State (Tailwind CSS + shadcn/ui)               │ │
│ │  ├─ Server State (React Query)                        │ │
│ │  └─ Optimistic State (Custom Context Provider)        │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  API Routes (Next.js)                                       │
│  ├─ /api/auth/[...nextauth]   → NextAuth.js              │
│  ├─ /api/movies/*             → Prisma Queries           │
│  ├─ /api/reviews/*            → Business Logic + SSE     │
│  └─ /api/activity             → Real-time Stream (SSE)   │
├─────────────────────────────────────────────────────────────┤
│  External Services                                          │
│  ├─ TMDB API (Movie Data)    → via /lib/tmdb.ts          │
│  ├─ WatchMode API (Streaming) → via /lib/watchmode.ts    │
│  └─ Google OAuth (Auth)      → via NextAuth.js           │
├─────────────────────────────────────────────────────────────┤
│  Data Layer                                                 │
│  ├─ Prisma ORM                                            │
│  └─ PostgreSQL Database                                   │
└─────────────────────────────────────────────────────────────┘
```

### Optimistic Operations Pattern

The system implements an advanced **optimistic operations pattern** for maximum responsiveness:

```
User Action (e.g., Like Review)
    ↓
[1] UI updates immediately (optimistic)
[2] Request sent to API (background)
[3] API processes & responds
[4] Server broadcasts SSE event with operation ID
[5] Frontend reconciles state with server response
[6] ✅ Complete - UI perfectly in sync
```

**Benefits:**
- Zero perceived latency for user interactions
- Automatic rollback on failures
- Seamless server synchronization via SSE
- Excellent user experience

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Key Highlights](#-key-highlights)
- [System Architecture](#-system-architecture)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Core Patterns & Best Practices](#-core-patterns--best-practices)
- [External API Integrations](#-external-api-integrations)
- [Application API Endpoints](#-application-api-endpoints)
- [Database Schema](#-database-schema)
- [Code Quality & Best Practices](#-code-quality--best-practices)
- [Deployment](#-deployment)
- [Contributing](#-contributing)

## ✨ Features

### Core Social Features
- **User Profiles** - Customize your profile and showcase your movie taste
- **Movie Discovery** - Explore movies with advanced filtering and recommendations
- **Reviews & Ratings** - Share detailed reviews and rate movies with a 5-star system
- **Social Interactions** - Follow friends, like reviews, and engage with the community
- **Watch History & Watchlist** - Track what you've watched and plan what to watch next

### Community Features
- **Group Creation & Management** - Create groups with friends to discuss movies
- **Shared Lists** - Collaborate on curated movie lists with other users
- **Real-time Messaging** - Chat with friends about movies in real-time
- **Activity Feed** - See what your friends are watching and reviewing
- **Notifications** - Get notified about friend activities, reviews, and group updates

### Advanced Features
- **Movie Comparisons** - Compare movie statistics and details side-by-side
- **Recommendations** - Get personalized movie recommendations based on your taste
- **Streaming Information** - Find where movies are available to stream
- **Year Wrapped** - Annual summary of your movie watching stats
- **Optimistic Operations** - Instant UI feedback with server synchronization

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14+ (React 18+)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + PostCSS
- **UI Components**: shadcn/ui + Radix UI
- **State Management**: React Query + React Context (Optimistic Ops)
- **Forms**: React Hook Form + Zod validation
- **Authentication**: NextAuth.js
- **Real-time**: Server-Sent Events (SSE)

### Backend
- **Database**: Prisma ORM + PostgreSQL
- **API**: Next.js API Routes
- **Movie Data**: TMDB API integration
- **Authentication**: NextAuth.js with Prisma adapter

## 🚀 Getting Started

### 🌐 Try the Live Demo

👉 **[Visit movirae.vercel.app](https://movirae.vercel.app/)** to see the application in action!

### Installation

#### Prerequisites
- Node.js 18+ and npm/yarn
- PostgreSQL database
- TMDB API key (get one at [themoviedb.org](https://www.themoviedb.org/))

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd MOVIRAE
   ```

2. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the `frontend` directory:
   ```env
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/movirae

   # TMDB API
   TMDB_API_KEY=your_tmdb_api_key
   
   # WatchMode API (optional)
   WATCHMODE_API_KEY=your_watchmode_api_key
   
   # NextAuth.js
   NEXTAUTH_SECRET=your_secret_key
   NEXTAUTH_URL=http://localhost:3000
   
   # Google OAuth (optional)
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

4. **Set up the database**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.


## 💻 Development

### Available Scripts

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Linting
npm run lint

# Prisma commands
npm run prisma:generate    # Generate Prisma client
npm run prisma:migrate     # Run database migrations
```

## 🎯 Core Patterns & Best Practices

### Optimistic Operations Pattern
The app uses a **centralized optimistic operations system** for instant UI feedback:
- User actions update the UI immediately without waiting for server
- API requests are sent in the background asynchronously
- Server-Sent Events (SSE) synchronize the data in real-time
- Failed operations are rolled back gracefully with error handling
- Implementation: `hooks/OptimisticProvider.tsx` + `hooks/useOptimisticOps.ts`

### Server State Management
- **React Query** for fetching, caching, and synchronizing server state
- Query keys organized by feature in `lib/queryKeys.ts`
- Automatic cache invalidation on mutations
- Pagination support for large datasets with infinite scroll

### Real-time Updates via SSE
- Polling-free architecture for notifications and activity feeds
- Server-Sent Events for live updates across all connected clients
- Automatic reconnection handling with exponential backoff
- Integration: `hooks/use-event-source.ts`

### Type Safety Throughout
- End-to-end TypeScript for frontend and API routes
- Zod validation schemas for all inputs
- Prisma-generated types for database entities
- Type-safe query keys and API responses

## 📋 Table of Contents

### TMDB (The Movie Database)
Provides comprehensive movie data, casting information, and metadata.

**Key Features:**
- Movie search and discovery
- Detailed movie information (cast, crew, genres, runtime, ratings)
- Trending and popular movies
- Genre-based filtering
- Similar movies recommendations

**Environment Variable:** `TMDB_API_KEY`  
**Get API Key:** [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)

**Main Functions** (`lib/tmdb.ts`):
- `getTrendingMovies(page)` - Trending movies for the week
- `searchMovies(query, page)` - Search for movies
- `getMovieDetails(movieId)` - Full movie details
- `getSimilarMovies(movieId)` - Recommendations
- `getMoviesByGenre(genreId, page)` - Genre filtering

### WatchMode API
Provides streaming availability information showing where movies can be watched.

**Key Features:**
- Streaming platform availability (Netflix, Amazon Prime, Disney+, etc.)
- Rental and purchase options
- Regional availability
- Current pricing information

**Environment Variable:** `WATCHMODE_API_KEY` (server-side only)  
**Get API Key:** [watchmode.com/api](https://www.watchmode.com/api/)

**Main Functions** (`lib/watchmode.ts`):
- `getStreamingPlatforms(tmdbId, region)` - Subscription streaming platforms
- `getAllSources(tmdbId, region)` - All sources (rent, buy, subscription)
- `getAvailableRegions()` - List available regions

### Google OAuth 2.0
Enables users to sign in using their Google account for seamless authentication.

**Key Features:**
- One-click sign-in with Google
- Automatic user profile creation
- Email verification via Google
- Integration with Prisma user database

**Environment Variables:** 
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret

**Get Credentials:** [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

**Setup Steps:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Client Secret to `.env.local`

**Authentication Implementation** (`lib/features/auth/config.ts`):
- Credentials Provider (email/password)
- Google Provider (OAuth)
- JWT-based sessions
- Prisma adapter for user persistence

## 🔌 Application API Endpoints

### Authentication
- `POST /api/auth/signin` - Sign in user
- `POST /api/auth/signup` - Create new account
- `GET /api/auth/session` - Get current session

### Movies
- `GET /api/movies` - List movies with filtering
- `GET /api/movies/[id]` - Get movie details
- `GET /api/tmdb/[endpoint]` - TMDB proxy endpoints

### Reviews
- `GET /api/reviews` - List reviews
- `POST /api/reviews` - Create review
- `PUT /api/reviews/[id]` - Update review
- `DELETE /api/reviews/[id]` - Delete review

### Social
- `POST /api/favorites` - Add to favorites
- `DELETE /api/favorites/[id]` - Remove from favorites
- `POST /api/watchlist` - Add to watchlist
- `GET /api/users/[id]` - Get user profile

### Groups & Lists
- `GET /api/groups` - List user groups
- `POST /api/groups` - Create group
- `GET /api/shared-lists` - List shared lists
- `POST /api/shared-lists` - Create shared list

### Real-time
- `GET /api/activity` - Activity feed (SSE)
- `GET /api/notifications` - Notifications stream (SSE)
- `POST /api/messages` - Send message
- `GET /api/messages` - Get conversations

## 📊 Database Schema

See [frontend/prisma/schema.prisma](frontend/prisma/schema.prisma) for the complete database schema.

Key entities:
- `User` - User accounts and profiles
- `Movie` - Movie metadata from TMDB
- `Review` - User movie reviews and ratings
- `UserFavorite` - Favorite movies
- `WatchlistItem` - Movies to watch
- `Group` - User groups for discussion
- `GroupMember` - Group membership
- `SharedList` - Collaborative movie lists
- `Message` - Direct messages between users
- `Notification` - User notifications
- `HowYouWatched` - Viewing context (cinema, streaming, etc.)

## ✨ Code Quality & Best Practices

### TypeScript & Type Safety
✅ Strict mode enabled in `tsconfig.json`  
✅ All API responses typed and validated  
✅ Zod schemas for runtime validation  
✅ Prisma-generated types for database  

### Performance Optimizations
✅ React Query caching strategy  
✅ Image optimization with Next.js Image  
✅ Code splitting and lazy loading  
✅ Database query optimization with Prisma  
✅ Memoization of expensive computations  

### Testing & QA
✅ ESLint configured for code consistency  
✅ Error boundaries for graceful failure  
✅ Server-side error logging  
✅ Client-side error tracking ready  

### Security
✅ HTTPS/TLS in production  
✅ Secure session management (JWT)  
✅ Password hashing (bcrypt)  
✅ CORS and CSRF protection  
✅ Environment variable management  
✅ OAuth 2.0 compliance  

## 🤝 Contributing

We welcome contributions! Please feel free to submit pull requests or open issues for bugs and feature requests.

### Development Workflow
1. Create a feature branch from `main`
2. Make your changes with clear commit messages
3. Test your changes thoroughly
4. Submit a pull request with a description

## 📝 License

[Add your license information here]

## 🙋 Support

For questions or support, please [add contact information or support channel]

## 🚢 Deployment

### Production-Ready Features

✅ **Environment-based Configuration** - Separate configs for dev/staging/production  
✅ **Database Migrations** - Automatic schema updates with Prisma  
✅ **Type Safety** - Compile-time checking prevents runtime errors  
✅ **Error Handling** - Comprehensive error boundaries and fallbacks  
✅ **Performance Optimizing** - Image optimization, code splitting, caching  
✅ **Security** - CORS headers, CSRF protection, secure cookies  
✅ **Monitoring Ready** - Structured logging for debugging  

### Deployment Options

#### Vercel (Recommended)
```bash
# One-click deployment from GitHub
# Automatic deployments on push
# Built-in analytics and error tracking
```
- Environment variables configured in Vercel dashboard
- PostgreSQL via Neon
- Deploy preview on every pull request

#### Docker
```dockerfile
# Containerized deployment for any cloud
# Compatible with AWS, GCP, Azure, DigitalOcean, etc.
```

#### Self-Hosted
```bash
# Traditional Node.js server deployment
# Docker support for consistency
# Nginx reverse proxy configuration included
```

### Environment Setup Checklist

- [ ] Database: PostgreSQL with connection pooling (Neon recommended)
- [ ] APIs: TMDB key, WatchMode key, Google OAuth credentials
- [ ] Auth: NextAuth secret, NEXTAUTH_URL set correctly
- [ ] Monitoring: Error tracking (optional, Sentry recommended)
- [ ] Email: SMTP configured for notifications (optional)
- [ ] CDN: Static asset delivery (Vercel/CloudFront)

---

**Happy movie watching! 🍿🎬**