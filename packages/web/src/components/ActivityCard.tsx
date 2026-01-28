import { Link } from 'react-router-dom';
import { formatTimeOnly, formatDateTime } from '../utils/dates';
import {
  parseEventType,
  getActivityDetails,
  getActivityLink,
  getActivityTypeColor,
  getActivityIssueId,
  isPrimaryEntity,
  getLinkDescription,
  getCommentHeadline,
  getCommentBody,
  getLabelHeadline,
  getProjectHeadline,
  getPrimaryEntityTitle,
  type ActivityLogEntry,
} from '../utils/activityLogHelpers';

interface TimeColumnProps {
  time: string;
}

function TimeColumn({ time }: TimeColumnProps) {
  return (
    <div
      className="w-20 text-xs text-gray-500 text-right flex-shrink-0 mt-0.5"
      title={formatDateTime(time)}
    >
      {formatTimeOnly(time)}
    </div>
  );
}

interface TimelineNodeProps {
  isLast: boolean;
}

function TimelineNode({ isLast }: TimelineNodeProps) {
  return (
    <div className="relative flex flex-col items-center flex-shrink-0 mt-1">
      <div className="w-3 h-3 rounded-full bg-gray-400 z-10 flex-shrink-0" />
      {!isLast && <div className="w-0.5 bg-gray-200 flex-1 min-h-[24px]" />}
    </div>
  );
}

interface ActivityTimelineItemProps {
  activity: ActivityLogEntry;
  isLast: boolean;
}

function ActivityTimelineItem({ activity, isLast }: ActivityTimelineItemProps) {
  const { type, action } = parseEventType(activity.eventType);
  const issueId = getActivityIssueId(activity);
  const link = getActivityLink(activity);
  const typeColor = getActivityTypeColor(type);

  // Primary entities: Task, Memo, Article - badge format
  if (isPrimaryEntity(type)) {
    const title = getPrimaryEntityTitle(activity);
    const details = getActivityDetails(activity);
    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);

    return (
      <div className="px-4 first:pt-4">
        <div className="flex gap-4">
          <TimeColumn time={activity.occurredAt} />
          <TimelineNode isLast={isLast} />
          <div className="flex-1 pb-6">
            {/* Line 1: Clickable badge [#ID Type] + title */}
            <div className="flex items-center gap-2">
              {link ? (
                <Link
                  to={link}
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${typeColor} hover:opacity-80 transition-opacity`}
                >
                  #{issueId} {capitalizedType}
                </Link>
              ) : (
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${typeColor} opacity-75`}
                >
                  #{issueId} {capitalizedType}
                </span>
              )}
              {title && <span className="text-gray-900 text-sm">{title}</span>}
            </div>
            {/* Line 2: action */}
            <p className="mt-1 text-gray-600 text-sm">{action}</p>
            {/* Line 3: details (if available) */}
            {details && <p className="mt-0.5 text-sm text-gray-500">{details}</p>}
          </div>
        </div>
      </div>
    );
  }

  // Link events - simple text format
  if (type === 'link') {
    const linkText = action === 'created' ? 'linked' : 'unlinked';
    const description = getLinkDescription(activity);

    const content = (
      <div className="flex gap-4">
        <TimeColumn time={activity.occurredAt} />
        <TimelineNode isLast={isLast} />
        <div className="flex-1 pb-4">
          <p className="text-gray-700 text-sm">{linkText}</p>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
    );

    if (link) {
      return (
        <Link to={link} className="block hover:bg-gray-50 transition-colors px-4 first:pt-4">
          {content}
        </Link>
      );
    }

    return (
      <div className="px-4 opacity-75 cursor-not-allowed first:pt-4">{content}</div>
    );
  }

  // Comment events - simple text format with clickable row
  if (type === 'comment') {
    const headline = getCommentHeadline(activity);
    const body = getCommentBody(activity);

    const content = (
      <div className="flex gap-4">
        <TimeColumn time={activity.occurredAt} />
        <TimelineNode isLast={isLast} />
        <div className="flex-1 pb-4">
          <p className="text-gray-700 text-sm">{headline}</p>
          {body && <p className="text-sm text-gray-500">{body}</p>}
        </div>
      </div>
    );

    if (link) {
      return (
        <Link to={link} className="block hover:bg-gray-50 transition-colors px-4 first:pt-4">
          {content}
        </Link>
      );
    }

    return (
      <div className="px-4 opacity-75 cursor-not-allowed first:pt-4">{content}</div>
    );
  }

  // Label events - single line format
  if (type === 'label') {
    const headline = getLabelHeadline(activity);

    const content = (
      <div className="flex gap-4">
        <TimeColumn time={activity.occurredAt} />
        <TimelineNode isLast={isLast} />
        <div className="flex-1 pb-4">
          <p className="text-gray-700 text-sm">{headline}</p>
        </div>
      </div>
    );

    if (link) {
      return (
        <Link to={link} className="block hover:bg-gray-50 transition-colors px-4 first:pt-4">
          {content}
        </Link>
      );
    }

    return (
      <div className="px-4 opacity-75 cursor-not-allowed first:pt-4">{content}</div>
    );
  }

  // Project events - single line format
  if (type === 'project') {
    const headline = getProjectHeadline(activity);

    const content = (
      <div className="flex gap-4">
        <TimeColumn time={activity.occurredAt} />
        <TimelineNode isLast={isLast} />
        <div className="flex-1 pb-4">
          <p className="text-gray-700 text-sm">{headline}</p>
        </div>
      </div>
    );

    if (link) {
      return (
        <Link to={link} className="block hover:bg-gray-50 transition-colors px-4 first:pt-4">
          {content}
        </Link>
      );
    }

    return (
      <div className="px-4 opacity-75 cursor-not-allowed first:pt-4">{content}</div>
    );
  }

  // Fallback for unknown types
  const details = getActivityDetails(activity);
  const content = (
    <div className="flex gap-4">
      <TimeColumn time={activity.occurredAt} />
      <TimelineNode isLast={isLast} />
      <div className="flex-1 pb-4">
        <p className="text-gray-700 text-sm">
          {type} {action}
        </p>
        {details && <p className="text-sm text-gray-500">{details}</p>}
      </div>
    </div>
  );

  return <div className="px-4 first:pt-4">{content}</div>;
}

interface ActivityListProps {
  activities: ActivityLogEntry[];
}

export function ActivityList({ activities }: ActivityListProps) {
  if (activities.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
        No activities found
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg pb-4">
      {activities.map((activity, index) => (
        <ActivityTimelineItem
          key={activity.id}
          activity={activity}
          isLast={index === activities.length - 1}
        />
      ))}
    </div>
  );
}
