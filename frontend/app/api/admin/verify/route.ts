import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

// ── Shared helper ─────────────────────────────────────────────────────────────
// Returns the AdminConfig row, creating the default record on first call.
// Default credentials: username = "password", password = "username".
// These are intentionally reversed as a memorable placeholder — change them
// immediately via /settings after first login.
async function getOrSeedConfig() {
  const existing = await prisma.adminConfig.findUnique({ where: { id: 'singleton' } });
  if (existing) return existing;

  // Seed initial record — only runs once on a fresh DB.
  const passwordHash = await bcrypt.hash('username', 12);
  return prisma.adminConfig.create({
    data: { id: 'singleton', username: 'password', passwordHash },
  });
}

// ── POST /api/admin/verify ────────────────────────────────────────────────────
// Body: { username: string, password: string }
// Returns { ok: true } when credentials match, 401 otherwise.
// Used by both /profile-admin gate and the /settings admin section gate.
export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  const config = await getOrSeedConfig();

  // Compare username (case-sensitive) and bcrypt-hashed password
  const usernameMatch = username === config.username;
  const passwordMatch = await bcrypt.compare(password, config.passwordHash);

  if (!usernameMatch || !passwordMatch) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
