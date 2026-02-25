/**
 * /api/profile — collection-level profile endpoints
 *
 * GET  — Returns all user profiles (password excluded).
 *         Used by the admin page to list all users.
 *         Response shape: { userId, avatar, name, nickname, email, address,
 *                           interests, attendedEvents, events, friends }[]
 *         Note: `id` is renamed → `userId`, `photo` → `avatar` to match
 *         the field names expected by the profile view components.
 *
 * POST — Registers a new user (name, nickname, email, password, address, interests, avatar).
 *         Validates required fields server-side, hashes the password with bcrypt (12 rounds),
 *         then persists to Postgres via Prisma.
 *         Returns: { ok: true, userId: string }
 *         Errors: 400 missing fields / short password / no interests,
 *                 409 email already in use (Prisma error code P2002),
 *                 500 unexpected DB error.
 *
 * Neither endpoint requires authentication — registration is intentionally public,
 * and the admin list is protected at the page layer (AdminGate in /profile-admin).
 */
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

// Always fetch fresh data — prevents stale counters after events/friends changes.
export const dynamic = 'force-dynamic';

// ── GET /api/profile ──────────────────────────────────────────────────────────
// Returns all stored profiles (minus password) from Postgres.
export async function GET() {
  const all = await prisma.user.findMany({
    select: {
      id:             true,
      name:           true,
      nickname:       true,
      email:          true,
      address:        true,
      interests:      true,
      photo:          true,
      attendedEvents: true,
      events:         true,
      friends:        true,
      // password is intentionally excluded
    },
  });
  // Map id → userId and photo → avatar to match frontend expectations
  const mapped = all.map(({ id, photo, ...rest }) => ({ userId: id, avatar: photo, ...rest }));
  return NextResponse.json(mapped);
}

// ── POST /api/profile ─────────────────────────────────────────────────────────
// Creates a new profile and saves it to Postgres.
export async function POST(req: NextRequest) {
  const { name, nickname, email, password, address, interests, avatar } = await req.json();

  // Server-side validation (mirrors the client-side checks in the registration form)
  if (!name?.trim() || !nickname?.trim() || !email?.trim() || !address?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password too short' }, { status: 400 });
  }
  if (!Array.isArray(interests) || interests.length === 0) {
    return NextResponse.json({ error: 'At least one interest required' }, { status: 400 });
  }

  // Hash the password before storing it (12 rounds = strong enough, ~300 ms on modern hardware)
  const hashedPassword = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        name:      name.trim(),
        nickname:  nickname.trim(),
        email:     email.trim().toLowerCase(), // normalise so login is case-insensitive
        password:  hashedPassword,
        address:   address.trim(),
        interests,
        photo:     avatar ?? null,
        attendedEvents: 0,
        events:         0,
        friends:        0,
      },
    });

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (err: unknown) {
    // P2002 is Prisma's "unique constraint failed" code — email must be unique
    if (
      typeof err === 'object' && err !== null &&
      'code' in err && (err as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Error saving profile.' }, { status: 500 });
  }
}
