'use client';

import { useCallback, useEffect, useState } from 'react';
import { H1_STYLE } from '../lib/typography';
import { apiFetch, API_BASE } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useRouter } from 'next/navigation';
import Speedometer from '../components/Speedometer';
import { DS, PAGE_STYLE, PANEL_STYLE, SECTION_LABEL_STYLE } from '../lib/tokens';

interface UserRow {
  userId: string;
  username: string;
  name: string;
  nickname: string;
  email: string;
  address: string;
  avatarUrl: string | null;
  toxicityScore?: number;
  toxicitySummary?: string;
  toxicityGeneratedAt?: string;
  postsTotal?: number; postsBlocked?: number;
  commentsTotal?: number; commentsBlocked?: number;
  messagesTotal?: number; messagesBlocked?: number;
}

interface ToxicityReport {
  userId: string; score: number; summary: string; generatedAt: string;
  postsTotal: number; postsBlocked: number;
  commentsTotal: number; commentsBlocked: number;
  messagesTotal: number; messagesBlocked: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const pageStyle: React.CSSProperties = { ...PAGE_STYLE, padding: '100px 2rem 2rem' };
const card: React.CSSProperties = {
  width: '100%', maxWidth: 1100, background: '#fff', border: `3px solid ${DS.tertiary}`,
  boxShadow: DS.shadow, padding: '2.5rem',
  display: 'flex', flexDirection: 'column', gap: '2rem',
};
const sectionLabel: React.CSSProperties = { ...SECTION_LABEL_STYLE, fontSize: 11 };
const panel: React.CSSProperties = PANEL_STYLE;
const col: React.CSSProperties = {
  flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: '0.5rem',
};
const divider: React.CSSProperties = {
  width: 1, background: 'rgba(26,26,26,0.15)', alignSelf: 'stretch', flexShrink: 0,
};
const btnSmall: React.CSSProperties = {
  padding: '0.3rem 0.9rem', borderRadius: 0, border: `2px solid ${DS.tertiary}`, cursor: 'pointer',
  background: DS.secondary, color: DS.earth, fontSize: 11, fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'inherit',
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileAdminPage() {
  const { user, status } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pageStatus, setPageStatus] = useState<'loading' | 'ok'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
    else if (status === 'authenticated' && !user?.isAdmin) router.replace('/');
  }, [status, user, router]);

  const load = useCallback(async () => {
    setPageStatus('loading');
    setLoadError(null);
    try {
      const data = await apiFetch<UserRow[]>('/api/admin/users');
      setUsers(data);
    } catch (e) {
      setUsers([]);
      setLoadError(e instanceof Error ? e.message : 'Failed to load users');
    }
    setPageStatus('ok');
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && user?.isAdmin) load();
  }, [status, user, load]);

  async function runAnalysis(userId: string) {
    setAnalysing(userId);
    try {
      const report = await apiFetch<ToxicityReport>(
        `/api/admin/users/${userId}/analyse`, { method: 'POST' }
      );
      setUsers(prev => prev.map(u => u.userId === userId
        ? {
            ...u,
            toxicityScore: report.score,
            toxicitySummary: report.summary,
            toxicityGeneratedAt: report.generatedAt,
            postsTotal: report.postsTotal,
            postsBlocked: report.postsBlocked,
            commentsTotal: report.commentsTotal,
            commentsBlocked: report.commentsBlocked,
            messagesTotal: report.messagesTotal,
            messagesBlocked: report.messagesBlocked,
          }
        : u
      ));
    } catch {
      alert('Analysis failed. Make sure the moderation service is running.');
    } finally {
      setAnalysing(null);
    }
  }

  if (status === 'loading' || !user?.isAdmin) return null;

  return (
    <div style={pageStyle}>
      <div style={card}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={H1_STYLE}>ADMIN — USER DATABASE</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnSmall} onClick={load}>↺ REFRESH</button>
            <a href="/admin" style={{ ...btnSmall, textDecoration: 'none', display: 'inline-block', paddingTop: '0.35rem' }}>
              ← HUB
            </a>
          </div>
        </div>

        {pageStatus === 'loading' && (
          <p style={{ color: DS.tertiary, fontStyle: 'italic' }}>Loading…</p>
        )}
        {pageStatus === 'ok' && loadError && (
          <div style={{ ...panel, background: 'rgba(192,57,43,0.12)' }}>
            <p style={{ color: '#c0392b', fontWeight: 700, margin: 0 }}>Error: {loadError}</p>
          </div>
        )}
        {pageStatus === 'ok' && !loadError && users.length === 0 && (
          <div style={panel}><p style={{ color: DS.tertiary, fontStyle: 'italic', margin: 0 }}>No users found.</p></div>
        )}

        {/* User cards */}
        {users.map((u, i) => (
          <div key={u.userId} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <p style={{ ...sectionLabel, margin: 0 }}>USER {i + 1}</p>

            {/* Three-column panel */}
            <div style={{ ...panel, display: 'flex', gap: 0, alignItems: 'stretch', flexWrap: 'wrap' }}>

              {/* ── Col 1: Account info ── */}
              <div style={{ ...col, paddingRight: '1.2rem' }}>
                <span style={{ ...sectionLabel, fontSize: 10 }}>ACCOUNT INFO</span>

                {/* Avatar */}
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: DS.secondary,
                  overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '0.4rem', flexShrink: 0 }}>
                  {u.avatarUrl
                    ? <img src={`${API_BASE}${u.avatarUrl}`} alt="avatar"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <svg viewBox="0 0 100 100" width="66%" height="66%">
                        <circle cx="50" cy="36" r="22" fill={DS.primary} />
                        <path d="M8 95 Q8 63 50 63 Q92 63 92 95 Z" fill={DS.primary} />
                      </svg>
                  }
                </div>

                <Row label="USERNAME" value={u.username ?? ''} />
                <Row label="NICKNAME" value={u.nickname ?? ''} />
                <Row label="NAME"     value={u.name ?? ''} />
                <Row label="EMAIL"    value={u.email ?? ''} />
                <Row label="ADDRESS"  value={u.address ?? ''} />

                {/* Links + Delete */}
                <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <a href={`/profile/${u.userId}`}
                    style={{ fontSize: 12, fontWeight: 700, color: DS.tertiary, textDecoration: 'underline' }}>
                    → View profile
                  </a>
                  <button
                    style={{ ...btnSmall, background: '#c0392b', color: '#fff', alignSelf: 'flex-start' }}
                    onClick={async () => {
                      if (window.confirm('Delete this user permanently?')) {
                        try { await apiFetch(`/api/admin/users/${u.userId}`, { method: 'DELETE' }); await load(); }
                        catch { alert('Failed to delete user.'); }
                      }
                    }}
                  >DELETE</button>
                </div>
              </div>

              <div style={divider} />

              {/* ── Col 2: Moderation analysis ── */}
              <div style={{ ...col, padding: '0 1.2rem' }}>
                <span style={{ ...sectionLabel, fontSize: 10 }}>MODERATION ANALYSIS</span>

                {u.toxicitySummary ? (
                  <>
                    <p style={{ margin: '0.3rem 0 0', fontSize: 13, color: DS.tertiary, lineHeight: 1.6, fontStyle: 'italic', flex: 1 }}>
                      {u.toxicitySummary}
                    </p>
                    {u.postsTotal !== undefined && (
                      <p style={{ margin: '0.4rem 0 0', fontSize: 11, color: DS.tertiary, opacity: 0.7, fontFamily: 'monospace' }}>
                        Posts {u.postsBlocked}/{u.postsTotal} blocked
                        {' · '}Comments {u.commentsBlocked}/{u.commentsTotal} blocked
                        {' · '}Messages {u.messagesBlocked}/{u.messagesTotal} blocked
                      </p>
                    )}
                    {u.toxicityGeneratedAt && (
                      <p style={{ margin: '0.3rem 0 0', fontSize: 10, color: DS.tertiary, opacity: 0.45 }}>
                        Generated: {new Date(u.toxicityGeneratedAt).toLocaleString()}
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{ margin: '0.3rem 0 0', fontSize: 13, color: DS.tertiary, fontStyle: 'italic', flex: 1, opacity: 0.7 }}>
                    No analysis yet.
                  </p>
                )}

                <button
                  style={{ ...btnSmall, marginTop: '0.8rem', alignSelf: 'flex-start' }}
                  disabled={analysing === u.userId}
                  onClick={() => runAnalysis(u.userId)}
                >
                  {analysing === u.userId ? 'ANALYSING…' : '⚗ RUN ANALYSIS'}
                </button>
              </div>

              <div style={divider} />

              {/* ── Col 3: Gauge ── */}
              <div style={{ ...col, paddingLeft: '1.2rem', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ ...sectionLabel, fontSize: 10 }}>TOXICITY SCORE</span>
                {u.toxicityScore !== undefined
                  ? <Speedometer score={u.toxicityScore} />
                  : <p style={{ fontSize: 12, color: DS.tertiary, fontStyle: 'italic', opacity: 0.7, margin: '1rem 0' }}>
                      Run analysis to<br/>generate a score.
                    </p>
                }
              </div>

            </div>
          </div>
        ))}

      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline' }}>
      <span style={{ minWidth: 68, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: DS.tertiary, opacity: 0.55 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: DS.tertiary, fontStyle: 'italic' }}>{value}</span>
    </div>
  );
}
