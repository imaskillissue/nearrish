# 1) Set .env 
DATABASE_URL='postgresql://greggi@localhost/near_dev' npx prisma migrate reset --force

# 2) Start Next.js
npm run dev

# If compile is too slow/hangs, use webpack fallback:
# npm run dev:webpack