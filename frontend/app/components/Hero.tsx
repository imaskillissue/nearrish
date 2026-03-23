import Link from "next/link";
import styles from "./Hero.module.css";
import { DS } from "../lib/tokens";
import { TYPE } from "../lib/typography";

// ── Design System → see app/lib/tokens.ts and globals.css :root ─────────────
const C = {
  primary:   DS.primary,
  secondary: DS.secondary,
  tertiary:  DS.tertiary,
  earthTan:  DS.earth,
  bg:        DS.bg,
};

export default function Hero() {
  return (
    <div style={{ background: C.bg, color: C.tertiary, fontFamily: "Inter, system-ui, sans-serif", overflowX: "hidden" }}>

      {/* ── Hero Section ──────────────────────────────────────────── */}
      <section style={{ position: "relative", padding: "5rem 2rem 10rem", maxWidth: 1280, margin: "0 auto" }}>

        {/* Background watermark */}
        <div style={{
          position: "absolute", top: -80, right: -80,
          pointerEvents: "none", userSelect: "none",
          fontWeight: 900, fontSize: "25vw", lineHeight: 1,
          color: C.secondary, opacity: 0.07, letterSpacing: "-0.05em",
        }}>
          LOCAL
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "1rem", alignItems: "flex-start", position: "relative" }}>

          {/* Left: text */}
          <div style={{ gridColumn: "span 7", position: "relative", zIndex: 3 }}>
            <div style={{
              display: "inline-block", background: C.secondary, color: C.earthTan,
              padding: "0.25rem 1rem", fontWeight: TYPE.weight.black, fontSize: TYPE.size['2xs'],
              textTransform: "uppercase", letterSpacing: TYPE.tracking.super, marginBottom: "2rem",
            }}>
              Location-Aware Social — v1.0
            </div>

            <h1 style={{
              fontWeight: TYPE.weight.black, fontSize: TYPE.size.display, lineHeight: TYPE.leading.none,
              letterSpacing: TYPE.tracking.tight, textTransform: "uppercase", color: C.tertiary,
              marginBottom: "3rem",
            }}>
              SHARE<br />LOCAL.<br />
              <span className={styles.textStroke}>CONNECT REAL.</span>
            </h1>

            <div style={{ maxWidth: 480, background: "rgba(244,241,238,0.4)", padding: "0.5rem" }}>
              <p style={{ fontSize: TYPE.size.lg, fontWeight: TYPE.weight.bold, lineHeight: TYPE.leading.snug, color: C.secondary, marginBottom: "2rem" }}>
                A platform for discovering what&apos;s happening around you — post a moment, drop your location, and connect with the people nearby.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
                <Link href="/explore" className={styles.heroCtaBtn}>
                  Explore Near You
                </Link>
                <Link href="/about" className={styles.heroSecondaryBtn}>
                  About Us
                </Link>
              </div>
            </div>
          </div>

          {/* Right: image card */}
          <div style={{ gridColumn: "span 5", position: "relative", marginTop: "4rem", zIndex: 2 }}>
            <div className={`${styles.brutalistBorder} ${styles.brutalistShadow}`} style={{
              position: "relative", width: "100%", aspectRatio: "3/4",
              overflow: "hidden", background: C.secondary, transform: "rotate(2deg)",
            }}>
              <img
                src="/2.jpg"
                alt="Community in action"
                style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1)", mixBlendMode: "luminosity", opacity: 0.8 }}
              />
            </div>
          </div>

        </div>
      </section>

      {/* ── Dark "Real Connections" Section ───────────────────────── */}
      <section className={styles.canvasOverlap} style={{ position: "relative", zIndex: 4, padding: "0 1rem" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className={`${styles.brutalistBorder} ${styles.brutalistShadowPrimary}`} style={{
            background: C.secondary, color: C.earthTan,
            padding: "4rem 3rem", position: "relative", overflow: "hidden",
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "4rem", position: "relative", zIndex: 1 }}>
              <div>
                <h2 style={{
                  fontWeight: TYPE.weight.black, fontSize: TYPE.size['4xl'],
                  letterSpacing: TYPE.tracking.tight, textTransform: "uppercase",
                  marginBottom: "2rem", lineHeight: 1,
                }}>
                  REAL<br /><span style={{ color: C.primary }}>CONNECTIONS.</span>
                </h2>
                <p style={{ fontSize: TYPE.size.md, opacity: 0.8, lineHeight: TYPE.leading.loose, marginBottom: "2rem" }}>
                  We&apos;ve replaced the algorithm&apos;s noise with proximity and intention. Your feed is shaped by where you are, not by what advertisers want you to see. Here, your neighborhood is the network.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", color: C.primary }}>
                  <span style={{ fontSize: TYPE.size['2xs'], fontWeight: TYPE.weight.black, textTransform: "uppercase", letterSpacing: TYPE.tracking.widest }}>
                    Decentralized · Local · Human
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ borderLeft: `4px solid ${C.primary}`, paddingLeft: "2rem" }}>
                  <p style={{ fontSize: TYPE.size.lg, fontStyle: "italic", fontWeight: TYPE.weight.medium, marginBottom: "1rem", lineHeight: TYPE.leading.normal }}>
                    &quot;It feels organized without feeling corporate.&quot;
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: "50%", overflow: "hidden",
                      border: `2px solid ${C.primary}`, background: C.tertiary,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ color: C.primary, fontWeight: TYPE.weight.black, fontSize: TYPE.size.md }}>A</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: TYPE.weight.black, textTransform: "uppercase", fontSize: TYPE.size.xs }}>A. K.</div>
                      <div style={{ fontSize: TYPE.size['2xs'], textTransform: "uppercase", letterSpacing: TYPE.tracking.wider, color: C.primary, opacity: 0.7 }}>
                        Community Member
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              position: "absolute", top: 0, right: 0,
              width: "50%", height: "100%",
              background: "linear-gradient(to left, rgba(255,255,255,0.03), transparent)",
              pointerEvents: "none",
            }} />
          </div>
        </div>
      </section>

      {/* ── Features Section ──────────────────────────────────────── */}
      <section style={{ padding: "8rem 2rem", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "6rem" }}>
          <h2 style={{ fontWeight: TYPE.weight.black, fontSize: TYPE.size.xl, textTransform: "uppercase", letterSpacing: TYPE.tracking.widest, marginBottom: "1rem", color: C.secondary }}>
            How It Works
          </h2>
          <div style={{ width: 96, height: 4, background: C.primary, margin: "0 auto" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "3rem" }}>

          {/* Card 1 — white bg */}
          <div className={styles.featureCard}>
            <div style={{
              width: 48, height: 48, background: C.tertiary, color: C.primary,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "2rem", fontWeight: TYPE.weight.black, fontSize: TYPE.size.lg,
            }}>01</div>
            <h3 style={{ fontWeight: TYPE.weight.black, fontSize: TYPE.size.lg, textTransform: "uppercase", marginBottom: "1rem", color: C.secondary }}>
              Post Your Moment
            </h3>
            <p style={{ color: `${C.tertiary}99`, marginBottom: "1.5rem", lineHeight: 1.6 }}>
              Share what&apos;s happening around you — add a photo, drop your location, and let your neighborhood know.
            </p>
            <Link href="/explore" style={{ color: C.secondary, fontWeight: TYPE.weight.black, fontSize: TYPE.size['2xs'], textTransform: "uppercase", textDecoration: "none" }}>
              START SHARING →
            </Link>
          </div>

          {/* Card 2 — secondary (forest) bg, offset */}
          <div className={styles.featureCardSecondary} style={{ marginTop: "3rem" }}>
            <div style={{
              width: 48, height: 48, background: C.primary, color: C.tertiary,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "2rem", fontWeight: TYPE.weight.black, fontSize: TYPE.size.lg,
            }}>02</div>
            <h3 style={{ fontWeight: TYPE.weight.black, fontSize: TYPE.size.lg, textTransform: "uppercase", marginBottom: "1rem", color: C.earthTan }}>
              Explore the Map
            </h3>
            <p style={{ color: `${C.earthTan}cc`, marginBottom: "1.5rem", lineHeight: 1.6 }}>
              Browse an interactive map of posts from people nearby. Discover what&apos;s happening in your city in real time.
            </p>
            <Link href="/explore" style={{ color: C.primary, fontWeight: TYPE.weight.black, fontSize: TYPE.size['2xs'], textTransform: "uppercase", textDecoration: "none" }}>
              OPEN MAP →
            </Link>
          </div>

          {/* Card 3 — white bg */}
          <div className={styles.featureCard}>
            <div style={{
              width: 48, height: 48, background: C.tertiary, color: C.primary,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "2rem", fontWeight: TYPE.weight.black, fontSize: TYPE.size.lg,
            }}>03</div>
            <h3 style={{ fontWeight: TYPE.weight.black, fontSize: TYPE.size.lg, textTransform: "uppercase", marginBottom: "1rem", color: C.secondary }}>
              Connect &amp; Chat
            </h3>
            <p style={{ color: `${C.tertiary}99`, marginBottom: "1.5rem", lineHeight: 1.6 }}>
              Follow people nearby, send friend requests, and start conversations — your data stays yours, always.
            </p>
            <Link href="/friends" style={{ color: C.secondary, fontWeight: TYPE.weight.black, fontSize: TYPE.size['2xs'], textTransform: "uppercase", textDecoration: "none" }}>
              FIND FRIENDS →
            </Link>
          </div>

        </div>
      </section>

      {/* ── CTA / Join Section (secondary bg) ─────────────────────── */}
      <section style={{ background: C.secondary, padding: "6rem 2rem", overflow: "hidden", position: "relative" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <h2 style={{
            fontWeight: 900, fontSize: "clamp(2.5rem, 8vw, 6rem)",
            color: C.earthTan, textTransform: "uppercase", letterSpacing: "-0.04em",
            marginBottom: "3rem", lineHeight: 0.9,
          }}>
            JOIN THE<br /><span style={{ color: C.primary, fontStyle: "italic" }}>COMMUNITY.</span>
          </h2>

          <div style={{ display: "flex", border: `3px solid rgba(232,226,217,0.2)` }}>
            <input
              className={styles.emailInput}
              type="email"
              placeholder="YOU@EXAMPLE.COM"
              style={{ borderRight: "2px solid rgba(232,226,217,0.2)" }}
            />
            <button className={styles.syncBtn}>
              GET STARTED
            </button>
          </div>

          <p style={{ marginTop: "2rem", color: `${C.earthTan}55`, fontWeight: TYPE.weight.black, textTransform: "uppercase", fontSize: TYPE.size['2xs'], letterSpacing: TYPE.tracking.super }}>
            BUILT IN GERMANY — MADE FOR YOUR NEIGHBORHOOD
          </p>
        </div>

        <div style={{
          position: "absolute", bottom: -80, left: -80,
          width: 320, height: 320,
          border: `20px solid ${C.primary}18`,
          borderRadius: "50%", pointerEvents: "none",
        }} />
      </section>

    </div>
  );
}
