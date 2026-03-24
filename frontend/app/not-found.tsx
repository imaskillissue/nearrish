"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "calc(100vh - 64px - 80px)",
        background: "var(--ds-bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "6rem 1.5rem 4rem",
        textAlign: "center",
      }}
    >
      {/* MISSING poster graphic */}
      <div style={{ position: "relative", marginBottom: "3rem" }}>
        {/* Main poster box */}
        <div
          style={{
            width: 256,
            height: 256,
            background: "#ffffff",
            border: "var(--ds-border)",
            boxShadow: "var(--ds-shadow)",
            display: "flex",
            flexDirection: "column",
            padding: "1rem",
          }}
        >
          <div
            style={{
              borderBottom: "var(--ds-border)",
              paddingBottom: "0.5rem",
              marginBottom: "0.75rem",
            }}
          >
            <span
              style={{
                fontWeight: 900,
                fontSize: "1.25rem",
                letterSpacing: "var(--type-tracking-widest)",
                textTransform: "uppercase",
                fontStyle: "italic",
                color: "var(--ds-tertiary)",
              }}
            >
              MISSING
            </span>
          </div>

          {/* Person icon */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg
              width="120"
              height="120"
              viewBox="0 0 24 24"
              fill="var(--ds-tertiary)"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* person_search: person with magnifying glass */}
              <path d="M10 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z" />
              <path d="M10 14c-2.67 0-8 1.34-8 4v2h9.5c-.31-.63-.5-1.29-.5-2 0-.93.26-1.79.68-2.54C11.05 14.08 10.52 14 10 14z" />
              <path d="M19.83 18.42l1.77 1.77-1.06 1.06-1.77-1.77c-.43.27-.93.42-1.47.42C15.48 20 14 18.52 14 16.7c0-1.82 1.48-3.3 3.3-3.3 1.82 0 3.3 1.48 3.3 3.3 0 .54-.15 1.04-.42 1.47zM17.3 14.9c-.99 0-1.8.81-1.8 1.8 0 .99.81 1.8 1.8 1.8.99 0 1.8-.81 1.8-1.8 0-.99-.81-1.8-1.8-1.8z" />
            </svg>
          </div>
        </div>

        {/* Decorative offset square */}
        <div
          style={{
            position: "absolute",
            bottom: "-1rem",
            left: "-2rem",
            width: 80,
            height: 80,
            border: "var(--ds-border)",
            background: "var(--ds-bg)",
            zIndex: -1,
            transform: "rotate(-6deg)",
          }}
        />
      </div>

      {/* Headline */}
      <div style={{ maxWidth: 480, marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontWeight: 900,
            fontSize: "clamp(2rem, 8vw, 3.5rem)",
            lineHeight: "var(--type-leading-none)",
            letterSpacing: "var(--type-tracking-tight)",
            textTransform: "uppercase",
            color: "var(--ds-tertiary)",
            marginBottom: "1.25rem",
          }}
        >
          404 — LOST
        </h1>

        <p
          style={{
            fontSize: "var(--type-md)",
            color: "#5c5b59",
            lineHeight: "var(--type-leading-relaxed)",
            fontWeight: 500,
          }}
        >
          Oops! This page seems to have wandered off. Let's get you back to where the action is.
        </p>
      </div>

      {/* CTA button */}
      <button
        onClick={() => router.push("/")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.6rem",
          padding: "1rem 2.5rem",
          background: "var(--ds-primary)",
          border: "var(--ds-border)",
          boxShadow: "var(--ds-shadow-sm)",
          fontWeight: 900,
          fontSize: "var(--type-lg)",
          textTransform: "uppercase",
          letterSpacing: "var(--type-tracking-tight)",
          color: "var(--ds-tertiary)",
          cursor: "pointer",
          transition: "transform var(--ds-transition), box-shadow var(--ds-transition)",
          marginBottom: "3rem",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = "translate(-2px, -2px)";
          e.currentTarget.style.boxShadow = "var(--ds-shadow)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = "translate(0, 0)";
          e.currentTarget.style.boxShadow = "var(--ds-shadow-sm)";
        }}
        onMouseDown={e => {
          e.currentTarget.style.transform = "translate(2px, 2px)";
          e.currentTarget.style.boxShadow = "none";
        }}
        onMouseUp={e => {
          e.currentTarget.style.transform = "translate(-2px, -2px)";
          e.currentTarget.style.boxShadow = "var(--ds-shadow)";
        }}
      >
        <ArrowLeftIcon />
        BACK TO FEED
      </button>

      {/* Helper links */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          width: "100%",
          maxWidth: 480,
        }}
      >
        <Link
          href="/explore"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            padding: "1.25rem",
            background: "#f3f0ed",
            border: "var(--ds-border-sm)",
            textDecoration: "none",
            color: "var(--ds-tertiary)",
            transition: "background var(--ds-transition)",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--ds-primary)")}
          onMouseLeave={e => (e.currentTarget.style.background = "#f3f0ed")}
        >
          <ExploreIcon />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 700, fontSize: "var(--type-xs)", textTransform: "uppercase", letterSpacing: "var(--type-tracking-wide)" }}>
              Explore Map
            </div>
            <div style={{ fontSize: "var(--type-xs)", opacity: 0.6, marginTop: 2 }}>Find events near you</div>
          </div>
        </Link>

        <Link
          href="/about"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            padding: "1.25rem",
            background: "#f3f0ed",
            border: "var(--ds-border-sm)",
            textDecoration: "none",
            color: "var(--ds-tertiary)",
            transition: "background var(--ds-transition)",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#fce047")}
          onMouseLeave={e => (e.currentTarget.style.background = "#f3f0ed")}
        >
          <HelpIcon />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 700, fontSize: "var(--type-xs)", textTransform: "uppercase", letterSpacing: "var(--type-tracking-wide)" }}>
              Get Help
            </div>
            <div style={{ fontSize: "var(--type-xs)", opacity: 0.6, marginTop: 2 }}>Learn more about Near</div>
          </div>
        </Link>
      </div>
    </main>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function ExploreIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
