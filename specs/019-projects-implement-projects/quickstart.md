# Quickstart Guide: Project Detail Views Implementation

**Feature**: 019-projects-implement-projects
**Branch**: `019-projects-implement-projects`
**Created**: 2025-10-27

## Prerequisites

Before starting implementation:

1. **Read Core Documents** (in order):
   - [spec.md](./spec.md) - Feature requirements and user stories
   - [research.md](./research.md) - Technical context and decisions
   - [data-model.md](./data-model.md) - Data structures and relationships
   - [contracts/api-endpoints.md](./contracts/api-endpoints.md) - API contract

2. **Verify Environment**:
   ```bash
   # Ensure you're on the feature branch
   git checkout 019-projects-implement-projects

   # Install dependencies
   pnpm install

   # Verify backend is running
   pnpm server:dev  # Starts on port 3001
   ```

3. **Confirm Backend APIs**:
   ```bash
   # Test project detail endpoint
   curl http://localhost:3001/api/projects/1

   # Should return project with items array
   ```

## Implementation Overview

This feature adds two views for project detail pages:

1. **Kanban View** (`/projects/:id/kanban`) - Drag-and-drop board with columns
2. **List View** (`/projects/:id/list`) - Table/list format similar to `/tasks`

**Key Technologies**:
- React Router v7 (nested routes)
- @dnd-kit/core (drag-and-drop)
- Existing components (LoadingState, ErrorState, EmptyState)

## Step-by-Step Implementation

### Phase 1: Setup & Dependencies (30 min)

#### 1.1 Install Drag-and-Drop Library

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities --filter meme-gtd-web
```

#### 1.2 Sync Type Definitions

Update `/packages/web/src/types/project.ts` to match shared types:

```typescript
// Remove outdated types and re-export from shared
export type {
  Project,
  ProjectItem,
  ProjectItemWithIssue,
  ProjectDetail,
  ViewMeta,
  ViewType
} from 'meme-gtd-shared';
```

**Why**: Web types are outdated from Feature 017, shared types are current.

#### 1.3 Update ProjectsService

Verify `/packages/web/src/api/services/ProjectsService.ts` has all required methods:
- ✅ `getProject(id)` - Already exists
- ✅ `updateProjectItem(projectId, issueId, data)` - Already exists
- ✅ `addProjectItem(projectId, data)` - Already exists
- ✅ `removeProjectItem(projectId, issueId)` - Already exists

**No changes needed** - all service methods already implemented.

---

### Phase 2: Routing & Main Page (1 hour)

#### 2.1 Create ProjectDetail Page

**File**: `/packages/web/src/pages/ProjectDetail.tsx`

**Purpose**: Main container for both views, handles routing and data fetching.

**Key Features**:
- Fetch project data with `GET /api/projects/:id`
- View switcher tabs (Kanban/List)
- Pass data to child views via React Router `<Outlet />`

**Implementation**:
```typescript
import { useState, useEffect } from 'react';
import { useParams, Outlet, Link, useLocation } from 'react-router-dom';
import { ProjectsService } from '../api/services/ProjectsService';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export default function ProjectDetail() {
  const { id } = useParams();
  const location = useLocation();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProject() {
      try {
        setLoading(true);
        setError(null);
        const data = await ProjectsService.getProject(id);
        setProject(data);
      } catch (err) {
        setError(err.message);
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
      {/* Header with project name */}
      <h1 className="text-3xl font-bold mb-4">{project.name}</h1>

      {/* View tabs */}
      <div className="flex gap-4 mb-4 border-b border-gray-200">
        <Link
          to={`/projects/${id}/kanban`}
          className={`px-4 py-2 ${isKanban ? 'border-b-2 border-github-green-500 text-gray-900' : 'text-gray-500'}`}
        >
          Kanban
        </Link>
        <Link
          to={`/projects/${id}/list`}
          className={`px-4 py-2 ${isList ? 'border-b-2 border-github-green-500 text-gray-900' : 'text-gray-500'}`}
        >
          List
        </Link>
      </div>

      {/* Child view (Kanban or List) */}
      <Outlet context={{ project }} />
    </div>
  );
}
```

#### 2.2 Add Routes to App.tsx

**File**: `/packages/web/src/App.tsx`

Add routes for project detail with nested views:

```typescript
import ProjectDetail from './pages/ProjectDetail';

// In Routes:
<Route path="projects/:id" element={<ProjectDetail />}>
  <Route index element={<Navigate to="kanban" replace />} />
  <Route path="kanban" element={<KanbanView />} />
  <Route path="list" element={<ListView />} />
</Route>
```

**Result**:
- `/projects/:id` → Redirects to `/projects/:id/kanban`
- `/projects/:id/kanban` → Shows Kanban view
- `/projects/:id/list` → Shows List view

---

### Phase 3: Kanban View (3 hours)

#### 3.1 Create KanbanView Page

**File**: `/packages/web/src/pages/KanbanView.tsx`

**Purpose**: Page component that renders KanbanBoard.

```typescript
import { useOutletContext } from 'react-router-dom';
import KanbanBoard from '../components/KanbanBoard';

export default function KanbanView() {
  const { project } = useOutletContext();
  return <KanbanBoard project={project} />;
}
```

#### 3.2 Create KanbanBoard Component

**File**: `/packages/web/src/components/KanbanBoard.tsx`

**Purpose**: Main Kanban board with drag-and-drop.

**Key Features**:
- Display columns from `project.viewMeta.columns`
- Group items by `item.viewMeta.column`
- Handle drag-and-drop with @dnd-kit
- Optimistic updates for item moves
- Error handling and revert on failure

**Implementation Outline**:
```typescript
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import KanbanColumn from './KanbanColumn';
import { ProjectsService } from '../api/services/ProjectsService';

export default function KanbanBoard({ project }) {
  const [items, setItems] = useState(project.items);
  const columns = project.viewMeta.columns || [];

  // Group items by column
  const itemsByColumn = columns.reduce((acc, column) => {
    acc[column] = items.filter(item => item.viewMeta?.column === column);
    return acc;
  }, {});

  // Handle drag end
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const itemId = active.id;
    const newColumn = over.id; // Column ID

    // Optimistic update
    setItems(prev => /* move item to new column */);

    try {
      await ProjectsService.updateProjectItem(project.id, itemId, {
        column: newColumn
      });
    } catch (err) {
      // Revert on error
      setItems(project.items);
      alert('Failed to move item');
    }
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto">
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

#### 3.3 Create KanbanColumn Component

**File**: `/packages/web/src/components/KanbanColumn.tsx`

**Purpose**: Single column with header and cards.

```typescript
import { useDroppable } from '@dnd-kit/core';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ column, items }) {
  const { setNodeRef } = useDroppable({ id: column });

  return (
    <div ref={setNodeRef} className="w-80 bg-gray-50 rounded-lg p-4">
      <h3 className="font-semibold mb-2">
        {column} {items.length}
      </h3>
      <div className="space-y-2">
        {items.map(item => (
          <KanbanCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
```

#### 3.4 Create KanbanCard Component

**File**: `/packages/web/src/components/KanbanCard.tsx`

**Purpose**: Draggable card for task/memo.

```typescript
import { useDraggable } from '@dnd-kit/core';

export default function KanbanCard({ item }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: item.issueId
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="bg-white p-3 rounded border border-gray-200 cursor-move hover:shadow"
    >
      <span className="text-xs text-gray-500">#{item.issueId}</span>
      <p className="text-sm font-medium">{item.issue.title}</p>
      <span className="text-xs text-gray-400">{item.issue.type}</span>
    </div>
  );
}
```

---

### Phase 4: List View (1 hour)

#### 4.1 Create ListView Page

**File**: `/packages/web/src/pages/ListView.tsx`

**Purpose**: Table/list view of project items.

**Key Features**:
- Reuse ItemList component (already supports projects)
- Display all project items in list format
- Same styling as `/tasks` and `/memos` pages

```typescript
import { useOutletContext } from 'react-router-dom';
import ItemList from '../components/ItemList';
import EmptyState from '../components/EmptyState';

export default function ListView() {
  const { project } = useOutletContext();

  if (project.items.length === 0) {
    return <EmptyState message="No items in project" />;
  }

  // Convert items to format expected by ItemList
  const listItems = project.items.map(item => ({
    id: item.issueId,
    title: item.issue.title,
    type: item.issue.type,
    // ... other fields needed by ItemList
  }));

  return <ItemList items={listItems} itemType="project" basePath="/projects" />;
}
```

**Note**: May need to adapt ItemList component to handle project item format.

---

### Phase 5: Testing & Polish (2 hours)

#### 5.1 Manual Testing Checklist

**Kanban View**:
- [ ] Navigate to `/projects/1/kanban`
- [ ] See columns with cards
- [ ] Drag card from one column to another
- [ ] Card moves immediately (optimistic update)
- [ ] Refresh page - card stays in new column
- [ ] Test with empty project
- [ ] Test with project containing only memos

**List View**:
- [ ] Navigate to `/projects/1/list`
- [ ] See all project items in list
- [ ] Click item - navigate to task/memo detail
- [ ] Switch between Kanban and List tabs
- [ ] URL updates correctly

**Edge Cases**:
- [ ] Non-existent project ID shows error
- [ ] Empty project shows empty state
- [ ] Network error shows error message
- [ ] Drag-and-drop failure reverts UI

#### 5.2 Build & Type Check

```bash
# Type check
pnpm --filter meme-gtd-web tsc --noEmit

# Build
pnpm --filter meme-gtd-web build

# Should complete without errors
```

#### 5.3 Accessibility Check

- [ ] Keyboard navigation works (Tab through items)
- [ ] Screen reader announces drag start/end
- [ ] Focus visible on all interactive elements
- [ ] Color contrast meets WCAG AA standards

---

## Common Issues & Solutions

### Issue: "Cannot read property 'columns' of undefined"

**Cause**: `project.viewMeta` is null or undefined

**Solution**: Add fallback in component:
```typescript
const columns = project.viewMeta?.columns || [];
```

### Issue: Drag-and-drop not working

**Cause**: Missing @dnd-kit dependencies

**Solution**: Verify installation:
```bash
pnpm list @dnd-kit/core --filter meme-gtd-web
```

### Issue: Items not showing in correct column

**Cause**: `item.viewMeta.column` doesn't match `project.viewMeta.columns`

**Solution**: Add "Unassigned" column for items without valid column:
```typescript
const unassigned = items.filter(item =>
  !item.viewMeta?.column || !columns.includes(item.viewMeta.column)
);
```

### Issue: Type errors with ProjectDetail

**Cause**: Web types not synced with shared types

**Solution**: Update `/packages/web/src/types/project.ts`:
```typescript
export type { ProjectDetail } from 'meme-gtd-shared';
```

---

## Next Steps After Implementation

1. **Create Pull Request**:
   ```bash
   git add .
   git commit -m "feat: implement project detail views with Kanban and Lists"
   git push origin 019-projects-implement-projects
   ```

2. **Update Documentation** (if needed):
   - Add screenshots to PR description
   - Document any deviations from spec

3. **Deploy to Test Environment**:
   ```bash
   pnpm build
   pnpm server:start  # Production mode
   ```

4. **User Acceptance Testing**:
   - Share with stakeholders
   - Gather feedback
   - Iterate based on feedback

---

## Development Tips

### Hot Reload

```bash
# Terminal 1: Backend
pnpm server:dev

# Terminal 2: Frontend
pnpm --filter meme-gtd-web dev
```

**URLs**:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api
- API Docs: http://localhost:3001/api-docs

### Debugging

```typescript
// Add to component for state inspection
useEffect(() => {
  console.log('Project:', project);
  console.log('Items by column:', itemsByColumn);
}, [project, itemsByColumn]);
```

### Performance

Monitor drag-and-drop performance:
```typescript
const handleDragEnd = async (event) => {
  const start = performance.now();
  // ... drag logic
  console.log('Drag took:', performance.now() - start, 'ms');
};
```

---

## Resources

- **@dnd-kit Docs**: https://docs.dndkit.com/
- **React Router v7**: https://reactrouter.com/
- **Tailwind CSS**: https://tailwindcss.com/
- **Backend API**: http://localhost:3001/api-docs
- **Existing Components**: `/packages/web/src/components/`

---

## Questions?

Refer back to:
- [spec.md](./spec.md) - Requirements and user stories
- [research.md](./research.md) - Technical decisions and context
- [data-model.md](./data-model.md) - Data structures
- [contracts/api-endpoints.md](./contracts/api-endpoints.md) - API contract

Or check existing similar implementations:
- `/packages/web/src/pages/TaskDetail.tsx`
- `/packages/web/src/pages/MemoDetail.tsx`
- `/packages/web/src/components/ItemList.tsx`
