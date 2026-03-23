'use client';

import { H1_STYLE } from '../lib/typography';
import Link from 'next/link';

export default function PrivacyPage() {
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
        <h1 style={H1_STYLE}>PRIVACY POLICY</h1>
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
          This Privacy Policy explains what information we collect, how we use it, and the choices you have regarding your data.
          By using NEAR, you agree to the practices described here.
        </p>

        {/* 1 */}
        <p style={sectionTitle}>1. Information We Collect</p>
        <p style={body}>
          <strong>Account information:</strong> When you register, we collect your username, display name,
          nickname, email address, and password (stored as a salted hash — never in plain text).
          You may optionally provide a profile photo and a general location (city/area).
        </p>
        <p style={body}>
          <strong>Content you post:</strong> Text posts, comments, images, and the optional geographic
          coordinates you attach to posts. Coordinates are only stored when you explicitly share them.
        </p>
        <p style={body}>
          <strong>Messages:</strong> Direct messages and group chat messages between users. These are stored
          in our database to provide conversation history and are accessible only to the participants of
          each conversation.
        </p>
        <p style={body}>
          <strong>Usage data:</strong> We record the timestamp of your last activity ("last online") for the
          online-status indicator visible to other users.
        </p>

        {/* 2 */}
        <p style={sectionTitle}>2. How We Use Your Information</p>
        <ul style={{ paddingLeft: '1.5rem', margin: 0 }}>
          <li style={li}>To provide, operate, and improve the NEAR platform.</li>
          <li style={li}>To authenticate your identity and maintain session security.</li>
          <li style={li}>To display your public profile to other users.</li>
          <li style={li}>To deliver messages and notifications to the correct recipients.</li>
          <li style={li}>To show location-tagged posts on the Explore map (only when you choose to attach coordinates).</li>
          <li style={li}>To moderate content and maintain a safe community environment using automated AI-assisted tools.</li>
          <li style={li}>To generate anonymised platform statistics visible to administrators.</li>
        </ul>
        <p style={{ ...body, marginTop: '0.75rem' }}>
          We do not sell, rent, or share your personal information with third parties for marketing purposes.
        </p>

        {/* 3 */}
        <p style={sectionTitle}>3. Content Moderation</p>
        <p style={body}>
          NEAR uses an automated AI moderation system to review posts, comments, usernames, and chat
          messages for harmful content. Flagged content may be hidden, blocked, or escalated for
          administrative review. The system assigns severity scores but does not make permanent decisions
          about your account without human review.
        </p>

        {/* 4 */}
        <p style={sectionTitle}>4. Data Sharing</p>
        <p style={body}>
          Your public profile (username, display name, avatar) and public posts are visible to all
          users of the platform, including unauthenticated visitors. Friends-only posts are visible
          exclusively to users you have accepted as friends. Direct messages and group chat messages
          are private and visible only to conversation participants.
        </p>

        {/* 5 */}
        <p style={sectionTitle}>5. Data Retention</p>
        <p style={body}>
          Your data is retained for as long as your account is active. When an account is deleted by
          an administrator, all associated posts, comments, messages, and profile data are permanently
          removed from our systems.
        </p>

        {/* 6 */}
        <p style={sectionTitle}>6. Security</p>
        <p style={body}>
          All communication between your browser and NEAR is encrypted via HTTPS/TLS. Passwords are
          stored using industry-standard SCrypt hashing with automatic salting. Authentication tokens (JWTs)
          expire after 7 days. We take reasonable technical measures to protect your data, but no system is
          completely immune to security risks.
        </p>

        {/* 7 */}
        <p style={sectionTitle}>7. Your Rights</p>
        <ul style={{ paddingLeft: '1.5rem', margin: 0 }}>
          <li style={li}>You may update your profile information at any time from your profile page.</li>
          <li style={li}>You may delete your own posts and comments at any time.</li>
          <li style={li}>You may block other users to prevent them from messaging you.</li>
          <li style={li}>You may contact an administrator to request full account deletion.</li>
        </ul>

        {/* 8 */}
        <p style={sectionTitle}>8. Cookies and Local Storage</p>
        <p style={body}>
          NEAR does not use tracking cookies. Authentication state is maintained through a JWT token
          stored in your browser's local storage. This token is used solely for authentication purposes.
        </p>

        {/* 9 */}
        <p style={sectionTitle}>9. Changes to This Policy</p>
        <p style={body}>
          We may update this Privacy Policy from time to time. The "Last updated" date at the top of
          this page reflects the most recent revision. Continued use of the platform after changes
          constitutes acceptance of the updated policy.
        </p>

        {/* 10 */}
        <p style={sectionTitle}>10. Contact</p>
        <p style={{ ...body, margin: 0 }}>
          If you have questions about this Privacy Policy, you can reach the NEAR team through the{' '}
          <Link href="/about" style={{ color: '#5a2a9c', textDecoration: 'underline' }}>About</Link> page.
        </p>
      </div>
    </div>
  );
}
