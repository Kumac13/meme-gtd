# UI Routes Contract: Web UI for meme-gtd

**Date**: 2025-10-20
**Feature**: Web UI for meme-gtd (Memos & Tasks Management)
**Branch**: `010-github-issue-meme`

## Overview

This document defines the frontend routing structure and the mapping between UI routes and API endpoints. All routes are client-side (React Router) served via a single-page application (SPA) pattern.

## Routing Architecture

**Pattern**: SPA with client-side routing (React Router 6)

**Server Configuration**:
- All API routes: `/api/*` → Fastify API handlers
- All other routes: `/*` → Serve `index.html` (SPA fallback)

**Client-side Routing**: React Router handles URL changes without server round-trips

## Route Definitions

### Root Route

**Route**: `/`

**Component**: `Layout` (wrapper) + redirect to `/memos`

**Behavior**:
- Redirects to `/memos` page
- Shows navigation header with links to "Memos" and "Tasks"

**API Calls**: None

---

### Memos Routes

#### Memos List

**Route**: `/memos`

**Component**: `MemosPage`

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bookmarked` | `true \| false \| undefined` | `undefined` | Filter by bookmark status |

**API Calls**:
- `GET /api/memos` - Fetch all memos
- `GET /api/memos?bookmarked=true` - Fetch bookmarked memos (when filter active)

**UI Elements**:
- Filter toggle: "All" / "Bookmarked only"
- "New memo" button → Navigate to `/memos/new`
- Memo list table: Columns = ID, Body Preview (first line), Bookmarked, Created At, Updated At
- Click row → Navigate to `/memos/:id`

**Success States**:
- Empty list: Display "No memos found. Create your first memo!"
- Loaded list: Display table with memos

**Error States**:
- API error: Display error message with retry button

---

#### Memo Detail

**Route**: `/memos/:id`

**Component**: `MemoDetailPage`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `number` | Memo ID |

**API Calls**:
- `GET /api/memos/:id` - Fetch memo details (bodyMd, labels, commentsCount)
- `GET /api/memos/:memoId/comments` - Fetch comments for this memo
- `GET /api/issues/:id/links` - Fetch links for this memo

**UI Elements**:
- Memo body (rendered as markdown)
- Metadata: Created At, Updated At
- "Edit" button → Navigate to `/memos/:id/edit`
- "Delete" button → DELETE `/api/memos/:id` → Navigate to `/memos`
- "Bookmark" / "Unbookmark" button → POST `/api/memos/:id/bookmark` or `/unbookmark`
- "Promote to Task" button → Show PromoteModal
- Labels section:
  - Display assigned labels (name, description)
  - "[+] Assign label" button → Show LabelModal
  - "[x] Remove label" button → DELETE `/api/labels/:name` (warns: affects all issues)
- Links section:
  - Display links grouped by type and direction
  - "[+] Create link" button → Show LinkModal
  - "[x] Delete link" button → DELETE `/api/links/:id`
- Comments section:
  - Display all comments (bodyMd rendered as markdown, createdAt, updatedAt)
  - Comment form → POST `/api/memos/:memoId/comments`
  - "[Edit]" button → Show edit form → PATCH `/api/memos/:memoId/comments/:commentId`
  - "[Delete]" button → DELETE `/api/memos/:memoId/comments/:commentId`

**Success States**:
- Memo loaded: Display all details
- Comments loaded: Display comment list
- Links loaded: Display link list

**Error States**:
- 404: Display "Memo not found" with back button
- API error: Display error message with retry button

---

#### Memo Create

**Route**: `/memos/new`

**Component**: `MemoNewPage`

**API Calls**:
- `POST /api/memos` - Create new memo

**Request Payload**:
```json
{
  "bodyMd": "string (required, minLength: 1)"
}
```

**UI Elements**:
- Form:
  - `bodyMd` textarea (required, placeholder: "Enter memo content...")
  - "Save" button → Submit form → Navigate to `/memos/:id` on success
  - "Cancel" button → Navigate to `/memos`
- Validation:
  - Client-side: Check bodyMd is not empty before submission
  - Server-side: Display API error if validation fails (400)

**Success States**:
- Form submitted successfully → Navigate to `/memos/:id`

**Error States**:
- Validation error (400): Display error message above form
- API error: Display error message with retry button

---

#### Memo Edit

**Route**: `/memos/:id/edit`

**Component**: `MemoEditPage`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `number` | Memo ID |

**API Calls**:
- `GET /api/memos/:id` - Fetch memo for editing
- `PATCH /api/memos/:id` - Update memo

**Request Payload**:
```json
{
  "bodyMd": "string (optional)"
}
```

**UI Elements**:
- Form:
  - `bodyMd` textarea (pre-filled with current value, required)
  - "Save" button → Submit form → Navigate to `/memos/:id` on success
  - "Cancel" button → Navigate to `/memos/:id`
- Validation:
  - Client-side: Check bodyMd is not empty before submission
  - Server-side: Display API error if validation fails (400)

**Success States**:
- Form submitted successfully → Navigate to `/memos/:id`

**Error States**:
- 404: Display "Memo not found" with back button
- Validation error (400): Display error message above form
- API error: Display error message with retry button

---

### Tasks Routes

#### Tasks List

**Route**: `/tasks`

**Component**: `TasksPage`

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | `TaskStatus \| undefined` | `undefined` | Filter by status (open, next, waiting, scheduled, done, canceled) |
| `bookmarked` | `true \| false \| undefined` | `undefined` | Filter by bookmark status |

**API Calls**:
- `GET /api/tasks` - Fetch all tasks
- `GET /api/tasks?status=open` - Fetch tasks with status "open" (when filter active)
- `GET /api/tasks?bookmarked=true` - Fetch bookmarked tasks (when filter active)
- `GET /api/tasks?status=open&bookmarked=true` - Combined filters

**UI Elements**:
- Status filter dropdown: "All" / "Open" / "Next" / "Waiting" / "Scheduled" / "Done" / "Canceled"
- Bookmark filter toggle: "All" / "Bookmarked only"
- "New task" button → Navigate to `/tasks/new`
- Task list table: Columns = ID, Title, Status, Bookmarked, Created At, Updated At
- Click row → Navigate to `/tasks/:id`

**Success States**:
- Empty list: Display "No tasks found. Create your first task!"
- Loaded list: Display table with tasks

**Error States**:
- API error: Display error message with retry button

---

#### Task Detail

**Route**: `/tasks/:id`

**Component**: `TaskDetailPage`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `number` | Task ID |

**API Calls**:
- `GET /api/tasks/:id` - Fetch task details (title, bodyMd, status, scheduledOn, labels, commentsCount)
- `GET /api/tasks/:taskId/comments` - Fetch comments for this task
- `GET /api/issues/:id/links` - Fetch links for this task

**UI Elements**:
- Task title (heading)
- Task body (rendered as markdown, if present)
- Metadata: Status, Scheduled On (if present), Created At, Updated At
- "Edit" button → Navigate to `/tasks/:id/edit`
- "Delete" button → DELETE `/api/tasks/:id` → Navigate to `/tasks`
- "Bookmark" / "Unbookmark" button → POST `/api/tasks/:id/bookmark` or `/unbookmark`
- "Close" button (if status != done/canceled) → POST `/api/tasks/:id/close` → Status = "done"
- "Cancel" button (if status != canceled) → POST `/api/tasks/:id/cancel` → Status = "canceled"
- "Reopen" button (if status = done/canceled) → POST `/api/tasks/:id/reopen` → Status = "open"
- Labels section: (same as Memo Detail)
- Links section: (same as Memo Detail)
- Comments section: (same as Memo Detail, but uses `/api/tasks/:taskId/comments`)

**Success States**:
- Task loaded: Display all details
- Comments loaded: Display comment list
- Links loaded: Display link list

**Error States**:
- 404: Display "Task not found" with back button
- API error: Display error message with retry button

---

#### Task Create

**Route**: `/tasks/new`

**Component**: `TaskNewPage`

**API Calls**:
- `POST /api/tasks` - Create new task

**Request Payload**:
```json
{
  "title": "string (required, minLength: 1)",
  "bodyMd": "string (optional)",
  "status": "TaskStatus (required, enum: open/next/waiting/scheduled/done/canceled)",
  "scheduledOn": "string (optional, YYYY-MM-DD format)"
}
```

**UI Elements**:
- Form:
  - `title` input (required, placeholder: "Task title...")
  - `bodyMd` textarea (optional, placeholder: "Task description...")
  - `status` select dropdown (required, default: "open")
  - `scheduledOn` date input (optional, type="date")
  - "Save" button → Submit form → Navigate to `/tasks/:id` on success
  - "Cancel" button → Navigate to `/tasks`
- Validation:
  - Client-side: Check title is not empty before submission
  - Server-side: Display API error if validation fails (400)

**Success States**:
- Form submitted successfully → Navigate to `/tasks/:id`

**Error States**:
- Validation error (400): Display error message above form
- API error: Display error message with retry button

---

#### Task Edit

**Route**: `/tasks/:id/edit`

**Component**: `TaskEditPage`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `number` | Task ID |

**API Calls**:
- `GET /api/tasks/:id` - Fetch task for editing
- `PATCH /api/tasks/:id` - Update task

**Request Payload**:
```json
{
  "title": "string (optional)",
  "bodyMd": "string (optional)",
  "status": "TaskStatus (optional)",
  "scheduledOn": "string (optional, YYYY-MM-DD format)"
}
```

**UI Elements**:
- Form:
  - `title` input (pre-filled, required)
  - `bodyMd` textarea (pre-filled, optional)
  - `status` select dropdown (pre-filled, required)
  - `scheduledOn` date input (pre-filled, optional)
  - "Save" button → Submit form → Navigate to `/tasks/:id` on success
  - "Cancel" button → Navigate to `/tasks/:id`
- Validation:
  - Client-side: Check title is not empty before submission
  - Server-side: Display API error if validation fails (400)

**Success States**:
- Form submitted successfully → Navigate to `/tasks/:id`

**Error States**:
- 404: Display "Task not found" with back button
- Validation error (400): Display error message above form
- API error: Display error message with retry button

---

## Modal Components

Modals are overlays that appear on detail pages. They do not have their own routes.

### Label Assignment Modal

**Trigger**: "[+] Assign label" button on Memo/Task detail page

**Component**: `LabelModal`

**API Calls**:
- `GET /api/labels` - Fetch all available labels
- `POST /api/labels` - Create new label (if user chooses "Create new")
- `POST /api/issues/:issueId/labels` - Assign label to issue

**Request Payloads**:

**Create Label**:
```json
{
  "name": "string (required, minLength: 1)",
  "description": "string (optional)"
}
```

**Assign Label**:
```json
{
  "labelId": "number (required)"
}
```

**UI Elements**:
- Label selection:
  - Display all labels in a list (name, description)
  - Radio button or click to select a label
  - "Assign" button → POST `/api/issues/:issueId/labels` → Close modal
- Create new label:
  - "Create new" button → Show form
  - `name` input (required)
  - `description` textarea (optional)
  - "Create & Assign" button → POST `/api/labels` then POST `/api/issues/:issueId/labels` → Close modal
- "Cancel" button → Close modal

**Success States**:
- Label assigned → Close modal, refresh detail page

**Error States**:
- Validation error (400): Display error message in modal
- Conflict error (409): Display "Label name already exists" in modal
- API error: Display error message in modal

---

### Link Creation Modal

**Trigger**: "[+] Create link" button on Memo/Task detail page

**Component**: `LinkModal`

**API Calls**:
- `POST /api/links` - Create new link

**Request Payload**:
```json
{
  "sourceIssueId": "number (required)",
  "targetIssueId": "number (required)",
  "linkType": "LinkType (required, enum: parent/child/relates/derived_from)"
}
```

**UI Elements**:
- Form:
  - `linkType` select dropdown (required, default: "relates")
  - `targetIssueId` number input (required, placeholder: "Enter issue ID...")
  - "Create Link" button → Submit form → Close modal
  - "Cancel" button → Close modal
- Validation:
  - Client-side: Check targetIssueId is a positive integer
  - Server-side: Display API error if target doesn't exist (404)

**Success States**:
- Link created → Close modal, refresh detail page

**Error States**:
- Validation error (400): Display error message in modal
- Not found error (404): Display "Target issue not found" in modal
- API error: Display error message in modal

---

### Memo Promotion Modal

**Trigger**: "Promote to Task" button on Memo detail page

**Component**: `PromoteModal`

**API Calls**:
- `POST /api/memos/:id/promote` - Promote memo to task

**Request Payload**:
```json
{
  "title": "string (required, minLength: 1)",
  "status": "TaskStatus (required, enum: open/next/waiting/scheduled)"
}
```

**UI Elements**:
- Form:
  - `title` input (required, placeholder: "Task title...")
  - `status` select dropdown (required, default: "open", options: open/next/waiting/scheduled only, excludes done/canceled)
  - "Promote" button → Submit form → Navigate to `/tasks/:taskId` on success
  - "Cancel" button → Close modal
- Validation:
  - Client-side: Check title is not empty before submission
  - Server-side: Display API error if validation fails (400)

**Success States**:
- Memo promoted → Navigate to `/tasks/:taskId`

**Error States**:
- Validation error (400): Display error message in modal
- API error: Display error message in modal

---

## Error Handling

### 404 Not Found

**Trigger**: Navigating to `/memos/:id` or `/tasks/:id` when ID doesn't exist

**Response**: API returns 404 status code

**UI Behavior**:
- Display "Memo not found" or "Task not found" message
- Display "Back to Memos" or "Back to Tasks" button

---

### 400 Bad Request

**Trigger**: Form submission with invalid data

**Response**: API returns 400 status code with error details

**UI Behavior**:
- Display error message above form or in modal
- Do not navigate away from current page
- Allow user to correct input and retry

---

### 409 Conflict

**Trigger**: Creating a label with duplicate name

**Response**: API returns 409 status code

**UI Behavior**:
- Display "Label name already exists" message in modal
- Allow user to change label name and retry

---

### 500 Internal Server Error

**Trigger**: Server error during API request

**Response**: API returns 500 status code

**UI Behavior**:
- Display generic error message: "Something went wrong. Please try again."
- Provide "Retry" button to repeat the request

---

## Navigation Flow

```
/memos
  ├─ /memos/new → POST /api/memos → /memos/:id
  └─ /memos/:id
       ├─ /memos/:id/edit → PATCH /api/memos/:id → /memos/:id
       ├─ [Delete] → DELETE /api/memos/:id → /memos
       ├─ [Promote] → POST /api/memos/:id/promote → /tasks/:taskId
       └─ [Assign Label] → Modal → POST /api/issues/:id/labels

/tasks
  ├─ /tasks/new → POST /api/tasks → /tasks/:id
  └─ /tasks/:id
       ├─ /tasks/:id/edit → PATCH /api/tasks/:id → /tasks/:id
       ├─ [Delete] → DELETE /api/tasks/:id → /tasks
       ├─ [Close/Cancel/Reopen] → POST /api/tasks/:id/{action} → Refresh
       └─ [Assign Label] → Modal → POST /api/issues/:id/labels
```

## Performance Considerations

**Route Transitions**:
- Use React Router's `<Link>` component for client-side navigation (no page reload)
- Prefetch data on hover for instant navigation (can be added later)

**Loading States**:
- Show loading spinner during API requests
- Disable submit buttons during form submission to prevent double-clicks

**Optimistic Updates** (future enhancement):
- Update UI immediately for bookmark/close/reopen actions
- Revert on API error

## Security Considerations

**XSS Prevention**:
- All markdown content rendered via react-markdown (safe by default)
- All user inputs escaped by React (JSX escaping)

**CSRF Protection**:
- Not required (same origin - API and UI both served from localhost:3000)
- No cookies used for authentication (local development only)

**Input Validation**:
- Client-side validation for UX (immediate feedback)
- Server-side validation enforced by API (never trust client)
