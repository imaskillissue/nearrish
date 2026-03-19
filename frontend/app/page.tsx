'use client';

import { useAuth } from './lib/auth-context';
import Hero from './components/Hero';
import Footer from './components/Footer';
import PostFeed from './components/PostFeed';

export default function Home() {
  const { status } = useAuth();

  if (status === 'authenticated') {
    return (
      <main style={{ paddingTop: '80px', backgroundColor: '#c5eddf', minHeight: '100vh' }}>
        <PostFeed />
      </main>
    );
  }

  return (
    <main style={{ paddingTop: '80px', backgroundColor: '#c5eddf', minHeight: '100vh' }}>
      <Hero />
      <PostFeed readOnly />
      <Footer />
    </main>
  );
}
