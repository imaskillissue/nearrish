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
 *
 * Avatar is fetched from /api/me once per login session and cached in local state.
 * Settings has been moved out of the nav list and into the ProfileDropdown.
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
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
                setShowNavbar(false); // runterscrollen -> Navbar ausblenden
            } else {
                setShowNavbar(true); // hochscrollen -> Navbar einblenden
            }
            lastScrollY.current = currentScrollY;
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // useSession() is provided by next-auth/react and reads the JWT cookie.
    const { data: session, status } = useSession();
    const isLoggedIn = status === 'authenticated' && !!session?.user?.id;

    // Fetch the logged-in user's avatar whenever identity changes.
    // /api/me returns { userId, avatar } from the DB; avatar is a base64 data-URL.
    useEffect(() => {
        if (!isLoggedIn) { setUserAvatar(null); return; }
        fetch('/api/me')
            .then(r => r.json())
            .then(data => setUserAvatar(data.avatar ?? null))
            .catch(() => setUserAvatar(null));
    }, [isLoggedIn, session?.user?.id]);

    // Poll unread message count every 30 s while logged in.
    // Also listens for the 'messagesRead' custom event fired by the Messages page
    // so the badge clears immediately when the user opens a conversation.
    useEffect(() => {
        if (!isLoggedIn) { setUnreadMsgs(0); return; }
        const fetchCount = () =>
            fetch('/api/messages/unread')
                .then(r => r.json())
                .then(d => setUnreadMsgs(d.count ?? 0))
                .catch(() => {});
        fetchCount();
        const id = setInterval(fetchCount, 30_000);
        window.addEventListener('messagesRead', fetchCount);
        return () => {
            clearInterval(id);
            window.removeEventListener('messagesRead', fetchCount);
        };
    }, [isLoggedIn, session?.user?.id]);

    // Poll pending friend-request count every 30 s while logged in.
    // Also refreshes immediately when the Friends page dispatches 'friendRequestsChanged'.
    useEffect(() => {
        if (!isLoggedIn) { setPendingFriendReqs(0); return; }
        const fetchReqs = () =>
            fetch('/api/friends/requests')
                .then(r => r.json())
                .then(d => setPendingFriendReqs(d.count ?? 0))
                .catch(() => {});
        fetchReqs();
        const id = setInterval(fetchReqs, 30_000);
        window.addEventListener('friendRequestsChanged', fetchReqs);
        return () => {
            clearInterval(id);
            window.removeEventListener('friendRequestsChanged', fetchReqs);
        };
    }, [isLoggedIn, session?.user?.id]);

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
                    <Link href="/about" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>About</Link>
                </li>
                                {/* Explore, Events, Messages immer sichtbar */}
                                <li className={styles.navItem}>
                                    <Link href="/explore" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                        Explore
                                        {isLoggedIn && pendingFriendReqs > 0 && (
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
                                    <Link href="/events">Events</Link>
                                </li>

                {/* Profile icon — behaviour depends on auth state */}
                <li className={styles.navItem} style={{ position: 'relative' }}>
                    <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer',
                                 padding: 0, display: 'flex', alignItems: 'center' }}
                        onClick={() => isLoggedIn ? setDropdownOpen(o => !o) : setProfileOpen(true)}
                        aria-label="Profile"
                    >
                        {/* Show user avatar when logged in with a photo, else generic icon */}
                        {isLoggedIn && userAvatar
                            ? <img src={userAvatar} alt="Profile" className={styles.profileIcon}
                                style={{ objectFit: 'cover', border: '2px solid #4a7030' }} />
                            : <img src="/profile.svg" alt="Profile" className={styles.profileIcon} />
                        }
                    </button>

                    {/* Dropdown only mounts when the user is authenticated */}
                    {isLoggedIn && dropdownOpen && (
                        <ProfileDropdown
                            user={{ id: session.user.id, email: session.user.email, name: session.user.name }}
                            onClose={() => setDropdownOpen(false)}
                        />
                    )}
                </li>
            </ul>

            {/* Modals — rendered outside the nav list to avoid z-index issues */}
            <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
            {!isLoggedIn && (
                <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
            )}
        </nav>
    );
}