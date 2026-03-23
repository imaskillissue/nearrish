*This project has been created as part of the 42 curriculum by: jsteinka, grbuchne, ekarpawi, demrodri, atamas*
# Description
**Nearrish** is a social media platform designed to help people discover, organize, and share local events.
Its primary goal is to make event planning and community engagement simple by combining social interaction with practical event management tools.

Users can connect with friends, create and join events, and stay engaged through posts, likes, comments, and real-time chat. By bringing these features together in one place, Nearrish provides a streamlined way to plan activities and keep up with what is happening nearby.

# Instructions
## Prerequisites
- Make
- Docker and Docker Compose
- Java 25
- Next.js

## Setup
1. Create an environment file from example file:
```
cp .env.example .env
```
2. Fill in the environment variables with values
3. Create the database password secret file:
```
cp secrets/db_password.txt.example secrets/db_password.txt
```
4. Replace the value in `secrets/db_password.txt` with a secure password.

## Run The Project
- Run the `make` command
- Open the application in your browser `https://localhost`

## Useful Commands
- Start existing containers without rebuilding
```
make up
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
- **Python** as an additional backend platform for map and moderation service.
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

# Feature List

# Modules

# Individual Contributions

Development was split based on roles and what each person felt most comfortable picking up. Some parts naturally overlapped — a lot of the later work involved several people touching the same files — so the breakdown below reflects primary ownership more than exclusive work.

---

## jsteinka — Product Manager, developer

Jan took on the bulk of the backend architecture after the base was established. He set up the post and feed system, the geo proxy that connects the backend to the geo-service, and the full moderation integration with the AI model. When the team decided to add an admin dashboard, he built it from scratch — live stats, charts, CSV export, sentiment tracking on posts and comments, and the user toxicity reports.

He also handled a lot of the "harder to spot" issues: the N+1 query problems in the feed, eager-fetching fixes for JPA associations, paginated chat messages, and the HTTPS rollout across all services. Basically whenever something broke in a non-obvious way, it usually ended up on his plate.

**Main areas:** post/feed API, moderation service integration, geo proxy, admin panel and analytics, HTTPS setup, backend bug fixes, Swagger docs, backend unit testing.

---

## grbuchne — Technical Lead, developer

Gregor set up the entire frontend structure early on. The initial commit with all the components — Navbar, PostCard, PostFeed, Map, Hero, ProfileModal, ProfileDropdown, all the page layouts — that was his. He defined how the frontend was organized and built the foundation that the rest of the team continued building on.

He also took care of a lot of the initial Docker Compose wiring and was involved in reviewing pull requests throughout the project. A good chunk of the UI patterns that ended up in the final version trace back to how he first set things up.

**Main areas:** frontend scaffolding and component library, initial page structure, map integration, explore page, Docker setup, code reviews.

---

## ekarpawi — Product Owner, developer

Emil built the authentication system from the ground up. Spring Security without the default auto-config, the custom JWT filter, SCrypt password hashing, the registration and login endpoints, and the role/permissions model — all of that came from him. He also wrote the first real set of backend tests (auth controller, user repository, JWT service) and fixed several issues in the authentication flow that showed up later during integration.

He spent a fair bit of time reading Spring Security docs to get the custom filter chain working properly, which ended up being one of the trickier parts of the early backend work.

**Main areas:** authentication system (JWT, Spring Security, custom filter), user entity and roles, registration/login API, backend testing.

---

## demrodri — developer

Demetrio built the group chat feature on the frontend. This meant adding the DMs / Groups tab split to the sidebar, building the group creation modal, handling conversation loading for groups separately from direct messages, the member list panel in the group header, and the leave/rename/add member actions — all wired up through WebSocket and the backend group API. There were a few crashes along the way (like the null activePartner bug after sending a group message) that needed proper debugging before it was stable.

He also worked on the profile and settings pages, fixed a few edge cases with the profile update flow, and added the Privacy Policy and Terms of Service pages that are linked from the footer.

**Main areas:** group chat (full frontend implementation), profile and settings page fixes, privacy and terms pages, various frontend bug fixes.

---

## atamas — DevOps, developer

Tamas handled the infrastructure side and a few backend features. He built the notification system — the entity, service, controller, and tests — and integrated it with WebSocket so notifications arrive in real time. On the DevOps side, he set up the nginx reverse proxy with automatic certificate generation on startup, configured the GitHub Actions CI pipeline for build and test runs, and did a big integration commit that wired up the frontend and WebSocket stack with HTTPS.

He also handled most of the README and kept the project documentation up to date as things changed.

**Main areas:** notification system (backend + WebSocket), nginx reverse proxy, TLS certificates, GitHub Actions CI, frontend/HTTPS integration, project documentation.

---

# Resources

## Frameworks and Libraries
- [Next.js](https://nextjs.org/docs) — frontend framework
- [React](https://react.dev/) — UI library
- [Tailwind CSS](https://tailwindcss.com/docs) — styling
- [Spring Boot](https://docs.spring.io/spring-boot/docs/current/reference/html/) — backend framework
- [Spring Security](https://docs.spring.io/spring-security/reference/) — authentication and access control
- [Spring Data JPA](https://docs.spring.io/spring-data/jpa/docs/current/reference/html/) — database ORM
- [Spring WebSocket / STOMP](https://docs.spring.io/spring-framework/docs/current/reference/html/web.html#websocket) — real-time messaging
- [auth0/java-jwt](https://github.com/auth0/java-jwt) — JWT creation and verification
- [STOMP.js + SockJS](https://stomp-js.github.io/stomp-websocket/) — WebSocket client
- [React Leaflet](https://react-leaflet.js.org/) — interactive maps
- [Recharts](https://recharts.org/) — charts in the admin dashboard
- [FastAPI](https://fastapi.tiangolo.com/) — moderation service
- [Flask](https://flask.palletsprojects.com/) — geo service
- [springdoc-openapi](https://springdoc.org/) — Swagger / API documentation
- [Testcontainers](https://testcontainers.com/) — integration testing with real DB

## Infrastructure
- [Docker](https://docs.docker.com/) — containerization
- [Docker Compose](https://docs.docker.com/compose/) — service orchestration
- [PostgreSQL](https://www.postgresql.org/docs/) — database
- [nginx](https://nginx.org/en/docs/) — reverse proxy
- [Ollama](https://ollama.com/) / [Docker Model Runner](https://docs.docker.com/ai/model-runner/) — local LLM hosting (Qwen 2.5 3B)
- [GitHub Actions](https://docs.github.com/en/actions) — CI/CD

## Learning and Reference
- [42 ft_transcendence subject](transcendence.md)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/) — security checklist
- [JWT.io](https://jwt.io/) — JWT debugging tool