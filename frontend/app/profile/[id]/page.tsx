'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './ProfileView.module.css';
import { H1_STYLE } from '../../lib/typography';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, API_BASE } from '../../lib/api';
import { DS } from '../../lib/tokens';

interface ProfileData {
  userId: string;
  name: string;
  nickname: string;
  address: string;
  avatar: string | null;
  friends: number;
}

export default function ProfileViewPage() {
  const params    = useParams();
  const profileId = params?.id as string;
  const { user: authUser } = useAuth();
  const router = useRouter();

  const [profile,    setProfile]    = useState<ProfileData | null>(null);
  const [status,     setStatus]     = useState<'loading' | 'not_found' | 'ok'>('loading');
  const currentUid = authUser?.id ?? null;

  // ── Friend state (for non-owner) ───────────────────────────────────────────
  type FriendStatus = 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIEND';
  const [friendStatus,    setFriendStatus]    = useState<FriendStatus>('NONE');
  const [friendRequestId, setFriendRequestId] = useState('');
  const [friendBusy,      setFriendBusy]      = useState(false);
  const [friendMsg,       setFriendMsg]       = useState('');

  // ── Block state ──────────────────────────────────────────────────────────
  const [blocked, setBlocked] = useState(false);
  const [blockedByThem, setBlockedByThem] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<{
          id: string; username: string; name?: string; nickname?: string;
          address?: string; avatarUrl?: string | null;
        }>(`/api/public/users/${profileId}`);

        // Fetch the profile owner's friend count
        let friendCount = 0;
        try {
          const fc = await apiFetch<{ count: number }>(`/api/public/users/${profileId}/friend-count`);
          friendCount = fc.count;
        } catch { /* endpoint error — ignore */ }

        const resolvedName     = data.name     ?? data.username;
        const resolvedNickname = data.nickname ?? data.username;
        const resolvedAddress  = data.address  ?? '';

        setProfile({
          userId: data.id,
          name:     resolvedName,
          nickname: resolvedNickname,
          address:  resolvedAddress,
          avatar: data.avatarUrl ? `${API_BASE}${data.avatarUrl}` : null,
          friends: friendCount,
        });
        setStatus('ok');
      } catch {
        setStatus('not_found');
      }
    }
    load();
  }, [profileId]);

  const isOwner = !!currentUid && currentUid === profile?.userId;

  // ── Load friendship status (non-owner, logged-in only) ─────────────────────
  useEffect(() => {
    if (!authUser || isOwner || !profile) return;
    apiFetch<{ status: string; requestId: string }>(`/api/friends/status/${profileId}`)
      .then(r => { setFriendStatus(r.status as FriendStatus); setFriendRequestId(r.requestId); })
      .catch(() => {});
    // Check if current user has blocked profile owner
    apiFetch<{ blocked: boolean }>(`/api/blocks/check/${profileId}`)
      .then(r => { setBlocked(r.blocked); })
      .catch(() => {});
    // Check if profile owner has blocked current user
    apiFetch<{ blocked: boolean }>(`/api/blocks/blocked-by/${profileId}`)
      .then(r => { setBlockedByThem(r.blocked); })
      .catch(() => {});
  }, [profileId, isOwner, authUser, profile]);

  // ── Friend request actions ─────────────────────────────────────────────────
  async function handleSendRequest() {
    setFriendBusy(true); setFriendMsg('');
    try {
      await apiFetch(`/api/friends/request/${profileId}`, { method: 'POST' });
      const r = await apiFetch<{ status: string; requestId: string }>(`/api/friends/status/${profileId}`);
      setFriendStatus(r.status as FriendStatus); setFriendRequestId(r.requestId);
    } catch { setFriendMsg('Failed to send request.'); }
    setFriendBusy(false);
  }

  async function handleCancelRequest() {
    setFriendBusy(true); setFriendMsg('');
    try {
      await apiFetch(`/api/friends/request/${friendRequestId}`, { method: 'DELETE' });
      setFriendStatus('NONE'); setFriendRequestId('');
    } catch { setFriendMsg('Failed to cancel request.'); }
    setFriendBusy(false);
  }

  async function handleAcceptRequest() {
    setFriendBusy(true); setFriendMsg('');
    try {
      await apiFetch(`/api/friends/accept/${friendRequestId}`, { method: 'POST' });
      setFriendStatus('FRIEND'); setFriendRequestId('');
      setProfile(p => p ? { ...p, friends: p.friends + 1 } : p);
    } catch { setFriendMsg('Failed to accept request.'); }
    setFriendBusy(false);
  }

  async function handleDeclineRequest() {
    setFriendBusy(true); setFriendMsg('');
    try {
      await apiFetch(`/api/friends/decline/${friendRequestId}`, { method: 'POST' });
      setFriendStatus('NONE'); setFriendRequestId('');
    } catch { setFriendMsg('Failed to decline request.'); }
    setFriendBusy(false);
  }

  async function handleUnfriend() {
    setFriendBusy(true); setFriendMsg('');
    try {
      await apiFetch(`/api/friends/friend/${profileId}`, { method: 'DELETE' });
      setFriendStatus('NONE'); setFriendRequestId('');
      setProfile(p => p ? { ...p, friends: Math.max(0, p.friends - 1) } : p);
    } catch { setFriendMsg('Failed to unfriend.'); }
    setFriendBusy(false);
  }

  // ── Block / unblock ───────────────────────────────────────────────────────
  async function handleBlock() {
    setBlockBusy(true); setFriendMsg('');
    try {
      await apiFetch(`/api/blocks/${profileId}`, { method: 'POST' });
      setBlocked(true);
    } catch { setFriendMsg('Failed to block user.'); }
    setBlockBusy(false);
  }

  async function handleUnblock() {
    setBlockBusy(true); setFriendMsg('');
    try {
      await apiFetch(`/api/blocks/${profileId}`, { method: 'DELETE' });
      setBlocked(false);
    } catch { setFriendMsg('Failed to unblock user.'); }
    setBlockBusy(false);
  }

  // ── Loading / not found ────────────────────────────────────────────────────
  if (status === 'loading') return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.stateMsg}>Loading…</p>
      </div>
    </div>
  );

  if (status === 'not_found' || !profile) return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.pageTitle} style={H1_STYLE}>USER NOT FOUND</h1>
        <p className={styles.stateMsg}>No profile found for this ID.</p>
      </div>
    </div>
  );

  // ── Blocked by them ────────────────────────────────────────────────────────
  if (blockedByThem) return (
    <div className={styles.page}>
      <div className={styles.card} style={{ textAlign: 'center', padding: '48px 32px' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 0,
          background: DS.secondary, display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 20px',
          border: `2px solid ${DS.tertiary}`, boxShadow: '4px 4px 0px 0px #1B2F23',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#A3E635" strokeWidth="2.5" strokeLinecap="square">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>
        <h1 className={styles.pageTitle} style={{ ...H1_STYLE, marginBottom: 12 }}>PROFILE UNAVAILABLE</h1>
        <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, marginBottom: 24 }}>
          This user&apos;s profile is not available to you.
        </p>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* ── Header ── */}
        <div className={styles.header} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className={styles.pageTitle} style={H1_STYLE}>{profile.nickname}</h1>
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 22, lineHeight: 1, color: '#1A1A1A', padding: '0 4px',
              fontWeight: 300,
            }}
          >
            ×
          </button>
        </div>

        {/* ── Main row: avatar + info ── */}
        <div className={styles.mainRow}>

          {/* ── Avatar ── */}
          <div className={styles.avatar}>
            {profile.avatar
              ? <img
                  src={profile.avatar}
                  alt="avatar"
                  className={styles.avatarImg}
                  style={{ objectPosition: '50% 50%' }}
                  draggable={false}
                />
              : <svg viewBox="0 0 100 100" width="72%" height="72%" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="36" r="22" fill="#4a6e2a" />
                  <path d="M8 95 Q8 63 50 63 Q92 63 92 95 Z" fill="#4a6e2a" />
                </svg>
            }
          </div>

          {/* ── Info ── */}
          <div className={styles.infoCol}>

            <div className={styles.field}>
              <span className={styles.fieldLbl}>NAME</span>
              <span className={styles.fieldVal}>{profile.name}</span>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLbl}>NICKNAME</span>
              <span className={styles.fieldVal}>{profile.nickname}</span>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLbl}>ADDRESS</span>
              <span className={styles.fieldVal}>{profile.address}</span>
            </div>

            {/* Stats */}
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statLbl}>FRIENDS</span>
                <div className={styles.statBox}>{profile.friends}</div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Non-owner friend actions ── */}
        {!isOwner && authUser && (
          <div className={styles.changeSection}>
            <div className={styles.actionBar}>
              {friendStatus === 'NONE' && (
                <button className={styles.btnChange} onClick={handleSendRequest} disabled={friendBusy}>
                  ADD FRIEND
                </button>
              )}
              {friendStatus === 'PENDING_SENT' && (
                <button className={styles.btnSecondary} onClick={handleCancelRequest} disabled={friendBusy}>
                  CANCEL REQUEST
                </button>
              )}
              {friendStatus === 'PENDING_RECEIVED' && (<>
                <button className={styles.btnPrimary} onClick={handleAcceptRequest} disabled={friendBusy}>
                  ACCEPT
                </button>
                <button className={styles.btnSecondary} onClick={handleDeclineRequest} disabled={friendBusy}>
                  DECLINE
                </button>
              </>)}
              {friendStatus === 'FRIEND' && (<>
                <span style={{
                  padding: '6px 14px', borderRadius: 0,
                  background: DS.secondary, color: DS.primary,
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
                  border: `2px solid ${DS.tertiary}`,
                }}>✓ FRIENDS</span>
                <button className={styles.btnSecondary} onClick={handleUnfriend} disabled={friendBusy}>
                  UNFRIEND
                </button>
              </>)}
              {!blocked && !blockedByThem && (
                <Link href={`/messages?to=${profileId}&name=${encodeURIComponent(profile.name)}`} style={{
                  padding: '6px 14px', borderRadius: 0,
                  border: '2px solid #1A1A1A',
                  background: DS.secondary, color: DS.earth,
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                }}>
                  MESSAGE
                </Link>
              )}
              <button
                onClick={blocked ? handleUnblock : handleBlock}
                disabled={blockBusy}
                style={{
                  padding: '6px 14px', borderRadius: 0,
                  background: blocked ? '#555' : '#c0392b', color: '#fff',
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
                  border: '2px solid #1A1A1A', cursor: blockBusy ? 'wait' : 'pointer',
                }}
              >
                {blockBusy ? '…' : blocked ? 'UNBLOCK' : 'BLOCK'}
              </button>
              {friendMsg && <span className={styles.msg}>{friendMsg}</span>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
