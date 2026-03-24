# =============================================================================
# PREREQUISITES — Docker Model Runner (recommended, faster than Ollama)
# =============================================================================
# If you have Docker Desktop >= 4.40, you can use the built-in model runner.
# Run these once before starting the project:
#
#   docker model pull ai/qwen2.5:3B-Q4_K_M
#
# Then verify it's available:
#
#   docker model list
#
# If Docker Model Runner is not available, Ollama will be used automatically
# as a fallback — no extra setup needed in that case.
# =============================================================================

NAME = nearrish

# Content moderation — set MODERATION_ENABLED=false in .env to disable
# e.g.: echo "MODERATION_ENABLED=false" >> .env

# =============================================================================
# MAKE A USER AN ADMIN
# =============================================================================
# Connect to the running database and insert the ADMIN role for the user:
#
#   docker exec nearrish-database-1 psql -U social_user -d social_media \
#     -c "INSERT INTO user_roles (user_id, roles) \
#         SELECT id, 'ADMIN' FROM users WHERE username = '<username>';"
#
# To revoke:
#   docker exec nearrish-database-1 psql -U social_user -d social_media \
#     -c "DELETE FROM user_roles WHERE roles = 'ADMIN' \
#         AND user_id = (SELECT id FROM users WHERE username = '<username>');"
#
# The user must re-login after this change for the new token to include ADMIN.
# =============================================================================

HAS_MODEL_RUNNER := $(shell docker model list > /dev/null 2>&1 && echo 1 || echo 0)

ifeq ($(HAS_MODEL_RUNNER),1)
PROFILES =
COMPOSE_FILES = -f docker-compose.yml
else
PROFILES = --profile ollama
COMPOSE_FILES = -f docker-compose.yml -f docker-compose.ollama.yml
endif

all: certs
	@if [ "$(HAS_MODEL_RUNNER)" = "1" ]; then \
		echo "[nearrish] Docker model runner detected — pulling ai/qwen2.5:3B-Q4_K_M..."; \
		docker model pull ai/qwen2.5:3B-Q4_K_M; \
	else \
		echo "[nearrish] No model runner — Ollama will pull qwen2.5:3b on startup"; \
	fi
	docker compose -p ${NAME} ${COMPOSE_FILES} up -d database
	docker compose -p ${NAME} ${COMPOSE_FILES} ${PROFILES} up -d --build

up:
	docker compose -p ${NAME} ${COMPOSE_FILES} ${PROFILES} up -d

backend:
	docker compose -p ${NAME} up -d --build backend
	docker logs -f ${NAME}-backend-1

local:
	docker compose -p ${NAME} up -d database
	mvn -f backend/demo/pom.xml clean package -Dspring.profiles.active=local
	java -jar backend/demo/target/*.jar --spring.profiles.active=local

certs:
	@echo "Generating self-signed certificates..."
	mkdir -p nginx/certs
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout nginx/certs/privkey.pem \
		-out nginx/certs/fullchain.pem \
		-subj "/C=US/ST=State/L=City/O=Development/CN=localhost"
	@echo "Certificates generated in nginx/certs/"

front:
	docker compose -p ${NAME} ${COMPOSE_FILES} up -d --build frontend
	docker exec ${NAME}-nginx-1 nginx -s reload

down:
	docker compose -p ${NAME} down

fclean: down
	docker volume rm -f ${NAME}_db-data ${NAME}_ollama-data ${NAME}_upload-data
	docker system prune --all --force --volumes

re: down all

.PHONY: all up down front fclean re local backend certs
