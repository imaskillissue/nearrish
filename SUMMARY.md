# Nearrish — Project Summary

> **For AI agents**: This file is a complete reference for the Nearrish codebase. Read this before making any changes to understand the architecture, conventions, and how every piece fits together.
>
> **For humans (non-programmers)**: Each section starts with a plain-English explanation in a *> quote block* like this one. The technical details follow for deeper reference.

---

## Table of Contents

1. [What is Nearrish?](#1-what-is-nearrish)
2. [Big Picture — How it all fits together](#2-big-picture--how-it-all-fits-together)
3. [Technology Stack](#3-technology-stack)
4. [Running the Project (Docker)](#4-running-the-project-docker)
5. [Frontend (What users see)](#5-frontend-what-users-see)
6. [Backend (The engine)](#6-backend-the-engine)
7. [Geo-Service (Maps)](#7-geo-service-maps)
8. [Moderation Service (AI safety)](#8-moderation-service-ai-safety)
9. [Database](#9-database)
10. [Real-Time Features (WebSocket)](#10-real-time-features-websocket)
11. [Security & Authentication](#11-security--authentication)
12. [Content Moderation Flow](#12-content-moderation-flow)
13. [Admin Dashboard](#13-admin-dashboard)
14. [Known Incomplete Features / TODOs](#14-known-incomplete-features--todos)
15. [File & Folder Map](#15-file--folder-map)

---

## 1. What is Nearrish?

> **Plain English**: Nearrish is a local social network — a website where people can post short messages, add their location to posts, see posts on an interactive map, chat with friends, and like/comment on content. Think of it as a mix between Twitter and a local community board, but with an AI that checks posts for harmful content before they appear. It was built as a school project (42 school) by a team of 5 people.

**Purpose**: A geolocation-aware social media platform where users can share posts with text and/or media, optionally pin them to a geographic location, see a map-based feed, direct message each other, and manage a friend graph.

**Team**:
| Member | Role |
|---|---|
| jsteinka | Product Manager |
| grbuchne | Technical Lead |
| ekarpawi | Product Owner |
| demrodri | Developer |
| atamas | DevOps / Documentation |

---

## 2. Big Picture — How it all fits together

> **Plain English**: The project has several separate "programs" (called services) that each do one job. They all run inside Docker containers (think of containers as isolated boxes), and they talk to each other over an internal network. A web server called Nginx acts as the "front door" — when you visit the website, Nginx decides which service should handle your request.

```
Browser / User
      │
      ▼
  [nginx] ← single entry point at https://localhost
  ┌───┼──────────────────────────────────────┐
  │   │         /api/*          /ws/*        │
  │   ▼              ▼              ▼        │
  │ [frontend]   [backend]    [backend]      │
  │ Next.js      Spring Boot  WebSocket      │
  │ (port 3000)  (port 8080)                 │
  │                   │                      │
  │          ┌────────┼─────────┐            │
  │          ▼        ▼         ▼            │
  │      [database] [geo-service] [mod-svc]  │
  │      PostgreSQL  Flask        FastAPI    │
  │      (port 5432) (port 5002) (port 8001) │
  │                                          │
  │          (optional)                      │
  │          [ollama]  ← AI model server     │
  └──────────────────────────────────────────┘
```

**Services at a glance**:
| Service | Technology | Purpose |
|---|---|---|
| `nginx` | nginx Alpine | Reverse proxy, TLS termination, routes traffic |
| `frontend` | Next.js 16 (React/TypeScript) | The web UI that users interact with |
| `backend` | Java 25 + Spring Boot | REST API, business logic, WebSocket server |
| `database` | PostgreSQL 16 | Stores all persistent data |
| `geo-service` | Python Flask | Map search, radius queries, grid clustering |
| `moderation-service` | Python FastAPI + LLM | AI-powered content moderation |
| `ollama` (optional) | Ollama / Docker Model Runner | Hosts the Qwen 2.5 3B language model |

---

## 3. Technology Stack

> **Plain English**: Different parts of the project are written in different programming languages and use different tools. The frontend is JavaScript/TypeScript (what runs in the browser), the backend is Java (the main server program), and the two helper services are Python.

### Frontend
- **Next.js 16.1.4** — React-based web framework (TypeScript)
- **Tailwind CSS 4** — styling system (utility classes)
- **react-leaflet / leaflet** — interactive maps
- **@stomp/stompjs + sockjs-client** — real-time WebSocket communication
- **recharts** — charts in the admin dashboard

### Backend
- **Java 25 + Spring Boot** — main server framework
- **Spring Security** — authentication and access control
- **Spring Data JPA + Hibernate** — database ORM (maps Java objects to DB rows)
- **Spring WebSocket + STOMP** — real-time messaging
- **JWT (Auth0 java-jwt)** — stateless authentication tokens
- **SCrypt** — password hashing algorithm
- **Gradle** — build tool
- **springdoc-openapi** — Swagger UI at `/swagger-ui/`

### Python Services
- **Flask** (geo-service) + **FastAPI** (moderation-service)
- **psycopg2** — direct PostgreSQL driver (used in geo-service)
- **openai** Python client — to call the LLM API

### Infrastructure
- **Docker Compose** — orchestrates all services
- **nginx** — reverse proxy with self-signed TLS
- **Docker secrets** — securely passes the database password

---

## 4. Running the Project (Docker)

> **Plain English**: The project is started with a single command. `make` (or `make all`) does everything automatically: generates security certificates, downloads an AI model, starts the database, and then starts all the other services.

### Makefile commands
| Command | What it does |
|---|---|
| `make` or `make all` | Full startup (certs → AI model → DB → all services) |
| `make up` | Start existing containers without rebuilding |
| `make down` | Stop all services |
| `make re` | Stop everything, then full rebuild and start |
| `make fclean` | Stop + delete ALL data (volumes), prune Docker system |
| `make certs` | Generate self-signed TLS certificates for localhost |
| `make backend` | Rebuild just the backend container and follow its logs |
| `make local` | Run the DB in Docker but the backend locally (for dev) |

### AI model detection
The Makefile automatically detects whether **Docker Model Runner** (Docker Desktop ≥ 4.40) or **Ollama** is available, and picks the right one. The model used is **Qwen 2.5 3B**.

### Ports
- `https://localhost` (443) — main website
- `http://localhost` (80) — redirects to HTTPS
- `localhost:5432` — PostgreSQL (only internally, not exposed to host in prod)

### Nginx routing
| URL path | Routed to |
|---|---|
| `/` | frontend:3000 |
| `/api/*` | backend:8080 |
| `/uploads/*` | backend:8080 (static files) |
| `/ws/*` | backend:8080 (WebSocket, long timeout) |
| `/swagger-ui/` | backend:8080 (API docs) |
| `/v3/api-docs` | backend:8080 (OpenAPI spec) |

---

## 5. Frontend (What users see)

> **Plain English**: The frontend is the actual website that opens in your browser. It is made of "pages" (screens) and "components" (reusable building blocks like a navigation bar or a post card). When the page needs data (like a list of posts), it sends a request to the backend and displays what comes back. Some things update in real time (like new messages) using a technology called WebSockets — think of it like an always-open phone line between the browser and the server.

### Pages
| Route | File | Description |
|---|---|---|
| `/` | `app/page.tsx` | Home feed — shows Hero section if logged out, or PostFeed if logged in |
| `/profile` | `app/profile/page.tsx` | **Registration form** (sign up, upload avatar) |
| `/profile/[id]` | `app/profile/[id]/page.tsx` | Public profile view for any user |
| `/explore` | `app/explore/page.tsx` | Split panel: post feed + interactive map |
| `/friends` | `app/friends/page.tsx` | Friend management (add, accept, decline, unfriend) |
| `/messages` | `app/messages/page.tsx` | Direct messages + group chats |
| `/admin` | `app/admin/page.tsx` | Admin-only dashboard with live stats and moderation queue |
| `/settings` | `app/settings/page.tsx` | Account settings, preferences, admin access |
| `/about` | `app/about/page.tsx` | About page |
| `/profile-admin` | `app/profile-admin/page.tsx` | Admin profile management |

### Key components
| Component | What it does |
|---|---|
| `Navbar.tsx` | Top navigation bar with login/logout, profile link |
| `PostFeed.tsx` | Scrolling feed of posts, supports read-only mode |
| `PostCard.tsx` | Single post display (text, image, like/comment actions) |
| `MiniPostCard.tsx` | Compact post card (used on the map explore page) |
| `Map.tsx` / `MapWrapper.tsx` | Leaflet map component (SSR-disabled, dynamic import) |
| `LocationPicker.tsx` | Let users pick a location when creating a post |
| `GlobalSearchModal.tsx` | Search overlay |
| `ProfileDropdown.tsx` | User menu in navbar |
| `ProfileModal.tsx` | Modal for viewing a profile inline |
| `Speedometer.tsx` | Visual gauge widget used in admin dashboard |
| `Testimonials.tsx` | Landing page testimonial section |
| `Hero.tsx` | Landing page hero section |
| `Footer.tsx` | Page footer |
| `Providers.tsx` | Wraps the app in AuthProvider and WsProvider |

### Core library files (`app/lib/`)
| File | Purpose |
|---|---|
| `api.ts` | All HTTP calls to the backend. Adds JWT to every request. Redirects to `/` on 401. |
| `auth-context.tsx` | Global auth state: current user, login, register, logout functions |
| `ws-context.tsx` | Global WebSocket state: STOMP client, online users, event subscriptions |
| `typography.ts` | Font/text utility helpers |

### How authentication works in the frontend
1. User logs in → backend returns a **JWT token**.
2. Token is saved in `localStorage` as `session_token`.
3. Every API call attaches it as a custom `AUTH` header.
4. `auth-context.tsx` reads the token on page load to restore the session.
5. If the backend returns a 401 (unauthorized), the token is cleared and the user is redirected to the home page with a "session expired" message.

---

## 6. Backend (The engine)

> **Plain English**: The backend is the main server program written in Java. It handles all the rules: who can post, who is friends with whom, what content is allowed, etc. It stores and retrieves everything from the database, sends real-time events to users, and talks to the AI moderation service.

**Entry point**: `NearrishApplication.java` — `@SpringBootApplication` with custom security (no default Spring Security auto-config).

**Base URL**: `http://backend:8080` (internal), exposed via nginx at `/api`.

**Swagger / API docs**: available at `https://localhost/swagger-ui/` when running.

---

### 6.1 Entities (Database tables)

> **Plain English**: An "entity" is a Java object that maps directly to a database table. Each field in the class becomes a column in the table.

| Entity | Table | Key fields |
|---|---|---|
| `User` | `users` | id (UUID), username, email, passwordHash, roles, lastOnline, avatarUrl, name, nickname, address |
| `Post` | `post` | id, text, authorId, timestamp, respondingToId, latitude, longitude, imageUrl, visibility (PUBLIC/FRIENDS_ONLY), moderationSeverity (0–4), sentiment, moderationTopic |
| `Comment` | `comments` | id, post_id, author_id, content, moderated, sentiment, moderationTopic, createdAt |
| `Message` | `messages` | id, conversation_id, sender_id, content, isRead, createdAt, moderated |
| `Conversation` | `conversations` | id, name (for groups), isGroup, participants (many-to-many), createdAt |
| `FriendRequest` | `friend_requests` | id, sender_id, receiver_id, status (PENDING/ACCEPTED/DECLINED), createdAt |
| `Block` | `blocks` | id, blocker_id, blocked_id, createdAt |
| `Like` | `user_likes` | id, user_id, post_id (nullable), comment_id (nullable), createdAt |
| `Notification` | `notification` | id, recipient_id, content, isRead, createdAt |
| `UserToxicityReport` | `user_toxicity_reports` | id, userId, score, summary, generatedAt, triggeredBy, post/comment/message counts |
| `Role` | `role` | name (PK), permissions (map) |

---

### 6.2 REST API Endpoints

> **Plain English**: An "endpoint" is a URL path the frontend can call to get or send data. Some require you to be logged in (authenticated), others are public.

#### Auth (`/api/auth/*`) — No login required
| Method | Path | What it does |
|---|---|---|
| POST | `/api/auth/login` | Login with username/email + password → returns JWT |
| POST | `/api/auth/registration` | Register new account → returns JWT |

#### Posts (`/api/posts/*`) — Login required
| Method | Path | What it does |
|---|---|---|
| POST | `/api/posts` | Create a new post |
| GET | `/api/posts/feed` | Get personalized feed (own + friends + public) |
| GET | `/api/posts/feed/geo` | Same but only geo-tagged posts |
| POST | `/api/posts/upload-image` | Upload image, returns URL |
| GET | `/api/posts/{id}` | Single post |
| GET | `/api/posts/by-author/{authorId}` | Posts by a user |
| GET | `/api/posts/{id}/replies` | Thread replies |
| DELETE | `/api/posts/{id}` | Delete own post |

#### Public Posts (`/api/public/posts/*`) — No login required
| Method | Path | What it does |
|---|---|---|
| GET | `/api/public/posts/feed` | Public feed (only PUBLIC posts) |
| GET | `/api/public/posts/feed/geo` | Public geo feed |

#### Users (`/api/public/users/*`) — No login required
| Method | Path | What it does |
|---|---|---|
| GET | `/api/public/users` | All users (id, username, avatarUrl) |
| GET | `/api/public/users/{id}` | Public profile |
| GET | `/api/public/users/{id}/friend-count` | Number of friends |

#### My Profile (`/api/users/me/*`) — Login required
| Method | Path | What it does |
|---|---|---|
| GET | `/api/users/me` | Own full profile |
| PATCH | `/api/users/me` | Update name, nickname, address |
| POST | `/api/users/me/avatar` | Upload avatar image |

#### Comments (`/api/posts/{postId}/comments/*`) — Login required
| Method | Path | What it does |
|---|---|---|
| GET | `/api/posts/{postId}/comments` | List comments |
| GET | `/api/posts/{postId}/comments/count` | Comment count |
| POST | `/api/posts/{postId}/comments` | Add comment |
| DELETE | `/api/posts/{postId}/comments/{id}` | Delete own comment |

#### Likes — Login required
| Method | Path | What it does |
|---|---|---|
| POST | `/api/posts/{id}/like` | Like a post |
| DELETE | `/api/posts/{id}/like` | Unlike a post |
| GET | `/api/posts/{id}/likes` | Like count |
| GET | `/api/posts/{id}/likes/me` | Did I like this? |
| POST/DELETE/GET | `/api/comments/{id}/like` | Same for comments |

#### Chat (`/api/chat/*`) — Login required
| Method | Path | What it does |
|---|---|---|
| GET | `/api/chat/conversations` | List conversations (with last message + unread count) |
| POST | `/api/chat/conversations/{userId}` | Start/get DM with a user |
| GET | `/api/chat/conversations/{id}/messages` | Paginated messages (cursor-based) |
| POST | `/api/chat/conversations/group` | Create group chat |
| POST/DELETE | `/api/chat/conversations/{id}/members/{userId}` | Add/remove group member |
| POST | `/api/chat/conversations/{id}/leave` | Leave group |
| PUT | `/api/chat/conversations/{id}/name` | Rename group |
| POST | `/api/chat/conversations/{id}/messages` | Send message |
| POST | `/api/chat/conversations/{id}/read` | Mark as read |

#### Friends (`/api/friends/*`) — Login required
| Method | Path | What it does |
|---|---|---|
| POST | `/api/friends/request/{userId}` | Send friend request |
| DELETE | `/api/friends/request/{requestId}` | Cancel outgoing request |
| POST | `/api/friends/accept/{requestId}` | Accept request |
| POST | `/api/friends/decline/{requestId}` | Decline request |
| DELETE | `/api/friends/friend/{userId}` | Unfriend |
| GET | `/api/friends/status/{userId}` | Friendship status (NONE/PENDING_SENT/PENDING_RECEIVED/FRIEND) |
| GET | `/api/friends` | List friends |
| GET | `/api/friends/requests/incoming` | Incoming pending requests |
| GET | `/api/friends/requests/outgoing` | Outgoing pending requests |

#### Blocking (`/api/blocks/*`) — Login required
| Method | Path | What it does |
|---|---|---|
| POST | `/api/blocks/{userId}` | Block a user |
| DELETE | `/api/blocks/{userId}` | Unblock |
| GET | `/api/blocks` | List blocked users |

#### Notifications (`/api/notifications/*`) — Login required
| Method | Path | What it does |
|---|---|---|
| POST | `/api/notifications/send` | Send a notification (params: recipientId, message) |
| GET | `/api/notifications` | Get own notifications |
| POST | `/api/notifications/read` | Mark all as read |

#### Admin (`/api/admin/*`) — Login required + ADMIN role
| Method | Path | What it does |
|---|---|---|
| POST | `/api/admin/verify` | Check if caller is admin |
| GET | `/api/admin/users` | All users (with optional toxicity data) |
| DELETE | `/api/admin/users/{id}` | Delete user |
| GET | `/api/admin/moderation/queue` | All flagged content |
| GET | `/api/admin/users/{id}/toxicity` | Get stored toxicity report |
| POST | `/api/admin/users/{id}/analyse` | Trigger LLM toxicity analysis for user |
| GET | `/api/admin/stats/...` | Various stats endpoints (activity, severity, sentiment, topics, online history, live snapshot, full export) |

#### Geo Proxy (`/api/public/geo/*`) — No login required
| Method | Path | What it does |
|---|---|---|
| GET | `/api/public/geo/reverse?lat=&lng=` | Reverse geocoding (proxied to geo-service) |

#### Moderation Pre-flight (`/api/public/moderate/*`) — No login required
| Method | Path | What it does |
|---|---|---|
| POST | `/api/public/moderate/registration` | Check name + nickname before registration |

---

### 6.3 Services (business logic)

| Service | Responsibility |
|---|---|
| `PostService` | Create/delete posts, build feeds, async moderation, WebSocket broadcast |
| `CommentService` | Add/delete comments, async moderation, broadcast |
| `ChatService` | Conversations, messages, blocking checks, async message moderation |
| `FriendRequestService` | Full friend lifecycle, WebSocket friend events |
| `BlockService` | Block/unblock, check if blocked |
| `LikeService` | Like/unlike posts & comments, broadcast like counts |
| `NotificationService` | Save notification, send WebSocket PING |
| `OnlineStatusService` | Track online users via WebSocket session events, broadcast online status |
| `ModerationClient` | HTTP client to `moderation-service`; fail-open (returns "allow" if service is down) |
| `AdminStatsService` | Live stats snapshot every 5s, rolling 4h online history, all analytics aggregations |

---

### 6.4 Security

> **Plain English**: Every request that needs a logged-in user must include a "token" (a string of characters that proves who you are). This token is created when you log in and expires after 7 days. Passwords are stored scrambled using a strong algorithm so even if the database is stolen, passwords can't be read.

- **JWT** in a custom `AUTH` header (not the standard `Authorization: Bearer`).
- Token signed with **HMAC256**, 7-day expiry. Contains: `username`, `userId`, `mfa`, `roles`.
- Passwords hashed with **SCrypt** (strong, memory-hard algorithm).
- **CORS** allows: `http://localhost`, `http://localhost:3000`, `https://localhost` (with credentials).
- Public paths (no token needed): `/api/public/**`, `/api/auth/**`, `/uploads/**`, `/ws/**`, Swagger.
- WebSocket connections authenticated via `StompAuthInterceptor` (reads `AUTH` header on STOMP CONNECT).

---

## 7. Geo-Service (Maps)

> **Plain English**: This is a small Python server dedicated to map-related tasks. When you open the Explore page and see posts as pins on a map, this service is what finds those posts. It can also group many nearby posts into clusters when you're zoomed out.

**Technology**: Python Flask, PostgreSQL (direct SQL with psycopg2), rate-limited.

**Endpoints** (internal, called by backend or proxied via `/api/public/geo/`):
| Method | Path | What it does |
|---|---|---|
| GET | `/health` | DB connectivity check |
| POST | `/geo/search` | Bounding-box search: find all posts within a map rectangle |
| POST | `/geo/radius` | Radius search: find posts within X km of a point (Haversine formula) |
| POST | `/geo/cluster` | Grid clustering: group posts into an 8×8 grid of cells (for zoomed-out view) |
| GET | `/geo/reverse` | Reverse geocoding: lat/lng → place name (via Nominatim) |

**Rate limits**: 200 req/min general, 100 req/min on search routes, 60 req/min on cluster.

---

## 8. Moderation Service (AI safety)

> **Plain English**: This is an AI-powered filter that reads every post, comment, chat message, and even usernames to decide if the content is harmful. It uses a small AI language model (Qwen 2.5 3B — similar to a mini ChatGPT) running locally on the server. It gives a score from 0 (clean) to 4 (very harmful), and the backend uses that score to decide whether to block content.

**Technology**: Python FastAPI, LLM via OpenAI-compatible API (Docker Model Runner or Ollama).

**Severity scale**:
| Score | Category | Action |
|---|---|---|
| 0 | clean | Allow and publish |
| 1 | borderline | Allow but flag |
| 2 | inappropriate | Warn user |
| 3 | harmful | Block content |
| 4 | severe | Block + escalate to admin |

**Endpoints**:
| Method | Path | What it does |
|---|---|---|
| POST | `/moderate` | Moderate a post or comment (returns severity, sentiment, topic, reason) |
| POST | `/moderate/chat` | Moderate a chat message (with last-10-message history for context) |
| POST | `/moderate/username` | Check a username for slurs/hate codes |
| POST | `/analyse/user` | Generate LLM plain-English risk report for a user (admin use) |

**Performance features**:
- LRU cache (1000 entries, 1-hour TTL) — identical content is not re-moderated.
- Warm-up inference at startup.
- Leetspeak normalization (e.g. `h3ll0` → `hello`) before username checks.
- Logs to rotating JSONL file at `moderation-service/logs/moderation.jsonl`.

**Fail-open design**: If the moderation service is unreachable, the backend's `ModerationClient` returns `Result.allow()` — content is published normally. The app never breaks because of the AI service.

---

## 9. Database

> **Plain English**: All data (users, posts, messages, etc.) is saved in a PostgreSQL database. Think of it as a very structured spreadsheet system. The backend manages the database structure automatically (it updates the tables when the Java code changes).

**Engine**: PostgreSQL 16 Alpine.

**Connection**: `jdbc:postgresql://database:5432/social_media`, user `social_user`.

**Password management**: Docker secret from `secrets/db_password.txt`.

**Schema strategy**: `ddl-auto=update` — Hibernate creates/modifies tables on startup automatically.

**Tables**:
| Table | Description |
|---|---|
| `users` | User accounts |
| `user_roles` | User role assignments (ElementCollection) |
| `post` | Posts (text, media, location, visibility, moderation fields) |
| `comments` | Comments on posts |
| `messages` | Chat messages |
| `conversations` | Chat conversations (DMs and groups) |
| `conversation_participants` | Many-to-many join table |
| `friend_requests` | Friend request records with status |
| `blocks` | User block relationships |
| `user_likes` | Post and comment likes |
| `notification` | User notifications |
| `user_toxicity_reports` | Admin-generated AI toxicity reports |
| `role` | Role definitions |
| `role_permissions` | Role permission entries (ElementCollection) |

---

## 10. Real-Time Features (WebSocket)

> **Plain English**: Some things on the site update instantly without you needing to refresh the page. This is done via WebSockets — a permanent connection between your browser and the server. When a new message arrives, the server pushes it to your browser immediately. The technology used for this is called STOMP, which is a messaging protocol layered on top of WebSockets.

**Connection**: STOMP over SockJS at `/ws`.

**Authentication**: JWT sent in the STOMP `AUTH` header at connection time.

**Channels**:
| Destination | Who receives it | What it carries |
|---|---|---|
| `/topic/posts` | Everyone | Post/comment events: `NEW_COMMENT:id`, `DELETED_COMMENT:postId:commentId`, `MODERATED_COMMENT:id:postId:reason`, `LIKE_POST:id:count`, `LIKE_COMMENT:id:count`, `MODERATED_POST:id:reason` |
| `/topic/online` | Everyone | `{userId, status: "ONLINE"/"OFFLINE"}` |
| `/topic/admin/stats` | Everyone (only useful if admin) | Full live stats snapshot (every 5 seconds) |
| `/user/{username}/queue/chat` | Specific user | messageId string, or `REMOVED:id:reason` |
| `/user/{username}/queue/friends` | Specific user | `{type: "REQUEST_RECEIVED"/"REQUEST_ACCEPTED"/...}` |
| `/user/{username}/queue/notifications` | Specific user | `"PING"` string (triggers frontend to fetch new notifications) |

---

## 11. Security & Authentication

> **Plain English**: To use most features, you need to prove you are logged in. The system does this with a "JWT token" — a string of characters given to you after you log in. You include it with every request. Your password is never stored in plain text; it is scrambled in a way that cannot be reversed.

### Authentication flow
1. `POST /api/auth/login` with `{username, password}`.
2. Backend verifies password with SCrypt.
3. Backend issues JWT (signed HMAC256, 7 days, contains `userId`, `username`, `roles`).
4. Frontend stores JWT in `localStorage['session_token']`.
5. Every subsequent request includes `AUTH: <jwt>` header.
6. `ApiAuthenticationFilter` verifies the JWT on every protected endpoint.

### JWT header note
The header name is **`AUTH`**, not the standard `Authorization: Bearer`. This is a custom design choice. Swagger is configured to show this custom header.

### CORS configuration
Allowed origins: `http://localhost:80`, `http://localhost:3000`, `https://localhost:443`. Credentials are allowed.

### Security TODO
- WebSocket allowed origins set to `"*"` — should be restricted in production.
- JWT secret in `application.properties` is a hardcoded placeholder — must be overridden via environment variable in production.
- Rate limiting on the Spring backend is not yet implemented (marked as TODO).

---

## 12. Content Moderation Flow

> **Plain English**: Everything a user writes (posts, comments, messages, even their username when signing up) is checked by the AI. The check happens asynchronously for posts/comments/messages — meaning the content is saved first and shown immediately, then checked in the background. If the AI finds it harmful, it gets flagged or removed and a notification is sent.

```
User submits content
        │
        ▼
Content saved to DB instantly
        │
        ├─── (sync for username at registration)
        │         └── If blocked → registration rejected
        │
        └─── (async for posts, comments, messages)
                  │
                  ▼
           moderation-service LLM
                  │
                  ▼
           Result: severity 0–4, sentiment, topic, reason
                  │
              severity ≥ 3?
               YES │  NO
                   │   └── Update DB metadata, continue
                   ▼
          Mark content as moderated
          Broadcast WebSocket event to frontend
          (frontend hides/blurs the content)
```

**Content types moderated**:
- ✅ Post text (async)
- ✅ Comment text (async)
- ✅ Chat message text (async, with 10-message history context)
- ✅ Username at registration (sync)
- ✅ Display name + nickname at registration (sync pre-flight)

---

## 13. Admin Dashboard

> **Plain English**: There is a special page only admins can see (`/admin`). It shows live statistics about the platform, a list of flagged posts and comments, and tools to analyze individual users for toxic behavior using AI.

**Features**:
- Live stat tiles updating every 5 seconds via WebSocket (users, posts, comments, messages, online count, flagged/blocked counts, block rate %).
- Visual speedometer showing block rate.
- Rolling 4-hour online user history chart.
- Moderation queue: all posts (severity ≥ 2) and comments flagged by AI.
- Charts: post activity (7 days), moderation severity breakdown, sentiment breakdown, topic breakdown.
- User list with toxicity scores.
- Per-user LLM toxicity analysis (on-demand) showing an AI-generated risk report.
- CSV export of all platform stats.

**Access control**: backend checks for `ADMIN` role on all `/api/admin/*` endpoints. Frontend reads `roles` from JWT and hides admin UI.

---

## 14. Known Incomplete Features / TODOs

> **Plain English**: Some features were started but not finished. Here is what is planned but not working yet.

| Feature | Status | Notes |
|---|---|---|
| Two-factor authentication (2FA) | Not implemented | `secondFactor` field exists on User, endpoint commented out in AuthenticationController |
| Backend rate limiting | Not implemented | TODO comment in WebSecurityConfig |
| Admin gate in Settings page | UI done, backend not wired | Shows a credential form but backend verification not connected |
| Production JWT secret | Insecure default | Placeholder string in `application.properties` — must be overridden via env var |
| WebSocket CORS restriction | Over-permissive | `allowedOriginPatterns("*")` in WebSocketConfig — should be restricted |

---

## 15. File & Folder Map

> **Plain English**: Here is what each folder and important file in the project contains.

```
nearrish/
├── docker-compose.yml          # Main Docker orchestration (all 7 services)
├── docker-compose.ollama.yml   # Ollama override (sets FORCE_OLLAMA=true)
├── Makefile                    # Project commands (make, make up, make down, etc.)
├── nginx/
│   └── nginx.conf              # Reverse proxy config, TLS, routing rules
├── secrets/
│   └── db_password.txt         # PostgreSQL password (Docker secret)
│
├── frontend/                   # Next.js web application (TypeScript/React)
│   ├── app/
│   │   ├── layout.tsx          # Root layout (Navbar, Providers wrapping all pages)
│   │   ├── page.tsx            # Home page
│   │   ├── globals.css         # Global styles
│   │   ├── lib/
│   │   │   ├── api.ts          # All API calls to backend (auth header injection)
│   │   │   ├── auth-context.tsx # Global auth state (user, login, logout)
│   │   │   └── ws-context.tsx  # Global WebSocket state (STOMP client, events)
│   │   ├── components/         # Reusable UI components (Navbar, PostCard, Map, etc.)
│   │   ├── explore/page.tsx    # Map + feed explore page
│   │   ├── friends/page.tsx    # Friend management page
│   │   ├── messages/page.tsx   # Messaging (DMs + groups)
│   │   ├── admin/page.tsx      # Admin dashboard
│   │   ├── profile/page.tsx    # Registration form
│   │   ├── profile/[id]/       # Dynamic route for public profiles
│   │   └── settings/page.tsx   # Settings page
│   └── package.json            # Frontend dependencies
│
├── backend/                    # Spring Boot Java application
│   ├── src/main/java/com/nearrish/backend/
│   │   ├── NearrishApplication.java   # Entry point
│   │   ├── config/                    # WebMvcConfig (static file serving)
│   │   ├── controller/                # REST API controllers
│   │   ├── entity/                    # Database entities (JPA)
│   │   ├── repository/                # Database query interfaces (Spring Data)
│   │   ├── security/                  # JWT filter, STOMP interceptor, CORS, WebSocket config
│   │   └── service/                   # Business logic services
│   ├── src/main/resources/
│   │   └── application.properties     # DB URL, JWT secret, upload size limits
│   └── build.gradle                   # Build dependencies (Spring Boot, JWT, openapi)
│
├── geo-service/                # Python Flask — map/geolocation queries
│   ├── app.py                  # All Flask routes (search, radius, cluster, reverse geocoding)
│   ├── requirements.txt        # Python dependencies
│   └── Dockerfile
│
└── moderation-service/         # Python FastAPI — AI content moderation
    ├── main.py                 # FastAPI app, LLM client, moderation endpoints
    ├── requirements.txt        # Python dependencies (fastapi, openai, etc.)
    ├── logs/
    │   └── moderation.jsonl    # Rotating moderation log
    └── Dockerfile
```

---

*This document was auto-generated by GitHub Copilot on 22 March 2026 as a complete project reference.*
*To regenerate or update it, ask the AI agent: "Please update SUMMARY.md based on the current state of the codebase."*
