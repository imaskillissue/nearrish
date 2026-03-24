'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { DS } from '../lib/tokens';
import Hero from './Hero';
import PostFeed, { type Post } from './PostFeed';

export default function HomeClient({ initialPosts }: { initialPosts?: Post[] } = {}) {
  const { status } = useAuth();
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('session_expired')) {
      sessionStorage.removeItem('session_expired');
      setSessionExpired(true);
    }
  }, []);

  return (
    <main style={{ paddingTop: '72px', backgroundColor: DS.bg, minHeight: '100vh' }}>
      {sessionExpired && (
        <div style={{
          background: '#fef3cd', borderBottom: '1px solid #f0c040',
          padding: '0.75rem 1.5rem', textAlign: 'center',
          fontSize: 14, color: '#7a5c00', fontWeight: 500,
        }}>
          Your session has expired. Please log in again.
        </div>
      )}
      {status === 'authenticated' ? (
        <PostFeed />
      ) : (
        <>
          {status === 'unauthenticated' && <Hero />}
          <PostFeed readOnly initialPosts={initialPosts} />
        </>
      )}
    </main>
  );
}
