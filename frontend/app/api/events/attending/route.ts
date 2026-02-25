/**
 * GET /api/events/attending
 *
 * Returns an array of eventIds the currently logged-in user is attending.
 * Used by the Events page to determine which ATTEND buttons to render as active.
 *
 * Response (logged in):  string[]   — eventIds
 * Response (logged out): []         — empty array (not an error)
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json([]);

  const rows = await prisma.eventAttendee.findMany({
    where:  { userId },
    select: { eventId: true },
  });

  return NextResponse.json(rows.map(r => r.eventId));
}
