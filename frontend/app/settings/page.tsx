/**
 * Settings page — accessible only to logged-in users (redirects otherwise).
 * Reachable from the ProfileDropdown → SETTINGS.
 *
 * Sections:
 *  1. ACCOUNT    — read-only display of name and email from the session.
 *  2. PREFERENCES — notification/theme toggles (UI mockup, not yet wired).
 *  3. ADMIN ACCESS — "Connect as Admin" opens a credential gate.
 *                    On success, reveals the ADMIN SETTINGS panel where the
 *                    admin username and password can be changed via
 *                    PATCH /api/admin/config.
 *
 * Admin credentials are stored in the DB (AdminConfig table).
 * Default: username = "password", password = "username".
 * Change them here once you've tested the initial setup.
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth }              from '../lib/auth-context';
import { useRouter }           from 'next/navigation';
import Link                    from 'next/link';
import { H1_STYLE } from '@/lib/typography';
import { apiFetch, API_BASE } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Shared style tokens (green palette, matching admin/profile pages)
// ─────────────────────────────────────────────────────────────────────────────
const PAGE: React.CSSProperties = {
  minHeight: '100vh',
  background: '#dff0d8',
  padding: '88px 2rem 4rem',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
};
const CARD: React.CSSProperties = {
  width: '100%',
  maxWidth: 680,
  background: '#b6f08a',
  borderRadius: 24,
  padding: '2.5rem',
  boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
  display: 'flex',
  flexDirection: 'column',
  gap: '2rem',
};
const SECTION_TITLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: '#2d4a1a',
  opacity: 0.5,
  marginBottom: '0.8rem',
};
const PANEL: React.CSSProperties = {
  background: 'rgba(255,255,255,0.38)',
  borderRadius: 14,
  padding: '1.1rem 1.3rem',
};
const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  borderRadius: 9,
  border: 'none',
  outline: 'none',
  background: 'rgba(255,255,255,0.65)',
  fontSize: 14,
  color: '#2d4a1a',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
const BTN = (bg = '#2d4a1a', color = '#b6f08a'): React.CSSProperties => ({
  padding: '0.5rem 1.2rem',
  borderRadius: 9,
  border: 'none',
  cursor: 'pointer',
  background: bg,
  color,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.1em',
  fontFamily: 'inherit',
  alignSelf: 'flex-start',
});
const LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#2d4a1a',
  opacity: 0.6,
  display: 'block',
  marginBottom: 4,
};

// ─────────────────────────────────────────────────────────────────────────────
// Toggle — a simple pill toggle for preference mockups (not wired)
// ─────────────────────────────────────────────────────────────────────────────
function Toggle({ label, defaultOn = false }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.5rem 0' }}>
      <span style={{ fontSize: 14, color: '#2d4a1a' }}>{label}</span>
      <button
        onClick={() => setOn(o => !o)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: on ? '#2d4a1a' : 'rgba(0,0,0,0.18)',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}
        aria-label={`Toggle ${label}`}
      >
        <span style={{
          position: 'absolute', top: 3, left: on ? 22 : 3, width: 18, height: 18,
          borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AdminGate — inline credential modal (does NOT redirect on failure,
// unlike the /profile-admin gate which redirects to /).
// ─────────────────────────────────────────────────────────────────────────────
function AdminGate({ onUnlock }: { onUnlock: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');

    // TODO: Connect to real backend API for admin verification
    setError('Admin verification not connected to backend yet.');
    setBusy(false);
  }

  return (
    <div style={{ ...PANEL, display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      <p style={{ margin: 0, fontSize: 13, color: '#2d4a1a' }}>
        Enter the admin credentials to access settings.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <span style={LABEL}>Username</span>
          <input style={INPUT} type="text" autoComplete="off"
            value={username} onChange={e => setUsername(e.target.value)} disabled={busy} />
        </div>
        <div>
          <span style={LABEL}>Password</span>
          <input style={INPUT} type="password" autoComplete="off"
            value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />
        </div>
        {error && <p style={{ margin: 0, fontSize: 12, color: '#c0392b', fontWeight: 600 }}>{error}</p>}
        <button type="submit" style={BTN()} disabled={busy}>
          {busy ? 'VERIFYING…' : 'CONNECT AS ADMIN'}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AdminPanel — shown after successful admin authentication.
// Fetches the current admin username and allows changing both username + password.
// Calls PATCH /api/admin/config, which requires the current credentials
// for verification before applying the update.
// ─────────────────────────────────────────────────────────────────────────────
function AdminPanel() {
  // Current admin username (fetched from DB for display)
  const [currentAdminUser, setCurrentAdminUser] = useState('');

  // Form fields for credential change
  const [curUser,   setCurUser]   = useState('');
  const [curPass,   setCurPass]   = useState('');
  const [newUser,   setNewUser]   = useState('');
  const [newPass,   setNewPass]   = useState('');
  const [msg,       setMsg]       = useState('');
  const [msgType,   setMsgType]   = useState<'ok' | 'err'>('ok');
  const [busy,      setBusy]      = useState(false);

  // Load the current admin username on mount
  useEffect(() => {
    // TODO: Connect to real backend API to fetch admin config
  }, []);

  async function handleChange(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');

    // TODO: Connect to real backend API to update admin credentials
    setMsg('Admin credentials update not connected to backend yet.');
    setMsgType('err');
    setBusy(false);
  }

  return (
    <div style={{ ...PANEL, display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
      {/* Current username display */}
      <div>
        <p style={{ ...SECTION_TITLE, marginBottom: 4 }}>Currently logged in as admin</p>
        <code style={{ fontSize: 14, color: '#2d4a1a', fontFamily: 'monospace', fontWeight: 700 }}>
          {currentAdminUser || '…'}
        </code>
      </div>

      {/* Direct link to the user database admin page */}
      <Link
        href="/profile-admin"
        style={{
          ...BTN('#1a5c2a'),
          display: 'inline-block',
          textDecoration: 'none',
          textAlign: 'center',
        }}
      >
        OPEN USER DATABASE →
      </Link>

      {/* Change credentials form */}
      <form onSubmit={handleChange} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#4a7030', fontWeight: 600 }}>
          To change credentials, confirm your current ones first:
        </p>

        {/* Current credentials */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <div>
            <span style={LABEL}>Current username</span>
            <input style={INPUT} type="text" autoComplete="off"
              value={curUser} onChange={e => setCurUser(e.target.value)} disabled={busy} />
          </div>
          <div>
            <span style={LABEL}>Current password</span>
            <input style={INPUT} type="password" autoComplete="off"
              value={curPass} onChange={e => setCurPass(e.target.value)} disabled={busy} />
          </div>
        </div>

        {/* New credentials */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <div>
            <span style={LABEL}>New username</span>
            <input style={INPUT} type="text" autoComplete="off"
              value={newUser} onChange={e => setNewUser(e.target.value)} disabled={busy} />
          </div>
          <div>
            <span style={LABEL}>New password (min 6 chars)</span>
            <input style={INPUT} type="password" autoComplete="off"
              value={newPass} onChange={e => setNewPass(e.target.value)} disabled={busy} />
          </div>
        </div>

        {msg && (
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600,
            color: msgType === 'ok' ? '#2d7a3a' : '#c0392b' }}>
            {msg}
          </p>
        )}

        <button type="submit" style={BTN('#1a5c2a')} disabled={busy}>
          {busy ? 'SAVING…' : 'UPDATE CREDENTIALS'}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main SettingsPage component
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, status } = useAuth();
  const router = useRouter();

  // ── Avatar state ────────────────────────────────────────────────────────────
  const [avatarUrl,      setAvatarUrl]      = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg,      setAvatarMsg]      = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load current avatar on mount
  useEffect(() => {
    if (status !== 'authenticated' || !user?.id) return;
    apiFetch<{ avatarUrl?: string | null }>(`/api/public/users/${user.id}`)
      .then(u => setAvatarUrl(u.avatarUrl ?? null))
      .catch(() => {});
  }, [status, user?.id]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setAvatarMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      // MeController returns { avatarUrl }, so cast through unknown
      const res = await (fetch(`${API_BASE}/api/users/me/avatar`, {
        method: 'POST',
        headers: { AUTH: localStorage.getItem('session_token') ?? '' },
        body: fd,
      }).then(r => r.json())) as { avatarUrl: string };
      setAvatarUrl(res.avatarUrl);
      setAvatarMsg('Profile picture updated!');
    } catch {
      setAvatarMsg('Upload failed — try again.');
    }
    setAvatarUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // Track whether the admin section has been unlocked in this page session.
  // Unlocking requires passing the admin credential gate (AdminGate component).
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  // Redirect to home if the user is not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div style={{ ...PAGE, alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#4a7030', fontStyle: 'italic' }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={PAGE}>
      <div style={CARD}>

        {/* ── Page title ── */}
        <div>
          <h1 style={H1_STYLE}>
            SETTINGS
          </h1>
          <p style={{ margin: '0.3rem 0 0', fontSize: 13, color: '#4a7030' }}>
            Manage your account and application preferences.
          </p>
        </div>

        {/* ── Section 0: Profile Picture ── */}
        <div>
          <p style={SECTION_TITLE}>Profile Picture</p>
          <div style={{ ...PANEL, display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {/* Avatar preview */}
            <div style={{
              width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
              background: '#2d4a1a', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
            }}>
              {avatarUrl
                ? <img src={`${API_BASE}${avatarUrl}`} alt="avatar"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <span style={{ color: '#b6f08a', fontWeight: 700, fontSize: 30 }}>
                    {user?.name?.[0]?.toUpperCase() ?? '?'}
                  </span>
              }
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#2d4a1a' }}>
                {avatarUrl ? 'Change your profile picture' : 'Upload a profile picture'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={avatarUploading}
                style={{ display: 'none' }}
                id="avatar-file-input"
              />
              <label htmlFor="avatar-file-input" style={{
                ...BTN(),
                cursor: avatarUploading ? 'not-allowed' : 'pointer',
                opacity: avatarUploading ? 0.6 : 1,
                display: 'inline-block',
                textAlign: 'center',
              }}>
                {avatarUploading ? 'UPLOADING…' : 'CHOOSE PHOTO'}
              </label>
              {avatarMsg && (
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600,
                  color: avatarMsg.includes('failed') ? '#c0392b' : '#2d7a3a' }}>
                  {avatarMsg}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 1: Account ── */}
        <div>
          <p style={SECTION_TITLE}>Account</p>
          <div style={{ ...PANEL, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            <div>
              <span style={LABEL}>Name</span>
              <p style={{ margin: 0, fontSize: 15, color: '#2d4a1a', fontWeight: 500 }}>
                {user?.name ?? '—'}
              </p>
            </div>
            <div>
              <span style={LABEL}>Email</span>
              <p style={{ margin: 0, fontSize: 15, color: '#2d4a1a', fontWeight: 500 }}>
                {user?.email ?? '—'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Section 2: Preferences (UI mockup — toggles not wired to DB yet) ── */}
        <div>
          <p style={SECTION_TITLE}>Preferences</p>
          <div style={PANEL}>
            <Toggle label="Email notifications"           defaultOn={true}  />
            <Toggle label="Friend request notifications"  defaultOn={true}  />
            <Toggle label="Nearby post alerts"             defaultOn={false} />
            <Toggle label="Show me in friend suggestions" defaultOn={true}  />
          </div>
          <p style={{ margin: '0.6rem 0 0', fontSize: 11, color: '#4a7030', opacity: 0.6 }}>
            Preference storage coming in a future update.
          </p>
        </div>

        {/* ── Section 3: Admin access ── */}
        <div>
          <p style={SECTION_TITLE}>Admin access</p>

          {!adminUnlocked ? (
            /*
             * AdminGate: shows a username/password form.
             * On success it calls onUnlock(), revealing the AdminPanel below.
             * Unlike /profile-admin, wrong credentials here just show an error
             * — the user stays on the page.
             */
            <AdminGate onUnlock={() => {
              // Store verification in sessionStorage so /profile-admin can skip its gate
              // for the duration of this browser session (cleared on tab close).
              sessionStorage.setItem('adminVerified', '1');
              setAdminUnlocked(true);
            }} />
          ) : (
            /*
             * AdminPanel: allows changing the admin username and password.
             * The update requires re-confirming the current credentials
             * (server-side check in PATCH /api/admin/config).
             */
            <AdminPanel />
          )}
        </div>

      </div>
    </div>
  );
}
