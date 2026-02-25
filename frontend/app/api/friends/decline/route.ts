/**
 * POST /api/friends/decline
 *
 * Handles two use cases with a single endpoint:
 *
 *   A) Decline an incoming request (the other person sent it to you):
 *        Body: { fromUserId: string }
 *
 *   B) Cancel an outgoing request (you sent it and want to withdraw):
 *        Body: { targetId: string }
 *
 * In both cases the PENDING Friendship row is simply deleted.
 * No counter changes are needed because a PENDING request doesn't affect
 * the `friends` counter — only ACCEPTED friendships do.
 *
 * The findFirst query uses OR conditions covering all possible combinations of
 * (senderId, receiverId) that could match either scenario, so the same logic
 * works regardless of which field the client sends.
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

  const body = await req.json();
  // Accept either field name so callers don't need to know who "sent" the request
  const fromUserId = body.fromUserId as string | undefined;
  const targetId   = body.targetId   as string | undefined;
  const otherId    = fromUserId ?? targetId;
  if (!otherId) return NextResponse.json({ error: 'Missing user id' }, { status: 400 });

  // Find the pending record regardless of direction.
  // Scenario A (decline): senderId=fromUserId, receiverId=meId
  // Scenario B (cancel):  senderId=meId,       receiverId=targetId
  const record = await prisma.friendship.findFirst({
    where: {
      status: 'PENDING',
      OR: [
        { senderId: fromUserId ?? meId, receiverId: targetId ?? meId },
        { senderId: meId,  receiverId: fromUserId ?? otherId },
        { senderId: otherId, receiverId: meId },
      ],
    },
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Delete by primary key (id) to avoid re-running the OR filter
  await prisma.friendship.delete({ where: { id: record.id } });
  return NextResponse.json({ ok: true });
}
