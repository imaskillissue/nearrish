# Frontend Task Proposals

## 🔴 Mandatory — Fix Before Evaluation (rejection risk)

| Task | Details |
|---|---|
| **Privacy Policy page** (`/privacy`) | Real content, linked from footer. Cannot be placeholder. |
| **Terms of Service page** (`/terms`) | Same. Both pages must be accessible via footer links. |
| **Console audit** | Zero warnings and zero errors in browser console. Audit every page. |
| **Mobile responsiveness** | Navbar, PostCard, messages sidebar, friends page — untested on mobile. |
| **Form validation** | All login/register/post/comment forms need client-side validation with visible error messages. |

---

## 🟠 Demi — Group Chat Window

The backend `ChatController` already supports group chats fully. The messages page only shows DMs.

- Add a "Group chats" tab or section in the left sidebar alongside DMs
- "New group" button → multi-select user picker modal + group name input
- Group message thread view — same bubble layout but show each sender's avatar + name
- Handle the `GROUP_MESSAGE` WebSocket event (backend already broadcasts it)
- Show group member list somewhere (collapsible panel or header tooltip)

**Why it matters:** Makes the real-time WebSockets module (2pts) fully demonstrable.

---

## 🟠 Hashtag Search — Wire the Dead GlobalSearchModal

`GlobalSearchModal.tsx` is completely non-functional right now (line 46: `// TODO`). It redirects to `/search/results` which doesn't exist.

- Connect to `GET /api/public/posts` with a `?q=` or `?hashtag=` param
- Add **filters**: by hashtag, by location radius, by date
- Add **sorting**: newest, most liked
- Add **pagination**: load more button or infinite scroll
- Render results inline in the modal (post cards + user cards)
- Parse `#hashtag` in `PostCard` content — render as colored clickable chips that open the modal pre-filled with that tag
- Hashtag filter on the `/explore` map page too

**Subject module:** Web Minor — Advanced search with filters, sorting, pagination **(1 pt)**

---

## 🟡 Wire the Dead TODOs in Settings

`settings/page.tsx` has multiple unconnected sections:

| Item | What to do |
|---|---|
| `AdminGate` form | Connect to `POST /api/admin/verify` |
| `AdminPanel` — fetch current username | `GET /api/admin/config` |
| `AdminPanel` — update credentials | `PATCH /api/admin/config` |
| Preference toggles | Store in localStorage (quick) or wire to `PATCH /api/users/me/preferences` |
| Change password | Add a form → `PATCH /api/users/me` |
| Edit bio / display name | Same endpoint — bio field exists on the User entity |

---

## 🟡 Block UI — Backend Exists, No Frontend

`BlockController` has `POST /api/blocks/{userId}`, `DELETE /api/blocks/{userId}`, `GET /api/blocks`. Zero frontend for this.

- Profile page (`/profile/[id]`) — "Block user" option in the `...` menu
- Settings page — "Blocked users" section with a list and unblock buttons
- Blocked users should not appear in friend suggestions or post feed

---

## 🟡 Fix Explore Page — Direct Nominatim Calls

`explore/page.tsx` line 60 calls Nominatim **directly from the browser** instead of going through the backend proxy. This violates OSM rate limits and bypasses our caching layer.

- Replace `fetch('https://nominatim.openstreetmap.org/reverse?...')` with `apiFetch('/api/public/geo/reverse?lat=...&lon=...')`
- Same fix pattern as what was already done in the main feed

---

## 🟢 SSR — Free Point (Next.js already does it)

Next.js App Router uses SSR by default. This module is basically already done.

- Ensure the landing page (`/`) and `/explore` render key content server-side (move data fetching to server components where possible, remove unnecessary `'use client'` at page root)
- Add a section to the README documenting that SSR is in use and which pages benefit from it

**Subject module:** Web Minor — SSR for improved performance and SEO **(1 pt)**

---

## 🟢 Custom Design System — Extract 3 More Components

The project needs **10 documented reusable components** with a consistent color palette and typography scale. Already existing:

| Component | File |
|---|---|
| `PostCard` | `components/PostCard.tsx` |
| `Navbar` | `components/Navbar.tsx` |
| `Speedometer` | `components/Speedometer.tsx` |
| `ProfileDropdown` | `components/ProfileDropdown.tsx` |
| `MiniPostCard` | `components/MiniPostCard.tsx` |
| `LocationPicker` | `components/LocationPicker.tsx` |
| `Toggle` | inline in `settings/page.tsx` — extract it |

Still needed (extract these):

- **`Avatar` component** — currently copy-pasted inline across profile, messages, PostCard, explore
- **`Button` component** — every page has its own inline button style object
- **`Modal` component** — no shared modal wrapper, each modal is built from scratch

Document the color palette (green: `#2d4a1a`, `#b6f08a`, `#dff0d8`) and typography scale in a `design-system.md` or as a Storybook/comment header.

**Subject module:** Web Minor — Custom design system with 10+ reusable components **(1 pt)**

---

## 🟢 File Upload Polish

Avatar upload already works. To fully claim this module:

- **Client-side validation** before sending: max file size (e.g. 5 MB), image types only (image/jpeg, image/png, image/webp) — show a clear error if violated
- **Image preview** before posting — show a thumbnail in the post creation form after selecting an image, before submitting
- **Upload progress indicator** — a progress bar or spinner while the upload is in flight
- Post image upload gets the same treatment as avatar upload

**Subject module:** Web Minor — File upload and management system **(1 pt)**

---

## 🟢 Multiple Language Support (i18n)

Install `next-intl` (best fit for Next.js App Router). Add **3 languages**: English, German, French.

- All user-facing strings moved to translation files (`en.json`, `de.json`, `fr.json`)
- Language switcher in the Navbar (flag icons or a dropdown)
- All pages: landing, feed, friends, messages, explore, profile, settings
- **Subject module:** Accessibility Minor — Multiple language support **(1 pt)**

---

## 🟢 Additional Browser Compatibility

Test all features in **Firefox** and **Safari** (or Edge). Fix whatever breaks. Document any known limitations.

**Subject module:** Accessibility Minor — Support for additional browsers **(1 pt)**

---

## 🟢 Polishing (many commits, high visibility)

| Task | Notes |
|---|---|
| Loading skeletons | Replace blank whitespace during data fetching with pulsing skeleton cards |
| Toast notifications | Replace any `alert()` calls with a non-blocking toast system |
| Empty state illustrations | "No posts yet", "No friends yet", "No messages" — currently blank whitespace |
| Image lightbox | Clicking a post image should open it fullscreen/enlarged |
| PostCard visibility badge | Show a 🔒 icon on FRIENDS_ONLY posts |
| Profile page stats | Show friend count + post count on the profile header |
| Navbar active link highlight | No visual indicator of which page you're on currently |
| Navbar active link highlight | No visual indicator of which page you're on currently |

---

## 🔵 Coordinate with Emil — 2FA Frontend

Emil's 2FA backend needs a frontend. This is a **User Management Minor (1 pt)** for the team.

- Settings page: "Two-Factor Authentication" section
- Enable flow: show QR code (TOTP secret from backend) → user scans with authenticator app → enter 6-digit code to confirm → enabled
- Login flow: after password check, if 2FA enabled → show a second screen asking for the 6-digit code
- Disable flow: enter current TOTP code to turn it off

---

## Point Summary

| Module | Pts | Primary task |
|---|---|---|
| SSR | 1 | Document + ensure server components |
| Advanced search + hashtags | 1 | Wire GlobalSearchModal |
| Custom design system | 1 | Extract Avatar, Button, Modal |
| File upload polish | 1 | Preview + validation + progress |
| Multiple languages (i18n) | 1 | next-intl, 3 languages |
| Browser compatibility | 1 | Firefox + Safari |
| **Frontend subtotal** | **6** | |
| Team: Frameworks | 2 | Next.js (frontend half) |
| Team: User interaction | 2 | Frontend makes it visible |
| Team: 2FA (with Emil) | 1 | TOTP frontend |
| **Total project contribution** | **11** | |
