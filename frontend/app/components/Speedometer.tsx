'use client';

import { DS } from '../lib/tokens';

interface SpeedometerProps {
  score: number; // 0–100
}

export default function Speedometer({ score }: SpeedometerProps) {
  const c  = Math.max(0, Math.min(100, score));
  const cx = 100, cy = 100, r = 76;

  // Polar helper — standard SVG coordinate formula
  function polar(deg: number) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  // The gauge arc sweeps CLOCKWISE (sweep-flag=1) from the left endpoint (180°)
  // through the TOP of the circle (270°) to the right endpoint (360°=0°).
  //   score=0   → angle 180° → left  (cx−r, cy)
  //   score=50  → angle 270° → top   (cx, cy−r)
  //   score=100 → angle 360° → right (cx+r, cy)
  const arcStart = polar(180);   // always (24, 100)
  const arcEnd   = polar(0);     // always (176, 100)

  const fillAngleDeg = 180 + (c / 100) * 180;
  const fillPt       = polar(fillAngleDeg);

  // Background track (full 180°, clockwise through top)
  const bgPath   = `M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 0 1 ${arcEnd.x} ${arcEnd.y}`;
  // Filled arc (left → needle position, clockwise, always ≤ 180° so large-arc=0)
  const fillPath = c === 0
    ? ''
    : `M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 0 1 ${fillPt.x} ${fillPt.y}`;

  // Needle — same angle as fillAngleDeg
  const nLen = 62;
  const nRad = (fillAngleDeg * Math.PI) / 180;
  const nx   = cx + nLen * Math.cos(nRad);
  const ny   = cy + nLen * Math.sin(nRad);

  // Interpolated colour: green → yellow → red
  function arcColor(s: number): string {
    if (s <= 50) {
      const t  = s / 50;
      const rr = Math.round(45  + 205 * t);
      const g  = Math.round(138 + 61  * t);
      return `rgb(${rr},${g},26)`;
    }
    const t  = (s - 50) / 50;
    const g  = Math.round(199 - 199 * t);
    return `rgb(192,${g},43)`;
  }

  const fillColor  = arcColor(c);
  const scoreColor = c <= 33 ? '#2d8a1a' : c <= 66 ? '#c8a000' : '#c0392b';

  return (
    <svg width={200} height={130} viewBox="0 0 200 130"
      style={{ display: 'block' }} aria-label={`Toxicity score: ${c}`}>

      <defs>
        {/* Left-to-right gradient matches the clockwise arc direction */}
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#2d8a1a"/>
          <stop offset="50%"  stopColor="#e6c700"/>
          <stop offset="100%" stopColor="#c0392b"/>
        </linearGradient>
      </defs>

      {/* Track shadow */}
      <path d={bgPath} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={16} strokeLinecap="round"/>
      {/* Track gradient (decorative) */}
      <path d={bgPath} fill="none" stroke="url(#gaugeGrad)" strokeWidth={16} strokeLinecap="round" opacity={0.22}/>

      {/* Filled arc */}
      {c > 0 && (
        <path d={fillPath} fill="none" stroke={fillColor} strokeWidth={16} strokeLinecap="round"/>
      )}

      {/* Needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny}
        stroke={DS.tertiary} strokeWidth={3} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={6} fill={DS.tertiary}/>
      <circle cx={cx} cy={cy} r={3} fill={DS.primary}/>

      {/* Score label */}
      <text x={cx} y={cy + 24} textAnchor="middle"
        fontSize={17} fontWeight={800} fill={scoreColor} fontFamily="inherit">{c}</text>

      {/* 0 / 100 endpoint labels */}
      <text x={arcStart.x - 6} y={arcStart.y + 14} textAnchor="middle"
        fontSize={9} fill={DS.tertiary} opacity={0.45} fontFamily="inherit">0</text>
      <text x={arcEnd.x + 6} y={arcEnd.y + 14} textAnchor="middle"
        fontSize={9} fill={DS.tertiary} opacity={0.45} fontFamily="inherit">100</text>
    </svg>
  );
}
