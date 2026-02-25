import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// /api/search-events?query=foo
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query')?.trim();
  if (!query) return NextResponse.json([]);

  const events = await prisma.event.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { address: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      address: true,
      photo: true,
      photoX: true,
      photoY: true,
      categories: true,
      mode: true,
      petFriendly: true,
      minAge: true,
      price: true,
      capacity: true,
      creatorId: true,
      creator: {
        select: {
          nickname: true,
          photo: true,
        },
      },
      _count: {
        select: {
          attendees: true,
        },
      },
    },
    orderBy: { startDate: 'asc' },
    take: 10,
  });
  return NextResponse.json(
    events.map((event) => ({
      ...event,
      price: event.price ?? 0,
      capacity: event.capacity ?? 0,
      _count: {
        attendees: event._count?.attendees ?? 0,
      },
    }))
  );
}
