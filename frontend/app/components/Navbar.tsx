/**
 * Navbar — persistent top navigation bar, rendered on every page via app/layout.tsx.
 *
 * Behaviour:
 *  - Logo → home (/)
 *  - Search icon → opens GlobalSearchModal
 *  - Events / Friends / Messages → direct page links
 *  - Profile icon:
 *      · Logged OUT → opens ProfileModal (Login / Register)
 *      · Logged IN  → opens ProfileDropdown (Profile, About, Settings, Logout)
 *        and shows the user's own avatar instead of the default SVG icon.
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../lib/auth-context";
import { useWs } from "../lib/ws-context";
import { apiFetch, API_BASE } from "../lib/api";
import styles from "./Navbar.module.css";
import Link from "next/link";
import GlobalSearchModal from "./GlobalSearchModal";
import ProfileModal from "./ProfileModal";
import ProfileDropdown from "./ProfileDropdown";

export default function Navbar() {
    const [searchOpen,   setSearchOpen]   = useState(false);
    const [profileOpen,  setProfileOpen]  = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [userAvatar,   setUserAvatar]   = useState<string | null>(null);
    const [unreadMsgs,      setUnreadMsgs]      = useState(0);
    const [pendingFriendReqs, setPendingFriendReqs] = useState(0);
    const [showNavbar, setShowNavbar] = useState(true);
    const lastScrollY = useRef(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollY.current && currentScrollY > 40) {
                setShowNavbar(false);
            } else {
                setShowNavbar(true);
            }
            lastScrollY.current = currentScrollY;
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const { user, status } = useAuth();
    const { subscribe } = useWs();
    const isLoggedIn = status === 'authenticated' && !!user?.id;

    // Fetch pending friend request count
    const loadFriendReqCount = useCallback(async () => {
        if (!isLoggedIn) { setPendingFriendReqs(0); return; }
        try {
            const reqs = await apiFetch<unknown[]>('/api/friends/requests/incoming');
            setPendingFriendReqs(reqs.length);
        } catch { setPendingFriendReqs(0); }
    }, [isLoggedIn]);

    useEffect(() => { loadFriendReqCount(); }, [loadFriendReqCount]);

    // Fetch avatar when logged in, reset when not
    useEffect(() => {
        if (!isLoggedIn) { setUserAvatar(null); setUnreadMsgs(0); return; }
        apiFetch<{ avatarUrl?: string | null }>('/api/users/me')
            .then(me => setUserAvatar(me.avatarUrl ? `${API_BASE}${me.avatarUrl}` : null))
            .catch(() => setUserAvatar(null));
    }, [isLoggedIn]);

    // WebSocket: update badges in real-time
    useEffect(() => {
        const unsubChat = subscribe('chat', () => {
            setUnreadMsgs(prev => prev + 1);
        });
        const unsubFriends = subscribe('friends', () => {
            loadFriendReqCount();
        });
        return () => { unsubChat(); unsubFriends(); };
    }, [subscribe, loadFriendReqCount]);

    // Listen for custom events from other pages (messages read, friend requests changed)
    useEffect(() => {
        const onMsgsRead = () => setUnreadMsgs(0);
        const onFriendsChanged = () => loadFriendReqCount();
        window.addEventListener('messagesRead', onMsgsRead);
        window.addEventListener('friendRequestsChanged', onFriendsChanged);
        return () => {
            window.removeEventListener('messagesRead', onMsgsRead);
            window.removeEventListener('friendRequestsChanged', onFriendsChanged);
        };
    }, [loadFriendReqCount]);

    return (
        <nav className={styles.navbar + (showNavbar ? '' : ' ' + styles.navbarHidden)}>
            {/* Logo — links to home */}
            <li className={styles.navList}>
                <Link href="/">
                    <img src="/1.svg" alt="Logo" className={styles.logo} />
                </Link>
            </li>

            <ul className={styles.navList}>
                {/* Search */}

                <li className={styles.navItem}>
                    <button
                        className={styles.navItem}
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => setSearchOpen(true)}
                    >
                        <img src="/search.svg" alt="Search" className={styles.searchIcon} />
                    </button>
                </li>
                <li className={styles.navItem}>
                    <Link href="/">Feed</Link>
                </li>
                <li className={styles.navItem}>
                    <Link href="/explore">Explore</Link>
                </li>
                {isLoggedIn && (
                    <>
                        <li className={styles.navItem}>
                            <Link href="/friends" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                Friends
                                {pendingFriendReqs > 0 && (
                                    <span style={{
                                        minWidth: 16, height: 16, borderRadius: 8,
                                        background: '#c0392b', color: '#fff',
                                        fontSize: 9, fontWeight: 800,
                                        display: 'inline-flex', alignItems: 'center',
                                        justifyContent: 'center', padding: '0 4px',
                                        lineHeight: 1,
                                    }}>{pendingFriendReqs > 99 ? '99+' : pendingFriendReqs}</span>
                                )}
                            </Link>
                        </li>
                        <li className={styles.navItem}>
                            <Link href="/messages" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                Messages
                                {unreadMsgs > 0 && (
                                    <span style={{
                                        minWidth: 16, height: 16, borderRadius: 8,
                                        background: '#c0392b', color: '#fff',
                                        fontSize: 9, fontWeight: 800,
                                        display: 'inline-flex', alignItems: 'center',
                                        justifyContent: 'center', padding: '0 4px',
                                        lineHeight: 1,
                                    }}>{unreadMsgs > 99 ? '99+' : unreadMsgs}</span>
                                )}
                            </Link>
                        </li>
                    </>
                )}

                {/* Profile icon — behaviour depends on auth state */}
                <li className={styles.navItem} style={{ position: 'relative' }}>
                    <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer',
                                 padding: 0, display: 'flex', alignItems: 'center' }}
                        onClick={() => isLoggedIn ? setDropdownOpen(o => !o) : setProfileOpen(true)}
                        aria-label="Profile"
                    >
                        {isLoggedIn && userAvatar
                            ? <img src={userAvatar} alt="Profile" className={styles.profileIcon}
                                style={{ objectFit: 'cover', border: '2px solid #4a7030' }} />
                            : <img src="/profile.svg" alt="Profile" className={styles.profileIcon} />
                        }
                    </button>

                    {isLoggedIn && dropdownOpen && user && (
                        <ProfileDropdown
                            user={{ id: user.id, email: user.email, name: user.name }}
                            onClose={() => setDropdownOpen(false)}
                        />
                    )}
                </li>
            </ul>

            <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
            {!isLoggedIn && (
                <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
            )}
        </nav>
    );
}
