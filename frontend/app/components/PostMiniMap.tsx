"use client";

import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [20, 33],
  iconAnchor: [10, 33],
  shadowSize: [33, 33],
});

interface PostMiniMapProps {
  latitude: number;
  longitude: number;
}

export default function PostMiniMap({ latitude, longitude }: PostMiniMapProps) {
  return (
    <div className="h-28 w-full rounded-lg overflow-hidden mt-2">
      <MapContainer
        center={[latitude, longitude]}
        zoom={14}
        className="h-full w-full"
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]} icon={defaultIcon} />
      </MapContainer>
    </div>
  );
}
