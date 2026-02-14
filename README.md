# Nearrish

Location-based social platform — posts on a map, chat, content moderation.

## Architecture

```
                 ┌──────────┐
        :443/:80 │  Nginx   │
                 └────┬─────┘
            ┌─────────┼──────────┐
            v         v          v
       ┌─────────┐ ┌─────────┐ ┌───────────┐
       │Frontend │ │ Backend │ │Geo Service│
       │Next.js  │ │Spring   │ │Flask      │
       │  :3000  │ │  :8080  │ │   :5002   │
       └─────────┘ └────┬────┘ └─────┬─────┘
                        │            │
                   ┌────v────┐  ┌────v──────┐
                   │Postgres │  │Moderation │
                   │  :5432  │  │Phi-3 LLM  │
                   └─────────┘  │   :5000   │
                                └───────────┘
```

- **Frontend**: Next.js + Leaflet map + Tailwind
- **Backend**: Spring Boot REST API, orchestrates moderation + geo calls
- **Moderation**: Flask + llama-cpp-python running Phi-3 locally, scores content 0-9
- **Geo Service**: Flask + PostGIS-style queries (Haversine, bounding box, clustering)
- **Nginx**: TLS termination, reverse proxy for all services

## Setup

```bash
cp .env.example .env
cp secrets/db_password.txt.example secrets/db_password.txt
# fill in DB_NAME, DB_USER in .env and set a password in secrets/db_password.txt

make all      # generates certs, builds containers, starts everything
```

First boot takes a while because the moderation service downloads the Phi-3 model (~2.5 GB).

### Makefile targets

- `make all` — build + start
- `make up` — start without rebuild
- `make down` — stop
- `make local` — DB in docker, backend with maven locally
- `make fclean` — nuke everything (volumes, images)
- `make re` — restart

## API overview

### Posts (`/api/posts`)
- `POST /api/posts` — create post (with optional lat/lng), moderation auto-scores it
- `GET /api/posts` — list all (supports `?south=&north=&west=&east=` for geo filter)
- `GET /api/posts/{id}` — single post
- `DELETE /api/posts/{id}` — delete

### Chat (`/api/chat`)
- `POST /api/chat` — send message (moderated)
- `GET /api/chat` — last 50 messages

### Moderation (`/moderate`)
- `POST /moderate` — score content, returns severity 0-9
- `GET /health` — health + cache stats

### Geo (`/geo/*`)
- `POST /geo/search` — bounding box query
- `POST /geo/radius` — haversine radius search
- `POST /geo/cluster` — grid clustering for map overview
- `GET /geo/reverse?lat=&lng=` — activity detection around point
- `GET /geo/stats` — global stats

## Moderation severity

| Score | Meaning |
|-------|---------|
| 0-2 | clean |
| 3-4 | questionable |
| 5-6 | inappropriate (warned) |
| 7-8 | toxic (warned) |
| 9 | dangerous (blocked) |

## Config

Environment is configured via `.env` + Docker secrets (see `.env.example`). DB password goes in `secrets/db_password.txt`.

Backend picks up `SPRING_DATASOURCE_*` env vars in docker, or use `application-local.properties` for `make local`.
