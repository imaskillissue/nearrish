"use client";

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useGeolocation } from "./hooks/useGeolocation";

const MapView = lazy(() => import("./components/MapView"));

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Post {
  id: number;
  content: string;
  authorId: string;
  moderationSeverity: number;
  moderationCategory: string;
  createdAt: string;
  latitude: number | null;
  longitude: number | null;
}

interface ChatMsg {
  id: number;
  content: string;
  senderUsername: string;
  moderationSeverity: number;
  moderationCategory: string;
  createdAt: string;
}

interface User {
  id: number;
  username: string;
  displayName: string;
}

type Tab = "feed" | "map" | "chat";

function severityColor(severity: number): string {
  if (severity >= 9) return "bg-red-600 text-white";
  if (severity >= 5) return "bg-yellow-500 text-black";
  return "bg-green-200 text-green-800";
}

function severityLabel(severity: number, category: string): string {
  if (severity >= 9) return "BLOCKED";
  if (severity >= 5) return "warn";
  if (category === "error") return "error";
  return "ok";
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Jodel-style card colors
const CARD_COLORS = [
  "bg-orange-400", "bg-yellow-400", "bg-green-400", "bg-teal-400",
  "bg-blue-400", "bg-indigo-400", "bg-pink-400", "bg-red-400",
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("feed");
  const [currentUser, setCurrentUser] = useState<string>("alice");
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [newPost, setNewPost] = useState("");
  const [newChat, setNewChat] = useState("");
  const [postError, setPostError] = useState("");
  const [chatError, setChatError] = useState("");
  const [postLoading, setPostLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevChatLenRef = useRef(0);

  const { latitude, longitude, loading: geoLoading } = useGeolocation();

  useEffect(() => {
    fetch(`${API_URL}/api/users`)
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchPosts = () =>
      fetch(`${API_URL}/api/posts`)
        .then((r) => r.json())
        .then(setPosts)
        .catch(() => {});
    fetchPosts();
    const interval = setInterval(fetchPosts, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchChat = () =>
      fetch(`${API_URL}/api/chat`)
        .then((r) => r.json())
        .then(setChatMessages)
        .catch(() => {});
    fetchChat();
    const interval = setInterval(fetchChat, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chatMessages.length > prevChatLenRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevChatLenRef.current = chatMessages.length;
  }, [chatMessages]);

  const submitPost = async () => {
    if (!newPost.trim()) return;
    setPostLoading(true);
    setPostError("");
    try {
      const res = await fetch(`${API_URL}/api/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newPost,
          authorId: currentUser,
          latitude: latitude,
          longitude: longitude,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPostError(data.error || "Failed to create post");
      } else {
        setNewPost("");
        const postsRes = await fetch(`${API_URL}/api/posts`);
        setPosts(await postsRes.json());
      }
    } catch {
      setPostError("Could not connect to server");
    }
    setPostLoading(false);
  };

  const submitChat = async () => {
    if (!newChat.trim()) return;
    setChatLoading(true);
    setChatError("");
    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newChat,
          senderUsername: currentUser,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChatError(data.error || "Message blocked");
      } else {
        setNewChat("");
        const chatRes = await fetch(`${API_URL}/api/chat`);
        setChatMessages(await chatRes.json());
      }
    } catch {
      setChatError("Could not connect to server");
    }
    setChatLoading(false);
  };

  const currentDisplayName =
    users.find((u) => u.username === currentUser)?.displayName || currentUser;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0 z-10">
        <h1 className="text-2xl font-bold text-blue-600">Nearrish</h1>
        <div className="flex items-center gap-3">
          {geoLoading && (
            <span className="text-xs text-gray-400">Getting location...</span>
          )}
          {latitude !== null && (
            <span className="text-xs text-green-500" title={`${latitude.toFixed(4)}, ${longitude?.toFixed(4)}`}>
              GPS Active
            </span>
          )}
          <select
            value={currentUser}
            onChange={(e) => setCurrentUser(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-medium bg-white"
          >
            {users.map((u) => (
              <option key={u.username} value={u.username}>
                {u.displayName} (@{u.username})
              </option>
            ))}
            {users.length === 0 && <option value="alice">alice</option>}
          </select>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-hidden">
        {/* Feed Tab */}
        {activeTab === "feed" && (
          <div className="h-full overflow-y-auto">
            <div className="max-w-2xl mx-auto p-4">
              {/* New Post Form */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
                <div className="text-sm font-medium text-gray-500 mb-2">
                  Posting as {currentDisplayName}
                  {latitude !== null && (
                    <span className="ml-2 text-green-500 text-xs">with location</span>
                  )}
                </div>
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="What's happening nearby?"
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  maxLength={5000}
                />
                {postError && (
                  <div className="text-red-600 text-sm mt-1 bg-red-50 rounded px-3 py-1.5">
                    {postError}
                  </div>
                )}
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-400">
                    {newPost.length}/5000
                  </span>
                  <button
                    onClick={submitPost}
                    disabled={postLoading || !newPost.trim()}
                    className="bg-blue-600 text-white px-5 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {postLoading ? "Posting..." : "Post"}
                  </button>
                </div>
              </div>

              {/* Posts List - Jodel-style colored cards */}
              <div className="space-y-4">
                {posts.length === 0 && (
                  <div className="text-center text-gray-400 py-12">
                    No posts yet. Be the first to post!
                  </div>
                )}
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className={`rounded-2xl p-4 shadow-sm ${
                      post.moderationSeverity >= 5
                        ? "border-2 border-orange-400"
                        : ""
                    } ${CARD_COLORS[post.id % CARD_COLORS.length]}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center text-white font-bold text-sm">
                          {post.authorId.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-sm text-white">
                          @{post.authorId}
                        </span>
                        <span className="text-xs text-white/70">
                          {timeAgo(post.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {post.latitude !== null && (
                          <span className="text-xs text-white/70" title={`${post.latitude?.toFixed(4)}, ${post.longitude?.toFixed(4)}`}>
                            📍
                          </span>
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityColor(
                            post.moderationSeverity
                          )}`}
                        >
                          {severityLabel(post.moderationSeverity, post.moderationCategory)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-white whitespace-pre-wrap">{post.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Map Tab */}
        {activeTab === "map" && (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-3 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <MapView
              latitude={latitude}
              longitude={longitude}
              currentUser={currentUser}
            />
          </Suspense>
        )}

        {/* Chat Tab */}
        {activeTab === "chat" && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center text-gray-400 text-sm py-8">
                  No messages yet
                </div>
              )}
              {chatMessages.map((msg) => {
                const isMe = msg.senderUsername === currentUser;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      isMe ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-medium text-gray-500">
                        @{msg.senderUsername}
                      </span>
                      <span className="text-xs text-gray-300">
                        {timeAgo(msg.createdAt)}
                      </span>
                      {msg.moderationSeverity > 0 && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${severityColor(
                            msg.moderationSeverity
                          )}`}
                        >
                          {msg.moderationSeverity}
                        </span>
                      )}
                    </div>
                    <div
                      className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                        isMe
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-900"
                      } ${
                        msg.moderationSeverity >= 5
                          ? "ring-2 ring-orange-400"
                          : ""
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="border-t border-gray-200 p-3 bg-white shrink-0">
              {chatError && (
                <div className="text-red-600 text-xs mb-2 bg-red-50 rounded px-2 py-1">
                  {chatError}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={newChat}
                  onChange={(e) => setNewChat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitChat();
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={2000}
                />
                <button
                  onClick={submitChat}
                  disabled={chatLoading || !newChat.trim()}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Tab Navigation */}
      <nav className="bg-white border-t border-gray-200 flex shrink-0">
        <button
          onClick={() => setActiveTab("feed")}
          className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === "feed"
              ? "text-blue-600"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <span className="text-xs font-medium">Feed</span>
        </button>
        <button
          onClick={() => setActiveTab("map")}
          className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === "map"
              ? "text-blue-600"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs font-medium">Map</span>
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === "chat"
              ? "text-blue-600"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-xs font-medium">Chat</span>
        </button>
      </nav>
    </div>
  );
}
