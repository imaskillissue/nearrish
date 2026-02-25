/**
 * /api/events — event collection endpoints
 *
 * GET  — Returns all events, soonest first, with full creator info + attendee count.
 *         Auth: optional — anyone can view events.
 *
 * POST — Creates a new event owned by the logged-in user.
 *         Body: { title, description, categories, startDate (ISO), endDate? (ISO),
 *                 address, photo?, capacity?, price?, minAge?, petFriendly? }
 *         Returns: { ok: true, event }
 *         Auth: required — 401 if not logged in.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// Force dynamic rendering so newly-created events are always visible immediately.
export const dynamic = 'force-dynamic';

// SELECT fields included in every event response
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

// ── GET /api/events ───────────────────────────────────────────────────────────
export async function GET() {
  const events = await prisma.event.findMany({
    select:  EVENT_SELECT,
    orderBy: { startDate: 'asc' }, // upcoming events first
  });
  return NextResponse.json(events);
}

// ── POST /api/events ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  const creatorId = session?.user?.id;
  if (!creatorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { title, description, categories, startDate, endDate,
          address, photo, photoX, photoY, capacity, price, minAge,
          petFriendly, mode } = body;

  // Validate required fields
  if (!title?.trim() || !description?.trim() || !Array.isArray(categories) ||
      categories.length === 0 || !startDate || !address?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const event = await prisma.event.create({
    data: {
      title:       title.trim(),
      description: description.trim(),
      categories,
      startDate:   new Date(startDate),
      endDate:     endDate ? new Date(endDate) : null,
      address:     address.trim(),
      photo:       photo ?? null,
      photoX:      photoX != null ? Number(photoX) : 50,
      photoY:      photoY != null ? Number(photoY) : 50,
      capacity:    capacity != null ? Number(capacity) : 0,
      price:       price    != null ? Number(price)    : 0,
      minAge:      minAge   != null ? Number(minAge)   : 0,
      petFriendly: Boolean(petFriendly),
      mode:        mode ?? 'PRESENCIAL',
      creatorId,
    },
    select: EVENT_SELECT,
  });

  // Increment creator's event counter
  await prisma.user.update({
    where: { id: creatorId },
    data:  { events: { increment: 1 } },
  });

  return NextResponse.json({ ok: true, event });
}
