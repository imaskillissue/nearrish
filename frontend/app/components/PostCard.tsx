'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch, API_BASE } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useWs } from '../lib/ws-context';

type Post = {
  id: string;
  text: string;
  authorId: string;
  timestamp: number;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  visibility?: 'PUBLIC' | 'FRIENDS_ONLY';
  moderated?: boolean;
  moderationReason?: string | null;
  // Enriched fields from the backend (present on all authenticated/enriched responses)
  author?: { id: string; username: string; avatarUrl?: string | null };
  likeCount?: number;
  commentCount?: number;
  userLiked?: boolean;
};

// Simple in-memory cache for reverse geocoding results
const locationNameCache: Record<string, string> = {};

type BackendComment = {
  id: string;
  content: string;
  createdAt: number;
  moderated?: boolean;
  moderationReason?: string | null;
  likeCount?: number;
  author: { id: string; username: string; avatarUrl?: string | null };
};

type PostCardProps = {
  post: Post;
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  padding: '16px 20px',
  marginBottom: 14,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10,
};

const authorStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 15,
  color: '#1a5c2a',
};

const timeStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#888',
};

const textStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.5,
  color: '#222',
  marginBottom: 10,
};

const imgStyle: React.CSSProperties = {
  width: '100%',
  maxHeight: 400,
  objectFit: 'cover',
  borderRadius: 10,
  marginBottom: 10,
};

const locationStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#4a7030',
  marginBottom: 6,
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function AvatarCircle({ name, avatarUrl, size = 28 }: { name: string; avatarUrl?: string | null; size?: number }) {
  if (avatarUrl) {
    return (
      <img
        src={`${API_BASE}${avatarUrl}`}
        alt={name}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
        }}
      />
    );
  }
  const letter = name ? name[0].toUpperCase() : '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#2e7d32', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.42, flexShrink: 0,
    }}>
      {letter}
    </div>
  );
}

export default function PostCard({ post }: PostCardProps) {
  const { user } = useAuth();
  const { subscribe } = useWs();
  const [authorName, setAuthorName]       = useState(post.author?.username ?? '');
  const [authorAvatar, setAuthorAvatar]   = useState<string | null>(post.author?.avatarUrl ?? null);

  // ── Moderation state ───────────────────────────────────────────────────────
  const [isModerated, setIsModerated]         = useState(post.moderated ?? false);
  const [moderationReason, setModerationReason] = useState(post.moderationReason ?? null);

  // ── Likes ──────────────────────────────────────────────────────────────────
  const [likeCount,   setLikeCount]     = useState(post.likeCount ?? 0);
  const [liked,       setLiked]         = useState(post.userLiked ?? false);
  const [likeLoading, setLikeLoading]   = useState(false);

  // ── Comments ───────────────────────────────────────────────────────────────
  const [showComments,  setShowComments]  = useState(false);
  const [comments,      setComments]      = useState<BackendComment[]>([]);
  const [commentCount,  setCommentCount]  = useState<number | null>(post.commentCount ?? null);
  const [commentText,   setCommentText]   = useState('');
  const [commentBusy,   setCommentBusy]   = useState(false);
  const [commentError,  setCommentError]  = useState('');
  const commentsLoaded = useRef(false);

  // ── Comment likes (tracked per comment id) ─────────────────────────────────
  const [commentLikes, setCommentLikes]     = useState<Map<string, number>>(new Map());
  const [commentLiked, setCommentLiked]     = useState<Map<string, boolean>>(new Map());
  const [commentLikeBusy, setCommentLikeBusy] = useState<Set<string>>(new Set());

  // ── Location name (reverse geocoding) ─────────────────────────────────────
  const [locationName, setLocationName] = useState<string | null>(null);

  // ── WS: live updates for this post ────────────────────────────────────────
  const fetchNewComment = useCallback(async (commentId: string) => {
    try {
      const c = await apiFetch<BackendComment>(`/api/public/posts/${post.id}/comments/${commentId}`);
      setComments(prev => prev.some(x => x.id === commentId) ? prev : [...prev, c]);
      setCommentCount(n => (n ?? 0) + 1);
      setCommentLikes(prev => new Map(prev).set(commentId, 0));
      setCommentLiked(prev => new Map(prev).set(commentId, false));
    } catch { /* comment may already be visible */ }
  }, [post.id]);

  useEffect(() => {
    return subscribe('posts', (payload) => {
      const msg = (payload as { message: string }).message ?? '';

      if (msg.startsWith(`MODERATED_POST:${post.id}:`)) {
        const reason = msg.slice(`MODERATED_POST:${post.id}:`.length);
        setIsModerated(true);
        setModerationReason(reason);
        return;
      }
      if (msg.startsWith(`LIKE_POST:${post.id}:`)) {
        setLikeCount(parseInt(msg.split(':')[2]) || 0);
        return;
      }
      if (msg.startsWith(`NEW_COMMENT:${post.id}:`)) {
        const commentId = msg.split(':')[2];
        if (commentsLoaded.current) fetchNewComment(commentId);
        else setCommentCount(n => (n ?? 0) + 1);
        return;
      }
      if (msg.startsWith(`DELETED_COMMENT:${post.id}:`)) {
        const commentId = msg.split(':')[2];
        setComments(prev => prev.filter(c => c.id !== commentId));
        setCommentCount(n => Math.max(0, (n ?? 1) - 1));
        return;
      }
      if (msg.startsWith('MODERATED_COMMENT:')) {
        const parts = msg.split(':');
        const commentId = parts[1];
        const postIdFromMsg = parts[2];
        const reason = parts.slice(3).join(':');
        if (postIdFromMsg === post.id) {
          setComments(prev => prev.map(c =>
            c.id === commentId ? { ...c, moderationReason: reason, moderated: true } : c
          ));
        }
        return;
      }
      if (msg.startsWith('LIKE_COMMENT:')) {
        const parts = msg.split(':');
        const commentId = parts[1];
        const count = parseInt(parts[2]) || 0;
        setCommentLikes(prev => new Map(prev).set(commentId, count));
      }
    });
  }, [subscribe, post.id, fetchNewComment]);

  useEffect(() => {
    if (post.latitude == null || post.longitude == null) return;
    const key = `${post.latitude.toFixed(3)},${post.longitude.toFixed(3)}`;
    if (locationNameCache[key]) {
      setLocationName(locationNameCache[key]);
      return;
    }
    let active = true;
    apiFetch<{ displayName: string }>(`/api/public/geo/reverse?lat=${post.latitude}&lng=${post.longitude}`)
      .then(data => {
        if (!active) return;
        const name = data.displayName || '';
        locationNameCache[key] = name;
        setLocationName(name);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [post.latitude, post.longitude]);

  // ── Load author info (fallback when not enriched by backend) ─────────────
  useEffect(() => {
    if (post.author) return;
    let active = true;
    apiFetch<{ id: string; username: string; avatarUrl?: string | null }>(`/api/public/users/${post.authorId}`)
      .then(u => {
        if (active) {
          setAuthorName(u.username);
          setAuthorAvatar(u.avatarUrl ?? null);
        }
      })
      .catch(() => { if (active) setAuthorName('Unknown'); });
    return () => { active = false; };
  }, [post.authorId, post.author]);

  // ── Load like count + hasLiked (fallback when not enriched by backend) ────
  useEffect(() => {
    if (post.likeCount !== undefined) return;
    let active = true;
    apiFetch<number>(`/api/public/posts/${post.id}/likes`)
      .then(n => { if (active) setLikeCount(n); })
      .catch(() => {});
    if (user) {
      apiFetch<{ liked: boolean }>(`/api/posts/${post.id}/likes/me`)
        .then(r => { if (active) setLiked(r.liked); })
        .catch(() => {});
    }
    return () => { active = false; };
  }, [post.id, post.likeCount, user]);

  // ── Load comment count (fallback when not enriched by backend) ────────────
  useEffect(() => {
    if (post.commentCount !== undefined) return;
    let active = true;
    apiFetch<{ count: number }>(`/api/public/posts/${post.id}/comments/count`)
      .then(r => { if (active) setCommentCount(r.count); })
      .catch(() => {});
    return () => { active = false; };
  }, [post.id, post.commentCount]);

  // ── Toggle like ────────────────────────────────────────────────────────────
  async function handleLike() {
    if (!user || likeLoading) return;
    setLikeLoading(true);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);
    try {
      if (wasLiked) {
        await apiFetch(`/api/posts/${post.id}/like`, { method: 'DELETE' });
      } else {
        await apiFetch(`/api/posts/${post.id}/like`, { method: 'POST' });
      }
    } catch {
      setLiked(wasLiked);
      setLikeCount(c => wasLiked ? c + 1 : c - 1);
    } finally {
      setLikeLoading(false);
    }
  }

  // ── Load comments + their like counts ─────────────────────────────────────
  async function loadComments() {
    if (commentsLoaded.current) return;
    commentsLoaded.current = true;
    try {
      const data = await apiFetch<BackendComment[]>(`/api/public/posts/${post.id}/comments`);
      setComments(data);
      setCommentCount(data.length);

      // Build like counts from enriched response; fetch userLiked per comment if logged in
      const likeCounts = new Map<string, number>();
      const likedMap = new Map<string, boolean>();
      for (const c of data) {
        likeCounts.set(c.id, c.likeCount ?? 0);
      }
      if (user) {
        await Promise.all(data.map(async (c) => {
          try {
            const r = await apiFetch<{ liked: boolean }>(`/api/comments/${c.id}/likes/me`);
            likedMap.set(c.id, r.liked);
          } catch { likedMap.set(c.id, false); }
        }));
      }
      setCommentLikes(likeCounts);
      setCommentLiked(likedMap);
    } catch {}
  }

  function handleToggleComments() {
    const next = !showComments;
    setShowComments(next);
    if (next) loadComments();
  }

  // ── Toggle comment like ────────────────────────────────────────────────────
  async function handleCommentLike(commentId: string) {
    if (!user || commentLikeBusy.has(commentId)) return;
    setCommentLikeBusy(prev => new Set(prev).add(commentId));
    const wasLiked = commentLiked.get(commentId) ?? false;

    // Optimistic update
    setCommentLiked(prev => new Map(prev).set(commentId, !wasLiked));
    setCommentLikes(prev => new Map(prev).set(commentId, (prev.get(commentId) ?? 0) + (wasLiked ? -1 : 1)));

    try {
      if (wasLiked) {
        await apiFetch(`/api/comments/${commentId}/like`, { method: 'DELETE' });
      } else {
        await apiFetch(`/api/comments/${commentId}/like`, { method: 'POST' });
      }
    } catch {
      // Revert
      setCommentLiked(prev => new Map(prev).set(commentId, wasLiked));
      setCommentLikes(prev => new Map(prev).set(commentId, (prev.get(commentId) ?? 0) + (wasLiked ? 1 : -1)));
    } finally {
      setCommentLikeBusy(prev => { const s = new Set(prev); s.delete(commentId); return s; });
    }
  }

  // ── Submit comment ─────────────────────────────────────────────────────────
  async function handleAddComment() {
    const text = commentText.trim();
    if (!text || !user || commentBusy) return;
    setCommentBusy(true);
    setCommentError('');
    try {
      const newComment = await apiFetch<BackendComment>(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      setComments(prev => [...prev, newComment]);
      setCommentCount(c => (c ?? 0) + 1);
      setCommentLikes(prev => new Map(prev).set(newComment.id, 0));
      setCommentLiked(prev => new Map(prev).set(newComment.id, false));
      setCommentText('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Comment could not be posted.');
    }
    setCommentBusy(false);
  }

  // ── Delete comment ─────────────────────────────────────────────────────────
  async function handleDeleteComment(commentId: string) {
    try {
      await apiFetch(`/api/posts/${post.id}/comments/${commentId}`, { method: 'DELETE' });
      setComments(prev => prev.filter(c => c.id !== commentId));
      setCommentCount(c => Math.max(0, (c ?? 1) - 1));
    } catch {}
  }

  const isFriendsOnly = post.visibility === 'FRIENDS_ONLY';

  return (
    <div style={cardStyle}>
      {/* ── Header ── */}
      <div style={headerStyle}>
        <Link href={`/profile/${post.authorId}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AvatarCircle name={authorName} avatarUrl={authorAvatar} size={36} />
          <span style={authorStyle}>{authorName || '...'}</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
            background: isFriendsOnly ? '#e3f2fd' : '#e8f5e9',
            color: isFriendsOnly ? '#1565c0' : '#1a5c2a',
            letterSpacing: '0.04em',
          }}>
            {isFriendsOnly ? '👥 Friends' : '🌍 Public'}
          </span>
          <span style={timeStyle}>{timeAgo(post.timestamp)}</span>
        </div>
      </div>

      {/* ── Body ── */}
      {isModerated ? (
        <div style={{ ...textStyle, color: '#999', fontStyle: 'italic',
          background: '#fafafa', borderRadius: 8, padding: '8px 12px',
          border: '1px solid #eee', fontSize: 13 }}>
          🚫 {moderationReason || 'This post was removed by moderation.'}
        </div>
      ) : (
        <>
          <div style={textStyle}>{post.text}</div>
          {post.imageUrl && (
            <img src={`${API_BASE}${post.imageUrl}`} alt="Post image" style={imgStyle} />
          )}
        </>
      )}
      {post.latitude != null && post.longitude != null && (
        <div style={locationStyle}>
          📍 {locationName || `${post.latitude.toFixed(2)}, ${post.longitude.toFixed(2)}`}
        </div>
      )}

      {/* ── Action bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
        {/* Like button */}
        <button
          onClick={handleLike}
          disabled={!user || likeLoading}
          style={{
            background: 'none', border: 'none', cursor: user ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', gap: 5,
            color: liked ? '#e53935' : '#888',
            fontWeight: liked ? 700 : 400, fontSize: 14, padding: 0,
            opacity: likeLoading ? 0.5 : 1, transition: 'color 0.15s',
          }}
        >
          <span style={{ fontSize: 18 }}>{liked ? '❤️' : '🤍'}</span>
          {likeCount}
        </button>

        {/* Comment button */}
        <button
          onClick={handleToggleComments}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            color: showComments ? '#1a5c2a' : '#888',
            fontWeight: showComments ? 700 : 400, fontSize: 14, padding: 0,
          }}
        >
          <span style={{ fontSize: 18 }}>💬</span>
          {commentCount !== null ? commentCount : ''}
        </button>
      </div>

      {/* ── Comments section ── */}
      {showComments && (
        <div style={{ marginTop: 12 }}>
          {comments.length === 0 && (
            <p style={{ fontSize: 13, color: '#aaa', margin: '0 0 10px' }}>No comments yet. Be the first!</p>
          )}
          {comments.map(c => {
            const cLiked = commentLiked.get(c.id) ?? false;
            const cLikeCount = commentLikes.get(c.id) ?? 0;
            return (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                marginBottom: 10, position: 'relative',
              }}>
                <Link href={`/profile/${c.author.id}`} style={{ flexShrink: 0 }}>
                  <AvatarCircle name={c.author.username} avatarUrl={c.author.avatarUrl} size={28} />
                </Link>
                <div style={{ flex: 1 }}>
                  <Link href={`/profile/${c.author.id}`} style={{ textDecoration: 'none' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1a5c2a', marginRight: 6 }}>
                      {c.author.username}
                    </span>
                  </Link>
                  {c.moderated ? (
                    <span style={{ fontSize: 13, color: '#999', fontStyle: 'italic' }}>
                      🚫 {c.moderationReason || 'Removed by moderation'}
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, color: '#333' }}>{c.content}</span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: '#bbb' }}>{timeAgo(c.createdAt)}</span>
                    {/* Comment like button */}
                    <button
                      onClick={() => handleCommentLike(c.id)}
                      disabled={!user || commentLikeBusy.has(c.id)}
                      style={{
                        background: 'none', border: 'none', cursor: user ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', gap: 3, padding: 0,
                        color: cLiked ? '#e53935' : '#bbb',
                        fontSize: 11, fontWeight: cLiked ? 700 : 400,
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{cLiked ? '❤️' : '🤍'}</span>
                      {cLikeCount > 0 && cLikeCount}
                    </button>
                  </div>
                </div>
                {user?.id === c.author.id && (
                  <button
                    onClick={() => handleDeleteComment(c.id)}
                    title="Delete comment"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#ccc', fontSize: 14, padding: '0 4px',
                      lineHeight: 1, flexShrink: 0,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          {/* New comment input */}
          {user && (
            <div style={{ marginTop: 4 }}>
            {commentError && (
              <div style={{ fontSize: 12, color: '#c0392b', marginBottom: 6, padding: '5px 10px',
                background: '#fdf0f0', borderRadius: 8, border: '1px solid #f5c6c6' }}>
                {commentError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); }}}
                placeholder="Write a comment…"
                maxLength={500}
                style={{
                  flex: 1, border: '1px solid #ddd', borderRadius: 20,
                  padding: '6px 14px', fontSize: 13, outline: 'none',
                  background: '#fafafa',
                }}
              />
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim() || commentBusy}
                style={{
                  background: '#2e7d32', color: '#fff', border: 'none',
                  borderRadius: 20, padding: '6px 14px',
                  fontSize: 13, cursor: 'pointer', fontWeight: 600,
                  opacity: (!commentText.trim() || commentBusy) ? 0.5 : 1,
                }}
              >
                →
              </button>
            </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
