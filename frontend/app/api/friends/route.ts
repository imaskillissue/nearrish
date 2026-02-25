/**
 * GET /api/friends
 *
 * Returns every registered user (except the caller) enriched with a `status` field
 * describing the current friendship relationship:
 *
 *   NONE             — no connection exists
 *   PENDING_SENT     — the caller sent a request that hasn't been answered yet
 *   PENDING_RECEIVED — someone sent the caller a request (visible in Messages too)
 *   FRIEND           — both sides have accepted; friendship is ACCEPTED in DB
 *
 * Also returns a `pendingReceived` array (subset of the above) used by the
 * Messages page to show incoming friend requests with timestamps.
 *
 * Auth: optional — unauthenticated callers receive all users with status=NONE.
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  // Read the session from the JWT cookie; meId will be null if not logged in
  const session = await auth();
  const meId = session?.user?.id ?? null;

  // Fetch all users (excluding self when logged in), sorted by name
  const users = await prisma.user.findMany({
    where: meId ? { id: { not: meId } } : {},
    select: {
      id: true, name: true, nickname: true,
      interests: true, photo: true,
      friends: true, events: true, attendedEvents: true,
    },
    orderBy: { name: 'asc' },
  });

  if (!meId) {
    // Unauthenticated — every user is a stranger; no pending requests
    return NextResponse.json({
      users: users.map(u => ({ ...u, status: 'NONE' })),
      pendingReceived: [],
    });
  }

  // Fetch all Friendship rows where the caller is either sender or receiver.
  // One query covers all three statuses (PENDING sent, PENDING received, ACCEPTED).
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ senderId: meId }, { receiverId: meId }],
    },
    select: { senderId: true, receiverId: true, status: true, createdAt: true },
  });

  // Build a map: otherId → status for O(1) lookup when enriching users
  const statusMap = new Map<string, 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIEND'>();
  for (const f of friendships) {
    const otherId = f.senderId === meId ? f.receiverId : f.senderId;
    if (f.status === 'ACCEPTED') {
      statusMap.set(otherId, 'FRIEND');
    } else if (f.senderId === meId) {
      // Caller sent the request → it's waiting on the other person
      statusMap.set(otherId, 'PENDING_SENT');
    } else {
      // Other person sent the request → it's waiting on the caller
      statusMap.set(otherId, 'PENDING_RECEIVED');
    }
  }

  // Attach the computed status to every user row (default: NONE)
  const enriched = users.map(u => ({
    ...u,
    status: statusMap.get(u.id) ?? 'NONE',
  }));

  // pendingReceived: only the inbound requests, with the timestamp they were sent.
  // Used by the Messages page to show "X wants to be your friend (sent on …)".
  const pendingReceived = enriched
    .filter(u => u.status === 'PENDING_RECEIVED')
    .map(u => {
      const fs = friendships.find(f => f.senderId === u.id && f.receiverId === meId);
      return { fromUser: u, createdAt: fs?.createdAt ?? new Date() };
    });

  return NextResponse.json({ users: enriched, pendingReceived });
}
