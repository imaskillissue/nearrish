/**
 * GET /api/messages/unread
 *
 * Returns the total count of unread incoming messages for the current user.
 * Used by the Navbar to show a badge on the Messages link.
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

  const count = await prisma.message.count({
    where: { receiverId: userId, readAt: null },
  });

  return NextResponse.json({ count });
}
