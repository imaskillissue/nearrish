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
![Database Schema](./assets/database_diagram.png)
# Feature List
## User Accounts and Authentication
- User registration and login with JWT session tokens
- Authenticated profile access and editing
- Avatar upload support
- Session based signed in experience with protected pages
## Social Feed and Posting
- Public and authenticated feed views
- Create post with text
- Optional image upload for posts
- Optional location coordinates on posts
- Visibility modes (public vs friends only)
## Likes, Comments, and Replies
- Like and unlike for posts and comments
- Comment creation and deletion
- Comment and like counts for engagement
## Friends System
- Send, accept, decline, and cancel friend requests
- Unfriend existing connections
- Incoming and outgoing request lists
- Friendship status lookup per user
- Friends page with status badges and quick actions
## Direct Messaging
- 1:1 conversation creation and message exchange
- Conversation list with unread counters
- Mark conversation as read
- Message thread loading with pagination behavior
## Real-Time Features (WebSocket/STOMP)
- Real-time friend request updates
- Real-time chat notification updates
- Real-time online/offline presence broadcasts
## Explore and Geo Features
- Explore page with map + nearby geo-tagged posts
- Reverse geocoding integration for location labels
- Public and authenticated geo feed
## Safety, Blocking, and Moderation
- Block and unblock users
- Moderation queue and toxicity analysis
- Separate moderation service in project structure
## Admin and Analytics
- Admin verification and user management
- Moderation queue and analysis tools
- Admin dashboards

# Modules
- Use a frontend framework
- Use a backend framework
- 2FA system
- Basic chat system
- Support for additional browsers
- Standard user managment and authentication
- Notification system
- Real time features using WebSockets
- Content moderation AI
- Backend as microservices
- Advanced analytics dashboard
- User activity analytics and insights dashboard
- Sentiment analysis for user-generated content
- Custom-made design system with reusable components


# Individual Contribution
## atamas
- project setup (Makefile, docker compose) for frontend and backend with nginx reverse proxy
- self signed ssl certificate on `make`
- notification system with real time feature
- API documentation with swagger
- project documentation
- PR reviews

# Resources
- Maven 5 minutes
https://maven.apache.org/guides/getting-started/maven-in-five-minutes.html
- A short guide to Maven
https://www.marcobehler.com/guides/mvn-clean-install-a-short-guide-to-maven
- Build JAVA code with maven in a DOCKER container
https://mfarache.github.io/mfarache/Using-docker-in-your-development-process/
- How to design database for social media platform
https://www.geeksforgeeks.org/sql/how-to-design-database-for-social-media-platform/
- Installing Next.js
https://nextjs.org/docs/app/getting-started/installation#system-requirements
- Real time notifications in spring boot with websockets
https://www.youtube.com/watch?v=sqYqyr6EpAU