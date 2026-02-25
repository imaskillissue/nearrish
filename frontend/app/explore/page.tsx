'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { H1_STYLE } from '../lib/typography';
const MapWrapper = dynamic(() => import('../components/MapWrapper'), { ssr: false })

type ApiEvent = {
  id: string;
  title: string;
  startDate: string;
  price: number;
  photo?: string | null;
  lat?: number;
  lng?: number;
};

type MapEvent = {
  id: string;
  name: string;
  date?: string;
  price?: number;
  image?: string;
  photo?: string;
  lat?: number;
  lng?: number;
};

const BERLIN_CENTER = { lat: 52.52, lng: 13.405 };

function fallbackBerlinPoint(index: number, total: number) {
  const safeTotal = Math.max(1, total);
  const angle = (index / safeTotal) * Math.PI * 2;
  return {
    lat: BERLIN_CENTER.lat + Math.sin(angle) * 0.03,
    lng: BERLIN_CENTER.lng + Math.cos(angle) * 0.05,
  };
}

export default function ExplorePage() {
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadEvents() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/events');
        if (!res.ok) throw new Error('Events konnten nicht geladen werden');
        const data: ApiEvent[] = await res.json();

        if (!active) return;

        const mapped: MapEvent[] = data.map((event, index) => {
          const fallback = fallbackBerlinPoint(index, data.length);
          return {
            id: event.id,
            name: event.title,
            date: event.startDate ? new Date(event.startDate).toLocaleDateString('de-DE') : undefined,
            price: Number(event.price ?? 0),
            image: event.photo ?? '/favicon.ico',
            photo: event.photo ?? undefined,
            lat: event.lat ?? fallback.lat,
            lng: event.lng ?? fallback.lng,
          };
        });

        setEvents(mapped);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
        setEvents([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadEvents();
    return () => { active = false; };
  }, []);

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: 'rgba(41,128,185,0.10)',
      fontSize: 13,
      color: '#0a3a5c',
      opacity: 0.7,
      textAlign: 'center',
      paddingTop: '100px',
    }}>
      <h1 style={H1_STYLE}>Explore</h1>
      <p>Discover new people, events, and content here!</p>
      {loading && <p>Lade Events ...</p>}
      {error && <p style={{ color: '#c0392b' }}>{error}</p>}
      <div style={{ width: '80%', height: '80vh', margin: '20px auto' }}>
        <MapWrapper events={events} />
      </div>
    </div>
  );
}