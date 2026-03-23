/**
 * Settings page — accessible only to logged-in users (redirects otherwise).
 * Reachable from the ProfileDropdown → SETTINGS.
 *
 * Sections:
 *  1. PROFILE PICTURE — avatar upload.
 *  2. ACCOUNT         — read-only display of name and email from the session.
 *  3. PREFERENCES     — notification/theme toggles (UI mockup, not yet wired).
 */
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth }   from '../lib/auth-context';
import { useRouter } from 'next/navigation';
import { H1_STYLE }  from '@/lib/typography';

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
// Main SettingsPage component
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, status } = useAuth();
  const router = useRouter();

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

        {/* ── Section 0: Profile ── */}
        <div>
          <p style={SECTION_TITLE}>Profile</p>
          <div style={{ ...PANEL, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#2d4a1a' }}>
              Update your name, nickname, address, and profile photo.
            </p>
            <Link href="/profile/edit" style={{ ...BTN(), textDecoration: 'none' }}>
              EDIT PROFILE
            </Link>
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

      </div>
    </div>
  );
}
