# Tasks: Project Management CLI Commands and API

**Input**: Design documents from `/specs/015-https-github-com/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/projects-api.yaml

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Following TDD approach where tests are written before implementation.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing infrastructure and prepare for implementation

- [ ] T001 [P] Verify database schema: Confirm that `projects` and `project_items` tables exist in `schema/001_init.sql`
- [ ] T002 [P] Verify packages structure: Check monorepo layout (cli, api, core, db, shared)
- [ ] T003 [P] Verify TypeScript build configuration: Ensure all packages build successfully

**Checkpoint**: Infrastructure verified - implementation can begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types and repository infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Create Project types in `packages/shared/src/types/project.ts`:
  - ViewType = 'board' | 'table'
  - ViewMeta interface (viewType + columns)
  - Project interface (id, name, description, viewMeta, createdAt)
  - ProjectItem interface (id, projectId, issueId, position, viewMeta, createdAt, updatedAt)
  - ProjectDetail interface (extends Project with items)
  - ProjectItemWithIssue interface (extends ProjectItem with issue details)
- [ ] T005 Modify `packages/shared/src/index.ts`: Export project types
- [ ] T006 [P] Create projectRepository in `packages/db/src/projectRepository.ts`:
  - projectRowToProject mapper
  - createProject(db, input) → Project
  - listProjects(db) → Project[]
  - getProjectById(db, id) → Project
  - deleteProject(db, id) → void
- [ ] T007 [P] Create projectItemRepository in `packages/db/src/projectItemRepository.ts`:
  - projectItemRowToProjectItem mapper
  - createProjectItem(db, input) → ProjectItem
  - listProjectItems(db, projectId) → ProjectItemWithIssue[]
  - getProjectItem(db, projectId, issueId) → ProjectItem
  - updateProjectItem(db, id, updates) → ProjectItem
  - deleteProjectItem(db, projectId, issueId) → void
  - calculateNextPosition(db, projectId) → number
- [ ] T008 Modify `packages/db/src/index.ts`: Export new repositories
- [ ] T009 Create ProjectService in `packages/core/src/projectService.ts`:
  - Constructor with config/db dependency injection
  - buildViewMeta(viewType) private helper
  - create(input) → Project
  - list() → Project[]
  - getById(id) → ProjectDetail
  - delete(id) → void
- [ ] T010 Modify `packages/core/src/index.ts`: Export ProjectService

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Create and List Projects (Priority: P1) 🎯 MVP

**Goal**: Users can create projects and view all existing projects

**Why this priority**: Foundation for all other project features

**Independent Test**: User can run `mgtd project create "My Project"` and then `mgtd project list` to see their project

**Acceptance Scenarios**:
1. Create project with name only → success
2. List multiple projects → display with IDs and names
3. Create with --json → return JSON format
4. Create with --description → include description

### Implementation for User Story 1

#### CLI Layer (2 commands)

- [ ] T011 [P] [US1] Create `packages/cli/src/commands/project/index.ts`:
  - Root command class with help display
  - List subcommand implementation: `mgtd project list`
  - Flags: --json
  - Service integration: ProjectService.list()
  - Human-readable output: table format with ID, name
  - JSON output: `{ projects: [...] }`
- [ ] T012 [P] [US1] Create `packages/cli/src/commands/project/create.ts`:
  - Command class: `mgtd project create <name>`
  - Args: name (required)
  - Flags: --description (-d), --view (-v board|table, default board), --json (-j)
  - Service integration: ProjectService.create()
  - Human-readable output: `Project created: #<id> - <name>`
  - JSON output: Project object
  - Error handling: duplicate name, validation errors

#### API Layer (2 endpoints)

- [ ] T013 [P] [US1] Create Zod schemas in `packages/api/src/schemas/projectSchemas.ts`:
  - ViewTypeSchema enum
  - CreateProjectRequestSchema (name, description?, view?)
  - ProjectSchema (id, name, description, viewMeta, createdAt)
  - ProjectIdParamsSchema (id: string matching /^\d+$/)
  - Export all schemas and types
- [ ] T014 [P] [US1] Create handlers in `packages/api/src/handlers/projectHandlers.ts`:
  - createProjectHandler: POST body → ProjectService.create() → 201 + Project
  - Error translation: UNIQUE constraint → ConflictError
  - listProjectsHandler: ProjectService.list() → 200 + Project[]
- [ ] T015 [US1] Create routes in `packages/api/src/routes/projects.ts`:
  - POST /api/projects (createProjectHandler, 201/400/409)
  - GET /api/projects (listProjectsHandler, 200)
  - Register with Fastify TypeProvider + Zod
- [ ] T016 Modify `packages/api/src/index.ts`: Register projectRoutes

#### Integration Tests

- [ ] T017 [P] [US1] Create CLI test in `packages/cli/test/commands/project/create.test.js`:
  - Test setup: mkdtempSync for isolated DB
  - Test: Create project with name only → verify JSON output
  - Test: Create with --description → verify description in output
  - Test: Create with --view board → verify viewMeta
  - Test: Create with --view table → verify viewMeta
  - Test: Duplicate name → verify error
  - Cleanup: rmSync temp directory
- [ ] T018 [P] [US1] Create CLI test in `packages/cli/test/commands/project/list.test.js`:
  - Test setup: Create multiple projects
  - Test: List projects → verify all appear
  - Test: List with --json → verify JSON structure
  - Test: Empty list → verify "No projects" message

**Checkpoint**: Users can now create and list projects via CLI and API ✅ MVP COMPLETE

---

## Phase 4: User Story 2 - Add Items to Projects (Priority: P2)

**Goal**: Users can add tasks and memos to projects

**Why this priority**: Populating projects enables core organizational value

**Independent Test**: User can run `mgtd project add 5 12` to add issue #12 to project #5

**Acceptance Scenarios**:
1. Add issue to project → success
2. View project → issue appears in list
3. Add with --position → item at specified position

### Implementation for User Story 2

#### Service Layer Enhancement

- [ ] T019 [US2] Add methods to ProjectService in `packages/core/src/projectService.ts`:
  - addItem(projectId, issueId, position?, column?) → ProjectItem
  - Validation: project exists, issue exists
  - Calculate position if not provided (MAX + 1.0)
  - Build view_meta JSON for column

#### CLI Layer (1 command)

- [ ] T020 [US2] Create `packages/cli/src/commands/project/add.ts`:
  - Command: `mgtd project add <project-id> <issue-id>`
  - Args: projectId (number), issueId (number)
  - Flags: --position (-p number), --column (-c string), --json (-j)
  - Service integration: ProjectService.addItem()
  - Human-readable output: `Issue #<id> added to project #<pid>`
  - JSON output: ProjectItem object
  - Error handling: duplicate item (409), not found (404)

#### API Layer (1 endpoint)

- [ ] T021 [P] [US2] Add schemas to `packages/api/src/schemas/projectSchemas.ts`:
  - AddProjectItemRequestSchema (issueId, position?, column?)
  - ProjectItemSchema (id, projectId, issueId, position, viewMeta, createdAt, updatedAt)
- [ ] T022 [US2] Add handler to `packages/api/src/handlers/projectHandlers.ts`:
  - addProjectItemHandler: POST body → ProjectService.addItem() → 201 + ProjectItem
  - Error translation: UNIQUE constraint → ConflictError, not found → NotFoundError
- [ ] T023 [US2] Add route to `packages/api/src/routes/projects.ts`:
  - POST /api/projects/:id/items (addProjectItemHandler, 201/400/404/409)

#### Integration Tests

- [ ] T024 [P] [US2] Create CLI test in `packages/cli/test/commands/project/add.test.js`:
  - Test setup: Create project and tasks
  - Test: Add issue to project → verify success
  - Test: Add with --position → verify position
  - Test: Add with --column → verify view_meta
  - Test: Duplicate add → verify error
  - Test: Non-existent issue → verify error

**Checkpoint**: Users can now add items to projects

---

## Phase 5: User Story 3 - View Project Details (Priority: P2)

**Goal**: Users can see all items in a project with issue details

**Why this priority**: Completes basic CRUD cycle with US2

**Independent Test**: User can run `mgtd project view 5` to see all issues in project #5

**Acceptance Scenarios**:
1. View project with 3 issues → all displayed with details
2. View with --json → project + items array
3. View empty project → "No items" message

### Implementation for User Story 3

#### CLI Layer (1 command)

- [ ] T025 [US3] Create `packages/cli/src/commands/project/view.ts`:
  - Command: `mgtd project view <project-id>`
  - Args: projectId (number)
  - Flags: --json (-j)
  - Service integration: ProjectService.getById()
  - Human-readable output: Project header + table of items (position, type, title, column)
  - JSON output: ProjectDetail object
  - Error handling: not found (404)

#### API Layer (1 endpoint)

- [ ] T026 [P] [US3] Add schemas to `packages/api/src/schemas/projectSchemas.ts`:
  - ProjectItemWithIssueSchema (extends ProjectItem with issue: {id, type, title})
  - ProjectDetailSchema (extends Project with items: ProjectItemWithIssue[])
- [ ] T027 [US3] Add handler to `packages/api/src/handlers/projectHandlers.ts`:
  - getProjectHandler: ProjectService.getById() → 200 + ProjectDetail
  - Error translation: not found → NotFoundError
- [ ] T028 [US3] Add route to `packages/api/src/routes/projects.ts`:
  - GET /api/projects/:id (getProjectHandler, 200/404)

#### Integration Tests

- [ ] T029 [P] [US3] Create CLI test in `packages/cli/test/commands/project/view.test.js`:
  - Test setup: Create project with items
  - Test: View project → verify items displayed
  - Test: View with --json → verify ProjectDetail structure
  - Test: View empty project → verify empty message
  - Test: Non-existent project → verify error

**Checkpoint**: Users can now view project contents

---

## Phase 6: User Story 4 - Remove Items and Delete Projects (Priority: P3)

**Goal**: Users can remove items from projects and delete entire projects

**Why this priority**: Cleanup operations, not critical for initial functionality

**Independent Test**: User can run `mgtd project remove 5 12 --yes` to remove issue or `mgtd project delete 5 --yes` to delete project

**Acceptance Scenarios**:
1. Remove item → item removed, issue remains
2. Delete project → project and items deleted, issues remain
3. Confirmation prompt shown without --yes flag

### Implementation for User Story 4

#### Service Layer Enhancement

- [ ] T030 [US4] Add methods to ProjectService in `packages/core/src/projectService.ts`:
  - removeItem(projectId, issueId) → void
  - Validation: project exists, item exists

#### CLI Layer (2 commands)

- [ ] T031 [P] [US4] Create `packages/cli/src/commands/project/remove.ts`:
  - Command: `mgtd project remove <project-id> <issue-id>`
  - Args: projectId (number), issueId (number)
  - Flags: --yes (-y), --json (-j)
  - Confirmation prompt logic (same as link/remove.ts):
    - --yes: immediate deletion
    - --json without --yes: error requiring --yes
    - TTY available: interactive prompt
    - No TTY: error requiring --yes
  - Service integration: ProjectService.removeItem()
  - Human-readable output: `Issue #<id> removed from project #<pid>`
  - JSON output: `{ deleted: true, projectId, issueId }`
- [ ] T032 [P] [US4] Create `packages/cli/src/commands/project/delete.ts`:
  - Command: `mgtd project delete <project-id>`
  - Args: projectId (number)
  - Flags: --yes (-y), --json (-j)
  - Confirmation prompt logic (same as remove)
  - Service integration: ProjectService.delete()
  - Human-readable output: `Project #<id> deleted`
  - JSON output: `{ deleted: true, projectId }`

#### API Layer (2 endpoints)

- [ ] T033 [P] [US4] Add handlers to `packages/api/src/handlers/projectHandlers.ts`:
  - removeProjectItemHandler: ProjectService.removeItem() → 204
  - deleteProjectHandler: ProjectService.delete() → 204
  - Error translation: not found → NotFoundError
- [ ] T034 [US4] Add routes to `packages/api/src/routes/projects.ts`:
  - DELETE /api/projects/:id/items/:issueId (removeProjectItemHandler, 204/404)
  - DELETE /api/projects/:id (deleteProjectHandler, 204/404)

#### Integration Tests

- [ ] T035 [P] [US4] Create CLI test in `packages/cli/test/commands/project/remove.test.js`:
  - Test: Remove with --yes → verify item removed
  - Test: Remove without TTY → verify error message
  - Test: Remove with --json without --yes → verify error
  - Test: Verify issue still exists after removal
- [ ] T036 [P] [US4] Create CLI test in `packages/cli/test/commands/project/delete.test.js`:
  - Test: Delete with --yes → verify project deleted
  - Test: Delete without TTY → verify error message
  - Test: Verify items deleted (CASCADE) but issues remain

**Checkpoint**: Users can now remove items and delete projects

---

## Phase 7: User Story 5 - Reorder Items in Projects (Priority: P3)

**Goal**: Users can move items to new positions or columns

**Why this priority**: Enhancement for better organization

**Independent Test**: User can run `mgtd project move 5 12 --position 2.0` to change position

**Acceptance Scenarios**:
1. Move to new position → position updated
2. Move to new column → column metadata updated

### Implementation for User Story 5

#### Service Layer Enhancement

- [ ] T037 [US5] Add method to ProjectService in `packages/core/src/projectService.ts`:
  - moveItem(projectId, issueId, position?, column?) → ProjectItem
  - Validation: project exists, item exists
  - Build updated view_meta if column provided

#### CLI Layer (1 command)

- [ ] T038 [US5] Create `packages/cli/src/commands/project/move.ts`:
  - Command: `mgtd project move <project-id> <issue-id>`
  - Args: projectId (number), issueId (number)
  - Flags: --position (-p number), --column (-c string), --json (-j)
  - At least one of --position or --column required
  - Service integration: ProjectService.moveItem()
  - Human-readable output: `Issue #<id> moved in project #<pid>`
  - JSON output: ProjectItem object

#### API Layer (1 endpoint)

- [ ] T039 [P] [US5] Add schema to `packages/api/src/schemas/projectSchemas.ts`:
  - UpdateProjectItemRequestSchema (position?, column?)
- [ ] T040 [US5] Add handler to `packages/api/src/handlers/projectHandlers.ts`:
  - updateProjectItemHandler: PATCH body → ProjectService.moveItem() → 200 + ProjectItem
  - Error translation: not found → NotFoundError
- [ ] T041 [US5] Add route to `packages/api/src/routes/projects.ts`:
  - PATCH /api/projects/:id/items/:issueId (updateProjectItemHandler, 200/400/404)

#### Integration Tests

- [ ] T042 [P] [US5] Create CLI test in `packages/cli/test/commands/project/move.test.js`:
  - Test setup: Create project with multiple items
  - Test: Move to new position → verify position updated
  - Test: Move to new column → verify view_meta updated
  - Test: Move both position and column → verify both updated
  - Test: No flags provided → verify error

**Checkpoint**: All user stories complete - full project management functionality available

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements and documentation

- [ ] T043 [P] Edge case handling: Add validation for long project names (255 char limit) in ProjectService
- [ ] T044 [P] Edge case handling: Add validation for self-reference prevention in addItem (same validation as linkService)
- [ ] T045 [P] Error messages: Ensure all error messages are user-friendly and consistent
- [ ] T046 [P] Performance: Add index verification for project_items(project_id) and project_items(issue_id)
- [ ] T047 [P] Documentation: Update README.md with project management commands
- [ ] T048 [P] Documentation: Update docs/cli-commands.md with all project subcommands
- [ ] T049 Run quickstart.md validation: Execute all test scenarios from quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (P1) can start after Foundational - No dependencies on other stories
  - US2 (P2) can start after Foundational - No dependencies on other stories
  - US3 (P2) can start after Foundational - No dependencies on other stories
  - US4 (P3) can start after Foundational - No dependencies on other stories
  - US5 (P3) can start after Foundational - No dependencies on other stories
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

All user stories are **independently implementable** after Foundational phase:
- **US1 (Create/List)**: No dependencies - Foundation only
- **US2 (Add Items)**: No dependencies - Foundation only
- **US3 (View Details)**: No dependencies - Foundation only (can work with US2 but not required)
- **US4 (Remove/Delete)**: No dependencies - Foundation only
- **US5 (Move Items)**: No dependencies - Foundation only

### Within Each User Story

- Types/Models before Services
- Services before CLI commands and API handlers
- Routes register after handlers exist
- Tests can run in parallel if marked [P]

### Parallel Opportunities

- **Setup Phase**: All 3 tasks can run in parallel
- **Foundational Phase**: T004 (types), T006 (projectRepository), T007 (projectItemRepository) can run in parallel
- **Within Each User Story**:
  - CLI command + API schema + API handler can run in parallel (different files)
  - Tests for same story can run in parallel
- **Across User Stories**: After Foundational completes, all 5 user stories can be worked on in parallel by different developers

---

## Parallel Example: User Story 1

```bash
# After Foundational phase completes, launch these in parallel:
Task T011: "Create packages/cli/src/commands/project/index.ts (list command)"
Task T012: "Create packages/cli/src/commands/project/create.ts"
Task T013: "Create packages/api/src/schemas/projectSchemas.ts"
Task T014: "Create packages/api/src/handlers/projectHandlers.ts"
Task T017: "Create packages/cli/test/commands/project/create.test.js"
Task T018: "Create packages/cli/test/commands/project/list.test.js"

# Then sequentially:
Task T015: "Create packages/api/src/routes/projects.ts" (depends on T013, T014)
Task T016: "Modify packages/api/src/index.ts" (depends on T015)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (3 tasks)
2. Complete Phase 2: Foundational (7 tasks) - CRITICAL
3. Complete Phase 3: User Story 1 (8 tasks)
4. **STOP and VALIDATE**: Test US1 independently
   - CLI: `mgtd project create "Test"` → `mgtd project list`
   - API: `curl -X POST /api/projects` → `curl /api/projects`
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (10 tasks)
2. Add User Story 1 (8 tasks) → Test independently → **Deploy MVP!**
3. Add User Story 2 (6 tasks) → Test independently → Deploy
4. Add User Story 3 (5 tasks) → Test independently → Deploy
5. Add User Story 4 (7 tasks) → Test independently → Deploy
6. Add User Story 5 (6 tasks) → Test independently → Deploy
7. Polish (7 tasks) → Final release

**Total: 49 tasks**

### Parallel Team Strategy

With 3 developers after Foundational phase:
- Developer A: User Story 1 (8 tasks) - MVP
- Developer B: User Story 2 + 3 (11 tasks) - Core functionality
- Developer C: User Story 4 + 5 (13 tasks) - Advanced features

---

## Notes

- [P] tasks = different files, can run in parallel
- [Story] label maps task to specific user story
- Each user story is independently completable and testable
- Database tables already exist - no migrations needed
- Follow existing patterns from linkService, link commands, link routes
- Commit after each task or logical group
- Tests follow existing Node.js test runner pattern (not TDD strict - tests integrated with implementation)
- CLI --json output must match API response structure
