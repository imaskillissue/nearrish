NAME = nearrish

all: certs
	docker compose -p ${NAME} up -d --build

up:
	docker compose -p ${NAME} up -d

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

down:
	docker compose -p ${NAME} down

fclean: down
	docker volume rm -f ${NAME}_db-data ${NAME}_upload-data
	docker system prune --all --force --volumes

re: down all

.PHONY: all up down fclean re local backend certs