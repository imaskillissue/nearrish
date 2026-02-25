/**
 * GET /api/friends/requests
 *
 * Returns the count of pending incoming friend requests for the current user.
 * Used by the Navbar to show a badge on the Friends link.
 * Auth: required — returns { count: 0 } if unauthenticated.
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ count: 0 });

  const count = await prisma.friendship.count({
    where: { receiverId: userId, status: 'PENDING' },
  });

  return NextResponse.json({ count });
}
