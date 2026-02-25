'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import styles from './Profile.module.css';
import { H1_STYLE } from '../lib/typography';

const ALL_INTERESTS = [
  'RELATIONSHIP', 'MOVEMENT',
  'CULTURAL',     'GAMES',
  'CREATIVE',     'FOOD',
  'SHOWS',        'COMERCIAL',
];

const INTEREST_COLOR: Record<string, string> = {
  RELATIONSHIP: '#e74c8b',
  MOVEMENT:     '#27ae60',
  CULTURAL:     '#8e44ad',
  GAMES:        '#e67e22',
  CREATIVE:     '#2980b9',
  FOOD:         '#c0392b',
  SHOWS:        '#f39c12',
  COMERCIAL:    '#16a085',
};

function validatePassword(pw: string): string[] {
  const errors: string[] = [];
  if (pw.length < 8)               errors.push('min 8 chars');
  if (!/[A-Z]/.test(pw))           errors.push('uppercase letter');
  if (!/[a-z]/.test(pw))           errors.push('lowercase letter');
  if (!/[0-9]/.test(pw))           errors.push('number');
  if (!/[^A-Za-z0-9]/.test(pw))    errors.push('special character');
  return errors;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Crops the blobUrl to a square using object-fit:cover logic at pos (0-100% each axis).
// Returns a base64 JPEG — no separate position metadata needed in the backend.
function cropToCanvas(blobUrl: string, pos: { x: number; y: number }): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const SIZE = 560; // 2× for retina sharpness
      const canvas = document.createElement('canvas');
      canvas.width  = SIZE;
      canvas.height = SIZE;
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

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName]           = useState('');
  const [nickname, setNickname]   = useState('');
  const [address, setAddress]     = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hovering, setHovering]   = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── Avatar drag-to-reposition ───────────────────────────────────────────────
  const [imgPos, setImgPos]     = useState({ x: 50, y: 50 });
  const [dragging, setDragging] = useState(false); // for cursor style only
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const dragData   = useRef({ mouseX: 0, mouseY: 0, posX: 50, posY: 50 });
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      if (isDragging.current && !hasDragged.current) {
        // Short click (no drag) — open file picker
        fileInputRef.current?.click();
      }
      isDragging.current = false;
      setDragging(false);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',  onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',  onUp);
    };
  }, []);

  function handleImgMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation(); // don't bubble to container
    isDragging.current = true;
    hasDragged.current = false;
    setDragging(true);
    dragData.current = {
      mouseX: e.clientX, mouseY: e.clientY,
      posX: imgPos.x,    posY: imgPos.y,
    };
  }

  // When no photo yet: container click opens file picker
  function handleEmptyClick() {
    fileInputRef.current?.click();
  }

  function toggleInterest(interest: string) {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  }

  async function handleSave() {
    if (!isValid) return;
    setSaveError('');
    let avatarData: string | null = null;
    if (avatarUrl) {
      // Crop to the user's chosen position before storing
      avatarData = await cropToCanvas(avatarUrl, imgPos);
    }
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, nickname, email, password, address, interests, avatar: avatarData }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setSaveError(json.error ?? 'Error saving profile.');
      return;
    }
    const { userId } = await res.json();
    await signIn('credentials', { email, password, redirect: false });
    router.push(`/profile/${userId}`);
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
    setImgPos({ x: 50, y: 50 }); // reset to centre on new upload
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  const pwErrors = validatePassword(password);

  const missing: string[] = [];
  if (!name.trim() || !nickname.trim() || !address.trim()) missing.push('fill all fields');
  if (!email.trim() || !EMAIL_RE.test(email))              missing.push('valid email required');
  if (pwErrors.length > 0)                                  missing.push(`password needs: ${pwErrors.join(', ')}`);
  if (password !== confirm)                                  missing.push('passwords do not match');
  if (interests.length === 0)                               missing.push('choose an interest');
  if (!avatarUrl)                                           missing.push('add a photo');
  const isValid = missing.length === 0;

  // ── Error highlights (active only while hovering SAVE) ─────────────────────
  const nameError      = hovering && !name.trim();
  const nicknameError  = hovering && !nickname.trim();
  const addressError   = hovering && !address.trim();
  const emailError     = hovering && (!email.trim() || !EMAIL_RE.test(email));
  const passwordError  = hovering && pwErrors.length > 0;
  const confirmError   = hovering && password !== confirm;
  const interestsError = hovering && interests.length === 0;
  const avatarError    = hovering && !avatarUrl;

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        <h1 className={styles.userTitle} style={H1_STYLE}>NEW USER</h1>

        {/* NAME */}
        <div className={styles.field}>
          <span className={styles.fieldLabel}>NAME <span className={styles.required}>*</span></span>
          <input
            className={`${styles.fieldBox} ${nameError ? styles.fieldError : ''}`}
            type="text" placeholder="Enter user name ..." maxLength={100}
            value={name} onChange={e => setName(e.target.value)}
          />
        </div>

        {/* NICKNAME + ADDRESS */}
        <div className={styles.fieldRow}>
          <div className={styles.fieldNarrow}>
            <span className={styles.fieldLabel}>NICKNAME <span className={styles.required}>*</span></span>
            <input
              className={`${styles.fieldBox} ${nicknameError ? styles.fieldError : ''}`}
              type="text" placeholder="Nickname ..." maxLength={8}
              value={nickname} onChange={e => setNickname(e.target.value)}
            />
          </div>
          <div className={styles.fieldWide}>
            <span className={styles.fieldLabel}>ADDRESS <span className={styles.required}>*</span></span>
            <input
              className={`${styles.fieldBox} ${addressError ? styles.fieldError : ''}`}
              type="text" placeholder="Enter address ..." maxLength={100}
              value={address} onChange={e => setAddress(e.target.value)}
            />
          </div>
        </div>

        {/* EMAIL */}
        <div className={styles.field}>
          <span className={styles.fieldLabel}>EMAIL <span className={styles.required}>*</span></span>
          <input
            className={`${styles.fieldBox} ${emailError ? styles.fieldError : ''}`}
            type="email" placeholder="your@email.com" maxLength={200}
            value={email} onChange={e => setEmail(e.target.value)}
          />
        </div>

        {/* PASSWORD + CONFIRM */}
        <div className={styles.fieldRow}>
          <div className={styles.fieldNarrow}>
            <span className={styles.fieldLabel}>PASSWORD <span className={styles.required}>*</span></span>
            <input
              className={`${styles.fieldBox} ${styles.fieldBoxPassword} ${passwordError ? styles.fieldError : ''}`}
              type="password" placeholder="Password ..."
              value={password} onChange={e => setPassword(e.target.value)}
            />
          </div>
          <div className={styles.fieldNarrow}>
            <span className={styles.fieldLabel}>CONFIRM <span className={styles.required}>*</span></span>
            <input
              className={`${styles.fieldBox} ${styles.fieldBoxPassword} ${confirmError ? styles.fieldError : ''}`}
              type="password" placeholder="Confirm ..."
              value={confirm} onChange={e => setConfirm(e.target.value)}
            />
          </div>
        </div>

        {/* BOTTOM ROW */}
        <div className={styles.bottomRow}>
          <div className={styles.bottomLeft}>

            {/* Interests */}
            <div className={styles.interests}>
              <span className={styles.interestsLabel}>INTERESTS</span>
              <div className={styles.tags}>
                {ALL_INTERESTS.map(interest => {
                  const active = interests.includes(interest);
                  const color  = INTEREST_COLOR[interest];
                  return (
                    <button
                      key={interest}
                      className={`${styles.tag} ${interestsError && !active ? styles.tagError : ''}`}
                      style={active ? {
                        background: color,
                        color: '#fff',
                        outline: 'none',
                        boxShadow: `0 2px 10px ${color}55`,
                      } : {}}
                      onClick={() => toggleInterest(interest)}
                    >
                      {interest}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save */}
            <div
              className={styles.saveRow}
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
            >
              <button className={styles.saveButton} onClick={handleSave} disabled={!isValid}>
                SAVE PROFILE
              </button>
              {!isValid && (
                <span className={`${styles.saveMessage} ${hovering ? styles.saveMessageError : ''}`}>
                  {missing.join(' · ')}
                </span>
              )}
              {isValid && saveError && (
                <span className={`${styles.saveMessage} ${styles.saveMessageError}`}>
                  {saveError}
                </span>
              )}
            </div>

          </div>

          {/* ── Avatar ── */}
          <div
            className={`${styles.avatar} ${avatarError ? styles.avatarError : ''}`}
            onClick={avatarUrl ? undefined : handleEmptyClick}
            title={avatarUrl ? 'Drag to reposition · Click to change photo' : 'Click to upload photo'}
          >
            {avatarUrl
              ? <img
                  src={avatarUrl}
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
              {avatarUrl ? 'DRAG · CLICK TO CHANGE' : 'CHANGE PHOTO'}
            </div>
            <input
              ref={fileInputRef} type="file" accept="image/*"
              style={{ display: 'none' }} onChange={handleAvatarChange}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
