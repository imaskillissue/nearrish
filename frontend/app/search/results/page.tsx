"use client";
import { useSearchParams } from "next/navigation";
import { useRef, useCallback } from "react";
import EventCard from "../../components/EventCard";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { H1_STYLE } from '../../lib/typography';

type SearchEvent = {
  id: string;
  creatorId: string;
  _count: { attendees: number };
  [key: string]: any;
};

export default function SearchResultsPage() {
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string } | null)?.id ?? null;
  const params = useSearchParams();
  const query = params.get("query") || "";
  const [results, setResults] = useState<SearchEvent[]>([]);
  const [attendingIds, setAttendingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setError("");
    fetch(`/api/search-events?query=${encodeURIComponent(query)}`)
      .then(res => {
        if (!res.ok) throw new Error("Fehler bei der Suche");
        return res.json();
      })
      .then(setResults)
      .catch(err => setError(err.message || "Unbekannter Fehler"))
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    if (!currentUserId) {
      setAttendingIds(new Set());
      return;
    }
    fetch('/api/events/attending')
      .then(res => (res.ok ? res.json() : []))
      .then((ids: string[]) => setAttendingIds(new Set(ids)))
      .catch(() => setAttendingIds(new Set()));
  }, [currentUserId]);

  async function handleAttend(eventId: string) {
    if (!currentUserId) return;
    setAttendingIds(prev => new Set([...prev, eventId]));
    setResults(prev => prev.map(e => e.id === eventId
      ? { ...e, _count: { attendees: Number(e._count?.attendees ?? 0) + 1 } }
      : e));

    const res = await fetch(`/api/events/${eventId}/attend`, { method: 'POST' });
    if (!res.ok) {
      setAttendingIds(prev => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
      setResults(prev => prev.map(e => e.id === eventId
        ? { ...e, _count: { attendees: Math.max(0, Number(e._count?.attendees ?? 1) - 1) } }
        : e));
    }
  }

  async function handleUnattend(eventId: string) {
    if (!currentUserId) return;
    setAttendingIds(prev => {
      const next = new Set(prev);
      next.delete(eventId);
      return next;
    });
    setResults(prev => prev.map(e => e.id === eventId
      ? { ...e, _count: { attendees: Math.max(0, Number(e._count?.attendees ?? 0) - 1) } }
      : e));

    const res = await fetch(`/api/events/${eventId}/attend`, { method: 'DELETE' });
    if (!res.ok) {
      setAttendingIds(prev => new Set([...prev, eventId]));
      setResults(prev => prev.map(e => e.id === eventId
        ? { ...e, _count: { attendees: Number(e._count?.attendees ?? 0) + 1 } }
        : e));
    }
  }

  // RollDeck-Karussell wie auf der Events-Seite
  function RollDeck({ events }: { events: SearchEvent[] }) {
    const trackRef = useRef<HTMLDivElement>(null);
    const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

    const applyTransforms = useCallback(() => {
      const track = trackRef.current;
      if (!track) return;
      const trackRect = track.getBoundingClientRect();
      const center = trackRect.height / 2;
      cardRefs.current.forEach(el => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const elCenter = rect.top - trackRect.top + rect.height / 2;
        const dist = elCenter - center;
        const t = Math.max(-1, Math.min(1, dist / (trackRect.height * 0.55)));
        el.style.transform = `rotateX(${t * 22}deg) scale(${1 - Math.abs(t) * 0.1})`;
        el.style.opacity   = String(Math.max(0.35, 1 - Math.abs(t) * 0.55));
      });
    }, []);

    useEffect(() => { cardRefs.current = cardRefs.current.slice(0, events.length); }, [events.length]);

    useEffect(() => {
      const track = trackRef.current;
      if (!track) return;
      track.addEventListener('scroll', applyTransforms, { passive: true });
      applyTransforms();
      return () => track.removeEventListener('scroll', applyTransforms);
    }, [applyTransforms]);

    useEffect(() => { applyTransforms(); }, [events, applyTransforms]);

    const TRACK_H = 600, PEEK = 90, SLIDE_H = TRACK_H - PEEK * 2;
    if (events.length === 0) return null;

    return (
      <div style={{ width: 420, height: TRACK_H, perspective: '1000px', overflow: 'hidden', margin: '0 auto' }}>
        <div ref={trackRef} style={{
          height: '100%', overflowY: 'scroll', scrollSnapType: 'y mandatory',
          boxSizing: 'border-box', padding: `${PEEK}px 0`, scrollbarWidth: 'none',
        }}>
          {events.map((ev, i) => (
            <div key={ev.id} style={{ height: SLIDE_H, display: 'flex', alignItems: 'center', justifyContent: 'center', scrollSnapAlign: 'center' }}>
              <div ref={el => { cardRefs.current[i] = el; }} style={{ transformOrigin: 'center center', willChange: 'transform, opacity' }}>
                <EventCard
                  event={ev}
                  currentUserId={currentUserId}
                  attending={attendingIds.has(ev.id)}
                  onAttend={handleAttend}
                  onUnattend={handleUnattend}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <main style={{ padding: 32, maxWidth: 600, margin: "0 auto" }}>
      <h1 style={H1_STYLE}>Results for: <span style={{ color: '#2980b9' }}>{query}</span></h1>
      {loading && <div>Searching...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {(!loading && results.length === 0 && !error) && <div>No Results.</div>}
      {results.length > 0 && <RollDeck events={results} />}
    </main>
  );
}
