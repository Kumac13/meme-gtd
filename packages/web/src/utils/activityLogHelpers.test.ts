import { describe, it, expect } from 'vitest';
import {
  parseEventType,
  getActivityTitle,
  getActivityDetails,
  getActivityLink,
  filterByCategory,
  getActivityTypeColor,
  type ActivityLogEntry,
  type ActivityCategory,
} from './activityLogHelpers';

// Helper to create a minimal activity log entry with defaults
function createActivity(overrides: Partial<ActivityLogEntry>): ActivityLogEntry {
  return {
    id: 1,
    eventType: 'task.created',
    occurredAt: '2025-01-28T10:00:00Z',
    sourceType: 'api',
    payload: {},
    issueId: null,
    projectId: null,
    labelId: null,
    ...overrides,
  };
}

describe('activityLogHelpers - parseEventType', () => {
  it('parses task.created correctly', () => {
    const result = parseEventType('task.created');
    expect(result).toEqual({ type: 'task', action: 'created' });
  });

  it('parses task.status_changed with underscore to space', () => {
    const result = parseEventType('task.status_changed');
    expect(result).toEqual({ type: 'task', action: 'status changed' });
  });

  it('parses memo.promoted correctly', () => {
    const result = parseEventType('memo.promoted');
    expect(result).toEqual({ type: 'memo', action: 'promoted' });
  });

  it('parses project.item_added correctly', () => {
    const result = parseEventType('project.item_added');
    expect(result).toEqual({ type: 'project', action: 'item added' });
  });

  it('parses label.assigned correctly', () => {
    const result = parseEventType('label.assigned');
    expect(result).toEqual({ type: 'label', action: 'assigned' });
  });

  it('parses link.created correctly', () => {
    const result = parseEventType('link.created');
    expect(result).toEqual({ type: 'link', action: 'created' });
  });

  it('parses comment.created correctly', () => {
    const result = parseEventType('comment.created');
    expect(result).toEqual({ type: 'comment', action: 'created' });
  });
});

describe('activityLogHelpers - getActivityTitle', () => {
  describe('Task Events', () => {
    it('task.created returns payload.title', () => {
      const activity = createActivity({
        eventType: 'task.created',
        payload: { title: 'Fix login bug', status: 'inbox' },
      });
      expect(getActivityTitle(activity)).toBe('Fix login bug');
    });

    it('task.updated returns payload.title or payload.issue_title', () => {
      const activity1 = createActivity({
        eventType: 'task.updated',
        payload: { title: 'Updated task' },
      });
      expect(getActivityTitle(activity1)).toBe('Updated task');

      const activity2 = createActivity({
        eventType: 'task.updated',
        payload: { issue_title: 'Fallback title' },
      });
      expect(getActivityTitle(activity2)).toBe('Fallback title');
    });

    it('task.status_changed returns payload.title', () => {
      const activity = createActivity({
        eventType: 'task.status_changed',
        payload: { title: 'Deploy feature', from_status: 'next', to_status: 'done' },
      });
      expect(getActivityTitle(activity)).toBe('Deploy feature');
    });

    it('task.deleted returns payload.title or payload.issue_title', () => {
      const activity = createActivity({
        eventType: 'task.deleted',
        payload: { title: 'Deleted task' },
      });
      expect(getActivityTitle(activity)).toBe('Deleted task');
    });

    it('task.bookmarked returns payload.title or payload.issue_title', () => {
      const activity = createActivity({
        eventType: 'task.bookmarked',
        payload: { title: 'Bookmarked task', bookmarked: true },
      });
      expect(getActivityTitle(activity)).toBe('Bookmarked task');
    });
  });

  describe('Memo Events', () => {
    it('memo.created returns payload.body_preview (truncated to 100 chars)', () => {
      const shortBody = 'Short memo content';
      const activity1 = createActivity({
        eventType: 'memo.created',
        payload: { body_preview: shortBody },
      });
      expect(getActivityTitle(activity1)).toBe(shortBody);

      const longBody = 'A'.repeat(150);
      const activity2 = createActivity({
        eventType: 'memo.created',
        payload: { body_preview: longBody },
      });
      expect(getActivityTitle(activity2)).toBe('A'.repeat(100) + '...');
    });

    it('memo.updated returns payload.body_preview', () => {
      const activity = createActivity({
        eventType: 'memo.updated',
        payload: { body_preview: 'Updated memo' },
      });
      expect(getActivityTitle(activity)).toBe('Updated memo');
    });

    it('memo.promoted returns payload.promoted_task.title', () => {
      const activity = createActivity({
        eventType: 'memo.promoted',
        payload: { promoted_task: { id: 10, title: 'New task from memo' }, source_memo_id: 5 },
      });
      expect(getActivityTitle(activity)).toBe('New task from memo');
    });

    it('memo.deleted returns payload.body_preview', () => {
      const activity = createActivity({
        eventType: 'memo.deleted',
        payload: { body_preview: 'Deleted memo' },
      });
      expect(getActivityTitle(activity)).toBe('Deleted memo');
    });

    it('memo.bookmarked returns payload.body_preview', () => {
      const activity = createActivity({
        eventType: 'memo.bookmarked',
        payload: { body_preview: 'Bookmarked memo', bookmarked: true },
      });
      expect(getActivityTitle(activity)).toBe('Bookmarked memo');
    });
  });

  describe('Article Events', () => {
    it('article.created returns payload.title', () => {
      const activity = createActivity({
        eventType: 'article.created',
        payload: { title: 'Interesting article', original_url: 'https://example.com/article' },
      });
      expect(getActivityTitle(activity)).toBe('Interesting article');
    });

    it('article.deleted returns payload.title', () => {
      const activity = createActivity({
        eventType: 'article.deleted',
        payload: { title: 'Deleted article' },
      });
      expect(getActivityTitle(activity)).toBe('Deleted article');
    });
  });

  describe('Label Events', () => {
    it('label.created returns payload.label_name', () => {
      const activity = createActivity({
        eventType: 'label.created',
        payload: { label_name: 'urgent' },
      });
      expect(getActivityTitle(activity)).toBe('urgent');
    });

    it('label.deleted returns payload.label_name', () => {
      const activity = createActivity({
        eventType: 'label.deleted',
        payload: { label_name: 'old-label' },
      });
      expect(getActivityTitle(activity)).toBe('old-label');
    });

    it('label.assigned returns "{label_name}" → {issue_title}', () => {
      const activity = createActivity({
        eventType: 'label.assigned',
        payload: { label_name: 'urgent', issue_title: 'Fix login bug' },
      });
      expect(getActivityTitle(activity)).toBe('"urgent" → Fix login bug');
    });

    it('label.removed returns "{label_name}" ← {issue_title}', () => {
      const activity = createActivity({
        eventType: 'label.removed',
        payload: { label_name: 'urgent', issue_title: 'Fix login bug' },
      });
      expect(getActivityTitle(activity)).toBe('"urgent" ← Fix login bug');
    });
  });

  describe('Project Events', () => {
    it('project.created returns payload.project_name', () => {
      const activity = createActivity({
        eventType: 'project.created',
        payload: { project_name: 'Q1 Planning' },
      });
      expect(getActivityTitle(activity)).toBe('Q1 Planning');
    });

    it('project.updated returns payload.project_name', () => {
      const activity = createActivity({
        eventType: 'project.updated',
        payload: { project_name: 'Updated Project' },
      });
      expect(getActivityTitle(activity)).toBe('Updated Project');
    });

    it('project.deleted returns payload.project_name', () => {
      const activity = createActivity({
        eventType: 'project.deleted',
        payload: { project_name: 'Deleted Project' },
      });
      expect(getActivityTitle(activity)).toBe('Deleted Project');
    });

    it('project.item_added returns "{project_name}" ← {issue_title}', () => {
      const activity = createActivity({
        eventType: 'project.item_added',
        payload: { project_name: 'Q1 Planning', issue_title: 'Fix login bug' },
      });
      expect(getActivityTitle(activity)).toBe('"Q1 Planning" ← Fix login bug');
    });

    it('project.item_removed returns "{project_name}" → {issue_title}', () => {
      const activity = createActivity({
        eventType: 'project.item_removed',
        payload: { project_name: 'Q1 Planning', issue_title: 'Fix login bug' },
      });
      expect(getActivityTitle(activity)).toBe('"Q1 Planning" → Fix login bug');
    });
  });

  describe('Link Events', () => {
    it('link.created returns {source_issue_title} ↔ {target_issue_title}', () => {
      const activity = createActivity({
        eventType: 'link.created',
        payload: {
          source_issue_title: 'Task A',
          target_issue_title: 'Task B',
          link_type: 'relates_to',
        },
      });
      expect(getActivityTitle(activity)).toBe('Task A ↔ Task B');
    });

    it('link.deleted returns {source_issue_title} ↔ {target_issue_title}', () => {
      const activity = createActivity({
        eventType: 'link.deleted',
        payload: { source_issue_title: 'Task A', target_issue_title: 'Task B' },
      });
      expect(getActivityTitle(activity)).toBe('Task A ↔ Task B');
    });
  });

  describe('Comment Events', () => {
    it('comment.created returns payload.issue_title', () => {
      const activity = createActivity({
        eventType: 'comment.created',
        payload: { issue_title: 'Fix login bug', body: 'I think we should use a different approach...' },
      });
      expect(getActivityTitle(activity)).toBe('Fix login bug');
    });

    it('comment.updated returns payload.issue_title', () => {
      const activity = createActivity({
        eventType: 'comment.updated',
        payload: { issue_title: 'Fix login bug' },
      });
      expect(getActivityTitle(activity)).toBe('Fix login bug');
    });

    it('comment.deleted returns payload.issue_title', () => {
      const activity = createActivity({
        eventType: 'comment.deleted',
        payload: { issue_title: 'Fix login bug' },
      });
      expect(getActivityTitle(activity)).toBe('Fix login bug');
    });
  });
});

describe('activityLogHelpers - getActivityDetails', () => {
  describe('Task Events', () => {
    it('task.created returns "Status: {status}"', () => {
      const activity = createActivity({
        eventType: 'task.created',
        payload: { title: 'Test', status: 'inbox' },
      });
      expect(getActivityDetails(activity)).toBe('Status: inbox');
    });

    it('task.updated returns null', () => {
      const activity = createActivity({
        eventType: 'task.updated',
        payload: { title: 'Test' },
      });
      expect(getActivityDetails(activity)).toBeNull();
    });

    it('task.status_changed returns "{from_status} → {to_status}"', () => {
      const activity = createActivity({
        eventType: 'task.status_changed',
        payload: { title: 'Test', from_status: 'next', to_status: 'done' },
      });
      expect(getActivityDetails(activity)).toBe('next → done');
    });

    it('task.deleted returns null', () => {
      const activity = createActivity({
        eventType: 'task.deleted',
        payload: { title: 'Test' },
      });
      expect(getActivityDetails(activity)).toBeNull();
    });

    it('task.bookmarked returns "Bookmarked" or "Unbookmarked"', () => {
      const activity1 = createActivity({
        eventType: 'task.bookmarked',
        payload: { title: 'Test', bookmarked: true },
      });
      expect(getActivityDetails(activity1)).toBe('Bookmarked');

      const activity2 = createActivity({
        eventType: 'task.bookmarked',
        payload: { title: 'Test', bookmarked: false },
      });
      expect(getActivityDetails(activity2)).toBe('Unbookmarked');
    });
  });

  describe('Memo Events', () => {
    it('memo.created returns null', () => {
      const activity = createActivity({
        eventType: 'memo.created',
        payload: { body_preview: 'Test' },
      });
      expect(getActivityDetails(activity)).toBeNull();
    });

    it('memo.updated returns null', () => {
      const activity = createActivity({
        eventType: 'memo.updated',
        payload: { body_preview: 'Test' },
      });
      expect(getActivityDetails(activity)).toBeNull();
    });

    it('memo.promoted returns "Promoted from memo #{source_memo_id}"', () => {
      const activity = createActivity({
        eventType: 'memo.promoted',
        payload: { promoted_task: { id: 10, title: 'Task' }, source_memo_id: 5 },
      });
      expect(getActivityDetails(activity)).toBe('Promoted from memo #5');
    });

    it('memo.deleted returns null', () => {
      const activity = createActivity({
        eventType: 'memo.deleted',
        payload: { body_preview: 'Test' },
      });
      expect(getActivityDetails(activity)).toBeNull();
    });

    it('memo.bookmarked returns "Bookmarked" or "Unbookmarked"', () => {
      const activity1 = createActivity({
        eventType: 'memo.bookmarked',
        payload: { body_preview: 'Test', bookmarked: true },
      });
      expect(getActivityDetails(activity1)).toBe('Bookmarked');

      const activity2 = createActivity({
        eventType: 'memo.bookmarked',
        payload: { body_preview: 'Test', bookmarked: false },
      });
      expect(getActivityDetails(activity2)).toBe('Unbookmarked');
    });
  });

  describe('Article Events', () => {
    it('article.created returns domain from original_url', () => {
      const activity = createActivity({
        eventType: 'article.created',
        payload: { title: 'Test', original_url: 'https://example.com/path/to/article' },
      });
      expect(getActivityDetails(activity)).toBe('example.com');
    });

    it('article.created returns null if no original_url', () => {
      const activity = createActivity({
        eventType: 'article.created',
        payload: { title: 'Test' },
      });
      expect(getActivityDetails(activity)).toBeNull();
    });

    it('article.deleted returns null', () => {
      const activity = createActivity({
        eventType: 'article.deleted',
        payload: { title: 'Test' },
      });
      expect(getActivityDetails(activity)).toBeNull();
    });
  });

  describe('Label Events', () => {
    it('label.created returns null', () => {
      const activity = createActivity({
        eventType: 'label.created',
        payload: { label_name: 'urgent' },
      });
      expect(getActivityDetails(activity)).toBeNull();
    });

    it('label.deleted returns null', () => {
      const activity = createActivity({
        eventType: 'label.deleted',
        payload: { label_name: 'old-label' },
      });
      expect(getActivityDetails(activity)).toBeNull();
    });

    it('label.assigned returns null', () => {
      const activity = createActivity({
        eventType: 'label.assigned',
        payload: { label_name: 'urgent', issue_title: 'Task' },
      });
      expect(getActivityDetails(activity)).toBeNull();
    });

    it('label.removed returns null', () => {
      const activity = createActivity({
        eventType: 'label.removed',
        payload: { label_name: 'urgent', issue_title: 'Task' },
      });
      expect(getActivityDetails(activity)).toBeNull();
    });
  });

  describe('Project Events', () => {
    it('project.created returns null', () => {
      const activity = createActivity({
        eventType: 'project.created',
        payload: { project_name: 'Q1 Planning' },
      });
      expect(getActivityDetails(activity)).toBeNull();
    });

    it('project.updated returns null', () => {
      const activity = createActivity({
        eventType: 'project.updated',
        payload: { project_name: 'Updated Project' },
      });
      expect(getActivityDetails(activity)).toBeNull();
    });

    it('project.deleted returns null', () => {
      const activity = createActivity({
        eventType: 'project.deleted',
        payload: { project_name: 'Deleted Project' },
      });
      expect(getActivityDetails(activity)).toBeNull();
    });

    it('project.item_added returns null', () => {
      const activity = createActivity({
        eventType: 'project.item_added',
        payload: { project_name: 'Q1 Planning', issue_title: 'Task' },
      });
      expect(getActivityDetails(activity)).toBeNull();
    });

    it('project.item_removed returns "Removed"', () => {
      const activity = createActivity({
        eventType: 'project.item_removed',
        payload: { project_name: 'Q1 Planning', issue_title: 'Task' },
      });
      expect(getActivityDetails(activity)).toBe('Removed');
    });
  });

  describe('Link Events', () => {
    it('link.created returns {link_type}', () => {
      const activity = createActivity({
        eventType: 'link.created',
        payload: { source_issue_title: 'A', target_issue_title: 'B', link_type: 'relates_to' },
      });
      expect(getActivityDetails(activity)).toBe('relates_to');
    });

    it('link.deleted returns "Link removed"', () => {
      const activity = createActivity({
        eventType: 'link.deleted',
        payload: { source_issue_title: 'A', target_issue_title: 'B' },
      });
      expect(getActivityDetails(activity)).toBe('Link removed');
    });
  });

  describe('Comment Events', () => {
    it('comment.created returns "{body}" (truncated to 50 chars)', () => {
      const activity1 = createActivity({
        eventType: 'comment.created',
        payload: { issue_title: 'Task', body: 'Short comment' },
      });
      expect(getActivityDetails(activity1)).toBe('"Short comment"');

      const longBody = 'A'.repeat(100);
      const activity2 = createActivity({
        eventType: 'comment.created',
        payload: { issue_title: 'Task', body: longBody },
      });
      expect(getActivityDetails(activity2)).toBe('"' + 'A'.repeat(50) + '..."');
    });

    it('comment.updated returns "Comment updated"', () => {
      const activity = createActivity({
        eventType: 'comment.updated',
        payload: { issue_title: 'Task' },
      });
      expect(getActivityDetails(activity)).toBe('Comment updated');
    });

    it('comment.deleted returns "Comment deleted"', () => {
      const activity = createActivity({
        eventType: 'comment.deleted',
        payload: { issue_title: 'Task' },
      });
      expect(getActivityDetails(activity)).toBe('Comment deleted');
    });
  });
});

describe('activityLogHelpers - getActivityLink', () => {
  describe('Task Events', () => {
    it('task.created returns /tasks/{issue_id}', () => {
      const activity = createActivity({
        eventType: 'task.created',
        issueId: 42,
        payload: { title: 'Test' },
      });
      expect(getActivityLink(activity)).toBe('/tasks/42');
    });

    it('task.updated returns /tasks/{issue_id}', () => {
      const activity = createActivity({
        eventType: 'task.updated',
        issueId: 42,
        payload: { title: 'Test' },
      });
      expect(getActivityLink(activity)).toBe('/tasks/42');
    });

    it('task.status_changed returns /tasks/{issue_id}', () => {
      const activity = createActivity({
        eventType: 'task.status_changed',
        issueId: 42,
        payload: { title: 'Test' },
      });
      expect(getActivityLink(activity)).toBe('/tasks/42');
    });

    it('task.deleted returns null', () => {
      const activity = createActivity({
        eventType: 'task.deleted',
        issueId: 42,
        payload: { title: 'Test' },
      });
      expect(getActivityLink(activity)).toBeNull();
    });

    it('task.bookmarked returns /tasks/{issue_id}', () => {
      const activity = createActivity({
        eventType: 'task.bookmarked',
        issueId: 42,
        payload: { title: 'Test' },
      });
      expect(getActivityLink(activity)).toBe('/tasks/42');
    });
  });

  describe('Memo Events', () => {
    it('memo.created returns /memos/{issue_id}', () => {
      const activity = createActivity({
        eventType: 'memo.created',
        issueId: 42,
        payload: { body_preview: 'Test' },
      });
      expect(getActivityLink(activity)).toBe('/memos/42');
    });

    it('memo.updated returns /memos/{issue_id}', () => {
      const activity = createActivity({
        eventType: 'memo.updated',
        issueId: 42,
        payload: { body_preview: 'Test' },
      });
      expect(getActivityLink(activity)).toBe('/memos/42');
    });

    it('memo.promoted returns /tasks/{promoted_task.id}', () => {
      const activity = createActivity({
        eventType: 'memo.promoted',
        issueId: 10,
        payload: { promoted_task: { id: 20, title: 'New task' }, source_memo_id: 10 },
      });
      expect(getActivityLink(activity)).toBe('/tasks/20');
    });

    it('memo.deleted returns null', () => {
      const activity = createActivity({
        eventType: 'memo.deleted',
        issueId: 42,
        payload: { body_preview: 'Test' },
      });
      expect(getActivityLink(activity)).toBeNull();
    });

    it('memo.bookmarked returns /memos/{issue_id}', () => {
      const activity = createActivity({
        eventType: 'memo.bookmarked',
        issueId: 42,
        payload: { body_preview: 'Test' },
      });
      expect(getActivityLink(activity)).toBe('/memos/42');
    });
  });

  describe('Article Events', () => {
    it('article.created returns /articles/{issue_id}', () => {
      const activity = createActivity({
        eventType: 'article.created',
        issueId: 42,
        payload: { title: 'Test' },
      });
      expect(getActivityLink(activity)).toBe('/articles/42');
    });

    it('article.deleted returns null', () => {
      const activity = createActivity({
        eventType: 'article.deleted',
        issueId: 42,
        payload: { title: 'Test' },
      });
      expect(getActivityLink(activity)).toBeNull();
    });
  });

  describe('Label Events', () => {
    it('label.created returns null', () => {
      const activity = createActivity({
        eventType: 'label.created',
        payload: { label_name: 'urgent' },
      });
      expect(getActivityLink(activity)).toBeNull();
    });

    it('label.deleted returns null', () => {
      const activity = createActivity({
        eventType: 'label.deleted',
        payload: { label_name: 'urgent' },
      });
      expect(getActivityLink(activity)).toBeNull();
    });

    it('label.assigned returns /{issue_type}s/{issue_id}', () => {
      const activity1 = createActivity({
        eventType: 'label.assigned',
        issueId: 42,
        payload: { label_name: 'urgent', issue_title: 'Task', issue_type: 'task' },
      });
      expect(getActivityLink(activity1)).toBe('/tasks/42');

      const activity2 = createActivity({
        eventType: 'label.assigned',
        issueId: 42,
        payload: { label_name: 'urgent', issue_title: 'Memo', issue_type: 'memo' },
      });
      expect(getActivityLink(activity2)).toBe('/memos/42');
    });

    it('label.removed returns /{issue_type}s/{issue_id}', () => {
      const activity = createActivity({
        eventType: 'label.removed',
        issueId: 42,
        payload: { label_name: 'urgent', issue_title: 'Task', issue_type: 'task' },
      });
      expect(getActivityLink(activity)).toBe('/tasks/42');
    });
  });

  describe('Project Events', () => {
    it('project.created returns /projects/{project_id}', () => {
      const activity = createActivity({
        eventType: 'project.created',
        projectId: 42,
        payload: { project_name: 'Q1 Planning' },
      });
      expect(getActivityLink(activity)).toBe('/projects/42');
    });

    it('project.updated returns /projects/{project_id}', () => {
      const activity = createActivity({
        eventType: 'project.updated',
        projectId: 42,
        payload: { project_name: 'Updated Project' },
      });
      expect(getActivityLink(activity)).toBe('/projects/42');
    });

    it('project.deleted returns null', () => {
      const activity = createActivity({
        eventType: 'project.deleted',
        projectId: 42,
        payload: { project_name: 'Deleted Project' },
      });
      expect(getActivityLink(activity)).toBeNull();
    });

    it('project.item_added returns /projects/{project_id}', () => {
      const activity = createActivity({
        eventType: 'project.item_added',
        projectId: 42,
        payload: { project_name: 'Q1 Planning', issue_title: 'Task' },
      });
      expect(getActivityLink(activity)).toBe('/projects/42');
    });

    it('project.item_removed returns /projects/{project_id}', () => {
      const activity = createActivity({
        eventType: 'project.item_removed',
        projectId: 42,
        payload: { project_name: 'Q1 Planning', issue_title: 'Task' },
      });
      expect(getActivityLink(activity)).toBe('/projects/42');
    });
  });

  describe('Link Events', () => {
    it('link.created returns /{source_issue_type}s/{source_issue_id}', () => {
      const activity = createActivity({
        eventType: 'link.created',
        payload: {
          source_issue_id: 10,
          source_issue_type: 'task',
          source_issue_title: 'A',
          target_issue_title: 'B',
        },
      });
      expect(getActivityLink(activity)).toBe('/tasks/10');
    });

    it('link.deleted returns null', () => {
      const activity = createActivity({
        eventType: 'link.deleted',
        payload: { source_issue_title: 'A', target_issue_title: 'B' },
      });
      expect(getActivityLink(activity)).toBeNull();
    });
  });

  describe('Comment Events', () => {
    it('comment.created returns /{issue_type}s/{issue_id}', () => {
      const activity = createActivity({
        eventType: 'comment.created',
        issueId: 42,
        payload: { issue_title: 'Task', issue_type: 'task', body: 'Test' },
      });
      expect(getActivityLink(activity)).toBe('/tasks/42');
    });

    it('comment.updated returns /{issue_type}s/{issue_id}', () => {
      const activity = createActivity({
        eventType: 'comment.updated',
        issueId: 42,
        payload: { issue_title: 'Task', issue_type: 'task' },
      });
      expect(getActivityLink(activity)).toBe('/tasks/42');
    });

    it('comment.deleted returns /{issue_type}s/{issue_id}', () => {
      const activity = createActivity({
        eventType: 'comment.deleted',
        issueId: 42,
        payload: { issue_title: 'Memo', issue_type: 'memo' },
      });
      expect(getActivityLink(activity)).toBe('/memos/42');
    });
  });
});

describe('activityLogHelpers - filterByCategory', () => {
  const activities: ActivityLogEntry[] = [
    createActivity({ id: 1, eventType: 'task.created' }),
    createActivity({ id: 2, eventType: 'task.status_changed' }),
    createActivity({ id: 3, eventType: 'memo.created' }),
    createActivity({ id: 4, eventType: 'memo.promoted' }),
    createActivity({ id: 5, eventType: 'project.created' }),
    createActivity({ id: 6, eventType: 'project.item_added' }),
    createActivity({ id: 7, eventType: 'label.created' }),
    createActivity({ id: 8, eventType: 'label.assigned' }),
    createActivity({ id: 9, eventType: 'article.created' }),
    createActivity({ id: 10, eventType: 'link.created' }),
    createActivity({ id: 11, eventType: 'comment.created' }),
  ];

  it('all returns all activities', () => {
    const result = filterByCategory(activities, 'all');
    expect(result.length).toBe(11);
  });

  it('tasks returns only task.* events', () => {
    const result = filterByCategory(activities, 'tasks');
    expect(result.length).toBe(2);
    expect(result.every((a) => a.eventType.startsWith('task.'))).toBe(true);
  });

  it('memos returns only memo.* events', () => {
    const result = filterByCategory(activities, 'memos');
    expect(result.length).toBe(2);
    expect(result.every((a) => a.eventType.startsWith('memo.'))).toBe(true);
  });

  it('projects returns only project.* events', () => {
    const result = filterByCategory(activities, 'projects');
    expect(result.length).toBe(2);
    expect(result.every((a) => a.eventType.startsWith('project.'))).toBe(true);
  });

  it('labels returns only label.* events', () => {
    const result = filterByCategory(activities, 'labels');
    expect(result.length).toBe(2);
    expect(result.every((a) => a.eventType.startsWith('label.'))).toBe(true);
  });

  it('articles returns only article.* events', () => {
    const result = filterByCategory(activities, 'articles');
    expect(result.length).toBe(1);
    expect(result.every((a) => a.eventType.startsWith('article.'))).toBe(true);
  });

  it('links returns only link.* events', () => {
    const result = filterByCategory(activities, 'links');
    expect(result.length).toBe(1);
    expect(result.every((a) => a.eventType.startsWith('link.'))).toBe(true);
  });

  it('comments returns only comment.* events', () => {
    const result = filterByCategory(activities, 'comments');
    expect(result.length).toBe(1);
    expect(result.every((a) => a.eventType.startsWith('comment.'))).toBe(true);
  });
});

describe('activityLogHelpers - getActivityTypeColor', () => {
  it('returns correct colors for each type', () => {
    expect(getActivityTypeColor('task')).toBe('bg-blue-100 text-blue-700');
    expect(getActivityTypeColor('memo')).toBe('bg-yellow-100 text-yellow-700');
    expect(getActivityTypeColor('project')).toBe('bg-purple-100 text-purple-700');
    expect(getActivityTypeColor('label')).toBe('bg-pink-100 text-pink-700');
    expect(getActivityTypeColor('article')).toBe('bg-green-100 text-green-700');
    expect(getActivityTypeColor('link')).toBe('bg-gray-100 text-gray-700');
    expect(getActivityTypeColor('comment')).toBe('bg-orange-100 text-orange-700');
  });

  it('returns default color for unknown type', () => {
    expect(getActivityTypeColor('unknown')).toBe('bg-gray-100 text-gray-700');
  });
});
