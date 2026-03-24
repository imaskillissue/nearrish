'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth }              from '../lib/auth-context';
import { useRouter }           from 'next/navigation';
import { H1_STYLE } from '@/lib/typography';
import { apiFetch, API_BASE } from '../lib/api';
import { DS, PAGE_STYLE, CARD_STYLE, PANEL_STYLE, INPUT_STYLE, BTN_PRIMARY_STYLE, SECTION_LABEL_STYLE } from '../lib/tokens';

// ─────────────────────────────────────────────────────────────────────────────
// Shared style tokens (green palette, matching admin/profile pages)
// ─────────────────────────────────────────────────────────────────────────────
const PAGE = PAGE_STYLE;
const CARD = { ...CARD_STYLE, maxWidth: 680 };
const PANEL: React.CSSProperties = {
  background: '#fff',
  border: `2px solid ${DS.tertiary}`,
  boxShadow: DS.shadowSm,
  padding: '1.1rem 1.3rem',
};
const SECTION_TITLE = SECTION_LABEL_STYLE;
const INPUT = INPUT_STYLE;
const BTN = (bg: string = DS.secondary, color: string = DS.primary): React.CSSProperties => ({
  ...BTN_PRIMARY_STYLE,
  background: bg,
  color,
  alignSelf: 'flex-start',
});
const LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: DS.tertiary,
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
      <span style={{ fontSize: 14, color: DS.tertiary }}>{label}</span>
      <button
        onClick={() => setOn(o => !o)}
        style={{
          width: 44, height: 24, borderRadius: 0, border: `2px solid ${DS.tertiary}`, cursor: 'pointer',
          background: on ? DS.secondary : 'rgba(0,0,0,0.12)',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}
        aria-label={`Toggle ${label}`}
      >
        <span style={{
          position: 'absolute', top: 3, left: on ? 23 : 3, width: 14, height: 14,
          borderRadius: 0, background: on ? DS.primary : DS.secondary, transition: 'left 0.2s, background 0.2s',
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

  // ── Avatar state ────────────────────────────────────────────────────────────
  const [avatarUrl,      setAvatarUrl]      = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg,      setAvatarMsg]      = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Edit Profile state ──────────────────────────────────────────────────────
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName,      setEditName]      = useState('');
  const [editNickname,  setEditNickname]  = useState('');
  const [editAddress,   setEditAddress]   = useState('');
  const [editMsg,       setEditMsg]       = useState('');
  const [editSaving,    setEditSaving]    = useState(false);

  // ── Change Password state ──────────────────────────────────────────────────
  const [showChangePw, setShowChangePw] = useState(false);


  const [curPw,     setCurPw]     = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg,     setPwMsg]     = useState('');
  const [pwSaving,  setPwSaving]  = useState(false);

  // ── 2FA state ────────────────────────────────────────────────────────────────
  const [twoFaEnabled,  setTwoFaEnabled]  = useState<boolean | null>(null);
  const [twoFaStep,     setTwoFaStep]     = useState<'idle' | 'setup' | 'disable'>('idle');
  const [twoFaSecret,   setTwoFaSecret]   = useState('');
  const [twoFaUri,      setTwoFaUri]      = useState('');
  const [twoFaCode,     setTwoFaCode]     = useState('');
  const [twoFaPassword, setTwoFaPassword] = useState('');
  const [twoFaMsg,      setTwoFaMsg]      = useState('');
  const [twoFaLoading,  setTwoFaLoading]  = useState(false);

  // Load current avatar + profile data on mount
  useEffect(() => {
    if (status !== 'authenticated' || !user?.id) return;
    apiFetch<{ avatarUrl?: string | null; name?: string; nickname?: string; address?: string }>(`/api/public/users/${user.id}`)
      .then(u => {
        setAvatarUrl(u.avatarUrl ?? null);
        setEditName(u.name ?? '');
        setEditNickname(u.nickname ?? '');
        setEditAddress(u.address ?? '');
      })
      .catch(() => {});
  }, [status, user?.id]);

  // Load 2FA status
  useEffect(() => {
    if (status !== 'authenticated') return;
    apiFetch<{ enabled: boolean }>('/api/2fa/status')
      .then(r => setTwoFaEnabled(r.enabled))
      .catch(() => {});
  }, [status]);

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

  // Redirect to home if the user is not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setEditSaving(true);
    setEditMsg('');
    try {
      await apiFetch('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: editName, nickname: editNickname, address: editAddress }),
      });
      setEditMsg('Profile updated!');
    } catch {
      setEditMsg('Failed to save — please try again.');
    }
    setEditSaving(false);
    setTimeout(() => setEditMsg(''), 3000);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwSaving(true);
    setPwMsg('');
    try {
      await apiFetch('/api/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      });
      setPwMsg('Password changed!');
      setCurPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: unknown) {
      const errStatus = (err as { status?: number }).status;
      setPwMsg(errStatus === 403 ? 'Current password is incorrect.' : 'Failed to update password.');
    }
    setPwSaving(false);
    setTimeout(() => setPwMsg(''), 4000);
  }

  async function handleEnable2Fa(e: React.FormEvent) {
    e.preventDefault();
    setTwoFaLoading(true);
    setTwoFaMsg('');
    try {
      const res = await apiFetch<{ success: boolean; message: string; sessionToken: string | null }>(
        '/api/2fa/enable', {
          method: 'POST',
          body: JSON.stringify({ secret: twoFaSecret, code: twoFaCode }),
        }
      );
      if (res.success) {
        if (res.sessionToken) localStorage.setItem('session_token', res.sessionToken);
        setTwoFaEnabled(true);
        setTwoFaStep('idle');
        setTwoFaSecret('');
        setTwoFaUri('');
        setTwoFaCode('');
        setTwoFaMsg('Two-factor authentication enabled!');
      } else {
        setTwoFaMsg(res.message ?? 'Invalid code — try again.');
      }
    } catch {
      setTwoFaMsg('Something went wrong. Try again.');
    }
    setTwoFaLoading(false);
  }

  async function handleDisable2Fa(e: React.FormEvent) {
    e.preventDefault();
    setTwoFaLoading(true);
    setTwoFaMsg('');
    try {
      const res = await apiFetch<{ success: boolean; message: string; sessionToken: string | null }>(
        '/api/2fa/disable', {
          method: 'POST',
          body: JSON.stringify({ password: twoFaPassword, code: twoFaCode }),
        }
      );
      if (res.success) {
        if (res.sessionToken) localStorage.setItem('session_token', res.sessionToken);
        setTwoFaEnabled(false);
        setTwoFaStep('idle');
        setTwoFaCode('');
        setTwoFaPassword('');
        setTwoFaMsg('Two-factor authentication disabled.');
      } else {
        setTwoFaMsg(res.message ?? 'Incorrect credentials.');
      }
    } catch {
      setTwoFaMsg('Something went wrong. Try again.');
    }
    setTwoFaLoading(false);
  }

  if (status === 'loading') {
    return (
      <div style={{ ...PAGE, alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: DS.tertiary, fontStyle: 'italic' }}>Loading…</p>
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
          <p style={{ margin: '0.3rem 0 0', fontSize: 13, color: DS.tertiary }}>
            Manage your account and application preferences.
          </p>
        </div>

        {/* ── Section 0: Profile Picture ── */}
        <div>
          <p style={SECTION_TITLE}>Profile Picture</p>
          <div style={{ ...PANEL, display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {/* Avatar preview */}
            <div style={{
              width: 80, height: 80, borderRadius: 0, flexShrink: 0,
              border: `2px solid ${DS.tertiary}`,
              background: DS.secondary, overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {avatarUrl
                ? <img src={`${API_BASE}${avatarUrl}`} alt="avatar"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <span style={{ color: DS.earth, fontWeight: 700, fontSize: 30 }}>
                    {user?.name?.[0]?.toUpperCase() ?? '?'}
                  </span>
              }
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <p style={{ margin: 0, fontSize: 13, color: DS.tertiary }}>
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
                  color: avatarMsg.includes('failed') ? '#c0392b' : DS.secondary }}>
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
              <p style={{ margin: 0, fontSize: 15, color: DS.tertiary, fontWeight: 500 }}>
                {user?.name ?? '—'}
              </p>
            </div>
            <div>
              <span style={LABEL}>Email</span>
              <p style={{ margin: 0, fontSize: 15, color: DS.tertiary, fontWeight: 500 }}>
                {user?.email ?? '—'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Section 2: Edit Profile ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ ...SECTION_TITLE, margin: 0 }}>Edit Profile</p>
            <button
              onClick={() => { setShowEditProfile(o => !o); setEditMsg(''); }}
              style={BTN(showEditProfile ? '#fff' : DS.secondary, showEditProfile ? DS.tertiary : DS.primary)}
            >
              {showEditProfile ? 'CANCEL' : 'EDIT PROFILE'}
            </button>
          </div>
          {showEditProfile && (
            <form onSubmit={handleSaveProfile} style={{ ...PANEL, display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.6rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={LABEL}>NAME</label>
                  <input style={INPUT} type="text" value={editName}
                    onChange={e => setEditName(e.target.value)} maxLength={100} placeholder="Full name" />
                </div>
                <div>
                  <label style={LABEL}>NICKNAME</label>
                  <input style={INPUT} type="text" value={editNickname}
                    onChange={e => setEditNickname(e.target.value)} maxLength={8} placeholder="Nickname" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LABEL}>ADDRESS</label>
                  <input style={INPUT} type="text" value={editAddress}
                    onChange={e => setEditAddress(e.target.value)} maxLength={100} placeholder="Your address" />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <button type="submit" disabled={editSaving} style={BTN()}>
                  {editSaving ? 'SAVING…' : 'SAVE PROFILE'}
                </button>
                {editMsg && (
                  <span style={{ fontSize: 12, fontWeight: 600,
                    color: editMsg.includes('updated') ? '#155724' : '#c0392b' }}>
                    {editMsg}
                  </span>
                )}
              </div>
            </form>
          )}
        </div>

        {/* ── Section 3: Change Password ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ ...SECTION_TITLE, margin: 0 }}>Change Password</p>
            <button
              onClick={() => { setShowChangePw(o => !o); setPwMsg(''); setCurPw(''); setNewPw(''); setConfirmPw(''); }}
              style={BTN(showChangePw ? '#fff' : DS.secondary, showChangePw ? DS.tertiary : DS.primary)}
            >
              {showChangePw ? 'CANCEL' : 'CHANGE PASSWORD'}
            </button>
          </div>
          {showChangePw && (
            <form onSubmit={handleChangePassword} style={{ ...PANEL, display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.6rem' }}>
              <div>
                <label style={LABEL}>CURRENT PASSWORD</label>
                <input style={INPUT} type="password" value={curPw}
                  onChange={e => setCurPw(e.target.value)} placeholder="Current password"
                  autoComplete="current-password" />
              </div>
              <div>
                <label style={LABEL}>NEW PASSWORD</label>
                <input style={INPUT} type="password" value={newPw}
                  onChange={e => setNewPw(e.target.value)} placeholder="New password (8+ characters)"
                  autoComplete="new-password" />
              </div>
              <div>
                <label style={LABEL}>CONFIRM NEW PASSWORD</label>
                <input style={INPUT} type="password" value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)} placeholder="Confirm new password"
                  autoComplete="new-password" />
                {confirmPw.length > 0 && newPw !== confirmPw && (
                  <span style={{ fontSize: 12, color: '#c0392b', marginTop: 4, display: 'block' }}>
                    Passwords do not match
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <button type="submit"
                  disabled={pwSaving || !curPw || newPw.length < 8 || newPw !== confirmPw}
                  style={BTN()}>
                  {pwSaving ? 'UPDATING…' : 'UPDATE PASSWORD'}
                </button>
                {pwMsg && (
                  <span style={{ fontSize: 12, fontWeight: 600,
                    color: pwMsg.includes('changed') ? '#155724' : '#c0392b' }}>
                    {pwMsg}
                  </span>
                )}
              </div>
            </form>
          )}
        </div>

        {/* ── Section 4: Preferences (UI mockup — toggles not wired to DB yet) ── */}
        <div>
          <p style={SECTION_TITLE}>Preferences</p>
          <div style={PANEL}>
            <Toggle label="Email notifications"           defaultOn={true}  />
            <Toggle label="Friend request notifications"  defaultOn={true}  />
            <Toggle label="Nearby post alerts"             defaultOn={false} />
            <Toggle label="Show me in friend suggestions" defaultOn={true}  />
          </div>
          <p style={{ margin: '0.6rem 0 0', fontSize: 11, color: DS.tertiary, opacity: 0.6 }}>
            Preference storage coming in a future update.
          </p>
        </div>

        {/* ── Section 5: Security (2FA) ── */}
        <div>
          <p style={SECTION_TITLE}>Security</p>
          <div style={PANEL}>

            {/* Status row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: DS.tertiary }}>Two-Factor Authentication</span>
                <p style={{ margin: '0.2rem 0 0', fontSize: 12, color: DS.tertiary, opacity: 0.6 }}>
                  {twoFaEnabled === null ? 'Loading…' : twoFaEnabled ? 'Active — your account is protected.' : 'Not enabled — add an extra layer of security.'}
                </p>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
                padding: '0.2rem 0.6rem',
                background: twoFaEnabled ? '#d4edda' : '#f8d7da',
                color:      twoFaEnabled ? '#155724' : '#721c24',
                border:     `1px solid ${twoFaEnabled ? '#c3e6cb' : '#f5c6cb'}`,
              }}>
                {twoFaEnabled ? 'ON' : 'OFF'}
              </span>
            </div>

            {/* Idle: show enable or disable button */}
            {twoFaStep === 'idle' && twoFaEnabled !== null && (
              <button
                onClick={async () => {
                  setTwoFaMsg('');
                  if (!twoFaEnabled) {
                    setTwoFaLoading(true);
                    try {
                      const r = await apiFetch<{ secret: string; otpAuthUri: string }>('/api/2fa/setup', { method: 'POST' });
                      setTwoFaSecret(r.secret);
                      setTwoFaUri(r.otpAuthUri);
                      setTwoFaStep('setup');
                    } catch {
                      setTwoFaMsg('Could not start setup. Try again.');
                    }
                    setTwoFaLoading(false);
                  } else {
                    setTwoFaStep('disable');
                  }
                }}
                disabled={twoFaLoading}
                style={BTN(twoFaEnabled ? '#c0392b' : DS.secondary, twoFaEnabled ? '#fff' : DS.primary)}
              >
                {twoFaLoading ? 'LOADING…' : twoFaEnabled ? 'DISABLE 2FA' : 'ENABLE 2FA'}
              </button>
            )}

            {/* Setup flow: scan QR + confirm code */}
            {twoFaStep === 'setup' && (
              <form onSubmit={handleEnable2Fa} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                <p style={{ margin: 0, fontSize: 13, color: DS.tertiary }}>
                  1. Scan this QR code with <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any TOTP app.
                </p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(twoFaUri)}`}
                  alt="2FA QR code"
                  width={160}
                  height={160}
                  style={{ border: `2px solid ${DS.tertiary}`, display: 'block' }}
                />
                <p style={{ margin: 0, fontSize: 12, color: DS.tertiary, opacity: 0.7 }}>
                  Or enter this secret manually: <code style={{ background: '#f5f5f5', padding: '0.1rem 0.4rem', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{twoFaSecret}</code>
                </p>
                <p style={{ margin: 0, fontSize: 13, color: DS.tertiary }}>
                  2. Enter the 6-digit code from the app to confirm.
                </p>
                <div>
                  <label style={LABEL}>CODE</label>
                  <input
                    style={INPUT}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={twoFaCode}
                    onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" disabled={twoFaLoading || twoFaCode.length !== 6} style={BTN()}>
                    {twoFaLoading ? 'ACTIVATING…' : 'ACTIVATE 2FA'}
                  </button>
                  <button type="button" onClick={() => { setTwoFaStep('idle'); setTwoFaCode(''); setTwoFaMsg(''); }} style={BTN('#fff', DS.tertiary)}>
                    CANCEL
                  </button>
                </div>
              </form>
            )}

            {/* Disable flow: password + code */}
            {twoFaStep === 'disable' && (
              <form onSubmit={handleDisable2Fa} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.5rem' }}>
                <p style={{ margin: 0, fontSize: 13, color: DS.tertiary }}>
                  Enter your password and the current code from your authenticator app.
                </p>
                <div>
                  <label style={LABEL}>PASSWORD</label>
                  <input
                    style={INPUT}
                    type="password"
                    placeholder="Your account password"
                    value={twoFaPassword}
                    onChange={e => setTwoFaPassword(e.target.value)}
                    autoComplete="current-password"
                    autoFocus
                  />
                </div>
                <div>
                  <label style={LABEL}>AUTHENTICATOR CODE</label>
                  <input
                    style={INPUT}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={twoFaCode}
                    onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                    autoComplete="one-time-code"
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" disabled={twoFaLoading || !twoFaPassword || twoFaCode.length !== 6} style={BTN('#c0392b', '#fff')}>
                    {twoFaLoading ? 'DISABLING…' : 'CONFIRM DISABLE'}
                  </button>
                  <button type="button" onClick={() => { setTwoFaStep('idle'); setTwoFaCode(''); setTwoFaPassword(''); setTwoFaMsg(''); }} style={BTN('#fff', DS.tertiary)}>
                    CANCEL
                  </button>
                </div>
              </form>
            )}

            {/* Feedback message */}
            {twoFaMsg && (
              <p style={{ margin: '0.8rem 0 0', fontSize: 12, fontWeight: 600,
                color: twoFaMsg.includes('enabled!') || twoFaMsg.includes('disabled.') ? '#155724' : '#c0392b' }}>
                {twoFaMsg}
              </p>
            )}
          </div>
        </div>

        {/* ── Danger Zone ── */}
        <div>
          <p style={{ ...SECTION_TITLE, color: '#c0392b' }}>Danger Zone</p>
          <div style={{
            border: `3px solid ${DS.tertiary}`,
            boxShadow: DS.shadow,
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to permanently delete your account? This cannot be undone.')) {
                  apiFetch('/api/users/me', { method: 'DELETE' })
                    .then(() => {
                      localStorage.removeItem('session_token');
                      router.replace('/');
                    })
                    .catch(() => alert('Failed to delete account. Please try again.'));
                }
              }}
              style={{
                background: '#c0392b',
                border: '2px solid #c0392b',
                cursor: 'pointer',
                alignSelf: 'flex-start',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#fff',
                padding: '0.5rem 1.2rem',
              }}
            >
              DELETE ACCOUNT FOREVER
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
