"use client";
import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api";
import styles from "./SearchModal.module.css";

type GlobalSearchModalProps = {
  open: boolean;
  onClose: () => void;
};

type UserResult = {
  id: string;
  username: string;
  avatarUrl?: string | null;
};

export default function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
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
      const all = await apiFetch<UserResult[]>("/api/public/users");
      const q = value.trim().toLowerCase();
      setResults(all.filter(u => u.username.toLowerCase().includes(q)).slice(0, 8));
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
        <h2>Search Users</h2>
        <form onSubmit={handleSearch}>
          <input
            className={styles.input}
            type="text"
            placeholder="Search by username..."
            autoFocus
            value={query}
            onChange={handleInputChange}
          />
        </form>
        {loading && <div>Searching...</div>}
        {error && <div style={{ color: 'red' }}>{error}</div>}
        <ul style={{ marginTop: 16, listStyle: 'none', padding: 0 }}>
          {results.map(u => (
            <li key={u.id} style={{ marginBottom: 8 }}>
              <Link href={`/profile/${u.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, transition: 'background 0.2s' }} onClick={onClose}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a5c2a', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {u.avatarUrl
                    ? <img src={u.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{u.username[0]?.toUpperCase()}</span>}
                </div>
                <b>{u.username}</b>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

