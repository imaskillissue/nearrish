'use client';

import { H1_STYLE, TYPE } from '../lib/typography';
import { DS, SECTION_LABEL_STYLE } from '../lib/tokens';

export default function PrivacyPage() {
  const body: React.CSSProperties = {
    fontSize: TYPE.size.sm,
    color: DS.tertiary,
    lineHeight: TYPE.leading.loose,
    margin: '0 0 1rem 0',
  };

  const subSectionTitle: React.CSSProperties = {
    fontSize: TYPE.size.sm,
    fontWeight: 600,
    color: DS.tertiary,
    marginTop: '1.2rem',
    marginBottom: '0.5rem',
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
          PRIVACY POLICY
        </h1>
        <p style={{ opacity: 0.6, fontSize: TYPE.size.xs, marginTop: '0.5rem' }}>Last updated March 09, 2026</p>
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
        padding: '2.5rem 3.5rem',
      }}>

        <p style={body}>
          This Privacy Notice for Near (&apos;we&apos;, &apos;us&apos;, or &apos;our&apos;) describes how and why we might access, collect, store, use, and/or share (&apos;process&apos;) your personal information when you use our services (&apos;Services&apos;).
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>SUMMARY OF KEY POINTS</h3>
        <p style={body}>
          This summary provides key points from our Privacy Notice. We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>1. WHAT INFORMATION DO WE COLLECT?</h3>
        <p style={subSectionTitle}>Personal information you disclose to us</p>
        <p style={body}>
          We collect personal information that you voluntarily provide to us when you register on the Services, express an interest in obtaining information about us or our products and Services, or otherwise when you contact us.
        </p>
        <p style={subSectionTitle}>Information automatically collected</p>
        <p style={body}>
          Some information — such as your Internet Protocol (IP) address and/or browser and device characteristics — is collected automatically when you visit our Services.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>2. HOW DO WE PROCESS YOUR INFORMATION?</h3>
        <p style={body}>
          We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>3. WHAT LEGAL BASES DO WE RELY ON?</h3>
        <p style={body}>
          We only process your personal information when we believe it is necessary and we have a valid legal reason (i.e. legal basis) to do so under applicable law, like with your consent, to comply with laws, or to fulfil our contractual obligations.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>4. WHEN AND WITH WHOM DO WE SHARE YOUR INFORMATION?</h3>
        <p style={body}>
          We may share information in specific situations, such as during business transfers or when using Google Maps Platform APIs to provide location-based services.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>5. COOKIES AND TRACKING TECHNOLOGIES</h3>
        <p style={body}>
          We may use cookies and similar tracking technologies (like web beacons and pixels) to gather information when you interact with our Services.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>6. AI-BASED PRODUCTS</h3>
        <p style={body}>
          As part of our Services, we offer products, features, or tools powered by artificial intelligence, machine learning, or similar technologies for text analysis.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>7. DATA RETENTION</h3>
        <p style={body}>
          We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, typically no longer than six (6) months past the termination of your account.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>8. DATA SECURITY</h3>
        <p style={body}>
          We have implemented appropriate and reasonable technical and organisational security measures designed to protect the security of any personal information we process.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>9. YOUR PRIVACY RIGHTS</h3>
        <p style={body}>
          Depending on your region (like the EEA, UK, Switzerland, and Canada), you have certain rights under applicable data protection laws, including the right to request access and obtain a copy of your personal information.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>10. DO-NOT-TRACK FEATURES</h3>
        <p style={body}>
          We currently do not respond to DNT browser signals, but we recognize and honor Global Privacy Control (GPC) signals for opting out of the sale or sharing of personal information.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>11. UNITED STATES RESIDENTS</h3>
        <p style={body}>
          Residents of certain US states have specific rights regarding their personal information, including the right to know, access, correct, and delete their data.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>12. OTHER REGIONS</h3>
        <p style={body}>
          Additional rights may apply based on your country of residence, such as Australia, New Zealand, or the Republic of South Africa.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>13. UPDATES TO THIS NOTICE</h3>
        <p style={body}>We may update this Privacy Notice from time to time to stay compliant with relevant laws.</p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>14. CONTACT US</h3>
        <div style={{ ...body, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>Near</span>
          <span>Data Protection Officer</span>
          <span>Porschestr. 2</span>
          <span>Wolfsburg, Lower Saxony 38440</span>
          <span>Germany</span>
          <span>Email: DPO@near.com</span>
          <span>Phone: +49 177 123 456 78</span>
        </div>

      </div>
    </div>
  );
}
