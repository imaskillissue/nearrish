'use client';

import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';

import 'leaflet/dist/leaflet.css';

type Props = {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
};

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

/** Recenter the map when the location prop changes (e.g. initial geolocation arrives). */
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

/** Capture map clicks and move the marker. */
function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationPicker({ lat, lng, onChange }: Props) {
  return (
    <div style={{ marginTop: 8, borderRadius: 10, overflow: 'hidden', border: '1px solid #ddd' }}>
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        style={{ height: 180, width: '100%' }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <Recenter lat={lat} lng={lng} />
        <ClickHandler onChange={onChange} />
        <Marker
          position={[lat, lng]}
          icon={markerIcon}
          draggable
          eventHandlers={{
            dragend(e) {
              const m = e.target as L.Marker;
              const pos = m.getLatLng();
              onChange(pos.lat, pos.lng);
            },
          }}
        />
      </MapContainer>
    </div>
  );
}
