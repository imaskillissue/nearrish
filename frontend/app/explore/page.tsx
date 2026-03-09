'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { H1_STYLE } from '../lib/typography';
const MapWrapper = dynamic(() => import('../components/MapWrapper'), { ssr: false })

type ApiPost = {
  id: string;
  text: string;
  authorId: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  imageUrl?: string | null;
};

type MapPost = {
  id: string;
  text: string;
  authorId: string;
  timestamp: number;
  lat: number;
  lng: number;
  imageUrl?: string | null;
};

export default function ExplorePage() {
  const [posts, setPosts] = useState<MapPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Request device location on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => { /* denied or unavailable — map will fall back to first post */ },
      { timeout: 6000 }
    );
  }, []);

  useEffect(() => {
    let active = true;

    async function loadPosts() {
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch<ApiPost[]>('/api/posts/feed/geo');
        if (!active) return;

        const mapped: MapPost[] = data.map(post => ({
          id: post.id,
          text: post.text,
          authorId: post.authorId,
          timestamp: post.timestamp,
          lat: post.latitude,
          lng: post.longitude,
          imageUrl: post.imageUrl ?? null,
        }));

        setPosts(mapped);
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
  }, []);

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: 'rgba(41,128,185,0.10)',
      fontSize: 13,
      color: '#0a3a5c',
      textAlign: 'center',
      paddingTop: '100px',
    }}>
      <h1 style={H1_STYLE}>Explore</h1>
      <p>Discover posts from people nearby</p>
      {loading && <p>Loading posts...</p>}
      {error && <p style={{ color: '#c0392b' }}>{error}</p>}
      <div style={{ width: '80%', height: '80vh', margin: '20px auto' }}>
        <MapWrapper posts={posts} userLocation={userLocation} />
      </div>
    </div>
  );
}
