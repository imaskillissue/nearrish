NAME = nearrish

all:
	docker compose -p ${NAME} up -d --build

up:
	docker compose -p ${NAME} up -d

down:
	docker compose -p ${NAME} down

fclean: down
	docker volume rm -f ${NAME}_db-data
	docker system prune --all --force --volumes

re: down all

.PHONY: all up down fclean re