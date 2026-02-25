"use client";
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import EventCard from '../../components/EventCard';

export default function EventDetailPage() {
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string } | null)?.id ?? null;
  const params = useParams();
  const eventId = params?.id;
  const [event, setEvent] = useState<any | null>(null);
  const [attending, setAttending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    fetch(`/api/events/${eventId}`)
      .then(r => {
        if (!r.ok) throw new Error("Event nicht gefunden");
        return r.json();
      })
      .then(setEvent)
      .catch(() => setError("Event nicht gefunden"))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    if (!currentUserId || !eventId) {
      setAttending(false);
      return;
    }
    fetch('/api/events/attending')
      .then(r => (r.ok ? r.json() : []))
      .then((ids: string[]) => setAttending(ids.includes(String(eventId))))
      .catch(() => setAttending(false));
  }, [currentUserId, eventId]);

  async function handleAttend(id: string) {
    if (!currentUserId || !event) return;
    setAttending(true);
    setEvent((prev: any) => prev ? {
      ...prev,
      _count: { attendees: Number(prev._count?.attendees ?? 0) + 1 },
    } : prev);
    const res = await fetch(`/api/events/${id}/attend`, { method: 'POST' });
    if (!res.ok) {
      setAttending(false);
      setEvent((prev: any) => prev ? {
        ...prev,
        _count: { attendees: Math.max(0, Number(prev._count?.attendees ?? 1) - 1) },
      } : prev);
    }
  }

  async function handleUnattend(id: string) {
    if (!currentUserId || !event) return;
    setAttending(false);
    setEvent((prev: any) => prev ? {
      ...prev,
      _count: { attendees: Math.max(0, Number(prev._count?.attendees ?? 0) - 1) },
    } : prev);
    const res = await fetch(`/api/events/${id}/attend`, { method: 'DELETE' });
    if (!res.ok) {
      setAttending(true);
      setEvent((prev: any) => prev ? {
        ...prev,
        _count: { attendees: Number(prev._count?.attendees ?? 0) + 1 },
      } : prev);
    }
  }

  if (loading) return <main style={{ padding: 32 }}>Lade Event ...</main>;
  if (error || !event) return <main style={{ padding: 32, color: 'red' }}>{error || "Event nicht gefunden"}</main>;

  return (
    <main style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
      <div style={{ marginTop: '10%' }}>
        <EventCard
          event={event}
          currentUserId={currentUserId}
          attending={attending}
          onAttend={handleAttend}
          onUnattend={handleUnattend}
        />
      </div>
    </main>
  );
}
