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
import { DS } from '../lib/tokens';

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
  senderName?: string;
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

const GREEN     = DS.secondary;
const PALE      = DS.bg;
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
              <circle cx="50" cy="36" r="22" fill={DS.earth} />
              <path d="M8 95 Q8 63 50 63 Q92 63 92 95 Z" fill={DS.earth} />
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

  // Mobile layout
  const [isMobile,    setIsMobile]    = useState(false);
  const [mobileView,  setMobileView]  = useState<'sidebar' | 'chat'>('sidebar');

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Left sidebar state
  const [conversations,      setConversations]      = useState<Conversation[]>([]);
  const [groupConversations, setGroupConversations] = useState<GroupConversation[]>([]);
  const [sidebarTab,         setSidebarTab]         = useState<'dms' | 'groups'>('dms');
  const [pendingReqs,        setPendingReqs]        = useState<PendingRequest[]>([]);
  const [showRequests,       setShowRequests]       = useState(false);
  const [reqBusy,            setReqBusy]            = useState<string | null>(null);
  const [convLoading,        setConvLoading]        = useState(true);

  // Right panel state
  const [activePartner,    setActivePartner]    = useState<Partner | null>(null);
  const [activeGroup,      setActiveGroup]      = useState<GroupConversation | null>(null);
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [draftGroupName,   setDraftGroupName]   = useState('');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [messages,         setMessages]         = useState<Message[]>([]);
  const [threadLoading,    setThreadLoading]    = useState(false);
  const [newMsg,           setNewMsg]           = useState('');
  const [sending,          setSending]          = useState(false);
  const [blockedIds,       setBlockedIds]       = useState<Set<string>>(new Set());
  const [blockedByPartnerIds, setBlockedByPartnerIds] = useState<Set<string>>(new Set());

  // Group creation modal
  const [showGroupModal,   setShowGroupModal]   = useState(false);
  const [groupName,        setGroupName]        = useState('');
  const [selectedMembers,  setSelectedMembers]  = useState<Set<string>>(new Set());

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
          groupList.push({
            id: conv.id,
            name: conv.name ?? 'Group',
            members: conv.participants.map(p => ({
              id: p.id, name: p.username,
              photo: p.avatarUrl ? `${API_BASE}${p.avatarUrl}` : null,
            })),
            lastMessage,
            unread: conv.unreadCount ?? 0,
          });
        } else {
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
      apiFetch<{ id: string }[]>('/api/blocks').then(list => {
        setBlockedIds(new Set(list.map(b => b.id)));
      }).catch(() => {});
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
        readAt: m.read ? m.createdAt : null,
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
          : c
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

  // Broadcast active conversation ID so Navbar/BottomNav can skip badge increment when user is reading
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('conv:active', { detail: activeConvId ?? '' }));
  }, [activeConvId]);

  // WebSocket: refresh thread and sidebar on incoming chat/friend events
  useEffect(() => {
    const unsubChat = subscribe('chat', (payload) => {
      const msgId = (payload as { messageId?: string }).messageId ?? '';

      if (msgId.startsWith('READ:')) {
        // Mark messages as read visually only if the READ is for the active conversation
        const readConvId = msgId.substring(5);
        if (readConvId === activeConvId) {
          setMessages(prev => prev.map(m => ({ ...m, readAt: m.readAt || new Date().toISOString() })));
        }
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

      // Actual new message — payload format: "convId:msgId"
      const colonIdx = msgId.indexOf(':');
      const incomingConvId = colonIdx > 0 ? msgId.substring(0, colonIdx) : null;

      if (incomingConvId && incomingConvId === activeConvId) {
        // Message is for the currently viewed conversation → reload thread silently
        // loadThread/loadGroupThread will mark as read + dispatch messagesRead
        if (activePartner) loadThread(activePartner.id, true);
        else if (activeGroup) loadGroupThread(activeGroup.id, true);
      } else {
        // Message is for a different conversation (or old format) → refresh sidebar
        loadConversations();
      }
    });
    const unsubFriends = subscribe('friends', () => {
      loadRequests();
    });
    return () => { unsubChat(); unsubFriends(); };
  }, [subscribe, activePartner, activeGroup, activeConvId, loadThread, loadGroupThread, loadConversations, loadRequests]);

  // Fallback polling when WebSocket is not connected
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if ((!activePartner && !activeGroup) || wsConnected) return;
    pollRef.current = setInterval(() => {
      if (activePartner) loadThread(activePartner.id, true);
      else if (activeGroup) loadGroupThread(activeGroup.id, true);
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activePartner, activeGroup, loadThread, loadGroupThread, wsConnected]);

  // Poll conversations when no active conv and WS is down — ensures sidebar badges stay current
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
    if (!area || (!activePartner && !activeGroup)) return;
    const onScroll = () => {
      if (area.scrollTop < 80 && hasMore && !loadingMore) loadMoreMessages();
    };
    area.addEventListener('scroll', onScroll);
    return () => area.removeEventListener('scroll', onScroll);
  }, [activePartner, activeGroup, hasMore, loadingMore, loadMoreMessages]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  function openConversation(partner: Partner) {
    setActivePartner(partner);
    setActiveGroup(null);
    setMessages([]);
    setHasMore(false);
    setActiveConvId(null);
    setBlockedByPartnerIds(prev => { const s = new Set(prev); s.delete(partner.id); return s; });
    loadThread(partner.id);
    setShowNewModal(false);
    setMobileView('chat');
  }

  function openGroupConversation(group: GroupConversation) {
    setActiveGroup(group);
    setActivePartner(null);
    setShowGroupMembers(false);
    setEditingGroupName(false);
    setMessages([]);
    setHasMore(false);
    setActiveConvId(null);
    loadGroupThread(group.id);
    setMobileView('chat');
  }

  function getGroupMemberPhoto(memberId: string): string | null {
    return activeGroup?.members.find(m => m.id === memberId)?.photo ?? null;
  }

  async function handleCreateGroup() {
    if (!groupName.trim() || selectedMembers.size < 2) return;
    try {
      const params = new URLSearchParams({ name: groupName.trim() });
      Array.from(selectedMembers).forEach(id => params.append('memberIds', id));
      const conv = await apiFetch<BackendConversation>(`/api/chat/conversations/group?${params}`, {
        method: 'POST',
      });
      setShowGroupModal(false);
      setGroupName('');
      setSelectedMembers(new Set());
      const newGroup: GroupConversation = {
        id: conv.id,
        name: conv.name ?? groupName.trim(),
        members: conv.participants.map(p => ({
          id: p.id, name: p.username,
          photo: p.avatarUrl ? `${API_BASE}${p.avatarUrl}` : null,
        })),
        lastMessage: { content: '', createdAt: conv.createdAt, senderId: '' },
        unread: 0,
      };
      setGroupConversations(prev => [newGroup, ...prev]);
      openGroupConversation(newGroup);
    } catch (err) {
      console.error('[MESSAGES] Failed to create group:', err);
      showToast(err instanceof Error ? err.message : 'Failed to create group.');
    }
  }

  async function handleLeaveGroup() {
    if (!activeGroup) return;
    try {
      await apiFetch(`/api/chat/conversations/${activeGroup.id}/leave`, { method: 'POST' });
      setActiveGroup(null);
      setMessages([]);
      setGroupConversations(prev => prev.filter(g => g.id !== activeGroup.id));
    } catch (err) {
      console.error('[MESSAGES] Failed to leave group:', err);
      showToast(err instanceof Error ? err.message : 'Failed to leave group.');
    }
  }

  async function handleRenameGroup() {
    if (!activeGroup || !draftGroupName.trim()) return;
    try {
      await apiFetch(`/api/chat/conversations/${activeGroup.id}/name?name=${encodeURIComponent(draftGroupName.trim())}`, {
        method: 'PUT',
      });
      const newName = draftGroupName.trim();
      setActiveGroup(prev => prev ? { ...prev, name: newName } : null);
      setGroupConversations(prev => prev.map(g =>
        g.id === activeGroup.id ? { ...g, name: newName } : g
      ));
      setEditingGroupName(false);
    } catch (err) {
      console.error('[MESSAGES] Failed to rename group:', err);
      showToast(err instanceof Error ? err.message : 'Failed to rename group.');
    }
  }

  async function handleAddGroupMember(userId: string) {
    if (!activeGroup) return;
    try {
      await apiFetch(`/api/chat/conversations/${activeGroup.id}/members/${userId}`, {
        method: 'POST',
      });
      const user = allUsers.find(u => u.userId === userId);
      if (user) {
        setActiveGroup(prev => prev ? {
          ...prev,
          members: [...prev.members, { id: userId, name: user.name, photo: user.avatar }],
        } : null);
      }
      setShowAddMemberModal(false);
      showToast('Member added!');
    } catch (err) {
      console.error('[MESSAGES] Failed to add member:', err);
      showToast(err instanceof Error ? err.message : 'Failed to add member.');
    }
  }

  async function handleUnblockPartner(userId: string) {
    try {
      await apiFetch(`/api/blocks/${userId}`, { method: 'DELETE' });
      setBlockedIds(prev => { const s = new Set(prev); s.delete(userId); return s; });
    } catch (err) {
      console.error('[MESSAGES] Failed to unblock:', err);
      showToast(err instanceof Error ? err.message : 'Failed to unblock user.');
    }
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
      if (activePartner) await loadThread(activePartner.id);
      else if (activeGroup) await loadGroupThread(activeGroup.id);
    } catch (err) {
      console.error('[MESSAGES] Send failed, showing toast:', err);
      const msg = err instanceof Error ? err.message : 'Message could not be delivered.';
      if (activePartner && (msg.toLowerCase().includes('blocked') || msg.includes('403') || msg.includes('permission'))) {
        setBlockedByPartnerIds(prev => new Set(prev).add(activePartner.id));
      }
      showToast(msg);
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
    setUserSearch('');
    setUsersLoading(true);
    if (sidebarTab === 'groups') {
      setGroupName('');
      setSelectedMembers(new Set());
      setShowGroupModal(true);
    } else {
      setShowNewModal(true);
    }
    try {
      const users = await apiFetch<BackendUser[]>('/api/public/users');
      setAllUsers(users
        .filter(u => u.id !== currentUserId)
        .map(u => ({
          userId: u.id, name: u.username, nickname: u.username, avatar: u.avatarUrl ? `${API_BASE}${u.avatarUrl}` : null,
        })));
    } catch (err) {
      console.error('[MESSAGES] Failed to load users:', err);
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
          background: 'rgba(255,255,255,0.4)', borderRadius: 0, maxWidth: 360,
          border: '2px solid #1A1A1A' }}>
          <p style={{ color: GREEN, fontWeight: 700, fontSize: 15, margin: '0 0 0.4rem' }}>
            Sign in to use Messages.
          </p>
          <p style={{ color: DS.tertiary, fontSize: 12, margin: 0, opacity: 0.7 }}>
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
    <div style={{
      height: '100vh', overflow: 'hidden', background: PALE,
      display: 'flex', flexDirection: 'column',
      padding: isMobile ? '72px 0 0' : '96px 60px 20px',
    }}>

      {/* Main container */}
      <div style={{
        display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden',
        ...(isMobile ? {
          margin: '24px 16px 4rem',
          border: '2px solid #1A1A1A', boxShadow: '4px 4px 0px 0px #1B2F23',
        } : {
          maxWidth: 960, width: '100%', margin: '0 auto 4rem',
          border: '2px solid #1A1A1A', boxShadow: '4px 4px 0px 0px #1B2F23',
        }),
      }}>

        {/* ══════════ LEFT SIDEBAR ══════════ */}
        {(!isMobile || mobileView === 'sidebar') && <div style={{
          width: isMobile ? '100%' : 290,
          flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: 'rgba(255,255,255,0.55)', borderRight: isMobile ? 'none' : '2px solid #1A1A1A',
        }}>

          {/* Header */}
          <div style={{ padding: '1rem 1rem 0.8rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '2px solid #1A1A1A' }}>
            <h1 style={H1_STYLE}>MESSAGES</h1>
            <button onClick={openNewModal} style={{
              width: 30, height: 30, borderRadius: '50%', border: '2px solid #1A1A1A',
              background: GREEN, color: DS.primary, fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              boxShadow: '4px 4px 0px 0px #1B2F23',
            }}>+</button>
          </div>

          {/* Friend requests accordion */}
          {pendingReqs.length > 0 && (
            <div style={{ borderBottom: '2px solid #1A1A1A' }}>
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
                  minWidth: 20, height: 20, borderRadius: 0, background: '#c0392b',
                  color: '#fff', fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                }}>{pendingReqs.length}</span>
              </button>

              {showRequests && pendingReqs.map(({ fromUser: u, createdAt }) => (
                <div key={u.id} style={{
                  padding: '0.6rem 1rem', display: 'flex', gap: 8, alignItems: 'center',
                  borderTop: '2px solid #1A1A1A',
                  background: 'rgba(255,255,255,0.45)',
                }}>
                  <Avatar photo={u.photo} size={32} isOnline={onlineUsers.has(u.id)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: DS.secondary,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.name}
                    </div>
                    <div style={{ fontSize: 10, color: DS.tertiary, opacity: 0.55 }}>
                      {new Date(createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button disabled={reqBusy === u.id} onClick={() => handleAccept(u.id)} style={{
                      padding: '0.2rem 0.55rem', borderRadius: 0, border: '2px solid #1A1A1A',
                      background: '#27ae60', color: '#fff',
                      fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                      opacity: reqBusy === u.id ? 0.5 : 1,
                    }}>✓</button>
                    <button disabled={reqBusy === u.id} onClick={() => handleDecline(u.id)} style={{
                      padding: '0.2rem 0.55rem', borderRadius: 0, border: '2px solid #1A1A1A',
                      background: '#c0392b', color: '#fff',
                      fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                      opacity: reqBusy === u.id ? 0.5 : 1,
                    }}>✗</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* DMs / Groups tabs */}
          {(() => {
            const totalDmUnread = conversations.reduce((s, c) => s + (c.unread || 0), 0);
            const totalGroupUnread = groupConversations.reduce((s, g) => s + (g.unread || 0), 0);
            const badgeStyle: React.CSSProperties = {
              minWidth: 16, height: 16, borderRadius: 8,
              background: '#c0392b', color: '#fff',
              fontSize: 9, fontWeight: 800,
              display: 'inline-flex', alignItems: 'center',
              justifyContent: 'center', padding: '0 4px',
              marginLeft: 5, lineHeight: 1,
            };
            return (
              <div style={{ display: 'flex', borderBottom: '2px solid #1A1A1A' }}>
                <button onClick={() => setSidebarTab('dms')} style={{
                  flex: 1, padding: '0.5rem', border: 'none', borderRight: '1px solid #1A1A1A',
                  background: sidebarTab === 'dms' ? GREEN : 'transparent',
                  color: sidebarTab === 'dms' ? DS.primary : DS.secondary,
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  letterSpacing: '0.06em', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  DMs
                  {totalDmUnread > 0 && <span style={badgeStyle}>{totalDmUnread > 99 ? '99+' : totalDmUnread}</span>}
                </button>
                <button onClick={() => setSidebarTab('groups')} style={{
                  flex: 1, padding: '0.5rem', border: 'none',
                  background: sidebarTab === 'groups' ? GREEN : 'transparent',
                  color: sidebarTab === 'groups' ? DS.primary : DS.secondary,
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  letterSpacing: '0.06em', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  Groups
                  {totalGroupUnread > 0 && <span style={badgeStyle}>{totalGroupUnread > 99 ? '99+' : totalGroupUnread}</span>}
                </button>
              </div>
            );
          })()}

          {/* Conversations */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {sidebarTab === 'dms' ? (
              <>
                {convLoading && (
                  <p style={{ padding: '1rem', fontSize: 12, color: DS.tertiary, fontStyle: 'italic' }}>
                    Loading…
                  </p>
                )}
                {!convLoading && conversations.length === 0 && (
                  <p style={{ padding: '1rem', fontSize: 12, color: DS.tertiary, opacity: 0.6 }}>
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
                        cursor: 'pointer', borderBottom: '2px solid #1A1A1A',
                        background: isActive ? 'rgba(27,47,35,0.1)' : 'transparent',
                        transition: 'background 0.12s',
                      }}>
                      <Avatar photo={conv.partner.photo} size={38} isOnline={onlineUsers.has(conv.partner.id)} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: DS.secondary,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {conv.partner.nickname}
                          </span>
                          <span style={{ fontSize: 10, color: DS.tertiary, opacity: 0.5,
                            flexShrink: 0, marginLeft: 4 }}>
                            {fmtMsg(conv.lastMessage.createdAt)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: DS.tertiary, opacity: 0.65,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {conv.lastMessage.senderId === currentUserId ? 'You: ' : ''}
                            {conv.lastMessage.content}
                          </span>
                          {conv.unread > 0 && (
                            <span style={{
                              minWidth: 18, height: 18, borderRadius: 0, background: GREEN, color: DS.primary,
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
              </>
            ) : (
              <>
                {convLoading && (
                  <p style={{ padding: '1rem', fontSize: 12, color: DS.tertiary, fontStyle: 'italic' }}>
                    Loading…
                  </p>
                )}
                {!convLoading && groupConversations.length === 0 && (
                  <p style={{ padding: '1rem', fontSize: 12, color: DS.tertiary, opacity: 0.6 }}>
                    No groups yet — press + to create one.
                  </p>
                )}
                {groupConversations.map(grp => {
                  const isActive = activeGroup?.id === grp.id;
                  return (
                    <div key={grp.id}
                      onClick={() => openGroupConversation(grp)}
                      style={{
                        padding: '0.7rem 1rem', display: 'flex', gap: 10, alignItems: 'center',
                        cursor: 'pointer', borderBottom: '2px solid #1A1A1A',
                        background: isActive ? 'rgba(27,47,35,0.1)' : 'transparent',
                        transition: 'background 0.12s',
                      }}>
                      {/* Stacked member avatars */}
                      <div style={{ width: 38, height: 38, position: 'relative', flexShrink: 0 }}>
                        {grp.members.slice(0, 2).map((m, idx) => (
                          <div key={m.id} style={{
                            position: 'absolute',
                            top: idx === 0 ? 0 : 'auto', bottom: idx === 1 ? 0 : 'auto',
                            left: idx === 0 ? 0 : 'auto', right: idx === 1 ? 0 : 'auto',
                            width: 26, height: 26, borderRadius: '50%',
                            border: '2px solid #fff', overflow: 'hidden',
                            background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {m.photo
                              ? <img src={m.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span style={{ color: DS.earth, fontSize: 10, fontWeight: 700 }}>{m.name[0]?.toUpperCase()}</span>
                            }
                          </div>
                        ))}
                        {grp.members.length > 2 && (
                          <div style={{
                            position: 'absolute', bottom: 0, right: -2,
                            width: 14, height: 14, borderRadius: '50%',
                            background: DS.tertiary, color: DS.earth, fontSize: 7, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid #fff',
                          }}>+{grp.members.length - 2}</div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: DS.secondary,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {grp.name}
                          </span>
                          <span style={{ fontSize: 10, color: DS.tertiary, opacity: 0.5,
                            flexShrink: 0, marginLeft: 4 }}>
                            {fmtMsg(grp.lastMessage.createdAt)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: DS.tertiary, opacity: 0.65 }}>
                            {grp.members.length} members
                          </span>
                          {grp.unread > 0 && (
                            <span style={{
                              minWidth: 18, height: 18, borderRadius: 0, background: GREEN, color: DS.primary,
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
              </>
            )}
          </div>
        </div>}{/* end sidebar */}

        {/* ══════════ RIGHT PANEL ══════════ */}
        {(!isMobile || mobileView === 'chat') && <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column', minWidth: 0,
          background: 'rgba(255,255,255,0.2)',
        }}>

          {!activePartner && !activeGroup ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: DS.tertiary, fontSize: 14, opacity: 0.5, margin: 0 }}>
                Select a conversation or press + to start one.
              </p>
            </div>
          ) : (
            <>
              {/* Thread header — DM */}
              {activePartner && (
                <div style={{
                  padding: '0.75rem 1.2rem', borderBottom: '2px solid #1A1A1A',
                  background: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  {isMobile && (
                    <button onClick={() => setMobileView('sidebar')} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 22, color: DS.secondary, padding: '0 4px 0 0', lineHeight: 1, flexShrink: 0,
                    }}>‹</button>
                  )}
                  <Avatar photo={activePartner.photo} size={34} isOnline={onlineUsers.has(activePartner.id)} />
                  <Link href={`/profile/${activePartner.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: DS.secondary }}>
                      {activePartner.name}
                    </div>
                    {onlineUsers.has(activePartner.id)
                      ? <div style={{ fontSize: 11, color: '#27ae60', fontWeight: 700 }}>● Online</div>
                      : <div style={{ fontSize: 11, color: DS.tertiary, opacity: 0.6 }}>@{activePartner.nickname}</div>
                    }
                  </Link>
                </div>
              )}

              {/* Thread header — Group */}
              {activeGroup && (
                <>
                  <div style={{
                    padding: '0.75rem 1.2rem', borderBottom: '2px solid #1A1A1A',
                    background: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    {isMobile && (
                      <button onClick={() => setMobileView('sidebar')} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 22, color: DS.secondary, padding: '0 4px 0 0', lineHeight: 1, flexShrink: 0,
                      }}>‹</button>
                    )}
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', background: GREEN,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                    }}>👥</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editingGroupName ? (
                        <input
                          autoFocus
                          value={draftGroupName}
                          onChange={e => setDraftGroupName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameGroup();
                            if (e.key === 'Escape') setEditingGroupName(false);
                          }}
                          style={{
                            fontSize: 14, fontWeight: 700, border: '2px solid #1A1A1A',
                            padding: '0.2rem 0.5rem', background: 'white', color: DS.secondary,
                            fontFamily: 'inherit', outline: 'none', width: '100%',
                          }}
                        />
                      ) : (
                        <div
                          style={{ fontSize: 14, fontWeight: 700, color: DS.secondary, cursor: 'pointer' }}
                          onClick={() => { setDraftGroupName(activeGroup.name); setEditingGroupName(true); }}
                        >
                          {activeGroup.name}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: DS.tertiary, opacity: 0.6 }}>
                        {activeGroup.members.length} members
                      </div>
                    </div>
                    <button onClick={() => setShowGroupMembers(v => !v)} style={{
                      padding: '0.3rem 0.6rem', borderRadius: 0, border: '2px solid #1A1A1A',
                      background: showGroupMembers ? GREEN : 'white',
                      color: showGroupMembers ? DS.primary : DS.secondary,
                      fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}>members</button>
                    <button onClick={handleLeaveGroup} style={{
                      padding: '0.3rem 0.6rem', borderRadius: 0, border: '2px solid #1A1A1A',
                      background: '#c0392b', color: '#fff',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}>Leave</button>
                  </div>

                  {/* Expandable members panel — horizontal scroll */}
                  {showGroupMembers && (
                    <div style={{
                      padding: '0.6rem 1rem', borderBottom: '2px solid #1A1A1A',
                      background: 'rgba(255,255,255,0.4)',
                      overflowX: 'auto', display: 'flex', gap: 16, alignItems: 'flex-start',
                      scrollbarWidth: 'none',
                    }}>
                      {activeGroup.members.map(member => (
                        <div key={member.id} style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0,
                        }}>
                          <Avatar photo={member.photo} size={38} isOnline={onlineUsers.has(member.id)} />
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: DS.tertiary,
                            maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap', textAlign: 'center',
                          }}>{member.name}</span>
                        </div>
                      ))}
                      <div
                        onClick={async () => {
                          setUsersLoading(true);
                          setUserSearch('');
                          setShowAddMemberModal(true);
                          try {
                            const users = await apiFetch<BackendUser[]>('/api/public/users');
                            setAllUsers(users.filter(u => u.id !== currentUserId).map(u => ({
                              userId: u.id, name: u.username, nickname: u.username,
                              avatar: u.avatarUrl ? `${API_BASE}${u.avatarUrl}` : null,
                            })));
                          } catch {}
                          setUsersLoading(false);
                        }}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: '50%', border: '2px dashed #1A1A1A',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                        }}>+</div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: DS.tertiary }}>Add</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Messages area */}
              <div ref={scrollAreaRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem',
                display: 'flex', flexDirection: 'column' }}>
                {loadingMore && (
                  <p style={{ fontSize: 11, color: DS.tertiary, fontStyle: 'italic',
                    alignSelf: 'center', margin: '0.25rem 0' }}>Loading…</p>
                )}
                {threadLoading && (
                  <p style={{ fontSize: 12, color: DS.tertiary, fontStyle: 'italic',
                    alignSelf: 'center', margin: '2rem 0' }}>Loading…</p>
                )}
                {!threadLoading && messages.length === 0 && (
                  <p style={{ fontSize: 12, color: DS.tertiary, opacity: 0.5,
                    alignSelf: 'center', margin: '3rem 0' }}>
                    No messages yet. Say hello!
                  </p>
                )}
                {messages.map((msg, i) => {
                  const isMine = msg.senderId === currentUserId;
                  const isNew = newMsgIds.has(msg.id);
                  const isGroup = !!activeGroup;
                  // Last message in a consecutive run from this sender
                  const isLastInRun = !isGroup || isMine
                    || i === messages.length - 1
                    || messages[i + 1].senderId !== msg.senderId;
                  return (
                    <div
                      key={msg.id}
                      className={isNew ? 'nearrish-new-msg' : ''}
                      style={{ marginBottom: isLastInRun ? (isGroup && !isMine ? 10 : 6) : 2 }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: isMine ? 'flex-end' : 'flex-start',
                        alignItems: 'flex-end',
                        gap: 6,
                      }}>
                        {/* Avatar — left, anchored to last bubble of each run */}
                        {isGroup && !isMine && (
                          isLastInRun
                            ? <Avatar photo={getGroupMemberPhoto(msg.senderId)} size={26} />
                            : <div style={{ width: 26, flexShrink: 0 }} />
                        )}

                        <div style={{
                          display: 'flex', flexDirection: 'column',
                          maxWidth: '68%',
                          alignItems: isMine ? 'flex-end' : 'flex-start',
                        }}>
                          <div style={{
                            padding: '0.5rem 0.85rem',
                            borderRadius: 0,
                            background: msg.moderated ? 'rgba(240,240,240,0.85)' : isMine ? GREEN : DS.primary,
                            color: msg.moderated ? '#999' : isMine ? DS.primary : DS.secondary,
                            fontSize: 13, lineHeight: 1.45,
                            fontStyle: msg.moderated ? 'italic' : 'normal',
                            border: '2px solid #1A1A1A',
                            boxShadow: '4px 4px 0px 0px #1B2F23',
                          }}>
                            <p style={{ margin: 0, wordBreak: 'break-word' }}>
                              {msg.moderated
                                ? <><span style={{ fontStyle: 'normal' }}>🚫</span>{msg.content.slice(1)}</>
                                : msg.content}
                            </p>
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
                                      <path d="M1 5.5L4.5 9L10 1" stroke={isMine ? DS.primary : '#888'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                              )}
                            </p>
                          </div>

                          {/* Sender name — below the last bubble of each run */}
                          {isGroup && !isMine && isLastInRun && msg.senderName && (
                            <span style={{
                              fontSize: 9, fontWeight: 700,
                              color: DS.tertiary, opacity: 0.65,
                              marginTop: 3, paddingLeft: 1,
                            }}>
                              {msg.senderName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Send input — or blocked notice */}
              {activePartner && blockedIds.has(activePartner.id) ? (
                <div style={{
                  padding: '0.7rem 1rem', borderTop: '2px solid #1A1A1A',
                  background: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 12, color: DS.tertiary, flex: 1 }}>
                    You have blocked this user. You cannot send messages.
                  </span>
                  <button onClick={() => handleUnblockPartner(activePartner.id)} style={{
                    padding: '0.5rem 1rem', borderRadius: 0, border: '2px solid #1A1A1A',
                    background: '#c0392b', color: '#fff', fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>UNBLOCK</button>
                </div>
              ) : activePartner && blockedByPartnerIds.has(activePartner.id) ? (
                <div style={{
                  padding: '0.7rem 1rem', borderTop: '2px solid #1A1A1A',
                  background: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 12, color: DS.tertiary, flex: 1 }}>
                    You cannot send messages to this user.
                  </span>
                </div>
              ) : (
                <form onSubmit={handleSend} style={{
                  padding: '0.7rem 1rem', borderTop: '2px solid #1A1A1A',
                  background: 'rgba(255,255,255,0.55)', display: 'flex', gap: 8,
                }}>
                  <input
                    id="message-input"
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    placeholder="Write a message…"
                    style={{
                      flex: 1, padding: '0.6rem 0.9rem', borderRadius: 0,
                      border: '2px solid #1A1A1A',
                      background: 'rgba(255,255,255,0.85)', fontSize: 13,
                      color: DS.secondary, outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                  <button type="submit" disabled={!newMsg.trim() || sending} style={{
                    padding: '0.6rem 1.15rem', borderRadius: 0, border: '2px solid #1A1A1A',
                    background: GREEN, color: DS.primary, fontSize: 16, fontWeight: 700,
                    cursor: !newMsg.trim() || sending ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    opacity: !newMsg.trim() || sending ? 0.4 : 1, transition: 'opacity 0.12s',
                  }}>→</button>
                </form>
              )}
            </>
          )}
        </div>}{/* end right panel */}
      </div>{/* end main container */}

      {/* ══════════ NEW CONVERSATION MODAL ══════════ */}
      {showNewModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div style={{
            background: DS.bg, borderRadius: 0, padding: '1.5rem',
            width: '100%', maxWidth: 360, maxHeight: '72vh',
            display: 'flex', flexDirection: 'column', gap: '0.85rem',
            border: '2px solid #1A1A1A', boxShadow: '4px 4px 0px 0px #1B2F23',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: DS.secondary }}>
                NEW CONVERSATION
              </h3>
              <button onClick={() => setShowNewModal(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 20, color: DS.tertiary, lineHeight: 1,
              }}>×</button>
            </div>

            <input
              id="new-conv-search"
              placeholder="Search by name or nickname…"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              autoFocus
              style={{
                padding: '0.55rem 0.85rem', borderRadius: 0, border: '2px solid #1A1A1A',
                background: 'rgba(255,255,255,0.75)', fontSize: 13, color: DS.secondary,
                outline: 'none', fontFamily: 'inherit',
              }}
            />

            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {usersLoading && (
                <p style={{ fontSize: 12, color: DS.tertiary, fontStyle: 'italic' }}>Loading users…</p>
              )}
              {!usersLoading && filteredUsers.length === 0 && (
                <p style={{ fontSize: 12, color: DS.tertiary, opacity: 0.6 }}>No friends found. Add friends first!</p>
              )}
              {filteredUsers.map(user => (
                <div key={user.userId}
                  onClick={() => openConversation({
                    id: user.userId, name: user.name,
                    nickname: user.nickname, photo: user.avatar,
                  })}
                  style={{
                    display: 'flex', gap: 10, alignItems: 'center',
                    padding: '0.6rem 0.75rem', borderRadius: 0,
                    cursor: 'pointer', background: 'rgba(255,255,255,0.55)',
                    border: '2px solid #1A1A1A',
                    transition: 'background 0.1s',
                  }}>
                  <Avatar photo={user.avatar} size={36} isOnline={onlineUsers.has(user.userId)} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: DS.secondary }}>{user.name}</div>
                    <div style={{ fontSize: 11, color: DS.tertiary, opacity: 0.65 }}>@{user.nickname}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ GROUP CREATION MODAL ══════════ */}
      {showGroupModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div style={{
            background: DS.bg, borderRadius: 0, padding: '1.5rem',
            width: '100%', maxWidth: 380, maxHeight: '80vh',
            display: 'flex', flexDirection: 'column', gap: '0.85rem',
            border: '2px solid #1A1A1A', boxShadow: '4px 4px 0px 0px #1B2F23',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: DS.secondary }}>NEW GROUP</h3>
              <button onClick={() => setShowGroupModal(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: DS.tertiary,
              }}>×</button>
            </div>
            <input
              placeholder="Group name…"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              autoFocus
              style={{
                padding: '0.55rem 0.85rem', borderRadius: 0, border: '2px solid #1A1A1A',
                background: 'rgba(255,255,255,0.75)', fontSize: 13, color: DS.secondary,
                outline: 'none', fontFamily: 'inherit',
              }}
            />
            <input
              placeholder="Search members…"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              style={{
                padding: '0.55rem 0.85rem', borderRadius: 0, border: '2px solid #1A1A1A',
                background: 'rgba(255,255,255,0.75)', fontSize: 13, color: DS.secondary,
                outline: 'none', fontFamily: 'inherit',
              }}
            />
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {usersLoading && (
                <p style={{ fontSize: 12, color: DS.tertiary, fontStyle: 'italic' }}>Loading…</p>
              )}
              {filteredUsers.map(u => (
                <label key={u.userId} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '0.55rem 0.75rem', cursor: 'pointer', border: '2px solid #1A1A1A',
                  background: selectedMembers.has(u.userId) ? 'rgba(27,47,35,0.1)' : 'rgba(255,255,255,0.55)',
                }}>
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(u.userId)}
                    onChange={e => {
                      setSelectedMembers(prev => {
                        const s = new Set(prev);
                        if (e.target.checked) s.add(u.userId); else s.delete(u.userId);
                        return s;
                      });
                    }}
                  />
                  <Avatar photo={u.avatar} size={28} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: DS.secondary }}>{u.name}</span>
                </label>
              ))}
            </div>
            {selectedMembers.size < 2 && (
              <p style={{ fontSize: 11, color: DS.tertiary, margin: 0, opacity: 0.7 }}>
                Select at least 2 members.
              </p>
            )}
            <button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || selectedMembers.size < 2}
              style={{
                padding: '0.6rem', borderRadius: 0, border: '2px solid #1A1A1A',
                background: GREEN, color: DS.primary, fontSize: 13, fontWeight: 800,
                cursor: !groupName.trim() || selectedMembers.size < 2 ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: !groupName.trim() || selectedMembers.size < 2 ? 0.5 : 1,
              }}>
              CREATE GROUP
            </button>
          </div>
        </div>
      )}

      {/* ══════════ ADD MEMBER MODAL ══════════ */}
      {showAddMemberModal && activeGroup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div style={{
            background: DS.bg, borderRadius: 0, padding: '1.5rem',
            width: '100%', maxWidth: 360, maxHeight: '72vh',
            display: 'flex', flexDirection: 'column', gap: '0.85rem',
            border: '2px solid #1A1A1A', boxShadow: '4px 4px 0px 0px #1B2F23',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: DS.secondary }}>ADD MEMBER</h3>
              <button onClick={() => setShowAddMemberModal(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: DS.tertiary,
              }}>×</button>
            </div>
            <input
              placeholder="Search users…"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              autoFocus
              style={{
                padding: '0.55rem 0.85rem', borderRadius: 0, border: '2px solid #1A1A1A',
                background: 'rgba(255,255,255,0.75)', fontSize: 13, color: DS.secondary,
                outline: 'none', fontFamily: 'inherit',
              }}
            />
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {usersLoading && (
                <p style={{ fontSize: 12, color: DS.tertiary, fontStyle: 'italic' }}>Loading…</p>
              )}
              {filteredUsers
                .filter(u => !activeGroup.members.some(m => m.id === u.userId))
                .map(u => (
                  <div key={u.userId}
                    onClick={() => handleAddGroupMember(u.userId)}
                    style={{
                      display: 'flex', gap: 10, alignItems: 'center',
                      padding: '0.6rem 0.75rem', cursor: 'pointer', border: '2px solid #1A1A1A',
                      background: 'rgba(255,255,255,0.55)',
                    }}>
                    <Avatar photo={u.avatar} size={32} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: DS.secondary }}>{u.name}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: DS.secondary, color: DS.primary, padding: '0.7rem 1.3rem',
          borderRadius: 0, fontSize: 13, fontWeight: 600,
          border: '2px solid #1A1A1A', boxShadow: '4px 4px 0px 0px #1B2F23',
          zIndex: 1100, maxWidth: 360, textAlign: 'center',
          animation: 'toastIn 0.3s ease-out',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
