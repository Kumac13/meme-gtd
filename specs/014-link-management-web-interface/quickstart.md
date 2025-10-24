# Quickstart Guide: Link Management Web Interface

**Feature**: Link Management Web UI
**Branch**: `014-link-management-web-interface`
**Date**: 2025-10-24

## Overview

This guide provides step-by-step manual testing scenarios for the Link Management Web Interface feature. Follow these instructions to verify the implementation meets all requirements from `spec.md`.

---

## Prerequisites

Before starting manual tests, ensure the following:

### 1. API Server Running

Start the **test API server** on port 3001 (DO NOT use production server on port 3000):

```bash
# From repository root
pnpm server:dev
```

**Expected Output**:
```
Server listening at http://localhost:3001
Using database: ./test-data/test.db
```

**Verification**:
```bash
curl http://localhost:3001/api/memos
```

### 2. Web UI Running

Start the Web UI development server (connects to API on port 3001):

```bash
# From repository root
pnpm --filter meme-gtd-web dev
```

**Expected Output**:
```
VITE ready in XXX ms
➜  Local:   http://localhost:5173/
```

Open the Web UI in your browser: **http://localhost:5173/**

### 3. Test Data Setup

Ensure the test database has sufficient data:

**Minimum Requirements**:
- At least 3 tasks with IDs 1, 2, 3
- At least 2 memos with IDs 4, 5
- At least 2 existing links between tasks (for viewing tests)

**Create Test Data** (if needed):
```bash
# Use test environment
export DB_PATH=./test-data/test.db

# Create tasks
mgtd task create --title "Task 1" --body "First task"
mgtd task create --title "Task 2" --body "Second task"
mgtd task create --title "Task 3" --body "Third task"

# Create memos
mgtd memo create --body "Memo about authentication"
mgtd memo create --body "Research notes on testing"

# Create links (CLI commands - adjust based on actual CLI)
# Example: mgtd link create --source 1 --target 2 --type parent
```

---

## Test Scenario 1: View Existing Links (P1)

**Objective**: Verify that links are displayed correctly on task/memo detail pages.

### Test Case 1.1: Task with Multiple Outgoing Links

**Given**: Task #1 has 2 outgoing parent links to Tasks #2 and #3

**Steps**:
1. Navigate to **http://localhost:5173/tasks/1** (Task #1 detail page)
2. Locate the "Links" section between the Labels and Body sections

**Expected Results**:
- [ ] Links section header displays "Links (2)"
- [ ] Section is expanded by default (content visible)
- [ ] Two links are displayed with:
  - [ ] Link 1: Parent icon (outgoing arrow), text "Parent of Task 2 title"
  - [ ] Link 2: Parent icon (outgoing arrow), text "Parent of Task 3 title"
- [ ] Each link shows the correct target task title (fetched from API)
- [ ] Each link has a [×] delete button on the right side
- [ ] Clicking the link title navigates to the target task detail page

### Test Case 1.2: Memo with Incoming "Relates" Link

**Given**: Memo #4 has 1 incoming "relates" link from Memo #5

**Steps**:
1. Navigate to **http://localhost:5173/memos/4** (Memo #4 detail page)
2. Locate the "Links" section

**Expected Results**:
- [ ] Links section header displays "Links (1)"
- [ ] Section is expanded by default
- [ ] One link is displayed with:
  - [ ] Relates icon (bidirectional link icon)
  - [ ] Text "Related to Memo 5 preview text"
  - [ ] Preview text is the first line/50 chars of the memo body
- [ ] Link is clickable and navigates to Memo #5 detail page

### Test Case 1.3: Task with No Links

**Given**: Task #3 has no links

**Steps**:
1. Navigate to **http://localhost:5173/tasks/3** (Task #3 detail page)
2. Locate the "Links" section

**Expected Results**:
- [ ] Links section header displays "Links (0)"
- [ ] Section is collapsed by default (content hidden)
- [ ] Clicking the header expands the section
- [ ] Expanded section shows "No links yet" message
- [ ] [+ Add] button is visible in the header

### Test Case 1.4: Collapsible Section Behavior

**Given**: Task #1 with 2 links (from Test Case 1.1)

**Steps**:
1. Navigate to **http://localhost:5173/tasks/1**
2. Click the "Links (2)" header to collapse the section
3. Verify the section content is hidden
4. Click the header again to expand

**Expected Results**:
- [ ] Clicking header toggles visibility of link list
- [ ] Chevron icon rotates 90° when expanded (right → down)
- [ ] Link count remains visible in collapsed state
- [ ] Expand/collapse is smooth (no layout shift)

---

## Test Scenario 2: Create New Link (P2)

**Objective**: Verify inline link creation flow and error handling.

### Test Case 2.1: Create Parent Link (Happy Path)

**Given**: Viewing Task #1 detail page

**Steps**:
1. Navigate to **http://localhost:5173/tasks/1**
2. Click the [+ Add] button in the Links section header
3. Verify the inline form appears with 4 link type options
4. Click "Create parent link"
5. Verify the input field appears with placeholder "Enter issue ID (e.g., 5)"
6. Enter target issue ID: `2`
7. Click the [Add] button
8. Wait for API response

**Expected Results**:
- [ ] Inline form appears below the link list (or in empty state)
- [ ] Form shows 4 buttons: "parent", "child", "relates", "derived_from"
- [ ] After selecting type, input field and [Add] [Cancel] buttons appear
- [ ] Input field accepts numeric input only
- [ ] [Add] button is disabled when input is empty
- [ ] After clicking [Add], button shows "Adding..." and is disabled
- [ ] On success:
  - [ ] New link appears in the list immediately
  - [ ] Link count updates (e.g., "Links (2)" → "Links (3)")
  - [ ] Inline form closes automatically
  - [ ] New link shows correct icon, direction, and target title

### Test Case 2.2: Create "Relates" Link Between Memos

**Given**: Viewing Memo #4 detail page

**Steps**:
1. Navigate to **http://localhost:5173/memos/4**
2. Click [+ Add] button
3. Select "relates" link type
4. Enter target memo ID: `5`
5. Click [Add]

**Expected Results**:
- [ ] Link is created successfully
- [ ] New link shows bidirectional "relates" icon
- [ ] Target memo preview text is displayed (not full body)
- [ ] Clicking the link navigates to Memo #5

### Test Case 2.3: Cancel Link Creation

**Given**: Viewing Task #1, inline form is open

**Steps**:
1. Navigate to **http://localhost:5173/tasks/1**
2. Click [+ Add]
3. Select "parent" link type
4. Enter target ID: `2`
5. Click [Cancel] button (before clicking [Add])

**Expected Results**:
- [ ] Inline form closes immediately
- [ ] No link is created
- [ ] Input field is cleared
- [ ] No API call is made (verify in Network tab)
- [ ] User can click [+ Add] again to restart

### Test Case 2.4: Error - Invalid Issue ID (Not Found)

**Given**: Viewing Task #1

**Steps**:
1. Click [+ Add]
2. Select "parent" link type
3. Enter target ID: `999999` (non-existent issue)
4. Click [Add]

**Expected Results**:
- [ ] API returns 404 error
- [ ] Error message appears below input field: "Issue not found"
- [ ] Error message is displayed in red text with warning icon
- [ ] Inline form remains open (does not close)
- [ ] User can correct the ID and retry
- [ ] [Cancel] button still works

### Test Case 2.5: Error - Circular Hierarchy

**Given**: Task #1 is already a parent of Task #2

**Steps**:
1. Navigate to **http://localhost:5173/tasks/2** (Task #2 detail page)
2. Click [+ Add]
3. Select "parent" link type
4. Enter target ID: `1` (would create circular: 1→2 and 2→1)
5. Click [Add]

**Expected Results**:
- [ ] API returns 400 validation error
- [ ] Error message appears: "Cannot create link: This would create a circular hierarchy"
- [ ] Inline form remains open
- [ ] User can cancel or try a different target ID

### Test Case 2.6: Error - Duplicate Link

**Given**: Task #1 already has a parent link to Task #2

**Steps**:
1. Navigate to **http://localhost:5173/tasks/1**
2. Click [+ Add]
3. Select "parent" link type
4. Enter target ID: `2` (duplicate)
5. Click [Add]

**Expected Results**:
- [ ] API returns 400 validation error
- [ ] Error message appears: "Link already exists between these issues"
- [ ] Inline form remains open

### Test Case 2.7: Error - Self-Referencing Link

**Given**: Viewing Task #1

**Steps**:
1. Click [+ Add]
2. Select "child" link type
3. Enter target ID: `1` (same as source issue)
4. Click [Add]

**Expected Results**:
- [ ] API returns 400 validation error
- [ ] Error message appears: "Cannot create link from issue to itself"

---

## Test Scenario 3: Delete Link (P3)

**Objective**: Verify inline link deletion with confirmation.

### Test Case 3.1: Delete Link with Confirmation

**Given**: Task #1 has 2 links

**Steps**:
1. Navigate to **http://localhost:5173/tasks/1**
2. Locate the first link in the list
3. Click the [×] delete button next to the link
4. Verify the confirmation prompt appears
5. Click [Confirm]

**Expected Results**:
- [ ] Clicking [×] shows inline confirmation: "Delete this link? [Confirm] [Cancel]"
- [ ] Confirmation appears in place of the link (or overlays it)
- [ ] [Confirm] button is styled as primary action (e.g., red/warning color)
- [ ] Clicking [Confirm] triggers API call `DELETE /api/links/:id`
- [ ] After successful deletion:
  - [ ] Link is removed from the list immediately
  - [ ] Link count updates (e.g., "Links (2)" → "Links (1)")
  - [ ] No error message is shown
  - [ ] Remaining links are still displayed correctly

### Test Case 3.2: Cancel Link Deletion

**Given**: Task #1 has 2 links

**Steps**:
1. Navigate to **http://localhost:5173/tasks/1**
2. Click the [×] button next to the first link
3. Verify the confirmation prompt appears
4. Click [Cancel]

**Expected Results**:
- [ ] Confirmation prompt disappears
- [ ] Link remains in the list (unchanged)
- [ ] No API call is made (verify in Network tab)
- [ ] [×] button is still visible and clickable

### Test Case 3.3: Delete Last Link

**Given**: Task #3 has exactly 1 link

**Steps**:
1. Navigate to **http://localhost:5173/tasks/3**
2. Click [×] next to the only link
3. Click [Confirm]

**Expected Results**:
- [ ] Link is deleted successfully
- [ ] Link count updates to "Links (0)"
- [ ] Section remains visible (does not auto-collapse)
- [ ] "No links yet" message is displayed
- [ ] [+ Add] button is still available

### Test Case 3.4: Error - Link Not Found (Concurrent Deletion)

**Given**: Task #1 has a link with ID 12

**Steps**:
1. Open Task #1 in two browser tabs
2. In Tab 1: Click [×] next to link #12, click [Confirm]
3. Wait for deletion to complete in Tab 1
4. In Tab 2: Click [×] next to the same link #12, click [Confirm]

**Expected Results**:
- [ ] Tab 1: Link deleted successfully
- [ ] Tab 2: API returns 404 error "Link not found"
- [ ] Tab 2: Error message appears inline (e.g., "Link not found")
- [ ] Tab 2: Link is removed from the UI (even though deletion failed)
- [ ] Refreshing Tab 2 shows the updated state (link is gone)

---

## Edge Cases

### Edge Case 1: Deleted Target Issue

**Setup**: Create a link from Task #1 to Task #2, then soft-delete Task #2

**Steps**:
1. Create link: Task #1 → parent → Task #2
2. Soft-delete Task #2 (via CLI or API: `DELETE /api/tasks/2`)
3. Navigate to **http://localhost:5173/tasks/1**

**Expected Results**:
- [ ] Link is still displayed (not automatically removed)
- [ ] Target issue title shows "Issue #2 (deleted)" in gray text
- [ ] Clicking the link does NOT navigate (link is disabled/unclickable)
- [ ] [×] delete button is still functional
- [ ] Deleting the link works normally

### Edge Case 2: Long Title Truncation

**Setup**: Create a task with a very long title (>100 characters)

**Steps**:
1. Create Task #10 with title: "This is a very long task title that exceeds one hundred characters and should be truncated in the UI to prevent layout issues and maintain readability"
2. Create link: Task #1 → relates → Task #10
3. Navigate to **http://localhost:5173/tasks/1**

**Expected Results**:
- [ ] Long title is truncated with ellipsis: "This is a very long task title that exceeds..."
- [ ] Hovering over the link shows full title in a tooltip
- [ ] Layout does not break (no horizontal scrolling)
- [ ] Link is still clickable

### Edge Case 3: Many Links (10+)

**Setup**: Create 15 links from Task #1 to other tasks

**Steps**:
1. Create 15 links (mix of parent, child, relates types)
2. Navigate to **http://localhost:5173/tasks/1**

**Expected Results**:
- [ ] Links section header shows "Links (15)"
- [ ] All 15 links are displayed (no pagination in MVP)
- [ ] Section remains collapsible
- [ ] Scrolling within the links list works smoothly
- [ ] No performance issues (rendering <500ms)
- [ ] [+ Add] button remains accessible at the top

### Edge Case 4: Concurrent Link Creation

**Setup**: Two users viewing the same task

**Steps**:
1. Open Task #1 in two browser tabs
2. In Tab 1: Add a parent link to Task #2
3. In Tab 2: Add a parent link to Task #3 (before Tab 1 completes)

**Expected Results**:
- [ ] Both links are created successfully
- [ ] Tab 1 shows link to Task #2 immediately
- [ ] Tab 2 shows link to Task #3 immediately
- [ ] Refreshing either tab shows both links (total: 2 new links)
- [ ] Link count is accurate after refresh

### Edge Case 5: API Server Offline

**Setup**: Stop the API server while viewing a task detail page

**Steps**:
1. Navigate to **http://localhost:5173/tasks/1** with API running
2. Stop the API server: `Ctrl+C` in the terminal
3. Try to create a new link
4. Try to delete an existing link

**Expected Results**:
- [ ] Creating link shows error: "Failed to create link. Please try again."
- [ ] Deleting link shows error: "Failed to delete link. Please try again."
- [ ] UI remains functional (no crashes)
- [ ] Refreshing the page shows connection error for initial load

---

## Browser Compatibility

Test the following scenarios in:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)

**Verify**:
- Icons render consistently (SVG, not emoji)
- Layout is consistent across browsers
- Hover states work correctly
- No console errors

---

## Accessibility Testing

### Keyboard Navigation

**Steps**:
1. Navigate to Task #1 detail page
2. Use `Tab` key to navigate through links
3. Press `Enter` on a link to navigate to target issue
4. Press `Tab` to reach [×] delete button
5. Press `Enter` on [×] to show confirmation
6. Press `Tab` to [Confirm] button, press `Enter` to delete

**Expected Results**:
- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible (outline/highlight)
- [ ] Tab order is logical (top to bottom, left to right)
- [ ] `Enter` key activates buttons and links

### Screen Reader

**Tools**: Use VoiceOver (macOS), NVDA (Windows), or JAWS

**Steps**:
1. Navigate to Task #1 with links
2. Use screen reader to read the Links section

**Expected Results**:
- [ ] Section header is announced: "Links, 2 items"
- [ ] Each link is announced with type: "Parent link to Task 2 title"
- [ ] Delete button is announced: "Delete link"
- [ ] Inline form labels are properly associated with inputs

---

## Performance Testing

### Load Time

**Steps**:
1. Navigate to Task #1 with 10 links
2. Open browser DevTools → Network tab
3. Measure time to load links

**Expected Results**:
- [ ] `GET /api/issues/1/links` responds in <500ms
- [ ] Links section renders in <2 seconds total
- [ ] No unnecessary re-renders (React DevTools Profiler)

### Interaction Responsiveness

**Steps**:
1. Click [+ Add] button
2. Select link type
3. Enter target ID
4. Click [Add]

**Expected Results**:
- [ ] Each interaction responds in <100ms (perceived as instant)
- [ ] No UI freezing or lag during API calls
- [ ] Loading indicators appear immediately when submitting

---

## Summary Checklist

After completing all test scenarios, verify:

- [ ] All P1 scenarios pass (View Existing Links)
- [ ] All P2 scenarios pass (Create New Link)
- [ ] All P3 scenarios pass (Delete Link)
- [ ] All edge cases are handled gracefully
- [ ] No browser console errors in any test
- [ ] UI matches the design mockups from issue #43
- [ ] API calls use correct endpoints and request/response formats
- [ ] Error messages are user-friendly and actionable

---

## Troubleshooting

### Links Not Displaying

- Verify API server is running on port 3001
- Check browser console for errors
- Verify API response: `curl http://localhost:3001/api/issues/1/links`
- Ensure `targetIssue` field is present in API response (from PR #42)

### Cannot Create Links

- Check API validation errors in Network tab (DevTools)
- Verify target issue exists: `curl http://localhost:3001/api/tasks/2`
- Ensure no circular hierarchy or duplicate links exist

### Delete Not Working

- Verify link ID is correct in API call
- Check 404 errors (link may be already deleted)
- Ensure API returns 204 No Content on success

---

## Next Steps

After successful manual testing:
1. Document any bugs found in GitHub issues
2. Update spec.md with any missing edge cases
3. Proceed to automated test implementation (Phase 2)
4. Create pull request with implementation + tests
