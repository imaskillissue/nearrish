'use client';

/**
 * /messages — split-panel direct messaging
 */

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { useWs } from '../lib/ws-context';
import { H1_STYLE } from '../lib/typography';
import Link from 'next/link';
import { apiFetch, API_BASE } from '../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Partner {
  id: string;
  name: string;
  nickname: string;
  photo: string | null;
}

interface Conversation {
  partner: Partner;
  lastMessage: { content: string; createdAt: string; senderId: string };
  unread: number;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  readAt: string | null;
}

interface PendingRequest {
  fromUser: { id: string; name: string; nickname: string; photo: string | null };
  createdAt: string;
  requestId: string;
}

interface AllUser {
  userId: string;
  name: string;
  nickname: string;
  avatar: string | null;
}

interface BackendUser {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string | null;
}

interface BackendConversation {
  id: string;
  name: string | null;
  group: boolean;
  participants: BackendUser[];
  createdAt: string;
  lastMessage?: BackendMessage | null;
  unreadCount?: number;
}

interface BackendMessage {
  id: string;
  sender: BackendUser;
  content: string;
  read: boolean;
  createdAt: string;
}

interface BackendFriendRequest {
  id: string;
  sender: BackendUser;
  receiver: BackendUser;
  status: string;
  createdAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const GREEN     = '#1a5c2a';
const PALE      = '#dff0d8';
const PAGE_SIZE = 20;

const NEW_MSG_STYLE_ID = 'nearrish-new-msg-anim';
if (typeof document !== 'undefined' && !document.getElementById(NEW_MSG_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = NEW_MSG_STYLE_ID;
  style.textContent = `
    @keyframes msgSlideIn {
      0%    { opacity: 0; transform: translateY(12px) scale(0.95); }
      50%   { opacity: 1; transform: translateY(-3px) scale(1.02); }
      100%  { opacity: 1; transform: translateY(0) scale(1); }
    }
    .nearrish-new-msg {
      animation: msgSlideIn 0.4s ease-out;
    }
  `;
  document.head.appendChild(style);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtMsg(iso: string): string {
  const d   = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function Avatar({ photo, size = 38, isOnline = false }: { photo: string | null; size?: number; isOnline?: boolean }) {
  const dotSize = Math.max(9, Math.round(size * 0.29));
  return (
    <div style={{ position: 'relative', flexShrink: 0, width: size, height: size }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {photo
          ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <svg viewBox="0 0 100 100" width="68%" height="68%">
              <circle cx="50" cy="36" r="22" fill="#4a6e2a" />
              <path d="M8 95 Q8 63 50 63 Q92 63 92 95 Z" fill="#4a6e2a" />
            </svg>
        }
      </div>
      {isOnline && (
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: dotSize, height: dotSize, borderRadius: '50%',
          background: '#27ae60', border: '2px solid #fff',
          boxSizing: 'border-box',
        }} />
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MessagesPageWrapper() {
  return (
    <Suspense>
      <MessagesPage />
    </Suspense>
  );
}

function MessagesPage() {
  const { user, status: authStatus } = useAuth();
  const { subscribe, connected: wsConnected, onlineUsers } = useWs();
  const searchParams = useSearchParams();
  const currentUserId = user?.id ?? null;

  const [conversations,  setConversations]  = useState<Conversation[]>([]);
  const [pendingReqs,    setPendingReqs]    = useState<PendingRequest[]>([]);
  const [showRequests,   setShowRequests]   = useState(false);
  const [reqBusy,        setReqBusy]        = useState<string | null>(null);
  const [convLoading,    setConvLoading]    = useState(true);

  const [activePartner,  setActivePartner]  = useState<Partner | null>(null);
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [threadLoading,  setThreadLoading]  = useState(false);
  const [newMsg,         setNewMsg]         = useState('');
  const [sending,        setSending]        = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  const [showNewModal,   setShowNewModal]   = useState(false);
  const [allUsers,       setAllUsers]       = useState<AllUser[]>([]);
  const [userSearch,     setUserSearch]     = useState('');
  const [usersLoading,   setUsersLoading]   = useState(false);

  const [convMap, setConvMap] = useState<Map<string, string>>(new Map());
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  const [hasMore,      setHasMore]      = useState(false);
  const [loadingMore,  setLoadingMore]  = useState(false);

  const scrollAreaRef      = useRef<HTMLDivElement>(null);
  const pollRef            = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldScrollBottom = useRef(false);
  const isLoadingMoreRef   = useRef(false);
  const [newMsgIds, setNewMsgIds] = useState<Set<string>>(new Set());

  const loadConversations = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const backendConvs = await apiFetch<BackendConversation[]>('/api/chat/conversations');
      const newConvMap = new Map<string, string>();
      const convList: Conversation[] = [];

      for (const conv of backendConvs) {
        const partner = conv.participants.find(p => p.id !== currentUserId);
        if (!partner) continue;
        newConvMap.set(partner.id, conv.id);

        const last = conv.lastMessage;
        const lastMessage = last
          ? { content: last.content, createdAt: last.createdAt, senderId: last.sender.id }
          : { content: '', createdAt: conv.createdAt, senderId: '' };

        convList.push({
          partner: { id: partner.id, name: partner.username, nickname: partner.username, photo: partner.avatarUrl ? `${API_BASE}${partner.avatarUrl}` : null },
          lastMessage,
          unread: conv.unreadCount ?? 0,
        });
      }

      setConvMap(newConvMap);
      convList.sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());
      setConversations(convList);
    } catch (err) {
      console.error('[MESSAGES] Failed to load conversations:', err);
    }
    setConvLoading(false);
  }, [currentUserId]);

  const loadRequests = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const incoming = await apiFetch<BackendFriendRequest[]>('/api/friends/requests/incoming');
      setPendingReqs(incoming.map(req => ({
        fromUser: {
          id: req.sender.id, name: req.sender.username,
          nickname: req.sender.username, photo: req.sender.avatarUrl ? `${API_BASE}${req.sender.avatarUrl}` : null,
        },
        createdAt: req.createdAt,
        requestId: req.id,
      })));
    } catch (err) {
      console.error('[MESSAGES] Failed to load requests:', err);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      loadConversations();
      loadRequests();
    }
  }, [authStatus, loadConversations, loadRequests]);


  const loadThread = useCallback(async (partnerId: string, silent = false) => {
    if (!silent) setThreadLoading(true);
    try {
      let cId = convMap.get(partnerId);
      if (!cId) {
        const conv = await apiFetch<BackendConversation>(`/api/chat/conversations/${partnerId}`, { method: 'POST' });
        cId = conv.id;
        setConvMap(prev => new Map(prev).set(partnerId, cId!));
      }
      setActiveConvId(cId);

      await apiFetch(`/api/chat/conversations/${cId}/read`, { method: 'POST' }).catch(() => {});

      const msgs = await apiFetch<BackendMessage[]>(`/api/chat/conversations/${cId}/messages?limit=${PAGE_SIZE}`);
      const mapped = msgs.map(m => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt,
        senderId: m.sender.id,
        readAt: m.read ? m.createdAt : null,
      }));
      setHasMore(mapped.length === PAGE_SIZE);

      if (silent) {
        setMessages(prev => {
          const prevIds = new Set(prev.map(m => m.id));
          const freshIds = mapped
            .filter(m => !prevIds.has(m.id) && m.senderId !== currentUserId)
            .map(m => m.id);
          if (freshIds.length > 0) {
            setNewMsgIds(new Set(freshIds));
            setTimeout(() => setNewMsgIds(new Set()), 500);
            shouldScrollBottom.current = true;
          }
          return mapped;
        });
      } else {
        shouldScrollBottom.current = true;
        setMessages(mapped);
      }

      const lastMsg = mapped.length > 0 ? mapped[mapped.length - 1] : null;
      setConversations(prev => {
        const exists = prev.some(c => c.partner.id === partnerId);
        if (!exists) {
          loadConversations();
          return prev;
        }
        return prev.map(c => c.partner.id === partnerId
          ? { ...c, unread: 0, ...(lastMsg && { lastMessage: { content: lastMsg.content, createdAt: lastMsg.createdAt, senderId: lastMsg.senderId } }) }
          : c
        );
      });
      window.dispatchEvent(new CustomEvent('messagesRead'));
    } catch (err) {
      console.error('[MESSAGES] Failed to load thread:', err);
    }
    if (!silent) setThreadLoading(false);
  }, [convMap, loadConversations, currentUserId]);

  useEffect(() => {
    const unsubChat = subscribe('chat', (payload) => {
      const msgId = (payload as { messageId?: string }).messageId ?? '';
      if (msgId.startsWith('READ:')) {
        setMessages(prev => prev.map(m => ({ ...m, readAt: m.readAt || new Date().toISOString() })));
        return;
      }
      if (activePartner) {
        loadThread(activePartner.id, true);
        window.dispatchEvent(new CustomEvent('messagesRead'));
      } else {
        loadConversations();
      }
    });
    const unsubFriends = subscribe('friends', () => {
      loadRequests();
    });
    return () => { unsubChat(); unsubFriends(); };
  }, [subscribe, activePartner, loadThread, loadConversations, loadRequests]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!activePartner || wsConnected) return;
    pollRef.current = setInterval(() => loadThread(activePartner.id, true), 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activePartner, loadThread, wsConnected]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || activePartner || wsConnected) return;
    const id = setInterval(() => loadConversations(), 3000);
    return () => clearInterval(id);
  }, [authStatus, activePartner, loadConversations, wsConnected]);

  useEffect(() => {
    if (!shouldScrollBottom.current) return;
    shouldScrollBottom.current = false;
    const area = scrollAreaRef.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [messages]);

  const loadMoreMessages = useCallback(async () => {
    if (!activeConvId || loadingMore || !hasMore || isLoadingMoreRef.current) return;
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingMore(true);
    isLoadingMoreRef.current = true;
    const scrollArea = scrollAreaRef.current;
    const prevScrollHeight = scrollArea?.scrollHeight ?? 0;
    try {
      const older = await apiFetch<BackendMessage[]>(
        `/api/chat/conversations/${activeConvId}/messages?limit=${PAGE_SIZE}&before=${encodeURIComponent(oldest.createdAt)}`
      );
      const mapped = older.map(m => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt,
        senderId: m.sender.id,
        readAt: m.read ? m.createdAt : null,
      }));
      setHasMore(mapped.length === PAGE_SIZE);
      if (mapped.length > 0) {
        setMessages(prev => [...mapped, ...prev]);
        requestAnimationFrame(() => {
          if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight - prevScrollHeight;
          isLoadingMoreRef.current = false;
        });
      } else {
        isLoadingMoreRef.current = false;
      }
    } catch (err) {
      console.error('[MESSAGES] Failed to load more:', err);
      isLoadingMoreRef.current = false;
    }
    setLoadingMore(false);
  }, [activeConvId, loadingMore, hasMore, messages]);

  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!area || !activePartner) return;
    const onScroll = () => {
      if (area.scrollTop < 80 && hasMore && !loadingMore) loadMoreMessages();
    };
    area.addEventListener('scroll', onScroll);
    return () => area.removeEventListener('scroll', onScroll);
  }, [activePartner, hasMore, loadingMore, loadMoreMessages]);

  function openConversation(partner: Partner) {
    setActivePartner(partner);
    setMessages([]);
    setHasMore(false);
    loadThread(partner.id);
    setShowNewModal(false);
  }

  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current || authStatus !== 'authenticated') return;
    const toId = searchParams.get('to');
    const toName = searchParams.get('name') ?? 'User';
    if (toId) {
      deepLinkHandled.current = true;
      openConversation({ id: toId, name: toName, nickname: toName, photo: null });
    }
  }, [authStatus]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsg.trim() || !activePartner || !currentUserId || !activeConvId) return;
    setSending(true);
    try {
      await apiFetch(`/api/chat/conversations/${activeConvId}/messages?content=${encodeURIComponent(newMsg.trim())}`, {
        method: 'POST',
      });
      setNewMsg('');
      await loadThread(activePartner.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Message could not be delivered.');
    }
    setSending(false);
  }

  async function handleAccept(fromUserId: string) {
    setReqBusy(fromUserId);
    try {
      const req = pendingReqs.find(r => r.fromUser.id === fromUserId);
      if (req) {
        await apiFetch(`/api/friends/accept/${req.requestId}`, { method: 'POST' });
        setPendingReqs(prev => prev.filter(r => r.fromUser.id !== fromUserId));
      }
    } catch (err) {
      console.error('[MESSAGES] Failed to accept request:', err);
    }
    setReqBusy(null);
    window.dispatchEvent(new CustomEvent('friendRequestsChanged'));
  }

  async function handleDecline(fromUserId: string) {
    setReqBusy(fromUserId);
    try {
      const req = pendingReqs.find(r => r.fromUser.id === fromUserId);
      if (req) {
        await apiFetch(`/api/friends/decline/${req.requestId}`, { method: 'POST' });
        setPendingReqs(prev => prev.filter(r => r.fromUser.id !== fromUserId));
      }
    } catch (err) {
      console.error('[MESSAGES] Failed to decline request:', err);
    }
    setReqBusy(null);
    window.dispatchEvent(new CustomEvent('friendRequestsChanged'));
  }

  async function openNewModal() {
    setShowNewModal(true);
    setUserSearch('');
    setUsersLoading(true);
    try {
      const users = await apiFetch<BackendUser[]>('/api/public/users');
      setAllUsers(users
        .filter(u => u.id !== currentUserId)
        .map(u => ({
          userId: u.id, name: u.username, nickname: u.username, avatar: u.avatarUrl ? `${API_BASE}${u.avatarUrl}` : null,
        })));
    } catch (err) {
      console.error('[MESSAGES] Failed to load friends:', err);
    }
    setUsersLoading(false);
  }

  if (authStatus === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: PALE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: GREEN, fontStyle: 'italic' }}>Loading…</p>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <div style={{ minHeight: '100vh', background: PALE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '3rem 2rem', background: 'rgba(255,255,255,0.4)', borderRadius: 20, maxWidth: 360 }}>
          <p style={{ color: GREEN, fontWeight: 700, fontSize: 15, margin: '0 0 0.4rem' }}>Sign in to use Messages.</p>
          <p style={{ color: '#4a7030', fontSize: 12, margin: 0, opacity: 0.7 }}>Use the profile icon to log in or create an account.</p>
        </div>
      </div>
    );
  }

  const filteredUsers = allUsers.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.nickname.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: PALE, display: 'flex', flexDirection: 'column', padding: '72px 60px 20px' }}>
      {toast && (
        <div style={{ 
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: '#333', color: '#fff', padding: '10px 20px', borderRadius: 30, zIndex: 1000, fontSize: 13,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', animation: 'toastIn 0.3s ease-out'
        }}>{toast}</div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0, maxWidth: 960, width: '100%', margin: '0 auto', overflow: 'hidden', borderRadius: '20px' }}>
        
        {/* SIDEBAR */}
        <div style={{ width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.55)', borderRight: '1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ padding: '1rem 1rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <h1 style={H1_STYLE}>MESSAGES</h1>
            <button onClick={openNewModal} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: GREEN, color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>+</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.map(conv => (
              <div key={conv.partner.id} onClick={() => openConversation(conv.partner)} style={{ padding: '0.7rem 1rem', display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.04)', background: activePartner?.id === conv.partner.id ? 'rgba(26,92,42,0.1)' : 'transparent' }}>
                <Avatar photo={conv.partner.photo} size={38} isOnline={onlineUsers.has(conv.partner.id)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{conv.partner.nickname}</span>
                    <span style={{ fontSize: 10, opacity: 0.5 }}>{fmtMsg(conv.lastMessage.createdAt)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, opacity: 0.65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.lastMessage.content}</span>
                    {conv.unread > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: GREEN, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{conv.unread}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'rgba(255,255,255,0.2)' }}>
          {!activePartner ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ opacity: 0.5 }}>Select a conversation.</p></div>
          ) : (
            <>
              <div style={{ padding: '0.75rem 1.2rem', borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar photo={activePartner.photo} size={34} isOnline={onlineUsers.has(activePartner.id)} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{activePartner.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>@{activePartner.nickname}</div>
                </div>
              </div>

              <div ref={scrollAreaRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {messages.map(msg => (
                  <div key={msg.id} className={newMsgIds.has(msg.id) ? 'nearrish-new-msg' : ''} style={{ display: 'flex', justifyContent: msg.senderId === currentUserId ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '68%', padding: '0.5rem 0.85rem', borderRadius: msg.senderId === currentUserId ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: msg.senderId === currentUserId ? GREEN : 'rgba(255,255,255,0.92)', color: msg.senderId === currentUserId ? '#fff' : '#1a2e0a', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,0.09)' }}>
                      <p style={{ margin: 0, wordBreak: 'break-word' }}>{msg.content}</p>
                      <div style={{ fontSize: 10, opacity: 0.55, textAlign: 'right', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                        {fmtMsg(msg.createdAt)}
                        {msg.senderId === currentUserId && (
                          <svg width="14" height="10" viewBox="0 0 16 11" fill="none">
                            <path d="M1 5.5L4.5 9L11 1" stroke={msg.readAt ? "#34B7F1" : "#999"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSend} style={{ padding: '1rem', background: 'rgba(255,255,255,0.4)', display: 'flex', gap: 8 }}>
                <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: '0.6rem 1rem', borderRadius: 20, border: '1px solid rgba(0,0,0,0.1)', outline: 'none' }} />
                <button type="submit" disabled={sending || !newMsg.trim()} style={{ padding: '0.6rem 1.2rem', borderRadius: 20, border: 'none', background: GREEN, color: '#fff', cursor: 'pointer', opacity: sending ? 0.5 : 1 }}>Send</button>
              </form>
            </>
          )}
        </div>
      </div>
      
      {/* Modal logic for New Conversation would go here... */}
    </div>
  );
}