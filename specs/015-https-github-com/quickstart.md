# Quickstart: Project Management Testing

**Feature**: Project Management CLI Commands and API
**Purpose**: Manual testing guide for verification before deployment

## Prerequisites

- Test environment database: `./test-data/test.db`
- Test API server running on port 3001: `pnpm server:dev`
- CLI configured for test database: `DB_PATH=./test-data/test.db`

## Test Environment Setup

```bash
# 1. Start test API server (uses test-data/test.db)
pnpm server:dev

# 2. In another terminal, configure CLI for test database
export DB_PATH=./test-data/test.db

# 3. Verify test data exists
mgtd task list
mgtd memo list
```

---

## CLI Testing

### US1: Create and List Projects

```bash
# Create a project with name only
mgtd project create "Sprint 1"
# Expected: Success message with project ID

# Create project with description
mgtd project create "Q4 Goals" --description "Year-end objectives"

# Create project with board view (default)
mgtd project create "Marketing Campaign" --view board

# Create project with table view
mgtd project create "Bug Tracker" --view table

# Create with JSON output
mgtd project create "API Development" --json
# Expected: JSON with id, name, description, viewMeta, createdAt

# List all projects
mgtd project list
# Expected: Table of projects with IDs and names

# List in JSON format
mgtd project list --json
# Expected: JSON array of projects

# Test duplicate name error
mgtd project create "Sprint 1"
# Expected: Error message about duplicate name
```

### US2: Add Items to Projects

```bash
# Get project ID and issue ID
PROJECT_ID=1  # From previous list
TASK_ID=$(mgtd task list --json | jq -r '.tasks[0].id')

# Add task to project
mgtd project add $PROJECT_ID $TASK_ID
# Expected: Success message

# Add with position
mgtd project add $PROJECT_ID $(mgtd task list --json | jq -r '.tasks[1].id') --position 1.5

# Add with column
MEMO_ID=$(mgtd memo list --json | jq -r '.memos[0].id')
mgtd project add $PROJECT_ID $MEMO_ID --column "In Progress"

# Add with JSON output
mgtd project add $PROJECT_ID $(mgtd task list --json | jq -r '.tasks[2].id') --json
# Expected: JSON with item details

# Test duplicate item error
mgtd project add $PROJECT_ID $TASK_ID
# Expected: Error message about duplicate item

# Test non-existent issue
mgtd project add $PROJECT_ID 99999
# Expected: Error message "Issue #99999 not found"
```

### US3: View Project Details

```bash
# View project with items
mgtd project view $PROJECT_ID
# Expected: Project details + list of items with titles

# View in JSON format
mgtd project view $PROJECT_ID --json
# Expected: JSON with project + items array

# View non-existent project
mgtd project view 99999
# Expected: Error message "Project #99999 not found"

# View empty project
EMPTY_PROJECT=$(mgtd project create "Empty Project" --json | jq -r '.id')
mgtd project view $EMPTY_PROJECT
# Expected: Project details with "No items" message
```

### US4: Remove Items and Delete Projects

```bash
# Remove item from project
mgtd project remove $PROJECT_ID $TASK_ID --yes
# Expected: Success message, item removed but task remains

# Remove without --yes flag (interactive)
mgtd project remove $PROJECT_ID $MEMO_ID
# Expected: Confirmation prompt, enter 'y' to confirm

# Remove in JSON mode (requires --yes)
mgtd project remove $PROJECT_ID $(mgtd task list --json | jq -r '.tasks[2].id') --json
# Expected: JSON error requiring --yes flag

# Delete project
mgtd project delete $EMPTY_PROJECT --yes
# Expected: Success message, project deleted

# Delete with confirmation
mgtd project delete $PROJECT_ID
# Expected: Confirmation prompt, enter 'y' to confirm

# Verify project is deleted
mgtd project list
# Expected: Deleted project should not appear

# Verify issues still exist
mgtd task view $TASK_ID
# Expected: Task still exists (not deleted)
```

### US5: Reorder Items

```bash
# Create test project with multiple items
TEST_PROJECT=$(mgtd project create "Test Reorder" --json | jq -r '.id')
mgtd project add $TEST_PROJECT $(mgtd task list --json | jq -r '.tasks[0].id')
mgtd project add $TEST_PROJECT $(mgtd task list --json | jq -r '.tasks[1].id')
mgtd project add $TEST_PROJECT $(mgtd task list --json | jq -r '.tasks[2].id')

# Move item to new position
ITEM_ID=$(mgtd task list --json | jq -r '.tasks[1].id')
mgtd project move $TEST_PROJECT $ITEM_ID --position 2.5

# Move item to new column
mgtd project move $TEST_PROJECT $ITEM_ID --column "Done"

# Move with both position and column
mgtd project move $TEST_PROJECT $ITEM_ID --position 1.0 --column "To Do"

# Verify order
mgtd project view $TEST_PROJECT --json
# Expected: Items ordered by position field
```

---

## API Testing

### US1: Create and List Projects

```bash
# Create project (minimal)
curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Sprint 1"}'
# Expected: 201, JSON with project

# Create with description
curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Q4 Goals","description":"Year-end objectives"}'

# Create with view type
curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Bug Tracker","view":"table"}'

# Test duplicate name (409)
curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Sprint 1"}'
# Expected: 409 Conflict

# Test invalid request (400)
curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":""}'
# Expected: 400 Bad Request

# List all projects
curl http://localhost:3001/api/projects
# Expected: 200, JSON array of projects
```

### US2: Add Items to Projects

```bash
# Get project ID
PROJECT_ID=1

# Add item (minimal)
curl -X POST http://localhost:3001/api/projects/$PROJECT_ID/items \
  -H "Content-Type: application/json" \
  -d '{"issueId":5}'
# Expected: 201, JSON with project item

# Add with position
curl -X POST http://localhost:3001/api/projects/$PROJECT_ID/items \
  -H "Content-Type: application/json" \
  -d '{"issueId":6,"position":1.5}'

# Add with column
curl -X POST http://localhost:3001/api/projects/$PROJECT_ID/items \
  -H "Content-Type: application/json" \
  -d '{"issueId":7,"column":"In Progress"}'

# Test duplicate item (409)
curl -X POST http://localhost:3001/api/projects/$PROJECT_ID/items \
  -H "Content-Type: application/json" \
  -d '{"issueId":5}'
# Expected: 409 Conflict

# Test non-existent issue (404)
curl -X POST http://localhost:3001/api/projects/$PROJECT_ID/items \
  -H "Content-Type: application/json" \
  -d '{"issueId":99999}'
# Expected: 404 Not Found
```

### US3: View Project Details

```bash
# Get project with items
curl http://localhost:3001/api/projects/$PROJECT_ID
# Expected: 200, JSON with project + items array

# Test non-existent project (404)
curl http://localhost:3001/api/projects/99999
# Expected: 404 Not Found
```

### US4: Remove Items and Delete Projects

```bash
# Remove item from project
curl -X DELETE http://localhost:3001/api/projects/$PROJECT_ID/items/5
# Expected: 204 No Content

# Verify item removed
curl http://localhost:3001/api/projects/$PROJECT_ID
# Expected: Item should not appear in items array

# Verify issue still exists
curl http://localhost:3001/api/tasks/5
# Expected: 200, task still exists

# Delete project
curl -X DELETE http://localhost:3001/api/projects/$PROJECT_ID
# Expected: 204 No Content

# Verify project deleted
curl http://localhost:3001/api/projects/$PROJECT_ID
# Expected: 404 Not Found
```

### US5: Update Project Items

```bash
# Create test project
PROJECT=$(curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Update"}')
PROJECT_ID=$(echo $PROJECT | jq -r '.id')

# Add items
curl -X POST http://localhost:3001/api/projects/$PROJECT_ID/items \
  -H "Content-Type: application/json" \
  -d '{"issueId":5}'

# Update position
curl -X PATCH http://localhost:3001/api/projects/$PROJECT_ID/items/5 \
  -H "Content-Type: application/json" \
  -d '{"position":2.5}'
# Expected: 200, JSON with updated item

# Update column
curl -X PATCH http://localhost:3001/api/projects/$PROJECT_ID/items/5 \
  -H "Content-Type: application/json" \
  -d '{"column":"Done"}'
# Expected: 200, JSON with updated item

# Update both
curl -X PATCH http://localhost:3001/api/projects/$PROJECT_ID/items/5 \
  -H "Content-Type: application/json" \
  -d '{"position":1.0,"column":"To Do"}'
# Expected: 200, JSON with updated item
```

---

## Edge Cases

### Deleted Issues
```bash
# Add issue to project
mgtd project add $PROJECT_ID $TASK_ID

# Delete the issue
mgtd task delete $TASK_ID --yes

# View project (item should be gone due to CASCADE)
mgtd project view $PROJECT_ID
# Expected: Item no longer in project
```

### Empty Projects
```bash
# Create project without items
EMPTY=$(mgtd project create "Empty" --json | jq -r '.id')

# View empty project
mgtd project view $EMPTY
# Expected: "No items" message (CLI) or empty items array (API)
```

### Position Edge Cases
```bash
# Add items with fractional positions
mgtd project add $PROJECT_ID $TASK1 --position 1.0
mgtd project add $PROJECT_ID $TASK2 --position 1.1
mgtd project add $PROJECT_ID $TASK3 --position 1.05
# Expected: Items ordered 1.0, 1.05, 1.1
```

### Long Project Names
```bash
# Test max length (255 characters)
LONG_NAME=$(python3 -c "print('A' * 255)")
mgtd project create "$LONG_NAME"
# Expected: Success

# Test over max length
OVER_LONG=$(python3 -c "print('A' * 256)")
mgtd project create "$OVER_LONG"
# Expected: Error (if validation added) or database constraint error
```

---

## Acceptance Criteria Verification

### CLI Commands
- [ ] `mgtd project create` - Creates project with name, description, view type
- [ ] `mgtd project list` - Lists all projects
- [ ] `mgtd project view <id>` - Shows project details with items
- [ ] `mgtd project add <pid> <iid>` - Adds issue to project
- [ ] `mgtd project remove <pid> <iid>` - Removes issue from project
- [ ] `mgtd project move <pid> <iid>` - Updates item position/column
- [ ] `mgtd project delete <pid>` - Deletes project
- [ ] All commands support `--json` flag
- [ ] Destructive commands support `--yes` flag or show confirmation

### API Endpoints
- [ ] `POST /api/projects` - Creates project (201)
- [ ] `GET /api/projects` - Lists projects (200)
- [ ] `GET /api/projects/:id` - Gets project details (200)
- [ ] `POST /api/projects/:id/items` - Adds item (201)
- [ ] `DELETE /api/projects/:id/items/:issueId` - Removes item (204)
- [ ] `PATCH /api/projects/:id/items/:issueId` - Updates item (200)
- [ ] `DELETE /api/projects/:id` - Deletes project (204)
- [ ] Appropriate HTTP status codes (400, 404, 409)

### Data Integrity
- [ ] Duplicate project names rejected (UNIQUE constraint)
- [ ] Same issue cannot be added twice to same project (UNIQUE constraint)
- [ ] Deleting project removes project_items (CASCADE)
- [ ] Deleting issue removes project_items (CASCADE)
- [ ] Issues remain intact when removed from project

### JSON Output Consistency
- [ ] CLI --json matches API response structure
- [ ] view_meta properly formatted (board vs table)
- [ ] Timestamps in ISO 8601 format
- [ ] Items include issue information (id, type, title)

---

## Performance Testing

```bash
# Create many projects
for i in {1..100}; do
  mgtd project create "Project $i" &
done
wait

# List projects (should be fast)
time mgtd project list --json

# Create project with many items
TEST_PROJECT=$(mgtd project create "Large Project" --json | jq -r '.id')
for id in $(mgtd task list --json | jq -r '.tasks[].id'); do
  mgtd project add $TEST_PROJECT $id &
done
wait

# View large project (should use batch query)
time mgtd project view $TEST_PROJECT --json
```

---

## Cleanup

```bash
# Stop test API server
# Ctrl+C in the server terminal

# Reset test database (if needed)
rm ./test-data/test.db
pnpm server:dev  # Will recreate database
```
