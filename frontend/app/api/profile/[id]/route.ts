/**
 * /api/profile/[id] — single-profile endpoints
 *
 * GET    — Returns one user's public profile (password excluded).
 *           Response shape: { userId, avatar, name, nickname, email, address,
 *                             interests, attendedEvents, events, friends }
 *           Used by the profile view page (/profile/[id]).
 *
 * PATCH  — Updates a user's profile. Two modes, determined by the request body:
 *
 *   Mode 1 — Password change
 *     Body: { currentPassword: string, newPassword: string }
 *     Verifies the current password first, then replaces it with a new bcrypt hash.
 *     Minimum new password length: 8 characters.
 *
 *   Mode 2 — Field update
 *     Body: any subset of { address, interests, avatar,
 *                            attendedEvents, events, friends }
 *     (attendedEvents, events, friends are numeric — used by the admin stats editor.)
 *     Only fields present in the body are updated (partial update pattern).
 *
 * DELETE — Hard-deletes the user row. Cascades to Friendship rows via the schema's
 *          `onDelete: Cascade` relations.
 *          Used by the admin page's DELETE button.
 *
 * None of these endpoints verify that the caller owns the profile — ownership
 * is enforced on the client side (CHANGE button only shown to the session owner).
 * For a production app you would add an `auth()` check here.
 */
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

// Always fetch fresh data — prevents stale attendedEvents/events/friends counters.
export const dynamic = 'force-dynamic';

// ── GET /api/profile/[id] ─────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      nickname: true,
      email: true,
      address: true,
      interests: true,
      photo: true,
      attendedEvents: true,
      events: true,
      friends: true,
      // password is intentionally excluded
    },
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Rename fields to match the shape used by profile view components
  const { id: userId, photo: avatar, ...rest } = user;
  return NextResponse.json({ userId, avatar, ...rest });
}

// ── PATCH /api/profile/[id] ───────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // ── Mode 1: password change ────────────────────────────────────────────────
  // Detected by the presence of `currentPassword` in the body.
  if (body.currentPassword !== undefined) {
    const user = await prisma.user.findUnique({ where: { id }, select: { password: true } });
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Verify the existing password before allowing the change
    const ok = await bcrypt.compare(body.currentPassword, user.password);
    if (!ok) return NextResponse.json({ error: 'Current password incorrect' }, { status: 401 });

    if (!body.newPassword || body.newPassword.length < 8) {
      return NextResponse.json({ error: 'New password too short' }, { status: 400 });
    }
    const newHash = await bcrypt.hash(body.newPassword, 12);
    await prisma.user.update({ where: { id }, data: { password: newHash } });
    return NextResponse.json({ ok: true });
  }

  // ── Mode 2: field update ───────────────────────────────────────────────────
  // Build the update object from only the fields the client included.
  // This allows partial updates — omitted fields are left unchanged.
  const data: Record<string, unknown> = {};
  if (body.address        !== undefined) data.address        = body.address;
  if (body.interests      !== undefined) data.interests      = body.interests;
  if (body.avatar         !== undefined) data.photo          = body.avatar; // avatar → photo in DB
  if (body.attendedEvents !== undefined) data.attendedEvents = Number(body.attendedEvents);
  if (body.events         !== undefined) data.events         = Number(body.events);
  if (body.friends        !== undefined) data.friends        = Number(body.friends);

  try {
    await prisma.user.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Not found or update failed' }, { status: 404 });
  }
}

// ── DELETE /api/profile/[id] ──────────────────────────────────────────────────
// Hard-deletes the user. Related Friendship rows are removed automatically
// due to the `onDelete: Cascade` directive on both Friendship relations.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Not found or delete failed' }, { status: 404 });
  }
}