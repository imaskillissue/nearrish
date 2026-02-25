/**
 * POST /api/friends/accept
 *
 * Accepts an incoming friend request.
 *
 * Body: { fromUserId: string }  — the user who sent the request
 *
 * Steps:
 *   1. Verifies the caller is authenticated.
 *   2. Looks up the Friendship row where fromUserId → meId with status PENDING.
 *      (The direction matters: only the *receiver* can accept.)
 *   3. Runs three DB operations inside a single atomic transaction:
 *        a. Set the Friendship.status to "ACCEPTED"
 *        b. Increment the caller's friends counter by 1
 *        c. Increment the sender's friends counter by 1
 *      Using $transaction ensures all three succeed or all three roll back —
 *      there's no risk of the counters going out of sync with the friendship row.
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

  const { fromUserId } = await req.json();
  if (!fromUserId) return NextResponse.json({ error: 'Missing fromUserId' }, { status: 400 });

  // Confirm the pending request exists and is directed at the caller
  const friendship = await prisma.friendship.findUnique({
    where: { senderId_receiverId: { senderId: fromUserId, receiverId: meId } },
  });
  if (!friendship || friendship.status !== 'PENDING') {
    return NextResponse.json({ error: 'No pending request found' }, { status: 404 });
  }

  // Atomic transaction: flip the status AND update both counters in one DB round-trip
  await prisma.$transaction([
    prisma.friendship.update({
      where: { senderId_receiverId: { senderId: fromUserId, receiverId: meId } },
      data:  { status: 'ACCEPTED' },
    }),
    prisma.user.update({ where: { id: meId },       data: { friends: { increment: 1 } } }),
    prisma.user.update({ where: { id: fromUserId }, data: { friends: { increment: 1 } } }),
  ]);

  return NextResponse.json({ ok: true });
}
