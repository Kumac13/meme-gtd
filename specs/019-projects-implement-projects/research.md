# Technical Research: Project Detail Page Implementation

## Technical Context

### Frontend Stack

**Core Libraries:**
- **React**: v19.2.0 (latest major version)
- **React DOM**: v19.2.0
- **Router**: React Router DOM v7.9.4 (latest v7)
- **TypeScript**: v5.5.4
- **Build Tool**: Vite v7.1.11

**State Management:**
- No global state management library (Redux, Zustand, etc.)
- Component-level state with React hooks (`useState`, `useEffect`)
- Direct API service calls from components
- State lifted to parent components when needed

**Styling:**
- **Tailwind CSS**: v4.1.14 (using new @theme directive)
- Custom GitHub green color scheme defined in `/packages/web/src/styles/index.css`:
  - `--color-github-green-500: #2da44e`
  - `--color-github-green-600: #238636`
  - `--color-github-green-700: #1a7f37`
  - `--color-github-green-800: #116329`
- Utility-first CSS approach with inline Tailwind classes

**Development Tools:**
- **Vite Dev Server**: Port 5173 (proxies `/api` to port 3000)
- **Testing**: Vitest + React Testing Library + Playwright
- **API Code Generation**: openapi-typescript-codegen

### Existing Components for Reuse

#### Layout & Structure
- **`Layout.tsx`** (`/packages/web/src/components/Layout.tsx`)
  - Top-level layout with navigation header
  - Uses `<Outlet />` for nested routes
  - Active link highlighting with border-bottom
  - Already includes Projects link in navigation

#### List & Display Components
- **`ItemList.tsx`** (`/packages/web/src/components/ItemList.tsx`)
  - Generic list component for memos, tasks, and projects
  - Supports three item types: `'memo' | 'task' | 'project'`
  - Renders cards with hover effects
  - Shows metadata (ID, dates, labels, comment count, bookmark icon)
  - Type guards: `isTask()`, `isProject()`
  - **Limitation**: Designed for vertical lists, not suitable for Kanban columns

- **`ItemDetail.tsx`** (`/packages/web/src/components/ItemDetail.tsx`)
  - Detail view for individual items (memo/task)
  - Editable content with inline editing
  - Comment section
  - Link section
  - Projects sidebar (`ProjectsSection`)
  - Bookmark and delete actions
  - **Note**: Used by MemoDetail and TaskDetail pages, but NOT suitable for project detail page

#### State Components
- **`LoadingState.tsx`** (`/packages/web/src/components/LoadingState.tsx`)
  - Centered spinner with customizable message
  - Props: `message?: string` (default: "Loading...")

- **`ErrorState.tsx`** (`/packages/web/src/components/ErrorState.tsx`)
  - Error display with red background
  - Props: `error: string`, `title?: string`

- **`EmptyState.tsx`** (`/packages/web/src/components/EmptyState.tsx`)
  - Gray background with centered message
  - Props: `message: string`, `submessage?: string`

#### Filter Components
- **`FilterBar.tsx`** (`/packages/web/src/components/FilterBar.tsx`)
  - Used in TasksList for status and bookmark filtering
  - Status buttons: all, open, next, waiting, scheduled, done, canceled
  - Bookmark toggle button
  - Active state styling with `bg-github-green-600`

#### Form Components
- **`MemoForm.tsx`**, **`TaskForm.tsx`**, **`ProjectForm.tsx`**
  - Form components for creating/editing items
  - Validation logic
  - Not directly reusable for project detail page

#### Project-Specific Components
- **`ProjectsSection.tsx`** (`/packages/web/src/components/ProjectsSection.tsx`)
  - Sidebar component showing associated projects for memo/task
  - Project management modal integration
  - **Cannot be reused** for project detail page (different context)

- **`ProjectManagementModal.tsx`** (`/packages/web/src/components/ProjectManagementModal.tsx`)
  - Modal for adding/removing items from projects
  - Search and filter functionality
  - Recent projects section
  - **Cannot be reused** directly, but provides pattern reference

### API Integration Patterns

#### Service Structure
All API services follow a consistent pattern:

**Location**: `/packages/web/src/api/services/`
- `MemosService.ts` (auto-generated from OpenAPI)
- `TasksService.ts` (auto-generated from OpenAPI)
- `ProjectsService.ts` (manually written wrapper)

**Pattern Example** (`ProjectsService.ts`):
```typescript
export class ProjectsService {
  static async getProject(id: string): Promise<ProjectDetail> {
    const response = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch project ${id}: ${response.statusText}`);
    }

    return response.json();
  }
}
```

**Usage in Components**:
```typescript
// Example from TaskDetail.tsx
useEffect(() => {
  async function fetchTask() {
    try {
      setLoading(true);
      setError(null);
      const response = await TasksService.getTask(id);
      setTask(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }
  fetchTask();
}, [id]);
```

#### Error Handling Pattern
1. Try-catch blocks around async calls
2. Set error state with descriptive message
3. Display ErrorState component when error exists
4. Console.error for debugging

#### Loading State Pattern
1. Set `loading: true` before API call
2. Set `loading: false` in finally block
3. Show LoadingState component while loading
4. Guard against rendering main content until data loaded

### Backend API Availability

All required endpoints are **already implemented** in `/packages/api/src/routes/projects.ts`:

#### Project Management
- **GET /api/projects/:id** - Get project details with items
  - Returns: `ProjectDetail` (project + items with issue info)
  - Used by: Project detail page (main data fetch)

- **GET /api/projects** - List all projects
  - Returns: `Project[]`
  - Used by: Projects list page (already exists)

#### Project Items Management
- **POST /api/projects/:id/items** - Add item to project
  - Body: `{ issueId: number, position?: number, column?: string }`
  - Returns: `ProjectItem`
  - Used by: Add task/memo to project

- **PATCH /api/projects/:id/items/:issueId** - Update project item
  - Body: `{ position?: number, column?: string }`
  - Returns: `ProjectItem`
  - Used by: Drag-and-drop reordering, column changes

- **DELETE /api/projects/:id/items/:issueId** - Remove item from project
  - Returns: void (204)
  - Used by: Remove button on items

### Type Definitions

#### Web Package Types (`/packages/web/src/types/project.ts`)
Legacy types from Feature 017 (Projects Sidebar):
```typescript
interface Project {
  id: number;
  name: string;
  description: string;
  createdAt: string;
}

interface ProjectItem {
  id: number;
  projectId: number;
  issueId: number;
  position: number;
  viewMeta?: ProjectViewMeta;
  createdAt: string;
  updatedAt: string;
}

type ProjectStatus = 'No status' | 'In Progress' | 'Done' | 'Backlog' | 'Blocked';
```

**Issue**: Web types are outdated and don't match shared types.

#### Shared Package Types (`/packages/shared/src/types/project.ts`)
Current canonical types from Feature 019 (Project Management):
```typescript
interface Project {
  id: number;
  name: string;
  description: string | null;
  viewMeta: ViewMeta;
  createdAt: string;
}

interface ViewMeta {
  viewType: 'board' | 'table';
  columns?: string[]; // Board view only
}

interface ProjectItem {
  id: number;
  projectId: number;
  issueId: number;
  position: number; // REAL type for fractional positioning
  viewMeta: {
    column?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface ProjectItemWithIssue extends ProjectItem {
  issue: {
    id: number;
    type: 'task' | 'memo';
    title: string;
  };
}

interface ProjectDetail extends Project {
  items: ProjectItemWithIssue[];
}
```

**Action Required**: Update web package types to match shared types.

### Routing Patterns

#### Current Routes (`/packages/web/src/App.tsx`)
```typescript
<Route path="/" element={<Layout />}>
  <Route path="memos" element={<MemosList />} />
  <Route path="memos/:id" element={<MemoDetail />} />
  <Route path="memos/:id/edit" element={<MemoEdit />} />

  <Route path="tasks" element={<TasksList />} />
  <Route path="tasks/:id" element={<TaskDetail />} />
  <Route path="tasks/:id/edit" element={<TaskEdit />} />

  <Route path="projects" element={<ProjectsList />} />
  <Route path="projects/new" element={<ProjectNew />} />
  {/* Need to add: ProjectDetail */}
</Route>
```

#### Existing Page Patterns

**List Page Pattern** (`TasksList.tsx`, `MemosList.tsx`, `ProjectsList.tsx`):
- Fetch data in useEffect
- Filter state management
- "New" button in header
- ItemList component for rendering
- Loading/Error/Empty states

**Detail Page Pattern** (`TaskDetail.tsx`, `MemoDetail.tsx`):
- Extract `id` from `useParams()`
- Fetch single item in useEffect
- Action handlers (delete, bookmark, update)
- Pass item to ItemDetail component
- Loading/Error states

**Pattern for Project Detail Page**:
- Follow detail page pattern
- Extract `id` from `useParams()`
- Fetch project with items
- **Different from ItemDetail**: Custom layout with Kanban/List views
- View switcher in header
- Drag-and-drop for Kanban
- Table for List view

### Utility Functions

#### Date Utilities (`/packages/web/src/utils/dates.ts`)
- `formatDateTime(isoString)` → "2025-01-15 10:30"
- `formatDate(isoString)` → "2025-01-15"
- `formatRelativeTime(isoString)` → "2 hours ago"

#### Markdown Utilities (`/packages/web/src/utils/markdown.tsx`)
- `truncateMarkdown(markdown, length)` → Truncated preview
- React Markdown rendering with remark-gfm

#### Validation Utilities (`/packages/web/src/utils/validation.ts`)
- Form validation helpers

## Technology Decisions

### Decision 1: Drag-and-Drop Library

**Chosen**: `@dnd-kit/core` + `@dnd-kit/sortable`

**Rationale**:
1. **React 19 Compatible**: Full support for latest React (v19.2.0)
2. **TypeScript-First**: Built with TypeScript, excellent type safety
3. **Lightweight**: ~10KB gzipped (core + sortable)
4. **Accessibility**: Built-in keyboard navigation, screen reader support
5. **Performance**: Virtual scrolling support, optimized re-renders
6. **Active Maintenance**: Regular updates, modern API design
7. **Flexible**: Supports multiple drag-and-drop patterns (sortable, multi-drag, etc.)

**Implementation Plan**:
```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Key Components**:
- `DndContext` - Wrap entire draggable area
- `SortableContext` - Wrap sortable list/column
- `useSortable` - Hook for individual draggable items
- `DragOverlay` - Portal for drag preview

**Alternatives Considered**:
- **react-beautiful-dnd**: ❌ Not React 18+ compatible, maintenance mode since 2021
- **react-dnd**: ❌ More complex API, larger bundle (25KB+), older design patterns
- **react-sortable-hoc**: ❌ Deprecated, not maintained

### Decision 2: Routing Structure

**Chosen**: Nested routes with React Router v7

**URL Structure**:
```
/projects              → ProjectsList
/projects/new          → ProjectNew
/projects/:id          → ProjectDetail (redirects to default view)
/projects/:id/kanban   → ProjectDetail (Kanban view)
/projects/:id/list     → ProjectDetail (List view)
```

**Rationale**:
1. **URL Shareability**: Users can bookmark specific views
2. **Browser History**: Back/forward buttons work correctly
3. **Deep Linking**: Can link directly to Kanban or List view
4. **Consistent Pattern**: Matches existing memo/task routing
5. **SEO-Friendly**: Clean, semantic URLs

**Implementation**:
```typescript
// App.tsx
<Route path="projects/:id" element={<ProjectDetail />}>
  <Route index element={<Navigate to="kanban" replace />} />
  <Route path="kanban" element={<KanbanView />} />
  <Route path="list" element={<ListView />} />
</Route>
```

**Alternatives Considered**:
- **Query Parameters** (`?view=kanban`): ❌ Less clean, harder to bookmark, query string in URL
- **State-Only** (no URL changes): ❌ Can't share specific view, breaks back button
- **Single Route with Conditional Rendering**: ❌ No URL changes, poor UX

### Decision 3: View State Management

**Chosen**: URL-driven state (React Router `useParams`)

**Rationale**:
1. **Single Source of Truth**: URL is the source of truth for current view
2. **No State Sync Issues**: Eliminates state/URL desync bugs
3. **Simplicity**: No need for view state management
4. **Persistence**: View persists across page refreshes

**Implementation**:
```typescript
// ProjectDetail.tsx
const { id, view } = useParams(); // view = 'kanban' | 'list'

// View switcher
<Link to={`/projects/${id}/kanban`}>Kanban</Link>
<Link to={`/projects/${id}/list`}>List</Link>
```

**Alternatives Considered**:
- **useState + localStorage**: ❌ Requires sync logic, can desync from URL
- **Context API**: ❌ Overkill for single view state
- **Query Parameters**: ❌ Addressed in Decision 2

### Decision 4: Kanban Column Management

**Chosen**: Dynamic columns from `project.viewMeta.columns`

**Rationale**:
1. **Backend-Driven**: Columns defined in project creation (board view)
2. **Flexibility**: Each project can have custom columns
3. **No Hardcoding**: No hardcoded "Todo", "In Progress", "Done"
4. **API Support**: Backend already stores columns in `view_meta`

**Column Retrieval**:
```typescript
const columns = project.viewMeta.viewType === 'board'
  ? project.viewMeta.columns || []
  : [];
```

**Item Placement**:
```typescript
const itemsByColumn = columns.reduce((acc, column) => {
  acc[column] = items.filter(item => item.viewMeta?.column === column);
  return acc;
}, {} as Record<string, ProjectItemWithIssue[]>);
```

**Alternatives Considered**:
- **Hardcoded Columns**: ❌ Not flexible, requires backend changes for new columns
- **Frontend-Only Columns**: ❌ Loses data on refresh, no persistence

### Decision 5: Data Fetching Strategy

**Chosen**: Single API call + client-side filtering

**Rationale**:
1. **Simplicity**: One API call to GET /api/projects/:id
2. **Backend Support**: Backend returns all items with issue info
3. **Real-Time Updates**: Easy to refetch entire dataset
4. **No Pagination Needed**: Projects typically have <100 items

**Implementation**:
```typescript
const { data: project, loading, error } = useProjectDetail(id);

// Client-side filtering for search/filters
const filteredItems = useMemo(() => {
  return project.items.filter(item => {
    // Apply filters
  });
}, [project.items, filters]);
```

**Alternatives Considered**:
- **Multiple API Calls per Column**: ❌ Too many requests, slow
- **GraphQL**: ❌ Not implemented in backend, overkill

### Decision 6: Item Rendering

**Chosen**: Custom card component (not reusing ItemList)

**Rationale**:
1. **Different Layout**: Kanban cards vs vertical list items
2. **Compact Design**: Less metadata, focus on title and type
3. **Drag Handle**: Visual indicator for draggable items
4. **Action Buttons**: Quick remove button on each card

**Card Design**:
- Task/memo type badge
- Title (truncated)
- Issue ID
- Remove button (X icon)
- Drag handle (⋮⋮ icon)

**Why Not Reuse ItemList**:
- ItemList designed for vertical scrolling lists
- Shows too much metadata (dates, labels, comments)
- No drag-and-drop support
- Wrong hover states and spacing

## Implementation Notes

### Critical Files to Create
1. `/packages/web/src/pages/ProjectDetail.tsx` - Main container page
2. `/packages/web/src/components/KanbanBoard.tsx` - Kanban view component
3. `/packages/web/src/components/KanbanColumn.tsx` - Single column component
4. `/packages/web/src/components/KanbanCard.tsx` - Draggable card component
5. `/packages/web/src/components/ProjectListView.tsx` - Table view component
6. `/packages/web/src/hooks/useProjectDetail.ts` - Data fetching hook

### Critical Files to Update
1. `/packages/web/src/App.tsx` - Add ProjectDetail routes
2. `/packages/web/src/types/project.ts` - Sync with shared types
3. `/packages/web/package.json` - Add @dnd-kit dependencies

### Testing Strategy
1. **Unit Tests**: Vitest for utility functions
2. **Component Tests**: React Testing Library for components
3. **E2E Tests**: Playwright for drag-and-drop interactions
4. **Manual Testing**: Real browser testing on http://localhost:3001

### Performance Considerations
1. **useMemo for Filtering**: Prevent unnecessary re-renders
2. **Virtual Scrolling**: If columns exceed ~50 items
3. **Debounced Search**: Avoid filtering on every keystroke
4. **Optimistic Updates**: Update UI before API response

### Accessibility Requirements
1. **Keyboard Navigation**: Tab through items, Space/Enter to drag
2. **Screen Reader Announcements**: Drag start/end/move
3. **Focus Management**: Maintain focus after drop
4. **ARIA Labels**: Describe draggable items and drop zones

## References

- React Router v7 Docs: https://reactrouter.com/
- @dnd-kit Documentation: https://docs.dndkit.com/
- Tailwind CSS v4 Docs: https://tailwindcss.com/
- Backend API Schema: `/packages/api/src/schemas/projectSchemas.ts`
- Existing Patterns: TaskDetail.tsx, MemoDetail.tsx, ProjectsList.tsx
