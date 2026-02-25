'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import styles from './ProfileModal.module.css';

type View = 'choice' | 'login';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: Props) {
  const router = useRouter();
  const [view,     setView]     = useState<View>('choice');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // Reset to choice view whenever modal opens
  useEffect(() => {
    if (open) {
      setView('choice');
      setEmail('');
      setPassword('');
      setError('');
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
    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError('Invalid email or password.');
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button className={styles.backBtn} onClick={() => { setView('choice'); setError(''); }}>
                ← BACK
              </button>
              <h2 className={styles.title} style={{ margin: 0 }}>LOGIN</h2>
            </div>

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

      </div>
    </div>
  );
}
