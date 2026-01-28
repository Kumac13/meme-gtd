/**
 * Activity Log helpers for Web UI
 */

// Event types from OpenAPI spec
type EventType =
  | 'task.created'
  | 'task.updated'
  | 'task.status_changed'
  | 'task.deleted'
  | 'task.bookmarked'
  | 'memo.created'
  | 'memo.updated'
  | 'memo.promoted'
  | 'memo.deleted'
  | 'memo.bookmarked'
  | 'article.created'
  | 'article.deleted'
  | 'label.created'
  | 'label.deleted'
  | 'label.assigned'
  | 'label.removed'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'project.item_added'
  | 'project.item_removed'
  | 'link.created'
  | 'link.deleted'
  | 'comment.created'
  | 'comment.updated'
  | 'comment.deleted';

export interface ActivityLogEntry {
  id: number;
  eventType: EventType;
  occurredAt: string;
  sourceType: 'cli' | 'api' | 'system';
  payload: Record<string, unknown>;
  issueId: number | null;
  projectId: number | null;
  labelId: number | null;
}

export type ActivityCategory =
  | 'all'
  | 'tasks'
  | 'memos'
  | 'projects'
  | 'labels'
  | 'articles'
  | 'links'
  | 'comments';

type ActivityType =
  | 'task'
  | 'memo'
  | 'project'
  | 'label'
  | 'article'
  | 'link'
  | 'comment';

interface ParsedEventType {
  type: ActivityType;
  action: string;
}

/**
 * Parse event type into type and action
 * Example: 'task.status_changed' -> { type: 'task', action: 'status changed' }
 */
export function parseEventType(eventType: EventType): ParsedEventType {
  const [type, ...actionParts] = eventType.split('.');
  const action = actionParts.join('.').replace(/_/g, ' ');
  return { type: type as ActivityType, action };
}

/**
 * Truncate text to max length, adding ellipsis if truncated
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Get activity title based on event type and payload
 */
export function getActivityTitle(activity: ActivityLogEntry): string {
  const { eventType, payload } = activity;

  switch (eventType) {
    // Task events
    case 'task.created':
    case 'task.status_changed':
      return (payload.title as string) || 'Unknown task';
    case 'task.updated':
    case 'task.deleted':
    case 'task.bookmarked':
      return (payload.title as string) || (payload.issue_title as string) || 'Unknown task';

    // Memo events
    case 'memo.created':
    case 'memo.updated':
    case 'memo.deleted':
    case 'memo.bookmarked':
      return truncate((payload.body_preview as string) || 'Unknown memo', 100);
    case 'memo.promoted': {
      const promotedTask = payload.promoted_task as { id: number; title: string } | undefined;
      return promotedTask?.title || 'Unknown task';
    }

    // Article events
    case 'article.created':
    case 'article.deleted':
      return (payload.title as string) || 'Unknown article';

    // Label events
    case 'label.created':
    case 'label.deleted':
      return (payload.label_name as string) || 'Unknown label';
    case 'label.assigned':
      return `"${payload.label_name}" → ${payload.issue_title}`;
    case 'label.removed':
      return `"${payload.label_name}" ← ${payload.issue_title}`;

    // Project events
    case 'project.created':
    case 'project.updated':
    case 'project.deleted':
      return (payload.project_name as string) || 'Unknown project';
    case 'project.item_added':
      return `"${payload.project_name}" ← ${payload.issue_title}`;
    case 'project.item_removed':
      return `"${payload.project_name}" → ${payload.issue_title}`;

    // Link events
    case 'link.created':
    case 'link.deleted':
      return `${payload.source_issue_title} ↔ ${payload.target_issue_title}`;

    // Comment events
    case 'comment.created':
    case 'comment.updated':
    case 'comment.deleted':
      return (payload.issue_title as string) || 'Unknown item';

    default:
      return 'Unknown activity';
  }
}

/**
 * Get activity details (additional info) based on event type and payload
 */
export function getActivityDetails(activity: ActivityLogEntry): string | null {
  const { eventType, payload } = activity;

  switch (eventType) {
    // Task events
    case 'task.created':
      return `Status: ${payload.status}`;
    case 'task.status_changed':
      return `${payload.from_status} → ${payload.to_status}`;
    case 'task.bookmarked':
      return payload.bookmarked ? 'Bookmarked' : 'Unbookmarked';
    case 'task.updated':
    case 'task.deleted':
      return null;

    // Memo events
    case 'memo.promoted':
      return `Promoted from memo #${payload.source_memo_id}`;
    case 'memo.bookmarked':
      return payload.bookmarked ? 'Bookmarked' : 'Unbookmarked';
    case 'memo.created':
    case 'memo.updated':
    case 'memo.deleted':
      return null;

    // Article events
    case 'article.created': {
      const url = payload.original_url as string | undefined;
      if (!url) return null;
      try {
        return new URL(url).hostname;
      } catch {
        return null;
      }
    }
    case 'article.deleted':
      return null;

    // Label events
    case 'label.created':
    case 'label.deleted':
    case 'label.assigned':
    case 'label.removed':
      return null;

    // Project events
    case 'project.created':
    case 'project.updated':
    case 'project.deleted':
    case 'project.item_added':
      return null;
    case 'project.item_removed':
      return 'Removed';

    // Link events
    case 'link.created':
      return payload.link_type as string;
    case 'link.deleted':
      return 'Link removed';

    // Comment events
    case 'comment.created': {
      const body = payload.body as string | undefined;
      if (!body) return null;
      const truncated = truncate(body, 50);
      return `"${truncated}"`;
    }
    case 'comment.updated':
      return 'Comment updated';
    case 'comment.deleted':
      return 'Comment deleted';

    default:
      return null;
  }
}

/**
 * Get navigation link for an activity (returns null for deleted items)
 */
export function getActivityLink(activity: ActivityLogEntry): string | null {
  const { eventType, payload, issueId, projectId } = activity;

  switch (eventType) {
    // Task events
    case 'task.created':
    case 'task.updated':
    case 'task.status_changed':
    case 'task.bookmarked':
      return issueId ? `/tasks/${issueId}` : null;
    case 'task.deleted':
      return null;

    // Memo events
    case 'memo.created':
    case 'memo.updated':
    case 'memo.bookmarked':
      return issueId ? `/memos/${issueId}` : null;
    case 'memo.promoted': {
      const promotedTask = payload.promoted_task as { id: number; title: string } | undefined;
      return promotedTask?.id ? `/tasks/${promotedTask.id}` : null;
    }
    case 'memo.deleted':
      return null;

    // Article events
    case 'article.created':
      return issueId ? `/articles/${issueId}` : null;
    case 'article.deleted':
      return null;

    // Label events
    case 'label.created':
    case 'label.deleted':
      return null;
    case 'label.assigned':
    case 'label.removed': {
      const issueType = payload.issue_type as 'task' | 'memo' | undefined;
      if (!issueType || !issueId) return null;
      return `/${issueType}s/${issueId}`;
    }

    // Project events
    case 'project.created':
    case 'project.updated':
    case 'project.item_added':
    case 'project.item_removed':
      return projectId ? `/projects/${projectId}` : null;
    case 'project.deleted':
      return null;

    // Link events
    case 'link.created': {
      const sourceIssueType = payload.source_issue_type as 'task' | 'memo' | undefined;
      const sourceIssueId = payload.source_issue_id as number | undefined;
      if (!sourceIssueType || !sourceIssueId) return null;
      return `/${sourceIssueType}s/${sourceIssueId}`;
    }
    case 'link.deleted':
      return null;

    // Comment events
    case 'comment.created':
    case 'comment.updated':
    case 'comment.deleted': {
      const issueType = payload.issue_type as 'task' | 'memo' | undefined;
      if (!issueType || !issueId) return null;
      return `/${issueType}s/${issueId}`;
    }

    default:
      return null;
  }
}

/**
 * Filter activities by category
 */
export function filterByCategory(
  activities: ActivityLogEntry[],
  category: ActivityCategory
): ActivityLogEntry[] {
  if (category === 'all') return activities;

  const prefixMap: Record<Exclude<ActivityCategory, 'all'>, string> = {
    tasks: 'task.',
    memos: 'memo.',
    projects: 'project.',
    labels: 'label.',
    articles: 'article.',
    links: 'link.',
    comments: 'comment.',
  };

  const prefix = prefixMap[category];
  return activities.filter((a) => a.eventType.startsWith(prefix));
}

/**
 * Get badge color classes for activity type
 */
export function getActivityTypeColor(type: string): string {
  const colorMap: Record<ActivityType, string> = {
    task: 'bg-blue-100 text-blue-700',
    memo: 'bg-yellow-100 text-yellow-700',
    project: 'bg-purple-100 text-purple-700',
    label: 'bg-pink-100 text-pink-700',
    article: 'bg-green-100 text-green-700',
    link: 'bg-gray-100 text-gray-700',
    comment: 'bg-orange-100 text-orange-700',
  };

  return colorMap[type as ActivityType] || 'bg-gray-100 text-gray-700';
}
