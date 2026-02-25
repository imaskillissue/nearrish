'use client';

/**
 * /events — full events page
 *
 * - Multi-select category filter bar (horizontal scroll, thin scrollbar)
 * - 3D cylindrical rollerdeck: prev/next cards peek, rotateX transforms
 * - Cards show ONLINE/PRESENCIAL badge, photo banner with focal point
 * - ATTEND / LEAVE / EDIT per card
 * - Modal: multi-category select, start+end times, capacity/price/minAge/petFriendly,
 *          ONLINE/PRESENCIAL toggle, drag-to-upload + drag-to-reposition photo
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { H1_STYLE } from '../lib/typography';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventItem {
  id: string;
  title: string;
  description: string;
  categories: string[];
  startDate: string;
  endDate: string | null;
  address: string;
  photo: string | null;
  photoX: number;
  photoY: number;
  capacity: number;
  price: number;
  minAge: number;
  petFriendly: boolean;
  mode: string;
  createdAt: string;
  creatorId: string;
  creator: { id: string; name: string; nickname: string; photo: string | null };
  _count: { attendees: number };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATS = ['RELATIONSHIP', 'MOVEMENT', 'CULTURAL', 'GAMES', 'CREATIVE', 'FOOD', 'SHOWS', 'COMERCIAL'] as const;

const CAT_COLOR: Record<string, string> = {
  RELATIONSHIP: '#e74c8b',
  MOVEMENT:     '#27ae60',
  CULTURAL:     '#8e44ad',
  GAMES:        '#e67e22',
  CREATIVE:     '#2980b9',
  FOOD:         '#c0392b',
  SHOWS:        '#f39c12',
  COMERCIAL:    '#16a085',
};

const CAT_GRADIENT: Record<string, string> = {
  RELATIONSHIP: 'linear-gradient(135deg,#e74c8b,#c0392b)',
  MOVEMENT:     'linear-gradient(135deg,#27ae60,#1a7a40)',
  CULTURAL:     'linear-gradient(135deg,#8e44ad,#5b2c6f)',
  GAMES:        'linear-gradient(135deg,#e67e22,#d35400)',
  CREATIVE:     'linear-gradient(135deg,#2980b9,#1a5276)',
  FOOD:         'linear-gradient(135deg,#c0392b,#7b241c)',
  SHOWS:        'linear-gradient(135deg,#f39c12,#e67e22)',
  COMERCIAL:    'linear-gradient(135deg,#16a085,#0e6655)',
};

const CAT_TINT: Record<string, string> = {
  RELATIONSHIP: '#fce8f1',
  MOVEMENT:     '#e8f8ee',
  CULTURAL:     '#f0e8f8',
  GAMES:        '#fdf0e3',
  CREATIVE:     '#e3eef8',
  FOOD:         '#f8e3e3',
  SHOWS:        '#fdf5e3',
  COMERCIAL:    '#e3f5f3',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 16);
}

const GREEN = '#1a5c2a';
const PALE  = '#dff0d8';

// ── FilterBar (multi-select, horizontal scroll) ───────────────────────────────

function chipStyle(active: boolean, color: string): React.CSSProperties {
  return {
    padding: '0.3rem 0.85rem', borderRadius: 20, border: 'none', cursor: 'pointer',
    fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'inherit',
    background: active ? color : 'rgba(255,255,255,0.4)',
    color: active ? '#fff' : GREEN,
    boxShadow: active ? `0 2px 10px ${color}55` : 'none',
    transition: 'all 0.14s', flexShrink: 0, textTransform: 'uppercase', whiteSpace: 'nowrap',
  };
}

function FilterBar({
  activeFilters, onToggle, modeFilter, onModeToggle,
}: {
  activeFilters: string[]; onToggle: (c: string) => void;
  modeFilter: string; onModeToggle: (m: string) => void;
}) {
  return (
    <div style={{
      display: 'flex', gap: '0.45rem',
      overflowX: 'auto', overflowY: 'visible',
      padding: '4px 1rem 10px',
      scrollbarWidth: 'thin',
      scrollbarColor: `${GREEN}55 transparent`,
      alignItems: 'center',
      WebkitOverflowScrolling: 'touch',
    } as React.CSSProperties}>
      <button onClick={() => onToggle('ALL')} style={chipStyle(activeFilters.length === 0, GREEN)}>ALL</button>
      {CATS.map(c => (
        <button key={c} onClick={() => onToggle(c)} style={chipStyle(activeFilters.includes(c), CAT_COLOR[c])}>
          {c}
        </button>
      ))}
      <span style={{ opacity: 0.25, flexShrink: 0, fontSize: 16, padding: '0 2px' }}>|</span>
      <button onClick={() => onModeToggle('PRESENCIAL')} style={chipStyle(modeFilter === 'PRESENCIAL', '#27ae60')}>
        📍 PRESENCIAL
      </button>
      <button onClick={() => onModeToggle('ONLINE')} style={chipStyle(modeFilter === 'ONLINE', '#2980b9')}>
        💻 ONLINE
      </button>
    </div>
  );
}

// ── EventCard ─────────────────────────────────────────────────────────────────

const statBadge: React.CSSProperties = {
  padding: '0.18rem 0.55rem', borderRadius: 8, fontSize: 11, fontWeight: 700,
  background: 'rgba(26,92,42,0.12)', color: GREEN,
};

function actionBtn(variant: 'outline' | 'attend' | 'leave' | 'disabled'): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '0.4rem 1rem', borderRadius: 20,
    fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
    cursor: variant === 'disabled' ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
  };
  if (variant === 'attend')   return { ...base, border: 'none', background: GREEN, color: '#fff' };
  if (variant === 'leave')    return { ...base, border: '1.5px solid #c0392b', background: 'transparent', color: '#c0392b' };
  if (variant === 'disabled') return { ...base, border: 'none', background: '#ccc', color: '#fff' };
  return { ...base, border: `1.5px solid ${GREEN}`, background: 'transparent', color: GREEN };
}

function EventCard({
  event, attending, currentUserId, onAttend, onUnattend, onEdit,
}: {
  event: EventItem; attending: boolean; currentUserId: string | null;
  onAttend: (id: string) => void; onUnattend: (id: string) => void; onEdit: (ev: EventItem) => void;
}) {
  const isCreator  = currentUserId === event.creatorId;
  const isFull     = event.capacity > 0 && event._count.attendees >= event.capacity;
  const primaryCat = event.categories[0] ?? 'CULTURAL';
  const bannerBg   = event.photo
    ? `url("${event.photo}") ${event.photoX}% ${event.photoY}% / cover no-repeat`
    : CAT_GRADIENT[primaryCat] ?? CAT_GRADIENT.CULTURAL;
  const cardBg     = CAT_TINT[primaryCat] ?? '#f4fdf0';

  const startDay = fmtDate(event.startDate);
  const endDay   = event.endDate ? fmtDate(event.endDate) : null;
  const sameDay  = endDay === startDay;

  return (
    <div style={{
      width: 420, borderRadius: 22, background: cardBg,
      boxShadow: '0 16px 56px rgba(0,0,0,0.18)',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      userSelect: 'none', transformStyle: 'preserve-3d',
    }}>
      {/* Banner */}
      <div style={{ height: 180, position: 'relative', flexShrink: 0, background: bannerBg }}>
        {/* ONLINE/PRESENCIAL badge */}
        <span style={{
          position: 'absolute', top: 10, left: 12,
          padding: '0.2rem 0.6rem', borderRadius: 10, fontSize: 10, fontWeight: 800,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          background: event.mode === 'ONLINE' ? 'rgba(41,128,185,0.92)' : 'rgba(39,174,96,0.92)',
          color: '#fff',
        }}>
          {event.mode === 'ONLINE' ? '💻 ONLINE' : '📍 PRESENCIAL'}
        </span>
        {/* Category chips */}
        <div style={{ position: 'absolute', bottom: 10, left: 12, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {event.categories.map(c => (
            <span key={c} style={{
              padding: '0.2rem 0.55rem', borderRadius: 10, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.08em', background: CAT_COLOR[c] ?? '#555', color: '#fff', textTransform: 'uppercase',
            }}>{c}</span>
          ))}
        </div>
        {event.petFriendly && (
          <span style={{
            position: 'absolute', top: 10, right: 12,
            background: 'rgba(255,255,255,0.88)', borderRadius: 8, padding: '0.15rem 0.45rem', fontSize: 13,
          }}>🐾</span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1a2e0a', lineHeight: 1.2 }}>
          {event.title}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, color: GREEN, fontWeight: 600 }}>
            {startDay} · {fmtTime(event.startDate)}
            {event.endDate && sameDay ? ` — ${fmtTime(event.endDate)}` : ''}
          </span>
          {event.endDate && !sameDay && (
            <span style={{ fontSize: 12, color: '#4a7030', opacity: 0.75 }}>
              → {endDay} · {fmtTime(event.endDate)}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#4a7030', opacity: 0.8, lineHeight: 1.4 }}>{event.address}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
          <span style={{ ...statBadge, background: event.price === 0 ? 'rgba(39,174,96,0.15)' : undefined, color: event.price === 0 ? '#1a7a40' : GREEN }}>
            {event.price === 0 ? 'FREE' : `€${event.price.toFixed(0)}`}
          </span>
          {event.minAge > 0 && <span style={statBadge}>{event.minAge}+</span>}
        </div>
        {/* Capacity */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, letterSpacing: '0.06em' }}>
              {event.capacity === 0 ? 'OPEN EVENT' : `${event._count.attendees} / ${event.capacity} attending`}
            </span>
            {isFull && <span style={{ fontSize: 11, fontWeight: 700, color: '#c0392b' }}>FULL</span>}
          </div>
          {event.capacity > 0 && (
            <div style={{ height: 5, borderRadius: 3, background: 'rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${Math.min(100, (event._count.attendees / event.capacity) * 100)}%`,
                background: isFull ? '#c0392b' : GREEN, transition: 'width 0.3s',
              }} />
            </div>
          )}
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {event.creator.photo
                ? <img src={event.creator.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <svg viewBox="0 0 100 100" width="70%" height="70%"><circle cx="50" cy="36" r="22" fill="#4a6e2a" /><path d="M8 95 Q8 63 50 63 Q92 63 92 95 Z" fill="#4a6e2a" /></svg>
              }
            </div>
            <span style={{ fontSize: 12, color: '#4a7030' }}>{event.creator.nickname}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isCreator && <button onClick={() => onEdit(event)} style={actionBtn('outline')}>EDIT</button>}
            {!isCreator && currentUserId && (
              attending
                ? <button onClick={() => onUnattend(event.id)} style={actionBtn('leave')}>LEAVE</button>
                : <button onClick={() => !isFull && onAttend(event.id)} disabled={isFull} style={actionBtn(isFull ? 'disabled' : 'attend')}>ATTEND</button>
            )}
            {!currentUserId && <span style={{ fontSize: 11, color: '#4a7030', opacity: 0.55 }}>Login to attend</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── RollDeck ──────────────────────────────────────────────────────────────────

function RollDeck({ events, attendingIds, currentUserId, onAttend, onUnattend, onEdit }: {
  events: EventItem[]; attendingIds: Set<string>; currentUserId: string | null;
  onAttend: (id: string) => void; onUnattend: (id: string) => void; onEdit: (ev: EventItem) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const applyTransforms = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const trackRect = track.getBoundingClientRect();
    const center = trackRect.height / 2;
    cardRefs.current.forEach(el => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const elCenter = rect.top - trackRect.top + rect.height / 2;
      const dist = elCenter - center;
      const t = Math.max(-1, Math.min(1, dist / (trackRect.height * 0.55)));
      el.style.transform = `rotateX(${t * 22}deg) scale(${1 - Math.abs(t) * 0.1})`;
      el.style.opacity   = String(Math.max(0.35, 1 - Math.abs(t) * 0.55));
    });
  }, []);

  useEffect(() => { cardRefs.current = cardRefs.current.slice(0, events.length); }, [events.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener('scroll', applyTransforms, { passive: true });
    applyTransforms();
    return () => track.removeEventListener('scroll', applyTransforms);
  }, [applyTransforms]);

  useEffect(() => { applyTransforms(); }, [events, applyTransforms]);

  const TRACK_H = 600, PEEK = 90, SLIDE_H = TRACK_H - PEEK * 2;
  if (events.length === 0) return null;

  return (
    <div style={{ width: 420, height: TRACK_H, perspective: '1000px', overflow: 'hidden', margin: '0 auto' }}>
      <div ref={trackRef} style={{
        height: '100%', overflowY: 'scroll', scrollSnapType: 'y mandatory',
        boxSizing: 'border-box', padding: `${PEEK}px 0`, scrollbarWidth: 'none',
      }}>
        {events.map((ev, i) => (
          <div key={ev.id} style={{ height: SLIDE_H, display: 'flex', alignItems: 'center', justifyContent: 'center', scrollSnapAlign: 'center' }}>
            <div ref={el => { cardRefs.current[i] = el; }} style={{ transformOrigin: 'center center', willChange: 'transform, opacity' }}>
              <EventCard event={ev} attending={attendingIds.has(ev.id)} currentUserId={currentUserId}
                onAttend={onAttend} onUnattend={onUnattend} onEdit={onEdit} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── EventModal ────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: '', description: '', categories: [] as string[],
  startDate: '', endDate: '', address: '', photo: '',
  photoX: 50, photoY: 50, capacity: '', price: '', minAge: '',
  petFriendly: false, mode: 'PRESENCIAL',
};

function EventModal({ initial, onSave, onClose }: {
  initial?: EventItem | null;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    ...(initial ? {
      title: initial.title, description: initial.description,
      categories: [...initial.categories],
      startDate: toLocalInput(initial.startDate), endDate: toLocalInput(initial.endDate),
      address: initial.address, photo: initial.photo ?? '',
      photoX: initial.photoX, photoY: initial.photoY,
      capacity: String(initial.capacity), price: String(initial.price), minAge: String(initial.minAge),
      petFriendly: initial.petFriendly, mode: initial.mode,
    } : {}),
  }));
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  // ── Photo drag-to-reposition ──────────────────────────────────────────────
  const [draggingPhoto, setDraggingPhoto] = useState(false);
  const isDraggingPhoto = useRef(false);
  const hasDraggedPhoto = useRef(false);
  const photoFileRef    = useRef<HTMLInputElement>(null);
  const dragPhotoData   = useRef({ mouseX: 0, mouseY: 0, posX: 50, posY: 50 });
  const [dropTarget, setDropTarget] = useState(false);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isDraggingPhoto.current) return;
      const dx = e.clientX - dragPhotoData.current.mouseX;
      const dy = e.clientY - dragPhotoData.current.mouseY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDraggedPhoto.current = true;
      setForm(f => ({
        ...f,
        photoX: Math.max(0, Math.min(100, dragPhotoData.current.posX + dx / 2)),
        photoY: Math.max(0, Math.min(100, dragPhotoData.current.posY + dy / 2)),
      }));
    }
    function onUp() {
      if (isDraggingPhoto.current && !hasDraggedPhoto.current) {
        photoFileRef.current?.click();
      }
      isDraggingPhoto.current = false;
      setDraggingPhoto(false);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  function handlePhotoMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    isDraggingPhoto.current = true;
    hasDraggedPhoto.current = false;
    setDraggingPhoto(true);
    dragPhotoData.current = { mouseX: e.clientX, mouseY: e.clientY, posX: form.photoX, posY: form.photoY };
  }

  function loadPhotoFile(file: File) {
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, photo: String(ev.target?.result ?? ''), photoX: 50, photoY: 50 }));
    reader.readAsDataURL(file);
  }

  // ── Form helpers ──────────────────────────────────────────────────────────
  function toggleCat(c: string) {
    setForm(f => ({
      ...f,
      categories: f.categories.includes(c) ? f.categories.filter(x => x !== c) : [...f.categories, c],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim())           return setErr('Title is required.');
    if (!form.description.trim())     return setErr('Description is required.');
    if (form.categories.length === 0)  return setErr('Select at least one category.');
    if (!form.startDate)               return setErr('Start date & time is required.');
    if (!form.address.trim())          return setErr('Address is required.');
    setSaving(true); setErr('');
    try {
      await onSave({
        title: form.title.trim(), description: form.description.trim(),
        categories: form.categories, startDate: form.startDate,
        endDate: form.endDate || null, address: form.address.trim(),
        photo: form.photo || null, photoX: form.photoX, photoY: form.photoY,
        capacity: form.capacity !== '' ? Number(form.capacity) : 0,
        price:    form.price    !== '' ? Number(form.price)    : 0,
        minAge:   form.minAge   !== '' ? Number(form.minAge)   : 0,
        petFriendly: form.petFriendly, mode: form.mode,
      });
    } catch {
      setErr('Something went wrong. Try again.');
      setSaving(false);
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.75rem', borderRadius: 10,
    border: 'none', background: 'rgba(255,255,255,0.7)', fontSize: 14, color: '#0a2a40',
    outline: 'none', fontFamily: 'inherit',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase',
    color: '#0a3a5c', opacity: 0.6, marginBottom: 5, display: 'block',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{
        background: '#e6f7ff', borderRadius: 22, padding: '2rem',
        width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', gap: '1.1rem',
      }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0a2a40' }}>
          {initial ? 'EDIT EVENT' : 'CREATE EVENT'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Title */}
          <div><span style={lbl}>Title *</span>
            <input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>

          {/* Description */}
          <div><span style={lbl}>Description *</span>
            <textarea style={{ ...inp, resize: 'vertical', minHeight: 80 }} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          {/* Mode toggle */}
          <div>
            <span style={lbl}>Event mode *</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['PRESENCIAL', 'ONLINE'] as const).map(m => (
                <button key={m} type="button" onClick={() => setForm(f => ({ ...f, mode: m }))} style={{
                  flex: 1, padding: '0.55rem', borderRadius: 12, border: 'none',
                  cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                  background: form.mode === m ? (m === 'ONLINE' ? '#2980b9' : '#27ae60') : 'rgba(0,0,0,0.08)',
                  color: form.mode === m ? '#fff' : '#0a3a5c', transition: 'all 0.12s',
                }}>
                  {m === 'ONLINE' ? '💻 ONLINE' : '📍 PRESENCIAL'}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div>
            <span style={lbl}>Categories * (select all that apply)</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CATS.map(c => {
                const active = form.categories.includes(c);
                return (
                  <button key={c} type="button" onClick={() => toggleCat(c)} style={{
                    padding: '0.3rem 0.75rem', borderRadius: 16, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', fontFamily: 'inherit',
                    textTransform: 'uppercase',
                    background: active ? CAT_COLOR[c] : 'rgba(0,0,0,0.08)',
                    color: active ? '#fff' : '#0a3a5c', transition: 'all 0.12s',
                  }}>{c}</button>
                );
              })}
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div><span style={lbl}>Start date & time *</span>
              <input style={inp} type="datetime-local" value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div><span style={lbl}>End date & time (optional)</span>
              <input style={inp} type="datetime-local" value={form.endDate}
                min={form.startDate || undefined}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>

          {/* Address */}
          <div><span style={lbl}>Address *</span>
            <input style={inp} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>

          {/* Capacity / Price / MinAge */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div><span style={lbl}>Capacity (0 = open)</span>
              <input style={inp} type="number" min={0} value={form.capacity}
                onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
            </div>
            <div><span style={lbl}>Price (€)</span>
              <input style={inp} type="number" min={0} step="0.01" value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            </div>
            <div><span style={lbl}>Min age</span>
              <input style={inp} type="number" min={0} value={form.minAge}
                onChange={e => setForm(f => ({ ...f, minAge: e.target.value }))} />
            </div>
          </div>

          {/* Pet friendly */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.petFriendly}
              onChange={e => setForm(f => ({ ...f, petFriendly: e.target.checked }))} />
            <span style={{ fontSize: 13, color: '#0a3a5c', fontWeight: 600 }}>Pet friendly 🐾</span>
          </label>

          {/* Photo — drop-to-upload + drag-to-reposition */}
          <div>
            <span style={lbl}>
              Banner photo — {form.photo ? 'drag to reposition · click to change' : 'drop file or click to browse'}
            </span>

            {form.photo ? (
              /* Photo loaded — drag to reposition */
              <div onMouseDown={handlePhotoMouseDown} style={{
                width: '100%', height: 150, borderRadius: 12,
                background: `url("${form.photo}") ${form.photoX}% ${form.photoY}% / cover no-repeat`,
                cursor: draggingPhoto ? 'grabbing' : 'grab',
                border: '2px solid rgba(10,58,92,0.2)', position: 'relative',
              }}>
                <span style={{
                  position: 'absolute', bottom: 6, right: 8, fontSize: 10, fontWeight: 700,
                  color: '#fff', background: 'rgba(0,0,0,0.4)', borderRadius: 6,
                  padding: '2px 7px', letterSpacing: '0.06em', pointerEvents: 'none',
                }}>DRAG TO REPOSITION</span>
              </div>
            ) : (
              /* No photo — droppable upload zone */
              <div
                onDragOver={e => { e.preventDefault(); setDropTarget(true); }}
                onDragLeave={() => setDropTarget(false)}
                onDrop={e => {
                  e.preventDefault(); setDropTarget(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file?.type.startsWith('image/')) loadPhotoFile(file);
                }}
                onClick={() => photoFileRef.current?.click()}
                style={{
                  width: '100%', height: 110, borderRadius: 12,
                  border: `2px dashed ${dropTarget ? '#2980b9' : 'rgba(10,58,92,0.25)'}`,
                  background: dropTarget ? 'rgba(41,128,185,0.08)' : 'rgba(255,255,255,0.4)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', gap: 6, transition: 'all 0.15s',
                  fontSize: 13, color: '#0a3a5c', opacity: 0.7, textAlign: 'center',
                  position: 'relative',
                  top: '10%',
                }}
              >
                <span style={{ fontSize: 28 }}>🖼️</span>
                <span>Drop an image here, or click to browse</span>
              </div>
            )}

            <input ref={photoFileRef} type="file" accept="image/*"
              onChange={e => { const f = e.target.files?.[0]; if (f) loadPhotoFile(f); }}
              style={{ display: 'none' }} />

            {form.photo && (
              <button type="button"
                onClick={() => setForm(f => ({ ...f, photo: '', photoX: 50, photoY: 50 }))}
                style={{ marginTop: 6, fontSize: 11, color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Remove photo
              </button>
            )}
          </div>

          {err && <p style={{ margin: 0, fontSize: 12, color: '#c0392b', fontWeight: 600 }}>{err}</p>}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="submit" disabled={saving} style={{
              padding: '0.6rem 1.5rem', borderRadius: 20, border: 'none',
              background: '#0a5c8a', color: '#fff',
              fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}>{saving ? 'SAVING…' : initial ? 'SAVE CHANGES' : 'CREATE EVENT'}</button>
            <button type="button" onClick={onClose} style={{
              padding: '0.6rem 1.2rem', borderRadius: 20,
              border: '1.5px solid rgba(0,0,0,0.2)', background: 'transparent',
              fontSize: 13, fontWeight: 700, color: '#0a3a5c',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>CANCEL</button>
          </div>

        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EventsPage() {
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string } | null)?.id ?? null;

  const [events,        setEvents]        = useState<EventItem[]>([]);
  const [attendingIds,  setAttendingIds]  = useState<Set<string>>(new Set());
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [modeFilter,    setModeFilter]    = useState('');
  const [loading,       setLoading]       = useState(true);
  const [modal,         setModal]         = useState<'create' | EventItem | null>(null);

  const loadAll = useCallback(async () => {
    const [evRes, atRes] = await Promise.all([
      fetch('/api/events'),
      fetch('/api/events/attending'),
    ]);
    if (evRes.ok) setEvents(await evRes.json());
    if (atRes.ok) setAttendingIds(new Set(await atRes.json()));
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Refresh data when the user returns to this tab
  useEffect(() => {
    function onVisible() { if (!document.hidden) loadAll(); }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadAll]);

  // Multi-select filter toggle — ALL clears all; clicking a category toggles it
  function toggleFilter(cat: string) {
    if (cat === 'ALL') { setActiveFilters([]); return; }
    setActiveFilters(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }

  // Mode filter — clicking again deselects
  function toggleMode(m: string) {
    setModeFilter(prev => prev === m ? '' : m);
  }

  async function handleAttend(eventId: string) {
    if (!currentUserId) return;
    setAttendingIds(prev => new Set([...prev, eventId]));
    setEvents(prev => prev.map(e => e.id === eventId
      ? { ...e, _count: { attendees: e._count.attendees + 1 } } : e));
    const res = await fetch(`/api/events/${eventId}/attend`, { method: 'POST' });
    if (!res.ok) {
      setAttendingIds(prev => { const n = new Set(prev); n.delete(eventId); return n; });
      setEvents(prev => prev.map(e => e.id === eventId
        ? { ...e, _count: { attendees: e._count.attendees - 1 } } : e));
    }
  }

  async function handleUnattend(eventId: string) {
    if (!currentUserId) return;
    setAttendingIds(prev => { const n = new Set(prev); n.delete(eventId); return n; });
    setEvents(prev => prev.map(e => e.id === eventId
      ? { ...e, _count: { attendees: Math.max(0, e._count.attendees - 1) } } : e));
    const res = await fetch(`/api/events/${eventId}/attend`, { method: 'DELETE' });
    if (!res.ok) {
      setAttendingIds(prev => new Set([...prev, eventId]));
      setEvents(prev => prev.map(e => e.id === eventId
        ? { ...e, _count: { attendees: e._count.attendees + 1 } } : e));
    }
  }

  async function handleSave(data: Record<string, unknown>) {
    const isEdit = modal && typeof modal !== 'string';
    const res = await fetch(
      isEdit ? `/api/events/${(modal as EventItem).id}` : '/api/events',
      { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
    );
    if (!res.ok) throw new Error('save failed');
    setModal(null);
    await loadAll();
  }

  async function handleSeed() {
    await fetch('/api/events/seed', { method: 'POST' });
    await loadAll();
  }

  // Empty activeFilters = show all categories; modeFilter = '' shows all modes
  const filtered = events
    .filter(e => activeFilters.length === 0 || e.categories.some(c => activeFilters.includes(c)))
    .filter(e => modeFilter === '' || e.mode === modeFilter);

  return (
    <div style={{ minHeight: '100vh', background: PALE, padding: '100px 1rem 3rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      <div style={{
        width: '100%',
        maxWidth: 640,
        background: 'rgba(255,255,255,0.45)',
        border: '1px solid rgba(26,92,42,0.15)',
        borderRadius: 24,
        padding: '1.2rem 1rem 1.4rem',
        boxShadow: '0 12px 34px rgba(0,0,0,0.12)',
        backdropFilter: 'blur(2px)',
      }}>

      {/* Header */}
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={H1_STYLE}>EVENTS</h1>
          {(activeFilters.length > 0 || modeFilter) && (
            <span style={{ fontSize: 11, color: '#4a7030', opacity: 0.7 }}>
              {[
                activeFilters.length > 0 && `${activeFilters.length} categor${activeFilters.length > 1 ? 'ies' : 'y'}`,
                modeFilter && modeFilter,
              ].filter(Boolean).join(' · ')} · {filtered.length} shown
            </span>
          )}
        </div>
        {currentUserId && (
          <button onClick={() => setModal('create')} style={{
            width: 40, height: 40, borderRadius: '50%', border: 'none',
            background: GREEN, color: '#fff', fontSize: 24, lineHeight: '1', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}>+</button>
        )}
      </div>

      {/* Filter bar */}
      <div style={{ width: '100%', maxWidth: 560, marginBottom: '1.5rem' }}>
        <FilterBar activeFilters={activeFilters} onToggle={toggleFilter}
          modeFilter={modeFilter} onModeToggle={toggleMode} />
      </div>

      {loading && <p style={{ color: '#4a7030', fontStyle: 'italic' }}>Loading events…</p>}

      {!loading && events.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 2rem', background: 'rgba(255,255,255,0.35)', borderRadius: 18, maxWidth: 420 }}>
          <p style={{ color: '#4a7030', margin: '0 0 1rem', fontSize: 15 }}>No events yet.</p>
          {currentUserId && (
            <button onClick={handleSeed} style={{
              padding: '0.5rem 1.2rem', borderRadius: 20, border: 'none',
              background: GREEN, color: '#dff0d8',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>SEED SAMPLE EVENTS</button>
          )}
        </div>
      )}

      {!loading && events.length > 0 && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 2rem', background: 'rgba(255,255,255,0.35)', borderRadius: 18 }}>
          <p style={{ color: '#4a7030', margin: 0, fontSize: 15 }}>
            No events match the selected {activeFilters.length > 1 ? 'filters' : 'filter'}.
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <>
          <RollDeck events={filtered} attendingIds={attendingIds} currentUserId={currentUserId}
            onAttend={handleAttend} onUnattend={handleUnattend} onEdit={ev => setModal(ev)} />
          {filtered.length > 1 && (
            <p style={{ fontSize: 11, color: '#4a7030', opacity: 0.6, marginTop: '0.75rem', textAlign: 'center' }}>
              Scroll to browse · {filtered.length} event{filtered.length > 1 ? 's' : ''}
            </p>
          )}
        </>
      )}

      </div>

      {modal !== null && (
        <EventModal initial={modal === 'create' ? null : modal}
          onSave={handleSave} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
