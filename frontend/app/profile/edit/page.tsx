'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiFetch, API_BASE } from '../../lib/api';
import styles from '../Profile.module.css';
import { H1_STYLE } from '../../lib/typography';

function validatePassword(pw: string): string[] {
  const errors: string[] = [];
  if (pw.length < 8)            errors.push('min 8 chars');
  if (!/[A-Z]/.test(pw))        errors.push('uppercase letter');
  if (!/[a-z]/.test(pw))        errors.push('lowercase letter');
  if (!/[0-9]/.test(pw))        errors.push('number');
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push('special character');
  return errors;
}

function cropToCanvas(blobUrl: string, pos: { x: number; y: number }): Promise<string> {
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
    img.src = blobUrl;
  });
}

export default function EditProfilePage() {
  const router = useRouter();
  const { user, status } = useAuth();

  // ── Profile fields ─────────────────────────────────────────────────────────
  const [name,     setName]     = useState('');
  const [nickname, setNickname] = useState('');
  const [address,  setAddress]  = useState('');
  const [saveMsg,  setSaveMsg]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [hovering, setHovering] = useState(false);
  const [nameModError,     setNameModError]     = useState('');
  const [nicknameModError, setNicknameModError] = useState('');

  // ── Avatar ─────────────────────────────────────────────────────────────────
  const [avatarUrl,  setAvatarUrl]  = useState<string | null>(null); // saved url suffix
  const [avatarBlob, setAvatarBlob] = useState<string | null>(null); // new local blob
  const [imgPos,     setImgPos]     = useState({ x: 50, y: 50 });
  const [dragging,   setDragging]   = useState(false);
  const isDragging   = useRef(false);
  const hasDragged   = useRef(false);
  const dragData     = useRef({ mouseX: 0, mouseY: 0, posX: 50, posY: 50 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Password change ────────────────────────────────────────────────────────
  const [curPw,     setCurPw]     = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg,     setPwMsg]     = useState('');
  const [pwSaving,  setPwSaving]  = useState(false);

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);

  // ── Pre-fill from backend ──────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'authenticated' || !user?.id) return;
    apiFetch<{
      id: string; username: string; name?: string;
      nickname?: string; address?: string; avatarUrl?: string | null;
    }>(`/api/public/users/${user.id}`)
      .then(data => {
        setName(data.name ?? data.username ?? '');
        setNickname(data.nickname ?? data.username ?? '');
        setAddress(data.address ?? '');
        if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
      })
      .catch(() => {});
  }, [status, user?.id]);

  // ── Avatar drag-to-reposition ──────────────────────────────────────────────
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const dx = e.clientX - dragData.current.mouseX;
      const dy = e.clientY - dragData.current.mouseY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged.current = true;
      setImgPos({
        x: Math.max(0, Math.min(100, dragData.current.posX + dx / 2)),
        y: Math.max(0, Math.min(100, dragData.current.posY + dy / 2)),
      });
    }
    function onUp() {
      if (isDragging.current && !hasDragged.current) fileInputRef.current?.click();
      isDragging.current = false;
      setDragging(false);
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
    setDragging(true);
    dragData.current = { mouseX: e.clientX, mouseY: e.clientY, posX: imgPos.x, posY: imgPos.y };
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarBlob(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
    setImgPos({ x: 50, y: 50 });
  }

  // ── Save profile ───────────────────────────────────────────────────────────
  const profileMissing: string[] = [];
  if (!name.trim())     profileMissing.push('name required');
  if (!nickname.trim()) profileMissing.push('nickname required');
  if (!address.trim())  profileMissing.push('address required');
  const profileValid = profileMissing.length === 0;

  async function handleSave() {
    if (!profileValid || saving) return;
    setSaving(true); setSaveMsg(''); setNameModError(''); setNicknameModError('');

    try {
      const mod = await apiFetch<{
        name:     { blocked: boolean; reason: string };
        nickname: { blocked: boolean; reason: string };
      }>('/api/public/moderate/registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), nickname: nickname.trim() }),
      });
      if (mod.name.blocked)     setNameModError(mod.name.reason || 'Name not allowed');
      if (mod.nickname.blocked) setNicknameModError(mod.nickname.reason || 'Nickname not allowed');
      if (mod.name.blocked || mod.nickname.blocked) { setSaving(false); return; }
    } catch { /* moderation service down — server-side check still active */ }

    try {
      await apiFetch('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), nickname: nickname.trim(), address: address.trim() }),
      });

      if (avatarBlob) {
        const base64 = await cropToCanvas(avatarBlob, imgPos);
        const arr    = base64.split(',');
        const mime   = arr[0].match(/:(.*?);/)![1];
        const bstr   = atob(arr[1]);
        const u8arr  = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
        const blob = new Blob([u8arr], { type: mime });
        const form = new FormData();
        form.append('file', blob, 'avatar.jpg');
        await fetch(`${API_BASE}/api/users/me/avatar`, {
          method:  'POST',
          headers: { AUTH: localStorage.getItem('session_token') ?? '' },
          body:    form,
        });
        URL.revokeObjectURL(avatarBlob);
        setAvatarBlob(null);
      }

      setSaveMsg('Profile updated!');
      setTimeout(() => router.push(`/profile/${user!.id}`), 800);
    } catch {
      setSaveMsg('Failed to save — please try again.');
    }
    setSaving(false);
  }

  // ── Change password ────────────────────────────────────────────────────────
  const newPwErrors = validatePassword(newPw);
  const pwValid     = curPw.length > 0 && newPwErrors.length === 0 && newPw === confirmPw;

  async function handleChangePw() {
    if (!pwValid || pwSaving) return;
    setPwSaving(true); setPwMsg('');
    try {
      await apiFetch('/api/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      });
      setPwMsg('Password updated!');
      setCurPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setPwMsg(
        msg.includes('403') || msg.toLowerCase().includes('incorrect')
          ? 'Current password is incorrect.'
          : 'Failed to update password.'
      );
    }
    setPwSaving(false);
    setTimeout(() => setPwMsg(''), 4000);
  }

  // The avatar to display: new blob preview takes priority, then the saved URL
  const displayAvatar = avatarBlob ?? (avatarUrl ? `${API_BASE}${avatarUrl}` : null);

  if (status === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p style={{ textAlign: 'center', color: '#4a7030', fontStyle: 'italic' }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.contentRow}>

          {/* ── Fields column ── */}
          <div className={styles.fieldsColumn}>

            <h1 className={styles.userTitle} style={H1_STYLE}>EDIT PROFILE</h1>

            {/* NAME */}
            <div className={styles.field}>
              <span className={styles.fieldLabel}>NAME <span className={styles.required}>*</span></span>
              <input
                className={`${styles.fieldBox} ${nameModError ? styles.fieldError : ''}`}
                type="text" placeholder="Enter user name ..." maxLength={100}
                value={name} onChange={e => { setName(e.target.value); setNameModError(''); }}
              />
              {nameModError && (
                <span style={{ fontSize: 11, color: '#c0392b', marginTop: 3, display: 'block' }}>
                  🚫 {nameModError}
                </span>
              )}
            </div>

            {/* NICKNAME + ADDRESS */}
            <div className={styles.fieldRow}>
              <div className={styles.fieldNarrow}>
                <span className={styles.fieldLabel}>NICKNAME <span className={styles.required}>*</span></span>
                <input
                  className={`${styles.fieldBox} ${nicknameModError ? styles.fieldError : ''}`}
                  type="text" placeholder="Nickname ..." maxLength={8}
                  value={nickname} onChange={e => { setNickname(e.target.value); setNicknameModError(''); }}
                />
                {nicknameModError && (
                  <span style={{ fontSize: 11, color: '#c0392b', marginTop: 3, display: 'block' }}>
                    🚫 {nicknameModError}
                  </span>
                )}
              </div>
              <div className={styles.fieldWide}>
                <span className={styles.fieldLabel}>ADDRESS <span className={styles.required}>*</span></span>
                <input
                  className={`${styles.fieldBox} ${(hovering && !address.trim()) ? styles.fieldError : ''}`}
                  type="text" placeholder="Enter address ..." maxLength={100}
                  value={address} onChange={e => setAddress(e.target.value)}
                />
              </div>
            </div>

            {/* SAVE */}
            <div
              className={styles.saveRow}
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
            >
              <button
                className={styles.saveButton}
                onClick={handleSave}
                disabled={!profileValid || saving}
              >
                {saving ? 'SAVING…' : 'SAVE PROFILE'}
              </button>
              {!profileValid && (
                <span className={`${styles.saveMessage} ${hovering ? styles.saveMessageError : ''}`}>
                  {profileMissing.join(' · ')}
                </span>
              )}
              {profileValid && saveMsg && (
                <span className={`${styles.saveMessage} ${saveMsg.startsWith('Failed') ? styles.saveMessageError : ''}`}>
                  {saveMsg}
                </span>
              )}
            </div>

            {/* ── Password change ── */}
            <div style={{ borderTop: '1px solid rgba(45,74,26,0.15)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
                textTransform: 'uppercase', color: '#2d4a1a', opacity: 0.5,
              }}>
                CHANGE PASSWORD
              </span>

              <div className={styles.fieldRow} style={{ marginTop: '0.8rem' }}>
                <div className={styles.fieldNarrow}>
                  <span className={styles.fieldLabel}>CURRENT PASSWORD</span>
                  <input
                    className={styles.fieldBox}
                    type="password" placeholder="Current ..." maxLength={100}
                    value={curPw} onChange={e => setCurPw(e.target.value)}
                  />
                </div>
                <div className={styles.fieldNarrow}>
                  <span className={styles.fieldLabel}>NEW PASSWORD</span>
                  <input
                    className={styles.fieldBox}
                    type="password" placeholder="New ..."
                    value={newPw} onChange={e => setNewPw(e.target.value)}
                  />
                  {newPw.length > 0 && newPwErrors.length > 0 && (
                    <span style={{ fontSize: 11, color: '#c0392b', marginTop: 3, display: 'block' }}>
                      needs: {newPwErrors.join(', ')}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>CONFIRM NEW PASSWORD</span>
                <input
                  className={styles.fieldBox}
                  type="password" placeholder="Confirm ..."
                  value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                />
                {confirmPw.length > 0 && newPw !== confirmPw && (
                  <span style={{ fontSize: 11, color: '#c0392b', marginTop: 3, display: 'block' }}>
                    passwords do not match
                  </span>
                )}
              </div>

              <div className={styles.saveRow}>
                <button
                  className={styles.saveButton}
                  onClick={handleChangePw}
                  disabled={!pwValid || pwSaving}
                >
                  {pwSaving ? 'UPDATING…' : 'UPDATE PASSWORD'}
                </button>
                {pwMsg && (
                  <span className={`${styles.saveMessage} ${pwMsg.startsWith('Failed') || pwMsg.includes('incorrect') ? styles.saveMessageError : ''}`}>
                    {pwMsg}
                  </span>
                )}
              </div>
            </div>

          </div>{/* end fieldsColumn */}

          {/* ── Avatar column ── */}
          <div className={styles.avatarColumn}>
            <div
              className={styles.avatar}
              onClick={displayAvatar ? undefined : () => fileInputRef.current?.click()}
              title={displayAvatar ? 'Drag to reposition · Click to change photo' : 'Click to upload photo'}
            >
              {displayAvatar
                ? <img
                    src={displayAvatar}
                    alt="Avatar"
                    className={styles.avatarPhoto}
                    style={{
                      objectPosition: `${imgPos.x}% ${imgPos.y}%`,
                      cursor: dragging ? 'grabbing' : 'grab',
                    }}
                    onMouseDown={handleImgMouseDown}
                    draggable={false}
                  />
                : <svg viewBox="0 0 100 100" className={styles.avatarIcon} xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="36" r="22" fill="#4a6e2a" />
                    <path d="M8 95 Q8 63 50 63 Q92 63 92 95 Z" fill="#4a6e2a" />
                  </svg>
              }
              <div className={styles.avatarOverlay}>
                {displayAvatar ? 'DRAG · CLICK TO CHANGE' : 'CHANGE PHOTO'}
              </div>
              <input
                ref={fileInputRef} type="file" accept="image/*"
                style={{ display: 'none' }} onChange={handleAvatarChange}
              />
            </div>
          </div>{/* end avatarColumn */}

        </div>{/* end contentRow */}
      </div>
    </div>
  );
}
