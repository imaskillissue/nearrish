'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAuth } from '../lib/auth-context';
import { useWs } from '../lib/ws-context';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../lib/api';
import Speedometer from '../components/Speedometer';
import { DS, PANEL_STYLE, SECTION_LABEL_STYLE, BTN_PRIMARY_STYLE } from '../lib/tokens';
import { H1_STYLE, TYPE } from '../lib/typography';
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
  sentimentPositive: number; sentimentNeutral: number; sentimentNegative: number;
  timestamp: number;
}

interface OnlineHistoryPoint { ts: number; online: number; }

interface PostActivityRow { date: string; ts: number; posts: number; blocked: number; flagged: number; }
interface SeverityBreakdown { clean: number; borderline: number; inappropriate: number; harmful: number; severe: number; }
interface SentimentBreakdown { positive: number; neutral: number; negative: number; }
interface SentimentByType { posts: SentimentBreakdown; comments: SentimentBreakdown; }
type SentimentFilter = 'all' | 'posts' | 'comments';
type SeverityFilter = 'posts' | 'comments';

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const page: CSSProperties = {
  minHeight: '100vh',
  background: DS.bg,
  padding: '96px 60px 20px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
};

const card: CSSProperties = {
  width: '100%',
  maxWidth: 1100,
  background: '#fff',
  border: `3px solid ${DS.tertiary}`,
  boxShadow: DS.shadow,
  borderRadius: 0,
  padding: '2.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '2.5rem',
};

const sectionTitle: CSSProperties = { ...SECTION_LABEL_STYLE };

const panel: CSSProperties = { ...PANEL_STYLE };

const btn: CSSProperties = { ...BTN_PRIMARY_STYLE };

const filterBtn = (active: boolean): CSSProperties => ({
  padding: '0.2rem 0.6rem',
  border: `2px solid ${DS.tertiary}`,
  borderRadius: 0,
  cursor: 'pointer',
  fontSize: TYPE.size.xs,
  fontWeight: TYPE.weight.bold,
  letterSpacing: TYPE.tracking.wide,
  fontFamily: 'inherit',
  background: active ? DS.secondary : 'transparent',
  color: active ? DS.primary : DS.tertiary,
});

const tooltipStyle: CSSProperties = {
  fontSize: 11,
  borderRadius: 0,
  border: `1px solid ${DS.borderMuted}`,
  background: '#fff',
};

const badge = (sev: number | null): CSSProperties => ({
  display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: 0, fontSize: 10,
  fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  background: sev == null ? '#aaa' : sev >= 4 ? '#c0392b' : sev >= 3 ? '#e67e22' : sev >= 2 ? '#f1c40f' : '#27ae60',
  color: sev != null && sev <= 1 ? DS.secondary : '#fff',
  border: `1px solid ${DS.borderMuted}`,
});

const SEVERITY_COLORS: Record<string, string> = {
  clean: '#27ae60', borderline: '#f1c40f', inappropriate: '#e67e22', harmful: '#e74c3c', severe: '#c0392b', blocked: '#c0392b',
};
const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#27ae60', neutral: '#95a5a6', negative: '#e74c3c',
};

// ─────────────────────────────────────────────────────────────────────────────
// Live stat tile
// ─────────────────────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, pulse }: { label: string; value: number | string; sub?: string; pulse?: boolean }) {
  return (
    <div style={{
      background: 'rgba(26,26,26,0.04)',
      border: `2px solid ${DS.borderMuted}`,
      borderRadius: 0,
      padding: '1rem 1.2rem',
      display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120, flex: 1,
    }}>
      <span style={{ fontSize: TYPE.size['2xs'], fontWeight: TYPE.weight.bold, letterSpacing: TYPE.tracking.widest, textTransform: 'uppercase', color: DS.tertiary, opacity: 0.5 }}>
        {label}
      </span>
      <span style={{ fontSize: 26, fontWeight: TYPE.weight.black, color: DS.tertiary, lineHeight: 1 }}>
        {value}
        {pulse && (
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: DS.primary, marginLeft: 6, verticalAlign: 'middle',
            animation: 'pulse 1.5s infinite',
          }} />
        )}
      </span>
      {sub && <span style={{ fontSize: TYPE.size['2xs'], color: DS.textMuted }}>{sub}</span>}
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
  const [sentimentData, setSentimentData] = useState<{ name: string; value: number }[]>([]);
  const [sentimentByType, setSentimentByType] = useState<SentimentByType | null>(null);
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('posts');
  const [onlineHistory, setOnlineHistory] = useState<OnlineHistoryPoint[]>([]);
  const [topicData, setTopicData] = useState<{ topic: string; count: number }[]>([]);

  // ── Queue ──────────────────────────────────────────────────────────────────
  const [queue, setQueue] = useState<{ posts: QueuePost[]; comments: QueueComment[] } | null>(null);

  // ── Toxicity analysis ──────────────────────────────────────────────────────
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [report, setReport] = useState<ToxicityReport | null>(null);
  const [analysing, setAnalysing] = useState(false);

  const activeSentimentData = useMemo(() => {
    if (!sentimentByType) return sentimentData;
    const p = sentimentByType.posts;
    const c = sentimentByType.comments;
    const src: SentimentBreakdown =
      sentimentFilter === 'posts'    ? p :
      sentimentFilter === 'comments' ? c :
      { positive: (p.positive ?? 0) + (c.positive ?? 0),
        neutral:  (p.neutral  ?? 0) + (c.neutral  ?? 0),
        negative: (p.negative ?? 0) + (c.negative ?? 0) };
    return Object.entries(src)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [sentimentByType, sentimentFilter, sentimentData]);

  const activeSeverityData = useMemo(() => {
    if (severityFilter === 'comments' && liveStats) {
      const clean = (liveStats.totalComments ?? 0) - (liveStats.blockedComments ?? 0);
      const blocked = liveStats.blockedComments ?? 0;
      return [{ name: 'clean', value: clean }, { name: 'blocked', value: blocked }].filter(d => d.value > 0);
    }
    return severityBreakdown;
  }, [severityFilter, severityBreakdown, liveStats]);

  // Guard
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
    else if (status === 'authenticated' && !user?.isAdmin) router.replace('/');
  }, [status, user, router]);

  // Live stats via WebSocket
  useEffect(() => {
    return subscribe('adminStats', (payload) => {
      const snap = payload as unknown as LiveStats;
      setLiveStats(snap);
      setOnlineHistory(prev => [...prev, { ts: snap.timestamp, online: snap.onlineNow }].slice(-2880));
      setSentimentData([
        { name: 'positive', value: snap.sentimentPositive ?? 0 },
        { name: 'neutral',  value: snap.sentimentNeutral  ?? 0 },
        { name: 'negative', value: snap.sentimentNegative ?? 0 },
      ].filter(d => d.value > 0));
    });
  }, [subscribe]);

  const loadCharts = useCallback(async () => {
    try {
      const [activity, breakdown, sentByType, history, topics] = await Promise.all([
        apiFetch<PostActivityRow[]>('/api/admin/stats/post-activity'),
        apiFetch<SeverityBreakdown>('/api/admin/stats/severity-breakdown'),
        apiFetch<SentimentByType>('/api/admin/stats/sentiment-by-type'),
        apiFetch<OnlineHistoryPoint[]>('/api/admin/stats/online-history'),
        apiFetch<{ topic: string; count: number }[]>('/api/admin/stats/topics'),
      ]);
      setPostActivity(activity);
      setSeverityBreakdown(
        Object.entries(breakdown as SeverityBreakdown)
          .filter(([, v]) => v > 0)
          .map(([name, value]) => ({ name, value: value as number }))
      );
      setSentimentByType(sentByType as SentimentByType);
      setOnlineHistory(history);
      setTopicData(topics);
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

    if (sentimentData.length > 0) {
      const total = sentimentData.reduce((s, r) => s + r.value, 0);
      sections.push(
        ['## SENTIMENT BREAKDOWN (POSTS + COMMENTS COMBINED)'],
        ['sentiment_label', 'count', 'share_pct'],
        ...sentimentData.map(r => [r.name, r.value, total > 0 ? ((r.value / total) * 100).toFixed(2) : 0]),
        [],
      );
    }

    if (sentimentByType) {
      const { posts: sp, comments: sc } = sentimentByType;
      const ptotal = (sp.positive ?? 0) + (sp.neutral ?? 0) + (sp.negative ?? 0);
      const ctotal = (sc.positive ?? 0) + (sc.neutral ?? 0) + (sc.negative ?? 0);
      sections.push(
        ['## SENTIMENT BREAKDOWN BY TYPE'],
        ['source', 'sentiment_label', 'count', 'share_pct'],
        ['posts',    'positive', sp.positive ?? 0, ptotal > 0 ? ((( sp.positive ?? 0) / ptotal) * 100).toFixed(2) : 0],
        ['posts',    'neutral',  sp.neutral  ?? 0, ptotal > 0 ? ((( sp.neutral  ?? 0) / ptotal) * 100).toFixed(2) : 0],
        ['posts',    'negative', sp.negative ?? 0, ptotal > 0 ? ((( sp.negative ?? 0) / ptotal) * 100).toFixed(2) : 0],
        ['comments', 'positive', sc.positive ?? 0, ctotal > 0 ? ((( sc.positive ?? 0) / ctotal) * 100).toFixed(2) : 0],
        ['comments', 'neutral',  sc.neutral  ?? 0, ctotal > 0 ? ((( sc.neutral  ?? 0) / ctotal) * 100).toFixed(2) : 0],
        ['comments', 'negative', sc.negative ?? 0, ctotal > 0 ? ((( sc.negative ?? 0) / ctotal) * 100).toFixed(2) : 0],
        [],
      );
    }

    if (severityBreakdown.length > 0) {
      const total = severityBreakdown.reduce((s, r) => s + r.value, 0);
      sections.push(
        ['## SEVERITY BREAKDOWN (POSTS)'],
        ['severity_label', 'post_count', 'share_pct'],
        ...severityBreakdown.map(r => [r.name, r.value, total > 0 ? ((r.value / total) * 100).toFixed(2) : 0]),
        [],
      );
    }

    if (liveStats && liveStats.totalComments > 0) {
      const blocked = liveStats.blockedComments ?? 0;
      const clean   = (liveStats.totalComments ?? 0) - blocked;
      sections.push(
        ['## MODERATION BREAKDOWN (COMMENTS)'],
        ['label', 'count', 'share_pct'],
        ['clean',   clean,   liveStats.totalComments > 0 ? ((clean   / liveStats.totalComments) * 100).toFixed(2) : 0],
        ['blocked', blocked, liveStats.totalComments > 0 ? ((blocked / liveStats.totalComments) * 100).toFixed(2) : 0],
        [],
      );
    }

    if (topicData.length > 0) {
      const total = topicData.reduce((s, r) => s + r.count, 0);
      sections.push(
        ['## CONTENT TOPIC BREAKDOWN (POSTS + COMMENTS)'],
        ['rank', 'topic', 'count', 'share_pct'],
        ...topicData.map((r, i) => [i + 1, r.topic, r.count, total > 0 ? ((r.count / total) * 100).toFixed(2) : 0]),
        [],
      );
    }

    if (onlineHistory.length > 0) {
      sections.push(
        ['## ONLINE USER HISTORY (4H ROLLING, 5S INTERVALS)'],
        ['timestamp_iso', 'timestamp_unix_ms', 'online_users'],
        ...onlineHistory.map(r => [new Date(r.ts).toISOString(), r.ts, r.online]),
        [],
      );
    }

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
              <h1 style={H1_STYLE}>ADMIN HUB</h1>
              <p style={{ margin: '0.3rem 0 0', fontSize: TYPE.size.sm, color: DS.textMuted }}>
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
                <span style={{ fontSize: TYPE.size['2xs'], color: DS.textMuted }}>
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
          {(postActivity.length > 0 || severityBreakdown.length > 0 || sentimentData.length > 0 || onlineHistory.length > 0) && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                <p style={{ ...sectionTitle, marginBottom: 0 }}>ANALYTICS</p>
                <button style={btn} onClick={loadCharts}>↺ REFRESH</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

                {/* Online history */}
                {onlineHistory.length > 1 && (
                  <div style={panel}>
                    <p style={{ ...sectionTitle, marginBottom: '1rem' }}>
                      CONCURRENT USERS — LIVE ({onlineHistory.length} samples, {Math.round(onlineHistory.length * 5 / 60)} min)
                    </p>
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={onlineHistory} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="onlineGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={DS.secondary} stopOpacity={0.25} />
                            <stop offset="95%" stopColor={DS.secondary} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={DS.borderMuted} />
                        <XAxis dataKey="ts" scale="time" type="number" domain={['dataMin', 'dataMax']}
                          tickFormatter={(v: number) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          tick={{ fontSize: 9, fill: DS.tertiary }} tickCount={6} />
                        <YAxis tick={{ fontSize: 9, fill: DS.tertiary }} allowDecimals={false} />
                        <Tooltip
                          labelFormatter={(v) => new Date(Number(v)).toLocaleTimeString()}
                          formatter={(v) => [v, 'online']}
                          contentStyle={tooltipStyle} />
                        <Area type="monotone" dataKey="online" stroke={DS.secondary} strokeWidth={2}
                          fill="url(#onlineGrad)" dot={false} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Post activity + Sentiment */}
                <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap' }}>
                  {postActivity.length > 0 && (
                    <div style={{ ...panel, flex: 1, minWidth: 260 }}>
                      <p style={{ ...sectionTitle, marginBottom: '1rem' }}>POST ACTIVITY — LAST 7 DAYS</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={postActivity} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={DS.borderMuted} />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: DS.tertiary }} />
                          <YAxis tick={{ fontSize: 10, fill: DS.tertiary }} allowDecimals={false} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          <Bar dataKey="posts"   name="Total"   fill={DS.secondary} radius={[0, 0, 0, 0]} />
                          <Bar dataKey="flagged" name="Flagged" fill="#e67e22"       radius={[0, 0, 0, 0]} />
                          <Bar dataKey="blocked" name="Blocked" fill="#c0392b"       radius={[0, 0, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Sentiment pie */}
                  <div style={{ ...panel, flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <p style={{ ...sectionTitle, margin: 0 }}>SENTIMENT</p>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(['all', 'posts', 'comments'] as SentimentFilter[]).map(f => (
                          <button key={f} onClick={() => setSentimentFilter(f)} style={filterBtn(sentimentFilter === f)}>
                            {f === 'all' ? 'ALL' : f === 'posts' ? 'POSTS' : 'COMMENTS'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {activeSentimentData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={activeSentimentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}
                            label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                            labelLine={false} isAnimationActive={false}>
                            {activeSentimentData.map((entry) => (
                              <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name] ?? '#aaa'} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p style={{ fontSize: TYPE.size.xs, color: DS.textMuted, fontStyle: 'italic', margin: 'auto 0', alignSelf: 'center' }}>
                        No sentiment data yet.
                      </p>
                    )}
                  </div>
                </div>

                {/* Severity breakdown */}
                <div style={{ ...panel, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <p style={{ ...sectionTitle, margin: 0 }}>SEVERITY BREAKDOWN</p>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['posts', 'comments'] as SeverityFilter[]).map(f => (
                        <button key={f} onClick={() => setSeverityFilter(f)} style={filterBtn(severityFilter === f)}>
                          {f === 'posts' ? 'POSTS' : 'COMMENTS'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {activeSeverityData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={activeSeverityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}
                          isAnimationActive={false}
                          label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                          labelLine={false}>
                          {activeSeverityData.map((entry) => (
                            <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] ?? '#aaa'} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p style={{ fontSize: TYPE.size.xs, color: DS.textMuted, fontStyle: 'italic', alignSelf: 'center', margin: 'auto 0' }}>
                      No data yet.
                    </p>
                  )}
                </div>

                {/* Topic breakdown */}
                {(() => {
                  const total = topicData.reduce((s, r) => s + r.count, 0);
                  const TOPIC_COLORS = [DS.secondary, '#27ae60', '#2ecc71', '#f1c40f', '#e67e22', '#e74c3c', '#c0392b', '#9b59b6', '#3498db', '#1abc9c', '#95a5a6'];
                  return (
                    <div style={panel}>
                      <p style={{ ...sectionTitle, marginBottom: '1rem' }}>CONTENT TOPICS</p>
                      {topicData.length > 0 ? (
                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 220 }}>
                            <ResponsiveContainer width="100%" height={220}>
                              <PieChart>
                                <Pie data={topicData} dataKey="count" nameKey="topic" cx="50%" cy="50%" outerRadius={80}
                                  isAnimationActive={false}
                                  label={({ percent }: { percent?: number }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                                  labelLine={false}>
                                  {topicData.map((entry, i) => (
                                    <Cell key={entry.topic} fill={TOPIC_COLORS[i % TOPIC_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(v, n) => [v, n]} contentStyle={tooltipStyle} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div style={{ flex: 1, minWidth: 180 }}>
                            <p style={{ ...sectionTitle, marginBottom: '0.8rem' }}>RANKED</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {topicData.map((r, i) => (
                                <div key={r.topic} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ width: 10, height: 10, borderRadius: 0, background: TOPIC_COLORS[i % TOPIC_COLORS.length], flexShrink: 0, display: 'inline-block' }} />
                                  <span style={{ fontSize: TYPE.size.xs, color: DS.tertiary, flex: 1 }}>{r.topic}</span>
                                  <span style={{ fontSize: 11, color: DS.textMuted, fontFamily: 'monospace' }}>
                                    {r.count} ({total > 0 ? ((r.count / total) * 100).toFixed(1) : 0}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p style={{ fontSize: TYPE.size.xs, color: DS.textMuted, fontStyle: 'italic' }}>
                          No topic data yet. Topics are labelled automatically as new posts and comments are created.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ── Section 3: User database link ── */}
          <div>
            <p style={sectionTitle}>USER DATABASE</p>
            <div style={panel}>
              <p style={{ margin: '0 0 0.8rem', fontSize: TYPE.size.sm, color: DS.tertiary }}>
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
                <p style={{ color: DS.textMuted, fontStyle: 'italic', margin: 0 }}>Loading…</p>
              ) : queueItems.length === 0 ? (
                <p style={{ color: DS.textMuted, fontStyle: 'italic', margin: 0 }}>No flagged content. The platform is clean.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${DS.borderMuted}` }}>
                        {['TYPE', 'AUTHOR', 'CONTENT', 'SEVERITY', 'CATEGORY', 'REASON', 'TIME'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '0.4rem 0.6rem', fontWeight: TYPE.weight.bold,
                            fontSize: TYPE.size['2xs'], letterSpacing: TYPE.tracking.widest, color: DS.tertiary, opacity: 0.5 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queueItems.map(item => (
                        <tr key={item.id} style={{ borderBottom: `1px solid ${DS.borderMuted}` }}>
                          <td style={{ padding: '0.5rem 0.6rem' }}>
                            <span style={badge(item.type === 'post' ? (item as QueuePost).severity : null)}>
                              {item.type}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.6rem', color: DS.tertiary, fontFamily: 'monospace', fontSize: 11 }}>
                            {(item as QueuePost | QueueComment).authorName ?? item.authorId?.slice(0, 8) + '…'}
                          </td>
                          <td style={{ padding: '0.5rem 0.6rem', color: DS.tertiary, maxWidth: 300 }}>
                            <span title={item.content}>
                              {item.content?.slice(0, 80)}{(item.content?.length ?? 0) > 80 ? '…' : ''}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.6rem' }}>
                            <span style={badge(item.type === 'post' ? (item as QueuePost).severity : 3)}>
                              {item.type === 'post' ? ((item as QueuePost).severity ?? '—') : 'blocked'}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.6rem', color: DS.textMuted, fontSize: 11 }}>
                            {item.type === 'post' ? ((item as QueuePost).category ?? '—') : '—'}
                          </td>
                          <td style={{ padding: '0.5rem 0.6rem', color: DS.textMuted, fontSize: 11, maxWidth: 200 }}>
                            <span title={item.reason ?? ''}>
                              {item.reason?.slice(0, 60)}{(item.reason?.length ?? 0) > 60 ? '…' : ''}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.6rem', color: DS.textMuted, fontSize: 10, whiteSpace: 'nowrap' }}>
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
                <p style={{ margin: 0, fontSize: TYPE.size.xs, color: '#c0392b', fontWeight: TYPE.weight.bold }}>
                  Failed to load users: {usersError}
                </p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                <label style={{ fontSize: TYPE.size['2xs'], fontWeight: TYPE.weight.bold, letterSpacing: TYPE.tracking.widest,
                  textTransform: 'uppercase', color: DS.tertiary, opacity: 0.5 }}>
                  SELECT USER
                </label>
                <select
                  style={{
                    padding: '0.4rem 0.7rem',
                    border: `2px solid ${DS.borderMuted}`,
                    borderRadius: 0,
                    background: DS.bg,
                    fontSize: TYPE.size.sm,
                    color: DS.tertiary,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
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
                        <span style={{ fontSize: TYPE.size['2xs'], color: DS.textMuted, letterSpacing: TYPE.tracking.wide }}>
                          TOXICITY SCORE
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <p style={{ margin: '0 0 0.4rem', fontSize: TYPE.size.sm, fontWeight: TYPE.weight.bold, color: DS.tertiary }}>
                          {selectedUser.username}
                        </p>
                        <p style={{ margin: '0 0 0.5rem', fontSize: TYPE.size.sm, color: DS.textMuted, fontStyle: 'italic', lineHeight: 1.5 }}>
                          {report.summary}
                        </p>
                        {report.postsTotal !== undefined && (
                          <p style={{ margin: '0 0 0.5rem', fontSize: 11, color: DS.textMuted, fontFamily: 'monospace' }}>
                            Posts {report.postsBlocked}/{report.postsTotal} blocked
                            {' · '}Comments {report.commentsBlocked}/{report.commentsTotal} blocked
                            {' · '}Messages {report.messagesBlocked}/{report.messagesTotal} blocked
                          </p>
                        )}
                        <p style={{ margin: 0, fontSize: TYPE.size['2xs'], color: DS.textMuted }}>
                          Generated: {new Date(report.generatedAt).toLocaleString()}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p style={{ color: DS.textMuted, fontStyle: 'italic', margin: 0, fontSize: TYPE.size.sm }}>
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
