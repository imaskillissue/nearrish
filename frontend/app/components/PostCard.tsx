'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch, API_BASE } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useWs } from '../lib/ws-context';
import { DS } from '../lib/tokens';
import { TYPE } from '../lib/typography';

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
  author?: { id: string; username: string; avatarUrl?: string | null };
  likeCount?: number;
  commentCount?: number;
  userLiked?: boolean;
};

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

function AvatarSquare({ name, avatarUrl, size = 48 }: { name: string; avatarUrl?: string | null; size?: number }) {
  if (avatarUrl) {
    return (
      <img
        src={`${API_BASE}${avatarUrl}`}
        alt={name}
        style={{
          width: size, height: size, borderRadius: 0,
          border: `2px solid ${DS.tertiary}`,
          objectFit: 'cover', flexShrink: 0,
        }}
      />
    );
  }
  const letter = name ? name[0].toUpperCase() : '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: 0,
      border: `2px solid ${DS.tertiary}`,
      background: DS.secondary, color: DS.primary,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: size * 0.4, flexShrink: 0,
    }}>
      {letter}
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

export default function PostCard({ post }: PostCardProps) {
  const { user } = useAuth();
  const { subscribe } = useWs();
  const [authorName, setAuthorName]     = useState(post.author?.username ?? '');
  const [authorAvatar, setAuthorAvatar] = useState<string | null>(post.author?.avatarUrl ?? null);

  const [isModerated, setIsModerated]           = useState(post.moderated ?? false);
  const [moderationReason, setModerationReason] = useState(post.moderationReason ?? null);

  const [likeCount,   setLikeCount]   = useState(post.likeCount ?? 0);
  const [liked,       setLiked]       = useState(post.userLiked ?? false);
  const [likeLoading, setLikeLoading] = useState(false);

  const [showComments,  setShowComments]  = useState(false);
  const [comments,      setComments]      = useState<BackendComment[]>([]);
  const [commentCount,  setCommentCount]  = useState<number | null>(post.commentCount ?? null);
  const [commentText,   setCommentText]   = useState('');
  const [commentBusy,   setCommentBusy]   = useState(false);
  const [commentError,  setCommentError]  = useState('');
  const commentsLoaded = useRef(false);

  const [commentLikes,    setCommentLikes]    = useState<Map<string, number>>(new Map());
  const [commentLiked,    setCommentLiked]    = useState<Map<string, boolean>>(new Map());
  const [commentLikeBusy, setCommentLikeBusy] = useState<Set<string>>(new Set());

  const [locationName, setLocationName] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);

  const fetchNewComment = useCallback(async (commentId: string) => {
    try {
      const c = await apiFetch<BackendComment>(`/api/public/posts/${post.id}/comments/${commentId}`);
      setComments(prev => {
        if (prev.some(x => x.id === commentId)) return prev;
        setCommentCount(n => (n ?? 0) + 1);
        return [...prev, c];
      });
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
        setComments(prev => {
        if (!prev.some(c => c.id === commentId)) return prev;
        setCommentCount(n => Math.max(0, (n ?? 1) - 1));
        return prev.filter(c => c.id !== commentId);
      });
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
    if (locationNameCache[key]) { setLocationName(locationNameCache[key]); return; }
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

  useEffect(() => {
    if (post.author) return;
    let active = true;
    apiFetch<{ id: string; username: string; avatarUrl?: string | null }>(`/api/public/users/${post.authorId}`)
      .then(u => { if (active) { setAuthorName(u.username); setAuthorAvatar(u.avatarUrl ?? null); } })
      .catch(() => { if (active) setAuthorName('Unknown'); });
    return () => { active = false; };
  }, [post.authorId, post.author]);

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

  useEffect(() => {
    if (post.commentCount !== undefined) return;
    let active = true;
    apiFetch<{ count: number }>(`/api/public/posts/${post.id}/comments/count`)
      .then(r => { if (active) setCommentCount(r.count); })
      .catch(() => {});
    return () => { active = false; };
  }, [post.id, post.commentCount]);

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

  async function loadComments() {
    if (commentsLoaded.current) return;
    commentsLoaded.current = true;
    try {
      const data = await apiFetch<BackendComment[]>(`/api/public/posts/${post.id}/comments`);
      setComments(data);
      setCommentCount(data.length);
      const likeCounts = new Map<string, number>();
      const likedMap = new Map<string, boolean>();
      for (const c of data) { likeCounts.set(c.id, c.likeCount ?? 0); }
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

  async function handleCommentLike(commentId: string) {
    if (!user || commentLikeBusy.has(commentId)) return;
    setCommentLikeBusy(prev => new Set(prev).add(commentId));
    const wasLiked = commentLiked.get(commentId) ?? false;
    setCommentLiked(prev => new Map(prev).set(commentId, !wasLiked));
    setCommentLikes(prev => new Map(prev).set(commentId, (prev.get(commentId) ?? 0) + (wasLiked ? -1 : 1)));
    try {
      if (wasLiked) {
        await apiFetch(`/api/comments/${commentId}/like`, { method: 'DELETE' });
      } else {
        await apiFetch(`/api/comments/${commentId}/like`, { method: 'POST' });
      }
    } catch {
      setCommentLiked(prev => new Map(prev).set(commentId, wasLiked));
      setCommentLikes(prev => new Map(prev).set(commentId, (prev.get(commentId) ?? 0) + (wasLiked ? 1 : -1)));
    } finally {
      setCommentLikeBusy(prev => { const s = new Set(prev); s.delete(commentId); return s; });
    }
  }

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
      setComments(prev => prev.some(x => x.id === newComment.id) ? prev : [...prev, newComment]);
      setCommentCount(c => (c ?? 0) + 1);
      setCommentLikes(prev => new Map(prev).set(newComment.id, 0));
      setCommentLiked(prev => new Map(prev).set(newComment.id, false));
      setCommentText('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Comment could not be posted.');
    }
    setCommentBusy(false);
  }

  async function handleDeleteComment(commentId: string) {
    try {
      await apiFetch(`/api/posts/${post.id}/comments/${commentId}`, { method: 'DELETE' });
      setComments(prev => prev.filter(c => c.id !== commentId));
      setCommentCount(c => Math.max(0, (c ?? 1) - 1));
    } catch {}
  }

  const isFriendsOnly = post.visibility === 'FRIENDS_ONLY';
  const hasLocation = post.latitude != null && post.longitude != null;

  return (
    <article style={{
      background: '#fff',
      border: `2px solid ${DS.tertiary}`,
      boxShadow: DS.shadowSm,
      marginBottom: 32,
    }}>
      <div style={{ padding: '24px 24px 20px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <Link href={`/profile/${post.authorId}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
            <AvatarSquare name={authorName} avatarUrl={authorAvatar} size={48} />
            <div>
              <div style={{
                fontWeight: TYPE.weight.black,
                fontSize: TYPE.size.lg,
                color: DS.secondary,
                lineHeight: 1.1,
              }}>
                {authorName || '…'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{
                  fontSize: TYPE.size.xs,
                  fontWeight: TYPE.weight.bold,
                  color: '#888',
                  textTransform: 'uppercase',
                  letterSpacing: TYPE.tracking.snug,
                }}>
                  {timeAgo(post.timestamp)}
                </span>
                {hasLocation && (
                  <>
                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#bbb', display: 'inline-block' }} />
                    <span style={{
                      fontSize: TYPE.size.xs,
                      fontWeight: TYPE.weight.bold,
                      color: DS.secondary,
                      textTransform: 'uppercase',
                      letterSpacing: TYPE.tracking.snug,
                    }}>
                      {locationName || `${post.latitude!.toFixed(2)}, ${post.longitude!.toFixed(2)}`}
                    </span>
                  </>
                )}
                {isFriendsOnly && (
                  <>
                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#bbb', display: 'inline-block' }} />
                    <span style={{
                      fontSize: TYPE.size.xs,
                      fontWeight: TYPE.weight.bold,
                      color: '#888',
                      textTransform: 'uppercase',
                      letterSpacing: TYPE.tracking.snug,
                    }}>
                      Friends only
                    </span>
                  </>
                )}
              </div>
            </div>
          </Link>
        </div>

        {/* ── Body ── */}
        {isModerated ? (
          <div style={{
            fontSize: TYPE.size.sm, color: '#999', fontStyle: 'italic',
            background: '#fafafa', padding: '10px 14px',
            border: `1px solid #eee`, marginBottom: 16,
          }}>
            🚫 {moderationReason || 'This post was removed by moderation.'}
          </div>
        ) : (
          <p style={{
            fontSize: TYPE.size.lg,
            lineHeight: TYPE.leading.relaxed,
            color: '#222',
            margin: '0 0 20px',
          }}>
            {post.text}
          </p>
        )}

        {!isModerated && post.imageUrl && (
          <div style={{
            aspectRatio: '16 / 9',
            width: '100%',
            border: `2px solid ${DS.tertiary}`,
            overflow: 'hidden',
            marginBottom: 20,
          }}>
            <img
              src={`${API_BASE}${post.imageUrl}`}
              alt="Post image"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        {/* ── Action bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 20,
          paddingTop: 14,
          borderTop: '1px solid rgba(26,26,26,0.1)',
        }}>
          <button
            onClick={handleLike}
            disabled={!user || likeLoading}
            style={{
              background: 'none', border: 'none', cursor: user ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', gap: 6,
              color: liked ? '#e53935' : '#888',
              fontWeight: TYPE.weight.bold,
              fontSize: TYPE.size.sm,
              padding: 0,
              opacity: likeLoading ? 0.5 : 1,
              transition: 'color 0.15s',
            }}
          >
            <HeartIcon filled={liked} />
            {likeCount}
          </button>

          <button
            onClick={handleToggleComments}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              color: showComments ? DS.secondary : '#888',
              fontWeight: TYPE.weight.bold,
              fontSize: TYPE.size.sm,
              padding: 0,
              transition: 'color 0.15s',
            }}
          >
            <ChatIcon />
            {commentCount !== null ? commentCount : ''}
          </button>

          <button
            onClick={() => setShowShare(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              color: '#888', padding: 0, marginLeft: 'auto',
              transition: 'color 0.15s',
            }}
            aria-label="Share"
          >
            <ShareIcon />
          </button>
        </div>
      </div>

      {/* ── Share modal ── */}
      {showShare && (
        <div
          onClick={() => setShowShare(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(26,26,26,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              border: `2px solid ${DS.tertiary}`,
              boxShadow: DS.shadow,
              padding: '2.5rem 3rem',
              minWidth: 280,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <ShareIcon />
            <p style={{
              margin: 0,
              fontWeight: 900,
              fontSize: TYPE.size.lg,
              color: DS.secondary,
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
            }}>
              Coming Soon
            </p>
            <p style={{ margin: 0, fontSize: TYPE.size.sm, color: DS.textMuted, textAlign: 'center' }}>
              Sharing is on its way.
            </p>
            <button
              onClick={() => setShowShare(false)}
              style={{
                marginTop: '0.5rem',
                background: DS.secondary, color: DS.primary,
                border: `2px solid ${DS.tertiary}`,
                padding: '0.4rem 1.4rem',
                fontFamily: 'inherit',
                fontSize: TYPE.size.xs,
                fontWeight: 900,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                borderRadius: 0,
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ── Comments section ── */}
      {showComments && (
        <div style={{
          borderTop: `2px solid ${DS.tertiary}`,
          padding: '16px 24px',
          background: '#fafafa',
        }}>
          {comments.length === 0 && (
            <p style={{ fontSize: TYPE.size.xs, color: '#aaa', margin: '0 0 12px' }}>No comments yet. Be the first!</p>
          )}
          {comments.map(c => {
            const cLiked = commentLiked.get(c.id) ?? false;
            const cLikeCount = commentLikes.get(c.id) ?? 0;
            return (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                marginBottom: 12, position: 'relative',
              }}>
                <Link href={`/profile/${c.author.id}`} style={{ flexShrink: 0 }}>
                  <AvatarSquare name={c.author.username} avatarUrl={c.author.avatarUrl} size={28} />
                </Link>
                <div style={{ flex: 1 }}>
                  <Link href={`/profile/${c.author.id}`} style={{ textDecoration: 'none' }}>
                    <span style={{ fontWeight: TYPE.weight.bold, fontSize: TYPE.size.sm, color: DS.secondary, marginRight: 6 }}>
                      {c.author.username}
                    </span>
                  </Link>
                  {c.moderated ? (
                    <span style={{ fontSize: TYPE.size.sm, color: '#999', fontStyle: 'italic' }}>
                      🚫 {c.moderationReason || 'Removed by moderation'}
                    </span>
                  ) : (
                    <span style={{ fontSize: TYPE.size.sm, color: '#333' }}>{c.content}</span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
                    <span style={{ fontSize: TYPE.size.xs, color: '#bbb' }}>{timeAgo(c.createdAt)}</span>
                    <button
                      onClick={() => handleCommentLike(c.id)}
                      disabled={!user || commentLikeBusy.has(c.id)}
                      style={{
                        background: 'none', border: 'none', cursor: user ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', gap: 3, padding: 0,
                        color: cLiked ? '#e53935' : '#bbb',
                        fontSize: TYPE.size.xs, fontWeight: cLiked ? TYPE.weight.bold : TYPE.weight.regular,
                      }}
                    >
                      <HeartIcon filled={cLiked} />
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

          {user && (
            <div style={{ marginTop: 8 }}>
              {commentError && (
                <div style={{
                  fontSize: TYPE.size.xs, color: '#c0392b', marginBottom: 8,
                  padding: '6px 10px', background: '#fdf0f0', border: '1px solid #f5c6c6',
                }}>
                  {commentError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id={`comment-input-${post.id}`}
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                  placeholder="Write a comment…"
                  maxLength={500}
                  style={{
                    flex: 1, border: `2px solid ${DS.tertiary}`, borderRadius: 0,
                    padding: '6px 14px', fontSize: TYPE.size.sm, outline: 'none',
                    background: DS.bg, fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim() || commentBusy}
                  style={{
                    background: DS.secondary, color: DS.earth, border: `2px solid ${DS.tertiary}`,
                    borderRadius: 0, padding: '6px 16px',
                    fontSize: TYPE.size.sm, cursor: 'pointer', fontWeight: TYPE.weight.bold,
                    fontFamily: 'inherit',
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
    </article>
  );
}
