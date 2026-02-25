/**
 * POST /api/friends/request
 *
 * Sends a friend request from the logged-in user to another user.
 *
 * Body: { targetId: string }
 *
 * A Friendship row is created with status = "PENDING".
 * The schema enforces a unique constraint on (senderId, receiverId), so
 * duplicate requests in the same direction would fail at the DB level.
 * We check both directions in advance (with findFirst) to return a clearer
 * 409 Conflict instead of a raw Prisma error.
 *
 * Auth: required — 401 if not logged in.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await auth();
  const meId = session?.user?.id;
  if (!meId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { targetId } = await req.json();
  // Prevent sending a request to yourself or with a missing target
  if (!targetId || targetId === meId) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
  }

  // Check both directions: A→B and B→A are both disallowed if any row exists.
  // This prevents duplicate requests and implicit re-requests after unfriending
  // (unfriend deletes the row, so re-requesting is allowed after that).
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { senderId: meId,     receiverId: targetId },
        { senderId: targetId, receiverId: meId     },
      ],
    },
  });
  if (existing) {
    return NextResponse.json({ error: 'Friendship already exists' }, { status: 409 });
  }

  // Create the pending row; the other user will see it as PENDING_RECEIVED
  await prisma.friendship.create({
    data: { senderId: meId, receiverId: targetId, status: 'PENDING' },
  });

  return NextResponse.json({ ok: true });
}
