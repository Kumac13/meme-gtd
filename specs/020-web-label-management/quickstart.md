# Quickstart: Web UI Label Management

**Feature**: 020-web-label-management
**Branch**: `020-web-label-management`
**Target Audience**: Developers implementing this feature

## Overview

This guide helps developers quickly understand and implement the Web UI label management feature. The feature adds interactive label management to the Web UI, allowing users to create, assign, and remove labels directly from item detail pages.

**Implementation Scope**:
- ✅ Backend API exists and is complete (except one missing endpoint)
- ✨ Frontend UI needs to be built from scratch
- ⚠️ One new backend endpoint required: `DELETE /api/issues/:issueId/labels/:labelId`

---

## Prerequisites

### Required Knowledge
- React 19 (hooks, functional components)
- TypeScript
- TailwindCSS
- Fastify (for backend endpoint)
- SQLite (basic understanding of schema)

### Development Environment Setup

```bash
# Clone repository
git clone https://github.com/your-org/meme-gtd.git
cd meme-gtd

# Checkout feature branch
git checkout 020-web-label-management

# Install dependencies
pnpm install

# Build packages (required for monorepo dependencies)
pnpm build
```

### Initialize Test Database

```bash
# Initialize test database with sample data
pnpm mgtd:test init -d $PWD/test-data/test.db -f

# Create some test labels (optional)
pnpm mgtd:test label create "bug" --description "Bug reports"
pnpm mgtd:test label create "feature" --description "New features"
pnpm mgtd:test label create "urgent" --description "Urgent items"
```

---

## Project Structure

```
meme-gtd/
├── specs/020-web-label-management/     # Feature documentation
│   ├── spec.md                         # Feature specification
│   ├── plan.md                         # Implementation plan (this phase)
│   ├── research.md                     # Research findings
│   ├── data-model.md                   # Data model
│   ├── contracts/                      # API contracts
│   │   └── remove-label-from-issue.yaml
│   └── quickstart.md                   # This file
│
├── packages/
│   ├── api/                            # Backend (Fastify)
│   │   ├── src/
│   │   │   ├── routes/labels.ts        # ⚠️ ADD: DELETE endpoint
│   │   │   └── handlers/
│   │   └── test/integration/labels.test.ts  # ⚠️ UPDATE: Add tests
│   │
│   ├── web/                            # Frontend (React + Vite)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ItemDetail.tsx      # ⚠️ UPDATE: Add "Manage Labels" button
│   │   │   │   ├── LabelManagementModal.tsx  # ✨ NEW
│   │   │   │   ├── LabelBadge.tsx      # ✨ NEW
│   │   │   │   ├── LabelCreationForm.tsx  # ✨ NEW
│   │   │   │   └── ...
│   │   │   └── hooks/
│   │   │       └── useRecentLabels.ts  # ✨ NEW
│   │   └── test/
│   │       ├── components/             # ✨ NEW: Unit tests
│   │       └── e2e/                    # ✨ NEW: E2E tests
│   │
│   └── db/                             # Database layer
│       └── src/labelRepository.ts      # ⚠️ UPDATE: Add detachLabelFromIssue()
```

**Legend**:
- ✨ NEW: File to be created
- ⚠️ UPDATE: Existing file to be modified
- ⚠️ ADD: New functionality in existing file

---

## Development Workflow

### Phase 1: Backend Endpoint (Required First)

#### 1.1 Add Repository Function

**File**: `packages/db/src/labelRepository.ts`

```typescript
/**
 * Remove a label from an issue (idempotent)
 * @throws {Error} if issue or label does not exist
 */
export function detachLabelFromIssue(
  db: Database.Database,
  issueId: number,
  labelId: number
): void {
  // Validate issue exists
  const issue = db.prepare('SELECT id FROM issues WHERE id = ?').get(issueId);
  if (!issue) {
    throw new Error(`Issue ${issueId} not found`);
  }

  // Validate label exists
  const label = db.prepare('SELECT id FROM labels WHERE id = ?').get(labelId);
  if (!label) {
    throw new Error(`Label ${labelId} not found`);
  }

  // Remove assignment (idempotent operation)
  db.prepare('DELETE FROM issue_labels WHERE issue_id = ? AND label_id = ?')
    .run(issueId, labelId);
}
```

#### 1.2 Add Route Handler

**File**: `packages/api/src/routes/labels.ts`

```typescript
import { detachLabelFromIssue } from 'meme-gtd-db/labelRepository';

// DELETE /api/issues/:issueId/labels/:labelId
server.delete(
  '/issues/:issueId/labels/:labelId',
  {
    schema: {
      params: z.object({
        issueId: z.string().regex(/^\d+$/),
        labelId: z.coerce.number().int().positive(),
      }),
    },
  },
  async (request, reply) => {
    const { issueId, labelId } = request.params;

    try {
      detachLabelFromIssue(db, Number(issueId), labelId);
      reply.code(204).send();
    } catch (error) {
      if (error.message.includes('not found')) {
        reply.code(404).send({
          error: 'NotFoundError',
          code: 'NOT_FOUND',
          message: error.message,
        });
      } else {
        throw error;
      }
    }
  }
);
```

#### 1.3 Update OpenAPI Spec

**File**: `packages/api/docs/api/openapi.yaml`

Add the endpoint specification from `specs/020-web-label-management/contracts/remove-label-from-issue.yaml`.

#### 1.4 Add Integration Tests

**File**: `packages/api/test/integration/labels.test.ts`

```typescript
describe('DELETE /api/issues/:issueId/labels/:labelId', () => {
  it('should remove label from issue', async () => {
    // See contracts/remove-label-from-issue.yaml for full test suite
  });

  it('should be idempotent', async () => {
    // Test removing non-assigned label succeeds
  });

  it('should return 404 when issue not found', async () => {
    // Test error handling
  });
});
```

#### 1.5 Test Backend

```bash
# Run integration tests
cd packages/api
pnpm test

# Start test API server
pnpm dev  # Runs on port 3001 with test database

# Test endpoint manually
curl -X DELETE http://localhost:3001/api/issues/1/labels/1
# Expected: 204 No Content
```

#### 1.6 Regenerate API Client

```bash
# Update OpenAPI spec first, then regenerate client
cd packages/web
pnpm generate:api

# This creates LabelsService.removeLabelFromIssue() method
```

---

### Phase 2: Frontend Components

#### 2.1 Create LabelBadge Component

**File**: `packages/web/src/components/LabelBadge.tsx`

```typescript
interface LabelBadgeProps {
  name: string;
  onRemove?: () => void;
}

function getLabelColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 80%)`;
}

export function LabelBadge({ name, onRemove }: LabelBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded"
      style={{
        backgroundColor: getLabelColor(name),
        color: '#000',
      }}
    >
      {name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-70"
          aria-label={`Remove ${name} label`}
        >
          ✕
        </button>
      )}
    </span>
  );
}
```

**Test**:
```bash
cd packages/web
pnpm test src/components/LabelBadge.test.tsx
```

#### 2.2 Create useRecentLabels Hook

**File**: `packages/web/src/hooks/useRecentLabels.ts`

See `research.md` for full implementation (FIFO queue with localStorage).

**Key methods**:
- `addRecentLabel(labelId)` - Add label to recent list
- `getRecentLabels(allLabels)` - Get recent label objects

**Test**:
```bash
pnpm test src/hooks/useRecentLabels.test.ts
```

#### 2.3 Create LabelManagementModal Component

**File**: `packages/web/src/components/LabelManagementModal.tsx`

See `research.md` for full implementation.

**Key features**:
- Modal dialog (follows ProjectManagementModal pattern)
- Search/filter labels
- Recent labels section
- Checkbox-based selection
- Optimistic updates with rollback
- Mode toggle: selection ↔ creation

**Test**:
```bash
pnpm test src/components/LabelManagementModal.test.tsx
```

#### 2.4 Create LabelCreationForm Component

**File**: `packages/web/src/components/LabelCreationForm.tsx`

Form for creating new labels (shown when user clicks "Create new label" in modal).

**Validation**:
- Name: required, non-empty
- Description: optional
- Unique name (server-side validation)

#### 2.5 Update ItemDetail Component

**File**: `packages/web/src/components/ItemDetail.tsx`

Add "Manage Labels" button to sidebar:

```typescript
import { LabelManagementModal } from './LabelManagementModal';

export function ItemDetail({ item }: Props) {
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);

  return (
    <div>
      {/* Existing content */}

      {/* Add button in sidebar */}
      <button onClick={() => setIsLabelModalOpen(true)}>
        Manage Labels
      </button>

      {/* Render modal */}
      <LabelManagementModal
        itemId={item.id}
        itemType={item.type}
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        onLabelsChanged={() => refetchItem()}
      />
    </div>
  );
}
```

---

### Phase 3: Testing

#### 3.1 Unit Tests (Vitest)

```bash
# Run all unit tests
cd packages/web
pnpm test

# Run specific test file
pnpm test LabelManagementModal.test.tsx

# Run in watch mode
pnpm test:watch
```

**Test Coverage Targets**:
- LabelBadge: color generation, remove functionality
- useRecentLabels: FIFO queue, localStorage persistence
- LabelManagementModal: search, assignment, optimistic updates
- LabelCreationForm: validation, API errors

#### 3.2 E2E Tests (Playwright)

```bash
# Run E2E tests
cd packages/web
pnpm test:e2e

# Run in UI mode (interactive)
pnpm test:e2e --ui
```

**Test Scenarios**:
- Assign existing label to task
- Create new label and assign
- Remove label from item
- Recent labels appear at top
- Search filters labels correctly

#### 3.3 Manual Testing Checklist

Start test environment:
```bash
# Terminal 1: Start test API server (port 3001)
pnpm server:dev

# Terminal 2: Create test data
pnpm mgtd:test task create -t "Test Task" --no-editor
pnpm mgtd:test label create "bug"
pnpm mgtd:test label create "feature"

# Browser: Open http://localhost:3001
# Navigate to task detail page
# Click "Manage Labels" button
# Test all interactions
```

**Manual Test Checklist**:
- [ ] Modal opens when clicking "Manage Labels"
- [ ] Search filter works correctly
- [ ] Checkboxes toggle label assignments
- [ ] Labels appear immediately after assignment (optimistic update)
- [ ] Error message appears if API call fails
- [ ] "Create new label" button switches to creation form
- [ ] Label creation form validates input
- [ ] Duplicate label name shows error
- [ ] Recent labels section appears after using labels
- [ ] Recent labels persist after browser reload

---

## Development Commands

### Backend (API)

```bash
# Build
cd packages/api
pnpm build

# Run tests
pnpm test

# Start development server (port 3001, test DB)
pnpm dev

# Start production server (port 3000, production DB)
pnpm start

# Regenerate OpenAPI docs
pnpm openapi:generate
```

### Frontend (Web)

```bash
# Build
cd packages/web
pnpm build

# Run development server
pnpm dev

# Run unit tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Regenerate API client (after OpenAPI changes)
pnpm generate:api
```

### Full Stack

```bash
# From project root

# Build all packages
pnpm build

# Start test API server + Web dev server
# Terminal 1:
pnpm server:dev

# Terminal 2:
pnpm dev:web

# Open browser to http://localhost:3001
```

---

## Debugging Tips

### Backend Debugging

```bash
# View API server logs (pino format)
pnpm server:dev

# Test endpoint directly with curl
curl -X GET http://localhost:3001/api/labels

curl -X POST http://localhost:3001/api/labels \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "description": "Test label"}'

curl -X DELETE http://localhost:3001/api/issues/1/labels/1

# Inspect test database
sqlite3 test-data/test.db
> SELECT * FROM labels;
> SELECT * FROM issue_labels;
```

### Frontend Debugging

```typescript
// Add console logs in components
console.log('Modal state:', { allLabels, assignedLabelIds, mode });

// Check localStorage
localStorage.getItem('mgtd:recentLabels');

// Check network requests in DevTools
// Network tab → Filter: "labels"
```

### Common Issues

#### Issue: "Label ID not found"
**Cause**: Mismatch between label names (returned by API) and label IDs (used in state)
**Solution**: Always fetch full label list and map names → IDs

#### Issue: "Cannot read property 'id' of undefined"
**Cause**: Label deleted but still in recent list
**Solution**: Filter recent labels by existence in `allLabels`

#### Issue: Optimistic update stuck after error
**Cause**: Forgot to rollback on error
**Solution**: Check error handling in `handleToggleLabel`

#### Issue: Recent labels not persisting
**Cause**: localStorage quota exceeded or Safari private mode
**Solution**: Check browser console for errors, verify error handling in `useRecentLabels`

---

## Code Review Checklist

Before creating PR, verify:

### Backend
- [ ] `detachLabelFromIssue()` function added to `labelRepository.ts`
- [ ] DELETE endpoint added to `labels.ts` route
- [ ] OpenAPI spec updated with new endpoint
- [ ] Integration tests added and passing
- [ ] Error handling for 404, 400 cases
- [ ] Operation is idempotent (succeeds if label not assigned)

### Frontend
- [ ] LabelBadge component created and tested
- [ ] useRecentLabels hook created and tested
- [ ] LabelManagementModal component created and tested
- [ ] LabelCreationForm component created and tested
- [ ] ItemDetail updated with "Manage Labels" button
- [ ] Optimistic updates with rollback on error
- [ ] Recent labels persist in localStorage
- [ ] Search/filter works correctly
- [ ] E2E tests added and passing

### Accessibility
- [ ] Modal has proper ARIA attributes (role="dialog", aria-modal="true")
- [ ] Checkboxes have aria-checked state
- [ ] Search input has aria-label
- [ ] Keyboard navigation works (Tab, Space, Enter, Esc)
- [ ] Focus management (trap focus in modal)
- [ ] Screen reader announcements for state changes

### Performance
- [ ] useMemo used for filtered lists
- [ ] useCallback used for event handlers passed to children
- [ ] No unnecessary re-renders (React DevTools Profiler)
- [ ] Label color generation memoized

### Documentation
- [ ] Code comments for complex logic
- [ ] JSDoc for public functions
- [ ] README updated if needed
- [ ] Changelog entry added

---

## Next Steps After Implementation

1. **Create PR**: Follow project PR template
2. **Request review**: Tag relevant reviewers
3. **Address feedback**: Iterate on code review comments
4. **Update version**: Follow `docs/versioning.md` SemVer rules
5. **Merge**: Squash and merge to main
6. **Deploy**: Follow deployment process (if applicable)

---

## Useful Resources

### Project Documentation
- Feature spec: `specs/020-web-label-management/spec.md`
- Implementation plan: `specs/020-web-label-management/plan.md`
- Research findings: `specs/020-web-label-management/research.md`
- Data model: `specs/020-web-label-management/data-model.md`
- API contracts: `specs/020-web-label-management/contracts/`

### External Documentation
- [React 19 Documentation](https://react.dev/)
- [TailwindCSS v4 Documentation](https://tailwindcss.com/)
- [Fastify Documentation](https://fastify.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

### Existing Patterns (Reference)
- Modal pattern: `packages/web/src/components/ProjectManagementModal.tsx`
- Recent items hook: `packages/web/src/hooks/useRecentProjects.ts`
- Label display: `packages/web/src/components/ItemDetail.tsx` (lines 122-137)

---

## Questions?

If you encounter issues or have questions:

1. **Check documentation**: Start with `spec.md` and `research.md`
2. **Check existing code**: Look at `ProjectManagementModal.tsx` for similar patterns
3. **Review tests**: Integration tests show expected behavior
4. **Ask for help**: Reach out to project maintainers

---

**Document Version**: 1.0
**Last Updated**: 2025-10-28
**Maintainer**: Feature #020 Implementation Team
