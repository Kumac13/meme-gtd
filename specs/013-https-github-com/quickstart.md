# Quickstart Guide: Link Command

**Feature**: Link Command Enhancement
**Date**: 2025-10-22
**Audience**: End users (CLI) and API consumers

## Overview

This guide shows how to use the enhanced link commands to create and manage relationships between tasks and memos in meme-gtd. The link feature enables GTD workflows by supporting:

- **Hierarchical relationships**: Parent-child task decomposition
- **Associative relationships**: Related tasks and derived content
- **Data integrity**: Automatic validation to prevent circular hierarchies and inverse duplicates

## Quick Reference

### CLI Commands

```bash
# Create links
mgtd link add --type parent --source <child-id> --target <parent-id>
mgtd link add --type child --source <parent-id> --target <child-id>
mgtd link add --type relates --source <id1> --target <id2>

# List links
mgtd link list <issue-id>                    # All links
mgtd link list <issue-id> --type parent      # Filter by type
mgtd link list <issue-id> --json             # JSON output

# Delete links
mgtd link remove <link-id>                   # With confirmation
mgtd link remove <link-id> --yes             # Skip confirmation
```

### API Endpoints

```bash
# Create link
POST /api/links
Body: {"sourceIssueId": 1, "targetIssueId": 2, "linkType": "parent"}

# List links
GET /api/issues/5/links                      # All links
GET /api/issues/5/links?type=parent          # Filter by type

# Delete link
DELETE /api/links/10
```

## Usage Examples

### Example 1: Create a Parent-Child Hierarchy

**Scenario**: Break down "Project Alpha" (task #1) into subtasks

**CLI**:
```bash
# Create subtasks first
mgtd task create --title "Design UI" --body "Create wireframes"
# Created: Task #2

mgtd task create --title "Implement backend" --body "API development"
# Created: Task #3

# Link them as children of the parent project
mgtd link add --type parent --source 1 --target 2
# Link created: #1 (1 --parent--> 2)

mgtd link add --type parent --source 1 --target 3
# Link created: #2 (1 --parent--> 3)

# View hierarchy
mgtd link list 1
# Links for issue #1:
#   #1  #1 --parent--> #2
#   #2  #1 --parent--> #3
```

**API**:
```bash
# Create first subtask link
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -d '{"sourceIssueId": 1, "targetIssueId": 2, "linkType": "parent"}'

# Create second subtask link
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -d '{"sourceIssueId": 1, "targetIssueId": 3, "linkType": "parent"}'

# View all links for the parent task
curl http://localhost:3000/api/issues/1/links
```

**Response**:
```json
[
  {
    "id": 1,
    "sourceIssueId": 1,
    "targetIssueId": 2,
    "linkType": "parent",
    "createdAt": "2025-10-22T10:30:00Z",
    "direction": "outgoing"
  },
  {
    "id": 2,
    "sourceIssueId": 1,
    "targetIssueId": 3,
    "linkType": "parent",
    "createdAt": "2025-10-22T10:31:00Z",
    "direction": "outgoing"
  }
]
```

### Example 2: Filter Links by Type

**Scenario**: View only parent relationships for a task

**CLI**:
```bash
mgtd link list 2 --type parent
# Links for issue #2:
#   #1  #2 <--parent-- #1
```

**API**:
```bash
curl http://localhost:3000/api/issues/2/links?type=parent
```

**Response**:
```json
[
  {
    "id": 1,
    "sourceIssueId": 1,
    "targetIssueId": 2,
    "linkType": "parent",
    "createdAt": "2025-10-22T10:30:00Z",
    "direction": "incoming"
  }
]
```

### Example 3: Create Related (Non-Hierarchical) Links

**Scenario**: Link related tasks that should be worked on together

**CLI**:
```bash
# Link "Design UI" and "Write documentation" as related
mgtd link add --type relates --source 2 --target 4
# Link created: #3 (2 --relates--> 4)

# Relates links are bidirectional - both tasks show the relationship
mgtd link list 2 --type relates
# Links for issue #2:
#   #3  #2 --relates--> #4

mgtd link list 4 --type relates
# Links for issue #4:
#   #3  #4 <--relates-- #2
```

**API**:
```bash
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -d '{"sourceIssueId": 2, "targetIssueId": 4, "linkType": "relates"}'
```

### Example 4: Delete a Link

**Scenario**: Remove an incorrect link

**CLI**:
```bash
# With confirmation prompt
mgtd link remove 3
# Delete link #3 (2 --relates--> 4)? (y/N): y
# Link #3 deleted

# Skip confirmation (useful for scripts)
mgtd link remove 3 --yes
# Link #3 deleted
```

**API**:
```bash
curl -X DELETE http://localhost:3000/api/links/3
# Returns: 204 No Content
```

## New Validation Features

### Feature 1: Circular Hierarchy Prevention (FR-013)

**What it prevents**: Creating circular parent-child relationships

**Example - Blocked Scenario**:
```bash
# Setup: A → B → C (A is parent of B, B is parent of C)
mgtd link add --type parent --source 1 --target 2
mgtd link add --type parent --source 2 --target 3

# Attempt to create C → A (would create cycle: A → B → C → A)
mgtd link add --type parent --source 3 --target 1
# ERROR: Circular relationship detected: Creating this link would form
# a cycle in the parent-child hierarchy (Issue #1 is already an ancestor
# of Issue #3)
```

**API**:
```bash
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -d '{"sourceIssueId": 3, "targetIssueId": 1, "linkType": "parent"}'
```

**Error Response**:
```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Circular relationship detected: Creating this link would form a cycle in the parent-child hierarchy (Issue #1 is already an ancestor of Issue #3)"
}
```

**Important**: This validation only applies to `parent` and `child` link types. Relates and derived_from links can form cycles.

### Feature 2: Inverse Duplicate Prevention (FR-014)

**What it prevents**: Creating bidirectional parent-child relationships

**Example - Blocked Scenario**:
```bash
# Create: Task 1 is parent of Task 2
mgtd link add --type parent --source 1 --target 2

# Attempt to create: Task 2 is parent of Task 1 (inverse)
mgtd link add --type parent --source 2 --target 1
# ERROR: Cannot create inverse parent-child link: Issue #1 is already
# a parent of Issue #2
```

**API**:
```bash
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -d '{"sourceIssueId": 2, "targetIssueId": 1, "linkType": "parent"}'
```

**Error Response**:
```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Cannot create inverse parent-child link: Issue #1 is already a parent of Issue #2"
}
```

**Important**: This validation only applies to `parent` and `child` link types. Relates links are bidirectional by nature and can exist in both directions.

## Link Types Explained

### parent / child (Hierarchical)

**Use case**: Task decomposition, project structure

- **Direction matters**: `parent` and `child` are inverse views of the same relationship
- **Validations apply**: Circular detection and inverse duplicate prevention
- **Example**: "Project Alpha" (parent) → "Design UI" (child)

**Recommendation**: Use `parent` consistently to create hierarchies

### relates (Associative)

**Use case**: Cross-referencing related tasks

- **Bidirectional**: No direction semantics
- **No hierarchy**: No validations apply
- **Example**: "Design UI" ↔ "Write documentation"

**Recommendation**: Use when tasks share context but are not hierarchically related

### derived_from (Provenance)

**Use case**: Track where tasks originated from

- **Direction matters**: Source was derived from target
- **No validations**: Can form any structure
- **Example**: Task "Implement feature" derived from Memo "Feature idea"

**Recommendation**: Use to maintain traceability from ideas to implementation

## Common Workflows

### Workflow 1: Build a 3-Level Project Hierarchy

```bash
# Level 1: Project
mgtd task create --title "Launch Product" --body "Q4 deliverable"
# Task #1

# Level 2: Milestones
mgtd task create --title "MVP Development" --body "First iteration"
# Task #2
mgtd task create --title "Beta Testing" --body "User feedback"
# Task #3

# Level 3: Tasks
mgtd task create --title "Core Features" --body "Authentication, DB"
# Task #4
mgtd task create --title "UI Polish" --body "Design improvements"
# Task #5

# Build hierarchy
mgtd link add --type parent --source 1 --target 2  # Project → MVP
mgtd link add --type parent --source 1 --target 3  # Project → Beta
mgtd link add --type parent --source 2 --target 4  # MVP → Core Features
mgtd link add --type parent --source 2 --target 5  # MVP → UI Polish

# View project structure
mgtd link list 1
mgtd link list 2
```

### Workflow 2: Convert Memo to Task with Provenance

```bash
# Create memo with idea
mgtd memo create --title "Feature idea" --body "Add dark mode"
# Memo #10

# Convert to task
mgtd task create --title "Implement dark mode" --body "CSS variables"
# Task #11

# Link task to original memo
mgtd link add --type derived_from --source 11 --target 10
# Link created: #6 (11 --derived_from--> 10)

# Later, view the origin of the task
mgtd link list 11 --type derived_from
# Links for issue #11:
#   #6  #11 --derived_from--> #10
```

### Workflow 3: Cross-Link Related Tasks

```bash
# Create related tasks in different areas
mgtd task create --title "Update API docs" --body "OpenAPI spec"
# Task #20

mgtd task create --title "Update client SDK" --body "Match new API"
# Task #21

# Link them as related
mgtd link add --type relates --source 20 --target 21
# Link created: #7 (20 --relates--> 21)

# Both tasks show the relationship
mgtd link list 20 --type relates
mgtd link list 21 --type relates
```

## Error Handling

### All Validation Errors

| Error | Trigger | Example |
|-------|---------|---------|
| Self-reference | source_id == target_id | `mgtd link add -t parent -s 1 -T 1` |
| Source not found | Source issue doesn't exist | `mgtd link add -t parent -s 999 -T 1` |
| Target not found | Target issue doesn't exist | `mgtd link add -t parent -s 1 -T 999` |
| Duplicate link | Same (source, target, type) exists | Creating same link twice |
| Inverse duplicate (NEW) | Parent-child inverse exists | A parent of B, then B parent of A |
| Circular hierarchy (NEW) | Would create cycle in hierarchy | A→B→C→A |

### CLI Error Output

```bash
$ mgtd link add --type parent --source 3 --target 1
 ›   Error: Circular relationship detected: Creating this link would
 ›   form a cycle in the parent-child hierarchy (Issue #1 is already
 ›   an ancestor of Issue #3)
```

### API Error Response Format

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Detailed error message here"
}
```

## JSON Output (CLI)

All CLI commands support `--json` flag for machine-readable output:

```bash
# Create link with JSON output
mgtd link add --type parent --source 1 --target 2 --json
```

**Output**:
```json
{
  "id": 1,
  "sourceIssueId": 1,
  "targetIssueId": 2,
  "linkType": "parent",
  "createdAt": "2025-10-22T10:30:00Z"
}
```

```bash
# List links with JSON output
mgtd link list 1 --json
```

**Output**:
```json
[
  {
    "id": 1,
    "sourceIssueId": 1,
    "targetIssueId": 2,
    "linkType": "parent",
    "createdAt": "2025-10-22T10:30:00Z"
  }
]
```

## Tips and Best Practices

1. **Use consistent parent/child direction**: Always use `parent` when creating hierarchies for clarity
2. **Avoid deep hierarchies**: Keep hierarchies to 3-5 levels for maintainability
3. **Use relates for cross-cutting concerns**: Tasks that need to be aware of each other but aren't hierarchical
4. **Use derived_from for traceability**: Track which tasks came from which ideas/memos
5. **Filter by type when querying**: Use `--type` or `?type=` to reduce noise when viewing links
6. **Use --json for automation**: Integrate with scripts and tools using JSON output

## Migration from Old Behavior

### What Changed

**Before**: Link creation had basic validation only (self-reference, existence, duplicates)

**After**: Enhanced validation prevents:
- Circular parent-child hierarchies
- Inverse parent-child duplicates

### Impact

**Existing links**: Grandfathered - not retroactively validated

**New links**: Must pass all validations

**Recommended**: Review existing links for potential circular structures using:
```bash
# Future command (not yet implemented)
mgtd link validate
```

## Feature Parity: CLI vs API

| Feature | CLI | API |
|---------|-----|-----|
| Create link | `mgtd link add` | `POST /api/links` |
| List all links | `mgtd link list <id>` | `GET /api/issues/:id/links` |
| Filter by type | `mgtd link list <id> --type <type>` | `GET /api/issues/:id/links?type=<type>` |
| Delete link | `mgtd link remove <id>` | `DELETE /api/links/:id` |
| JSON output | `--json` flag | Default |
| Validation | ✅ All validations | ✅ All validations |

**Status**: ✅ **Full feature parity achieved**

## Next Steps

- See [data-model.md](./data-model.md) for technical details on validation rules
- See [contracts/api-changes.md](./contracts/api-changes.md) for API schema details
- See [research.md](./research.md) for algorithm implementation details

## FAQ

**Q: Can I create a relates link even if a parent-child link exists?**
A: Yes. Relates and parent-child are independent relationship types.

**Q: What happens to links when I delete a task?**
A: All links involving that task are automatically deleted (CASCADE delete).

**Q: Can a task have multiple parents?**
A: Technically yes, but GTD workflows typically use single parent. The system doesn't enforce single parent.

**Q: How deep can hierarchies go?**
A: No hard limit, but cycle detection checks up to 10 levels. Keep hierarchies shallow (3-5 levels) for usability.

**Q: Can I create A→B and B→A with relates type?**
A: Yes. Relates links are bidirectional, so both directions are valid.
