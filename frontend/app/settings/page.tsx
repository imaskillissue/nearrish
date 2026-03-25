'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth }              from '../lib/auth-context';
import { useRouter }           from 'next/navigation';
import { H1_STYLE } from '@/lib/typography';
import { apiFetch, API_BASE } from '../lib/api';
import { DS, PAGE_STYLE, CARD_STYLE, PANEL_STYLE, INPUT_STYLE, BTN_PRIMARY_STYLE, SECTION_LABEL_STYLE } from '../lib/tokens';
import styles from '../components/ProfileModal.module.css';
import QRCode from 'qrcode';

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
// TwoFAEnableModal
// ─────────────────────────────────────────────────────────────────────────────
function TwoFAEnableModal({ open, onClose, onEnabled }: { open: boolean; onClose: () => void; onEnabled: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secret,    setSecret]    = useState('');
  const [code,      setCode]      = useState('');
  const [error,     setError]     = useState('');
  const [busy,      setBusy]      = useState(false);
  const [done,      setDone]      = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCode(''); setError(''); setQrDataUrl(''); setSecret(''); setDone(false);
    apiFetch<{ secret: string; otpAuthUri: string }>('/api/2fa/setup', { method: 'POST' })
      .then(async res => {
        setSecret(res.secret);
        const dataUrl = await QRCode.toDataURL(res.otpAuthUri, { width: 200 });
        setQrDataUrl(dataUrl);
        setTimeout(() => inputRef.current?.focus(), 50);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Setup failed.'));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiFetch<{ success: boolean; message: string; sessionToken: string | null }>(
        '/api/2fa/enable',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret, code }) },
      );
      if (!res.success) { setError(res.message || 'Invalid code — try again.'); setBusy(false); return; }
      if (res.sessionToken) localStorage.setItem('session_token', res.sessionToken);
      setDone(true);
      onEnabled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable 2FA.');
    }
    setBusy(false);
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ width: 420 }}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        <h2 className={styles.title}>ENABLE 2FA</h2>

        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: 14, color: DS.secondary, fontWeight: 600 }}>
              Two-factor authentication is now active.
            </p>
            <button className={styles.btnSubmit} onClick={onClose}>CLOSE</button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleEnable}>
            <p style={{ margin: 0, fontSize: 13, color: DS.tertiary }}>
              Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy).
            </p>

            {qrDataUrl ? (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <img src={qrDataUrl} alt="2FA QR code" style={{ width: 180, height: 180 }} />
              </div>
            ) : (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 12, color: DS.tertiary, opacity: 0.5 }}>
                  {error ? '' : 'Loading QR code…'}
                </span>
              </div>
            )}

            {secret && (
              <div>
                <label className={styles.fieldLabel}>MANUAL ENTRY KEY</label>
                <p style={{
                  margin: 0, fontSize: 13, fontFamily: 'monospace', letterSpacing: '0.12em',
                  background: '#fff', border: `1.5px solid ${DS.tertiary}`, padding: '0.4rem 0.6rem',
                  wordBreak: 'break-all', color: DS.secondary, fontWeight: 600,
                }}>
                  {secret}
                </p>
              </div>
            )}

            <div>
              <label htmlFor="totp-enable-code" className={styles.fieldLabel}>ENTER 6-DIGIT CODE</label>
              <input
                id="totp-enable-code"
                ref={inputRef}
                className={styles.input}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                autoComplete="one-time-code"
              />
            </div>
            <span className={styles.errorMsg}>{error}</span>
            <button
              className={styles.btnSubmit}
              type="submit"
              disabled={busy || code.length !== 6 || !secret}
            >
              {busy ? 'VERIFYING…' : 'CONFIRM & ENABLE'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TwoFADisableModal
// ─────────────────────────────────────────────────────────────────────────────
function TwoFADisableModal({ open, onClose, onDisabled }: { open: boolean; onClose: () => void; onDisabled: () => void }) {
  const [password, setPassword] = useState('');
  const [code,     setCode]     = useState('');
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);
  const [done,     setDone]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPassword(''); setCode(''); setError(''); setDone(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiFetch<{ success: boolean; message: string; sessionToken: string | null }>(
        '/api/2fa/disable',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, code }) },
      );
      if (!res.success) { setError(res.message || 'Incorrect password or code.'); setBusy(false); return; }
      if (res.sessionToken) localStorage.setItem('session_token', res.sessionToken);
      setDone(true);
      onDisabled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable 2FA.');
    }
    setBusy(false);
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        <h2 className={styles.title}>DISABLE 2FA</h2>

        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: 14, color: DS.secondary, fontWeight: 600 }}>
              Two-factor authentication has been disabled.
            </p>
            <button className={styles.btnSubmit} onClick={onClose}>CLOSE</button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleDisable}>
            <p style={{ margin: 0, fontSize: 13, color: DS.tertiary }}>
              Enter your password and a valid authenticator code to confirm.
            </p>
            <div>
              <label htmlFor="dis-password" className={styles.fieldLabel}>PASSWORD</label>
              <input
                id="dis-password"
                ref={inputRef}
                className={styles.input}
                type="password"
                placeholder="Your current password…"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div>
              <label htmlFor="dis-code" className={styles.fieldLabel}>AUTHENTICATOR CODE</label>
              <input
                id="dis-code"
                className={styles.input}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                autoComplete="one-time-code"
              />
            </div>
            <span className={styles.errorMsg}>{error}</span>
            <button
              className={styles.btnSubmit}
              type="submit"
              disabled={busy || !password || code.length !== 6}
            >
              {busy ? 'DISABLING…' : 'DISABLE 2FA'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChangePasswordModal
// ─────────────────────────────────────────────────────────────────────────────
function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);
  const [busy,     setBusy]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCurrent(''); setNext(''); setConfirm(''); setError(''); setSuccess(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (next.length < 8)           { setError('Password must be at least 8 characters.'); return; }
    if (!/[A-Z]/.test(next))       { setError('Password must contain at least one uppercase letter.'); return; }
    if (!/[a-z]/.test(next))       { setError('Password must contain at least one lowercase letter.'); return; }
    if (!/[0-9]/.test(next))       { setError('Password must contain at least one number.'); return; }
    if (next !== confirm)          { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await apiFetch('/api/users/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password.');
    }
    setBusy(false);
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        <h2 className={styles.title}>CHANGE PASSWORD</h2>

        {success ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: 14, color: DS.secondary, fontWeight: 600 }}>
              Password updated successfully.
            </p>
            <button className={styles.btnSubmit} onClick={onClose}>CLOSE</button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div>
              <label htmlFor="cp-current" className={styles.fieldLabel}>CURRENT PASSWORD</label>
              <input
                id="cp-current"
                ref={inputRef}
                className={styles.input}
                type="password"
                placeholder="Current password…"
                value={current}
                onChange={e => setCurrent(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div>
              <label htmlFor="cp-new" className={styles.fieldLabel}>NEW PASSWORD</label>
              <input
                id="cp-new"
                className={styles.input}
                type="password"
                placeholder="Min. 8 characters…"
                value={next}
                onChange={e => setNext(e.target.value)}
                autoComplete="new-password"
              />
              <span style={{ fontSize: 11, color: DS.tertiary, opacity: 0.5, marginTop: 3, display: 'block' }}>
                Min. 8 characters — must include uppercase, lowercase, and a number.
              </span>
            </div>
            <div>
              <label htmlFor="cp-confirm" className={styles.fieldLabel}>CONFIRM NEW PASSWORD</label>
              <input
                id="cp-confirm"
                className={styles.input}
                type="password"
                placeholder="Repeat new password…"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <span className={styles.errorMsg}>{error}</span>
            <button
              className={styles.btnSubmit}
              type="submit"
              disabled={busy || !current || !next || !confirm}
            >
              {busy ? 'SAVING…' : 'UPDATE PASSWORD'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main SettingsPage component
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, status } = useAuth();
  const router = useRouter();

  const [changePwOpen,      setChangePwOpen]      = useState(false);
  const [twoFaEnabled,      setTwoFaEnabled]      = useState<boolean | null>(null);
  const [twoFaModal,        setTwoFaModal]        = useState<'enable' | 'disable' | null>(null);
  const [deleteConfirming,  setDeleteConfirming]  = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteBusy,        setDeleteBusy]        = useState(false);

  // ── Avatar state ────────────────────────────────────────────────────────────
  const [avatarUrl,      setAvatarUrl]      = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg,      setAvatarMsg]      = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load 2FA status
  useEffect(() => {
    if (status !== 'authenticated') return;
    apiFetch<{ enabled: boolean }>('/api/2fa/status')
      .then(res => setTwoFaEnabled(res.enabled))
      .catch(() => {});
  }, [status]);

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

  // Redirect to home if the user is not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div style={{ ...PAGE, alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: DS.tertiary, fontStyle: 'italic' }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={PAGE}>
      <ChangePasswordModal open={changePwOpen} onClose={() => setChangePwOpen(false)} />
      <TwoFAEnableModal
        open={twoFaModal === 'enable'}
        onClose={() => setTwoFaModal(null)}
        onEnabled={() => setTwoFaEnabled(true)}
      />
      <TwoFADisableModal
        open={twoFaModal === 'disable'}
        onClose={() => setTwoFaModal(null)}
        onDisabled={() => setTwoFaEnabled(false)}
      />
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
          <div style={{ ...PANEL, display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
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
            <div style={{ borderTop: `1px solid ${DS.borderMuted}`, paddingTop: '0.9rem' }}>
              <button onClick={() => setChangePwOpen(true)} style={BTN()}>
                CHANGE PASSWORD
              </button>
            </div>
          </div>
        </div>

        {/* ── Section 2: Security ── */}
        <div>
          <p style={SECTION_TITLE}>Security</p>
          <div style={{ ...PANEL, display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: 14, color: DS.tertiary, fontWeight: 500 }}>
                  Two-Factor Authentication
                </span>
                <p style={{ margin: '0.15rem 0 0', fontSize: 12, color: DS.tertiary, opacity: 0.6 }}>
                  Require a verification code on each login in addition to your password.
                </p>
              </div>
              {twoFaEnabled === null ? (
                <span style={{ fontSize: 12, color: DS.tertiary, opacity: 0.5, flexShrink: 0 }}>Loading…</span>
              ) : twoFaEnabled ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexShrink: 0 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: DS.secondary, background: DS.primary, padding: '0.2rem 0.55rem',
                  }}>ON</span>
                  <button onClick={() => setTwoFaModal('disable')} style={BTN('#c0392b', '#fff')}>DISABLE</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexShrink: 0 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: DS.earth, background: 'rgba(0,0,0,0.28)', padding: '0.2rem 0.55rem',
                  }}>OFF</span>
                  <button onClick={() => setTwoFaModal('enable')} style={BTN()}>ENABLE</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 3: Preferences (UI mockup — toggles not wired to DB yet) ── */}
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

        {/* ── Danger Zone ── */}
        <div>
          <p style={{ ...SECTION_TITLE, color: '#c0392b' }}>Danger Zone</p>
          <div style={{
            border: `3px solid #c0392b`,
            boxShadow: DS.shadow,
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem',
          }}>
            <p style={{ fontSize: 12, color: DS.tertiary, margin: 0 }}>
              Permanently deletes your account, posts, messages, and all associated data. This cannot be undone.
            </p>
            {!deleteConfirming ? (
              <button
                onClick={() => setDeleteConfirming(true)}
                style={{
                  background: 'transparent',
                  border: '2px solid #c0392b',
                  cursor: 'pointer',
                  alignSelf: 'flex-start',
                  fontFamily: 'inherit',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase' as const,
                  color: '#c0392b',
                  padding: '0.5rem 1.2rem',
                }}
              >
                Delete Account
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#c0392b', margin: 0 }}>
                  Type <strong>DELETE</strong> to confirm:
                </p>
                <input
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  style={{ ...INPUT, maxWidth: 200 }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button
                    disabled={deleteConfirmText !== 'DELETE' || deleteBusy}
                    onClick={async () => {
                      setDeleteBusy(true);
                      try {
                        await apiFetch('/api/users/me', { method: 'DELETE' });
                        localStorage.removeItem('session_token');
                        router.replace('/');
                      } catch {
                        setDeleteBusy(false);
                        setDeleteConfirming(false);
                        setDeleteConfirmText('');
                      }
                    }}
                    style={{
                      background: deleteConfirmText === 'DELETE' ? '#c0392b' : '#ccc',
                      border: 'none',
                      cursor: deleteConfirmText === 'DELETE' ? 'pointer' : 'not-allowed',
                      fontFamily: 'inherit',
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase' as const,
                      color: '#fff',
                      padding: '0.5rem 1.2rem',
                    }}
                  >
                    {deleteBusy ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                  <button
                    onClick={() => { setDeleteConfirming(false); setDeleteConfirmText(''); }}
                    style={{
                      background: 'transparent',
                      border: `2px solid ${DS.tertiary}`,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase' as const,
                      color: DS.tertiary,
                      padding: '0.5rem 1.2rem',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
