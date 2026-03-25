/**
 * Tests that Map.tsx uses embedded author data and does NOT call
 * /api/public/users/{id} when the post already has author info.
 *
 * Regression: Map had a module-level avatarCache but never seeded it from
 * post.author, so it always fetched — causing 403s on the explore page.
 */
import { render, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Mock leaflet before importing Map ──────────────────────────────────────
vi.mock('leaflet', () => {
  const divIcon = vi.fn(() => ({}))
  return { default: { divIcon }, divIcon }
})

vi.mock('leaflet/dist/leaflet.css', () => ({}))

// ── Mock react-leaflet (no real map DOM needed) ────────────────────────────
vi.mock('react-leaflet', () => ({
  MapContainer:   ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer:      () => null,
  Marker:         () => null,
  Popup:          ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CircleMarker:   () => null,
  useMap:         () => ({ setView: vi.fn(), panTo: vi.fn() }),
}))

// ── Mock MiniPostCard (popup content, irrelevant here) ────────────────────
vi.mock('../MiniPostCard', () => ({
  default: () => null,
}))

// ── Mock apiFetch ──────────────────────────────────────────────────────────
vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
  API_BASE: '',
}))

// ── Mock design tokens (not needed for logic) ─────────────────────────────
vi.mock('../../lib/tokens', () => ({
  DS: { secondary: '#1B2F23', bg: '#f5f5f5', tertiary: '#888' },
}))

import Map from '../Map'
import { apiFetch } from '../../lib/api'

const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>

// Use unique author IDs per test to avoid module-level cache cross-contamination
let testIdCounter = 100

function nextId() {
  return `user-${testIdCounter++}`
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Map avatar fetching', () => {
  it('does NOT call apiFetch for posts with embedded author', async () => {
    const authorId = nextId()
    const posts = [{
      id: 'post-a',
      text: 'hello world',
      authorId,
      timestamp: Date.now(),
      lat: 52.42,
      lng: 10.79,
      author: { id: authorId, username: 'embedded_user', avatarUrl: null },
    }]

    render(
      <Map posts={posts} onPostClick={vi.fn()} selectedPost={null} userLocation={null} />
    )

    // Give useEffect time to run
    await waitFor(() => {
      expect(mockApiFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/public/users/')
      )
    })
  })

  it('DOES call apiFetch for posts without embedded author', async () => {
    const authorId = nextId()
    mockApiFetch.mockResolvedValueOnce({ username: 'fetched_user', avatarUrl: null })

    const posts = [{
      id: 'post-b',
      text: 'hello world',
      authorId,
      timestamp: Date.now(),
      lat: 52.42,
      lng: 10.79,
      // no author field
    }]

    render(
      <Map posts={posts} onPostClick={vi.fn()} selectedPost={null} userLocation={null} />
    )

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(`/api/public/users/${authorId}`)
    })
  })

  it('only fetches for authors without embedded data when posts are mixed', async () => {
    const embeddedId = nextId()
    const missingId  = nextId()
    mockApiFetch.mockResolvedValueOnce({ username: 'fetched_for_missing', avatarUrl: null })

    const posts = [
      {
        id: 'post-c1',
        text: 'has author',
        authorId: embeddedId,
        timestamp: Date.now(),
        lat: 52.42,
        lng: 10.79,
        author: { id: embeddedId, username: 'already_here', avatarUrl: null },
      },
      {
        id: 'post-c2',
        text: 'no author',
        authorId: missingId,
        timestamp: Date.now(),
        lat: 52.43,
        lng: 10.80,
      },
    ]

    render(
      <Map posts={posts} onPostClick={vi.fn()} selectedPost={null} userLocation={null} />
    )

    await waitFor(() => {
      // fetched for the one without author
      expect(mockApiFetch).toHaveBeenCalledWith(`/api/public/users/${missingId}`)
      // NOT fetched for the one with author
      expect(mockApiFetch).not.toHaveBeenCalledWith(`/api/public/users/${embeddedId}`)
    })
  })
})
