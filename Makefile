NAME = nearrish

HAS_MODEL_RUNNER := $(shell docker model list 2>/dev/null | grep -q llama3.2 && echo 1 || echo 0)

ifeq ($(HAS_MODEL_RUNNER),1)
PROFILES =
else
PROFILES = --profile ollama
endif

all:
	@if [ "$(HAS_MODEL_RUNNER)" = "1" ]; then \
		echo "[nearrish] Docker model runner detected — pulling models on host..."; \
		docker model pull ai/llama3.2; \
		docker model pull ai/smollm2; \
	else \
		echo "[nearrish] No model runner — Ollama will handle models"; \
	fi
	docker compose -p ${NAME} ${PROFILES} up -d --build

up:
	docker compose -p ${NAME} ${PROFILES} up -d

backend:
	docker compose -p ${NAME} up -d --build backend
	docker logs -f ${NAME}-backend-1

local:
	docker compose -p ${NAME} up -d database
	mvn -f backend/demo/pom.xml clean package -Dspring.profiles.active=local
	java -jar backend/demo/target/*.jar --spring.profiles.active=local

down:
	docker compose -p ${NAME} down

fclean: down
	docker volume rm -f ${NAME}_db-data ${NAME}_ollama-data
	docker system prune --all --force --volumes

re: down all

.PHONY: all up down fclean re local backend
