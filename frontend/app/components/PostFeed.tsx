'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { apiFetch, apiUpload, API_BASE } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import PostCard from './PostCard';
import { DS } from '../lib/tokens';
import { TYPE } from '../lib/typography';

const LocationPicker = dynamic(() => import('./LocationPicker'), { ssr: false });

export type Post = {
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

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export default function PostFeed({ readOnly = false, initialPosts }: { readOnly?: boolean; initialPosts?: Post[] } = {}) {
  const { user } = useAuth();
  const [posts, setPosts]         = useState<Post[]>(initialPosts ?? []);
  const [text, setText]           = useState('');
  const [imageUrl, setImageUrl]   = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [useLocation, setUseLocation] = useState(false);
  const [location, setLocation]   = useState<{ lat: number; lng: number } | null>(null);
  const [posting, setPosting]     = useState(false);
  const [postError, setPostError] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'FRIENDS_ONLY'>('PUBLIC');

  const loadFeed = useCallback(async () => {
    try {
      const endpoint = readOnly ? '/api/public/posts/feed' : '/api/posts/feed';
      const feed = await apiFetch<Post[]>(endpoint);
      setPosts(feed);
    } catch { /* empty */ }
  }, [readOnly]);

  useEffect(() => {
    if (initialPosts !== undefined) return; // SSR already provided data, skip initial fetch
    loadFeed();
  }, [loadFeed]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiUpload('/api/posts/upload-image', fd);
      setImageUrl(res.url);
    } catch { /* empty */ }
    setUploading(false);
  };

  const toggleLocation = () => {
    if (useLocation) {
      setUseLocation(false);
      setLocation(null);
      return;
    }
    setLocation({ lat: 52.52, lng: 13.405 });
    setUseLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  };

  const handlePost = async () => {
    if (!text.trim()) return;
    setPosting(true);
    setPostError('');
    try {
      const params = new URLSearchParams({ text: text.trim(), visibility });
      if (imageUrl) params.set('imageUrl', imageUrl);
      if (location) {
        params.set('latitude', String(location.lat));
        params.set('longitude', String(location.lng));
      }
      await apiFetch(`/api/posts?${params.toString()}`, { method: 'POST' });
      setText('');
      setImageUrl(null);
      setUseLocation(false);
      setLocation(null);
      setVisibility('PUBLIC');
      loadFeed();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Post could not be submitted.');
    }
    setPosting(false);
  };

  const userAvatarUrl = user?.avatarUrl ? `${API_BASE}${user.avatarUrl}` : null;

  return (
    <div style={{ maxWidth: 660, margin: '0 auto', padding: '24px 16px' }}>

      {/* ── Composer ── */}
      {!readOnly && (
        <section style={{
          background: '#fff',
          border: `2px solid ${DS.tertiary}`,
          boxShadow: DS.shadowSm,
          padding: '20px 24px',
          marginBottom: 32,
        }}>
          <div style={{ display: 'flex', gap: 16 }}>
            {/* Avatar */}
            <div style={{
              width: 48, height: 48, flexShrink: 0,
              border: `2px solid ${DS.tertiary}`,
              background: DS.secondary,
              overflow: 'hidden',
            }}>
              {userAvatarUrl ? (
                <img src={userAvatarUrl} alt="You" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: DS.primary, fontWeight: TYPE.weight.black,
                  fontSize: TYPE.size.lg,
                }}>
                  {user?.name ? user.name[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : '?'}
                </div>
              )}
            </div>

            {/* Input area */}
            <div style={{ flex: 1 }}>
              <textarea
                id="post-composer"
                style={{
                  width: '100%',
                  minHeight: 72,
                  border: 'none',
                  borderBottom: `2px solid ${DS.tertiary}`,
                  borderRadius: 0,
                  padding: '8px 0',
                  fontSize: TYPE.size.lg,
                  lineHeight: TYPE.leading.relaxed,
                  resize: 'none',
                  fontFamily: 'inherit',
                  outline: 'none',
                  background: 'transparent',
                  color: DS.tertiary,
                  boxSizing: 'border-box',
                }}
                placeholder="What's happening near you?"
                value={text}
                onChange={e => setText(e.target.value)}
              />

              {imageUrl && (
                <div style={{ marginTop: 10 }}>
                  <img src={`${API_BASE}${imageUrl}`} alt="Preview" style={{ maxHeight: 120, border: `2px solid ${DS.tertiary}` }} />
                  <button
                    onClick={() => setImageUrl(null)}
                    style={{
                      marginLeft: 8, background: 'transparent', border: `2px solid ${DS.tertiary}`,
                      padding: '3px 10px', fontSize: TYPE.size.xs, fontWeight: TYPE.weight.bold,
                      letterSpacing: TYPE.tracking.wide, textTransform: 'uppercase', cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}

              {useLocation && location && (
                <>
                  <div style={{ fontSize: TYPE.size.xs, color: DS.secondary, marginTop: 8 }}>
                    Click or drag the pin on the map to set your location
                  </div>
                  <LocationPicker
                    lat={location.lat}
                    lng={location.lng}
                    onChange={(lat, lng) => setLocation({ lat, lng })}
                  />
                </>
              )}

              {postError && (
                <div style={{
                  fontSize: TYPE.size.sm, color: '#c0392b', marginTop: 8,
                  padding: '6px 10px', background: '#fdf0f0', border: '1px solid #f5c6c6',
                }}>
                  {postError}
                </div>
              )}

              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Utility buttons row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {/* Photo */}
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', border: `2px solid ${DS.tertiary}`,
                    fontSize: TYPE.size.xs, fontWeight: TYPE.weight.bold,
                    letterSpacing: TYPE.tracking.wider, textTransform: 'uppercase',
                    cursor: 'pointer', background: 'transparent', color: DS.tertiary,
                    fontFamily: 'inherit',
                  }}>
                    <ImageIcon />
                    {uploading ? 'Uploading…' : 'Photo'}
                    <input id="post-image-upload" type="file" accept="image/*" hidden onChange={handleImageUpload} />
                  </label>

                  {/* Location */}
                  <button
                    onClick={toggleLocation}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', border: `2px solid ${DS.tertiary}`,
                      fontSize: TYPE.size.xs, fontWeight: TYPE.weight.bold,
                      letterSpacing: TYPE.tracking.wider, textTransform: 'uppercase',
                      cursor: 'pointer', fontFamily: 'inherit',
                      background: useLocation ? DS.primary : 'transparent',
                      color: DS.tertiary,
                    }}
                  >
                    <LocationIcon />
                    Location
                  </button>

                  {/* Visibility */}
                  <button
                    onClick={() => setVisibility(v => v === 'PUBLIC' ? 'FRIENDS_ONLY' : 'PUBLIC')}
                    title={visibility === 'PUBLIC' ? 'Visible to everyone' : 'Visible to friends only'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', border: `2px solid ${DS.tertiary}`,
                      fontSize: TYPE.size.xs, fontWeight: TYPE.weight.bold,
                      letterSpacing: TYPE.tracking.wider, textTransform: 'uppercase',
                      cursor: 'pointer', fontFamily: 'inherit',
                      background: visibility === 'PUBLIC' ? DS.primary : 'rgba(26,26,26,0.08)',
                      color: DS.tertiary,
                    }}
                  >
                    {visibility === 'PUBLIC' ? 'Public' : 'Friends'}
                  </button>
                </div>

                {/* Post button row */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handlePost}
                    disabled={posting || !text.trim()}
                    style={{
                      padding: '12px 40px',
                      border: `2px solid ${DS.tertiary}`,
                      background: DS.secondary,
                      color: DS.primary,
                      fontWeight: TYPE.weight.black,
                      fontSize: TYPE.size.sm,
                      letterSpacing: TYPE.tracking.wider,
                      textTransform: 'uppercase',
                      cursor: posting || !text.trim() ? 'default' : 'pointer',
                      opacity: posting || !text.trim() ? 0.5 : 1,
                      fontFamily: 'inherit',
                      boxShadow: posting || !text.trim() ? 'none' : DS.shadowSm,
                      transition: 'transform 0.1s, box-shadow 0.1s',
                    }}
                  >
                    {posting ? 'Posting…' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {posts.length === 0 && (
        <div style={{ textAlign: 'center', color: '#888', padding: 40, fontSize: TYPE.size.sm }}>
          No posts yet. Be the first to share something!
        </div>
      )}
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
