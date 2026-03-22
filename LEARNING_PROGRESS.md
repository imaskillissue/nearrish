# Learning Progress — Nearrish Codebase

> **How to use this file**: Paste both this file AND `SUMMARY.md` into a new chat session.
> Then say: *"Please continue helping me understand this codebase from where we left off."*

---

## Context about the learner

- Background: knows C and C++, some containers (Docker basics), but no prior experience with web projects, frontend/backend separation, or Java.
- Learning style: needs plain-English explanations before technical details. Analogies to C/Makefile concepts help a lot.
- Has VS Code open with the Nearrish project at `/Users/demetriorodrigues/Desktop/nearrish`

---

## Key concepts already explained (no need to re-explain)

### Language & syntax
- **TypeScript / TSX**: JavaScript with types. `.tsx` files mix TypeScript + JSX (HTML-like syntax inside JS).
- **`const` / `let`**: variable declarations. `const` = cannot be reassigned, `let` = can.
- **`function` keyword**: defines reusable blocks of code with parameters and return values.
- **Type annotations** (`pw: string`, `: string[]`): TypeScript's way of declaring what type a variable is.
- **`import` / `export`**: how files share code between each other (like `#include` + `extern` in C).
- **`export default function`**: the main thing a file provides (used by Next.js to define a page).
- **Scope**: variables are only accessible within the `{ }` block they were declared in. Three levels in `page.tsx`: file-level, `ProfilePage()`-level, individual function-level.
- **Arrow functions**: `(e) => setName(e.target.value)` — shorthand for small anonymous functions.

### React concepts
- **`useState(initial)`**: gives a component a memory slot. Returns `[value, setter]`. Calling the setter re-renders the page.
- **`useRef`**: silent memory — changing it does NOT re-render the page. Used for drag state and references to DOM elements.
- **`useEffect(() => {...}, [])`**: code that runs after the page appears on screen. `[]` = run once only. Return function = cleanup.
- **`useContext` / `useAuth()`**: reaches into a global provider (wrapping the whole app) to get shared state/functions.
- **JSX**: the `return (...)` block. Looks like HTML but is JavaScript. `{}` inside JSX runs JS expressions. `className` instead of `class`. Event handlers like `onClick={fn}`.
- **Component**: a function that returns JSX. Next.js uses the file path as the URL route.

### Web fundamentals
- **HTML**: describes page structure/appearance. Cannot do logic or talk to databases.
- **JSON**: text format for structured data exchanged between browser and server. `{"key": "value"}`.
- **HTTP request**: like a letter in an envelope. Has a METHOD, a URL, HEADERS (metadata), and optionally a BODY (the data).
- **HTTP methods**: GET (read), POST (create), PUT (replace), PATCH (partial update), DELETE (remove). Maps to CRUD.
- **Headers**: metadata about the request. e.g. `Content-Type: application/json` = "the body is JSON". `AUTH: token` = "here's my identity proof".
- **Body**: the actual data payload of a POST/PUT/PATCH request.
- **`fetch()`**: browser built-in function that sends an HTTP request over the network.
- **`async` / `await`**: handle operations that take time (network calls). `await` = "wait for this Promise to finish before continuing".
- **`Promise`**: a value that will arrive in the future (like a callback, but cleaner syntax).

### Architecture concepts
- **Frontend vs Backend separation**: browser (Next.js/TypeScript) and server (Spring Boot/Java) are two completely separate programs. They only communicate via JSON over HTTP. Code never crosses sides directly.
- **nginx**: reverse proxy sitting in front of everything. Routes `/api/*` to backend, `/` to frontend, `/ws/*` to WebSocket. Browser only ever talks to nginx.
- **Spring Boot**: Java framework (like a huge library/toolbox). Handles HTTP listening, JSON parsing, routing, DB connections, security — so developers only write business logic.
  - Analogous to C: Java = the language, Spring Boot = a massive collection of `.h` libraries auto-included.
- **`@Annotations`**: labels on Java code that Spring reads at startup. `@RestController` = "this class handles HTTP". `@PostMapping("/url")` = "this function handles POST requests to this URL". No folders needed.
- **Controllers**: Java files in `backend/controller/` that define all URL routes via annotations.
- **Gradle**: Java's equivalent of `make` + Makefile. `build.gradle` = the Makefile. Also auto-downloads libraries from the internet (Maven Central = like apt-get for Java).
- **Gradle Wrapper** (`gradlew` + `gradle-wrapper.properties`): ensures everyone uses the exact right Gradle version. `gradlew` is a bootstrap shell script — downloads Gradle 9.3.1 if not present, then uses it.
- **Bootstrap** (general concept): a small, simple mechanism that brings a larger system into existence from almost nothing (BIOS → OS, gradlew → Gradle, etc.).
- **Docker containers**: isolated boxes running each service. Services communicate over an internal Docker network.
- **JWT token**: "wristband" that proves identity. Created at login/registration. Contains userId, username, roles, expiry (7 days). Cryptographically signed — can't be faked. Stored in browser's `localStorage`. Sent in `AUTH` header on every protected request.
- **`localStorage`**: browser storage that persists between page refreshes (unlike RAM).
- **SCrypt**: password hashing algorithm. One-way — stores a scrambled version. Original password is never stored.
- **Serialization/Deserialization**: JSON text ↔ Java/JS objects. Spring Boot does this automatically via `@RequestBody` (JSON→Java) and return values (Java→JSON).

---

## What we walked through in detail: Registration Flow

We traced the complete user registration flow step by step across all files.

### STEP 1 — Form display & local validation
**File**: `frontend/app/profile/page.tsx`
- `useState` slots store all form field values
- `validatePassword()` checks password rules locally (no network)
- `EMAIL_RE` regex validates email format
- `cropToCanvas()`: crops avatar to 560×560 JPEG in the browser using HTML Canvas, respecting the user's drag position. Returns a base64 string.
- `isValid` computed live — SAVE button only enabled when all rules pass
- Nothing sent to server yet at this point

### STEP 2 — Pre-flight moderation check (on SAVE click)
**Files**: `page.tsx` → `api.ts` → nginx → `PublicInteractionController.java` → `ModerationClient.java` → moderation-service
- `handleSave()` fires. Guard clauses exit early if form invalid or already checking.
- Button changes to "CHECKING…" (`setModerating(true)`)
- `POST /api/public/moderate/registration` sends `{ name, nickname }` as JSON
- Backend runs both checks **in parallel** (`CompletableFuture`) via `ModerationClient`
- If either blocked → show error under the field, STOP. Account not created.
- If moderation service is down → `catch` silently continues (fail-open design)
- This endpoint is **public** (no token needed) — exists before account creation

### STEP 3 — Account creation
**Files**: `page.tsx` → `auth-context.tsx` → `api.ts` → nginx → `AuthenticationController.java` → `User.java` → PostgreSQL → `ApiAuthenticationService.java`
- `register({name, nickname, email, password, address})` called in `auth-context.tsx`
- Packages as JSON, sends `POST /api/auth/registration` via `apiFetch()`
- `apiFetch()` in `api.ts` attaches headers and calls browser `fetch()` — no token yet
- nginx forwards to `backend:8080`
- Spring Boot controller receives it, `@RequestBody` converts JSON → `RegistrationForm` Java object
- Checks: email unique? username unique? → if not, returns error immediately
- **Second moderation check** (server-side safety net — can't trust browser alone)
- `new User(username, email, password, null)` → constructor immediately hashes password with SCrypt. Plain-text password is gone.
- `userRepository.save(user)` → SQL INSERT → PostgreSQL generates UUID
- `authenticationService.createJwtForUser(user)` → creates signed JWT (7-day expiry)
- Returns `{ success: true, sessionToken: "eyJ..." }`
- Back in `auth-context.tsx`: saves token to `localStorage`, decodes user from token, sets app state to 'authenticated'
- Returns `{ userId }` to `page.tsx`

### STEP 4 — Avatar upload + redirect
**Files**: `page.tsx` → nginx → `MeController.java` → disk (`/app/uploads/`) → PostgreSQL
- Converts base64 JPEG string → binary bytes → `Blob` → `FormData`
- `POST /api/users/me/avatar` with `AUTH: token` header — uses raw `fetch()` (not `apiFetch`) because file uploads need `multipart/form-data` content type, not JSON
- `ApiAuthenticationFilter` intercepts the request → verifies JWT → loads User → stores in security context
- `MeController.uploadAvatar()`:
  - Generates unique filename: `UUID_avatar.jpg`
  - Saves file to `/app/uploads/` on server disk
  - Updates `user.avatarUrl` in database
- Avatar failure is silently caught — does not undo account creation
- `router.push('/profile/{userId}')` — client-side page navigation, no HTTP request
- **Registration complete ✓**

---

## Key file map (files we actually read)

| File | Role in registration |
|---|---|
| `frontend/app/profile/page.tsx` | The registration form — all 4 steps start here |
| `frontend/app/lib/auth-context.tsx` | Calls the registration API, saves token, manages auth state |
| `frontend/app/lib/api.ts` | Sends all HTTP requests, attaches AUTH header |
| `nginx/nginx.conf` | Routes `/api/*` → backend, `/ws/*` → WebSocket |
| `backend/.../AuthenticationController.java` | `/api/auth/registration` and `/api/auth/login` endpoints |
| `backend/.../PublicInteractionController.java` | `/api/public/moderate/registration` — pre-flight check |
| `backend/.../MeController.java` | `/api/users/me/avatar` — avatar upload |
| `backend/.../User.java` | The User entity/table — hashes password in constructor |
| `backend/.../ApiAuthenticationService.java` | Creates and verifies JWT tokens |
| `backend/.../ModerationClient.java` | HTTP client to the moderation-service (Python/FastAPI) |
| `backend/build.gradle` | Gradle build file — declares all Java library dependencies |
| `backend/gradlew` + `gradle-wrapper.properties` | Bootstrap script — ensures correct Gradle version |

---

## Where we stopped

We finished the complete **registration flow** (all 4 steps).

**Suggested next flows to explore**:
1. **Login flow** — similar to registration but shorter; good for reinforcing concepts
2. **Creating a post** — involves the feed, async moderation, and WebSocket broadcast
3. **Sending a chat message** — involves WebSocket/STOMP in depth
4. **The explore/map page** — involves the geo-service (Python Flask) and Leaflet maps
5. **The admin dashboard** — involves scheduled tasks and real-time stats via WebSocket

---

## Prompt to continue in a new chat

Paste this into a new chat along with `SUMMARY.md`:

> "I am learning to understand the Nearrish codebase. I am not very experienced with programming beyond C/C++ and basic containers. We already covered the registration flow in detail and explained many foundational concepts (see LEARNING_PROGRESS.md). Please continue helping me understand the codebase step by step, starting with [CHOOSE ONE OF THE FLOWS ABOVE]. Follow the same style: plain-English explanations first, exact file references with line numbers, stop and ask before moving to the next step."
