import { describe, it, expect } from 'vitest';
import {
  parseEventType,
  getActivityTitle,
  getActivityDetails,
  getActivityLink,
  getActivityIssueId,
  filterByCategory,
  getActivityTypeColor,
  isPrimaryEntity,
  getLinkDescription,
  getCommentHeadline,
  getCommentBody,
  getLabelHeadline,
  getProjectHeadline,
  getPrimaryEntityTitle,
  type ActivityLogEntry,
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
    it('memo.created returns first line of payload.body (truncated to 50 chars)', () => {
      const shortBody = 'Short memo content';
      const activity1 = createActivity({
        eventType: 'memo.created',
        payload: { body: shortBody },
      });
      expect(getActivityTitle(activity1)).toBe(shortBody);

      const longBody = 'A'.repeat(80);
      const activity2 = createActivity({
        eventType: 'memo.created',
        payload: { body: longBody },
      });
      expect(getActivityTitle(activity2)).toBe('A'.repeat(50) + '...');
    });

    it('memo.created uses first line only for multiline body', () => {
      const multilineBody = 'First line content\nSecond line\nThird line';
      const activity = createActivity({
        eventType: 'memo.created',
        payload: { body: multilineBody },
      });
      expect(getActivityTitle(activity)).toBe('First line content');
    });

    it('memo.created falls back to body_preview when body is missing', () => {
      const activity = createActivity({
        eventType: 'memo.created',
        payload: { body_preview: 'Fallback preview' },
      });
      expect(getActivityTitle(activity)).toBe('Fallback preview');
    });

    it('memo.created prefers body over body_preview', () => {
      const activity = createActivity({
        eventType: 'memo.created',
        payload: { body: 'Full body', body_preview: 'Preview' },
      });
      expect(getActivityTitle(activity)).toBe('Full body');
    });

    it('memo.created returns Unknown memo when body is not a string', () => {
      const activity = createActivity({
        eventType: 'memo.created',
        payload: { body: { text: 'nested' } },
      });
      expect(getActivityTitle(activity)).toBe('Unknown memo');
    });

    it('memo.created returns Unknown memo when body is array', () => {
      const activity = createActivity({
        eventType: 'memo.created',
        payload: { body: ['item1', 'item2'] },
      });
      expect(getActivityTitle(activity)).toBe('Unknown memo');
    });

    it('memo.updated returns first line of payload.body', () => {
      const activity = createActivity({
        eventType: 'memo.updated',
        payload: { body: 'Updated memo' },
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

    it('memo.deleted returns first line of payload.body', () => {
      const activity = createActivity({
        eventType: 'memo.deleted',
        payload: { body: 'Deleted memo' },
      });
      expect(getActivityTitle(activity)).toBe('Deleted memo');
    });

    it('memo.bookmarked returns first line of payload.body', () => {
      const activity = createActivity({
        eventType: 'memo.bookmarked',
        payload: { body: 'Bookmarked memo', bookmarked: true },
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

    it('link.created falls back to Type #ID format when target title is null', () => {
      const activity = createActivity({
        eventType: 'link.created',
        payload: {
          source_issue_title: 'Task A',
          source_issue_type: 'task',
          source_issue_id: 14,
          target_issue_title: null,
          target_issue_type: 'memo',
          target_issue_id: 15,
          link_type: 'relates_to',
        },
      });
      expect(getActivityTitle(activity)).toBe('Task A ↔ Memo #15');
    });

    it('link.created falls back to Type #ID format for both when titles are null', () => {
      const activity = createActivity({
        eventType: 'link.created',
        payload: {
          source_issue_title: null,
          source_issue_type: 'task',
          source_issue_id: 14,
          target_issue_title: null,
          target_issue_type: 'memo',
          target_issue_id: 15,
          link_type: 'relates_to',
        },
      });
      expect(getActivityTitle(activity)).toBe('Task #14 ↔ Memo #15');
    });

    it('link.deleted returns {source_issue_title} ↔ {target_issue_title}', () => {
      const activity = createActivity({
        eventType: 'link.deleted',
        payload: { source_issue_title: 'Task A', target_issue_title: 'Task B' },
      });
      expect(getActivityTitle(activity)).toBe('Task A ↔ Task B');
    });

    it('link.deleted falls back to Type #ID format when titles are null', () => {
      const activity = createActivity({
        eventType: 'link.deleted',
        payload: {
          source_issue_title: null,
          source_issue_type: 'task',
          source_issue_id: 10,
          target_issue_title: null,
          target_issue_type: 'memo',
          target_issue_id: 20,
        },
      });
      expect(getActivityTitle(activity)).toBe('Task #10 ↔ Memo #20');
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

    it('comment.created returns null when body is not a string', () => {
      const activity = createActivity({
        eventType: 'comment.created',
        payload: { issue_title: 'Task', body: { text: 'nested' } },
      });
      expect(getActivityDetails(activity)).toBeNull();
    });

    it('comment.created returns null when body is array', () => {
      const activity = createActivity({
        eventType: 'comment.created',
        payload: { issue_title: 'Task', body: ['item1', 'item2'] },
      });
      expect(getActivityDetails(activity)).toBeNull();
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

describe('activityLogHelpers - getActivityIssueId', () => {
  describe('Task Events', () => {
    it('task.created returns issueId', () => {
      const activity = createActivity({
        eventType: 'task.created',
        issueId: 42,
        payload: { title: 'Test' },
      });
      expect(getActivityIssueId(activity)).toBe(42);
    });

    it('task.created falls back to payload.issue_id', () => {
      const activity = createActivity({
        eventType: 'task.created',
        issueId: null,
        payload: { title: 'Test', issue_id: 99 },
      });
      expect(getActivityIssueId(activity)).toBe(99);
    });
  });

  describe('Memo Events', () => {
    it('memo.created returns issueId', () => {
      const activity = createActivity({
        eventType: 'memo.created',
        issueId: 42,
        payload: { body: 'Test' },
      });
      expect(getActivityIssueId(activity)).toBe(42);
    });

    it('memo.promoted returns promoted_task.id', () => {
      const activity = createActivity({
        eventType: 'memo.promoted',
        issueId: 10,
        payload: { promoted_task: { id: 20, title: 'New task' }, source_memo_id: 10 },
      });
      expect(getActivityIssueId(activity)).toBe(20);
    });
  });

  describe('Project Events', () => {
    it('project.created returns projectId', () => {
      const activity = createActivity({
        eventType: 'project.created',
        projectId: 42,
        payload: { project_name: 'Test' },
      });
      expect(getActivityIssueId(activity)).toBe(42);
    });
  });

  describe('Label Events', () => {
    it('label.created returns labelId', () => {
      const activity = createActivity({
        eventType: 'label.created',
        labelId: 42,
        payload: { label_name: 'urgent' },
      });
      expect(getActivityIssueId(activity)).toBe(42);
    });

    it('label.assigned returns issueId (target issue)', () => {
      const activity = createActivity({
        eventType: 'label.assigned',
        issueId: 42,
        labelId: 10,
        payload: { label_name: 'urgent', issue_title: 'Task' },
      });
      expect(getActivityIssueId(activity)).toBe(42);
    });
  });

  describe('Link Events', () => {
    it('link.created returns source_issue_id', () => {
      const activity = createActivity({
        eventType: 'link.created',
        payload: {
          source_issue_id: 10,
          source_issue_type: 'task',
          target_issue_id: 20,
          target_issue_type: 'memo',
        },
      });
      expect(getActivityIssueId(activity)).toBe(10);
    });
  });

  describe('Comment Events', () => {
    it('comment.created returns issueId', () => {
      const activity = createActivity({
        eventType: 'comment.created',
        issueId: 42,
        payload: { issue_title: 'Task', body: 'Test' },
      });
      expect(getActivityIssueId(activity)).toBe(42);
    });
  });

  describe('Article Events', () => {
    it('article.created returns issueId', () => {
      const activity = createActivity({
        eventType: 'article.created',
        issueId: 42,
        payload: { title: 'Test' },
      });
      expect(getActivityIssueId(activity)).toBe(42);
    });
  });
});

describe('activityLogHelpers - isPrimaryEntity', () => {
  it('returns true for task', () => {
    expect(isPrimaryEntity('task')).toBe(true);
  });

  it('returns true for memo', () => {
    expect(isPrimaryEntity('memo')).toBe(true);
  });

  it('returns true for article', () => {
    expect(isPrimaryEntity('article')).toBe(true);
  });

  it('returns false for link', () => {
    expect(isPrimaryEntity('link')).toBe(false);
  });

  it('returns false for comment', () => {
    expect(isPrimaryEntity('comment')).toBe(false);
  });

  it('returns false for label', () => {
    expect(isPrimaryEntity('label')).toBe(false);
  });

  it('returns false for project', () => {
    expect(isPrimaryEntity('project')).toBe(false);
  });
});

describe('activityLogHelpers - getLinkDescription', () => {
  it('returns "#sourceId to #targetId (linkType)" format', () => {
    const activity = createActivity({
      eventType: 'link.created',
      payload: {
        source_issue_id: 14,
        target_issue_id: 15,
        link_type: 'relates_to',
      },
    });
    expect(getLinkDescription(activity)).toBe('#14 to #15 (relates_to)');
  });

  it('handles missing link type', () => {
    const activity = createActivity({
      eventType: 'link.created',
      payload: {
        source_issue_id: 14,
        target_issue_id: 15,
      },
    });
    expect(getLinkDescription(activity)).toBe('#14 to #15');
  });

  it('handles missing source ID', () => {
    const activity = createActivity({
      eventType: 'link.created',
      payload: {
        target_issue_id: 15,
        link_type: 'blocks',
      },
    });
    expect(getLinkDescription(activity)).toBe('to #15 (blocks)');
  });
});

describe('activityLogHelpers - getCommentHeadline', () => {
  it('returns "comment on #issueId" format', () => {
    const activity = createActivity({
      eventType: 'comment.created',
      issueId: 42,
      payload: { issue_title: 'Test', body: 'Hello' },
    });
    expect(getCommentHeadline(activity)).toBe('comment on #42');
  });

  it('returns "comment" when issueId is null', () => {
    const activity = createActivity({
      eventType: 'comment.created',
      issueId: null,
      payload: { body: 'Hello' },
    });
    expect(getCommentHeadline(activity)).toBe('comment');
  });
});

describe('activityLogHelpers - getCommentBody', () => {
  it('returns quoted body', () => {
    const activity = createActivity({
      eventType: 'comment.created',
      issueId: 42,
      payload: { body: 'Short comment' },
    });
    expect(getCommentBody(activity)).toBe('"Short comment"');
  });

  it('truncates long body to 50 chars', () => {
    const longBody = 'A'.repeat(100);
    const activity = createActivity({
      eventType: 'comment.created',
      issueId: 42,
      payload: { body: longBody },
    });
    expect(getCommentBody(activity)).toBe('"' + 'A'.repeat(50) + '..."');
  });

  it('returns null when body is missing', () => {
    const activity = createActivity({
      eventType: 'comment.created',
      issueId: 42,
      payload: {},
    });
    expect(getCommentBody(activity)).toBeNull();
  });

  it('returns null when body is not a string (object)', () => {
    const activity = createActivity({
      eventType: 'comment.created',
      issueId: 42,
      payload: { body: { text: 'nested' } },
    });
    expect(getCommentBody(activity)).toBeNull();
  });

  it('returns null when body is not a string (array)', () => {
    const activity = createActivity({
      eventType: 'comment.created',
      issueId: 42,
      payload: { body: ['item1', 'item2'] },
    });
    expect(getCommentBody(activity)).toBeNull();
  });

  it('returns null when body is not a string (number)', () => {
    const activity = createActivity({
      eventType: 'comment.created',
      issueId: 42,
      payload: { body: 12345 },
    });
    expect(getCommentBody(activity)).toBeNull();
  });
});

describe('activityLogHelpers - getLabelHeadline', () => {
  it('label.assigned returns \'label "name" on #issueId\'', () => {
    const activity = createActivity({
      eventType: 'label.assigned',
      issueId: 42,
      payload: { label_name: 'urgent', issue_title: 'Test' },
    });
    expect(getLabelHeadline(activity)).toBe('label "urgent" on #42');
  });

  it('label.removed returns \'label "name" from #issueId\'', () => {
    const activity = createActivity({
      eventType: 'label.removed',
      issueId: 42,
      payload: { label_name: 'urgent', issue_title: 'Test' },
    });
    expect(getLabelHeadline(activity)).toBe('label "urgent" from #42');
  });

  it('label.created returns \'label "name" created\'', () => {
    const activity = createActivity({
      eventType: 'label.created',
      labelId: 10,
      payload: { label_name: 'urgent' },
    });
    expect(getLabelHeadline(activity)).toBe('label "urgent" created');
  });

  it('label.deleted returns \'label "name" deleted\'', () => {
    const activity = createActivity({
      eventType: 'label.deleted',
      labelId: 10,
      payload: { label_name: 'old-label' },
    });
    expect(getLabelHeadline(activity)).toBe('label "old-label" deleted');
  });
});

describe('activityLogHelpers - getProjectHeadline', () => {
  it('project.item_added returns \'project "name" <- #issueId\'', () => {
    const activity = createActivity({
      eventType: 'project.item_added',
      projectId: 10,
      payload: { project_name: 'Q1 Planning', issue_id: 42, issue_title: 'Test' },
    });
    expect(getProjectHeadline(activity)).toBe('project "Q1 Planning" \u2190 #42');
  });

  it('project.item_removed returns \'project "name" -> #issueId\'', () => {
    const activity = createActivity({
      eventType: 'project.item_removed',
      projectId: 10,
      payload: { project_name: 'Q1 Planning', issue_id: 42, issue_title: 'Test' },
    });
    expect(getProjectHeadline(activity)).toBe('project "Q1 Planning" \u2192 #42');
  });

  it('project.created returns \'project "name" created\'', () => {
    const activity = createActivity({
      eventType: 'project.created',
      projectId: 10,
      payload: { project_name: 'Q1 Planning' },
    });
    expect(getProjectHeadline(activity)).toBe('project "Q1 Planning" created');
  });

  it('project.updated returns \'project "name" updated\'', () => {
    const activity = createActivity({
      eventType: 'project.updated',
      projectId: 10,
      payload: { project_name: 'Q1 Planning' },
    });
    expect(getProjectHeadline(activity)).toBe('project "Q1 Planning" updated');
  });

  it('project.deleted returns \'project "name" deleted\'', () => {
    const activity = createActivity({
      eventType: 'project.deleted',
      projectId: 10,
      payload: { project_name: 'Q1 Planning' },
    });
    expect(getProjectHeadline(activity)).toBe('project "Q1 Planning" deleted');
  });
});

describe('activityLogHelpers - getPrimaryEntityTitle', () => {
  describe('Task Events', () => {
    it('task.created returns title', () => {
      const activity = createActivity({
        eventType: 'task.created',
        payload: { title: 'Fix login bug', status: 'inbox' },
      });
      expect(getPrimaryEntityTitle(activity)).toBe('Fix login bug');
    });

    it('task.updated falls back to issue_title', () => {
      const activity = createActivity({
        eventType: 'task.updated',
        payload: { issue_title: 'Fallback title' },
      });
      expect(getPrimaryEntityTitle(activity)).toBe('Fallback title');
    });

    it('returns null when no title available', () => {
      const activity = createActivity({
        eventType: 'task.created',
        payload: { status: 'inbox' },
      });
      expect(getPrimaryEntityTitle(activity)).toBeNull();
    });
  });

  describe('Memo Events', () => {
    it('memo.created returns first line of body (truncated to 40 chars)', () => {
      const activity = createActivity({
        eventType: 'memo.created',
        payload: { body: 'Short memo content' },
      });
      expect(getPrimaryEntityTitle(activity)).toBe('Short memo content');
    });

    it('memo.created truncates long body', () => {
      const longBody = 'A'.repeat(60);
      const activity = createActivity({
        eventType: 'memo.created',
        payload: { body: longBody },
      });
      expect(getPrimaryEntityTitle(activity)).toBe('A'.repeat(40) + '...');
    });

    it('memo.promoted returns promoted_task.title', () => {
      const activity = createActivity({
        eventType: 'memo.promoted',
        payload: { promoted_task: { id: 10, title: 'New task from memo' }, source_memo_id: 5 },
      });
      expect(getPrimaryEntityTitle(activity)).toBe('New task from memo');
    });

    it('returns null when no body available', () => {
      const activity = createActivity({
        eventType: 'memo.created',
        payload: {},
      });
      expect(getPrimaryEntityTitle(activity)).toBeNull();
    });

    it('returns null when body is not a string (object)', () => {
      const activity = createActivity({
        eventType: 'memo.created',
        payload: { body: { text: 'nested' } },
      });
      expect(getPrimaryEntityTitle(activity)).toBeNull();
    });

    it('returns null when body is not a string (array)', () => {
      const activity = createActivity({
        eventType: 'memo.created',
        payload: { body: ['item1', 'item2'] },
      });
      expect(getPrimaryEntityTitle(activity)).toBeNull();
    });
  });

  describe('Article Events', () => {
    it('article.created returns title', () => {
      const activity = createActivity({
        eventType: 'article.created',
        payload: { title: 'Interesting article' },
      });
      expect(getPrimaryEntityTitle(activity)).toBe('Interesting article');
    });

    it('returns null when no title available', () => {
      const activity = createActivity({
        eventType: 'article.created',
        payload: {},
      });
      expect(getPrimaryEntityTitle(activity)).toBeNull();
    });
  });

  describe('Non-primary entity types', () => {
    it('returns null for link events', () => {
      const activity = createActivity({
        eventType: 'link.created',
        payload: { source_issue_title: 'A', target_issue_title: 'B' },
      });
      expect(getPrimaryEntityTitle(activity)).toBeNull();
    });

    it('returns null for comment events', () => {
      const activity = createActivity({
        eventType: 'comment.created',
        payload: { issue_title: 'Test', body: 'Hello' },
      });
      expect(getPrimaryEntityTitle(activity)).toBeNull();
    });
  });
});
