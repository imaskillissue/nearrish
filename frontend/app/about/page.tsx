'use client';

import { H1_STYLE } from '../lib/typography';

export default function AboutPage() {
  const sectionTitle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: '#3a1a5c',
    opacity: 0.45,
    marginBottom: '0.65rem',
  };

  const body: React.CSSProperties = {
    fontSize: 15,
    color: '#1a0a2e',
    lineHeight: 1.75,
    margin: 0,
  };

  const tag: React.CSSProperties = {
    display: 'inline-block',
    padding: '0.3rem 0.8rem',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: 700,
    color: '#3a1a5c',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    border: '1.5px solid rgba(58,26,92,0.18)',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f2ecf8',
      padding: '80px 2.5rem 4rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>

      {/* Page title — outside the card, left-aligned */}
      <div style={{ width: '100%', maxWidth: 900, marginBottom: '1.5rem' }}>
        <h1 style={H1_STYLE}>
          ABOUT
        </h1>
      </div>

      {/* Main card */}
      <div style={{
        width: '100%',
        maxWidth: 900,
        background: '#e8d7f4',
        borderRadius: 28,
        boxShadow: '0 12px 48px rgba(80,30,120,0.13)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* ── Top hero: logo + tagline ───────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '3rem 3.5rem 2rem',
          gap: '2rem',
        }}>
          {/* Logo */}
          <img
            src="/1.svg"
            alt="NEAR logo"
            style={{ height: 110, width: 'auto', flexShrink: 0 }}
          />

          {/* Tagline */}
          <p style={{
            margin: 0,
            fontSize: 22,
            color: '#0d0d0d',
            lineHeight: 1.5,
            fontWeight: 400,
            textAlign: 'center',
            maxWidth: 420,
          }}>
            Find people around you who share your interests.
          </p>
        </div>

        {/* ── Divider ────────────────────────────────────────────── */}
        <div style={{ height: 1, background: 'rgba(58,26,92,0.12)', margin: '0 3.5rem' }} />

        {/* ── Content sections ───────────────────────────────────── */}
        <div style={{
          padding: '2.5rem 3.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '2.2rem',
        }}>

          {/* What is NEAR */}
          <div>
            <p style={sectionTitle}>What is NEAR?</p>
            <p style={body}>
              NEAR is a social discovery platform built to help people connect around shared interests —
              whether it's a sport, a hobby, a cuisine, or a genre of shows. Instead of feeding you an
              endless scroll of content, NEAR puts real people front and centre so you can find the
              ones who are geographically and personally close to you.
            </p>
          </div>

          {/* How it works */}
          <div>
            <p style={sectionTitle}>How it works</p>
            <ol style={{ ...body, paddingLeft: '1.3rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <li>Create your profile and choose the interests that define you.</li>
              <li>Browse people nearby who share at least one of your interests.</li>
              <li>Send a connection request and start planning something together.</li>
              <li>Attend events, build your circle, and grow your NEAR score.</li>
            </ol>
          </div>

          {/* Interest categories */}
          <div>
            <p style={sectionTitle}>Interest categories</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {['Relationship', 'Movement', 'Cultural', 'Games', 'Creative', 'Food', 'Shows', 'Commercial'].map(i => (
                <span key={i} style={tag}>{i}</span>
              ))}
            </div>
          </div>

          {/* Team */}
          <div>
            <p style={sectionTitle}>Team</p>
            <p style={body}>
              NEAR is being built as a collaborative project. The team is small, the ambitions are large,
              and the coffee consumption is unsustainable.
            </p>
          </div>

        </div>

        {/* ── Footer bar: contact + location ─────────────────────── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          padding: '1.8rem 3.5rem 2.2rem',
          borderTop: '1px solid rgba(58,26,92,0.12)',
        }}>
          {/* Contact */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#1a0a2e', fontWeight: 500 }}>support@near.com</span>
            <span style={{ fontSize: 13, color: '#1a0a2e', fontWeight: 500 }}>+49 176 5555 2222</span>
          </div>

          {/* Location + year */}
          <span style={{ fontSize: 13, color: '#1a0a2e', fontWeight: 500 }}>
            Germany — 2026
          </span>
        </div>

      </div>
    </div>
  );
}
