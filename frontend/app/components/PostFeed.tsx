'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { apiFetch, apiUpload, API_BASE } from '../lib/api';
import PostCard from './PostCard';

const LocationPicker = dynamic(() => import('./LocationPicker'), { ssr: false });

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

const containerStyle: React.CSSProperties = {
  maxWidth: 620,
  margin: '0 auto',
  padding: '24px 16px',
};

const formStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  padding: '16px 20px',
  marginBottom: 24,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 80,
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 15,
  resize: 'vertical',
  fontFamily: 'inherit',
  outline: 'none',
};

const actionsRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginTop: 10,
};

const btnStyle: React.CSSProperties = {
  padding: '8px 18px',
  borderRadius: 8,
  border: 'none',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
};

const postBtn: React.CSSProperties = {
  ...btnStyle,
  background: '#1a5c2a',
  color: '#fff',
};

const secBtn: React.CSSProperties = {
  ...btnStyle,
  background: '#eee',
  color: '#333',
};

const previewImg: React.CSSProperties = {
  maxHeight: 120,
  borderRadius: 8,
  marginTop: 8,
};

export default function PostFeed({ readOnly = false }: { readOnly?: boolean } = {}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [useLocation, setUseLocation] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [posting, setPosting] = useState(false);
  const [visibility, setVisibility] = useState<'PUBLIC' | 'FRIENDS_ONLY'>('PUBLIC');

  const loadFeed = useCallback(async () => {
    try {
      const endpoint = readOnly ? '/api/public/posts/feed' : '/api/posts/feed';
      const feed = await apiFetch<Post[]>(endpoint);
      setPosts(feed);
    } catch { /* empty */ }
  }, [readOnly]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

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
    // Show map immediately with default position, try GPS to refine
    setLocation({ lat: 52.52, lng: 13.405 });
    setUseLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {} // GPS denied — user can pick location on the map
      );
    }
  };

  const handlePost = async () => {
    if (!text.trim()) return;
    setPosting(true);
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
    } catch { /* empty */ }
    setPosting(false);
  };

  return (
    <div style={containerStyle}>
      {!readOnly && <div style={formStyle}>
        <textarea
          style={textareaStyle}
          placeholder="What's happening near you?"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        {imageUrl && (
          <div>
            <img src={`${API_BASE}${imageUrl}`} alt="Preview" style={previewImg} />
            <button style={{ ...secBtn, marginLeft: 8, marginTop: 8 }} onClick={() => setImageUrl(null)}>Remove</button>
          </div>
        )}
        {useLocation && location && (
          <>
            <div style={{ fontSize: 12, color: '#4a7030', marginTop: 6 }}>
              Click or drag the pin on the map to set your location
            </div>
            <LocationPicker
              lat={location.lat}
              lng={location.lng}
              onChange={(lat, lng) => setLocation({ lat, lng })}
            />
          </>
        )}
        <div style={actionsRow}>
          <label style={secBtn}>
            {uploading ? 'Uploading...' : 'Photo'}
            <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
          </label>
          <button style={{ ...secBtn, background: useLocation ? '#dff0d8' : '#eee' }} onClick={toggleLocation}>
            {useLocation ? '📍 Remove location' : '📍 Add location'}
          </button>
          {/* Visibility toggle */}
          <button
            style={{
              ...secBtn,
              background: visibility === 'PUBLIC' ? '#e8f5e9' : '#e3f2fd',
              color: visibility === 'PUBLIC' ? '#1a5c2a' : '#1565c0',
              marginLeft: 'auto',
            }}
            onClick={() => setVisibility(v => v === 'PUBLIC' ? 'FRIENDS_ONLY' : 'PUBLIC')}
            title={visibility === 'PUBLIC' ? 'Visible to everyone' : 'Visible to friends only'}
          >
            {visibility === 'PUBLIC' ? '🌍 Public' : '👥 Friends'}
          </button>
          <button style={postBtn} onClick={handlePost} disabled={posting || !text.trim()}>
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>}

      {posts.length === 0 && (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>
          No posts yet. Be the first to share something!
        </div>
      )}
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
