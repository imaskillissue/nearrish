"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./SearchModal.module.css";
import { apiFetch, API_BASE } from "../lib/api";
import { DS } from "../lib/tokens";

type GlobalSearchModalProps = {
  open: boolean;
  onClose: () => void;
};

type PostResult = {
  id: string;
  text: string;
  authorId: string;
  timestamp: number;
  author?: { id: string; username: string; avatarUrl?: string | null };
};

type UserResult = {
  id: string;
  username: string;
  name?: string | null;
  avatarUrl?: string | null;
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<PostResult[]>([]);
  const [users, setUsers] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setPosts([]);
      setUsers([]);
    }
  }, [open]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setPosts([]);
      setUsers([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const q = encodeURIComponent(value.trim());
        const [postResults, userResults] = await Promise.all([
          apiFetch<PostResult[]>(`/api/public/posts/search?q=${q}`),
          apiFetch<UserResult[]>(`/api/public/users/search?q=${q}`),
        ]);
        setPosts(postResults.slice(0, 5));
        setUsers(userResults.slice(0, 5));
      } catch {
        setPosts([]);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  if (!open) return null;

  const hasResults = posts.length > 0 || users.length > 0;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={DS.tertiary} strokeWidth="2.5" strokeLinecap="square" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="global-search"
            className={styles.input}
            type="text"
            placeholder="Search posts and people…"
            autoFocus
            value={query}
            onChange={handleInputChange}
          />
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#888', flexShrink: 0, lineHeight: 1 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {loading && (
          <div style={{ fontSize: 12, color: '#888', padding: '8px 0' }}>Searching…</div>
        )}

        {!loading && query.trim() && !hasResults && (
          <div style={{ fontSize: 13, color: '#888', padding: '12px 0' }}>No results for &ldquo;{query}&rdquo;</div>
        )}

        {users.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
              color: DS.secondary, textTransform: 'uppercase',
              paddingBottom: 8, borderBottom: `2px solid ${DS.tertiary}`,
              marginBottom: 8,
            }}>
              People
            </div>
            {users.map(u => (
              <Link
                key={u.id}
                href={`/profile/${u.id}`}
                onClick={onClose}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', textDecoration: 'none', color: 'inherit', borderBottom: '1px solid rgba(26,26,26,0.08)' }}
              >
                <div style={{
                  width: 32, height: 32, flexShrink: 0,
                  background: DS.secondary, overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {u.avatarUrl
                    ? <img src={`${API_BASE}${u.avatarUrl}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ color: DS.primary, fontWeight: 700, fontSize: 13 }}>{u.username?.[0]?.toUpperCase()}</span>
                  }
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: DS.secondary }}>{u.username}</div>
                  {u.name && u.name !== u.username && (
                    <div style={{ fontSize: 11, color: '#888' }}>{u.name}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {posts.length > 0 && (
          <div>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
              color: DS.secondary, textTransform: 'uppercase',
              paddingBottom: 8, borderBottom: `2px solid ${DS.tertiary}`,
              marginBottom: 8,
            }}>
              Posts
            </div>
            {posts.map(p => {
              const excerpt = p.text.length > 120 ? p.text.slice(0, 120) + '…' : p.text;
              return (
                <Link
                  key={p.id}
                  href={`/profile/${p.authorId}`}
                  onClick={onClose}
                  style={{ display: 'block', padding: '8px 0', textDecoration: 'none', color: 'inherit', borderBottom: '1px solid rgba(26,26,26,0.08)' }}
                >
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>
                    {p.author?.username ?? p.authorId} · {timeAgo(p.timestamp)}
                  </div>
                  <div style={{ fontSize: 13, color: DS.tertiary, lineHeight: 1.45 }}>{excerpt}</div>
                </Link>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 20, paddingTop: 14, borderTop: `2px solid ${DS.tertiary}` }}>
          <button
            onClick={() => {
              onClose();
              router.push(`/search/advanced${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`);
            }}
            style={{
              width: '100%', padding: '10px 16px',
              background: DS.secondary, color: DS.primary,
              border: `2px solid ${DS.tertiary}`, cursor: 'pointer',
              fontSize: 11, fontWeight: 800, letterSpacing: '0.14em',
              textTransform: 'uppercase', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <span>Advanced Search</span>
            <span style={{ fontSize: 16 }}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
