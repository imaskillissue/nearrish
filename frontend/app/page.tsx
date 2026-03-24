import HomeClient from './components/HomeClient';
import { type Post } from './components/PostFeed';

async function getPublicPosts(): Promise<Post[]> {
  const base = process.env.INTERNAL_API_URL ?? 'http://localhost:8080';
  try {
    const res = await fetch(`${base}/api/public/posts/feed`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function Home() {
  const initialPosts = await getPublicPosts();
  return <HomeClient initialPosts={initialPosts} />;
}
