"use client";
import { useState } from "react";
import Link from "next/link";
import styles from "./SearchModal.module.css";

type GlobalSearchModalProps = {
  open: boolean;
  onClose: () => void;
};

type SearchResult = {
  id: string;
  title: string;
  address?: string | null;
  startDate?: string | null;
  price?: number | null;
  capacity?: number | null;
  _count?: { attendees?: number };
};

export default function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      window.location.href = `/search/results?query=${encodeURIComponent(query)}`;
    }
  }

  async function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // TODO: Connect to real backend API for search
      setResults([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;
  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <button onClick={onClose} style={{ float: 'right', fontSize: 24, background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Close">×</button>
        <h2>Search</h2>
        <form onSubmit={handleSearch}>
          <input
            id="global-search"
            className={styles.input}
            type="text"
            placeholder="Search..."
            autoFocus
            value={query}
            onChange={handleInputChange}
          />
        </form>
        {loading && <div>Searching...</div>}
        {error && <div style={{ color: 'red' }}>{error}</div>}
        <ul style={{ marginTop: 16 }}>
          {results.map(ev => (
            <li key={ev.id} style={{ marginBottom: 8 }}>
              <Link href={`/events/${ev.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block', padding: 8, borderRadius: 8, transition: 'background 0.2s' }} onClick={onClose}>
                <b>{ev.title}</b> <span style={{ color: '#888' }}>{ev.address}</span>
                {ev.startDate && (
                  <span style={{ marginLeft: 8, color: '#888' }}>{new Date(ev.startDate).toLocaleDateString()}</span>
                )}
                <span style={{ marginLeft: 8, color: '#666', fontWeight: 600 }}>
                  · {ev.price === 0 ? 'FREE' : `€${Number(ev.price ?? 0).toFixed(0)}`}
                </span>
                <span style={{ marginLeft: 8, color: '#666' }}>
                  · {ev.capacity === 0
                    ? `${ev._count?.attendees ?? 0} attendees`
                    : `${ev._count?.attendees ?? 0} / ${ev.capacity ?? 0} attendees`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
