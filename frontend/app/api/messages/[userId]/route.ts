/**
 * /api/messages/[userId] — thread-level message endpoints
 *
 * GET  — Returns all messages between the current user and [userId]
 *         in chronological order (oldest first).
 *         Also marks all received messages in this thread as read.
 *         Auth: required.
 *
 * POST — Sends a new message to [userId].
 *         Body: { content: string }
 *         Auth: required.
 *         Returns: the created message.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ── GET /api/messages/[userId] ────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth();
  const currentUserId = session?.user?.id;
  if (!currentUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId: otherId } = await params;

  // Fetch thread in chronological order
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: currentUserId, receiverId: otherId },
        { senderId: otherId,       receiverId: currentUserId },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id:        true,
      content:   true,
      createdAt: true,
      readAt:    true,
      senderId:  true,
    },
  });

  // Mark all unread incoming messages as read
  await prisma.message.updateMany({
    where: {
      senderId:   otherId,
      receiverId: currentUserId,
      readAt:     null,
    },
    data: { readAt: new Date() },
  });

  return NextResponse.json(messages.map(m => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
    readAt:    m.readAt?.toISOString() ?? null,
  })));
}

// ── POST /api/messages/[userId] ───────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth();
  const senderId = session?.user?.id;
  if (!senderId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId: receiverId } = await params;
  if (senderId === receiverId) {
    return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });
  }

  const { content } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }

  // Verify recipient exists
  const recipient = await prisma.user.findUnique({ where: { id: receiverId }, select: { id: true } });
  if (!recipient) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });

  // Only friends may message each other
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    },
    select: { id: true },
  });
  if (!friendship) {
    return NextResponse.json({ error: 'You can only message friends' }, { status: 403 });
  }

  const message = await prisma.message.create({
    data: { content: content.trim(), senderId, receiverId },
    select: { id: true, content: true, createdAt: true, senderId: true },
  });

  return NextResponse.json({
    ...message,
    createdAt: message.createdAt.toISOString(),
    readAt: null,
  }, { status: 201 });
}
