"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (lat: number | null, lng: number | null) => void;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 15, { duration: 0.8 });
  }, [map, lat, lng]);
  return null;
}

export default function LocationPicker({
  latitude,
  longitude,
  onLocationChange,
  gpsLatitude,
  gpsLongitude,
}: LocationPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);

  const hasLocation = latitude !== null && longitude !== null;
  const hasGps = gpsLatitude !== null && gpsLongitude !== null;

  const center: [number, number] = [
    latitude ?? gpsLatitude ?? 48.2082,
    longitude ?? gpsLongitude ?? 16.3738,
  ];

  const handleUseGps = () => {
    if (hasGps) {
      onLocationChange(gpsLatitude, gpsLongitude);
      setFlyTarget({ lat: gpsLatitude!, lng: gpsLongitude! });
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    onLocationChange(lat, lng);
  };

  const handleClear = () => {
    onLocationChange(null, null);
    setFlyTarget(null);
  };

  if (!isOpen) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            if (!hasLocation && hasGps) {
              handleUseGps();
            }
          }}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {hasLocation ? "Edit location" : "Add location"}
        </button>
        {hasLocation && (
          <span className="text-xs text-green-600">
            Location set ({latitude!.toFixed(4)}, {longitude!.toFixed(4)})
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-600">
          {hasLocation
            ? `Location: ${latitude!.toFixed(4)}, ${longitude!.toFixed(4)}`
            : "Click the map or use GPS"}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUseGps}
            disabled={!hasGps}
            className="text-xs px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4m10-10h-4M6 12H2" />
            </svg>
            GPS
          </button>
          {hasLocation && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs px-2 py-1 rounded-md bg-red-100 text-red-600 hover:bg-red-200"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-xs px-2 py-1 rounded-md bg-gray-200 text-gray-600 hover:bg-gray-300"
          >
            Done
          </button>
        </div>
      </div>
      <div className="h-48">
        <MapContainer
          center={center}
          zoom={hasLocation ? 15 : 13}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onClick={handleMapClick} />
          {flyTarget && <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} />}
          {hasLocation && (
            <Marker position={[latitude!, longitude!]} />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
