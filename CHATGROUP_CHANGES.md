# Group Chat — Change Log

> **Purpose**: Track every small commit needed to add group chat support to the messages page.
> The backend (`ChatController.java`) already supports groups fully — all work is in the frontend.
> Paste this file into a new chat to resume from where you left off.

---

## Files involved

| File | Why |
|---|---|
| `frontend/app/messages/page.tsx` | The only file being changed — all UI and logic lives here |

---

## Overall plan (8 small commits)

| # | Status | What changes |
|---|---|---|
| 1 | ✅ DONE | Add `GroupConversation` TypeScript type + add `senderName` field to `Message` type |
| 2 | ⬜ TODO | Separate group conversations from DMs inside `loadConversations()` |
| 3 | ⬜ TODO | Add sidebar tab UI — "DMs" and "Groups" tabs |
| 4 | ⬜ TODO | Add `activeGroup` state + `loadGroupThread()` function + `openGroupConversation()` |
| 5 | ⬜ TODO | Render sender name/avatar inside group message bubbles |
| 6 | ⬜ TODO | Add "New group" button + group creation modal (multi-select + name input) |
| 7 | ⬜ TODO | Update WebSocket handler so group messages trigger a refresh correctly |
| 8 | ⬜ TODO | Add collapsible member list inside the group thread header |

---

## Commit 1 — Add types ✅

### What and why

**File**: `frontend/app/messages/page.tsx`  
**Section**: the "Types" block at the top of the file (around line 30)

### Plain-English explanation

TypeScript (the language the frontend is written in) requires you to define the *shape* of every piece of data before you use it — similar to declaring a `struct` in C.

Right now the file has a `Conversation` type (for DMs) but nothing for group chats. A group chat is different:
- It has a **name** (like "Saturday team")
- It has a **list of members** (not just one "partner")
- The last message and unread count work the same way

We also extend the existing `Message` type to store the sender's name. This is needed later when we show "Who said what" inside a group thread. Right now the `Message` type only stores the sender's ID, which is fine for DMs (you always know the other person), but in a group chat you need the name too.

### What changed

**Added** a new `GroupConversation` interface:
```typescript
interface GroupConversation {
  id: string;
  name: string;
  members: { id: string; name: string; photo: string | null }[];
  lastMessage: { content: string; createdAt: string; senderId: string };
  unread: number;
}
```

**Extended** the existing `Message` interface with one new optional field:
```typescript
senderName?: string;   // used in group threads to show who sent each message
```

### Files touched
- `frontend/app/messages/page.tsx` — types section only, no logic changed

---

## Commit 2 — Separate DMs and groups in loadConversations() ⬜

### Plain-English explanation

The `loadConversations()` function currently fetches all conversations from the backend but **silently throws away group chats**. Look at this line (around line 244 in the current file):

```javascript
const partner = conv.participants.find(p => p.id !== currentUserId);
if (!partner) continue;   // <-- groups just get skipped here
```

In a DM there are only 2 participants, so "the other person" is easy to find.
In a group there are 3+ people and there is no single "partner" — so the `find` returns `undefined` and the group is discarded with `continue`.

This commit adds a `groupConversations` state array and fills it when `conv.group === true`. DM logic is untouched.

### What changed
- New state: `groupConversations` / `setGroupConversations`
- `loadConversations()`: branch on `conv.group` — DMs go to the existing `convList`, groups go to a new `groupList`

---

## Commit 3 — Sidebar tab UI ⬜

### Plain-English explanation

Adds two buttons at the top of the left sidebar: **DMs** and **Groups**. Clicking a tab switches which list is shown below. No data changes — just showing/hiding the lists that already exist after Commit 2.

### What changed
- New state: `sidebarTab: 'dms' | 'groups'`
- Sidebar header: replace the plain "MESSAGES" title area with two tab buttons
- Conversation list: render DM list when tab is 'dms', group list when tab is 'groups'

---

## Commit 4 — Group thread state + loadGroupThread() ⬜

### Plain-English explanation

Right now `openConversation(partner)` opens a DM thread. This commit adds `openGroupConversation(group)` for groups.

The difference: for a DM, the code first looks up (or creates) the conversation ID from the partner's user ID. For a group, we already have the conversation ID — the backend gave it to us in the conversations list. So `loadGroupThread()` can jump straight to fetching messages, skipping the "get or create" step.

Also adds `activeGroup` state (the currently-open group) and makes sure clicking a group in the sidebar opens its thread in the right panel.

### What changed
- New state: `activeGroup` / `setActiveGroup`
- New function: `loadGroupThread(groupId, silent?)`
- New function: `openGroupConversation(group)`
- Right panel: shows group thread when `activeGroup` is set (alongside the existing DM path)

---

## Commit 5 — Group bubble rendering ⬜

### Plain-English explanation

In a DM, every message is either "mine" (right side, green) or "theirs" (left side, white). You don't need to label who sent what — there are only two people.

In a group, multiple people can send messages on the left side. Without labels you can't tell who said what. This commit adds a small **sender name** above each "theirs" bubble in a group thread, and a small avatar next to it.

The avatar comes from `activeGroup.members` (the participant list we already have). The name comes from `msg.senderName` (set in Commit 4 when loading messages).

### What changed
- In the message rendering block: when `activeGroup` is set and `!isMine`, show a small avatar + name label above the bubble

---

## Commit 6 — New group button + creation modal ⬜

### Plain-English explanation

The existing "+" button in the sidebar header opens a DM picker. This commit adds a second button — visible only when the "Groups" tab is active — that opens a **group creation modal**.

The modal has:
1. A text input for the group name
2. A searchable list of users, each with a checkbox
3. A "Create" button that only activates when a name is typed and at least one person is selected

On "Create", it calls `POST /api/chat/conversations/group` (already exists in the backend) and then opens the new group thread right away.

### What changed
- New state: `showGroupModal`, `groupName`, `selectedMembers`
- New modal JSX
- New `handleCreateGroup()` function calling the backend API

---

## Commit 7 — WebSocket handler for group messages ⬜

### Plain-English explanation

When a new message arrives over WebSocket, the existing handler looks at `activePartner` to decide which thread to refresh. But `activePartner` is only set for DMs — if you're in a group thread, `activePartner` is `null`, so the handler does nothing useful.

This commit adds a branch: if `activeGroup` is set, refresh the group thread instead.

### What changed
- In the `subscribe('chat', ...)` useEffect: add an `else if (activeGroup)` branch that calls `loadGroupThread(activeGroup.id, true)`

---

## Commit 8 — Collapsible member list in group header ⬜

### Plain-English explanation

When viewing a group thread, the header shows the group name. This commit adds a small "N members ▾" toggle that expands to show a compact list of avatars + names of everyone in the group.

It's purely visual — no new API calls. The data is already in `activeGroup.members`.

### What changed
- New state: `showGroupMembers`
- Group thread header: add toggle button + expandable member panel

---

## How to resume in a new chat

1. Paste this file into the new chat
2. Look for the first `⬜ TODO` entry in the table above
3. Tell the AI: *"Continue from Commit N — the last completed was Commit M"*
