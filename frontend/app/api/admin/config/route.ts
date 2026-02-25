import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

// ── Shared helper (same as in verify/route.ts) ────────────────────────────────
// Returns the AdminConfig row, seeding defaults on first call.
async function getOrSeedConfig() {
  const existing = await prisma.adminConfig.findUnique({ where: { id: 'singleton' } });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash('username', 12);
  return prisma.adminConfig.create({
    data: { id: 'singleton', username: 'password', passwordHash },
  });
}

// ── GET /api/admin/config ─────────────────────────────────────────────────────
// Returns the current admin username.
// The password hash is NEVER sent to the client.
export async function GET() {
  const config = await getOrSeedConfig();
  return NextResponse.json({ username: config.username });
}

// ── PATCH /api/admin/config ───────────────────────────────────────────────────
// Body: { currentUsername, currentPassword, newUsername, newPassword }
// Validates the current credentials before applying the update.
export async function PATCH(req: NextRequest) {
  const { currentUsername, currentPassword, newUsername, newPassword } = await req.json();

  if (!currentUsername || !currentPassword) {
    return NextResponse.json({ error: 'Current credentials required' }, { status: 400 });
  }
  if (!newUsername?.trim() || !newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: 'New username and password (min 6 chars) required' }, { status: 400 });
  }

  const config = await getOrSeedConfig();

  // Verify current credentials before allowing a change
  const usernameMatch = currentUsername === config.username;
  const passwordMatch = await bcrypt.compare(currentPassword, config.passwordHash);
  if (!usernameMatch || !passwordMatch) {
    return NextResponse.json({ error: 'Current credentials are incorrect' }, { status: 401 });
  }

  // Hash the new password and persist both fields
  const newHash = await bcrypt.hash(newPassword, 12);
  await prisma.adminConfig.update({
    where: { id: 'singleton' },
    data:  { username: newUsername.trim(), passwordHash: newHash },
  });

  return NextResponse.json({ ok: true });
}
