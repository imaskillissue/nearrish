"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, API_BASE } from "../../lib/api";
import { DS } from "../../lib/tokens";
import { TYPE } from "../../lib/typography";

// ── Types ─────────────────────────────────────────────────────────────────────

type ContentType = "posts" | "comments" | "users";
type SortOption  = "recent" | "likes" | "comments" | "toxicity" | "closest";

type PostResult = {
  id: string; text: string; authorId: string; timestamp: number;
  likeCount: number; commentCount: number;
  moderationSeverity?: number | null; moderationCategory?: string | null;
  latitude?: number | null; longitude?: number | null;
  author?: { id: string; username: string; avatarUrl?: string | null };
};
type CommentResult = {
  id: string; content: string; postId: string; createdAt: number;
  likeCount: number;
  author?: { id: string; username: string; avatarUrl?: string | null };
};
type UserResult = { id: string; username: string; name?: string | null; avatarUrl?: string | null };
type SearchResponse = {
  type: string; total: number; page: number; size: number; hasMore: boolean;
  results: PostResult[] | CommentResult[] | UserResult[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ms: number) {
  const d = Date.now() - ms;
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TOXICITY_LABEL: Record<number, string> = {
  0: "clean", 1: "borderline", 2: "inappropriate", 3: "harmful", 4: "severe",
};
const TOXICITY_COLOR: Record<number, string> = {
  0: "#22c55e", 1: "#eab308", 2: "#f97316", 3: "#ef4444", 4: "#7f1d1d",
};

// ── Subcomponents ─────────────────────────────────────────────────────────────

function Avatar({ url, username }: { url?: string | null; username: string }) {
  return (
    <div style={{
      width: 28, height: 28, flexShrink: 0, background: DS.secondary, overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {url
        ? <img src={`${API_BASE}${url}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ color: DS.primary, fontWeight: 700, fontSize: 11 }}>{username?.[0]?.toUpperCase()}</span>
      }
    </div>
  );
}

function ToxicityBadge({ severity }: { severity?: number | null }) {
  if (severity == null || severity === 0) return null;
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
      padding: "2px 6px", background: TOXICITY_COLOR[severity] ?? "#888", color: "#fff",
    }}>
      ☣ {TOXICITY_LABEL[severity] ?? `sev. ${severity}`}
    </span>
  );
}

function PostCard({ post }: { post: PostResult }) {
  const excerpt = post.text.length > 200 ? post.text.slice(0, 200) + "…" : post.text;
  return (
    <Link href={`/profile/${post.authorId}`} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
      <div style={{
        border: `2px solid ${DS.tertiary}`, padding: "14px 16px", marginBottom: 10,
        background: "#fff", boxShadow: "4px 4px 0px 0px #1B2F23",
        transition: "box-shadow 0.1s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Avatar url={post.author?.avatarUrl} username={post.author?.username ?? "?"} />
          <span style={{ fontWeight: 700, fontSize: 12, color: DS.secondary }}>
            {post.author?.username ?? post.authorId}
          </span>
          <span style={{ fontSize: 11, color: DS.textMuted, marginLeft: "auto" }}>{timeAgo(post.timestamp)}</span>
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.5, color: DS.tertiary }}>{excerpt}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: DS.textMuted }}>♥ {post.likeCount}</span>
          <span style={{ fontSize: 11, color: DS.textMuted }}>💬 {post.commentCount}</span>
          {post.latitude != null && (
            <span style={{ fontSize: 11, color: DS.textMuted }}>📍 geo</span>
          )}
          <ToxicityBadge severity={post.moderationSeverity} />
        </div>
      </div>
    </Link>
  );
}

function CommentCard({ comment }: { comment: CommentResult }) {
  const excerpt = comment.content.length > 200 ? comment.content.slice(0, 200) + "…" : comment.content;
  return (
    <div style={{
      border: `2px solid ${DS.tertiary}`, padding: "12px 16px", marginBottom: 10,
      background: "#fff", boxShadow: "4px 4px 0px 0px #1B2F23",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Avatar url={comment.author?.avatarUrl} username={comment.author?.username ?? "?"} />
        <Link href={`/profile/${comment.author?.id}`} style={{ fontWeight: 700, fontSize: 12, color: DS.secondary, textDecoration: "none" }}>
          {comment.author?.username ?? "Unknown"}
        </Link>
        <span style={{ fontSize: 11, color: DS.textMuted, marginLeft: "auto" }}>{timeAgo(comment.createdAt)}</span>
      </div>
      <p style={{ margin: "0 0 8px", fontSize: 13, lineHeight: 1.5, color: DS.tertiary }}>{excerpt}</p>
      <span style={{ fontSize: 11, color: DS.textMuted }}>♥ {comment.likeCount}</span>
    </div>
  );
}

function UserCard({ user }: { user: UserResult }) {
  return (
    <Link href={`/profile/${user.id}`} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
      <div style={{
        border: `2px solid ${DS.tertiary}`, padding: "12px 16px", marginBottom: 10,
        background: "#fff", boxShadow: "4px 4px 0px 0px #1B2F23",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <Avatar url={user.avatarUrl} username={user.username} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: DS.secondary }}>{user.username}</div>
          {user.name && user.name !== user.username && (
            <div style={{ fontSize: 11, color: DS.textMuted }}>{user.name}</div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Pill button ───────────────────────────────────────────────────────────────

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 12px", border: `2px solid ${DS.tertiary}`, cursor: "pointer",
      fontFamily: "inherit", fontSize: 10, fontWeight: 800,
      letterSpacing: "0.12em", textTransform: "uppercase",
      background: active ? DS.secondary : "transparent",
      color: active ? DS.primary : DS.tertiary,
      transition: "background 0.1s, color 0.1s",
    }}>
      {label}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdvancedSearchPage() {
  return (
    <Suspense>
      <AdvancedSearchContent />
    </Suspense>
  );
}

function AdvancedSearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [query,       setQuery]       = useState(searchParams.get("q") ?? "");
  const [type,        setType]        = useState<ContentType>("posts");
  const [sort,        setSort]        = useState<SortOption>("recent");
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [lat,         setLat]         = useState<number | null>(null);
  const [lng,         setLng]         = useState<number | null>(null);
  const [locError,    setLocError]    = useState("");

  const [results,  setResults]  = useState<SearchResponse | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [page,     setPage]     = useState(0);
  const [allItems, setAllItems] = useState<(PostResult | CommentResult | UserResult)[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When sort changes to "closest", prompt for location
  useEffect(() => {
    if (sort === "closest" && lat === null) {
      requestLocation();
    }
  }, [sort]);

  // Reset page + results when query/type/sort/friendsOnly changes
  useEffect(() => {
    setPage(0);
    setAllItems([]);
    setResults(null);
  }, [query, type, sort, friendsOnly]);

  // Debounced search trigger
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(0, true), query ? 300 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, type, sort, friendsOnly, lat, lng]);

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocError("Geolocation not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); setLocError(""); },
      ()  => setLocError("Location access denied — closest sort unavailable."),
    );
  }

  async function runSearch(targetPage: number, reset: boolean) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        q: query.trim(),
        type,
        sort,
        friendsOnly: String(friendsOnly),
        page: String(targetPage),
        size: "20",
      });
      if (sort === "closest" && lat !== null && lng !== null) {
        params.set("lat", String(lat));
        params.set("lng", String(lng));
      }
      const data = await apiFetch<SearchResponse>(`/api/search/advanced?${params}`);
      setResults(data);
      setPage(targetPage);
      if (reset) {
        setAllItems(data.results as (PostResult | CommentResult | UserResult)[]);
      } else {
        setAllItems(prev => [...prev, ...(data.results as (PostResult | CommentResult | UserResult)[])]);
      }
    } catch (e: any) {
      setError(e.message ?? "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  function loadMore() {
    runSearch(page + 1, false);
  }

  const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: "recent",   label: "Most Recent" },
    { value: "likes",    label: "Most Likes" },
    { value: "comments", label: "Most Comments" },
    { value: "toxicity", label: "Highest Toxicity" },
    { value: "closest",  label: "Closest" },
  ];

  const TYPE_OPTIONS: { value: ContentType; label: string }[] = [
    { value: "posts",    label: "Posts" },
    { value: "comments", label: "Comments" },
    { value: "users",    label: "Users" },
  ];

  return (
    <main style={{ minHeight: "100vh", background: DS.bg, paddingTop: 80, paddingBottom: 60 }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 1.5rem" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", color: DS.textMuted, textTransform: "uppercase", marginBottom: 6 }}>
            Nearrish
          </div>
          <h1 style={{ margin: 0, fontSize: TYPE.size["2xl"], fontWeight: 900, letterSpacing: "-0.04em", textTransform: "uppercase", color: DS.tertiary, lineHeight: 1 }}>
            Advanced Search
          </h1>
        </div>

        {/* Search input */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DS.textMuted} strokeWidth="2.5" strokeLinecap="square"
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="advanced-search-query"
            name="q"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search anything…"
            style={{
              width: "100%", padding: "12px 14px 12px 42px", boxSizing: "border-box",
              border: `2px solid ${DS.tertiary}`, outline: "none", background: "#fff",
              fontSize: TYPE.size.md, color: DS.tertiary, fontFamily: "inherit",
            }}
          />
        </div>

        {/* Type filter */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", color: DS.textMuted, textTransform: "uppercase", marginBottom: 8 }}>
            Filter by
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TYPE_OPTIONS.map(o => (
              <Pill key={o.value} label={o.label} active={type === o.value} onClick={() => setType(o.value)} />
            ))}
          </div>
        </div>

        {/* Sort options */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", color: DS.textMuted, textTransform: "uppercase", marginBottom: 8 }}>
            Sort by
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {SORT_OPTIONS
              .filter(o => !(o.value === "toxicity" && type !== "posts") && !(o.value === "comments" && type !== "posts"))
              .map(o => (
                <Pill key={o.value} label={o.label} active={sort === o.value} onClick={() => setSort(o.value)} />
              ))}
          </div>
          {sort === "closest" && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
              {lat !== null
                ? <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 700 }}>📍 Location acquired</span>
                : <button onClick={requestLocation} style={{
                    padding: "4px 10px", border: `2px solid ${DS.tertiary}`, cursor: "pointer",
                    background: "transparent", fontFamily: "inherit", fontSize: 10, fontWeight: 800,
                    letterSpacing: "0.12em", textTransform: "uppercase", color: DS.tertiary,
                  }}>
                    Share Location
                  </button>
              }
              {locError && <span style={{ fontSize: 11, color: "#ef4444" }}>{locError}</span>}
            </div>
          )}
        </div>

        {/* Friends only toggle */}
        <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setFriendsOnly(f => !f)}
            role="checkbox"
            aria-checked={friendsOnly}
            style={{
              width: 36, height: 20, border: `2px solid ${DS.tertiary}`, cursor: "pointer",
              background: friendsOnly ? DS.secondary : "transparent", position: "relative",
              transition: "background 0.15s", flexShrink: 0,
            }}
          >
            <span style={{
              position: "absolute", top: 2, left: friendsOnly ? 16 : 2,
              width: 12, height: 12, background: friendsOnly ? DS.primary : DS.tertiary,
              transition: "left 0.15s",
            }} />
          </button>
          <span style={{ fontSize: 12, fontWeight: 700, color: DS.tertiary, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Friends Only
          </span>
        </div>

        {/* Results count */}
        {results && !loading && (
          <div style={{ marginBottom: 14, fontSize: 11, fontWeight: 700, color: DS.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {results.total} result{results.total !== 1 ? "s" : ""}
            {query.trim() && <span> for &ldquo;{query.trim()}&rdquo;</span>}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: "10px 14px", border: `2px solid #ef4444`, background: "#fef2f2", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Results — only render when response type matches current filter to avoid stale-item crashes */}
        <div>
          {results?.type === type && allItems.map((item, i) => {
            if (type === "posts")    return <PostCard    key={(item as PostResult).id    + i} post={item as PostResult} />;
            if (type === "comments") return <CommentCard key={(item as CommentResult).id + i} comment={item as CommentResult} />;
            if (type === "users")    return <UserCard    key={(item as UserResult).id    + i} user={item as UserResult} />;
            return null;
          })}
        </div>

        {/* Empty state */}
        {!loading && results && allItems.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: DS.textMuted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              No results found
            </div>
          </div>
        )}

        {/* Loading spinner */}
        {loading && (
          <div style={{ textAlign: "center", padding: "32px 0", color: DS.textMuted, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Searching…
          </div>
        )}

        {/* Load more */}
        {results?.hasMore && !loading && (
          <button
            onClick={loadMore}
            style={{
              width: "100%", padding: "12px", marginTop: 8,
              border: `2px solid ${DS.tertiary}`, cursor: "pointer",
              background: "transparent", fontFamily: "inherit",
              fontSize: 10, fontWeight: 800, letterSpacing: "0.14em",
              textTransform: "uppercase", color: DS.tertiary,
            }}
          >
            Load more
          </button>
        )}
      </div>
    </main>
  );
}
