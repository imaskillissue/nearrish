import React from 'react';

const GREEN = '#1a5c2a';
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
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export type EventCardProps = {
  event: any;
  currentUserId?: string | null;
  attending?: boolean;
  onAttend?: (id: string) => void;
  onUnattend?: (id: string) => void;
  onEdit?: (ev: any) => void;
};

export default function EventCard({ event, attending, currentUserId, onAttend, onUnattend, onEdit }: EventCardProps) {
  const priceValue = Number(event.price ?? 0);
  const capacityValue = Number(event.capacity ?? 0);
  const attendeesCount = Number(event._count?.attendees ?? 0);
  const isCreator  = currentUserId === event.creatorId;
  const isFull     = capacityValue > 0 && attendeesCount >= capacityValue;
  const primaryCat = event.categories?.[0] ?? 'CULTURAL';
  const bannerBg   = event.photo
    ? `url("${event.photo}") ${event.photoX ?? 50}% ${event.photoY ?? 50}% / cover no-repeat`
    : CAT_GRADIENT[primaryCat] ?? CAT_GRADIENT.CULTURAL;
  const cardBg     = CAT_TINT[primaryCat] ?? '#f4fdf0';
  const startDay = event.startDate ? fmtDate(event.startDate) : '';
  const endDay   = event.endDate ? fmtDate(event.endDate) : null;
  const sameDay  = endDay === startDay;
  const canInteract = Boolean(onAttend && onUnattend);

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
          {event.categories?.map?.((c: string) => (
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
            {startDay} · {event.startDate ? fmtTime(event.startDate) : ''}
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
          <span style={{ ...statBadge, background: priceValue === 0 ? 'rgba(39,174,96,0.15)' : undefined, color: priceValue === 0 ? '#1a7a40' : GREEN }}>
            {priceValue === 0 ? 'FREE' : `€${priceValue.toFixed(0)}`}
          </span>
          {event.minAge > 0 && <span style={statBadge}>{event.minAge}+</span>}
        </div>
        {/* Capacity */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, letterSpacing: '0.06em' }}>
              {capacityValue === 0 ? `OPEN EVENT · ${attendeesCount} attending` : `${attendeesCount} / ${capacityValue} attending`}
            </span>
            {isFull && <span style={{ fontSize: 11, fontWeight: 700, color: '#c0392b' }}>FULL</span>}
          </div>
          {capacityValue > 0 && (
            <div style={{ height: 5, borderRadius: 3, background: 'rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${Math.min(100, (attendeesCount / capacityValue) * 100)}%`,
                background: isFull ? '#c0392b' : GREEN, transition: 'width 0.3s',
              }} />
            </div>
          )}
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {event.creator?.photo
                ? <img src={event.creator.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <svg viewBox="0 0 100 100" width="70%" height="70%"><circle cx="50" cy="36" r="22" fill="#4a6e2a" /><path d="M8 95 Q8 63 50 63 Q92 63 92 95 Z" fill="#4a6e2a" /></svg>
              }
            </div>
            <span style={{ fontSize: 12, color: '#4a7030' }}>{event.creator?.nickname}</span>
          </div>
          {canInteract && (
            <div style={{ display: 'flex', gap: 8 }}>
              {isCreator && onEdit && <button onClick={() => onEdit(event)} style={actionBtn('outline')}>EDIT</button>}
              {!isCreator && currentUserId && (
                attending
                  ? <button onClick={() => onUnattend?.(event.id)} style={actionBtn('leave')}>LEAVE</button>
                  : <button onClick={() => !isFull && onAttend?.(event.id)} disabled={isFull} style={actionBtn(isFull ? 'disabled' : 'attend')}>ATTEND</button>
              )}
              {!currentUserId && <span style={{ fontSize: 11, color: '#4a7030', opacity: 0.55 }}>Login to attend</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}