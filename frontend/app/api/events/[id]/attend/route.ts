/**
 * /api/events/[id]/attend — attend / unattend an event
 *
 * POST   — Mark the logged-in user as attending this event.
 *           Creates an EventAttendee row and increments user.attendedEvents.
 *           Idempotent: returns 200 if already attending.
 *           Auth: required.
 *
 * DELETE — Remove attendance.
 *           Deletes the EventAttendee row and decrements user.attendedEvents (min 0).
 *           Auth: required.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ── POST /api/events/[id]/attend ──────────────────────────────────────────────
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: eventId } = await params;

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, capacity: true } });
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Already attending — return ok (idempotent)
  const existing = await prisma.eventAttendee.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (existing) return NextResponse.json({ ok: true, alreadyAttending: true });

  // Check capacity (0 = unlimited)
  if (event.capacity > 0) {
    const count = await prisma.eventAttendee.count({ where: { eventId } });
    if (count >= event.capacity) {
      return NextResponse.json({ error: 'Event is full' }, { status: 409 });
    }
  }

  // Create attendance row and increment user counter atomically
  await prisma.$transaction([
    prisma.eventAttendee.create({ data: { eventId, userId } }),
    prisma.user.update({
      where: { id: userId },
      data:  { attendedEvents: { increment: 1 } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

// ── DELETE /api/events/[id]/attend ────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: eventId } = await params;

  const existing = await prisma.eventAttendee.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (!existing) return NextResponse.json({ ok: true, wasNotAttending: true });

  // Delete attendance row and decrement user counter atomically (never below 0)
  await prisma.$transaction([
    prisma.eventAttendee.delete({ where: { eventId_userId: { eventId, userId } } }),
    prisma.user.update({
      where: { id: userId },
      data:  { attendedEvents: { decrement: 1 } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
