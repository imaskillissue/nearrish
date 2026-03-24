*This project has been created as part of the 42 curriculum by: jsteinka, grbuchne, ekarpawi, demrodri, atamas*
# Description
**Nearrish** is a social media platform designed to help people discover, organize, and share local events.
Its primary goal is to make event planning and community engagement simple by combining social interaction with practical event management tools.

Users can connect with friends, create and join events, and stay engaged through posts, likes, comments, and real-time chat. By bringing these features together in one place, Nearrish provides a streamlined way to plan activities and keep up with what is happening nearby.

# Instructions
## Prerequisites
- Make
- Docker and Docker Compose
- **Content moderation** requires either Docker Desktop ≥ 4.40 (with the built-in model runner) or Ollama as a fallback. To skip moderation entirely, set `MODERATION_ENABLED=false` in your `.env`.

## Setup
1. Create an environment file from the example:
```
cp .env.example .env
```
2. Fill in `DB_NAME`, `DB_USER`, and `DB_URL` (defaults are pre-set in the example). Optionally set `MODERATION_ENABLED=false` to disable AI moderation.
3. Create the database password secret file:
```
cp secrets/db_password.txt.example secrets/db_password.txt
```
4. Replace the value in `secrets/db_password.txt` with a secure password.

## Run The Project
- Run `make all` for first-time setup (generates TLS certs and starts all services)
- Open the application in your browser at `https://localhost`

## Useful Commands
- Start existing containers without rebuilding
```
make up
```
- Rebuild everything from scratch
```
make re
```
- Rebuild and tail backend logs only
```
make backend
```
- Stop all services
```
make down
```
- Remove containers, volumes and project resources
```
make fclean
```


# Team Information
## jsteinka - Product Manager (PM), developer
- Organizes team meetings and planning sessions.
- Tracks progress and deadlines.
- Ensures team communication.
- Manages risks and blockers.
## grbuchne - Technical Lead, developer
- Defines technical architecture.
- Makes technology stack decisions.
- Ensures code quality and best practices.
- Reviews critical code changes.
## ekarpawi - Product Owner (PO), developer
- Maintains the product backlog.
- Makes decisions on features and priorities.
- Validates completed work.
- Communicates with stakeholders (evaluators, peers).
## demrodri - developer
## atamas - DevOps, developer
- Sets up the project both for frontend and backend.
- Helps with task organization.
- Documentation.

# Project Management

- The team organized work by splitting features and technical tasks among members based on role and priorities.
- We held at least one online meeting per week on Discord to review progress, unblock issues, and align on next steps.
- Day-to-day coordination was handled asynchronously through Discord messages.

- GitHub Projects was used to structure and track tasks across development stages.
- GitHub Issues was used to document features, bugs, and technical improvements, with clear ownership and status updates.

- Main communication channel: Discord (weekly meetings + ongoing text coordination).
- Supporting communication: GitHub comments on issues and pull requests for technical discussions and code review feedback.

# Technical Stack

## Frontend
- **Next.js 16 (React 19, TypeScript)** for building a modern, component-based web application with routing and strong type safety.
- **Tailwind CSS 4** for fast, utility-first styling and consistent UI development.
- **SockJS + STOMP** for real-time communication features (chat/notifications).

**Why this choice:**  
Next.js and React provide a scalable frontend architecture, TypeScript improves maintainability, and SockJS/STOMP support reliable real-time user interactions.

## Backend
- **Java 25 + Spring Boot** as the core backend platform.
- **Python (Flask 3 / FastAPI)** as additional backend services for geospatial queries and content moderation.
- **Spring MVC** for REST API development.
- **Spring Security + JWT (`java-jwt`)** for authentication and access control.
- **Spring Data JPA / JDBC + Hibernate** for data persistence and ORM.
- **Spring WebSocket** for bidirectional real-time features.

**Why this choice:**  
Spring Boot offers a mature and modular ecosystem, making it well suited for secure, production oriented backend services with both REST and WebSocket support.

## Database
- **PostgreSQL** as the primary relational database.

**Why this choice:**  
PostgreSQL is reliable, performant, and standards compliant, with strong support for relational data integrity and complex queries needed for social and event related features.

## Additional Technologies
- **Docker + Docker Compose** for containerized local development and service orchestration (frontend, backend, database, moderation service).
- **Gradle** for backend build/dependency management.
- **OpenAPI/Swagger (`springdoc-openapi`)** for API documentation and easier endpoint testing.
- **JUnit + Spring testing stack + Testcontainers** for integration and component testing.

## Major Technical Decisions (Summary)
- A **TypeScript-based Next.js frontend** was chosen for maintainability and modern UI architecture.
- A **Spring Boot backend** was selected for security, scalability, and ecosystem maturity.
- **PostgreSQL** was chosen for robust relational modeling and long term reliability.
- **Dockerized setup** was adopted to keep development environments consistent across team members.

# Database Schema

The following entities make up the core data model:

| Entity | Description |
|---|---|
| `User` | Account with credentials, profile, and role assignments |
| `Role` | User roles (e.g. `USER`, `ADMIN`) for access control |
| `Post` | User-created content with visibility (`PUBLIC`, `FRIENDS_ONLY`, `PRIVATE`) and optional geolocation |
| `Comment` | Replies attached to posts |
| `Like` | Association between a user and a post or comment |
| `FriendRequest` | Pending or accepted friendship between two users |
| `Block` | Record of a user blocking another user |
| `Conversation` | A chat thread between two or more users |
| `Message` | Individual message within a conversation |
| `Notification` | In-app notification triggered by social interactions |

# Feature List

- **Authentication** — JWT-based login with MFA flag; tokens expire after 7 days and are sent via a custom `AUTH` header
- **Posts** — Create, read, and delete posts with three visibility levels: `PUBLIC`, `FRIENDS_ONLY`, and `PRIVATE`
- **Comments & Likes** — Interact with posts through threaded comments and likes
- **Friend System** — Send, accept, and reject friend requests; blocked users are filtered from feeds
- **Real-time Chat** — Private messaging via STOMP/WebSocket with conversation history
- **Live Notifications** — Friend request events and post activity pushed over WebSocket
- **Online Presence** — Broadcast of online/offline status across connected clients
- **Geolocation Feed** — Posts can be pinned to a location and browsed on an interactive map via Leaflet
- **Content Moderation** — Async AI moderation pipeline scoring 0–4; score ≥ 3 blocks content, score = 2 warns the author, score = 4 escalates to admin review
- **Admin Review** — Admins can inspect flagged content promoted by the moderation service

# Modules

| Service | Technology | Port | Role |
|---|---|---|---|
| `backend` | Spring Boot 4.0.1 / Java 25 | 8080 | REST API and WebSocket server |
| `frontend` | Next.js 16 / React 19 + nginx | 443 | Web UI served through nginx |
| `moderation-service` | FastAPI / Python 3.12 | 8001 | AI content scoring via Qwen 2.5 3B |
| `geo-service` | Flask 3 / Python 3.11 | 5002 | Geospatial post queries |
| `nginx` | nginx | 80 / 443 | Reverse proxy with HTTPS termination |
| `database` | PostgreSQL 16 | 5432 | Primary relational store |

# Individual Contribution

| Member | Role | Contributions |
|---|---|---|
| jsteinka | PM, developer | Team coordination, sprint planning, deadline tracking, feature development |
| grbuchne | Tech Lead, developer | System architecture, technology decisions, code review, backend development |
| ekarpawi | PO, developer | Backlog management, feature prioritization, stakeholder communication |
| demrodri | developer | Feature development across frontend and backend |
| atamas | DevOps, developer | Docker setup, CI/CD, environment configuration, documentation |

# Resources

- [Spring Boot Documentation](https://docs.spring.io/spring-boot/index.html)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [STOMP over WebSocket](https://stomp-js.github.io/stomp-websocket/)
- [Testcontainers for Java](https://java.testcontainers.org/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Leaflet](https://react-leaflet.js.org/)
- [springdoc-openapi](https://springdoc.org/)