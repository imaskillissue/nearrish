/**
 * Design tokens — single source of truth for the Nearrish design system.
 *
 * These mirror the CSS custom properties in globals.css (:root).
 * Use `DS` in TSX inline-style objects; use `var(--ds-*)` in CSS/module files.
 *
 * To change the visual identity, edit the values here AND in globals.css :root.
 */

// ── Colors ──────────────────────────────────────────────────────────────────
export const DS = {
  primary:   '#A3E635',   // lime green  — CTAs, highlights
  secondary: '#1B2F23',   // deep forest — dark sections, cards
  tertiary:  '#1A1A1A',   // near-black  — text, borders
  earth:     '#E8E2D9',   // earth tan   — text on dark surfaces
  bg:        '#F4F1EE',   // warm off-white — page background

  // ── Semantic aliases ──────────────────────────────────────────────────────
  text:        '#1A1A1A',   // default body text
  textMuted:   'rgba(26, 26, 26, 0.55)',
  textOnDark:  '#E8E2D9',   // text on secondary/dark backgrounds
  border:      '#1A1A1A',
  borderMuted: 'rgba(26, 26, 26, 0.1)',

  // ── Shadows ───────────────────────────────────────────────────────────────
  shadow:       '8px 8px 0px 0px #1B2F23',
  shadowSm:     '4px 4px 0px 0px #1B2F23',
  shadowAccent: '8px 8px 0px 0px #A3E635',
  shadowBtn:    '4px 4px 0px 0px #1A1A1A',
} as const;

// ── Reusable inline-style fragments ─────────────────────────────────────────
// These are partial CSSProperties objects you can spread into style props.

import type { CSSProperties } from 'react';
import { TYPE } from './typography';

/** Full-page wrapper */
export const PAGE_STYLE: CSSProperties = {
  minHeight: '100vh',
  background: DS.bg,
  padding: '88px 2rem 4rem',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
};

/** Primary content card */
export const CARD_STYLE: CSSProperties = {
  background: '#fff',
  border: `3px solid ${DS.tertiary}`,
  boxShadow: DS.shadow,
  padding: '2.5rem',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '2rem',
};

/** Inner panel (sits inside a card) */
export const PANEL_STYLE: CSSProperties = {
  background: 'rgba(26, 26, 26, 0.04)',
  border: `2px solid ${DS.borderMuted}`,
  padding: '1.1rem 1.3rem',
};

/** Small uppercase section label */
export const SECTION_LABEL_STYLE: CSSProperties = {
  fontSize: TYPE.size['2xs'],
  fontWeight: TYPE.weight.bold,
  letterSpacing: TYPE.tracking.widest,
  textTransform: 'uppercase',
  color: DS.tertiary,
  opacity: 0.5,
  marginBottom: '0.65rem',
};

/** Form input */
export const INPUT_STYLE: CSSProperties = {
  width: '100%',
  padding: '0.55rem 0.9rem',
  border: `2px solid ${DS.tertiary}`,
  borderRadius: 0,
  outline: 'none',
  background: DS.bg,
  fontSize: TYPE.size.sm,
  color: DS.tertiary,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

/** Primary button (dark forest) */
export const BTN_PRIMARY_STYLE: CSSProperties = {
  padding: '0.5rem 1.2rem',
  border: `2px solid ${DS.tertiary}`,
  borderRadius: 0,
  cursor: 'pointer',
  background: DS.secondary,
  color: DS.primary,
  fontSize: TYPE.size.xs,
  fontWeight: TYPE.weight.bold,
  letterSpacing: TYPE.tracking.wide,
  textTransform: 'uppercase',
  fontFamily: 'inherit',
};

/** Accent button (lime green) */
export const BTN_ACCENT_STYLE: CSSProperties = {
  ...BTN_PRIMARY_STYLE,
  background: DS.primary,
  color: DS.tertiary,
};

/** Ghost / outline button */
export const BTN_GHOST_STYLE: CSSProperties = {
  ...BTN_PRIMARY_STYLE,
  background: 'transparent',
  color: DS.tertiary,
};

/** Stat display box */
export const STAT_BOX_STYLE: CSSProperties = {
  minWidth: 52,
  height: 44,
  background: 'rgba(26, 26, 26, 0.05)',
  border: '2px solid rgba(26, 26, 26, 0.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: TYPE.size.md,
  fontWeight: TYPE.weight.bold,
  color: DS.secondary,
  padding: '0 0.8rem',
};
