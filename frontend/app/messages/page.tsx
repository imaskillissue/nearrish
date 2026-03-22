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
  senderName?: string;  // used in group threads (? means optional)
  readAt: string | null;
  moderated?: boolean;
}

interface GroupConversation {
  id: string;
  name: string;
  members: { id: string; name: string; photo: string | null }[];
  lastMessage: { content: string; createdAt: string; senderId: string };
  unread: number;
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

// Backend response shapes
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
  moderated?: boolean;
  moderationReason?: string | null;
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

// CSS for new-message animation injected once
const NEW_MSG_STYLE_ID = 'nearrish-new-msg-anim';
if (typeof document !== 'undefined' && !document.getElementById(NEW_MSG_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = NEW_MSG_STYLE_ID;
  style.textContent = `
    @keyframes msgSlideIn {
      0%   { opacity: 0; transform: translateY(12px) scale(0.95); }
      50%  { opacity: 1; transform: translateY(-3px) scale(1.02); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    .nearrish-new-msg {
      animation: msgSlideIn 0.4s ease-out;
    }
    @keyframes toastIn {
      0%   { opacity: 0; transform: translateX(-50%) translateY(16px); }
      100% { opacity: 1; transform: translateX(-50%) translateY(0); }
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

// ── Mini avatar ────────────────────────────────────────────────────────────────

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

  // Left sidebar state
  const [conversations,      setConversations]      = useState<Conversation[]>([]);
  const [groupConversations, setGroupConversations] = useState<GroupConversation[]>([]);
  const [pendingReqs,        setPendingReqs]        = useState<PendingRequest[]>([]);
  const [showRequests,   setShowRequests]   = useState(false);
  const [reqBusy,        setReqBusy]        = useState<string | null>(null);
  const [convLoading,    setConvLoading]    = useState(true);

  // Right panel state
  const [activePartner,  setActivePartner]  = useState<Partner | null>(null);
  const [activeGroup,    setActiveGroup]    = useState<GroupConversation | null>(null);
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [threadLoading,  setThreadLoading]  = useState(false);
  const [newMsg,         setNewMsg]         = useState('');
  const [sending,        setSending]        = useState(false);

  // Toast notification
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // New conversation modal
  const [showNewModal,   setShowNewModal]   = useState(false);
  const [allUsers,       setAllUsers]       = useState<AllUser[]>([]);
  const [userSearch,     setUserSearch]     = useState('');
  const [usersLoading,   setUsersLoading]   = useState(false);

  // Group creation modal
  const [showGroupModal,    setShowGroupModal]    = useState(false);
  const [groupName,         setGroupName]         = useState('');
  const [selectedMembers,   setSelectedMembers]   = useState<Set<string>>(new Set());

  // Sidebar tab
  const [sidebarTab, setSidebarTab] = useState<'dms' | 'groups'>('dms');

  // Map partnerId → conversationId for message fetching
  const [convMap, setConvMap] = useState<Map<string, string>>(new Map());
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  const [hasMore,      setHasMore]      = useState(false);
  const [loadingMore,  setLoadingMore]  = useState(false);

  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const scrollAreaRef     = useRef<HTMLDivElement>(null);
  const pollRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldScrollBottom = useRef(false);
  const isLoadingMoreRef  = useRef(false);
  const [newMsgIds, setNewMsgIds] = useState<Set<string>>(new Set());

  // ── Data loaders ──────────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const backendConvs = await apiFetch<BackendConversation[]>('/api/chat/conversations');
      const newConvMap = new Map<string, string>();
      const convList: Conversation[] = [];
      const groupList: GroupConversation[] = [];

      for (const conv of backendConvs) {
        const last = conv.lastMessage;
        const lastMessage = last
          ? { content: last.content, createdAt: last.createdAt, senderId: last.sender.id }
          : { content: '', createdAt: conv.createdAt, senderId: '' };

        if (conv.group) {
          // Group conversation — collect all members
          groupList.push({
            id: conv.id,
            name: conv.name ?? 'Group',
            members: conv.participants.map(p => ({
              id: p.id,
              name: p.username,
              photo: p.avatarUrl ? `${API_BASE}${p.avatarUrl}` : null,
            })),
            lastMessage,
            unread: conv.unreadCount ?? 0,
          });
        } else {
          // DM conversation — find the other person
          const partner = conv.participants.find(p => p.id !== currentUserId);
          if (!partner) continue;
          newConvMap.set(partner.id, conv.id);
          convList.push({
            partner: { id: partner.id, name: partner.username, nickname: partner.username, photo: partner.avatarUrl ? `${API_BASE}${partner.avatarUrl}` : null },
            lastMessage,
            unread: conv.unreadCount ?? 0,
          });
        }
      }

      setConvMap(newConvMap);
      // Sort both lists newest first
      convList.sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());
      groupList.sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());
      setConversations(convList);
      setGroupConversations(groupList);
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
      // Get or create conversation with this partner
      let cId = convMap.get(partnerId);
      if (!cId) {
        const conv = await apiFetch<BackendConversation>(`/api/chat/conversations/${partnerId}`, { method: 'POST' });
        cId = conv.id;
        setConvMap(prev => new Map(prev).set(partnerId, cId!));
      }
      setActiveConvId(cId);

      // Mark messages as read
      await apiFetch(`/api/chat/conversations/${cId}/read`, { method: 'POST' }).catch(() => {});

      const msgs = await apiFetch<BackendMessage[]>(`/api/chat/conversations/${cId}/messages?limit=${PAGE_SIZE}`);
      const mapped = msgs.map(m => ({
        id: m.id,
        content: m.moderated ? `🚫 ${m.moderationReason || 'Removed by moderation'}` : m.content,
        createdAt: m.createdAt,
        senderId: m.sender.id,
        readAt: m.read ? m.createdAt : null, // Backend doesn't return readAt, so we infer it from "read" boolean (m.read shows the time they were created)
        moderated: m.moderated ?? false,
      }));
      setHasMore(mapped.length === PAGE_SIZE);

      // Detect new incoming messages for animation
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

      // Update sidebar inline: unread=0 + last message for this conversation
      // "After loading a thread, update the sidebar without re-fetching the entire list.
      // Find the conversation that was just opened, reset its unread counter to 0, and refresh its preview text. 
      // If the conversation isn't in the sidebar yet, reload the full list instead."
      const lastMsg = mapped.length > 0 ? mapped[mapped.length - 1] : null;
      setConversations(prev => {
        const exists = prev.some(c => c.partner.id === partnerId);
        if (!exists) {
          // New conversation not yet in sidebar — reload full list
          loadConversations();
          return prev;
        }
        return prev.map(c => c.partner.id === partnerId
          ? { ...c, unread: 0, ...(lastMsg && { lastMessage: { content: lastMsg.content, createdAt: lastMsg.createdAt, senderId: lastMsg.senderId } }) }
          : c                            //copy all of c, set unread to 0, and if there's a last message, also update lastMessage in the sidebar preview
        );
      });
      window.dispatchEvent(new CustomEvent('messagesRead'));
    } catch (err) {
      console.error('[MESSAGES] Failed to load thread:', err);
    }
    if (!silent) setThreadLoading(false);
  }, [convMap, loadConversations, currentUserId]);

  const loadGroupThread = useCallback(async (groupId: string, silent = false) => {
    if (!silent) setThreadLoading(true);
    try {
      setActiveConvId(groupId);
      await apiFetch(`/api/chat/conversations/${groupId}/read`, { method: 'POST' }).catch(() => {});
      const msgs = await apiFetch<BackendMessage[]>(`/api/chat/conversations/${groupId}/messages?limit=${PAGE_SIZE}`);
      const mapped = msgs.map(m => ({
        id: m.id,
        content: m.moderated ? `🚫 ${m.moderationReason || 'Removed by moderation'}` : m.content,
        createdAt: m.createdAt,
        senderId: m.sender.id,
        senderName: m.sender.username,
        readAt: m.read ? m.createdAt : null,
        moderated: m.moderated ?? false,
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
      setGroupConversations(prev => prev.map(g =>
        g.id === groupId ? { ...g, unread: 0 } : g
      ));
      window.dispatchEvent(new CustomEvent('messagesRead'));
    } catch (err) {
      console.error('[MESSAGES] Failed to load group thread:', err);
    }
    if (!silent) setThreadLoading(false);
  }, [currentUserId]);

  // WebSocket: refresh thread and sidebar on incoming chat/friend events
  useEffect(() => {
    const unsubChat = subscribe('chat', (payload) => {
      const msgId = (payload as { messageId?: string }).messageId ?? '';

      if (msgId.startsWith('READ:')) {
        // Read receipt — just flip checkmarks locally, no re-fetch needed
        setMessages(prev => prev.map(m => ({ ...m, readAt: m.readAt || new Date().toISOString() })));
        return;
      }

      if (msgId.startsWith('REMOVED:')) {
        const parts = msgId.split(':');
        const removedId = parts[1];
        const reason = parts.slice(2).join(':');
        setMessages(prev => prev.map(m =>
          m.id === removedId
            ? { ...m, content: `🚫 ${reason || 'Removed by moderation'}`, moderated: true }
            : m
        ));
        return;
      }

      // Actual new message
      if (activePartner) {
        loadThread(activePartner.id, true);
        window.dispatchEvent(new CustomEvent('messagesRead'));
      } else if (activeGroup) {
        loadGroupThread(activeGroup.id, true);
        window.dispatchEvent(new CustomEvent('messagesRead'));
      } else {
        loadConversations();
      }
    });
    const unsubFriends = subscribe('friends', () => {
      loadRequests();
    });
    return () => { unsubChat(); unsubFriends(); };
  }, [subscribe, activePartner, activeGroup, loadThread, loadGroupThread, loadConversations, loadRequests]);

  // Fallback polling when WebSocket is not connected
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (wsConnected) return;
    if (activePartner) {
      pollRef.current = setInterval(() => loadThread(activePartner.id, true), 3000);
    } else if (activeGroup) {
      pollRef.current = setInterval(() => loadGroupThread(activeGroup.id, true), 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activePartner, activeGroup, loadThread, loadGroupThread, wsConnected]);

  // Poll conversations when no thread is open and WS is down — ensures sidebar badges stay current
  useEffect(() => {
    if (authStatus !== 'authenticated' || activePartner || activeGroup || wsConnected) return;
    const id = setInterval(() => loadConversations(), 3000);
    return () => clearInterval(id);
  }, [authStatus, activePartner, activeGroup, loadConversations, wsConnected]);

  // Scroll to bottom when flagged (initial load, new incoming message, own send)
  useEffect(() => {
    if (!shouldScrollBottom.current) return;
    shouldScrollBottom.current = false;
    const area = scrollAreaRef.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [messages]);

  // Load older messages (cursor = createdAt of oldest loaded message)
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
        content: m.moderated ? `🚫 ${m.moderationReason || 'Removed by moderation'}` : m.content,
        createdAt: m.createdAt,
        senderId: m.sender.id,
        readAt: m.read ? m.createdAt : null,
        moderated: m.moderated ?? false,
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

  // Trigger load-more when user scrolls near the top
  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!area || !activePartner) return;
    const onScroll = () => {
      if (area.scrollTop < 80 && hasMore && !loadingMore) loadMoreMessages();
    };
    area.addEventListener('scroll', onScroll);
    return () => area.removeEventListener('scroll', onScroll);
  }, [activePartner, hasMore, loadingMore, loadMoreMessages]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  function openConversation(partner: Partner) {
    setActivePartner(partner);
    setActiveGroup(null);
    setMessages([]);
    setHasMore(false);
    loadThread(partner.id);
    setShowNewModal(false);
  }

  function openGroupConversation(grp: GroupConversation) {
    setActiveGroup(grp);
    setActivePartner(null);
    setMessages([]);
    setHasMore(false);
    loadGroupThread(grp.id);
  }

  function getGroupMemberPhoto(senderId: string): string | null {
    const member = activeGroup?.members.find(m => m.id === senderId);
    return member?.photo ?? null;
  }

  // Auto-open conversation from URL params (?to=userId&name=Username)
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current || authStatus !== 'authenticated') return;
    const toId = searchParams.get('to');
    const toName = searchParams.get('name') ?? 'User';
    if (toId) {
      deepLinkHandled.current = true;
      openConversation({ id: toId, name: toName, nickname: toName, photo: null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsg.trim() || (!activePartner && !activeGroup) || !currentUserId || !activeConvId) return;
    setSending(true);
    try {
      await apiFetch(`/api/chat/conversations/${activeConvId}/messages?content=${encodeURIComponent(newMsg.trim())}`, {
        method: 'POST',
      });
      setNewMsg('');
      await loadThread(activePartner.id);
    } catch (err) {
      console.error('[MESSAGES] Send failed, showing toast:', err);
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

  async function handleCreateGroup() {
    if (!groupName.trim() || selectedMembers.size === 0) return;
    try {
      const conv = await apiFetch<BackendConversation>('/api/chat/conversations/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName.trim(),
          memberIds: Array.from(selectedMembers),
        }),
      });
      setShowGroupModal(false);
      setGroupName('');
      setSelectedMembers(new Set());
      setUserSearch('');
      setSidebarTab('groups');
      await loadConversations();
      const newGroup: GroupConversation = {
        id: conv.id,
        name: conv.name ?? groupName.trim(),
        members: conv.participants.map(p => ({
          id: p.id,
          name: p.username,
          photo: p.avatarUrl ? `${API_BASE}${p.avatarUrl}` : null,
        })),
        lastMessage: { content: '', createdAt: conv.createdAt, senderId: '' },
        unread: 0,
      };
      openGroupConversation(newGroup);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create group.');
    }
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
    <div style={{ height: '100vh', overflow: 'hidden', background: PALE,
      display: 'flex', flexDirection: 'column', padding: '72px 60px 20px' }}>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, maxWidth: 960, width: '100%',
        margin: '0 auto', overflow: 'hidden', borderRadius: '20px' }}>

        {/* ══════════ LEFT SIDEBAR ══════════ */}
        <div style={{ width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: 'rgba(255,255,255,0.55)', borderRight: '1px solid rgba(0,0,0,0.08)' }}>

          {/* Header */}
          <div style={{ padding: '1rem 1rem 0.8rem',
            borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <h1 style={H1_STYLE}>MESSAGES</h1>
              <div style={{ display: 'flex', gap: 6 }}>
                {sidebarTab === 'groups' && (
                  <button onClick={() => {
                    setShowGroupModal(true);
                    setGroupName('');
                    setSelectedMembers(new Set());
                    openNewModal();
                  }} style={{
                    width: 30, height: 30, borderRadius: '50%', border: 'none',
                    background: GREEN, color: '#fff', fontSize: 13, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                  }}>👥+</button>
                )}
                <button onClick={openNewModal} style={{
                  width: 30, height: 30, borderRadius: '50%', border: 'none',
                  background: GREEN, color: '#fff', fontSize: 20, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                }}>+</button>
              </div>
            </div>
            {/* DMs / Groups tabs */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setSidebarTab('dms')}
                style={{
                  flex: 1, padding: '0.3rem 0', border: 'none', borderRadius: 8,
                  fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: sidebarTab === 'dms' ? GREEN : 'rgba(0,0,0,0.06)',
                  color: sidebarTab === 'dms' ? '#fff' : '#4a7030',
                  transition: 'background 0.15s, color 0.15s',
                }}>DMs</button>
              <button
                onClick={() => setSidebarTab('groups')}
                style={{
                  flex: 1, padding: '0.3rem 0', border: 'none', borderRadius: 8,
                  fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: sidebarTab === 'groups' ? GREEN : 'rgba(0,0,0,0.06)',
                  color: sidebarTab === 'groups' ? '#fff' : '#4a7030',
                  transition: 'background 0.15s, color 0.15s',
                }}>Groups</button>
            </div>
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
                  <Avatar photo={u.photo} size={32} isOnline={onlineUsers.has(u.id)} />
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

          {/* Conversations / Groups list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {convLoading && (
              <p style={{ padding: '1rem', fontSize: 12, color: '#4a7030', fontStyle: 'italic' }}>
                Loading…
              </p>
            )}

            {/* ── DMs tab ── */}
            {!convLoading && sidebarTab === 'dms' && conversations.length === 0 && (
              <p style={{ padding: '1rem', fontSize: 12, color: '#4a7030', opacity: 0.6 }}>
                No DMs yet — press + to start one.
              </p>
            )}
            {sidebarTab === 'dms' && conversations.map(conv => {
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
                  <Avatar photo={conv.partner.photo} size={38} isOnline={onlineUsers.has(conv.partner.id)} />
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

            {/* ── Groups tab ── */}
            {!convLoading && sidebarTab === 'groups' && groupConversations.length === 0 && (
              <p style={{ padding: '1rem', fontSize: 12, color: '#4a7030', opacity: 0.6 }}>
                No groups yet — use the + button to create one.
              </p>
            )}
            {sidebarTab === 'groups' && groupConversations.map(grp => {
              const isActive = activeGroup?.id === grp.id;
              return (
                <div key={grp.id}
                  onClick={() => openGroupConversation(grp)}
                  style={{
                    padding: '0.7rem 1rem', display: 'flex', gap: 10, alignItems: 'center',
                    cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.04)',
                    background: isActive ? 'rgba(26,92,42,0.1)' : 'transparent',
                    transition: 'background 0.12s',
                  }}>
                  {/* Group icon placeholder */}
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 17,
                  }}>👥</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1a2e0a',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {grp.name}
                      </span>
                      <span style={{ fontSize: 10, color: '#4a7030', opacity: 0.5,
                        flexShrink: 0, marginLeft: 4 }}>
                        {fmtMsg(grp.lastMessage.createdAt)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#4a7030', opacity: 0.65,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {grp.members.length} members
                      </span>
                      {grp.unread > 0 && (
                        <span style={{
                          minWidth: 18, height: 18, borderRadius: 9, background: GREEN, color: '#fff',
                          fontSize: 10, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '0 4px', marginLeft: 4, flexShrink: 0,
                        }}>{grp.unread}</span>
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

          {!activePartner && !activeGroup ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#4a7030', fontSize: 14, opacity: 0.5, margin: 0 }}>
                Select a conversation or press + to start one.
              </p>
            </div>
          ) : (
            <>
              {/* DM thread header */}
              {activePartner && (
                <div style={{
                  padding: '0.75rem 1.2rem', borderBottom: '1px solid rgba(0,0,0,0.07)',
                  background: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <Avatar photo={activePartner.photo} size={34} isOnline={onlineUsers.has(activePartner.id)} />
                  <Link href={`/profile/${activePartner.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2e0a' }}>
                      {activePartner.name}
                    </div>
                    {onlineUsers.has(activePartner.id)
                      ? <div style={{ fontSize: 11, color: '#27ae60', fontWeight: 700 }}>● Online</div>
                      : <div style={{ fontSize: 11, color: '#4a7030', opacity: 0.6 }}>@{activePartner.nickname}</div>
                    }
                  </Link>
                </div>
              )}

              {/* Group thread header */}
              {activeGroup && (
                <div style={{
                  padding: '0.75rem 1.2rem', borderBottom: '1px solid rgba(0,0,0,0.07)',
                  background: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16,
                  }}>👥</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2e0a' }}>
                      {activeGroup.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#4a7030', opacity: 0.6 }}>
                      {activeGroup.members.length} members
                    </div>
                  </div>
                </div>
              )}

              {/* Messages area */}
              <div ref={scrollAreaRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem',
                display: 'flex', flexDirection: 'column', gap: 5 }}>
                {loadingMore && (
                  <p style={{ fontSize: 11, color: '#4a7030', fontStyle: 'italic',
                    alignSelf: 'center', margin: '0.25rem 0' }}>Loading…</p>
                )}
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
                  const isNew = newMsgIds.has(msg.id);
                  const showSenderLabel = activeGroup && !isMine && !!msg.senderName;
                  return (
                    <div key={msg.id}
                      className={isNew ? 'nearrish-new-msg' : ''}
                      style={{
                        display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start',
                    }}>
                      <div style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: isMine ? 'flex-end' : 'flex-start',
                        maxWidth: '68%',
                      }}>
                      {showSenderLabel && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          marginBottom: 2, paddingLeft: 4,
                        }}>
                          <Avatar photo={getGroupMemberPhoto(msg.senderId)} size={16} />
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: '#4a7030', opacity: 0.75,
                          }}>
                            {msg.senderName}
                          </span>
                        </div>
                      )}
                      <div style={{
                        width: '100%', padding: '0.5rem 0.85rem',
                        borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: msg.moderated ? 'rgba(240,240,240,0.85)' : isMine ? GREEN : 'rgba(255,255,255,0.92)',
                        color: msg.moderated ? '#999' : isMine ? '#fff' : '#1a2e0a',
                        fontSize: 13, lineHeight: 1.45,
                        fontStyle: msg.moderated ? 'italic' : 'normal',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.09)',
                      }}>
                        <p style={{ margin: 0, wordBreak: 'break-word' }}>{msg.content}</p>
                        <p style={{ margin: '3px 0 0', fontSize: 10, textAlign: 'right',
                          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3,
                          opacity: 0.55 }}>
                          <span>{fmtMsg(msg.createdAt)}</span>
                          {isMine && (
                            msg.readAt
                              ? <svg width="16" height="11" viewBox="0 0 16 11" fill="none" style={{ opacity: 1 }}>
                                  <path d="M1 5.5L4.5 9L11 1" stroke="#34B7F1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M5 5.5L8.5 9L15 1" stroke="#34B7F1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              : <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ opacity: 0.7 }}>
                                  <path d="M1 5.5L4.5 9L10 1" stroke={isMine ? '#fff' : '#888'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                          )}
                        </p>
                      </div>
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
                  <Avatar photo={user.avatar} size={36} isOnline={onlineUsers.has(user.userId)} />
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

      {/* Group creation modal */}
      {showGroupModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div style={{
            background: '#e6f7d8', borderRadius: 20, padding: '1.5rem',
            width: '100%', maxWidth: 360, maxHeight: '80vh',
            display: 'flex', flexDirection: 'column', gap: '0.85rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1a2e0a' }}>
                NEW GROUP
              </h3>
              <button onClick={() => setShowGroupModal(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 20, color: '#4a7030', lineHeight: 1,
              }}>×</button>
            </div>

            {/* Group name */}
            <input
              placeholder="Group name…"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              autoFocus
              style={{
                padding: '0.55rem 0.85rem', borderRadius: 14, border: 'none',
                background: 'rgba(255,255,255,0.75)', fontSize: 13, color: '#1a2e0a',
                outline: 'none', fontFamily: 'inherit',
              }}
            />

            {/* Member search */}
            <input
              placeholder="Search users…"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              style={{
                padding: '0.55rem 0.85rem', borderRadius: 14, border: 'none',
                background: 'rgba(255,255,255,0.75)', fontSize: 13, color: '#1a2e0a',
                outline: 'none', fontFamily: 'inherit',
              }}
            />

            {/* User list with checkboxes */}
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {usersLoading && (
                <p style={{ fontSize: 12, color: '#4a7030', fontStyle: 'italic' }}>Loading users…</p>
              )}
              {!usersLoading && filteredUsers.length === 0 && (
                <p style={{ fontSize: 12, color: '#4a7030', opacity: 0.6 }}>No users found.</p>
              )}
              {filteredUsers.map(user => (
                <label key={user.userId} style={{
                  display: 'flex', gap: 10, alignItems: 'center',
                  padding: '0.6rem 0.75rem', borderRadius: 12,
                  cursor: 'pointer',
                  background: selectedMembers.has(user.userId)
                    ? 'rgba(26,92,42,0.12)'
                    : 'rgba(255,255,255,0.55)',
                  transition: 'background 0.1s',
                }}>
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(user.userId)}
                    onChange={() => {
                      setSelectedMembers(prev => {
                        const next = new Set(prev);
                        next.has(user.userId) ? next.delete(user.userId) : next.add(user.userId);
                        return next;
                      });
                    }}
                    style={{ accentColor: GREEN, width: 15, height: 15, flexShrink: 0 }}
                  />
                  <Avatar photo={user.avatar} size={32} isOnline={onlineUsers.has(user.userId)} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2e0a' }}>{user.name}</div>
                    <div style={{ fontSize: 11, color: '#4a7030', opacity: 0.65 }}>@{user.nickname}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Create button */}
            <button
              disabled={!groupName.trim() || selectedMembers.size === 0}
              onClick={() => handleCreateGroup()}
              style={{
                padding: '0.65rem', borderRadius: 14, border: 'none',
                background: GREEN, color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: !groupName.trim() || selectedMembers.size === 0 ? 'not-allowed' : 'pointer',
                opacity: !groupName.trim() || selectedMembers.size === 0 ? 0.45 : 1,
                transition: 'opacity 0.12s', fontFamily: 'inherit',
              }}>
              Create group ({selectedMembers.size} selected)
            </button>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: '#1a2e0a', color: '#fff', padding: '0.7rem 1.3rem',
          borderRadius: 14, fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
          zIndex: 1100, maxWidth: 360, textAlign: 'center',
          animation: 'toastIn 0.3s ease-out',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
