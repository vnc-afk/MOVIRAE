# 🎬 MOVIRAE - Movie Social Network

> **A full-stack social platform for cinephiles** — featuring real-time collaboration, optimistic UI patterns, and seamless third-party API integration.

🌐 **[Live Demo: movirae.onrender.com](https://movirae.onrender.com/)** | Try it now!

## 🎯 Project Overview

MOVIRAE is a **production-oriented social network and movie intelligence platform** built with modern full-stack technologies. It demonstrates:

- 🏗️ **Scalable Architecture** - Optimistic operations pattern for instant UI feedback with server synchronization
- 🤖 **AI Movie Assistant** - Gemini-powered movie discovery, recommendations, and personalized watch guidance using the user's own watch history, ratings, and watchlist
- 🎵 **Soundtrack Discovery** - Search and browse movie soundtracks with MusicBrainz + YouTube-backed track previews and favorites
- 🔄 **Real-time Features** - Server-Sent Events (SSE) for live notifications and activity feeds
- 🔐 **Multi-provider Authentication** - Email/Password + Google OAuth 2.0 with session management
- 📡 **Third-party Integrations** - TMDB for movie data, WatchMode for streaming availability, MusicBrainz/YouTube for soundtrack metadata, and Gemini AI for conversational recommendations
- 🎨 **Modern Frontend** - TypeScript + React 18, fully accessible UI components
- 💾 **Data Persistence** - Prisma ORM with relational database design
- 🚀 **Developer Experience** - Type-safe API routes, automated migrations, linting, AI tool orchestration, and background workers

## 🌟 Key Highlights

| Feature | Technology | Impact |
|---------|-----------|--------|
| **Instant UI Feedback** | Optimistic Operations Pattern | Near-instant perceived feedback for user actions |
| **AI Movie Assistant** | Gemini + TMDB + user data | Personalized movie discovery and watch guidance |
| **Soundtrack Catalog** | MusicBrainz + YouTube + Prisma | Browse movie scores and music previews by film |
| **Real-time Sync** | SSE + Redis Pub/Sub | Live event delivery across supported application instances |
| **Social Discovery** | TMDB + WatchMode APIs | Movie discovery with TMDB + WatchMode streaming information |
| **Type Safety** | TypeScript + Prisma | Catch errors at compile time, not production |
| **Performance** | React Query + Next.js caching | Automatic cache invalidation & pagination |
| **Authentication** | NextAuth.js + OAuth | Email/password and Google OAuth session flows |
| **Distributed API Architecture** | Cloudflare Worker + Vercel Next.js + Render Next.js | Programmable API routing across deployments |
| **Cross-Instance Messaging** | Upstash Redis Pub/Sub | Communication between API deployments |
| **Background Processing** | BullMQ + Render Worker | Asynchronous notifications and soundtrack processing |
| **Shared Persistent Data** | Neon PostgreSQL | Shared source of truth for both API deployments |

## 🏗️ System Architecture

### Application Flow

```
┌──────────────────────────┐
│          Users           │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ Cloudflare Worker       │
│ API routing layer       │
└────────────┬─────────────┘
             │
       ┌─────┴─────┐
       ▼           ▼
┌────────────────┐ ┌────────────────┐
│ Vercel Next.js │ │ Render Next.js │
│ Frontend +     │ │ Frontend +     │
│ /api/*         │ │ /api/*         │
└───────┬────────┘ └───────┬────────┘
      │              │
      └──────┬───────┘
             ▼
             ┌──────────────┐
             │ Upstash Redis│
             └──────┬───────┘
                ╱ ╲
               ╱   ╲
              ▼     ▼
         Redis Pub/Sub  BullMQ Queue
               │              │
               │              ▼
               │       ┌──────────────┐
               │       │ Render Worker│
               │       └──────────────┘
               ▼
            Cross-instance events

Vercel Next.js ──┐
                 ├──→ Neon PostgreSQL
Render Next.js ───┘

External services: TMDB · WatchMode · Gemini · MusicBrainz · YouTube · Google OAuth
```

The Cloudflare Worker acts as the API routing layer, forwarding requests to either the
Vercel or Render Next.js deployment according to the configured routing logic. Each
deployment includes the Movirae frontend and `/api/*` routes; the diagram labels the
API capability because that is the traffic being routed. Vercel deploys the Next.js
application and its `app/api/**` routes, while Render provides the second Next.js
runtime and separately hosts the background worker services.

The dual-origin setup provides an additional API deployment and demonstrates multi-origin
routing, shared state, cross-instance messaging, and failure-aware infrastructure design.

Both API deployments connect to shared Neon PostgreSQL for persistent application data.
Upstash Redis provides the shared Redis infrastructure used for transient Pub/Sub event
distribution and BullMQ queues. Redis Pub/Sub is not persistent storage and does not
replace PostgreSQL.

### Distributed Real-Time Flow

```text
Client → API → Redis Pub/Sub → Other API deployment
   → SSE or WebSocket delivery → Connected clients
```

SSE remains the primary documented stream for notifications, activity, reviews, groups,
and shared-list updates. Redis Pub/Sub is implemented for cross-instance notification
events and the message WebSocket hub, allowing events from one API deployment to reach
connections on the other. Some feature-specific event emitters remain process-local.
BullMQ is separate: it handles background jobs processed by Render workers.

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
- Near-instant perceived feedback for user interactions
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

### AI + Community Features
- **AI Movie Assistant** - Chat with a Gemini-backed assistant to find movies by mood, genre, similar favorites, or your own history
- **Soundtracks Library** - Explore soundtrack albums, movie score metadata, track previews, and favorites for film music discovery
- **Group Creation & Management** - Create groups with friends to discuss movies
- **Shared Lists** - Collaborate on curated movie lists with other users
- **Real-time Messaging** - Chat with friends about movies in real-time
- **Activity Feed** - See what your friends are watching and reviewing
- **Notifications** - Get notified about friend activities, reviews, and group updates

### Advanced Features
- **Movie Comparisons** - Compare movie statistics and details side-by-side
- **Recommendations Engine** - Personalized movie recommendations based on your taste, ratings, and watch history
- **Streaming Information** - Find where movies are available to stream
- **Soundtrack Discovery** - Match movie music to film metadata with MusicBrainz and YouTube-backed playback
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
- **AI Layer**: Gemini-powered assistant with tool-based movie search and user-data access
- **Movie Data**: TMDB API integration
- **Soundtrack Data**: MusicBrainz + YouTube lookups with queued refresh workers and persisted favorites
- **Authentication**: NextAuth.js with Prisma adapter

### Infrastructure
- **Traffic Layer**: Cloudflare Worker API routing layer in front of both API origins
- **Deployment #1**: Vercel Next.js frontend and `/api/*` functions
- **Deployment #2**: Render Next.js frontend/runtime and `/api/*` service
- **Persistent Database**: Neon PostgreSQL, accessed through Prisma
- **Messaging and Caching**: Upstash Redis integrations
- **Distributed Events**: Redis Pub/Sub for communication between the API deployments
- **Background Jobs**: BullMQ queues with separate Render worker processes

## 🚀 Getting Started

### 🌐 Try the Live Demo

👉 **[Visit movirae.vercel.app](https://movirae.vercel.app/)** to see the application in action!

### Installation

#### Prerequisites
- Docker Desktop
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

   Or use Docker so Node.js and `node_modules` stay inside the container:
   ```bash
   cd ..
   docker compose build
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the `frontend` directory:
   ```env
   # Persistent database (Neon PostgreSQL in hosted environments)
   DATABASE_URL=postgresql://user:password@localhost:5432/movirae

   # Upstash Redis TCP connection for cache, Pub/Sub, and BullMQ
   REDIS_URL=rediss://default:password@host:6379

   # TMDB API
   TMDB_API_KEY=your_tmdb_api_key

   # WatchMode API (optional)
   WATCHMODE_API_KEY=your_watchmode_api_key

   # Gemini AI (required for the movie assistant)
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-flash-lite-latest

   # NextAuth.js
   NEXTAUTH_SECRET=your_secret_key
   NEXTAUTH_URL=http://localhost:3000

   # Google OAuth (optional)
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

   The current system includes a Gemini-backed assistant at `/ai-assistant` that can search TMDB, inspect the signed-in user's watch history, ratings, reviews, and watchlist, and provide personalized recommendations without exposing raw database internals.

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

### Docker development

From the repository root, copy your environment file to `frontend/.env.local`, then
build and start the app:

```bash
docker compose build
docker compose up
```

The source directory is mounted into the container, so code changes are picked up
by the development server. `node_modules` and `.next` use Docker-managed volumes,
so the host computer does not need Node.js or npm installed.

On another computer, clone the repository, install Docker Desktop, copy
`frontend/.env.local`, and run `docker compose up --build`. Docker will install
dependencies while building the image; you do not need to run `npm install`
yourself. After changing `package.json` or `package-lock.json`, rebuild the image:

```bash
docker compose build
docker compose up
```

To run Prisma migrations inside the container:

```bash
docker compose run --rm frontend npm run prisma:migrate
```

Stop the development container with `Ctrl+C`, or run `docker compose down`.


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

### Browser smoke tests

The frontend includes a small Playwright smoke suite covering public navigation, the
login form, and an unauthenticated protected API request. From `frontend/`:

```bash
npm run test:e2e
```

By default Playwright starts the local app with `npm run dev` at
`http://127.0.0.1:3000`. Set `PLAYWRIGHT_BASE_URL` to test an already-running local
or deployed instance (the configured server is reused outside CI). The suite does
not attempt sign-in, OAuth, CAPTCHA, or other flows requiring credentials or external
services. Install a browser once with `npx playwright install chromium` if needed.
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
- Server-Sent Events for live updates to connected clients
- Automatic reconnection handling with exponential backoff
- Integration: `hooks/use-event-source.ts`

### Distributed API Architecture
- The Cloudflare Worker acts as the API routing layer between the Vercel and Render Next.js deployments
- Both deployments include the Movirae frontend and `/api/*` routes
- Both API deployments share persistent state through Neon PostgreSQL and use the shared Redis infrastructure

### Redis Pub/Sub
- Upstash Redis Pub/Sub propagates transient events between the Vercel and Render Next.js deployments
- This allows supported notification and message events generated by one API deployment to reach the other deployment
- Pub/Sub is cross-instance event/message distribution, not persistent storage
- SSE remains the client delivery mechanism for existing event streams; the message path also has a Redis-backed WebSocket hub

### Background Job Processing
- BullMQ queues asynchronous work separately from Redis Pub/Sub event delivery
- The Render worker processes consume notification and soundtrack jobs using the shared Redis TCP connection
- Workers persist durable results through Prisma/PostgreSQL

### Shared Persistent State
- Neon PostgreSQL is the persistent relational database and application source of truth for both API deployments
- Vercel API, Render API, and workers access the shared database through Prisma
- Redis may provide cache and transient messaging, but it does not replace PostgreSQL

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
1. Create or select a Google Cloud project
2. Configure the OAuth consent screen
3. Create OAuth 2.0 credentials for a Web application
4. Add the application's authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy the Client ID and Client Secret into the environment variables

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

### Soundtracks
- `GET /api/soundtracks` - Browse the soundtrack catalog and search by movie or composer
- `GET /api/soundtracks/[tmdbId]` - Get a movie's soundtrack details and queued refresh status
- `POST /api/soundtracks/[tmdbId]/favorite` - Save or remove a soundtrack favorite
- `GET /api/soundtracks/events` - Server-sent updates for soundtrack activity

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
✅ Google OAuth 2.0 authentication

## 🚢 Deployment

The current deployment architecture separates traffic routing, API origins, persistent
storage, messaging, and background processing:

```text
Cloudflare Worker
   (API routing layer)
      │
   ┌────┴────┐
   ▼         ▼
Vercel      Render
Next.js     Next.js
Frontend +  Frontend/runtime +
/api/*      /api/*
   │         │
   └────┬────┘
      ▼
   Neon PostgreSQL

Vercel /api/* ↔ Upstash Redis ↔ Render /api/*
                    ├─ Redis Pub/Sub → cross-instance events
                    └─ BullMQ Queue → Render Worker
```

The Cloudflare Worker is the traffic entry point for API requests and can forward them
between the Vercel and Render Next.js deployments according to its routing logic. Both deployments include the frontend and
`/api/*` routes, use shared Neon PostgreSQL as the persistent source of truth, and use
Upstash Redis for Pub/Sub and BullMQ infrastructure. Render hosts the worker services
responsible for processing queued background jobs.
The repository confirms cross-instance Pub/Sub for notification events and the message
WebSocket hub; some feature-specific event emitters remain process-local.

### Production-Oriented Features

✅ **Environment-based Configuration** - Separate configs for dev/staging/production  
✅ **Database Migrations** - Versioned schema migrations managed with Prisma
✅ **Type Safety** - Compile-time checking prevents runtime errors  
✅ **Error Handling** - Comprehensive error boundaries and fallbacks  
✅ **Performance Optimizing** - Image optimization, code splitting, caching  
✅ **Security** - CORS headers, CSRF protection, secure cookies  
✅ **Monitoring Ready** - Structured logging for debugging  

**Happy movie watching! 🍿🎬**
