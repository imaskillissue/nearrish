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

# Individual Contribution

# Resources