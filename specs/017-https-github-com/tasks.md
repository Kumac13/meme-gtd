# Implementation Tasks: Projects Sidebar

**Feature**: 017-https-github-com | **Branch**: `017-https-github-com`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Task Overview

**Total Tasks**: 20
**Estimated Duration**: 12-16 hours

## Phase 1: Setup & Infrastructure (30 min)

### Prerequisites

- [x] **T001** [P] Create TypeScript type definitions in `packages/web/src/types/project.ts`
  - Interface: `Project`, `ProjectWithMeta`, `ProjectItem`, `ProjectStatus`
  - Interface: `RecentProjectsStorage` (for localStorage)
  - Export all types

- [x] **T002** [P] Verify test environment setup
  - Confirm test DB has sample projects
  - Verify `pnpm server:dev` serves on port 3001
  - Check `/api/projects` endpoint returns data

### Foundational Layer

- [x] **T003** [P] Create ProjectsService API client in `packages/web/src/api/services/ProjectsService.ts`
  - Method: `listProjects(): Promise<Project[]>` → GET /api/projects
  - Method: `getProject(id): Promise<ProjectDetail>` → GET /api/projects/:id
  - Method: `addProjectItem(projectId, data): Promise<ProjectItem>` → POST /api/projects/:id/items
  - Method: `removeProjectItem(projectId, issueId): Promise<void>` → DELETE /api/projects/:id/items/:issueId
  - Method: `getProjectsForIssue(issueId): Promise<ProjectWithMeta[]>` → fetch all + filter

**Checkpoint**: Phase 1 complete - Types and API service ready ✅

---

## Phase 2: Layout Restructuring (2-3 hours)

**Goal**: Convert ItemDetail from single-column to 2-column layout (main + sidebar)

### Main Layout Changes

- [ ] **T004** [P] [LAYOUT] Create 2-column layout wrapper in ItemDetail.tsx
  - Convert single-column layout to grid/flex 2-column
  - Left column: main content (current full-width content)
  - Right column: sidebar (new, 300-350px width)
  - Responsive: stack on mobile (<768px)
  - Reference GitHub issue page layout

- [ ] **T005** [P] [LAYOUT] Move existing content to main column
  - Header (title, bookmark, status)
  - Labels
  - Links section
  - Body content (EditableContent)
  - Comments section
  - Everything currently in ItemDetail goes to LEFT column

**Checkpoint**: Phase 2 complete - 2-column layout working ✅

---

## Phase 3: User Story 1 - View Projects in Sidebar (2-3 hours)

**Goal**: Display associated projects in right sidebar

### Sidebar Component

- [ ] **T006** [P] [US1] Create ProjectsSidebar component in `packages/web/src/components/ProjectsSidebar.tsx`
  - Props: `{ itemId: number, itemType: 'memo' | 'task' }`
  - State: `associatedProjects`, `loading`, `error`
  - useEffect: Fetch `ProjectsService.getProjectsForIssue(itemId)`
  - Header: "Projects" + gear icon (⚙️)
  - List: Display projects (icon placeholder, name, status)
  - Styling: Match GitHub sidebar style (border, padding, gray background)
  - **ALWAYS visible** (even with 0 projects)

- [ ] **T007** [US1] Integrate ProjectsSidebar into ItemDetail RIGHT column
  - Import ProjectsSidebar
  - Add to right sidebar column (not main content)
  - Pass `itemId={item.id}` and `itemType={itemType}`

**Checkpoint**: User Story 1 complete - Projects sidebar displays ✅

**Validation**:
- Navigate to `/tasks/1` or `/memos/1`
- Right sidebar shows "Projects" section
- Section visible even with 0 projects
- Associated projects display with name and status

---

## Phase 4: User Story 2 & 3 - Add/Remove Projects (4-5 hours)

**Goal**: Implement dropdown/popover for managing project associations

### Dropdown Component

- [ ] **T008** [P] [US2/US3] Create ProjectsDropdown component in `packages/web/src/components/ProjectsDropdown.tsx`
  - Props: `{ isOpen: boolean, onClose: () => void, itemId: number, onProjectsChanged: () => void, anchorEl: HTMLElement | null }`
  - NOT a centered modal - position relative to gear icon (absolute positioning)
  - Backdrop: semi-transparent, click to close
  - Dropdown box: positioned below/beside gear icon
  - Search input: "Filter projects" at top
  - Recent section: "Recent" header (if items exist)
  - Organization section: "Organization" header
  - Each project: checkbox + icon + name
  - Checkbox onChange: immediately call API (add/remove)
  - Stay open after checkbox toggle
  - Max height: scroll if >10 projects
  - Width: ~300px
  - Click outside to close

- [ ] **T009** [US2/US3] Integrate dropdown into ProjectsSidebar
  - Add state: `dropdownOpen: boolean`, `anchorEl: HTMLElement | null`
  - Gear icon onClick: `setDropdownOpen(true)`, capture anchorEl
  - Render `<ProjectsDropdown>` component
  - Handle `onProjectsChanged`: refetch projects
  - Handle `onClose`: `setDropdownOpen(false)`

**Checkpoint**: User Stories 2 & 3 complete - Add/remove works via dropdown ✅

**Validation**:
- Click gear icon → dropdown appears below/beside icon (NOT centered modal)
- Click backdrop → dropdown closes
- Check project → immediately added, dropdown stays open
- Uncheck project → immediately removed, dropdown stays open
- Sidebar updates after each operation

---

## Phase 5: User Story 4 - Search/Filter (1-2 hours)

**Goal**: Add search/filter functionality to dropdown

### Search Implementation

- [ ] **T010** [US4] Add search state to ProjectsDropdown
  - State: `searchQuery: string`
  - Filter projects: `project.name.toLowerCase().includes(query.toLowerCase())`
  - Apply to both Recent and Organization sections
  - Show "No projects match" when filter returns 0 results
  - useMemo for filtered list

**Checkpoint**: User Story 4 complete - Search works ✅

**Validation**:
- Type in search box → projects filter in real-time
- Clear search → all projects reappear
- Check filtered project → works correctly

---

## Phase 6: User Story 5 - Recent Projects (2-3 hours)

**Goal**: Track and display recently used projects

### Recent Projects Hook

- [ ] **T011** [US5] Create useRecentProjects hook in `packages/web/src/hooks/useRecentProjects.ts`
  - Storage key: `'mgtd:recentProjects'`
  - Format: `RecentProjectsStorage` type
  - Function: `addRecentProject(projectId)` → save to localStorage
  - Function: `getRecentProjects(allProjects)` → return top 2 by timestamp
  - Handle localStorage errors gracefully

- [ ] **T012** [US5] Integrate useRecentProjects into ProjectsDropdown
  - Call `addRecentProject(projectId)` when project is ADDED (not removed)
  - Display Recent section (top 2 projects)
  - Display Organization section (all projects)
  - Both sections respect search filter

**Checkpoint**: User Story 5 complete - Recent projects feature works ✅

**Validation**:
- Add project → appears in Recent on next dropdown open
- Recent shows max 2 projects
- Recent respects search filter

---

## Phase 7: Polish & Validation (2-3 hours)

**Purpose**: Final improvements and testing

- [ ] **T013** [P] Error handling polish
  - ProjectsSidebar: show error state on fetch failure
  - ProjectsDropdown: show error toast on add/remove failure
  - Handle network errors gracefully

- [ ] **T014** [P] Loading states polish
  - ProjectsSidebar: skeleton/spinner while loading
  - ProjectsDropdown: disable checkboxes during API call
  - Prevent double-clicks

- [ ] **T015** [P] Accessibility audit
  - Dropdown: correct ARIA attributes (role="dialog", aria-modal)
  - Keyboard: ESC closes dropdown
  - Focus trap in dropdown
  - Screen reader compatibility

- [ ] **T016** [P] Responsive design
  - Mobile: sidebar stacks below main content
  - Dropdown: adjust position on small screens
  - Touch-friendly checkbox sizes

- [ ] **T017** Build verification
  - Run `pnpm build` - must succeed
  - Fix any TypeScript errors
  - Remove unused imports

- [ ] **T018** Manual testing
  - Test all user scenarios from spec.md
  - Verify SC-001 through SC-007 success criteria
  - Test with 0 projects, 1 project, 10+ projects
  - Test Recent projects persistence

- [ ] **T019** Code cleanup
  - Remove console.log statements
  - Add JSDoc comments to public functions
  - Ensure consistent naming

- [ ] **T020** Documentation
  - Update CHANGELOG.md with new feature
  - Add screenshots to spec.md if needed

**Checkpoint**: Phase 7 complete - Feature ready for PR ✅

---

## Task Dependencies

### Sequential Dependencies
- T001, T002 → T003 (types before service)
- T003 → T004 (service before layout)
- T004, T005 → T006 (layout before sidebar)
- T006 → T007 (sidebar before integration)
- T007 → T008 (sidebar before dropdown)
- T008 → T009 (dropdown before integration)
- T009 → T010 (dropdown before search)
- T010 → T011 (search before recent)
- T011 → T012 (hook before integration)
- All → T013-T020 (polish at end)

### Parallel Opportunities
- T001 and T002 can run in parallel (setup tasks)
- T004 and T005 can run in parallel if careful
- T013, T014, T015, T016 can run in parallel (polish tasks)

---

## Notes

### Key Changes from Original Implementation
1. **Layout**: 2-column (main + sidebar), NOT single-column
2. **UI Pattern**: Dropdown/popover, NOT centered modal
3. **Visibility**: Sidebar ALWAYS visible, NOT hidden when 0 projects
4. **Positioning**: Dropdown positioned relative to gear icon, NOT screen center

### Critical Requirements
- Right sidebar placement (like GitHub issues)
- Dropdown opens at gear icon location
- No screen darkening/centering modal
- Projects section always visible for adding projects
