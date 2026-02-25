'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import styles from './ProfileDropdown.module.css';

interface Props {
  user: { id: string; email?: string | null; name?: string | null };
  onClose: () => void;
}

export default function ProfileDropdown({ user, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [onClose]);

  function handleMouseLeave() {
    closeTimer.current = setTimeout(() => onClose(), 250);
  }

  function handleMouseEnter() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  return (
    <div ref={ref} className={styles.dropdown}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
    >
      <div className={styles.header}>
        <span className={styles.loggedInAs}>LOGGED IN AS</span>
        <span className={styles.email}>{user.email ?? user.name ?? 'User'}</span>
      </div>
      <div className={styles.divider} />
      <Link href={`/profile/${user.id}`} className={styles.item} onClick={onClose}>
        PROFILE
      </Link>
      <Link href="/settings" className={styles.item} onClick={onClose}>
        SETTINGS
      </Link>
       <Link href="/messages" className={styles.item} onClick={onClose}>
        MESSAGES
      </Link>
      <Link href="/friends" className={styles.item} onClick={onClose}>
        FRIENDS
      </Link>
      <div className={styles.divider} />
      <button
        className={`${styles.item} ${styles.logout}`}
        onClick={() => signOut({ callbackUrl: '/' })}
      >
        LOGOUT
      </button>
    </div>
  );
}
