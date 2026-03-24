'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { useWs } from '../lib/ws-context';
import { apiFetch } from '../lib/api';
import styles from './BottomNav.module.css';

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  );
}

function ExploreIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function FriendsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MessagesIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const { user, status, logout } = useAuth();
  const isLoggedIn = status === 'authenticated';
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const { subscribe } = useWs();

  // Initialize unread count from conversations (single endpoint returns DMs + groups)
  useEffect(() => {
    if (!isLoggedIn) { setUnreadMsgs(0); return; }
    apiFetch<{ unreadCount?: number }[]>('/api/chat/conversations')
      .then(convs => setUnreadMsgs(convs.reduce((s, c) => s + (c.unreadCount || 0), 0)))
      .catch(() => {});
  }, [isLoggedIn]);

  // Track which conversation the user is actively reading
  const activeConvIdRef = useRef<string>('');
  useEffect(() => {
    const onConvActive = (e: Event) => {
      activeConvIdRef.current = (e as CustomEvent<string>).detail ?? '';
    };
    window.addEventListener('conv:active', onConvActive);
    return () => window.removeEventListener('conv:active', onConvActive);
  }, []);

  // Track new messages via WS — skip badge if user is already reading that conversation
  useEffect(() => {
    const unsub = subscribe('chat', (payload) => {
      const msgId = (payload as { messageId?: string }).messageId ?? '';
      if (msgId.startsWith('READ:') || msgId.startsWith('REMOVED:')) return;
      // New message — payload format: "convId:msgId"
      const colonIdx = msgId.indexOf(':');
      const incomingConvId = colonIdx > 0 ? msgId.substring(0, colonIdx) : null;
      if (incomingConvId && incomingConvId === activeConvIdRef.current) return;
      setUnreadMsgs(prev => prev + 1);
    });
    return unsub;
  }, [subscribe]);

  useEffect(() => {
    const onRead = () => {
      apiFetch<{ unreadCount?: number }[]>('/api/chat/conversations')
        .then(convs => setUnreadMsgs(convs.reduce((s, c) => s + (c.unreadCount || 0), 0)))
        .catch(() => setUnreadMsgs(0));
    };
    window.addEventListener('messagesRead', onRead);
    return () => window.removeEventListener('messagesRead', onRead);
  }, []);

  const close = () => setMenuOpen(false);

  return (
    <>
      {menuOpen && <div className={styles.backdrop} onClick={close} />}

      {menuOpen && <div className={styles.menuSheet}>
        <button className={styles.sheetItem} onClick={() => { close(); window.dispatchEvent(new CustomEvent('openSearch')); }}>Search</button>
        {isLoggedIn && user ? (
          <>
            <Link href={`/profile/${user.id}`} className={styles.sheetItem} onClick={close}>Profile</Link>
            <Link href="/settings" className={styles.sheetItem} onClick={close}>Settings</Link>
            {user.isAdmin && (
              <Link href="/admin" className={styles.sheetItem} onClick={close}>Admin</Link>
            )}
            <button className={`${styles.sheetItem} ${styles.sheetItemLogout}`} onClick={() => { close(); logout(); }}>
              Log out
            </button>
          </>
        ) : (
          <>
            <div className={styles.sheetDivider} />
            <button className={`${styles.sheetItem} ${styles.sheetItemJoin}`} onClick={() => { close(); window.dispatchEvent(new CustomEvent('openLogin')); }}>
              Join Now
            </button>
          </>
        )}
      </div>}

      <nav className={styles.bottomNav}>
        <Link href="/" className={`${styles.navItem} ${pathname === '/' ? styles.navItemActive : ''}`}>
          <HomeIcon />
          <span className={styles.label}>Near</span>
        </Link>
        <Link href="/explore" className={`${styles.navItem} ${pathname === '/explore' ? styles.navItemActive : ''}`}>
          <ExploreIcon />
          <span className={styles.label}>Explore</span>
        </Link>
        {isLoggedIn ? (
          <Link href="/friends" className={`${styles.navItem} ${pathname === '/friends' ? styles.navItemActive : ''}`}>
            <FriendsIcon />
            <span className={styles.label}>Friends</span>
          </Link>
        ) : (
          <button
            className={styles.navItem}
            onClick={() => window.dispatchEvent(new CustomEvent('openLogin'))}
          >
            <LoginIcon />
            <span className={styles.label}>Login</span>
          </button>
        )}
        {isLoggedIn && (
          <Link href="/messages" className={`${styles.navItem} ${pathname === '/messages' ? styles.navItemActive : ''}`} style={{ position: 'relative' }}>
            <MessagesIcon />
            {unreadMsgs > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                minWidth: 14, height: 14, borderRadius: 7,
                background: '#c0392b', color: '#fff',
                fontSize: 8, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px', lineHeight: 1,
              }}>{unreadMsgs > 99 ? '99+' : unreadMsgs}</span>
            )}
            <span className={styles.label}>Messages</span>
          </Link>
        )}
        <button
          className={`${styles.navItem} ${menuOpen ? styles.navItemActive : ''}`}
          onClick={() => setMenuOpen(o => !o)}
        >
          <MenuIcon />
          <span className={styles.label}>Menu</span>
        </button>
      </nav>
    </>
  );
}
