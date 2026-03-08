import { type ActivityLogEntry } from '../utils/activityLogHelpers';
import { LabelBadge } from './LabelBadge';
import { formatRelativeTime } from '../utils/dates';

const DISPLAYED_EVENT_TYPES = new Set([
  'label.assigned',
  'label.removed',
  'link.created',
  'link.deleted',
  'task.status_changed',
  'project.item_added',
  'project.item_removed',
]);

export function isDisplayedActivity(activity: ActivityLogEntry): boolean {
  return DISPLAYED_EVENT_TYPES.has(activity.eventType);
}

// SVG icon components (inline, small)
function TagIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-9.86a4.5 4.5 0 00-6.364 0l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function ArrowPathIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.016 4.66v4.993" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function getIcon(eventType: string) {
  if (eventType.startsWith('label.')) return <TagIcon />;
  if (eventType.startsWith('link.')) return <LinkIcon />;
  if (eventType === 'task.status_changed') return <ArrowPathIcon />;
  if (eventType.startsWith('project.')) return <FolderIcon />;
  return null;
}

/** Exported for use in parent timeline container */
export function getActivityIcon(eventType: string) {
  return getIcon(eventType);
}

interface ActivityTimelineItemProps {
  activity: ActivityLogEntry;
  issueId?: number;
}

export function ActivityTimelineItem({ activity, issueId }: ActivityTimelineItemProps) {
  const { eventType, payload } = activity;

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 py-0.5">
      <span className="flex items-center gap-1.5 min-w-0">
        {renderDescription(eventType, payload, issueId)}
      </span>
      <span className="ml-auto flex-shrink-0 text-xs text-gray-400">
        {formatRelativeTime(activity.occurredAt)}
      </span>
    </div>
  );
}

function renderDescription(eventType: string, payload: Record<string, unknown>, issueId?: number) {
  const str = (key: string) => {
    const v = payload[key];
    return typeof v === 'string' ? v : null;
  };
  const num = (key: string) => {
    const v = payload[key];
    return typeof v === 'number' ? v : null;
  };

  switch (eventType) {
    case 'label.assigned': {
      const name = str('label_name') || 'label';
      return (
        <>
          <span>added</span>
          <LabelBadge name={name} />
          <span>label</span>
        </>
      );
    }
    case 'label.removed': {
      const name = str('label_name') || 'label';
      return (
        <>
          <span>removed</span>
          <LabelBadge name={name} />
          <span>label</span>
        </>
      );
    }
    case 'link.created': {
      const sourceId = num('source_issue_id');
      const isSource = issueId != null && sourceId === issueId;
      const otherId = isSource ? num('target_issue_id') : num('source_issue_id');
      const otherTitle = isSource ? str('target_issue_title') : str('source_issue_title');
      return <span>linked {otherId ? `#${otherId}` : ''} {otherTitle || ''}</span>;
    }
    case 'link.deleted': {
      const sourceId = num('source_issue_id');
      const isSource = issueId != null && sourceId === issueId;
      const otherId = isSource ? num('target_issue_id') : num('source_issue_id');
      const otherTitle = isSource ? str('target_issue_title') : str('source_issue_title');
      return <span>unlinked {otherId ? `#${otherId}` : ''} {otherTitle || ''}</span>;
    }
    case 'task.status_changed': {
      const from = str('from_status') || '?';
      const to = str('to_status') || '?';
      return <span>changed status {from} → {to}</span>;
    }
    case 'project.item_added': {
      const name = str('project_name') || 'project';
      return <span>added to {name}</span>;
    }
    case 'project.item_removed': {
      const name = str('project_name') || 'project';
      return <span>removed from {name}</span>;
    }
    default:
      return <span>{eventType}</span>;
  }
}
