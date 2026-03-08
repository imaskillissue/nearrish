'use client'

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet';
import { useEffect, useCallback } from 'react'
import MiniEventCard from './MiniEventCard'

import 'leaflet/dist/leaflet.css'

type MapProps = {
  events: any[];
  onEventClick: (event: any | null) => void;
  selectedEvent: any | null;
};

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const selectedIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const BERLIN_CENTER: [number, number] = [52.52, 13.405];

function hasCoords(event: any): boolean {
  return Number.isFinite(event?.lat) && Number.isFinite(event?.lng);
}

function SelectedEventPopup({ event, onClose }: { event: any, onClose: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (hasCoords(event)) {
      map.panTo([event.lat, event.lng], { animate: true });
    }
  }, [event, map]);
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);
  if (!hasCoords(event)) return null;
  return (
    <Popup
      position={[event.lat, event.lng]}
      eventHandlers={{ remove: handleClose, popupclose: handleClose }}
    >
      <MiniEventCard event={event} onClose={handleClose} />
    </Popup>
  );
}

export default function Map({ events, onEventClick, selectedEvent }: MapProps) {
  return (
    <MapContainer center={BERLIN_CENTER} zoom={13} style={{ height: '100%', width: '100%', borderRadius: '18px', overflow: 'hidden' }}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> contributors'
      />
      {events.filter(hasCoords).map(event => (
        <Marker
          key={event.id}
          position={[event.lat, event.lng]}
          icon={selectedEvent?.id === event.id ? selectedIcon : defaultIcon}
          eventHandlers={{ click: () => onEventClick(event) }}
        />
      ))}
      {hasCoords(selectedEvent) && (
        <SelectedEventPopup event={selectedEvent} onClose={() => onEventClick(null)} />
      )}
    </MapContainer>
  )
}