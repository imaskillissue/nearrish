'use client';

import { useEffect, useState } from 'react';
import { apiFetch, API_BASE } from '../lib/api';
import { DS } from '../lib/tokens';

type MiniPostCardProps = {
  post: {
    id: string;
    text: string;
    authorId: string;
    timestamp: number;
    imageUrl?: string | null;
    author?: { id: string; username: string; avatarUrl?: string | null };
  };
  onClose: () => void;
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

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const letter = name ? name[0].toUpperCase() : '?';
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
      background: DS.secondary, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {avatarUrl
        ? <img
            src={`${API_BASE}${avatarUrl}`}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        : <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, fontFamily: 'inherit' }}>
            {letter}
          </span>
      }
    </div>
  );
}

export default function MiniPostCard({ post }: MiniPostCardProps) {
  const [author,    setAuthor]    = useState(post.author?.username ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(post.author?.avatarUrl ?? null);

  useEffect(() => {
    if (post.author) return;
    apiFetch<{ username: string; avatarUrl?: string | null }>(`/api/public/users/${post.authorId}`)
      .then(u => {
        setAuthor(u.username);
        setAvatarUrl(u.avatarUrl ?? null);
      })
      .catch(() => setAuthor('?'));
  }, [post.authorId, post.author]);

  const truncated = post.text.length > 120 ? post.text.slice(0, 120) + '…' : post.text;

  return (
    <div style={{ minWidth: 220, maxWidth: 260, fontSize: 13, fontFamily: 'inherit' }}>
      {/* Header: avatar + author + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Avatar name={author} avatarUrl={avatarUrl} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: DS.secondary, fontSize: 13, lineHeight: 1.2 }}>
            {author || '…'}
          </div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>
            {timeAgo(post.timestamp)}
          </div>
        </div>
      </div>

      {/* Post text */}
      <div style={{ color: '#222', fontSize: 13, lineHeight: 1.45, marginBottom: post.imageUrl ? 8 : 0 }}>
        {truncated}
      </div>

      {/* Image thumbnail */}
      {post.imageUrl && (
        <img
          src={`${API_BASE}${post.imageUrl}`}
          alt="Post image"
          style={{
            width: '100%',
            maxHeight: 140,
            objectFit: 'cover',
            display: 'block',
          }}
        />
      )}
    </div>
  );
}
