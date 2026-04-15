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
  | 'comment.deleted'
  | 'search.exported';

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

// Primary entities: Task, Memo, Article (shown as badge)
// Secondary entities: Link, Comment, Label, Project (shown as simple text)
type PrimaryEntityType = 'task' | 'memo' | 'article';

interface ParsedEventType {
  type: ActivityType;
  action: string;
}

/**
 * Check if an activity type is a primary entity (Task/Memo/Article)
 * Primary entities are shown as badge format: [#ID Type]
 */
export function isPrimaryEntity(type: ActivityType): type is PrimaryEntityType {
  return type === 'task' || type === 'memo' || type === 'article';
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
 * Safely extract string value from payload field
 * Handles cases where field might be:
 * - A direct string value
 * - An object with { old, new } structure (from update events)
 * - null/undefined
 */
function extractString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Handle { old, new } structure - prefer 'new' value
    if ('new' in obj && typeof obj.new === 'string') {
      return obj.new;
    }
    if ('old' in obj && typeof obj.old === 'string') {
      return obj.old;
    }
  }
  return null;
}

/**
 * Get first line of text, then truncate to maxLength
 */
function getFirstLineTruncated(text: string, maxLength: number): string {
  const firstLine = text.split('\n')[0].trim();
  return truncate(firstLine, maxLength);
}

/**
 * Format issue ID fallback when title is not available
 * Example: formatIssueIdFallback('task', 14) -> 'Task #14'
 * Example: formatIssueIdFallback('memo', 15) -> 'Memo #15'
 */
function formatIssueIdFallback(issueType: string | null | undefined, issueId: number | undefined): string {
  if (!issueType || !issueId) return 'Unknown';
  const capitalized = issueType.charAt(0).toUpperCase() + issueType.slice(1);
  return `${capitalized} #${issueId}`;
}

/**
 * Get issue ID from activity (for display as #ID)
 */
export function getActivityIssueId(activity: ActivityLogEntry): number | null {
  const { eventType, payload, issueId, projectId, labelId } = activity;

  // Task events
  if (eventType.startsWith('task.')) {
    return issueId ?? (payload.issue_id as number | undefined) ?? null;
  }

  // Memo events
  if (eventType.startsWith('memo.')) {
    if (eventType === 'memo.promoted') {
      const promotedTask = payload.promoted_task as { id: number } | undefined;
      return promotedTask?.id ?? null;
    }
    return issueId ?? (payload.issue_id as number | undefined) ?? null;
  }

  // Article events
  if (eventType.startsWith('article.')) {
    return issueId ?? (payload.issue_id as number | undefined) ?? null;
  }

  // Project events
  if (eventType.startsWith('project.')) {
    return projectId ?? (payload.project_id as number | undefined) ?? null;
  }

  // Label events
  if (eventType.startsWith('label.')) {
    if (eventType === 'label.assigned' || eventType === 'label.removed') {
      return issueId ?? (payload.issue_id as number | undefined) ?? null;
    }
    return labelId ?? (payload.label_id as number | undefined) ?? null;
  }

  // Link events - return source issue ID
  if (eventType.startsWith('link.')) {
    return (payload.source_issue_id as number | undefined) ?? null;
  }

  // Comment events
  if (eventType.startsWith('comment.')) {
    return issueId ?? (payload.issue_id as number | undefined) ?? null;
  }

  return null;
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
      return extractString(payload.title) || 'Unknown task';
    case 'task.updated':
    case 'task.deleted':
    case 'task.bookmarked':
      return extractString(payload.title) || extractString(payload.issue_title) || 'Unknown task';

    // Memo events
    case 'memo.created':
    case 'memo.updated':
    case 'memo.deleted':
    case 'memo.bookmarked': {
      const memoBody = extractString(payload.body) || extractString(payload.body_preview);
      if (!memoBody) return 'Unknown memo';
      return getFirstLineTruncated(memoBody, 50);
    }
    case 'memo.promoted': {
      const promotedTask = payload.promoted_task as { id: number; title: string } | undefined;
      return promotedTask?.title || 'Unknown task';
    }

    // Article events
    case 'article.created':
    case 'article.deleted':
      return extractString(payload.title) || 'Unknown article';

    // Label events
    case 'label.created':
    case 'label.deleted':
      return extractString(payload.label_name) || 'Unknown label';
    case 'label.assigned':
      return `"${extractString(payload.label_name) || 'label'}" → ${extractString(payload.issue_title) || 'item'}`;
    case 'label.removed':
      return `"${extractString(payload.label_name) || 'label'}" ← ${extractString(payload.issue_title) || 'item'}`;

    // Project events
    case 'project.created':
    case 'project.deleted':
      return extractString(payload.project_name) || 'Unknown project';
    case 'project.updated':
      // project.updated uses 'name' field (not 'project_name')
      return extractString(payload.name) || extractString(payload.project_name) || 'Unknown project';
    case 'project.item_added':
      return `"${extractString(payload.project_name) || 'project'}" ← ${extractString(payload.issue_title) || 'item'}`;
    case 'project.item_removed':
      return `"${extractString(payload.project_name) || 'project'}" → ${extractString(payload.issue_title) || 'item'}`;

    // Link events
    case 'link.created':
    case 'link.deleted': {
      const sourceTitle =
        extractString(payload.source_issue_title) ||
        formatIssueIdFallback(extractString(payload.source_issue_type), payload.source_issue_id as number);
      const targetTitle =
        extractString(payload.target_issue_title) ||
        formatIssueIdFallback(extractString(payload.target_issue_type), payload.target_issue_id as number);
      return `${sourceTitle} ↔ ${targetTitle}`;
    }

    // Comment events
    case 'comment.created':
    case 'comment.updated':
    case 'comment.deleted':
      return extractString(payload.issue_title) || 'Unknown item';

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
      return `Status: ${extractString(payload.status) || 'unknown'}`;
    case 'task.status_changed':
      return `${extractString(payload.from_status) || '?'} → ${extractString(payload.to_status) || '?'}`;
    case 'task.bookmarked':
      // Backend uses 'is_bookmarked', support both for compatibility
      return (payload.is_bookmarked ?? payload.bookmarked) ? 'Bookmarked' : 'Unbookmarked';
    case 'task.updated':
    case 'task.deleted':
      return null;

    // Memo events
    case 'memo.promoted':
      return `Promoted from memo #${payload.source_memo_id}`;
    case 'memo.bookmarked':
      // Backend uses 'is_bookmarked', support both for compatibility
      return (payload.is_bookmarked ?? payload.bookmarked) ? 'Bookmarked' : 'Unbookmarked';
    case 'memo.created':
    case 'memo.updated':
    case 'memo.deleted':
      return null;

    // Article events
    case 'article.created': {
      const url = extractString(payload.original_url);
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
      return extractString(payload.link_type);
    case 'link.deleted':
      return 'Link removed';

    // Comment events
    case 'comment.created': {
      const body = extractString(payload.body);
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

/**
 * Get link description for display
 * Example: "#14 to #15 (relates_to)"
 */
export function getLinkDescription(activity: ActivityLogEntry): string {
  const { payload } = activity;
  const sourceId = payload.source_issue_id as number | undefined;
  const targetId = payload.target_issue_id as number | undefined;
  const linkType = payload.link_type as string | undefined;

  const parts: string[] = [];
  if (sourceId) parts.push(`#${sourceId}`);
  parts.push('to');
  if (targetId) parts.push(`#${targetId}`);
  if (linkType) parts.push(`(${linkType})`);

  return parts.join(' ');
}

/**
 * Get comment headline for display
 * Example: "comment on #14"
 */
export function getCommentHeadline(activity: ActivityLogEntry): string {
  const issueId = getActivityIssueId(activity);
  return issueId ? `comment on #${issueId}` : 'comment';
}

/**
 * Get comment body for display (truncated, quoted)
 * Example: '"Hello world..."'
 */
export function getCommentBody(activity: ActivityLogEntry): string | null {
  const body = activity.payload.body;
  if (!body || typeof body !== 'string') return null;
  return `"${truncate(body, 50)}"`;
}

/**
 * Get label headline for display
 * Example: 'label "urgent" on #14'
 */
export function getLabelHeadline(activity: ActivityLogEntry): string {
  const { eventType, payload } = activity;
  const labelName = extractString(payload.label_name) || 'unknown';
  const issueId = getActivityIssueId(activity);

  switch (eventType) {
    case 'label.assigned':
      return issueId ? `label "${labelName}" on #${issueId}` : `label "${labelName}" assigned`;
    case 'label.removed':
      return issueId ? `label "${labelName}" from #${issueId}` : `label "${labelName}" removed`;
    case 'label.created':
      return `label "${labelName}" created`;
    case 'label.deleted':
      return `label "${labelName}" deleted`;
    default:
      return `label "${labelName}"`;
  }
}

/**
 * Get project headline for display
 * Example: 'project "Q1" ← #14'
 */
export function getProjectHeadline(activity: ActivityLogEntry): string {
  const { eventType, payload } = activity;
  // project.updated uses 'name' field, others use 'project_name'
  const projectName = eventType === 'project.updated'
    ? (extractString(payload.name) || extractString(payload.project_name) || 'unknown')
    : (extractString(payload.project_name) || 'unknown');
  const issueId = payload.issue_id as number | undefined;

  switch (eventType) {
    case 'project.item_added':
      return issueId
        ? `project "${projectName}" \u2190 #${issueId}`
        : `project "${projectName}" item added`;
    case 'project.item_removed':
      return issueId
        ? `project "${projectName}" \u2192 #${issueId}`
        : `project "${projectName}" item removed`;
    case 'project.created':
      return `project "${projectName}" created`;
    case 'project.updated':
      return `project "${projectName}" updated`;
    case 'project.deleted':
      return `project "${projectName}" deleted`;
    default:
      return `project "${projectName}"`;
  }
}

/**
 * Get primary entity title (body/title for badge display)
 * For Task: title
 * For Memo: first line of body (truncated)
 * For Article: title
 */
export function getPrimaryEntityTitle(activity: ActivityLogEntry): string | null {
  const { eventType, payload } = activity;

  // Task events
  if (eventType.startsWith('task.')) {
    return extractString(payload.title) || extractString(payload.issue_title) || null;
  }

  // Memo events
  if (eventType.startsWith('memo.')) {
    if (eventType === 'memo.promoted') {
      const promotedTask = payload.promoted_task as { id: number; title: string } | undefined;
      return promotedTask?.title || null;
    }
    const memoBody = extractString(payload.body) || extractString(payload.body_preview);
    if (!memoBody) return null;
    return getFirstLineTruncated(memoBody, 40);
  }

  // Article events
  if (eventType.startsWith('article.')) {
    return extractString(payload.title) || null;
  }

  return null;
}

// ============================================================================
// Swimlane View Helpers
// ============================================================================

type EntityType = 'task' | 'memo' | 'article' | 'project' | 'label' | 'other';

/**
 * Entity information for swimlane columns
 */
export interface EntityInfo {
  id: number;
  type: EntityType;
  title: string;
}

/**
 * A time slot containing activities grouped by entity
 */
export interface TimeSlot {
  time: string;
  displayTime: string; // Original ISO string with timezone for correct local time display
  activities: Map<number, ActivityLogEntry[]>;
}

/**
 * Grouped activities for swimlane view
 */
interface GroupedActivities {
  entities: EntityInfo[];
  timeSlots: TimeSlot[];
}

/**
 * Get entity information from an activity
 * Returns the primary entity associated with the activity
 */
function getEntityInfo(activity: ActivityLogEntry): EntityInfo | null {
  const { type } = parseEventType(activity.eventType);
  const { payload, issueId, projectId } = activity;

  // Primary entities with issueId (Task, Memo, Article)
  if (['task', 'memo', 'article'].includes(type) && issueId) {
    let title: string;
    if (type === 'memo') {
      const memoBody = extractString(payload.body) || extractString(payload.body_preview);
      title = memoBody ? getFirstLineTruncated(memoBody, 20) : `#${issueId}`;
    } else {
      title = extractString(payload.title) || extractString(payload.issue_title) || `#${issueId}`;
    }
    return {
      id: issueId,
      type: type as EntityType,
      title: truncate(title, 20),
    };
  }

  // Link events - use source issue
  if (type === 'link') {
    const sourceIssueId = payload.source_issue_id as number | undefined;
    const sourceIssueType = extractString(payload.source_issue_type);
    const sourceIssueTitle = extractString(payload.source_issue_title);
    if (sourceIssueId) {
      return {
        id: sourceIssueId,
        type: (sourceIssueType as EntityType) || 'task',
        title: sourceIssueTitle ? truncate(sourceIssueTitle, 20) : `#${sourceIssueId}`,
      };
    }
    return null;
  }

  // Comment events - use associated issue
  if (type === 'comment' && issueId) {
    const issueType = extractString(payload.issue_type);
    const issueTitle = extractString(payload.issue_title);
    return {
      id: issueId,
      type: (issueType as EntityType) || 'task',
      title: issueTitle ? truncate(issueTitle, 20) : `#${issueId}`,
    };
  }

  // Project events
  if (type === 'project' && projectId) {
    const projectName = extractString(payload.project_name);
    return {
      id: projectId,
      type: 'project',
      title: projectName ? truncate(projectName, 20) : `Project #${projectId}`,
    };
  }

  // Label events with issueId (assign/remove to an issue)
  if (type === 'label' && issueId) {
    const issueType = extractString(payload.issue_type);
    const issueTitle = extractString(payload.issue_title);
    return {
      id: issueId,
      type: (issueType as EntityType) || 'task',
      title: issueTitle ? truncate(issueTitle, 20) : `#${issueId}`,
    };
  }

  // Cannot determine entity (e.g., label.created/deleted without issue)
  return null;
}

/**
 * Get short action label for swimlane cell display
 */
export function getShortActionLabel(activity: ActivityLogEntry): string {
  const { eventType, payload } = activity;
  const { action } = parseEventType(eventType);

  // Special cases
  switch (eventType) {
    case 'task.status_changed':
      return extractString(payload.to_status) || action;
    case 'task.bookmarked':
    case 'memo.bookmarked':
      // Backend uses 'is_bookmarked', support both for compatibility
      return (payload.is_bookmarked ?? payload.bookmarked) ? 'bookmarked' : 'unbookmarked';
    case 'memo.promoted':
      return 'promoted';
    case 'link.created':
      return 'linked';
    case 'link.deleted':
      return 'unlinked';
    case 'comment.created':
      return 'comment';
    case 'comment.updated':
      return 'comment edit';
    case 'comment.deleted':
      return 'comment del';
    case 'label.assigned':
      return `+${truncate(extractString(payload.label_name) || 'label', 10)}`;
    case 'label.removed':
      return `-${truncate(extractString(payload.label_name) || 'label', 10)}`;
    default:
      return action;
  }
}

/**
 * Get dot color for swimlane based on action/status
 */
export function getActivityDotColor(activity: ActivityLogEntry): string {
  const label = getShortActionLabel(activity);

  // Task statuses
  if (label === 'done') return 'bg-green-500';
  if (label === 'next') return 'bg-blue-500';
  if (label === 'waiting') return 'bg-yellow-500';
  if (label === 'inbox') return 'bg-gray-400';
  if (label === 'someday') return 'bg-purple-400';

  // Common actions
  if (label === 'created') return 'bg-emerald-400';
  if (label === 'comment' || label.startsWith('comment')) return 'bg-orange-400';
  if (label === 'linked' || label === 'unlinked') return 'bg-cyan-400';
  if (label === 'promoted') return 'bg-indigo-500';
  if (label === 'deleted') return 'bg-red-400';
  if (label === 'updated') return 'bg-slate-400';
  if (label.startsWith('+') || label.startsWith('-')) return 'bg-pink-400'; // labels

  // Default
  return 'bg-gray-400';
}

/**
 * Create time slots from activities, grouping by second
 */
function createTimeSlots(
  activities: ActivityLogEntry[],
  entityIdSet: Set<number>
): TimeSlot[] {
  const slotMap = new Map<string, TimeSlot>();

  for (const activity of activities) {
    const entity = getEntityInfo(activity);
    if (!entity || !entityIdSet.has(entity.id)) continue;

    // Round to second precision
    const timeKey = activity.occurredAt.substring(0, 19);

    if (!slotMap.has(timeKey)) {
      slotMap.set(timeKey, {
        time: timeKey,
        displayTime: activity.occurredAt, // Preserve original timezone for display
        activities: new Map(),
      });
    }

    const slot = slotMap.get(timeKey)!;
    const entityActivities = slot.activities.get(entity.id) || [];
    entityActivities.push(activity);
    slot.activities.set(entity.id, entityActivities);
  }

  // Sort by time ascending (oldest first at top, newest last at bottom)
  return Array.from(slotMap.values()).sort((a, b) =>
    a.time.localeCompare(b.time)
  );
}

/**
 * Group activities by entity for swimlane view
 * Returns entities (columns) and time slots (rows)
 */
export function groupActivitiesByEntity(
  activities: ActivityLogEntry[]
): GroupedActivities {
  // Build entity list from activities
  const entityMap = new Map<number, EntityInfo>();
  const entityFirstTime = new Map<number, string>();

  for (const activity of activities) {
    const entity = getEntityInfo(activity);
    if (!entity) continue;

    // Keep track of first (most recent) occurrence time for ordering
    if (!entityMap.has(entity.id)) {
      entityMap.set(entity.id, entity);
      entityFirstTime.set(entity.id, activity.occurredAt);
    }
  }

  // Sort entities by first occurrence time (most recent first)
  const entities = Array.from(entityMap.values()).sort((a, b) => {
    const timeA = entityFirstTime.get(a.id) || '';
    const timeB = entityFirstTime.get(b.id) || '';
    return timeB.localeCompare(timeA);
  });

  const entityIdSet = new Set(entities.map((e) => e.id));
  const timeSlots = createTimeSlots(activities, entityIdSet);

  return { entities, timeSlots };
}
