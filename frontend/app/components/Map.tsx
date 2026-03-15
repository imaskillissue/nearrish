'use client'

import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet'
import L from 'leaflet';
import { useEffect, useRef, useCallback, useState } from 'react'
import MiniPostCard from './MiniPostCard'
import { apiFetch, API_BASE } from '../lib/api'

import 'leaflet/dist/leaflet.css'

type MapPost = {
  id: string;
  text: string;
  authorId: string;
  timestamp: number;
  lat: number;
  lng: number;
  imageUrl?: string | null;
};

type MapProps = {
  posts: MapPost[];
  onPostClick: (post: MapPost | null) => void;
  selectedPost: MapPost | null;
  userLocation: [number, number] | null;
};

const BERLIN_CENTER: [number, number] = [52.52, 13.405];

function hasCoords(post: MapPost | null): post is MapPost {
  return post != null && Number.isFinite(post.lat) && Number.isFinite(post.lng);
}

// Cache for author avatars: authorId → { username, avatarUrl }
const avatarCache: Record<string, { username: string; avatarUrl: string | null }> = {};

/**
 * Creates a custom Leaflet DivIcon: a circular avatar pin
 * with a thin vertical line anchored to the coordinate below.
 */
function createPostIcon(avatarUrl: string | null, username: string, isSelected: boolean): L.DivIcon {
  const size = isSelected ? 52 : 42;
  const lineH = 16;
  const borderColor = isSelected ? '#e74c3c' : '#1a5c2a';
  const shadow = isSelected
    ? '0 4px 12px rgba(231,76,60,0.45)'
    : '0 2px 8px rgba(0,0,0,0.22)';

  const letter = username ? username[0].toUpperCase() : '?';
  const innerContent = avatarUrl
    ? `<img src="${API_BASE}${avatarUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" />`
    : `<span style="color:#fff;font-weight:700;font-size:${Math.round(size * 0.45)}px;font-family:inherit;">${letter}</span>`;

  const html = `<div style="
    display:flex;flex-direction:column;align-items:center;
    width:${size}px;
  ">
    <div style="
      width:${size}px;height:${size}px;
      border-radius:50%;overflow:hidden;
      border:3px solid ${borderColor};
      box-shadow:${shadow};
      background:#1a5c2a;
      display:flex;align-items:center;justify-content:center;
      flex-shrink:0;
    ">${innerContent}</div>
    <div style="
      width:0;height:0;
      border-left:6px solid transparent;
      border-right:6px solid transparent;
      border-top:${lineH}px solid ${borderColor};
      flex-shrink:0;
    "></div>
  </div>`;

  return L.divIcon({
    html,
    className: '',
    iconSize:   [size, size + lineH],
    iconAnchor: [size / 2, size + lineH],
    popupAnchor:[0, -(size + lineH + 6)],
  });
}

/** Reusable avatar pin for the location picker (current user). */
export function createAvatarPinIcon(avatarUrl: string | null, username: string): L.DivIcon {
  return createPostIcon(avatarUrl, username, false);
}

// Sets the initial map view once: user location → first post → Berlin fallback
function MapInitController({ userLocation, posts }: { userLocation: [number, number] | null; posts: MapPost[] }) {
  const map = useMap();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;

    if (userLocation) {
      map.setView(userLocation, 13);
      initialized.current = true;
    } else {
      const first = posts.find(hasCoords);
      if (first) {
        map.setView([first.lat, first.lng], 11);
        initialized.current = true;
      }
      // if no posts yet, keep Berlin until one arrives
    }
  }, [userLocation, posts, map]);

  return null;
}

function SelectedPostPopup({ post, onClose }: { post: MapPost, onClose: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (hasCoords(post)) {
      map.panTo([post.lat, post.lng], { animate: true });
    }
  }, [post, map]);
  const handleClose = useCallback(() => { onClose(); }, [onClose]);
  if (!hasCoords(post)) return null;
  return (
    <Popup
      position={[post.lat, post.lng]}
      eventHandlers={{ remove: handleClose, popupclose: handleClose }}
    >
      <MiniPostCard post={post} onClose={handleClose} />
    </Popup>
  );
}

export default function Map({ posts, onPostClick, selectedPost, userLocation }: MapProps) {
  const [avatars, setAvatars] = useState<Record<string, { username: string; avatarUrl: string | null }>>({});

  // Fetch avatars for all unique authorIds
  useEffect(() => {
    const authorIds = [...new Set(posts.map(p => p.authorId))];
    const missing = authorIds.filter(id => !avatarCache[id]);
    if (missing.length === 0) {
      setAvatars({ ...avatarCache });
      return;
    }
    Promise.all(
      missing.map(id =>
        apiFetch<{ username: string; avatarUrl?: string | null }>(`/api/public/users/${id}`)
          .then(u => { avatarCache[id] = { username: u.username, avatarUrl: u.avatarUrl ?? null }; })
          .catch(() => { avatarCache[id] = { username: '?', avatarUrl: null }; })
      )
    ).then(() => setAvatars({ ...avatarCache }));
  }, [posts]);

  return (
    <MapContainer center={BERLIN_CENTER} zoom={13} style={{ height: '100%', width: '100%', borderRadius: '18px', overflow: 'hidden' }}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> contributors'
      />

      <MapInitController userLocation={userLocation} posts={posts} />

      {/* "You are here" dot */}
      {userLocation && (
        <CircleMarker
          center={userLocation}
          radius={10}
          pathOptions={{ color: '#1a5c2a', fillColor: '#27ae60', fillOpacity: 0.85, weight: 2 }}
        />
      )}

      {posts.filter(hasCoords).map(post => {
        const author = avatars[post.authorId] || { username: '?', avatarUrl: null };
        return (
          <Marker
            key={post.id}
            position={[post.lat, post.lng]}
            icon={createPostIcon(author.avatarUrl, author.username, selectedPost?.id === post.id)}
            eventHandlers={{ click: () => onPostClick(post) }}
          />
        );
      })}
      {hasCoords(selectedPost) && (
        <SelectedPostPopup post={selectedPost} onClose={() => onPostClick(null)} />
      )}
    </MapContainer>
  )
}
