"use client";
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import EventCard from '../../components/EventCard';

export default function EventDetailPage() {
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const params = useParams();
  const eventId = params?.id;
  const [event, setEvent] = useState<any | null>(null);
  const [attending, setAttending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    // TODO: Connect to real backend API to fetch event
    setError("Event loading not connected to backend yet");
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    if (!currentUserId || !eventId) {
      setAttending(false);
      return;
    }
    // TODO: Connect to real backend API to check attending status
    setAttending(false);
  }, [currentUserId, eventId]);

  async function handleAttend(id: string) {
    if (!currentUserId || !event) return;
    setAttending(true);
    setEvent((prev: any) => prev ? {
      ...prev,
      _count: { attendees: Number(prev._count?.attendees ?? 0) + 1 },
    } : prev);
    // TODO: Connect to real backend API to attend event
  }

  async function handleUnattend(id: string) {
    if (!currentUserId || !event) return;
    setAttending(false);
    setEvent((prev: any) => prev ? {
      ...prev,
      _count: { attendees: Math.max(0, Number(prev._count?.attendees ?? 0) - 1) },
    } : prev);
    // TODO: Connect to real backend API to unattend event
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
