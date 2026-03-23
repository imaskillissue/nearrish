'use client';

import { H1_STYLE } from '../lib/typography';
import Link from 'next/link';

export default function TermsPage() {
  const sectionTitle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: '#3a1a5c',
    opacity: 0.45,
    margin: '2rem 0 0.65rem',
  };

  const body: React.CSSProperties = {
    fontSize: 15,
    color: '#1a0a2e',
    lineHeight: 1.75,
    margin: '0 0 0.75rem',
  };

  const li: React.CSSProperties = {
    fontSize: 15,
    color: '#1a0a2e',
    lineHeight: 1.75,
    marginBottom: '0.4rem',
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
      <div style={{ width: '100%', maxWidth: 860, marginBottom: '1.5rem' }}>
        <h1 style={H1_STYLE}>TERMS OF SERVICE</h1>
        <p style={{ fontSize: 13, color: '#3a1a5c', opacity: 0.5, margin: '0.4rem 0 0' }}>
          Last updated: March 2026
        </p>
      </div>

      <div style={{
        width: '100%',
        maxWidth: 860,
        background: '#e8d7f4',
        borderRadius: 28,
        boxShadow: '0 12px 48px rgba(80,30,120,0.13)',
        padding: '2.5rem 3.5rem 3rem',
        display: 'flex',
        flexDirection: 'column',
      }}>

        <p style={body}>
          Welcome to NEAR. By creating an account or using any part of this platform, you agree to
          be bound by these Terms of Service. Please read them carefully. If you do not agree, do not
          use NEAR.
        </p>

        {/* 1 */}
        <p style={sectionTitle}>1. Eligibility</p>
        <p style={body}>
          You must be at least 13 years old to use NEAR. By registering, you confirm that you meet
          this requirement. Accounts created on behalf of someone else without their consent are prohibited.
        </p>

        {/* 2 */}
        <p style={sectionTitle}>2. Your Account</p>
        <p style={body}>
          You are responsible for maintaining the security of your account credentials. Do not share
          your password with others. Notify us immediately if you suspect unauthorised access to your
          account. NEAR is not liable for any loss resulting from compromised credentials.
        </p>
        <p style={body}>
          You may have only one active account. Creating duplicate or fake accounts is prohibited.
        </p>

        {/* 3 */}
        <p style={sectionTitle}>3. Acceptable Use</p>
        <p style={body}>You agree not to use NEAR to:</p>
        <ul style={{ paddingLeft: '1.5rem', margin: 0 }}>
          <li style={li}>Post, share, or transmit content that is illegal, harmful, threatening, abusive, harassing, defamatory, or obscene.</li>
          <li style={li}>Impersonate any person or entity, or misrepresent your identity or affiliation.</li>
          <li style={li}>Spam other users with unsolicited messages or bulk communications.</li>
          <li style={li}>Attempt to gain unauthorised access to any part of the platform or another user's account.</li>
          <li style={li}>Use automated scripts, bots, or scrapers to interact with the platform without prior written permission.</li>
          <li style={li}>Upload malicious code, viruses, or any content intended to disrupt or damage the platform.</li>
          <li style={li}>Use the platform to coordinate illegal activities of any kind.</li>
        </ul>

        {/* 4 */}
        <p style={sectionTitle}>4. User Content</p>
        <p style={body}>
          You retain ownership of the content you post on NEAR (posts, comments, images, messages).
          By posting content, you grant NEAR a non-exclusive, royalty-free licence to store and
          display that content to other users as part of operating the service.
        </p>
        <p style={body}>
          You are solely responsible for the content you publish. NEAR does not endorse any
          user-generated content. We reserve the right to remove content that violates these Terms
          or our community standards, with or without prior notice.
        </p>

        {/* 5 */}
        <p style={sectionTitle}>5. Content Moderation</p>
        <p style={body}>
          NEAR uses automated AI tools and human administrators to review potentially harmful content.
          Content may be flagged, hidden, or permanently removed if it violates these Terms. Repeated
          violations may result in account suspension or deletion. We aim to apply moderation fairly,
          but we do not guarantee review of every dispute.
        </p>

        {/* 6 */}
        <p style={sectionTitle}>6. Location Data</p>
        <p style={body}>
          Sharing your geographic location with posts is entirely optional. When you choose to share
          coordinates, they become part of your public post and may be visible to other users on the
          Explore map. Never attach location data to a post if you are not comfortable with others
          knowing that location.
        </p>

        {/* 7 */}
        <p style={sectionTitle}>7. Intellectual Property</p>
        <p style={body}>
          The NEAR name, logo, and platform code are protected by copyright. You may not copy,
          modify, distribute, or reverse-engineer any part of the platform without written permission.
        </p>

        {/* 8 */}
        <p style={sectionTitle}>8. Termination</p>
        <p style={body}>
          We reserve the right to suspend or permanently delete any account at our discretion,
          particularly in cases of serious or repeated Terms violations. You may stop using NEAR
          at any time; contact an administrator to request full account deletion.
        </p>

        {/* 9 */}
        <p style={sectionTitle}>9. Disclaimer of Warranties</p>
        <p style={body}>
          NEAR is provided "as is" without warranties of any kind, express or implied. We do not
          guarantee that the platform will be available at all times, error-free, or that content
          posted by other users will be accurate or appropriate. Use the platform at your own
          discretion.
        </p>

        {/* 10 */}
        <p style={sectionTitle}>10. Limitation of Liability</p>
        <p style={body}>
          To the fullest extent permitted by applicable law, NEAR and its contributors shall not
          be liable for any indirect, incidental, or consequential damages arising from your use of,
          or inability to use, the platform.
        </p>

        {/* 11 */}
        <p style={sectionTitle}>11. Changes to These Terms</p>
        <p style={body}>
          We may update these Terms of Service at any time. The "Last updated" date at the top of
          this page reflects the most recent revision. Continued use of the platform after changes
          are posted constitutes your acceptance of the revised Terms.
        </p>

        {/* 12 */}
        <p style={sectionTitle}>12. Contact</p>
        <p style={{ ...body, margin: 0 }}>
          If you have questions about these Terms, please reach us through the{' '}
          <Link href="/about" style={{ color: '#5a2a9c', textDecoration: 'underline' }}>About</Link> page.
        </p>
      </div>
    </div>
  );
}
