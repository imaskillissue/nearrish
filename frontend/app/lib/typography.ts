import type { CSSProperties } from 'react';

/**
 * Typography scale — single source of truth for all text sizing.
 *
 * Mirror values in globals.css :root → var(--type-*) for use in CSS modules.
 * Use TYPE.* / TEXT.* in TSX inline-style objects.
 * Use var(--type-*) in .module.css files.
 *
 * To update a value, change it here AND in globals.css :root.
 */

// ── Primitive scale ──────────────────────────────────────────────────────────

export const TYPE = {
  size: {
    '2xs':   '0.625rem',   // 10px — micro labels, eyebrow text
    xs:      '0.75rem',    // 12px — timestamps, badges, button text
    sm:      '0.875rem',   // 14px — body text, inputs
    md:      '1rem',       // 16px — comfortable body
    lg:      '1.25rem',    // 20px — subheadings, field values
    xl:      '1.5rem',     // 24px — section headings
    '2xl':   '2rem',       // 32px — page headings (H1)
    '3xl':   '2.5rem',     // 40px — large page titles
    '4xl':   'clamp(2.5rem, 5vw, 4.5rem)',  // responsive hero headings
    display: 'clamp(3.5rem, 10vw, 8rem)',   // display / watermark
  },
  weight: {
    regular: 400,
    medium:  500,
    bold:    700,
    black:   900,
  },
  tracking: {
    tightest: '-0.05em',
    tight:    '-0.04em',
    snug:     '-0.02em',
    normal:   '0em',
    wide:     '0.1em',
    wider:    '0.15em',
    widest:   '0.18em',
    super:    '0.3em',
  },
  leading: {
    none:    1,
    tight:   1.2,
    snug:    1.35,
    normal:  1.5,
    relaxed: 1.65,
    loose:   1.75,
  },
} as const;

// ── Composed text styles ─────────────────────────────────────────────────────
// Spread into style props: <h1 style={{ ...TEXT.h1, color: DS.tertiary }}>
// Color is always passed separately — TEXT encodes role and rhythm only.

export const TEXT: Record<string, CSSProperties> = {
  /** Largest display text — watermarks, oversized hero numbers */
  display: {
    fontSize:      TYPE.size.display,
    fontWeight:    TYPE.weight.black,
    letterSpacing: TYPE.tracking.tightest,
    lineHeight:    TYPE.leading.none,
    textTransform: 'uppercase',
  },
  /** Primary page heading */
  h1: {
    fontSize:      TYPE.size['2xl'],
    fontWeight:    TYPE.weight.black,
    letterSpacing: TYPE.tracking.tight,
    lineHeight:    TYPE.leading.tight,
    textTransform: 'uppercase',
  },
  /** Section / feature heading */
  h2: {
    fontSize:      TYPE.size.xl,
    fontWeight:    TYPE.weight.black,
    letterSpacing: TYPE.tracking.snug,
    lineHeight:    TYPE.leading.snug,
    textTransform: 'uppercase',
  },
  /** Card / subsection heading */
  h3: {
    fontSize:      TYPE.size.lg,
    fontWeight:    TYPE.weight.black,
    letterSpacing: TYPE.tracking.snug,
    lineHeight:    TYPE.leading.snug,
    textTransform: 'uppercase',
  },
  /** Small ALL-CAPS eyebrow / section label */
  label: {
    fontSize:      TYPE.size['2xs'],
    fontWeight:    TYPE.weight.bold,
    letterSpacing: TYPE.tracking.widest,
    textTransform: 'uppercase',
  },
  /** Medium ALL-CAPS label */
  labelLg: {
    fontSize:      TYPE.size.xs,
    fontWeight:    TYPE.weight.bold,
    letterSpacing: TYPE.tracking.wider,
    textTransform: 'uppercase',
  },
  /** Button / CTA text */
  btn: {
    fontSize:      TYPE.size.xs,
    fontWeight:    TYPE.weight.bold,
    letterSpacing: TYPE.tracking.wide,
    textTransform: 'uppercase',
  },
  /** Standard body text */
  body: {
    fontSize:   TYPE.size.sm,
    fontWeight: TYPE.weight.regular,
    lineHeight: TYPE.leading.relaxed,
  },
  /** Comfortable body text */
  bodyMd: {
    fontSize:   TYPE.size.md,
    fontWeight: TYPE.weight.regular,
    lineHeight: TYPE.leading.relaxed,
  },
  /** Timestamps, secondary meta */
  caption: {
    fontSize:   TYPE.size.xs,
    fontWeight: TYPE.weight.bold,
    lineHeight: TYPE.leading.normal,
  },
  /** Smallest informational text */
  micro: {
    fontSize:      TYPE.size['2xs'],
    fontWeight:    TYPE.weight.bold,
    letterSpacing: TYPE.tracking.normal,
  },
};

// ── Legacy exports (kept for backward compat) ────────────────────────────────

/** H1 page heading — equivalent to TEXT.h1 with default body color */
export const H1_STYLE: CSSProperties = {
  margin: 0,
  ...TEXT.h1,
  color: '#1A1A1A',
};
