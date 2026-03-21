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
  const [view,         setView]         = useState<View>('choice');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [totpCode,     setTotpCode]     = useState('');
  const [partialToken, setPartialToken] = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const totpRef  = useRef<HTMLInputElement>(null);

  // Reset to choice view whenever modal opens
  useEffect(() => {
    if (open) {
      setView('choice');
      setEmail('');
      setPassword('');
      setTotpCode('');
      setPartialToken('');
      setError('');
    }
  }, [open]);

  useEffect(() => {
    if (view === 'login') emailRef.current?.focus();
    if (view === 'totp')  totpRef.current?.focus();
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
      setError('Invalid email or password.');
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
      setError('Invalid code. Try again.');
      setTotpCode('');
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
            <div className={styles.oauthDivider}><span>OR CONTINUE WITH</span></div>
            <div className={styles.oauthRow}>
              <a className={styles.btnOAuth42} href="/api/auth/oauth2/42/initiate">
                42
              </a>
              <a className={styles.btnOAuthGoogle} href="/api/auth/oauth2/google/initiate">
                Google
              </a>
            </div>
          </>
        )}

        {/* ── LOGIN VIEW ── */}
        {view === 'login' && (
          <>
            <h2 className={styles.title}>LOGIN</h2>

            <form className={styles.form} onSubmit={handleLogin}>
              <div>
                <p className={styles.fieldLabel}>EMAIL</p>
                <input
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
                <p className={styles.fieldLabel}>PASSWORD</p>
                <input
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
            <p style={{ fontSize: 13, color: '#aaa', margin: '0 0 16px', textAlign: 'center' }}>
              Enter the 6-digit code from your authenticator app.
            </p>
            <form className={styles.form} onSubmit={handleTotp}>
              <div>
                <p className={styles.fieldLabel}>AUTHENTICATOR CODE</p>
                <input
                  ref={totpRef}
                  className={styles.input}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  autoComplete="one-time-code"
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
