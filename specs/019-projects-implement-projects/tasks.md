# Implementation Tasks: Project Detail Views

**Feature**: 019-projects-implement-projects
**Branch**: `019-projects-implement-projects`
**Generated**: 2025-10-27

## Task Overview

Total tasks: 19
Parallel opportunities: 5 groups
Estimated effort: 7-8 hours
MVP recommendation: Phase 1-4 (US1+US2 only - Kanban with drag-and-drop)

## Phase 0: Prerequisites & Setup

### T001 - Install Drag-and-Drop Dependencies [P]
**Story**: Setup
**Files**: `packages/web/package.json`
**Dependencies**: None
**Parallelizable**: Yes

Install @dnd-kit packages for drag-and-drop functionality.

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities --filter meme-gtd-web
```

**Acceptance**:
- [ ] package.json includes @dnd-kit/core
- [ ] package.json includes @dnd-kit/sortable
- [ ] package.json includes @dnd-kit/utilities
- [ ] pnpm install completes without errors

---

### T002 - Sync Web Types with Shared Types [P]
**Story**: Setup
**Files**: `packages/web/src/types/project.ts`
**Dependencies**: None
**Parallelizable**: Yes

Update web package types to re-export from shared package to resolve type inconsistency identified in research.

**Current issue**: Web types are outdated from Feature 017, shared types are current (Feature 019).

**Implementation**:
```typescript
// Replace entire file content with:
export type {
  Project,
  ProjectItem,
  ProjectItemWithIssue,
  ProjectDetail,
  ViewMeta,
  ViewType
} from 'meme-gtd-shared';
```

**Acceptance**:
- [ ] Web types re-export from shared package
- [ ] No duplicate type definitions
- [ ] TypeScript compilation succeeds

---

## Phase 1: Foundational Infrastructure

### T003 - Create ProjectDetail Main Page Component
**Story**: Foundation
**Files**: `packages/web/src/pages/ProjectDetail.tsx` (NEW)
**Dependencies**: T002
**Parallelizable**: No

Create main container page that fetches project data and renders view tabs.

**Implementation**:
```typescript
import { useState, useEffect } from 'react';
import { useParams, Outlet, Link, useLocation } from 'react-router-dom';
import { ProjectsService } from '../api/services/ProjectsService';
import { ProjectDetail as ProjectDetailType } from '../types/project';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [project, setProject] = useState<ProjectDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProject() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const data = await ProjectsService.getProject(id);
        setProject(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setLoading(false);
      }
    }
    fetchProject();
  }, [id]);

  if (loading) return <LoadingState message="Loading project..." />;
  if (error) return <ErrorState error={error} />;
  if (!project) return <ErrorState error="Project not found" />;

  const isKanban = location.pathname.includes('/kanban');
  const isList = location.pathname.includes('/list');

  return (
    <div className="max-w-7xl mx-auto px-4 py-2">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold">{project.name}</h1>
        {project.description && (
          <p className="text-gray-600 mt-2">{project.description}</p>
        )}
      </div>

      {/* View Tabs */}
      <div className="flex gap-4 mb-4 border-b border-gray-200">
        <Link
          to={`/projects/${id}/kanban`}
          className={`px-4 py-2 ${
            isKanban
              ? 'border-b-2 border-github-green-500 text-gray-900 font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Kanban
        </Link>
        <Link
          to={`/projects/${id}/list`}
          className={`px-4 py-2 ${
            isList
              ? 'border-b-2 border-github-green-500 text-gray-900 font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Lists
        </Link>
      </div>

      {/* Child View (Kanban or List) */}
      <Outlet context={{ project, setProject }} />
    </div>
  );
}
```

**Acceptance**:
- [ ] Page fetches project data on mount
- [ ] Loading state displays during fetch
- [ ] Error state displays on fetch failure
- [ ] Project name and description render correctly
- [ ] Two tabs (Kanban, Lists) are visible
- [ ] Active tab has visual indicator
- [ ] Outlet renders child view

---

### T004 - Add Project Detail Routes to App.tsx
**Story**: Foundation
**Files**: `packages/web/src/App.tsx`
**Dependencies**: T003
**Parallelizable**: No

Add nested routes for project detail page with Kanban and List views.

**Implementation**:
Add to existing routes:
```typescript
import ProjectDetail from './pages/ProjectDetail';
import KanbanView from './pages/KanbanView';
import ListView from './pages/ListView';

// In Routes:
<Route path="projects/:id" element={<ProjectDetail />}>
  <Route index element={<Navigate to="kanban" replace />} />
  <Route path="kanban" element={<KanbanView />} />
  <Route path="list" element={<ListView />} />
</Route>
```

**Acceptance**:
- [ ] `/projects/:id` redirects to `/projects/:id/kanban`
- [ ] `/projects/:id/kanban` renders KanbanView
- [ ] `/projects/:id/list` renders ListView
- [ ] TypeScript compilation succeeds

---

## Phase 2: User Story 1 - Kanban Board Visualization (P1)

### T005 - Create KanbanView Page Component
**Story**: US1
**Files**: `packages/web/src/pages/KanbanView.tsx` (NEW)
**Dependencies**: T004
**Parallelizable**: No

Create page component that receives project data and renders KanbanBoard.

**Implementation**:
```typescript
import { useOutletContext } from 'react-router-dom';
import { ProjectDetail } from '../types/project';
import KanbanBoard from '../components/KanbanBoard';
import EmptyState from '../components/EmptyState';

interface OutletContext {
  project: ProjectDetail;
  setProject: (project: ProjectDetail) => void;
}

export default function KanbanView() {
  const { project, setProject } = useOutletContext<OutletContext>();

  if (project.items.length === 0) {
    return <EmptyState message="No items in this project. Add tasks or memos to get started." />;
  }

  return <KanbanBoard project={project} onProjectUpdate={setProject} />;
}
```

**Acceptance**:
- [ ] Component receives project from outlet context
- [ ] Empty state shows when project has no items
- [ ] KanbanBoard renders when items exist
- [ ] TypeScript compilation succeeds

---

### T006 - Create KanbanCard Component
**Story**: US1
**Files**: `packages/web/src/components/KanbanCard.tsx` (NEW)
**Dependencies**: T001, T002
**Parallelizable**: Yes (with T007)

Create draggable card component for displaying task/memo in Kanban board.

**Implementation**:
```typescript
import { useDraggable } from '@dnd-kit/core';
import { ProjectItemWithIssue } from '../types/project';

interface KanbanCardProps {
  item: ProjectItemWithIssue;
}

export default function KanbanCard({ item }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.issueId.toString(),
    data: {
      item,
      type: 'kanban-card'
    }
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        bg-white p-3 rounded border border-gray-200
        cursor-move hover:shadow-md transition-shadow
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-gray-500">#{item.issueId}</span>
        <span className={`
          text-xs px-2 py-0.5 rounded
          ${item.issue.type === 'task' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}
        `}>
          {item.issue.type}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-900">
        {item.issue.title}
      </p>
    </div>
  );
}
```

**Acceptance**:
- [ ] Card displays issue ID and type
- [ ] Card displays issue title
- [ ] Card is draggable (cursor changes on hover)
- [ ] Card shows visual feedback during drag
- [ ] TypeScript compilation succeeds

---

### T007 - Create KanbanColumn Component
**Story**: US1
**Files**: `packages/web/src/components/KanbanColumn.tsx` (NEW)
**Dependencies**: T001, T006
**Parallelizable**: Yes (with T006)

Create droppable column component that contains cards.

**Implementation**:
```typescript
import { useDroppable } from '@dnd-kit/core';
import { ProjectItemWithIssue } from '../types/project';
import KanbanCard from './KanbanCard';

interface KanbanColumnProps {
  column: string;
  items: ProjectItemWithIssue[];
}

export default function KanbanColumn({ column, items }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column,
    data: {
      type: 'kanban-column',
      column
    }
  });

  return (
    <div className="flex flex-col min-w-[320px] max-w-[320px]">
      {/* Column Header */}
      <div className="bg-gray-50 px-4 py-2 rounded-t-lg border border-gray-200 border-b-0">
        <h3 className="font-semibold text-gray-900">
          {column} <span className="text-gray-500 font-normal">({items.length})</span>
        </h3>
      </div>

      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        className={`
          flex-1 bg-gray-50 p-4 rounded-b-lg border border-gray-200
          min-h-[200px] space-y-2
          ${isOver ? 'bg-github-green-50 border-github-green-300' : ''}
        `}
      >
        {items.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">
            No items
          </p>
        ) : (
          items.map(item => <KanbanCard key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}
```

**Acceptance**:
- [ ] Column displays name and item count
- [ ] Column contains cards for all items
- [ ] Column shows visual feedback when card is dragged over
- [ ] Empty column shows placeholder message
- [ ] TypeScript compilation succeeds

---

### T008 - Create KanbanBoard Component with Column Grouping
**Story**: US1
**Files**: `packages/web/src/components/KanbanBoard.tsx` (NEW)
**Dependencies**: T007
**Parallelizable**: No

Create board component that groups items by column and renders columns.

**Implementation**:
```typescript
import { useMemo } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { ProjectDetail, ProjectItemWithIssue } from '../types/project';
import KanbanColumn from './KanbanColumn';

interface KanbanBoardProps {
  project: ProjectDetail;
  onProjectUpdate: (project: ProjectDetail) => void;
}

export default function KanbanBoard({ project, onProjectUpdate }: KanbanBoardProps) {
  // Group items by column
  const itemsByColumn = useMemo(() => {
    const columns = project.viewMeta.columns || [];
    const grouped: Record<string, ProjectItemWithIssue[]> = {};

    // Initialize all columns
    columns.forEach(col => {
      grouped[col] = [];
    });

    // Group items
    project.items.forEach(item => {
      const column = item.viewMeta?.column;
      if (column && grouped[column]) {
        grouped[column].push(item);
      } else {
        // Items without valid column go to "Unassigned"
        if (!grouped['Unassigned']) {
          grouped['Unassigned'] = [];
        }
        grouped['Unassigned'].push(item);
      }
    });

    // Sort items within each column by position
    Object.keys(grouped).forEach(col => {
      grouped[col].sort((a, b) => a.position - b.position);
    });

    return grouped;
  }, [project.items, project.viewMeta.columns]);

  const columns = useMemo(() => {
    const cols = project.viewMeta.columns || [];
    // Add "Unassigned" if there are unassigned items
    if (itemsByColumn['Unassigned']?.length > 0) {
      return [...cols, 'Unassigned'];
    }
    return cols;
  }, [project.viewMeta.columns, itemsByColumn]);

  async function handleDragEnd(event: DragEndEvent) {
    // Will be implemented in T009
    console.log('Drag end:', event);
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(column => (
          <KanbanColumn
            key={column}
            column={column}
            items={itemsByColumn[column] || []}
          />
        ))}
      </div>
    </DndContext>
  );
}
```

**Acceptance**:
- [ ] Items are grouped by viewMeta.column
- [ ] Items without valid column appear in "Unassigned"
- [ ] Items are sorted by position within each column
- [ ] All columns defined in project.viewMeta.columns are rendered
- [ ] Board scrolls horizontally if columns exceed viewport
- [ ] TypeScript compilation succeeds

---

**CHECKPOINT 1**: User Story 1 Complete - Kanban board visualization working

Test:
- [ ] Navigate to `/projects/:id/kanban`
- [ ] See columns with task status labels
- [ ] See item counts in column headers
- [ ] See cards in correct columns
- [ ] Empty columns show placeholder

---

## Phase 3: User Story 2 - Drag-and-Drop Interaction (P1)

### T009 - Implement Drag-and-Drop Logic in KanbanBoard
**Story**: US2
**Files**: `packages/web/src/components/KanbanBoard.tsx`
**Dependencies**: T008
**Parallelizable**: No

Implement optimistic update pattern for drag-and-drop with error handling.

**Implementation**:
Update the `handleDragEnd` function in KanbanBoard.tsx:

```typescript
import { useState } from 'react';
import { ProjectsService } from '../api/services/ProjectsService';

// Add to component:
const [dragError, setDragError] = useState<string | null>(null);

async function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;

  if (!over) return;

  const itemId = Number(active.id);
  const newColumn = over.id as string;

  // Find the item being dragged
  const item = project.items.find(i => i.issueId === itemId);
  if (!item) return;

  // Check if column changed
  const oldColumn = item.viewMeta?.column;
  if (oldColumn === newColumn) return;

  // Store original project for potential revert
  const originalProject = { ...project };

  // Optimistic update: update local state immediately
  const updatedItems = project.items.map(i => {
    if (i.issueId === itemId) {
      return {
        ...i,
        viewMeta: { ...i.viewMeta, column: newColumn }
      };
    }
    return i;
  });

  onProjectUpdate({
    ...project,
    items: updatedItems
  });

  // Clear any previous errors
  setDragError(null);

  try {
    // API call to persist change
    await ProjectsService.updateProjectItem(project.id, itemId, {
      column: newColumn
    });
  } catch (err) {
    // Revert on error
    onProjectUpdate(originalProject);
    const errorMsg = err instanceof Error ? err.message : 'Failed to move item';
    setDragError(errorMsg);
    console.error('Drag-and-drop failed:', err);
  }
}

// Add error display after DndContext:
{dragError && (
  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
    <p className="text-red-700 text-sm">{dragError}</p>
  </div>
)}
```

**Acceptance**:
- [ ] Dragging card between columns updates UI immediately
- [ ] API call is made to persist change
- [ ] On success, change remains in UI
- [ ] On failure, card reverts to original column
- [ ] Error message displays on failure
- [ ] Column counts update after drag

---

### T010 - Add Drag Overlay for Better Visual Feedback
**Story**: US2
**Files**: `packages/web/src/components/KanbanBoard.tsx`
**Dependencies**: T009
**Parallelizable**: No

Add drag overlay to show what's being dragged.

**Implementation**:
```typescript
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { useState } from 'react';

// Add state:
const [activeId, setActiveId] = useState<string | null>(null);

function handleDragStart(event: any) {
  setActiveId(event.active.id);
}

function handleDragEnd(event: DragEndEvent) {
  setActiveId(null);
  // ... existing drag end logic
}

function handleDragCancel() {
  setActiveId(null);
}

// Update DndContext:
<DndContext
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
  onDragCancel={handleDragCancel}
>
  {/* existing columns */}

  <DragOverlay>
    {activeId ? (
      <div className="opacity-90 rotate-3 scale-105">
        <KanbanCard
          item={project.items.find(i => i.issueId === Number(activeId))!}
        />
      </div>
    ) : null}
  </DragOverlay>
</DndContext>
```

**Acceptance**:
- [ ] During drag, overlay shows copy of card
- [ ] Overlay follows cursor
- [ ] Overlay has visual distinction (rotation/scale)
- [ ] Original card remains in place with reduced opacity

---

**CHECKPOINT 2**: User Story 2 Complete - Drag-and-drop fully functional

Test:
- [ ] Drag card from one column to another
- [ ] Card moves immediately (optimistic update)
- [ ] Reload page - card stays in new column
- [ ] Simulate API failure - card reverts and shows error
- [ ] Column counts update after drag

---

## Phase 4: User Story 3 - List View (P2)

### T011 - Create ListView Page Component
**Story**: US3
**Files**: `packages/web/src/pages/ListView.tsx` (NEW)
**Dependencies**: T004
**Parallelizable**: No

Create list view component that displays all project items in a table format.

**Implementation**:
```typescript
import { useOutletContext } from 'react-router-dom';
import { ProjectDetail } from '../types/project';
import EmptyState from '../components/EmptyState';

interface OutletContext {
  project: ProjectDetail;
}

export default function ListView() {
  const { project } = useOutletContext<OutletContext>();

  if (project.items.length === 0) {
    return <EmptyState message="No items in this project. Add tasks or memos to get started." />;
  }

  return (
    <div className="space-y-2">
      {project.items.map(item => (
        <div
          key={item.id}
          className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
        >
          {/* Issue ID */}
          <span className="text-sm text-gray-500 font-mono">
            #{item.issueId}
          </span>

          {/* Type Badge */}
          <span
            className={`
              text-xs px-2 py-1 rounded font-medium
              ${item.issue.type === 'task' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}
            `}
          >
            {item.issue.type}
          </span>

          {/* Title */}
          <a
            href={`/${item.issue.type}s/${item.issueId}`}
            className="flex-1 text-gray-900 hover:text-github-green-600 font-medium"
          >
            {item.issue.title}
          </a>

          {/* Column (if applicable) */}
          {item.viewMeta?.column && (
            <span className="text-sm text-gray-600">
              {item.viewMeta.column}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
```

**Acceptance**:
- [ ] All project items displayed in list
- [ ] Each item shows ID, type, title, column
- [ ] Items are clickable links to detail pages
- [ ] Empty state shows when no items
- [ ] Styling matches tasks/memos list pages
- [ ] TypeScript compilation succeeds

---

**CHECKPOINT 3**: User Story 3 Complete - List view functional

Test:
- [ ] Navigate to `/projects/:id/list`
- [ ] See all items in list format
- [ ] Items show ID, type, title
- [ ] Click item - navigate to detail page
- [ ] Empty project shows empty state

---

## Phase 5: User Story 4 - View Tab Switching (P2)

### T012 - Verify URL Updates on View Switch
**Story**: US4
**Files**: `packages/web/src/pages/ProjectDetail.tsx`
**Dependencies**: T003, T011
**Parallelizable**: No

Verify that tab navigation correctly updates URL and reflects active tab.

**Test Implementation** (manual verification):
1. Navigate to `/projects/:id/kanban`
2. Click "Lists" tab
3. Verify URL changes to `/projects/:id/list`
4. Verify Lists tab has active styling
5. Click "Kanban" tab
6. Verify URL changes to `/projects/:id/kanban`
7. Verify Kanban tab has active styling

**Acceptance**:
- [ ] Clicking tab updates URL
- [ ] Active tab has visual indicator
- [ ] URL drives view rendering (not local state)
- [ ] Bookmarking URL returns to correct view
- [ ] Browser back/forward buttons work correctly

---

**CHECKPOINT 4**: User Story 4 Complete - View switching fully functional

Test:
- [ ] `/projects/:id` redirects to `/projects/:id/kanban`
- [ ] Click Lists tab - URL updates to `/projects/:id/list`
- [ ] Click Kanban tab - URL updates to `/projects/:id/kanban`
- [ ] Bookmark `/projects/:id/list` - returns to List view
- [ ] Browser back button works correctly

---

## Phase 6: Polish & Validation

### T013 - Add Keyboard Accessibility for Drag-and-Drop
**Story**: Polish
**Files**: `packages/web/src/components/KanbanBoard.tsx`
**Dependencies**: T009
**Parallelizable**: Yes (with T014, T015)

Add keyboard navigation support for drag-and-drop (accessibility requirement).

**Implementation**:
```typescript
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, {
    coordinateGetter: () => {
      // Custom keyboard coordinate getter if needed
    }
  })
);

<DndContext sensors={sensors} ...>
```

**Acceptance**:
- [ ] Tab key navigates between cards
- [ ] Space key activates drag mode
- [ ] Arrow keys move card between columns
- [ ] Enter key confirms drop
- [ ] Escape key cancels drag

---

### T014 - Add Loading State During Drag Operation [P]
**Story**: Polish
**Files**: `packages/web/src/components/KanbanBoard.tsx`
**Dependencies**: T009
**Parallelizable**: Yes (with T013, T015)

Show loading indicator during API call for drag-and-drop.

**Implementation**:
```typescript
const [isDragging, setIsDragging] = useState(false);

async function handleDragEnd(event: DragEndEvent) {
  // ... existing logic

  setIsDragging(true);
  try {
    await ProjectsService.updateProjectItem(...);
  } catch (err) {
    // ... error handling
  } finally {
    setIsDragging(false);
  }
}

// Add loading indicator:
{isDragging && (
  <div className="fixed top-4 right-4 bg-white px-4 py-2 rounded-lg shadow-lg border border-gray-200">
    <span className="text-sm text-gray-600">Saving...</span>
  </div>
)}
```

**Acceptance**:
- [ ] Loading indicator shows during API call
- [ ] Loading indicator disappears after response
- [ ] User can still interact with page during load

---

### T015 - Add Error Boundary for Project Detail Page [P]
**Story**: Polish
**Files**: `packages/web/src/pages/ProjectDetail.tsx`
**Dependencies**: T003
**Parallelizable**: Yes (with T013, T014)

Wrap ProjectDetail page in error boundary to catch React errors.

**Implementation**:
```typescript
import { Component, ReactNode } from 'react';
import ErrorState from '../components/ErrorState';

class ProjectDetailErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ProjectDetail error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorState error={this.state.error?.message || 'Something went wrong'} />;
    }
    return this.props.children;
  }
}

// Wrap ProjectDetail in App.tsx:
<Route path="projects/:id" element={
  <ProjectDetailErrorBoundary>
    <ProjectDetail />
  </ProjectDetailErrorBoundary>
}>
```

**Acceptance**:
- [ ] React errors are caught and displayed
- [ ] Error state shows user-friendly message
- [ ] Console logs detailed error information

---

### T016 - Verify TypeScript Compilation
**Story**: Polish
**Files**: All TypeScript files
**Dependencies**: T001-T015
**Parallelizable**: No

Ensure all code passes TypeScript type checking.

```bash
pnpm --filter meme-gtd-web tsc --noEmit
```

**Acceptance**:
- [ ] No TypeScript errors
- [ ] No TypeScript warnings
- [ ] All imports resolve correctly

---

### T017 - Build Production Bundle
**Story**: Polish
**Files**: `packages/web/`
**Dependencies**: T016
**Parallelizable**: No

Verify production build succeeds without errors.

```bash
pnpm --filter meme-gtd-web build
```

**Acceptance**:
- [ ] Build completes successfully
- [ ] No build errors or warnings
- [ ] Bundle size is reasonable (<1MB for this feature)

---

### T018 - Manual Testing Checklist
**Story**: Validation
**Files**: N/A (testing only)
**Dependencies**: T017
**Parallelizable**: No

Perform comprehensive manual testing of all functionality.

**Test Cases**:

**Kanban View**:
- [ ] Navigate to `/projects/:id/kanban` - page loads
- [ ] See columns for each status + Documents
- [ ] See item counts in column headers
- [ ] Cards display ID, type, title
- [ ] Empty columns show placeholder

**Drag-and-Drop**:
- [ ] Drag card from Open to Done - moves immediately
- [ ] Reload page - card stays in Done
- [ ] Column counts update after drag
- [ ] Drag shows visual feedback (overlay, drop zone highlight)

**List View**:
- [ ] Navigate to `/projects/:id/list` - page loads
- [ ] See all items in list format
- [ ] Items show ID, type, title, column
- [ ] Click item - navigate to detail page

**View Switching**:
- [ ] Click Lists tab - URL updates to `/list`
- [ ] Click Kanban tab - URL updates to `/kanban`
- [ ] Browser back/forward buttons work
- [ ] Bookmark list URL - returns to List view

**Edge Cases**:
- [ ] Empty project shows empty state in both views
- [ ] Non-existent project ID shows error
- [ ] Items without column appear in "Unassigned"
- [ ] Project with only memos displays correctly

**Accessibility**:
- [ ] Tab navigation works
- [ ] Focus indicators visible
- [ ] Color contrast meets standards

---

### T019 - Update Feature Documentation
**Story**: Documentation
**Files**: `specs/019-projects-implement-projects/spec.md`
**Dependencies**: T018
**Parallelizable**: No

Update spec.md status and add implementation notes.

**Updates**:
1. Change status from "Draft" to "Complete"
2. Add "Implemented" section with:
   - Implementation date
   - Files changed
   - Known limitations (if any)
   - Future enhancements (if any)

**Acceptance**:
- [ ] spec.md status updated to "Complete"
- [ ] Implementation notes added
- [ ] All user stories marked as implemented

---

## Parallel Execution Strategy

### Group 1 - Setup (Can run in parallel)
- T001: Install dependencies
- T002: Sync types

### Group 2 - Component Foundations (Can run in parallel after T001, T002)
- T006: Create KanbanCard
- T007: Create KanbanColumn (depends on T006)

### Group 3 - Polish Tasks (Can run in parallel after T009)
- T013: Keyboard accessibility
- T014: Loading indicator
- T015: Error boundary

## Dependency Graph

```
T001 (Install deps) ─────┐
                         ├──→ T006 (KanbanCard) ──→ T007 (KanbanColumn) ──→ T008 (KanbanBoard)
T002 (Sync types) ───────┘                                                         │
         │                                                                          │
         └──→ T003 (ProjectDetail) ──→ T004 (Routes) ──────────────────────────────┤
                                            │                                       │
                                            ├──→ T005 (KanbanView) ─────────────────┤
                                            │                                       │
                                            └──→ T011 (ListView) ─────→ T012 (URL verify)
                                                                              │
                                                                              ↓
                                        T008 → T009 (Drag logic) → T010 (Drag overlay)
                                                    │
                                                    ├──→ T013 (Keyboard) ─┐
                                                    ├──→ T014 (Loading) ──┼─→ T016 (TypeCheck)
                                                    └──→ T015 (Error) ────┘      │
                                                                                 ↓
                                                                          T017 (Build)
                                                                                 │
                                                                                 ↓
                                                                          T018 (Test)
                                                                                 │
                                                                                 ↓
                                                                          T019 (Docs)
```

## MVP Definition

**Minimum Viable Product** includes:
- Phase 0: Setup (T001, T002)
- Phase 1: Foundation (T003, T004)
- Phase 2: Kanban View (T005-T008)
- Phase 3: Drag-and-Drop (T009-T010)

**MVP = US1 + US2** (Kanban board with drag-and-drop)

This provides core project visualization value. US3 (List view) and US4 (View switching) can be added incrementally.

## Estimated Time Breakdown

- Phase 0 (Setup): 30 minutes
- Phase 1 (Foundation): 1 hour
- Phase 2 (Kanban View): 2.5 hours
- Phase 3 (Drag-and-Drop): 1.5 hours
- Phase 4 (List View): 1 hour
- Phase 5 (View Switching): 15 minutes
- Phase 6 (Polish): 1.5 hours

**Total**: ~8 hours for full implementation
**MVP**: ~5.5 hours (Phases 0-3 only)
