/**
 * Prisma client singleton for the NEAR app.
 *
 * Why a singleton?
 *   Next.js hot-reload (in development) re-evaluates modules on every file save,
 *   which would normally create a new PrismaClient — and therefore a new PostgreSQL
 *   connection pool — on each reload. With many reloads this exhausts the DB's
 *   connection limit and causes a ~15–20 s cold-start penalty.
 *
 * Solution: cache the instance on Node's `global` object between hot-reloads.
 *   - In development:  the cached instance is reused across reloads.
 *   - In production:   each serverless function invocation calls createClient()
 *                      once and holds it for the lifetime of the function.
 *
 * The PrismaPg adapter connects Prisma to Postgres using the standard
 * `DATABASE_URL` environment variable (postgresql://… connection string).
 *
 * Usage throughout the app:
 *   import prisma from '@/lib/prisma';
 *   const user = await prisma.user.findUnique({ ... });
 */
import { PrismaClient } from '@prisma/client';
// Cast global to a type that includes our optional prisma property.
const globalForPrisma = global as typeof globalThis & { prisma?: PrismaClient };

const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
