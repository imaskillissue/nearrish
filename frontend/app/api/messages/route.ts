/**
 * GET /api/messages
 *
 * Returns the current user's conversation list.
 * Each entry contains the partner's profile info, the last message,
 * and the count of unread messages (received by current user, readAt=null).
 *
 * Response: { partner, lastMessage, unread }[]  sorted by lastMessage.createdAt desc
 * Auth: required — 401 if unauthenticated.
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch all messages involving the current user, most recent first
  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    orderBy: { createdAt: 'desc' },
    select: {
      id:         true,
      content:    true,
      createdAt:  true,
      readAt:     true,
      senderId:   true,
      receiverId: true,
      sender:   { select: { id: true, name: true, nickname: true, photo: true } },
      receiver: { select: { id: true, name: true, nickname: true, photo: true } },
    },
  });

  // Group by the other party (partner)
  const convMap = new Map<string, {
    partner: { id: string; name: string; nickname: string; photo: string | null };
    lastMessage: { content: string; createdAt: string; senderId: string };
    unread: number;
  }>();

  for (const msg of messages) {
    const isOutgoing = msg.senderId === userId;
    const partnerId  = isOutgoing ? msg.receiverId : msg.senderId;
    const partner    = isOutgoing ? msg.receiver   : msg.sender;

    if (!convMap.has(partnerId)) {
      // First (most-recent) message for this partner
      convMap.set(partnerId, {
        partner,
        lastMessage: {
          content:   msg.content,
          createdAt: msg.createdAt.toISOString(),
          senderId:  msg.senderId,
        },
        unread: 0,
      });
    }

    // Count unread incoming messages
    if (!isOutgoing && !msg.readAt) {
      convMap.get(partnerId)!.unread += 1;
    }
  }

  return NextResponse.json([...convMap.values()]);
}
