/**
 * POST /api/friends/unfriend
 *
 * Removes an existing friendship between the caller and another user.
 *
 * Body: { targetId: string }
 *
 * Steps:
 *   1. Finds the ACCEPTED Friendship row in either direction
 *      (A→B or B→A — it doesn't matter who sent the original request).
 *   2. Runs three DB operations atomically via $transaction:
 *        a. Delete the Friendship row
 *        b. Decrement the caller's friends counter by 1
 *        c. Decrement the target's friends counter by 1
 *      Using $transaction prevents counter drift if any individual operation fails.
 *
 * After this call the two users will show status=NONE on the Friends page,
 * and either can send a new friend request again.
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
  if (!targetId) return NextResponse.json({ error: 'Missing targetId' }, { status: 400 });

  // Friendship rows can be stored in either direction depending on who sent the
  // original request, so we check both (A→B) and (B→A).
  const record = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { senderId: meId,     receiverId: targetId },
        { senderId: targetId, receiverId: meId     },
      ],
    },
  });
  if (!record) return NextResponse.json({ error: 'Not friends' }, { status: 404 });

  // Atomic: delete the row and decrement both counters in a single transaction
  await prisma.$transaction([
    prisma.friendship.delete({ where: { id: record.id } }),
    prisma.user.update({ where: { id: meId },      data: { friends: { decrement: 1 } } }),
    prisma.user.update({ where: { id: targetId },  data: { friends: { decrement: 1 } } }),
  ]);

  return NextResponse.json({ ok: true });
}
