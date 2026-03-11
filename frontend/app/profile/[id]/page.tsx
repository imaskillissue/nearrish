'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import styles from './ProfileView.module.css';
import { H1_STYLE } from '../../lib/typography';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, API_BASE } from '../../lib/api';

function validatePassword(pw: string): string[] {
  const errors: string[] = [];
  if (pw.length < 8)            errors.push('min 8 chars');
  if (!/[A-Z]/.test(pw))        errors.push('uppercase letter');
  if (!/[a-z]/.test(pw))        errors.push('lowercase letter');
  if (!/[0-9]/.test(pw))        errors.push('number');
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push('special character');
  return errors;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: mime });
}

function cropToCanvas(src: string, pos: { x: number; y: number }): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const SIZE = 560;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;
      const { naturalWidth: iw, naturalHeight: ih } = img;
      const scale   = Math.max(SIZE / iw, SIZE / ih);
      const scaledW = iw * scale;
      const scaledH = ih * scale;
      const offsetX = -(scaledW - SIZE) * (pos.x / 100);
      const offsetY = -(scaledH - SIZE) * (pos.y / 100);
      ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = src;
  });
}

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

  const [profile,    setProfile]    = useState<ProfileData | null>(null);
  const [status,     setStatus]     = useState<'loading' | 'not_found' | 'ok'>('loading');
  const currentUid = authUser?.id ?? null;

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editing,       setEditing]       = useState(false);
  const [editName,      setEditName]      = useState('');
  const [editNickname,  setEditNickname]  = useState('');
  const [editAddress,   setEditAddress]   = useState('');
  const [editMsg,       setEditMsg]       = useState('');

  // ── Avatar edit state ──────────────────────────────────────────────────────
  const [editBlobUrl,  setEditBlobUrl]  = useState<string | null>(null);
  const [editPos,      setEditPos]      = useState({ x: 50, y: 50 });
  const [avDragging,   setAvDragging]   = useState(false);
  const isDragging  = useRef(false);
  const hasDragged  = useRef(false);
  const dragData    = useRef({ mouseX: 0, mouseY: 0, posX: 50, posY: 50 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Friend state (for non-owner) ───────────────────────────────────────────
  type FriendStatus = 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIEND';
  const [friendStatus,    setFriendStatus]    = useState<FriendStatus>('NONE');
  const [friendRequestId, setFriendRequestId] = useState('');
  const [friendBusy,      setFriendBusy]      = useState(false);
  const [friendMsg,       setFriendMsg]       = useState('');

  // ── Password state ─────────────────────────────────────────────────────────
  const [showPw,    setShowPw]    = useState(false);
  const [curPw,     setCurPw]     = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg,     setPwMsg]     = useState('');

  // ── Global drag listeners ──────────────────────────────────────────────────
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const dx = e.clientX - dragData.current.mouseX;
      const dy = e.clientY - dragData.current.mouseY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged.current = true;
      setEditPos({
        x: Math.max(0, Math.min(100, dragData.current.posX + dx / 2)),
        y: Math.max(0, Math.min(100, dragData.current.posY + dy / 2)),
      });
    }
    function onUp() {
      if (isDragging.current && !hasDragged.current) {
        fileInputRef.current?.click();
      }
      isDragging.current = false;
      setAvDragging(false);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, []);

  function handleImgMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
    hasDragged.current = false;
    setAvDragging(true);
    dragData.current = {
      mouseX: e.clientX, mouseY: e.clientY,
      posX:   editPos.x, posY:   editPos.y,
    };
  }

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setEditBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
    setEditPos({ x: 50, y: 50 });
  }

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
        setEditName(resolvedName);
        setEditNickname(resolvedNickname);
        setEditAddress(resolvedAddress);
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
  }, [profileId, isOwner, authUser, profile]);

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSaveEdit() {
    setEditMsg('Saving…');
    try {
      // Save name / nickname / address
      const updated = await apiFetch<{ name: string; nickname: string; address: string }>(
        '/api/users/me', {
          method: 'PATCH',
          body: JSON.stringify({ name: editName, nickname: editNickname, address: editAddress }),
        }
      );
      setProfile(p => p ? { ...p, name: updated.name, nickname: updated.nickname, address: updated.address } : p);

      // Save avatar if changed
      if (editBlobUrl) {
        const base64 = await cropToCanvas(editBlobUrl, editPos);
        const blob = dataUrlToBlob(base64);
        const fd = new FormData();
        fd.append('file', blob, 'avatar.jpg');
        const res = await fetch(`${API_BASE}/api/users/me/avatar`, {
          method: 'POST',
          headers: { AUTH: localStorage.getItem('session_token') ?? '' },
          body: fd,
        });
        if (!res.ok) throw new Error('Upload failed');
        const saved = await res.json() as { avatarUrl: string };
        setProfile(p => p ? { ...p, avatar: `${API_BASE}${saved.avatarUrl}` } : p);
        URL.revokeObjectURL(editBlobUrl);
        setEditBlobUrl(null);
      }

      setEditing(false);
      setEditMsg('Profile updated!');
    } catch {
      setEditMsg('Failed to save — please try again.');
    }
    setTimeout(() => setEditMsg(''), 3000);
  }

  function handleCancelEdit() {
    if (profile) {
      setEditName(profile.name);
      setEditNickname(profile.nickname);
      setEditAddress(profile.address);
    }
    if (editBlobUrl) { URL.revokeObjectURL(editBlobUrl); setEditBlobUrl(null); }
    setEditPos({ x: 50, y: 50 });
    setEditing(false);
  }

  // ── Password change ────────────────────────────────────────────────────────
  const newPwErrors = validatePassword(newPw);
  const pwValid     = curPw.length > 0 && newPwErrors.length === 0 && newPw === confirmPw;

  async function handleChangePw() {
    if (!pwValid) return;
    // TODO: Connect to real backend API to change password
    setPwMsg('Password change not connected to backend yet.');
    setCurPw(''); setNewPw(''); setConfirmPw('');
    setShowPw(false);
    setTimeout(() => setPwMsg(''), 3000);
  }

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

  // The avatar src to display — new blob in edit mode takes priority
  const avatarSrc = editing && editBlobUrl ? editBlobUrl : profile.avatar;
  const avatarPos = editing && editBlobUrl ? editPos     : { x: 50, y: 50 };

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <h1 className={styles.pageTitle} style={H1_STYLE}>{profile.nickname}</h1>
        </div>

        {/* ── Main row: avatar + info ── */}
        <div className={styles.mainRow}>

          {/* ── Avatar ── */}
          <div
            className={`${styles.avatar} ${editing ? styles.avatarEditing : ''}`}
            onClick={editing && !avatarSrc ? () => fileInputRef.current?.click() : undefined}
          >
            {avatarSrc
              ? <img
                  src={avatarSrc}
                  alt="avatar"
                  className={styles.avatarImg}
                  style={{
                    objectPosition: `${avatarPos.x}% ${avatarPos.y}%`,
                    cursor: editing ? (avDragging ? 'grabbing' : 'grab') : 'default',
                  }}
                  onMouseDown={editing ? handleImgMouseDown : undefined}
                  draggable={false}
                />
              : <svg viewBox="0 0 100 100" width="72%" height="72%" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="36" r="22" fill="#4a6e2a" />
                  <path d="M8 95 Q8 63 50 63 Q92 63 92 95 Z" fill="#4a6e2a" />
                </svg>
            }
            {editing && (
              <div className={styles.avatarOverlay}>
                {avatarSrc ? 'DRAG · CLICK TO CHANGE' : 'CLICK TO ADD PHOTO'}
              </div>
            )}
            <input
              ref={fileInputRef} type="file" accept="image/*"
              style={{ display: 'none' }} onChange={handleAvatarFileChange}
            />
          </div>

          {/* ── Info ── */}
          <div className={styles.infoCol}>

            <div className={styles.field}>
              <span className={styles.fieldLbl}>NAME</span>
              {editing
                ? <input
                    className={styles.editInput}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    maxLength={100}
                    placeholder="Full name…"
                  />
                : <span className={styles.fieldVal}>{profile.name}</span>
              }
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLbl}>NICKNAME</span>
              {editing
                ? <input
                    className={styles.editInput}
                    value={editNickname}
                    onChange={e => setEditNickname(e.target.value)}
                    maxLength={8}
                    placeholder="Nickname…"
                  />
                : <span className={styles.fieldVal}>{profile.nickname}</span>
              }
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLbl}>ADDRESS</span>
              {editing
                ? <input
                    className={styles.editInput}
                    value={editAddress}
                    onChange={e => setEditAddress(e.target.value)}
                    maxLength={100}
                    placeholder="Enter address…"
                  />
                : <span className={styles.fieldVal}>{profile.address}</span>
              }
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

        {/* ── Owner actions ── */}
        {isOwner && (
          <div className={styles.changeSection}>

            {!editing && !showPw && (
              <div className={styles.actionBar}>
                <button className={styles.btnChange} onClick={() => setEditing(true)}>
                  CHANGE
                </button>
                {editMsg && <span className={styles.msg}>{editMsg}</span>}
              </div>
            )}

            {editing && (
              <div className={styles.actionBar}>
                <button className={styles.btnPrimary}   onClick={handleSaveEdit}>SAVE</button>
                <button className={styles.btnSecondary} onClick={handleCancelEdit}>CANCEL</button>
                <button className={styles.btnOutline}   onClick={() => { setShowPw(true); setEditing(false); }}>
                  CHANGE PASSWORD
                </button>
                {editMsg && <span className={styles.msg}>{editMsg}</span>}
              </div>
            )}

            {showPw && (
              <div className={styles.pwPanel}>
                <div className={styles.pwGrid}>
                  <div className={styles.pwField}>
                    <span className={styles.fieldLbl}>CURRENT PASSWORD</span>
                    <input className={styles.pwInput} type="password"
                      placeholder="Current…" value={curPw}
                      onChange={e => setCurPw(e.target.value)} />
                  </div>
                  <div className={styles.pwField}>
                    <span className={styles.fieldLbl}>NEW PASSWORD</span>
                    <input className={styles.pwInput} type="password"
                      placeholder="New…" value={newPw}
                      onChange={e => setNewPw(e.target.value)} />
                    {newPw.length > 0 && newPwErrors.length > 0 && (
                      <span className={styles.pwErr}>needs: {newPwErrors.join(', ')}</span>
                    )}
                  </div>
                  <div className={styles.pwField}>
                    <span className={styles.fieldLbl}>CONFIRM NEW</span>
                    <input className={styles.pwInput} type="password"
                      placeholder="Confirm…" value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)} />
                    {confirmPw.length > 0 && newPw !== confirmPw && (
                      <span className={styles.pwErr}>passwords do not match</span>
                    )}
                  </div>
                </div>
                <div className={styles.actionBar}>
                  <button className={styles.btnPrimary} onClick={handleChangePw} disabled={!pwValid}>
                    UPDATE PASSWORD
                  </button>
                  <button className={styles.btnSecondary} onClick={() => {
                    setShowPw(false); setCurPw(''); setNewPw(''); setConfirmPw('');
                  }}>
                    CANCEL
                  </button>
                  {pwMsg && <span className={styles.msg}>{pwMsg}</span>}
                </div>
              </div>
            )}

          </div>
        )}

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
                  padding: '6px 14px', borderRadius: 9,
                  background: '#1abc9c', color: '#fff',
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
                }}>✓ FRIENDS</span>
                <button className={styles.btnSecondary} onClick={handleUnfriend} disabled={friendBusy}>
                  UNFRIEND
                </button>
              </>)}
              <Link href={`/messages?to=${profileId}&name=${encodeURIComponent(profile.name)}`} style={{
                padding: '6px 14px', borderRadius: 9,
                background: '#2e7d32', color: '#fff',
                fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
              }}>
                MESSAGE
              </Link>
              {friendMsg && <span className={styles.msg}>{friendMsg}</span>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
