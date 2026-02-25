'use client';

/**
 * /messages — split-panel direct messaging
 *
 * Layout:
 *   Left sidebar (280 px):
 *     · Pending friend-request count badge → expands inline to ACCEPT / DECLINE
 *     · Conversation list with last message + unread badge
 *     · "+" button → user-picker modal to start a new conversation
 *   Right panel:
 *     · Conversation header (avatar, name, nickname)
 *     · Chronological message bubbles (mine right / theirs left)
 *     · Send input at the bottom
 *
 * Auth: required — shows a sign-in prompt if unauthenticated.
 * Polling: active thread is refreshed every 3 s while open.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { H1_STYLE } from '../lib/typography';

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
  fromUser: { id: string; name: string; nickname: string; photo: string | null; interests: string[] };
  createdAt: string;
}

interface AllUser {
  userId: string;
  name: string;
  nickname: string;
  avatar: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const GREEN = '#1a5c2a';
const PALE  = '#dff0d8';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtMsg(iso: string): string {
  const d   = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Mini avatar ────────────────────────────────────────────────────────────────

function Avatar({ photo, size = 38 }: { photo: string | null; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden',
      background: GREEN, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {photo
        ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <svg viewBox="0 0 100 100" width="68%" height="68%">
            <circle cx="50" cy="36" r="22" fill="#4a6e2a" />
            <path d="M8 95 Q8 63 50 63 Q92 63 92 95 Z" fill="#4a6e2a" />
          </svg>
      }
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { data: session, status: authStatus } = useSession();
  const currentUserId = (session?.user as { id?: string } | null)?.id ?? null;

  // Left sidebar state
  const [conversations,  setConversations]  = useState<Conversation[]>([]);
  const [pendingReqs,    setPendingReqs]    = useState<PendingRequest[]>([]);
  const [showRequests,   setShowRequests]   = useState(false);
  const [reqBusy,        setReqBusy]        = useState<string | null>(null);
  const [convLoading,    setConvLoading]    = useState(true);

  // Right panel state
  const [activePartner,  setActivePartner]  = useState<Partner | null>(null);
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [threadLoading,  setThreadLoading]  = useState(false);
  const [newMsg,         setNewMsg]         = useState('');
  const [sending,        setSending]        = useState(false);

  // New conversation modal
  const [showNewModal,   setShowNewModal]   = useState(false);
  const [allUsers,       setAllUsers]       = useState<AllUser[]>([]);
  const [userSearch,     setUserSearch]     = useState('');
  const [usersLoading,   setUsersLoading]   = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevMsgCount   = useRef(0);

  // ── Data loaders ──────────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    if (!currentUserId) return;
    const res = await fetch('/api/messages');
    if (res.ok) setConversations(await res.json());
    setConvLoading(false);
  }, [currentUserId]);

  const loadRequests = useCallback(async () => {
    if (!currentUserId) return;
    const res = await fetch('/api/friends');
    if (res.ok) {
      const data = await res.json();
      setPendingReqs(data.pendingReceived ?? []);
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
    const res = await fetch(`/api/messages/${partnerId}`);
    if (res.ok) {
      const incoming: Message[] = await res.json();
      setMessages(prev => {
        // Return same reference if nothing changed — prevents unnecessary re-renders
        if (
          prev.length === incoming.length &&
          (prev.length === 0 || prev[prev.length - 1].id === incoming[incoming.length - 1].id)
        ) return prev;
        return incoming;
      });
      loadConversations();
      // Tell the Navbar to refresh its unread badge immediately
      if (!silent) window.dispatchEvent(new CustomEvent('messagesRead'));
    }
    if (!silent) setThreadLoading(false);
  }, [loadConversations]);

  // Polling while a conversation is open
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!activePartner) return;
    pollRef.current = setInterval(() => loadThread(activePartner.id, true), 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activePartner, loadThread]);

  // Auto-scroll to bottom only when new messages are added
  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMsgCount.current = messages.length;
  }, [messages]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  function openConversation(partner: Partner) {
    setActivePartner(partner);
    setMessages([]);
    loadThread(partner.id);
    setShowNewModal(false);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsg.trim() || !activePartner || !currentUserId) return;
    setSending(true);
    const res = await fetch(`/api/messages/${activePartner.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ content: newMsg.trim() }),
    });
    setSending(false);
    if (res.ok) {
      setNewMsg('');
      await loadThread(activePartner.id);
    }
  }

  async function handleAccept(fromUserId: string) {
    setReqBusy(fromUserId);
    await fetch('/api/friends/accept', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ fromUserId }),
    });
    setReqBusy(null);
    loadRequests();
    window.dispatchEvent(new CustomEvent('friendRequestsChanged'));
  }

  async function handleDecline(fromUserId: string) {
    setReqBusy(fromUserId);
    await fetch('/api/friends/decline', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ fromUserId }),
    });
    setReqBusy(null);
    loadRequests();
    window.dispatchEvent(new CustomEvent('friendRequestsChanged'));
  }

  async function openNewModal() {
    setShowNewModal(true);
    setUserSearch('');
    setUsersLoading(true);
    const res = await fetch('/api/friends');
    if (res.ok) {
      const data = await res.json();
      const friends: AllUser[] = (data.users ?? [])
        .filter((u: { status: string }) => u.status === 'FRIEND')
        .map((u: { id: string; name: string; nickname: string; photo: string | null }) => ({
          userId: u.id, name: u.name, nickname: u.nickname, avatar: u.photo ?? null,
        }));
      setAllUsers(friends.filter(u => u.userId !== currentUserId));
    }
    setUsersLoading(false);
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────────

  if (authStatus === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: PALE, display: 'flex',
        alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: GREEN, fontStyle: 'italic' }}>Loading…</p>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <div style={{ minHeight: '100vh', background: PALE, display: 'flex',
        alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '3rem 2rem',
          background: 'rgba(255,255,255,0.4)', borderRadius: 20, maxWidth: 360 }}>
          <p style={{ color: GREEN, fontWeight: 700, fontSize: 15, margin: '0 0 0.4rem' }}>
            Sign in to use Messages.
          </p>
          <p style={{ color: '#4a7030', fontSize: 12, margin: 0, opacity: 0.7 }}>
            Use the profile icon to log in or create an account.
          </p>
        </div>
      </div>
    );
  }

  const filteredUsers = allUsers.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.nickname.toLowerCase().includes(userSearch.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: PALE, paddingTop: 72,
      display: 'flex', flexDirection: 'column', padding: '100px' }}>

      <div style={{ display: 'flex', flex: 1, maxWidth: 960, width: '100%',
        margin: '0 auto', height: 'calc(100vh - 72px)', overflow: 'hidden', borderRadius: '20px' }}>

        {/* ══════════ LEFT SIDEBAR ══════════ */}
        <div style={{ width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: 'rgba(255,255,255,0.55)', borderRight: '1px solid rgba(0,0,0,0.08)' }}>

          {/* Header */}
          <div style={{ padding: '1rem 1rem 0.8rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <h1 style={H1_STYLE}>MESSAGES</h1>
            <button onClick={openNewModal} style={{
              width: 30, height: 30, borderRadius: '50%', border: 'none',
              background: GREEN, color: '#fff', fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)', 
            }}>+</button>
          </div>

          {/* Friend requests accordion */}
          {pendingReqs.length > 0 && (
            <div style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <button
                onClick={() => setShowRequests(r => !r)}
                style={{
                  width: '100%', padding: '0.55rem 1rem',
                  background: 'rgba(192,57,43,0.07)',
                  border: 'none', textAlign: 'left', cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#c0392b',
                  letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                  Friend Requests
                </span>
                <span style={{
                  minWidth: 20, height: 20, borderRadius: 10, background: '#c0392b',
                  color: '#fff', fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                }}>{pendingReqs.length}</span>
              </button>

              {showRequests && pendingReqs.map(({ fromUser: u, createdAt }) => (
                <div key={u.id} style={{
                  padding: '0.6rem 1rem', display: 'flex', gap: 8, alignItems: 'center',
                  borderTop: '1px solid rgba(0,0,0,0.04)',
                  background: 'rgba(255,255,255,0.45)',
                }}>
                  <Avatar photo={u.photo} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2e0a',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#4a7030', opacity: 0.55 }}>
                      {new Date(createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button disabled={reqBusy === u.id} onClick={() => handleAccept(u.id)} style={{
                      padding: '0.2rem 0.55rem', borderRadius: 7, border: 'none',
                      background: '#27ae60', color: '#fff',
                      fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                      opacity: reqBusy === u.id ? 0.5 : 1,
                    }}>✓</button>
                    <button disabled={reqBusy === u.id} onClick={() => handleDecline(u.id)} style={{
                      padding: '0.2rem 0.55rem', borderRadius: 7, border: 'none',
                      background: '#c0392b', color: '#fff',
                      fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                      opacity: reqBusy === u.id ? 0.5 : 1,
                    }}>✗</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Conversations */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {convLoading && (
              <p style={{ padding: '1rem', fontSize: 12, color: '#4a7030', fontStyle: 'italic' }}>
                Loading…
              </p>
            )}
            {!convLoading && conversations.length === 0 && (
              <p style={{ padding: '1rem', fontSize: 12, color: '#4a7030', opacity: 0.6 }}>
                No conversations yet — press + to start one.
              </p>
            )}
            {conversations.map(conv => {
              const isActive = activePartner?.id === conv.partner.id;
              return (
                <div key={conv.partner.id}
                  onClick={() => openConversation(conv.partner)}
                  style={{
                    padding: '0.7rem 1rem', display: 'flex', gap: 10, alignItems: 'center',
                    cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.04)',
                    background: isActive ? 'rgba(26,92,42,0.1)' : 'transparent',
                    transition: 'background 0.12s',
                  }}>
                  <Avatar photo={conv.partner.photo} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1a2e0a',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.partner.nickname}
                      </span>
                      <span style={{ fontSize: 10, color: '#4a7030', opacity: 0.5,
                        flexShrink: 0, marginLeft: 4 }}>
                        {fmtMsg(conv.lastMessage.createdAt)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#4a7030', opacity: 0.65,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {conv.lastMessage.senderId === currentUserId ? 'You: ' : ''}
                        {conv.lastMessage.content}
                      </span>
                      {conv.unread > 0 && (
                        <span style={{
                          minWidth: 18, height: 18, borderRadius: 9, background: GREEN, color: '#fff',
                          fontSize: 10, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '0 4px', marginLeft: 4, flexShrink: 0,
                        }}>{conv.unread}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════ RIGHT PANEL ══════════ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
          background: 'rgba(255,255,255,0.2)' }}>

          {!activePartner ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#4a7030', fontSize: 14, opacity: 0.5, margin: 0 }}>
                Select a conversation or press + to start one.
              </p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div style={{
                padding: '0.75rem 1.2rem', borderBottom: '1px solid rgba(0,0,0,0.07)',
                background: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Avatar photo={activePartner.photo} size={34} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2e0a' }}>
                    {activePartner.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#4a7030', opacity: 0.6 }}>
                    @{activePartner.nickname}
                  </div>
                </div>
              </div>

              {/* Messages area */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem',
                display: 'flex', flexDirection: 'column', gap: 5 }}>
                {threadLoading && (
                  <p style={{ fontSize: 12, color: '#4a7030', fontStyle: 'italic',
                    alignSelf: 'center', margin: '2rem 0' }}>Loading…</p>
                )}
                {!threadLoading && messages.length === 0 && (
                  <p style={{ fontSize: 12, color: '#4a7030', opacity: 0.5,
                    alignSelf: 'center', margin: '3rem 0' }}>
                    No messages yet. Say hello!
                  </p>
                )}
                {messages.map(msg => {
                  const isMine = msg.senderId === currentUserId;
                  return (
                    <div key={msg.id} style={{
                      display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start',
                    }}>
                      <div style={{
                        maxWidth: '68%', padding: '0.5rem 0.85rem',
                        borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: isMine ? GREEN : 'rgba(255,255,255,0.92)',
                        color: isMine ? '#fff' : '#1a2e0a',
                        fontSize: 13, lineHeight: 1.45,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.09)',
                      }}>
                        <p style={{ margin: 0, wordBreak: 'break-word' }}>{msg.content}</p>
                        <p style={{ margin: '3px 0 0', fontSize: 10, opacity: 0.55, textAlign: 'right' }}>
                          {fmtMsg(msg.createdAt)}
                          {isMine && msg.readAt ? ' · seen' : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Send input */}
              <form onSubmit={handleSend} style={{
                padding: '0.7rem 1rem', borderTop: '1px solid rgba(0,0,0,0.07)',
                background: 'rgba(255,255,255,0.55)', display: 'flex', gap: 8,
              }}>
                <input
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  placeholder="Write a message…"
                  style={{
                    flex: 1, padding: '0.6rem 0.9rem', borderRadius: 22,
                    border: '1px solid rgba(0,0,0,0.11)',
                    background: 'rgba(255,255,255,0.85)', fontSize: 13,
                    color: '#1a2e0a', outline: 'none', fontFamily: 'inherit',
                  }}
                />
                <button type="submit" disabled={!newMsg.trim() || sending} style={{
                  padding: '0.6rem 1.15rem', borderRadius: 22, border: 'none',
                  background: GREEN, color: '#fff', fontSize: 16, fontWeight: 700,
                  cursor: !newMsg.trim() || sending ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: !newMsg.trim() || sending ? 0.4 : 1, transition: 'opacity 0.12s',
                }}>→</button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* ══════════ NEW CONVERSATION MODAL ══════════ */}
      {showNewModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div style={{
            background: '#e6f7d8', borderRadius: 20, padding: '1.5rem',
            width: '100%', maxWidth: 360, maxHeight: '72vh',
            display: 'flex', flexDirection: 'column', gap: '0.85rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1a2e0a' }}>
                NEW CONVERSATION
              </h3>
              <button onClick={() => setShowNewModal(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 20, color: '#4a7030', lineHeight: 1,
              }}>×</button>
            </div>

            <input
              placeholder="Search by name or nickname…"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              autoFocus
              style={{
                padding: '0.55rem 0.85rem', borderRadius: 14, border: 'none',
                background: 'rgba(255,255,255,0.75)', fontSize: 13, color: '#1a2e0a',
                outline: 'none', fontFamily: 'inherit',
              }}
            />

            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {usersLoading && (
                <p style={{ fontSize: 12, color: '#4a7030', fontStyle: 'italic' }}>Loading users…</p>
              )}
              {!usersLoading && filteredUsers.length === 0 && (
                <p style={{ fontSize: 12, color: '#4a7030', opacity: 0.6 }}>No friends found. Add friends first!</p>
              )}
              {filteredUsers.map(user => (
                <div key={user.userId}
                  onClick={() => openConversation({
                    id: user.userId, name: user.name,
                    nickname: user.nickname, photo: user.avatar,
                  })}
                  style={{
                    display: 'flex', gap: 10, alignItems: 'center',
                    padding: '0.6rem 0.75rem', borderRadius: 12,
                    cursor: 'pointer', background: 'rgba(255,255,255,0.55)',
                    transition: 'background 0.1s',
                  }}>
                  <Avatar photo={user.avatar} size={36} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2e0a' }}>{user.name}</div>
                    <div style={{ fontSize: 11, color: '#4a7030', opacity: 0.65 }}>@{user.nickname}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
