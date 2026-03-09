'use client'

import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet'
import L from 'leaflet';
import { useEffect, useRef, useCallback } from 'react'
import MiniPostCard from './MiniPostCard'
import { API_BASE } from '../lib/api'

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

/** Picks a relevant emoji based on keywords found in post text. */
function getEmojiForPost(text: string): string {
  const t = text.toLowerCase();
  if (t.match(/basketball|hoops|nba/)) return '🏀';
  if (t.match(/football|soccer|fußball|fussball/)) return '⚽';
  if (t.match(/tennis/)) return '🎾';
  if (t.match(/volleyball/)) return '🏐';
  if (t.match(/swim|pool|swimming/)) return '🏊';
  if (t.match(/run|jog|marathon|laufen/)) return '🏃';
  if (t.match(/bike|cycling|fahrrad/)) return '🚴';
  if (t.match(/coffee|cafe|kaffee/)) return '☕';
  if (t.match(/beer|bier|bar|pub/)) return '🍺';
  if (t.match(/food|eat|restaurant|pizza|burger|essen/)) return '🍕';
  if (t.match(/music|concert|gig|band|live/)) return '🎵';
  if (t.match(/art|museum|gallery|ausstellung/)) return '🎨';
  if (t.match(/dog|hund|puppy/)) return '🐕';
  if (t.match(/park|nature|wald|forest/)) return '🌳';
  if (t.match(/party|club|nightlife/)) return '🎉';
  if (t.match(/photo|foto|picture/)) return '📸';
  if (t.match(/book|read|lesen/)) return '📚';
  if (t.match(/work|office|job|büro/)) return '💼';
  return '💬';
}

/**
 * Creates a custom Leaflet DivIcon: a circular image cutout (or emoji fallback)
 * with a thin vertical line anchored to the coordinate below.
 */
function createPostIcon(post: MapPost, isSelected: boolean): L.DivIcon {
  // Image pins: 44px / 56px. Emoji pins: a bit larger so the emoji has room to breathe.
  const imgSize   = isSelected ? 56 : 44;
  const emojiSize = isSelected ? 68 : 56;
  const size      = post.imageUrl ? imgSize : emojiSize;
  const lineH     = 18;
  const borderColor = isSelected ? '#e74c3c' : '#1a5c2a';
  const shadow = isSelected
    ? '0 4px 12px rgba(231,76,60,0.45)'
    : '0 2px 8px rgba(0,0,0,0.22)';

  let circleHtml: string;

  if (post.imageUrl) {
    // Circular image cutout — green bg shows if image fails to load
    circleHtml = `<div style="
      width:${size}px;height:${size}px;
      border-radius:50%;overflow:hidden;
      border:2px solid ${borderColor};
      box-shadow:${shadow};
      background:#1a5c2a;
      flex-shrink:0;
    "><img
      src="${API_BASE}${post.imageUrl}"
      style="width:100%;height:100%;object-fit:cover;display:block;"
    /></div>`;
  } else {
    // Emoji IS the pin head — big, white background, thin green ring
    const emoji    = getEmojiForPost(post.text);
    const fontSize = Math.round(size * 0.72);   // fills ~72 % of the circle
    circleHtml = `<div style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background:#fff;
      border:2px solid ${borderColor};
      box-shadow:${shadow};
      display:flex;align-items:center;justify-content:center;
      font-size:${fontSize}px;line-height:1;
      flex-shrink:0;
    ">${emoji}</div>`;
  }

  const html = `<div style="
    display:flex;flex-direction:column;align-items:center;
    width:${size}px;
  ">
    ${circleHtml}
    <div style="
      width:2px;height:${lineH}px;
      background:${borderColor};
      flex-shrink:0;
    "></div>
  </div>`;

  return L.divIcon({
    html,
    className: '',                          // strip Leaflet's default white-box style
    iconSize:   [size, size + lineH],
    iconAnchor: [size / 2, size + lineH],   // bottom of the line = exact coordinate
    popupAnchor:[0, -(size + lineH + 6)],   // popup appears above the circle
  });
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

      {posts.filter(hasCoords).map(post => (
        <Marker
          key={post.id}
          position={[post.lat, post.lng]}
          icon={createPostIcon(post, selectedPost?.id === post.id)}
          eventHandlers={{ click: () => onPostClick(post) }}
        />
      ))}
      {hasCoords(selectedPost) && (
        <SelectedPostPopup post={selectedPost} onClose={() => onPostClick(null)} />
      )}
    </MapContainer>
  )
}
