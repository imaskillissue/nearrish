# Frontend Setup

## Requirements

- Node.js 20+
- PostgreSQL running locally

## 1) Configure Environment

Prisma reads `DATABASE_URL` from `.env`.

Create `frontend/.env` with:

```dotenv
DATABASE_URL="postgresql://<your-user>@localhost/<your-db-name>"
NEXTAUTH_SECRET="dev-secret-1234567890"
```

## 2) Install Dependencies

```bash
npm install
```

## 3) Apply Migrations

Normal migration run:

```bash
npx prisma migrate dev
```

If local schema/data is broken and you want a clean reset:

```bash
npx prisma migrate reset --force
```

## 4) Start App

```bash
npm run dev
```

If Turbopack is slow/stuck on your machine:

```bash
npm run dev:webpack
```

Open http://localhost:3000

## 5) Seed Sample Data (Optional, Recommended After Reset)

Use this after `prisma migrate reset` so the app has demo content again.

1. Register at least one user (required, because events need a creator).
2. Seed events from the UI on the Events page (`SEED SAMPLE EVENTS`) when no events exist.
3. Or seed directly via API:

```bash
curl -X POST http://localhost:3000/api/events/seed
```

Note: after `prisma migrate reset`, your DB is empty again, so seed data must be created again.
