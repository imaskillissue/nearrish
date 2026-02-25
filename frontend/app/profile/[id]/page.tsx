'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import styles from './ProfileView.module.css';
import { H1_STYLE } from '../../lib/typography';

const ALL_INTERESTS = [
  'RELATIONSHIP', 'MOVEMENT',
  'CULTURAL',     'GAMES',
  'CREATIVE',     'FOOD',
  'SHOWS',        'COMMERCIAL',
];

function validatePassword(pw: string): string[] {
  const errors: string[] = [];
  if (pw.length < 8)            errors.push('min 8 chars');
  if (!/[A-Z]/.test(pw))        errors.push('uppercase letter');
  if (!/[a-z]/.test(pw))        errors.push('lowercase letter');
  if (!/[0-9]/.test(pw))        errors.push('number');
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push('special character');
  return errors;
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
  interests: string[];
  avatar: string | null;
  attendedEvents: number;
  events: number;
  friends: number;
}

export default function ProfileViewPage() {
  const params    = useParams();
  const profileId = params?.id as string;

  const [profile,    setProfile]    = useState<ProfileData | null>(null);
  const [status,     setStatus]     = useState<'loading' | 'not_found' | 'ok'>('loading');
  const [currentUid, setCurrentUid] = useState<string | null>(null);

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editing,       setEditing]       = useState(false);
  const [editAddress,   setEditAddress]   = useState('');
  const [editInterests, setEditInterests] = useState<string[]>([]);
  const [editMsg,       setEditMsg]       = useState('');

  // ── Avatar edit state ──────────────────────────────────────────────────────
  const [editBlobUrl,  setEditBlobUrl]  = useState<string | null>(null);
  const [editPos,      setEditPos]      = useState({ x: 50, y: 50 });
  const [avDragging,   setAvDragging]   = useState(false);
  const isDragging  = useRef(false);
  const hasDragged  = useRef(false);
  const dragData    = useRef({ mouseX: 0, mouseY: 0, posX: 50, posY: 50 });
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const [profileRes, meRes] = await Promise.all([
        fetch(`/api/profile/${profileId}`),
        fetch('/api/me'),
      ]);
      if (!profileRes.ok) { setStatus('not_found'); return; }
      const data: ProfileData  = await profileRes.json();
      const { userId: uid }    = await meRes.json();
      setProfile(data);
      setEditAddress(data.address);
      setEditInterests(data.interests);
      setCurrentUid(uid ?? null);
      setStatus('ok');
    }
    load();
  }, [profileId]);

  const isOwner = !!currentUid && currentUid === profile?.userId;

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSaveEdit() {
    const body: Record<string, unknown> = {
      address:   editAddress,
      interests: editInterests,
    };
    if (editBlobUrl) {
      body.avatar = await cropToCanvas(editBlobUrl, editPos);
    }
    const res = await fetch(`/api/profile/${profileId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    if (res.ok) {
      setProfile(p => p ? {
        ...p,
        address:   editAddress,
        interests: editInterests,
        avatar:    (body.avatar as string) ?? p.avatar,
      } : p);
      if (editBlobUrl) { URL.revokeObjectURL(editBlobUrl); setEditBlobUrl(null); }
      setEditMsg('Saved.');
      setEditing(false);
    } else {
      setEditMsg('Error saving. Try again.');
    }
    setTimeout(() => setEditMsg(''), 2500);
  }

  function handleCancelEdit() {
    if (profile) { setEditAddress(profile.address); setEditInterests(profile.interests); }
    if (editBlobUrl) { URL.revokeObjectURL(editBlobUrl); setEditBlobUrl(null); }
    setEditPos({ x: 50, y: 50 });
    setEditing(false);
  }

  // ── Password change ────────────────────────────────────────────────────────
  const newPwErrors = validatePassword(newPw);
  const pwValid     = curPw.length > 0 && newPwErrors.length === 0 && newPw === confirmPw;

  async function handleChangePw() {
    if (!pwValid) return;
    const res = await fetch(`/api/profile/${profileId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
    });
    if (res.ok) {
      setPwMsg('Password updated.');
      setCurPw(''); setNewPw(''); setConfirmPw('');
      setShowPw(false);
    } else {
      const json = await res.json().catch(() => ({}));
      setPwMsg(json.error ?? 'Error updating password.');
    }
    setTimeout(() => setPwMsg(''), 3000);
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
          {!isOwner && <span className={styles.badge}>VIEWING</span>}
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
              <span className={styles.fieldVal}>{profile.name}</span>
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
              {([
                { label: 'ATTENDED', value: profile.attendedEvents },
                { label: 'EVENTS',   value: profile.events },
                { label: 'FRIENDS',  value: profile.friends },
              ] as const).map(s => (
                <div key={s.label} className={styles.stat}>
                  <span className={styles.statLbl}>{s.label}</span>
                  <div className={styles.statBox}>{s.value}</div>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* ── Interests ── */}
        <div className={styles.section}>
          <span className={styles.sectionLbl}>INTERESTS</span>
          <div className={styles.tags}>
            {ALL_INTERESTS.map(interest => {
              const active = (editing ? editInterests : profile.interests).includes(interest);
              return (
                <button
                  key={interest}
                  className={`${styles.tag} ${active ? styles.tagActive : ''}`}
                  onClick={editing ? () => setEditInterests(p =>
                    p.includes(interest) ? p.filter(i => i !== interest) : [...p, interest]
                  ) : undefined}
                  style={!editing ? { cursor: 'default' } : undefined}
                >
                  {interest}
                </button>
              );
            })}
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

      </div>
    </div>
  );
}
