import Link from "next/link";
import { DS } from "../lib/tokens";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.grid}>
        <div>
          <div style={{ color: DS.primary, fontWeight: 900, fontSize: "1.75rem", fontStyle: "italic", letterSpacing: "-0.04em", textTransform: "uppercase", marginBottom: "1rem" }}>
            NEARRISH
          </div>
          <p style={{ color: "rgba(232,226,217,0.4)", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", maxWidth: 280, lineHeight: 1.7 }}>
            A location-aware social platform for sharing real moments and building local community.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem", alignSelf: "flex-end" }}>
          {[
            { label: "About", href: "/about" },
            { label: "Terms", href: "/terms" },
            { label: "Privacy", href: "/privacy" },
          ].map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              style={{
                color: "rgba(232,226,217,0.7)",
                fontWeight: 700,
                fontSize: "0.75rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className={styles.copyright}>
          <div style={{ color: "rgba(232,226,217,0.4)", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.15em", lineHeight: 1.7 }}>
            &copy; {new Date().getFullYear()} NEAR
          </div>
        </div>
      </div>
    </footer>
  );
}
