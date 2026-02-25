/**
 * POST /api/events/seed
 *
 * One-time development utility — seeds 10 sample events into the database.
 * Idempotent: returns 409 if events already exist.
 * Requires at least one registered user (used as creator).
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST() {
  const existingCount = await prisma.event.count();
  if (existingCount > 0) {
    return NextResponse.json(
      { error: `Already seeded — ${existingCount} events exist.` },
      { status: 409 }
    );
  }

  const creator = await prisma.user.findFirst({ select: { id: true } });
  if (!creator) {
    return NextResponse.json(
      { error: 'No users found. Register at least one user before seeding.' },
      { status: 400 }
    );
  }

  const creatorId = creator.id;

  const seeds = [
    {
      title: 'Summer Salsa Night',
      description: 'An energetic evening of salsa dancing for all skill levels. Beginner lessons at 19:00, open dance floor from 20:30.',
      categories: ['SHOWS'], startDate: new Date('2026-03-07T19:00:00'), endDate: new Date('2026-03-07T23:30:00'),
      address: 'Kulturbrauerei, Schönhauser Allee 36, 10435 Berlin',
      capacity: 80, price: 12, minAge: 18, petFriendly: false, mode: 'PRESENCIAL',
    },
    {
      title: 'Berlin Street Photography Walk',
      description: "Explore Kreuzberg through a lens. Bring your camera or phone and we'll spend two hours capturing urban life. All skill levels welcome.",
      categories: ['CREATIVE'], startDate: new Date('2026-03-10T10:00:00'), endDate: new Date('2026-03-10T12:00:00'),
      address: 'Warschauer Brücke, Warschauer Straße 1, 10243 Berlin',
      capacity: 20, price: 0, minAge: 0, petFriendly: true, mode: 'PRESENCIAL',
    },
    {
      title: 'Vegan Street Food Festival',
      description: 'Twenty food vendors serving plant-based dishes from around the world. Live music, craft drinks, and a zero-waste philosophy.',
      categories: ['FOOD', 'SHOWS'], startDate: new Date('2026-03-12T12:00:00'), endDate: new Date('2026-03-12T21:00:00'),
      address: 'Mauer Park, Eberswalder Straße, 10437 Berlin',
      capacity: 0, price: 0, minAge: 0, petFriendly: true, mode: 'PRESENCIAL',
    },
    {
      title: 'Speed Networking — Tech Edition',
      description: 'Meet 20+ Berlin-based founders, designers, and developers in 90 minutes. Three-minute rounds, elevator pitches welcome.',
      categories: ['COMERCIAL'], startDate: new Date('2026-03-14T18:30:00'), endDate: new Date('2026-03-14T20:00:00'),
      address: 'https://meet.jit.si/NearSpeedNetworking',
      capacity: 30, price: 10, minAge: 18, petFriendly: false, mode: 'ONLINE',
    },
    {
      title: 'Board Game Afternoon',
      description: "Catan, Ticket to Ride, Codenames, Wingspan — we've got them all. Show up, pick a game, meet new people. Snacks and drinks available.",
      categories: ['GAMES'], startDate: new Date('2026-03-15T15:00:00'), endDate: new Date('2026-03-15T23:00:00'),
      address: 'The Barn Coffee Roasters, Auguststraße 58, 10119 Berlin',
      capacity: 24, price: 5, minAge: 0, petFriendly: false, mode: 'PRESENCIAL',
    },
    {
      title: 'Jazz & Wine at Clärchens Ballhaus',
      description: 'An intimate jazz quartet in the historic Spiegelsaal. Curated wine selection, candlelit atmosphere. Dress smart-casual.',
      categories: ['CULTURAL', 'FOOD'], startDate: new Date('2026-03-19T20:00:00'), endDate: new Date('2026-03-19T23:00:00'),
      address: 'Clärchens Ballhaus, Auguststraße 24, 10117 Berlin',
      capacity: 60, price: 22, minAge: 18, petFriendly: false, mode: 'PRESENCIAL',
    },
    {
      title: 'Morning Run — Tiergarten 5K',
      description: "A relaxed social run through the Tiergarten. 5K route at a comfortable pace. Coffee at the pavilion afterwards. Free to join!",
      categories: ['MOVEMENT'], startDate: new Date('2026-03-21T08:00:00'), endDate: new Date('2026-03-21T09:30:00'),
      address: 'Tiergarten, S-Bahn Tiergarten station exit, 10785 Berlin',
      capacity: 0, price: 0, minAge: 0, petFriendly: true, mode: 'PRESENCIAL',
    },
    {
      title: 'Charcuterie & Cocktails Pairing',
      description: 'Guided tasting of six artisan charcuterie boards paired with craft cocktails. Hosted by a Berlin mixologist and a French cheesemonger.',
      categories: ['FOOD'], startDate: new Date('2026-03-25T19:30:00'), endDate: new Date('2026-03-25T22:00:00'),
      address: 'Neukölln, Weisestraße 38, 12049 Berlin',
      capacity: 20, price: 45, minAge: 21, petFriendly: false, mode: 'PRESENCIAL',
    },
    {
      title: 'Singles Social Hiking Day',
      description: 'A friendly 12km hike through the Grunewald for single adults aged 25–45. Low pressure, great scenery, packed lunch at the lake.',
      categories: ['RELATIONSHIP', 'MOVEMENT'], startDate: new Date('2026-03-28T09:30:00'), endDate: new Date('2026-03-28T17:00:00'),
      address: 'S-Bahnhof Grunewald, Clayallee, 14195 Berlin',
      capacity: 25, price: 0, minAge: 25, petFriendly: false, mode: 'PRESENCIAL',
    },
    {
      title: 'Watercolour Workshop for Beginners',
      description: "Two-hour intro to watercolour with local artist Anna Köhler. All materials provided. You'll leave with a finished painting. Limited to 12.",
      categories: ['CREATIVE'], startDate: new Date('2026-04-02T14:00:00'), endDate: new Date('2026-04-02T16:00:00'),
      address: 'Atelier Mitte, Neue Schönhauser Str. 13, 10178 Berlin',
      capacity: 12, price: 30, minAge: 0, petFriendly: false, mode: 'PRESENCIAL',
    },
  ];

  await prisma.event.createMany({
    data: seeds.map(s => ({ ...s, creatorId })),
  });

  return NextResponse.json({ ok: true, created: seeds.length });
}
