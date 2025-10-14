# Data Model: Interactive Confirmation for Memo Delete

**Feature**: 003-https-github-com
**Created**: 2025-10-14

## Overview

This feature does not introduce new data entities or modify the database schema. It only changes the user interaction flow for the existing memo deletion operation.

## Existing Entities (No Changes)

### Memo

The memo entity remains unchanged. The deletion operation continues to use the existing soft-delete mechanism.

**Relevant Fields**:
- `id`: Integer - Unique identifier
- `body_md`: String - Memo content (used for preview in confirmation prompt)
- `is_deleted`: Boolean - Soft delete flag (set to true on deletion)
- `type`: String - Always 'memo' for memo entities

**Relationships**: No changes to existing relationships.

**State Transitions**: No changes to the soft-delete behavior - only the user confirmation flow changes.

## Data Flow

### Interactive Deletion Flow

1. **Input**: User provides memo ID via command argument
2. **Validation**: System checks if memo exists (existing behavior)
3. **Preview Fetch**: System retrieves memo content for display in prompt
4. **User Response**: System captures y/n input from stdin
5. **Deletion**: If confirmed, existing `service.remove(id)` is called
6. **Output**: Success/cancellation message displayed

### Non-Interactive Deletion Flow (--yes flag)

1. **Input**: User provides memo ID and --yes flag
2. **Validation**: System checks if memo exists (existing behavior)
3. **Deletion**: System immediately calls `service.remove(id)` (no prompt)
4. **Output**: Success message displayed

## No Schema Changes

This feature requires **zero database migrations** as it only modifies CLI interaction logic.

## Service Layer (No Changes)

The existing `MemoService.remove(id)` method remains unchanged:
- Accepts memo ID
- Performs soft delete (sets `is_deleted = true`)
- Returns success/error

This feature only wraps the service call with interactive confirmation at the CLI layer.
