'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../lib/auth-context'
import { apiFetch, API_BASE } from '../lib/api'
import { H1_STYLE } from '../lib/typography';
import { DS } from '../lib/tokens';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Map = dynamic(() => import('../components/Map') as any, { ssr: false }) as any

type ApiPost = {
  id: string;
  text: string;
  authorId: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  imageUrl?: string | null;
  author?: { id: string; username: string; avatarUrl?: string | null };
};

type MapPost = {
  id: string;
  text: string;
  authorId: string;
  timestamp: number;
  lat: number;
  lng: number;
  imageUrl?: string | null;
  author?: { id: string; username: string; avatarUrl?: string | null };
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

// Location name cache shared across cards
const locCache: Record<string, string> = {};

function FeedCard({ post, isActive, onClick }: {
  post: MapPost; isActive: boolean; onClick: () => void;
}) {
  const [author, setAuthor] = useState(post.author?.username ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(post.author?.avatarUrl ?? null);
  const [locationName, setLocationName] = useState<string | null>(null);

  useEffect(() => {
    if (post.author) return;
    apiFetch<{ username: string; avatarUrl?: string | null }>(`/api/public/users/${post.authorId}`)
      .then(u => { setAuthor(u.username); setAvatarUrl(u.avatarUrl ?? null); })
      .catch(() => setAuthor('?'));
  }, [post.authorId, post.author]);

  useEffect(() => {
    const key = `${post.lat.toFixed(3)},${post.lng.toFixed(3)}`;
    if (locCache[key]) { setLocationName(locCache[key]); return; }
    apiFetch<{ displayName?: string }>(`/api/public/geo/reverse?lat=${post.lat}&lng=${post.lng}`)
      .then(data => {
        const name = data.displayName || '';
        locCache[key] = name;
        setLocationName(name);
      })
      .catch(() => {});
  }, [post.lat, post.lng]);

  const truncated = post.text.length > 140 ? post.text.slice(0, 140) + '...' : post.text;

  return (
    <div
      onClick={onClick}
      style={{
        padding: '14px 16px',
        background: isActive ? DS.bg : '#fff',
        borderLeft: isActive ? '4px solid #1B2F23' : '4px solid transparent',
        cursor: 'pointer',
        transition: 'background 0.2s, border-left 0.2s',
        borderBottom: '1px solid rgba(26,26,26,0.1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: DS.secondary, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {avatarUrl
            ? <img src={`${API_BASE}${avatarUrl}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{author?.[0]?.toUpperCase() || '?'}</span>
          }
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: DS.secondary, lineHeight: 1.2 }}>{author || '...'}</div>
          <div style={{ fontSize: 10, color: '#888' }}>{timeAgo(post.timestamp)}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#333', lineHeight: 1.45, marginBottom: 6 }}>{truncated}</div>
      {post.imageUrl && (
        <img
          src={`${API_BASE}${post.imageUrl}`}
          alt=""
          style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 0, marginBottom: 6 }}
        />
      )}
      <div style={{ fontSize: 11, color: '#888' }}>
        {locationName || `${post.lat.toFixed(2)}, ${post.lng.toFixed(2)}`}
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const { status } = useAuth();
  const [posts, setPosts] = useState<MapPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [selectedPost, setSelectedPost] = useState<MapPost | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const timer = setTimeout(() => window.dispatchEvent(new Event('resize')), 310);
    return () => clearTimeout(timer);
  }, [panelOpen]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { timeout: 6000 }
    );
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    let active = true;
    async function loadPosts() {
      setLoading(true);
      setError('');
      try {
        const endpoint = status === 'authenticated'
          ? '/api/posts/feed/geo'
          : '/api/public/posts/feed/geo';
        const data = await apiFetch<ApiPost[]>(endpoint);
        if (!active) return;
        setPosts(data.map(p => ({
          id: p.id, text: p.text, authorId: p.authorId,
          timestamp: p.timestamp, lat: p.latitude, lng: p.longitude,
          imageUrl: p.imageUrl ?? null,
          author: p.author,
        })));
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Failed to load posts');
        setPosts([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadPosts();
    return () => { active = false; };
  }, [status]);

  // Detect which post is in the center of the feed while scrolling
  useEffect(() => {
    const feed = feedRef.current;
    if (!feed || !panelOpen) return;

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const feedRect = feed.getBoundingClientRect();
        const targetY = feedRect.top + feedRect.height / 3;
        let closest: MapPost | null = null;
        let closestDist = Infinity;

        for (const [id, el] of Object.entries(cardRefs.current)) {
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          const dist = Math.abs(rect.top + rect.height / 2 - targetY);
          if (dist < closestDist) {
            closestDist = dist;
            closest = posts.find(p => p.id === id) || null;
          }
        }

        if (closest && (closest as MapPost).id !== selectedPost?.id) {
          setSelectedPost(closest);
        }
        ticking = false;
      });
    };

    feed.addEventListener('scroll', handleScroll, { passive: true });
    return () => feed.removeEventListener('scroll', handleScroll);
  }, [posts, panelOpen, selectedPost?.id]);

  // Pin click on map → scroll feed to that card
  const handleMapPostClick = useCallback((post: MapPost | null) => {
    setSelectedPost(post);
    if (post && panelOpen) {
      const el = cardRefs.current[post.id];
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [panelOpen]);

  const handleFeedCardClick = useCallback((post: MapPost) => {
    setSelectedPost(post);
  }, []);

  const setCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current[id] = el;
    else delete cardRefs.current[id];
  }, []);

  return (
    <div style={{
      width: '100%',
      height: isMobile ? 'auto' : '100vh',
      minHeight: isMobile ? '100vh' : undefined,
      background: DS.bg,
      display: 'flex', flexDirection: 'column',
      overflow: isMobile ? 'visible' : 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '88px 0 12px', background: DS.bg, flexShrink: 0 }}>
        <div style={{ maxWidth: 960, width: '100%', margin: '0 auto', padding: '0 16px' }}>
          <h1 style={{ ...H1_STYLE, marginBottom: 4 }}>Explore</h1>
          <p style={{ margin: 0, fontSize: 13, color: DS.tertiary, fontWeight: 500 }}>
            Discover posts from people nearby
            {posts.length > 0 && ` \u2014 ${posts.length} posts with location`}
          </p>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 20, color: '#888' }}>Loading posts...</div>
      )}
      {error && (
        <div style={{ textAlign: 'center', padding: 20, color: '#c0392b' }}>{error}</div>
      )}

      {/* Split view: map + feed panel */}
      <div style={{
        flex: isMobile ? undefined : 1,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        overflow: isMobile ? 'visible' : 'hidden',
        position: 'relative',
        maxWidth: 960, width: '100%', margin: '0 auto 4rem',
      }}>
        {/* Map area */}
        <div style={{
          flex: isMobile ? undefined : 1,
          height: isMobile ? '50vh' : undefined,
          minWidth: 0, padding: isMobile ? 16 : (panelOpen ? '16px 0 16px 16px' : 16),
        }}>
          <div style={{
            height: '100%', borderRadius: 0, overflow: 'hidden',
            boxShadow: '4px 4px 0px 0px #1B2F23',
            border: `2px solid ${DS.tertiary}`,
          }}>
            <Map
              posts={posts}
              onPostClick={handleMapPostClick}
              selectedPost={selectedPost}
              userLocation={userLocation}
            />
          </div>
        </div>


        {/* Toggle button — desktop only */}
        {!isMobile && (
          <button
            onClick={() => setPanelOpen(o => !o)}
            style={{
              position: 'absolute',
              right: panelOpen ? 406 : 8,
              top: 20,
              zIndex: 1000,
              width: 34, height: 34,
              borderRadius: '50%',
              border: '2px solid #1B2F23',
              background: '#fff',
              color: DS.secondary,
              fontWeight: 700, fontSize: 15,
              cursor: 'pointer',
              boxShadow: '4px 4px 0px 0px #1B2F23',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'right 0.3s ease',
            }}
            title={panelOpen ? 'Hide feed' : 'Show feed'}
          >
            {panelOpen ? '\u203A' : '\u2039'}
          </button>
        )}

        {/* Feed panel */}
        <div style={{
          width: isMobile ? '100%' : (panelOpen ? 412 : 0),
          flexShrink: isMobile ? undefined : 0,
          transition: isMobile ? undefined : 'width 0.3s ease',
          overflow: isMobile ? 'visible' : 'hidden',
        }}>
          {/* Inner padding — mirrors the map's padding: 16 wrapper */}
          <div style={{
            padding: isMobile ? 16 : '16px 16px 16px 0',
            height: isMobile ? 'auto' : '100%',
            boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Styled box — mirrors map's border + shadow */}
            <div style={{
              flex: isMobile ? undefined : 1,
              overflow: isMobile ? 'visible' : 'hidden',
              border: `2px solid ${DS.tertiary}`,
              boxShadow: '4px 4px 0px 0px #1B2F23',
              background: '#fff',
              display: 'flex', flexDirection: 'column',
            }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '2px solid rgba(26,26,26,0.1)',
            fontWeight: 700, fontSize: 11,
            color: DS.secondary,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            flexShrink: 0,
          }}>
            Nearby Posts
          </div>
          <div ref={feedRef} style={{
            flex: isMobile ? undefined : 1,
            overflowY: isMobile ? 'visible' : 'auto',
            overflowX: 'hidden',
          }}>
            {posts.length === 0 && !loading && (
              <div style={{ padding: 24, textAlign: 'center', color: '#888', fontSize: 13 }}>
                No geo-tagged posts yet.
              </div>
            )}
            {posts.map(post => (
              <div key={post.id} ref={el => setCardRef(post.id, el)}>
                <FeedCard
                  post={post}
                  isActive={selectedPost?.id === post.id}
                  onClick={() => handleFeedCardClick(post)}
                />
              </div>
            ))}
          </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
