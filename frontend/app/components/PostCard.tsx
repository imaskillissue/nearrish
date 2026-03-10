'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch, API_BASE } from '../lib/api';
import { useAuth } from '../lib/auth-context';

type Post = {
  id: string;
  text: string;
  authorId: string;
  timestamp: number;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  visibility?: 'PUBLIC' | 'FRIENDS_ONLY';
};

type BackendComment = {
  id: string;
  content: string;
  createdAt: number;
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
  const [authorName, setAuthorName]       = useState('');
  const [authorAvatar, setAuthorAvatar]   = useState<string | null>(null);

  // ── Likes ──────────────────────────────────────────────────────────────────
  const [likeCount,   setLikeCount]     = useState(0);
  const [liked,       setLiked]         = useState(false);
  const [likeLoading, setLikeLoading]   = useState(false);

  // ── Comments ───────────────────────────────────────────────────────────────
  const [showComments,  setShowComments]  = useState(false);
  const [comments,      setComments]      = useState<BackendComment[]>([]);
  const [commentCount,  setCommentCount]  = useState<number | null>(null);
  const [commentText,   setCommentText]   = useState('');
  const [commentBusy,   setCommentBusy]   = useState(false);
  const commentsLoaded = useRef(false);

  // ── Comment likes (tracked per comment id) ─────────────────────────────────
  const [commentLikes, setCommentLikes]     = useState<Map<string, number>>(new Map());
  const [commentLiked, setCommentLiked]     = useState<Map<string, boolean>>(new Map());
  const [commentLikeBusy, setCommentLikeBusy] = useState<Set<string>>(new Set());

  // ── Load author info ──────────────────────────────────────────────────────
  useEffect(() => {
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
  }, [post.authorId]);

  // ── Load like count + hasLiked ─────────────────────────────────────────────
  useEffect(() => {
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
  }, [post.id, user]);

  // ── Load comment count ─────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    apiFetch<{ count: number }>(`/api/public/posts/${post.id}/comments/count`)
      .then(r => { if (active) setCommentCount(r.count); })
      .catch(() => {});
    return () => { active = false; };
  }, [post.id]);

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

      // Load like counts for all comments
      const likeCounts = new Map<string, number>();
      const likedMap = new Map<string, boolean>();
      await Promise.all(data.map(async (c) => {
        try {
          const count = await apiFetch<number>(`/api/public/comments/${c.id}/likes`);
          likeCounts.set(c.id, count);
        } catch { likeCounts.set(c.id, 0); }
        if (user) {
          try {
            const r = await apiFetch<{ liked: boolean }>(`/api/comments/${c.id}/likes/me`);
            likedMap.set(c.id, r.liked);
          } catch { likedMap.set(c.id, false); }
        }
      }));
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
    } catch {}
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
      <div style={textStyle}>{post.text}</div>
      {post.imageUrl && (
        <img src={`${API_BASE}${post.imageUrl}`} alt="Post image" style={imgStyle} />
      )}
      {post.latitude != null && post.longitude != null && (
        <div style={locationStyle}>
          📍 {post.latitude.toFixed(2)}, {post.longitude.toFixed(2)}
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
                  <span style={{ fontSize: 13, color: '#333' }}>{c.content}</span>
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
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
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
          )}
        </div>
      )}
    </div>
  );
}
