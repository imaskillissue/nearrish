'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
const Map = dynamic(() => import('./Map'), { ssr: false })

type MapPost = {
  id: string;
  text: string;
  authorId: string;
  timestamp: number;
  lat: number;
  lng: number;
  imageUrl?: string | null;
};

type MapWrapperProps = {
  posts: MapPost[];
  userLocation: [number, number] | null;
};

export default function MapWrapper({ posts, userLocation }: MapWrapperProps) {
  const [selectedPost, setSelectedPost] = useState<MapPost | null>(null);

  return (
    <div style={{ height: '100%', minHeight: 400, position: 'relative', width: '100%', padding: '24px' }}>
      <Map
        posts={posts}
        onPostClick={setSelectedPost}
        selectedPost={selectedPost}
        userLocation={userLocation}
      />
    </div>
  );
}
