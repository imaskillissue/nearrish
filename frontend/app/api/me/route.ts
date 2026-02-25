/**
 * GET /api/me
 *
 * Returns the currently authenticated user's ID and avatar.
 * Used by the Navbar to display the user's photo in the profile button,
 * and by the admin page to identify which user owns the active session.
 *
 * Response (logged in):  { userId: string, avatar: string | null }
 * Response (logged out): { userId: null,   avatar: null }
 *
 * The userId comes from the JWT cookie (via `auth()`).
 * The avatar is fetched from Postgres because it can change without re-login.
 *
 * Auth: optional — always returns 200, with nulls when unauthenticated.
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  // Read the user's id from the JWT cookie (no DB round-trip for the id itself)
  const session = await auth();
  const userId = session?.user?.id ?? null;

  if (!userId) {
    return NextResponse.json({ userId: null, avatar: null });
  }

  // Fetch only the photo column — the id is already in the session
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { photo: true },
  });

  return NextResponse.json({ userId, avatar: user?.photo ?? null });
}
