'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { useWs } from '../lib/ws-context';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../lib/api';
import Speedometer from '../components/Speedometer';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface QueuePost {
  id: string; type: 'post'; authorId: string; authorName: string | null; content: string;
  severity: number | null; category: string | null;
  moderated: boolean; reason: string | null; timestamp: number;
}
interface QueueComment {
  id: string; type: 'comment'; authorId: string; authorName: string | null;
  content: string; moderated: boolean; reason: string | null; timestamp: number;
}
type QueueItem = QueuePost | QueueComment;

interface AdminUser {
  userId: string; username: string; name: string | null; nickname: string | null;
  email: string; avatarUrl: string | null;
  toxicityScore?: number; toxicitySummary?: string;
}

interface ToxicityReport {
  userId: string; score: number; summary: string; generatedAt: string;
  postsTotal: number; postsBlocked: number;
  commentsTotal: number; commentsBlocked: number;
  messagesTotal: number; messagesBlocked: number;
}

interface LiveStats {
  totalUsers: number; totalPosts: number; totalComments: number; totalMessages: number;
  onlineNow: number; flaggedPosts: number; blockedPosts: number; blockedComments: number;
  postsLast1h: number; postsLast24h: number; blockRatePct: number;
  timestamp: number;
}

interface OnlineHistoryPoint { ts: number; online: number; }

interface PostActivityRow { date: string; ts: number; posts: number; blocked: number; flagged: number; }
interface SeverityBreakdown { clean: number; borderline: number; inappropriate: number; harmful: number; severe: number; }

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const page: React.CSSProperties = {
  minHeight: '100vh', background: '#dff0d8',
  padding: '100px 2rem 2rem', display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
};
const card: React.CSSProperties = {
  width: '100%', maxWidth: 1100, background: '#b6f08a', borderRadius: 24, padding: '2.5rem',
  boxShadow: '0 8px 32px rgba(0,0,0,0.13)', display: 'flex', flexDirection: 'column', gap: '2.5rem',
};
const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
  color: '#2d4a1a', opacity: 0.55, marginBottom: '0.8rem',
};
const panel: React.CSSProperties = {
  background: 'rgba(255,255,255,0.35)', borderRadius: 14, padding: '1.2rem 1.4rem',
};
const btn: React.CSSProperties = {
  padding: '0.35rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: '#2d4a1a', color: '#b6f08a', fontSize: 12, fontWeight: 700,
  letterSpacing: '0.08em', fontFamily: 'inherit',
};
const badge = (sev: number | null): React.CSSProperties => ({
  display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: 5, fontSize: 10,
  fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  background: sev == null ? '#aaa' : sev >= 4 ? '#c0392b' : sev >= 3 ? '#e67e22' : sev >= 2 ? '#f1c40f' : '#27ae60',
  color: sev != null && sev <= 1 ? '#1a2e0a' : '#fff',
});

const SEVERITY_COLORS: Record<string, string> = {
  clean: '#27ae60', borderline: '#f1c40f', inappropriate: '#e67e22', harmful: '#e74c3c', severe: '#c0392b',
};

// ─────────────────────────────────────────────────────────────────────────────
// Live stat tile
// ─────────────────────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, pulse }: { label: string; value: number | string; sub?: string; pulse?: boolean }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.45)', borderRadius: 12, padding: '1rem 1.2rem',
      display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120, flex: 1,
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2d4a1a', opacity: 0.55 }}>
        {label}
      </span>
      <span style={{ fontSize: 26, fontWeight: 900, color: '#1a2e0a', lineHeight: 1 }}>
        {value}
        {pulse && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#27ae60', marginLeft: 6, verticalAlign: 'middle', animation: 'pulse 1.5s infinite' }} />}
      </span>
      {sub && <span style={{ fontSize: 10, color: '#4a7030', opacity: 0.7 }}>{sub}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin hub page
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, status } = useAuth();
  const { subscribe } = useWs();
  const router = useRouter();

  // ── Live stats ─────────────────────────────────────────────────────────────
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [postActivity, setPostActivity] = useState<PostActivityRow[]>([]);
  const [severityBreakdown, setSeverityBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [onlineHistory, setOnlineHistory] = useState<OnlineHistoryPoint[]>([]);

  // ── Queue ──────────────────────────────────────────────────────────────────
  const [queue, setQueue] = useState<{ posts: QueuePost[]; comments: QueueComment[] } | null>(null);

  // ── Toxicity analysis ──────────────────────────────────────────────────────
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [report, setReport] = useState<ToxicityReport | null>(null);
  const [analysing, setAnalysing] = useState(false);

  // Guard
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
    else if (status === 'authenticated' && !user?.isAdmin) router.replace('/');
  }, [status, user, router]);

  // Live stats via WebSocket — also append to online history
  useEffect(() => {
    return subscribe('adminStats', (payload) => {
      const snap = payload as unknown as LiveStats;
      setLiveStats(snap);
      setOnlineHistory(prev => {
        const next = [...prev, { ts: snap.timestamp, online: snap.onlineNow }];
        return next.slice(-2880); // keep 4h at 5s intervals
      });
    });
  }, [subscribe]);

  const loadCharts = useCallback(async () => {
    try {
      const [activity, breakdown, history] = await Promise.all([
        apiFetch<PostActivityRow[]>('/api/admin/stats/post-activity'),
        apiFetch<SeverityBreakdown>('/api/admin/stats/severity-breakdown'),
        apiFetch<OnlineHistoryPoint[]>('/api/admin/stats/online-history'),
      ]);
      setPostActivity(activity);
      const bd = breakdown as SeverityBreakdown;
      setSeverityBreakdown(
        Object.entries(bd)
          .filter(([, v]) => v > 0)
          .map(([name, value]) => ({ name, value: value as number }))
      );
      setOnlineHistory(history);
    } catch { /* charts optional */ }
  }, []);

  const loadQueue = useCallback(async () => {
    try {
      const data = await apiFetch<{ posts: QueuePost[]; comments: QueueComment[] }>('/api/admin/moderation/queue');
      setQueue(data);
    } catch {
      setQueue({ posts: [], comments: [] });
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersError(null);
    try {
      const data = await apiFetch<AdminUser[]>('/api/admin/users');
      setAllUsers(data);
    } catch (e) {
      setAllUsers([]);
      setUsersError(e instanceof Error ? e.message : 'Failed to load users');
    }
  }, []);

  // Initial snapshot (before first WS broadcast arrives)
  const loadSnapshot = useCallback(async () => {
    try {
      const snap = await apiFetch<LiveStats>('/api/admin/stats/snapshot');
      setLiveStats(snap);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && user?.isAdmin) {
      loadSnapshot();
      loadQueue();
      loadUsers();
      loadCharts();
    }
  }, [status, user, loadSnapshot, loadQueue, loadUsers, loadCharts]);

  async function handleSelectUser(userId: string) {
    const u = allUsers.find(x => x.userId === userId) ?? null;
    setSelectedUser(u);
    setReport(null);
    if (!u) return;
    try {
      const r = await apiFetch<ToxicityReport>(`/api/admin/users/${userId}/toxicity`);
      setReport(r);
    } catch { /* no saved report yet */ }
  }

  async function handleAnalyse() {
    if (!selectedUser) return;
    setAnalysing(true);
    try {
      const r = await apiFetch<ToxicityReport>(`/api/admin/users/${selectedUser.userId}/analyse`, { method: 'POST' });
      setReport(r);
      loadUsers();
    } catch {
      alert('Analysis failed. Make sure the moderation service is running.');
    } finally {
      setAnalysing(false);
    }
  }

  function exportCSV() {
    if (!liveStats) return;
    const now = new Date().toISOString();
    const sections: (string | number)[][] = [];

    // ── Platform snapshot ──
    sections.push(
      ['# NEARRISH PLATFORM EXPORT', `generated_at=${now}`],
      [],
      ['## SNAPSHOT'],
      ['metric', 'value'],
      ['snapshot_timestamp_iso',    new Date(liveStats.timestamp).toISOString()],
      ['snapshot_timestamp_unix_ms', liveStats.timestamp],
      ['total_users',               liveStats.totalUsers],
      ['total_posts',               liveStats.totalPosts],
      ['total_comments',            liveStats.totalComments],
      ['total_messages',            liveStats.totalMessages],
      ['online_now',                liveStats.onlineNow],
      ['posts_last_1h',             liveStats.postsLast1h],
      ['posts_last_24h',            liveStats.postsLast24h],
      ['flagged_posts',             liveStats.flaggedPosts],
      ['blocked_posts',             liveStats.blockedPosts],
      ['blocked_comments',          liveStats.blockedComments],
      ['block_rate_pct',            liveStats.blockRatePct],
      ['moderation_flag_rate_pct',  liveStats.totalPosts > 0
        ? ((liveStats.flaggedPosts / liveStats.totalPosts) * 100).toFixed(2)
        : 0],
      [],
    );

    // ── Post activity 7d ──
    if (postActivity.length > 0) {
      sections.push(
        ['## POST ACTIVITY (LAST 7 DAYS)'],
        ['date_iso', 'timestamp_unix_ms', 'posts_total', 'posts_blocked', 'posts_flagged', 'block_rate_pct', 'flag_rate_pct'],
        ...postActivity.map(r => [
          r.date, r.ts, r.posts, r.blocked, r.flagged,
          r.posts > 0 ? ((r.blocked / r.posts) * 100).toFixed(2) : 0,
          r.posts > 0 ? ((r.flagged / r.posts) * 100).toFixed(2) : 0,
        ]),
        [],
      );
    }

    // ── Severity breakdown ──
    if (severityBreakdown.length > 0) {
      const total = severityBreakdown.reduce((s, r) => s + r.value, 0);
      sections.push(
        ['## MODERATION SEVERITY BREAKDOWN'],
        ['severity_label', 'post_count', 'share_pct'],
        ...severityBreakdown.map(r => [r.name, r.value, total > 0 ? ((r.value / total) * 100).toFixed(2) : 0]),
        [],
      );
    }

    // ── Online history ──
    if (onlineHistory.length > 0) {
      sections.push(
        ['## ONLINE USER HISTORY (4H ROLLING, 5S INTERVALS)'],
        ['timestamp_iso', 'timestamp_unix_ms', 'online_users'],
        ...onlineHistory.map(r => [new Date(r.ts).toISOString(), r.ts, r.online]),
        [],
      );
    }

    // ── Users ──
    if (allUsers.length > 0) {
      sections.push(
        ['## USER ROSTER'],
        ['user_id', 'username', 'email', 'toxicity_score', 'posts_blocked', 'posts_total', 'comments_blocked', 'comments_total', 'messages_blocked', 'messages_total'],
        ...allUsers.map(u => [
          u.userId, u.username, u.email,
          u.toxicityScore ?? '',
          '', '', '', '', '', '',
        ]),
        [],
      );
    }

    const esc = (v: string | number) => typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
    const csv = sections.map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nearrish_export_${now.replace(/[:.]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (status === 'loading' || !user?.isAdmin) return null;

  const queueItems: QueueItem[] = [
    ...(queue?.posts ?? []),
    ...(queue?.comments ?? []),
  ].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  return (
    <>
      <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.3} }`}</style>
      <div style={page}>
        <div style={card}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#1a2e0a', letterSpacing: '-0.03rem' }}>
                ADMIN HUB
              </h1>
              <p style={{ margin: '0.3rem 0 0', fontSize: 13, color: '#4a7030' }}>
                Welcome, {user.name}. Use the panels below to manage the platform.
              </p>
            </div>
            <button style={btn} onClick={exportCSV} disabled={!liveStats}>↓ EXPORT CSV</button>
          </div>

          {/* ── Section 1: Live stats ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
              <p style={{ ...sectionTitle, marginBottom: 0 }}>LIVE PLATFORM STATS</p>
              {liveStats && (
                <span style={{ fontSize: 10, color: '#4a7030', opacity: 0.6 }}>
                  Updated {new Date(liveStats.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              <StatTile label="Online Now"       value={liveStats?.onlineNow       ?? '—'} pulse />
              <StatTile label="Total Users"      value={liveStats?.totalUsers      ?? '—'} />
              <StatTile label="Total Posts"      value={liveStats?.totalPosts      ?? '—'} />
              <StatTile label="Posts (1h)"       value={liveStats?.postsLast1h     ?? '—'} sub="last hour" />
              <StatTile label="Posts (24h)"      value={liveStats?.postsLast24h    ?? '—'} sub="last 24 hours" />
              <StatTile label="Block Rate"       value={liveStats ? `${liveStats.blockRatePct}%` : '—'} sub="posts blocked" />
              <StatTile label="Flagged Posts"    value={liveStats?.flaggedPosts    ?? '—'} sub="severity ≥ 2" />
              <StatTile label="Blocked Posts"    value={liveStats?.blockedPosts    ?? '—'} />
              <StatTile label="Blocked Comments" value={liveStats?.blockedComments ?? '—'} />
              <StatTile label="Comments"         value={liveStats?.totalComments   ?? '—'} />
              <StatTile label="Messages"         value={liveStats?.totalMessages   ?? '—'} />
            </div>
          </div>

          {/* ── Section 2: Charts ── */}
          {(postActivity.length > 0 || severityBreakdown.length > 0 || onlineHistory.length > 0) && (
            <div>
              <p style={sectionTitle}>ANALYTICS</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

                {/* Online history — stock-style area chart */}
                {onlineHistory.length > 1 && (
                  <div style={panel}>
                    <p style={{ ...sectionTitle, marginBottom: '1rem' }}>
                      CONCURRENT USERS — LIVE ({onlineHistory.length} samples, {Math.round(onlineHistory.length * 5 / 60)} min)
                    </p>
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={onlineHistory} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="onlineGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#27ae60" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#27ae60" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,74,26,0.08)" />
                        <XAxis dataKey="ts" scale="time" type="number" domain={['dataMin','dataMax']}
                          tickFormatter={(v: number) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          tick={{ fontSize: 9, fill: '#2d4a1a' }} tickCount={6} />
                        <YAxis tick={{ fontSize: 9, fill: '#2d4a1a' }} allowDecimals={false} />
                        <Tooltip
                          labelFormatter={(v) => new Date(Number(v)).toLocaleTimeString()}
                          formatter={(v) => [v, 'online']}
                          contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', background: '#fff' }} />
                        <Area type="monotone" dataKey="online" stroke="#27ae60" strokeWidth={2}
                          fill="url(#onlineGrad)" dot={false} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap' }}>
                  {/* Post activity bar chart */}
                  {postActivity.length > 0 && (
                    <div style={{ ...panel, flex: 2, minWidth: 300 }}>
                      <p style={{ ...sectionTitle, marginBottom: '1rem' }}>POST ACTIVITY — LAST 7 DAYS</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={postActivity} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,74,26,0.1)" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#2d4a1a' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#2d4a1a' }} allowDecimals={false} />
                          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', background: '#fff' }} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          <Bar dataKey="posts"   name="Total"   fill="#4a7030" radius={[4,4,0,0]} />
                          <Bar dataKey="flagged" name="Flagged" fill="#e67e22" radius={[4,4,0,0]} />
                          <Bar dataKey="blocked" name="Blocked" fill="#c0392b" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Severity pie chart */}
                  {severityBreakdown.length > 0 && (
                    <div style={{ ...panel, flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <p style={{ ...sectionTitle, marginBottom: '1rem', alignSelf: 'flex-start' }}>SEVERITY BREAKDOWN</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={severityBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                            label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                            labelLine={false}>
                            {severityBreakdown.map((entry) => (
                              <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] ?? '#aaa'} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Section 3: User database link ── */}
          <div>
            <p style={sectionTitle}>USER DATABASE</p>
            <div style={panel}>
              <p style={{ margin: '0 0 0.8rem', fontSize: 13, color: '#2d4a1a' }}>
                View and manage all user accounts and profile data.
              </p>
              <a href="/profile-admin" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>
                OPEN USER DATABASE →
              </a>
            </div>
          </div>

          {/* ── Section 4: Moderation queue ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
              <p style={{ ...sectionTitle, marginBottom: 0 }}>MODERATION QUEUE</p>
              <button style={btn} onClick={loadQueue}>↺ REFRESH</button>
            </div>
            <div style={panel}>
              {queue == null ? (
                <p style={{ color: '#4a7030', fontStyle: 'italic', margin: 0 }}>Loading…</p>
              ) : queueItems.length === 0 ? (
                <p style={{ color: '#4a7030', fontStyle: 'italic', margin: 0 }}>No flagged content. The platform is clean.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid rgba(45,74,26,0.2)' }}>
                        {['TYPE', 'AUTHOR', 'CONTENT', 'SEVERITY', 'CATEGORY', 'REASON', 'TIME'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '0.4rem 0.6rem', fontWeight: 700,
                            fontSize: 10, letterSpacing: '0.1em', color: '#2d4a1a', opacity: 0.6 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queueItems.map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid rgba(45,74,26,0.1)' }}>
                          <td style={{ padding: '0.5rem 0.6rem' }}>
                            <span style={badge(item.type === 'post' ? (item as QueuePost).severity : null)}>
                              {item.type}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.6rem', color: '#2d4a1a', fontFamily: 'monospace', fontSize: 11 }}>
                            {(item as QueuePost | QueueComment).authorName ?? item.authorId?.slice(0, 8) + '…'}
                          </td>
                          <td style={{ padding: '0.5rem 0.6rem', color: '#2d4a1a', maxWidth: 300 }}>
                            <span title={item.content}>
                              {item.content?.slice(0, 80)}{(item.content?.length ?? 0) > 80 ? '…' : ''}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.6rem' }}>
                            <span style={badge(item.type === 'post' ? (item as QueuePost).severity : 3)}>
                              {item.type === 'post' ? ((item as QueuePost).severity ?? '—') : 'blocked'}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.6rem', color: '#4a7030', fontSize: 11 }}>
                            {item.type === 'post' ? ((item as QueuePost).category ?? '—') : '—'}
                          </td>
                          <td style={{ padding: '0.5rem 0.6rem', color: '#4a7030', fontSize: 11, maxWidth: 200 }}>
                            <span title={item.reason ?? ''}>
                              {item.reason?.slice(0, 60)}{(item.reason?.length ?? 0) > 60 ? '…' : ''}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.6rem', color: '#4a7030', fontSize: 10, whiteSpace: 'nowrap' }}>
                            {item.timestamp ? new Date(item.timestamp).toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── Section 5: Toxicity analysis ── */}
          <div>
            <p style={sectionTitle}>TOXICITY ANALYSIS</p>
            <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

              {usersError && (
                <p style={{ margin: 0, fontSize: 12, color: '#c0392b', fontWeight: 700 }}>
                  Failed to load users: {usersError}
                </p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: '#2d4a1a', opacity: 0.7 }}>
                  SELECT USER
                </label>
                <select
                  style={{ padding: '0.4rem 0.7rem', borderRadius: 8, border: 'none',
                    background: 'rgba(255,255,255,0.7)', fontSize: 13, color: '#2d4a1a',
                    fontFamily: 'inherit', cursor: 'pointer' }}
                  value={selectedUser?.userId ?? ''}
                  onChange={e => handleSelectUser(e.target.value)}
                >
                  <option value="">— choose a user —</option>
                  {allUsers.map(u => (
                    <option key={u.userId} value={u.userId}>
                      {u.username ?? u.nickname ?? u.name ?? u.userId}
                    </option>
                  ))}
                </select>

                {selectedUser && (
                  <button style={btn} onClick={handleAnalyse} disabled={analysing}>
                    {analysing ? 'ANALYSING…' : 'RUN ANALYSIS'}
                  </button>
                )}
              </div>

              {selectedUser && (
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {report ? (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <Speedometer score={report.score} />
                        <span style={{ fontSize: 10, color: '#2d4a1a', opacity: 0.55, letterSpacing: '0.08em' }}>
                          TOXICITY SCORE
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <p style={{ margin: '0 0 0.4rem', fontSize: 13, fontWeight: 700, color: '#2d4a1a' }}>
                          {selectedUser.username}
                        </p>
                        <p style={{ margin: '0 0 0.5rem', fontSize: 13, color: '#4a7030', fontStyle: 'italic', lineHeight: 1.5 }}>
                          {report.summary}
                        </p>
                        {report.postsTotal !== undefined && (
                          <p style={{ margin: '0 0 0.5rem', fontSize: 11, color: '#2d4a1a', opacity: 0.7, fontFamily: 'monospace' }}>
                            Posts {report.postsBlocked}/{report.postsTotal} blocked
                            {' · '}Comments {report.commentsBlocked}/{report.commentsTotal} blocked
                            {' · '}Messages {report.messagesBlocked}/{report.messagesTotal} blocked
                          </p>
                        )}
                        <p style={{ margin: 0, fontSize: 10, color: '#2d4a1a', opacity: 0.45 }}>
                          Generated: {new Date(report.generatedAt).toLocaleString()}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p style={{ color: '#4a7030', fontStyle: 'italic', margin: 0, fontSize: 13 }}>
                      {analysing
                        ? 'Running LLM analysis — this may take a moment…'
                        : 'No report yet. Click "Run Analysis" to generate one.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
