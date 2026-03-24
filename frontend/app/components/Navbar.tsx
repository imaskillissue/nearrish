"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
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
    const [msgBadgeBounce, setMsgBadgeBounce] = useState(false);
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

    const pathname = usePathname();
    const { user, status } = useAuth();
    const { subscribe, connected: wsConnected } = useWs();
    const isLoggedIn = status === 'authenticated' && !!user?.id;

    const loadFriendReqCount = useCallback(async () => {
        if (!isLoggedIn) { setPendingFriendReqs(0); return; }
        try {
            const reqs = await apiFetch<unknown[]>('/api/friends/requests/incoming');
            setPendingFriendReqs(reqs.length);
        } catch { setPendingFriendReqs(0); }
    }, [isLoggedIn]);

    useEffect(() => { loadFriendReqCount(); }, [loadFriendReqCount]);

    useEffect(() => {
        if (!isLoggedIn) { setUserAvatar(null); setUnreadMsgs(0); return; }
        apiFetch<{ avatarUrl?: string | null }>('/api/users/me')
            .then(me => setUserAvatar(me.avatarUrl ? `${API_BASE}${me.avatarUrl}` : null))
            .catch(() => setUserAvatar(null));
        // Initialize unread count from conversations (single endpoint returns DMs + groups)
        apiFetch<{ unreadCount?: number }[]>('/api/chat/conversations')
            .then(convs => setUnreadMsgs(convs.reduce((s, c) => s + (c.unreadCount || 0), 0)))
            .catch(() => {});
    }, [isLoggedIn]);

    // Track which conversation the user is currently reading (from messages page)
    const activeConvIdRef = useRef<string>('');
    useEffect(() => {
        const onConvActive = (e: Event) => {
            activeConvIdRef.current = (e as CustomEvent<string>).detail ?? '';
        };
        window.addEventListener('conv:active', onConvActive);
        return () => window.removeEventListener('conv:active', onConvActive);
    }, []);

    useEffect(() => {
        const unsubChat = subscribe('chat', (payload) => {
            const msgId = (payload as { messageId?: string }).messageId ?? '';
            if (msgId.startsWith('READ:')) return;
            if (msgId.startsWith('REMOVED:')) {
                setUnreadMsgs(prev => Math.max(0, prev - 1));
                return;
            }
            // New message — payload format: "convId:msgId"
            const colonIdx = msgId.indexOf(':');
            const incomingConvId = colonIdx > 0 ? msgId.substring(0, colonIdx) : null;
            if (incomingConvId && incomingConvId === activeConvIdRef.current) {
                // User is actively reading this conversation — skip badge increment
                // messages page will reload the thread and dispatch messagesRead
                return;
            }
            setUnreadMsgs(prev => prev + 1);
            setMsgBadgeBounce(true);
            setTimeout(() => setMsgBadgeBounce(false), 500);
        });
        const unsubFriends = subscribe('friends', () => { loadFriendReqCount(); });
        return () => { unsubChat(); unsubFriends(); };
    }, [subscribe, loadFriendReqCount]);

    useEffect(() => {
        if (!isLoggedIn || wsConnected) return;
        const id = setInterval(loadFriendReqCount, 20000);
        return () => clearInterval(id);
    }, [isLoggedIn, wsConnected, loadFriendReqCount]);

    useEffect(() => {
        const onMsgsRead = () => {
            apiFetch<{ unreadCount?: number }[]>('/api/chat/conversations')
                .then(convs => setUnreadMsgs(convs.reduce((s, c) => s + (c.unreadCount || 0), 0)))
                .catch(() => setUnreadMsgs(0));
        };
        const onFriendsChanged = () => loadFriendReqCount();
        const onOpenSearch = () => setSearchOpen(true);
        const onOpenLogin  = () => setProfileOpen(true);
        window.addEventListener('messagesRead', onMsgsRead);
        window.addEventListener('friendRequestsChanged', onFriendsChanged);
        window.addEventListener('openSearch', onOpenSearch);
        window.addEventListener('openLogin', onOpenLogin);
        return () => {
            window.removeEventListener('messagesRead', onMsgsRead);
            window.removeEventListener('friendRequestsChanged', onFriendsChanged);
            window.removeEventListener('openSearch', onOpenSearch);
            window.removeEventListener('openLogin', onOpenLogin);
        };
    }, [loadFriendReqCount]);

    return (
        <nav className={styles.navbar + (showNavbar ? '' : ' ' + styles.navbarHidden)}>
            {/* Left — brand */}
            <Link href="/" className={styles.navBrand}>
                <img src="/1.svg" alt="Logo" className={styles.logo} />
            </Link>

            {/* Center — nav links */}
            <ul className={styles.navList}>
                <li className={styles.navItem}>
                    <Link href="/" className={pathname === '/' ? styles.navLinkActive : ''}>Near</Link>
                </li>
                <li className={styles.navItem}>
                    <Link href="/explore" className={pathname === '/explore' ? styles.navLinkActive : ''}>Explore</Link>
                </li>
                {isLoggedIn && (
                    <>
                        <li className={styles.navItem}>
                            <Link href="/friends" className={pathname === '/friends' ? styles.navLinkActive : ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
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
                            <Link href="/messages" className={pathname === '/messages' ? styles.navLinkActive : ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                Messages
                                {unreadMsgs > 0 && (
                                    <span className={msgBadgeBounce ? styles.badgeBounce : ''} style={{
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
            </ul>

            {/* Right — profile / join (desktop only) */}
            <div className={styles.navRight}>
                <button
                    className={styles.searchBtn}
                    onClick={() => setSearchOpen(true)}
                    aria-label="Search"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                </button>
                {!isLoggedIn && (
                    <button className={styles.joinBtn} onClick={() => setProfileOpen(true)}>
                        Join Now
                    </button>
                )}

                <div style={{ position: 'relative' }}>
                    <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                        onClick={() => isLoggedIn ? setDropdownOpen(o => !o) : setProfileOpen(true)}
                        aria-label="Profile"
                    >
                        {isLoggedIn && userAvatar
                            ? <img src={userAvatar} alt="Profile" className={styles.profileIcon} style={{ objectFit: 'cover' }} />
                            : <img src="/profile.svg" alt="Profile" className={styles.profileIcon} />
                        }
                    </button>

                    {isLoggedIn && dropdownOpen && user && (
                        <ProfileDropdown
                            user={{ id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin }}
                            onClose={() => setDropdownOpen(false)}
                        />
                    )}
                </div>
            </div>


            <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
            {!isLoggedIn && (
                <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
            )}
        </nav>
    );
}
