'use client';

import { useCallback, useEffect, useState } from 'react';
import { H1_STYLE } from '../lib/typography';

interface UserRow {
  userId: string;
  name: string;
  nickname: string;
  email: string;
  address: string;
  interests: string[];
  avatar: string | null;
  attendedEvents: number;
  events: number;
  friends: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles (inline — self-contained page)
// ─────────────────────────────────────────────────────────────────────────────
const page: React.CSSProperties = {
  minHeight: '100vh', background: '#dff0d8',
  padding: '100px 2rem 2rem', display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
};
const card: React.CSSProperties = {
  width: '100%', maxWidth: 960, background: '#b6f08a', borderRadius: 24, padding: '2.5rem',
  boxShadow: '0 8px 32px rgba(0,0,0,0.13)', display: 'flex', flexDirection: 'column', gap: '2rem',
};
const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
  color: '#2d4a1a', opacity: 0.55, marginBottom: '0.6rem',
};
const panel: React.CSSProperties = {
  background: 'rgba(255,255,255,0.35)', borderRadius: 14, padding: '1rem 1.2rem',
};
const btnSmall: React.CSSProperties = {
  padding: '0.3rem 0.9rem', borderRadius: 7, border: 'none', cursor: 'pointer',
  background: '#2d4a1a', color: '#b6f08a', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.08em', fontFamily: 'inherit',
};
const numInput: React.CSSProperties = {
  width: 58, padding: '0.3rem 0.4rem', borderRadius: 7, border: 'none', outline: 'none',
  background: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 600, color: '#2d4a1a',
  textAlign: 'center',
};

// ─────────────────────────────────────────────────────────────────────────────
// AdminGate — full-screen credential modal shown on every page load.
// Calls POST /api/admin/verify instead of using hardcoded credentials,
// so the admin username/password can be changed from /settings.
// On wrong credentials the user is redirected to / after 1.2 s.
// ─────────────────────────────────────────────────────────────────────────────
function AdminGate({ onUnlock }: { onUnlock: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [leaving,  setLeaving]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate credentials against the DB via the admin verify API
    const res = await fetch('/api/admin/verify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    });

    if (res.ok) {
      onUnlock();
    } else {
      setError('Invalid credentials.');
      setLeaving(true);
      setTimeout(() => { window.location.href = '/'; }, 1200);
    }
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 999,
    background: 'rgba(223,240,216,0.92)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const modalCard: React.CSSProperties = {
    background: '#b6f08a', borderRadius: 20,
    padding: '2.5rem 3rem', width: 340,
    boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
    display: 'flex', flexDirection: 'column', gap: '1.2rem',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.55rem 0.8rem', borderRadius: 9, border: 'none',
    background: 'rgba(255,255,255,0.65)', fontSize: 14, color: '#2d4a1a',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };
  const label: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: '#2d4a1a', opacity: 0.6, marginBottom: 4, display: 'block',
  };

  return (
    <div style={overlay}>
      <div style={modalCard}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1a2e0a', letterSpacing: '-0.03rem' }}>
            ADMIN ACCESS
          </h2>
          <p style={{ margin: '0.3rem 0 0', fontSize: 12, color: '#4a7030' }}>
            Enter credentials to continue.
          </p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div>
            <span style={label}>Username</span>
            <input
              style={inputStyle} type="text" autoComplete="off"
              value={username} onChange={e => setUsername(e.target.value)}
              autoFocus disabled={leaving}
            />
          </div>
          <div>
            <span style={label}>Password</span>
            <input
              style={inputStyle} type="password" autoComplete="off"
              value={password} onChange={e => setPassword(e.target.value)}
              disabled={leaving}
            />
          </div>
          {error && (
            <p style={{ margin: 0, fontSize: 12, color: '#c0392b', fontWeight: 600 }}>{error}</p>
          )}
          <button
            type="submit"
            style={{ ...btnSmall, padding: '0.6rem 1rem', fontSize: 13, alignSelf: 'flex-start' }}
            disabled={leaving}
          >
            ENTER
          </button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main admin page
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileAdminPage() {
  const [unlocked,   setUnlocked]   = useState(false);
  const [users,      setUsers]      = useState<UserRow[]>([]);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [status,     setStatus]     = useState<'loading' | 'ok'>('loading');

  const [statEdits, setStatEdits] = useState<Record<string, {
    attendedEvents: string; events: string; friends: string; msg: string;
  }>>({});

  const load = useCallback(async () => {
    const [usersRes, meRes] = await Promise.all([
      fetch('/api/profile'),
      fetch('/api/me'),
    ]);
    const data: UserRow[] = usersRes.ok ? await usersRes.json() : [];
    const { userId: uid } = await meRes.json();

    setUsers(data);
    setCurrentUid(uid ?? null);

    const edits: typeof statEdits = {};
    for (const u of data) {
      edits[u.userId] = {
        attendedEvents: String(u.attendedEvents),
        events:         String(u.events),
        friends:        String(u.friends),
        msg:            '',
      };
    }
    setStatEdits(edits);
    setStatus('ok');
  }, []);

  useEffect(() => {
    if (unlocked) load();
  }, [unlocked, load]);

  // If the user already verified admin credentials in Settings during this
  // browser session, skip the gate automatically.
  useEffect(() => {
    if (typeof window !== 'undefined' &&
        sessionStorage.getItem('adminVerified') === '1') {
      setUnlocked(true);
    }
  }, []);

  async function applyStats(userId: string) {
    const e = statEdits[userId];
    const res = await fetch(`/api/profile/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attendedEvents: e.attendedEvents,
        events:         e.events,
        friends:        e.friends,
      }),
    });
    setStatEdits(prev => ({
      ...prev,
      [userId]: { ...prev[userId], msg: res.ok ? 'Applied.' : 'Error.' },
    }));
    if (res.ok) await load();
    setTimeout(() => setStatEdits(prev => ({
      ...prev,
      [userId]: { ...prev[userId], msg: '' },
    })), 2000);
  }

  const ALL = ['RELATIONSHIP','MOVEMENT','CULTURAL','GAMES','CREATIVE','FOOD','SHOWS','COMERCIAL'];

  return (
    <>
      {!unlocked && <AdminGate onUnlock={() => setUnlocked(true)} />}

      <div style={page}>
        <div style={card}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={H1_STYLE}>
              ADMIN — USER DATABASE
            </h1>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              {currentUid && (
                <span style={{ fontSize: 11, fontWeight: 600, color: '#2d4a1a', opacity: 0.6 }}>
                  session: <code style={{ fontFamily: 'monospace', opacity: 0.8 }}>{currentUid}</code>
                </span>
              )}
              <button style={{ ...btnSmall, marginTop: 4 }} onClick={load}>↺ REFRESH</button>
            </div>
          </div>

          {/* ── Loading ── */}
          {!unlocked && (
            <p style={{ color: '#4a7030', fontStyle: 'italic' }}>Waiting for credentials…</p>
          )}
          {unlocked && status === 'loading' && (
            <p style={{ color: '#4a7030', fontStyle: 'italic' }}>Loading…</p>
          )}

          {/* ── Empty state ── */}
          {unlocked && status === 'ok' && users.length === 0 && (
            <div style={panel}>
              <p style={{ color: '#4a7030', fontStyle: 'italic', margin: 0 }}>
                No users yet. Fill in the profile form at <a href="/profile" style={{ color: '#2d4a1a' }}>/profile</a> and save.
              </p>
            </div>
          )}

          {/* ── User cards ── */}
          {unlocked && users.map((u, i) => {
            const isCurrent = u.userId === currentUid;
            const e = statEdits[u.userId] ?? { attendedEvents: '0', events: '0', friends: '0', msg: '' };
            return (
              <div key={u.userId} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <p style={{ ...sectionTitle, marginBottom: 0 }}>
                  USER {i + 1} {isCurrent ? '· CURRENT SESSION' : ''}
                </p>

                <div style={{ ...panel, display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>

                  {/* Mini avatar */}
                  <div style={{ width: 80, height: 80, minWidth: 80, borderRadius: '50%',
                    background: '#2d4a1a', overflow: 'hidden', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {u.avatar
                      ? <img src={u.avatar} alt="avatar"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <svg viewBox="0 0 100 100" width="66%" height="66%">
                          <circle cx="50" cy="36" r="22" fill="#4a6e2a" />
                          <path d="M8 95 Q8 63 50 63 Q92 63 92 95 Z" fill="#4a6e2a" />
                        </svg>
                    }
                  </div>

                  {/* Fields */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <Row label="NICKNAME" value={u.nickname} />
                    <Row label="NAME"     value={u.name} />
                    <Row label="EMAIL"    value={u.email} />
                    <Row label="ADDRESS"  value={u.address} />
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: 2 }}>
                      {ALL.map(t => (
                        <span key={t} style={{
                          padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: u.interests.includes(t) ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.3)',
                          border: u.interests.includes(t) ? '1.5px solid #2d4a1a' : '1.5px solid transparent',
                          color: '#2d4a1a', textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>{t}</span>
                      ))}
                    </div>
                  </div>

                  {/* Stats + editor */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: 200 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: '#2d4a1a', opacity: 0.55 }}>
                      STATS EDITOR
                    </span>
                    {([
                      { key: 'attendedEvents' as const, label: 'ATTENDED' },
                      { key: 'events'         as const, label: 'EVENTS'   },
                      { key: 'friends'        as const, label: 'FRIENDS'  },
                    ]).map(f => (
                      <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                          textTransform: 'uppercase', color: '#2d4a1a', minWidth: 62 }}>
                          {f.label}
                        </span>
                        <input
                          style={numInput}
                          type="number" min={0}
                          value={e[f.key]}
                          onChange={ev => setStatEdits(prev => ({
                            ...prev,
                            [u.userId]: { ...prev[u.userId], [f.key]: ev.target.value },
                          }))}
                        />
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button style={btnSmall} onClick={() => applyStats(u.userId)}>APPLY</button>
                      {e.msg && <span style={{ fontSize: 11, color: '#2d4a1a' }}>{e.msg}</span>}
                    </div>
                  </div>

                </div>

                {/* Delete button */}
                <button
                  style={{ ...btnSmall, background: '#c0392b', color: '#fff' }}
                  onClick={async () => {
                    if (window.confirm('Delete this profile?')) {
                      const res = await fetch(`/api/profile/${u.userId}`, { method: 'DELETE' });
                      if (res.ok) await load();
                    }
                  }}
                >
                  DELETE
                </button>

                {/* Links */}
                <div style={{ display: 'flex', gap: '1rem', paddingLeft: '0.2rem' }}>
                  <a href={`/profile/${u.userId}`}
                    style={{ fontSize: 12, fontWeight: 700, color: '#2d4a1a',
                      textDecoration: 'underline', letterSpacing: '0.04em' }}>
                    → View profile page{isCurrent ? ' (session owner)' : ''}
                  </a>
                  <code style={{ fontSize: 12, fontFamily: 'monospace', color: '#2d4a1a', opacity: 0.4 }}>
                    id: {u.userId}
                  </code>
                </div>
              </div>
            );
          })}

        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'baseline' }}>
      <span style={{ minWidth: 72, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: '#2d4a1a', opacity: 0.55 }}>
        {label}
      </span>
      <span style={{ fontSize: 14, color: '#4a7030', fontStyle: 'italic' }}>{value}</span>
    </div>
  );
}
