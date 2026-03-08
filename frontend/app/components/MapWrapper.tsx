'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
const Map = dynamic(() => import('./Map'), { ssr: false })

type Event = {
  id: string;
  name: string;
  date?: string;
  price?: number;
  image?: string;
  lat?: number;
  lng?: number;
};

type MapWrapperProps = {
  events: Event[];
};

export default function MapWrapper({ events }: MapWrapperProps) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  return (
    <div
      style={{ height: '100%', minHeight: 400, position: 'relative', width: '100%', padding: '24px' }}
    >
      <Map
        events={events}
        onEventClick={setSelectedEvent}
        selectedEvent={selectedEvent}
      />

      {/* Card-Overlay jetzt als echtes Popup direkt am Marker in Map.tsx */}
    </div>
  );
}