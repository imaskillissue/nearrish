'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './lib/auth-context';
import Hero from './components/Hero';
import Footer from './components/Footer';
import PostFeed from './components/PostFeed';

export default function Home() {
  const { status } = useAuth();
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('session_expired')) {
      sessionStorage.removeItem('session_expired');
      setSessionExpired(true);
    }
  }, []);

  return (
    <main style={{ paddingTop: '80px', backgroundColor: '#c5eddf', minHeight: '100vh' }}>
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
          <Hero />
          <PostFeed readOnly />
          <Footer />
        </>
      )}
    </main>
  );
}
