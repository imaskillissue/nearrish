'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
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
        <Link href="/friends" className={`${styles.navItem} ${pathname === '/friends' ? styles.navItemActive : ''}`}>
          <FriendsIcon />
          <span className={styles.label}>Friends</span>
        </Link>
        {isLoggedIn && (
          <Link href="/messages" className={`${styles.navItem} ${pathname === '/messages' ? styles.navItemActive : ''}`}>
            <MessagesIcon />
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
