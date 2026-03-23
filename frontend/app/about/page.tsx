'use client';

import { H1_STYLE, TYPE } from '../lib/typography';
import { DS, SECTION_LABEL_STYLE } from '../lib/tokens';

export default function AboutPage() {
  const body: React.CSSProperties = {
    fontSize: TYPE.size.sm,
    color: DS.tertiary,
    lineHeight: TYPE.leading.loose,
    margin: 0,
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: DS.bg,
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
        background: '#fff',
        border: `3px solid ${DS.tertiary}`,
        boxShadow: DS.shadow,
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
            fontSize: TYPE.size.lg,
            color: DS.tertiary,
            lineHeight: TYPE.leading.normal,
            fontWeight: TYPE.weight.regular,
            textAlign: 'center',
            maxWidth: 420,
          }}>
            Share what's happening around you. Connect with your community.
          </p>
        </div>

        {/* ── Divider ────────────────────────────────────────────── */}
        <div style={{ height: 1, background: 'rgba(26,26,26,0.12)', margin: '0 3.5rem' }} />

        {/* ── Content sections ───────────────────────────────────── */}
        <div style={{
          padding: '2.5rem 3.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '2.2rem',
        }}>

          {/* What is NEAR */}
          <div>
            <p style={{ ...SECTION_LABEL_STYLE, opacity: 0.45 }}>What is NEAR?</p>
            <p style={body}>
              NEAR is a location-based social platform where you can share what's happening around you
              and discover posts from your neighborhood. Think of it as a community board for real life —
              post a photo, drop a pin, and connect with the people nearby.
            </p>
          </div>

          {/* How it works */}
          <div>
            <p style={{ ...SECTION_LABEL_STYLE, opacity: 0.45 }}>How it works</p>
            <ol style={{ ...body, paddingLeft: '1.3rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <li>Create your profile and upload a photo.</li>
              <li>Post what's happening around you — add a photo or drop your location.</li>
              <li>Explore the map to discover posts from people nearby.</li>
              <li>Connect with others, chat, and build your local community.</li>
            </ol>
          </div>

          {/* Team */}
          <div>
            <p style={{ ...SECTION_LABEL_STYLE, opacity: 0.45 }}>Team</p>
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
          borderTop: '1px solid rgba(26,26,26,0.12)',
        }}>
          {/* Contact */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: TYPE.size.sm, color: DS.tertiary, fontWeight: TYPE.weight.medium }}>support@near.com</span>
            <span style={{ fontSize: TYPE.size.sm, color: DS.tertiary, fontWeight: TYPE.weight.medium }}>+49 176 5555 2222</span>
          </div>

          {/* Location + year */}
          <span style={{ fontSize: TYPE.size.sm, color: DS.tertiary, fontWeight: TYPE.weight.medium }}>
            Germany — 2026
          </span>
        </div>

      </div>
    </div>
  );
}
