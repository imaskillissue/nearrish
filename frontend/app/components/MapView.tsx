"use client";

import { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// Fix Leaflet default marker icon issue with bundlers
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

interface Post {
  id: number;
  content: string;
  authorId: string;
  moderationSeverity: number;
  moderationCategory: string;
  createdAt: string;
  latitude: number | null;
  longitude: number | null;
}

interface MapViewProps {
  latitude: number | null;
  longitude: number | null;
  currentUser: string;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function FlyToUser({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 14, { duration: 1.5 });
  }, [map, lat, lng]);
  return null;
}

function BoundsLoader({ onBoundsChange }: { onBoundsChange: (bounds: L.LatLngBounds) => void }) {
  const map = useMapEvents({
    moveend: () => {
      onBoundsChange(map.getBounds());
    },
  });

  useEffect(() => {
    onBoundsChange(map.getBounds());
  }, [map, onBoundsChange]);

  return null;
}

export default function MapView({ latitude, longitude, currentUser }: MapViewProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [newPostContent, setNewPostContent] = useState("");
  const [posting, setPosting] = useState(false);

  const center: [number, number] = [latitude ?? 48.2082, longitude ?? 16.3738];

  const fetchPosts = useCallback(async () => {
    if (!bounds) return;
    try {
      const south = bounds.getSouth();
      const north = bounds.getNorth();
      const west = bounds.getWest();
      const east = bounds.getEast();
      const res = await fetch(
        `${API_URL}/api/posts?south=${south}&north=${north}&west=${west}&east=${east}`
      );
      if (res.ok) {
        const data: Post[] = await res.json();
        // Only show posts that have location
        setPosts(data.filter(p => p.latitude !== null && p.longitude !== null));
      }
    } catch {
      // API not available
    }
  }, [bounds]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const quickPost = async () => {
    if (!newPostContent.trim() || !latitude || !longitude) return;
    setPosting(true);
    try {
      const res = await fetch(`${API_URL}/api/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newPostContent.trim(),
          authorId: currentUser,
          latitude,
          longitude,
        }),
      });
      if (res.ok) {
        setNewPostContent("");
        fetchPosts();
      }
    } catch {
      // ignore
    }
    setPosting(false);
  };

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={14}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {latitude !== null && longitude !== null && (
          <FlyToUser lat={latitude} lng={longitude} />
        )}
        <BoundsLoader onBoundsChange={setBounds} />
        {posts.map((post) => (
          <Marker key={post.id} position={[post.latitude!, post.longitude!]}>
            <Popup>
              <div className="max-w-[220px]">
                <p className="text-sm font-medium text-gray-900 mb-1">{post.content}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>@{post.authorId}</span>
                  <span>{timeAgo(post.createdAt)}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Quick post from map */}
      <div className="absolute bottom-4 left-4 right-4 z-[1000]">
        <div className="bg-white rounded-xl shadow-lg p-3 flex gap-2">
          <input
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                quickPost();
              }
            }}
            placeholder={latitude ? "Post something here..." : "Enable GPS to post"}
            disabled={!latitude}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            maxLength={5000}
          />
          <button
            onClick={quickPost}
            disabled={posting || !newPostContent.trim() || !latitude}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {posting ? "..." : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
