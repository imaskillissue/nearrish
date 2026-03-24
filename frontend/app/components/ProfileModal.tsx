'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import styles from './ProfileModal.module.css';

type View = 'choice' | 'login' | 'totp';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: Props) {
  const router = useRouter();
  const { login, validateTotp } = useAuth();
  const [view,     setView]     = useState<View>('choice');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [partialToken, setPartialToken] = useState('');
  const [totpCode,     setTotpCode]     = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  // Reset to choice view whenever modal opens
  useEffect(() => {
    if (open) {
      setView('choice');
      setEmail('');
      setPassword('');
      setError('');
      setPartialToken('');
      setTotpCode('');
    }
  }, [open]);

  // Focus email input when view switches to login
  useEffect(() => {
    if (view === 'login') emailRef.current?.focus();
  }, [view]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleRegister() {
    onClose();
    router.push('/profile');
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Invalid email or password.');
    } else if (result.mfaRequired) {
      setPartialToken(result.partialToken);
      setView('totp');
    } else {
      onClose();
      router.refresh();
    }
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = await validateTotp(partialToken, totpCode);
    setLoading(false);
    if (!ok) {
      setError('Invalid code — check your authenticator app.');
    } else {
      onClose();
      router.refresh();
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>

        {/* ── CHOICE VIEW ── */}
        {view === 'choice' && (
          <>
            <h2 className={styles.title}>PROFILE</h2>
            <div className={styles.choiceRow}>
              <button className={styles.btnLogin} onClick={() => setView('login')}>
                LOGIN
              </button>
              <button className={styles.btnRegister} onClick={handleRegister}>
                REGISTER
              </button>
            </div>
          </>
        )}

        {/* ── LOGIN VIEW ── */}
        {view === 'login' && (
          <>
            <h2 className={styles.title}>LOGIN</h2>

            <form className={styles.form} onSubmit={handleLogin}>
              <div>
                <label htmlFor="login-email" className={styles.fieldLabel}>EMAIL</label>
                <input
                  id="login-email"
                  ref={emailRef}
                  className={styles.input}
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="login-password" className={styles.fieldLabel}>PASSWORD</label>
                <input
                  id="login-password"
                  className={styles.input}
                  type="password"
                  placeholder="Password…"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <span className={styles.errorMsg}>{error}</span>
              <button
                className={styles.btnSubmit}
                type="submit"
                disabled={loading || !email || !password}
              >
                {loading ? 'LOGGING IN…' : 'LOGIN'}
              </button>
            </form>
          </>
        )}

        {/* ── TOTP VIEW ── */}
        {view === 'totp' && (
          <>
            <h2 className={styles.title}>TWO-FACTOR AUTH</h2>
            <p style={{ fontSize: 13, marginBottom: '1rem', color: '#555' }}>
              Open your authenticator app and enter the 6-digit code.
            </p>
            <form className={styles.form} onSubmit={handleTotp}>
              <div>
                <label htmlFor="totp-code" className={styles.fieldLabel}>CODE</label>
                <input
                  id="totp-code"
                  className={styles.input}
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="123456"
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>
              <span className={styles.errorMsg}>{error}</span>
              <button
                className={styles.btnSubmit}
                type="submit"
                disabled={loading || totpCode.length !== 6}
              >
                {loading ? 'VERIFYING…' : 'VERIFY'}
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  );
}
