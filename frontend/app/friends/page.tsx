/**
 * Friends page (/friends)
 *
 * Displays all registered users (except the logged-in user) as clickable profile
 * cards with their friendship status relative to the current user.
 *
 * Auth: required — redirects to / if unauthenticated.
 *
 * Status states:
 *   NONE             → no connection; shows "SEND REQUEST" button
 *   PENDING_SENT     → caller sent a request; shows "CANCEL REQUEST"
 *   PENDING_RECEIVED → someone sent the caller a request; shows "ACCEPT / DECLINE"
 *   FRIEND           → accepted; shows "UNFRIEND"
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth }  from '../lib/auth-context';
import { H1_STYLE } from '../lib/typography';
import { useRouter }   from 'next/navigation';
import Link from 'next/link';
import { apiFetch, API_BASE } from '../lib/api';
import { useWs } from '../lib/ws-context';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type FriendStatus = 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIEND';

interface UserCard {
  id: string;
  name: string;
  nickname: string;
  photo: string | null;
  friends: number;
  status: FriendStatus;
  requestId?: string;
  createdAt?: number;
}

// Backend response shapes
interface BackendUser {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string | null;
}

interface BackendFriendRequest {
  id: string;
  sender: BackendUser;
  receiver: BackendUser;
  status: string;
  createdAt: number;
}

const PER_PAGE = 4;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function statusBadge(s: FriendStatus): { label: string; bg: string; color: string } | null {
  if (s === 'FRIEND')           return { label: '✓ FRIEND',   bg: '#1abc9c', color: '#fff' };
  if (s === 'PENDING_SENT')     return { label: '⏳ PENDING',  bg: '#f5c842', color: '#4a3000' };
  if (s === 'PENDING_RECEIVED') return { label: '! REQUEST',   bg: '#e05252', color: '#fff' };
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function FriendsPage() {
  const { user, status: authStatus } = useAuth();
  const { onlineUsers } = useWs();
  const router = useRouter();

  const [users,    setUsers]    = useState<UserCard[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(0);
  const [selected, setSelected] = useState<UserCard | null>(null);
  const [actionMsg, setActionMsg] = useState('');
  const [busy,     setBusy]     = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/');
  }, [authStatus, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allPublicUsers, friends, incoming, outgoing] = await Promise.all([
        apiFetch<BackendUser[]>('/api/public/users'),
        apiFetch<BackendUser[]>('/api/friends'),
        apiFetch<BackendFriendRequest[]>('/api/friends/requests/incoming'),
        apiFetch<BackendFriendRequest[]>('/api/friends/requests/outgoing'),
      ]);

      // Start with everyone as NONE
      const userMap = new Map<string, UserCard>();
      for (const u of allPublicUsers) {
        userMap.set(u.id, {
          id: u.id, name: u.username, nickname: u.username,
          photo: u.avatarUrl ? `${API_BASE}${u.avatarUrl}` : null, friends: 0, status: 'NONE',
        });
      }

      // Overwrite with actual relationship status
      for (const u of friends) {
        const existing = userMap.get(u.id);
        userMap.set(u.id, { ...(existing ?? { id: u.id, name: u.username, nickname: u.username, photo: u.avatarUrl ? `${API_BASE}${u.avatarUrl}` : null, friends: 0 }), status: 'FRIEND' });
      }
      for (const req of incoming) {
        const u = req.sender;
        const existing = userMap.get(u.id);
        userMap.set(u.id, { ...(existing ?? { id: u.id, name: u.username, nickname: u.username, photo: u.avatarUrl ? `${API_BASE}${u.avatarUrl}` : null, friends: 0 }), status: 'PENDING_RECEIVED', requestId: req.id, createdAt: req.createdAt });
      }
      for (const req of outgoing) {
        const u = req.receiver;
        const existing = userMap.get(u.id);
        userMap.set(u.id, { ...(existing ?? { id: u.id, name: u.username, nickname: u.username, photo: u.avatarUrl ? `${API_BASE}${u.avatarUrl}` : null, friends: 0 }), status: 'PENDING_SENT', requestId: req.id });
      }

      setUsers(Array.from(userMap.values()));
    } catch (err) {
      console.error('[FRIENDS] Failed to load:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (authStatus === 'authenticated') load(); }, [authStatus, load]);

  // Filter out current user in render, then sort: incoming requests first (newest first), rest after
  const meId = user?.id;
  const displayUsers = users
    .filter(u => u.id !== meId)
    .sort((a, b) => {
      const aIsIncoming = a.status === 'PENDING_RECEIVED' ? 1 : 0;
      const bIsIncoming = b.status === 'PENDING_RECEIVED' ? 1 : 0;
      if (aIsIncoming !== bIsIncoming) return bIsIncoming - aIsIncoming;
      // both incoming: newest first
      if (aIsIncoming && bIsIncoming) return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      return 0;
    });

  // ── Pagination ──────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(displayUsers.length / PER_PAGE);
  const pageUsers  = displayUsers.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function doAction(action: string, _body: Record<string, string>) {
    setBusy(true);
    setActionMsg('');
    try {
      if (action === 'friends/request') {
        await apiFetch(`/api/friends/request/${_body.targetId}`, { method: 'POST' });
      } else if (action === 'friends/accept' && selected?.requestId) {
        await apiFetch(`/api/friends/accept/${selected.requestId}`, { method: 'POST' });
      } else if (action === 'friends/decline' && selected?.requestId) {
        await apiFetch(`/api/friends/decline/${selected.requestId}`, { method: 'POST' });
      } else if (action === 'friends/cancel' && selected?.requestId) {
        await apiFetch(`/api/friends/request/${selected.requestId}`, { method: 'DELETE' });
      } else if (action === 'friends/unfriend') {
        await apiFetch(`/api/friends/friend/${selected!.id}`, { method: 'DELETE' });
      }
      await load();
      setSelected(null);
      window.dispatchEvent(new CustomEvent('friendRequestsChanged'));
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Action failed.');
    }
    setBusy(false);
  }

  // ────────────────────────────────────────────────────────────────────────────
  if (authStatus === 'loading' || loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0ddd0', display: 'flex',
        alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
        <p style={{ color: '#7a4a2a', fontStyle: 'italic' }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f0ddd0',
      padding: '88px 2rem 4rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>

      {/* Page title */}
      <div style={{ width: '100%', maxWidth: 660, marginBottom: '1.8rem' }}>
        <h1 style={H1_STYLE}>
          FRIENDS
        </h1>
        <p style={{ margin: '0.3rem 0 0', fontSize: 13, color: '#7a4a2a', fontWeight: 500 }}>
          {displayUsers.filter(u => u.status === 'FRIEND').length} friends ·{' '}
          {displayUsers.filter(u => u.status === 'PENDING_RECEIVED').length} pending requests
        </p>
      </div>

      {/* Empty state */}
      {displayUsers.length === 0 && (
        <div style={{
          background: '#e8b882', borderRadius: 20, padding: '2.5rem 3rem',
          color: '#7a4a2a', fontStyle: 'italic', fontSize: 15,
        }}>
          No other users yet. Invite some friends to join!
        </div>
      )}

      {/* Card list */}
      <div style={{ width: '100%', maxWidth: 660, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {pageUsers.map(u => <ProfileCard key={u.id} user={u} isOnline={onlineUsers.has(u.id)} onClick={() => { setSelected(u); setActionMsg(''); }} />)}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginTop: '2rem' }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{ ...arrowBtn, opacity: page === 0 ? 0.3 : 1 }}
          >
            ←
          </button>
          <span style={{ color: '#7a4a2a', fontWeight: 700, fontSize: 13 }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            style={{ ...arrowBtn, opacity: page === totalPages - 1 ? 0.3 : 1 }}
          >
            →
          </button>
        </div>
      )}

      {/* ── Action popup ── */}
      {selected && (
        <ActionPopup
          user={selected}
          isOnline={onlineUsers.has(selected.id)}
          meId={meId!}
          busy={busy}
          msg={actionMsg}
          onClose={() => setSelected(null)}
          onRequest={() => doAction('friends/request', { targetId: selected.id })}
          onAccept={()  => doAction('friends/accept',  { fromUserId: selected.id })}
          onDecline={() => doAction('friends/decline', { fromUserId: selected.id })}
          onCancel={()  => doAction('friends/cancel', { targetId: selected.id })}
          onUnfriend={() => doAction('friends/unfriend', { targetId: selected.id })}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProfileCard
// ─────────────────────────────────────────────────────────────────────────────
function ProfileCard({ user, isOnline, onClick }: { user: UserCard; isOnline: boolean; onClick: () => void }) {
  const badge = statusBadge(user.status);

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '1.2rem',
        background: user.status === 'FRIEND' ? '#d4aa6a' : '#e0a870',
        borderRadius: 18, padding: '1.1rem 1.4rem',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        boxShadow: '0 4px 16px rgba(100,40,0,0.10)',
        transition: 'filter 0.15s, transform 0.1s',
        width: '100%',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.06)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'none'; }}
    >

      {/* ── Left: text ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {badge && (
          <span style={{
            alignSelf: 'flex-start', fontSize: 9, fontWeight: 800,
            letterSpacing: '0.12em', padding: '2px 7px', borderRadius: 20,
            background: badge.bg, color: badge.color, marginBottom: 4,
          }}>
            {badge.label}
          </span>
        )}
        <span style={{ fontSize: 20, fontStyle: 'italic', fontWeight: 700, color: '#1a0a00', lineHeight: 1.2 }}>
          {user.name}
        </span>
        <span style={{ fontSize: 14, fontStyle: 'italic', color: '#4a2a00', lineHeight: 1.2 }}>
          {user.nickname}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#5a3010', marginTop: 6, textTransform: 'uppercase' }}>
          {user.friends > 0 ? `FRIENDS – ${user.friends}` : ''}
        </span>
      </div>

      {/* ── Right: avatar + online dot ── */}
      <div style={{ position: 'relative', flexShrink: 0, width: 72, height: 72 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(0,0,0,0.18)', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {user.photo
            ? <img src={user.photo} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <svg viewBox="0 0 100 100" width="65%" height="65%">
                <circle cx="50" cy="36" r="22" fill="rgba(255,255,255,0.35)" />
                <path d="M8 95 Q8 63 50 63 Q92 63 92 95 Z" fill="rgba(255,255,255,0.35)" />
              </svg>
          }
        </div>
        {isOnline && (
          <div style={{
            position: 'absolute', bottom: 3, right: 3,
            width: 16, height: 16, borderRadius: '50%',
            background: '#27ae60', border: '2.5px solid #e0a870',
            boxSizing: 'border-box',
          }} />
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionPopup
// ─────────────────────────────────────────────────────────────────────────────
interface PopupProps {
  user: UserCard; isOnline: boolean; meId: string; busy: boolean; msg: string;
  onClose: () => void;
  onRequest: () => void; onAccept: () => void; onDecline: () => void;
  onCancel: () => void; onUnfriend: () => void;
}

function ActionPopup({ user, isOnline, busy, msg, onClose, onRequest, onAccept, onDecline, onCancel, onUnfriend }: PopupProps) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#e8c49a', borderRadius: 22,
        padding: '2.2rem 2.6rem', width: 340, maxWidth: '90vw',
        boxShadow: '0 16px 64px rgba(0,0,0,0.22)',
        display: 'flex', flexDirection: 'column', gap: '1.1rem',
      }}>

        {/* User summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ position: 'relative', flexShrink: 0, width: 56, height: 56 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,0,0,0.15)',
              overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {user.photo
                ? <img src={user.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <svg viewBox="0 0 100 100" width="65%" height="65%">
                    <circle cx="50" cy="36" r="22" fill="rgba(255,255,255,0.4)" />
                    <path d="M8 95 Q8 63 50 63 Q92 63 92 95 Z" fill="rgba(255,255,255,0.4)" />
                  </svg>
              }
            </div>
            {isOnline && (
              <div style={{
                position: 'absolute', bottom: 2, right: 2,
                width: 14, height: 14, borderRadius: '50%',
                background: '#27ae60', border: '2px solid #e8c49a',
                boxSizing: 'border-box',
              }} />
            )}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, fontStyle: 'italic', color: '#1a0a00' }}>{user.name}</div>
            {isOnline
              ? <div style={{ fontSize: 12, color: '#27ae60', fontWeight: 700 }}>● Online</div>
              : <div style={{ fontSize: 13, fontStyle: 'italic', color: '#5a3010' }}>{user.nickname}</div>
            }
          </div>
        </div>

        {/* Action text */}
        <div style={{ fontSize: 13, color: '#4a2a00', lineHeight: 1.5 }}>
          {user.status === 'NONE' && `Send a friend request to ${user.name}?`}
          {user.status === 'PENDING_SENT' && `Your friend request to ${user.name} is pending.`}
          {user.status === 'PENDING_RECEIVED' && `${user.name} wants to be your friend.`}
          {user.status === 'FRIEND' && `You and ${user.name} are friends.`}
        </div>

        {msg && <p style={{ margin: 0, fontSize: 12, color: '#c0392b', fontWeight: 600 }}>{msg}</p>}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
          {user.status === 'NONE' && (
            <ActionBtn label="SEND REQUEST" bg="#1a8a5a" disabled={busy} onClick={onRequest} />
          )}
          {user.status === 'PENDING_SENT' && (
            <ActionBtn label="CANCEL REQUEST" bg="#c0392b" disabled={busy} onClick={onCancel} />
          )}
          {user.status === 'PENDING_RECEIVED' && (<>
            <ActionBtn label="ACCEPT"  bg="#1a8a5a" disabled={busy} onClick={onAccept}  />
            <ActionBtn label="DECLINE" bg="#c0392b" disabled={busy} onClick={onDecline} />
          </>)}
          {user.status === 'FRIEND' && (
            <ActionBtn label="UNFRIEND" bg="#c0392b" disabled={busy} onClick={onUnfriend} />
          )}
          <Link href={`/profile/${user.id}`} style={{
            padding: '0.5rem 1.1rem', borderRadius: 9,
            background: 'rgba(26,92,42,0.15)', color: '#1a5c2a',
            fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
          }}>
            PROFILE
          </Link>
          <Link href={`/messages?to=${user.id}&name=${encodeURIComponent(user.name)}`} style={{
            padding: '0.5rem 1.1rem', borderRadius: 9,
            background: '#2e7d32', color: '#fff',
            fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
          }}>
            MESSAGE
          </Link>
          <ActionBtn label="CLOSE" bg="rgba(0,0,0,0.25)" disabled={busy} onClick={onClose} />
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ label, bg, disabled, onClick }: {
  label: string; bg: string; disabled: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '0.5rem 1.1rem', borderRadius: 9, border: 'none',
      background: bg, color: '#fff', fontSize: 11, fontWeight: 800,
      letterSpacing: '0.1em', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1, fontFamily: 'inherit',
      transition: 'filter 0.12s',
    }}>
      {label}
    </button>
  );
}

const arrowBtn: React.CSSProperties = {
  width: 44, height: 44, borderRadius: '50%',
  background: '#e0a870', border: 'none', cursor: 'pointer',
  fontSize: 20, color: '#4a2a00', fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
