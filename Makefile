NAME = nearrish

all: certs
	docker compose -p ${NAME} up -d --build

up: certs
	docker compose -p ${NAME} up -d

down:
	docker compose -p ${NAME} down

certs:
	@bash nginx/generate-certs.sh

fclean: down
	docker system prune --all --force --volumes

re: down all

.PHONY: all up down fclean re certs