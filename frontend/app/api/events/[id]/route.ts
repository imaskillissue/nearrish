/**
 * /api/events/[id] — single-event endpoints
 *
 * GET    — Returns one event with full creator info + attendee count.
 *           Auth: optional.
 *
 * PATCH  — Updates an event's fields.
 *           Body: any subset of { title, description, categories, startDate,
 *                                 endDate, address, photo, capacity, price,
 *                                 minAge, petFriendly }
 *           Only the event's creator may update it.
 *           Auth: required; 403 if a different user tries to edit.
 *
 * DELETE — Hard-deletes the event.
 *           Only the event's creator may delete it.
 *           Auth: required; 403 if a different user tries to delete.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const EVENT_SELECT = {
  id:          true,
  title:       true,
  description: true,
  categories:  true,
  startDate:   true,
  endDate:     true,
  address:     true,
  photo:       true,
  photoX:      true,
  photoY:      true,
  capacity:    true,
  price:       true,
  minAge:      true,
  petFriendly: true,
  mode:        true,
  createdAt:   true,
  creatorId:   true,
  creator: {
    select: { id: true, name: true, nickname: true, photo: true },
  },
  _count: { select: { attendees: true } },
} as const;

// ── GET /api/events/[id] ──────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: EVENT_SELECT });
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(event);
}

// ── PATCH /api/events/[id] ────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Verify ownership before applying any changes
  const existing = await prisma.event.findUnique({ where: { id }, select: { creatorId: true } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.creatorId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.title       !== undefined) data.title       = String(body.title).trim();
  if (body.description !== undefined) data.description = String(body.description).trim();
  if (body.categories  !== undefined) data.categories  = body.categories;
  if (body.startDate   !== undefined) data.startDate   = new Date(body.startDate);
  if (body.endDate     !== undefined) data.endDate     = body.endDate ? new Date(body.endDate) : null;
  if (body.address     !== undefined) data.address     = String(body.address).trim();
  if (body.photo       !== undefined) data.photo       = body.photo ?? null;
  if (body.photoX      !== undefined) data.photoX      = Number(body.photoX);
  if (body.photoY      !== undefined) data.photoY      = Number(body.photoY);
  if (body.capacity    !== undefined) data.capacity    = Number(body.capacity);
  if (body.price       !== undefined) data.price       = Number(body.price);
  if (body.minAge      !== undefined) data.minAge      = Number(body.minAge);
  if (body.petFriendly !== undefined) data.petFriendly = Boolean(body.petFriendly);
  if (body.mode        !== undefined) data.mode        = body.mode;

  const updated = await prisma.event.update({ where: { id }, data, select: EVENT_SELECT });
  return NextResponse.json({ ok: true, event: updated });
}

// ── DELETE /api/events/[id] ───────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.event.findUnique({ where: { id }, select: { creatorId: true } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.creatorId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.event.delete({ where: { id } }),
    prisma.user.update({
      where: { id: userId },
      data:  { events: { decrement: 1 } },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
