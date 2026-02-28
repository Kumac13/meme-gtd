import { Link } from 'react-router-dom';
import { formatTimeOnly, formatDateTime, formatDateOnly, getDateKey } from '../utils/dates';
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
  showDate?: boolean;
}

function TimeColumn({ time, showDate }: TimeColumnProps) {
  return (
    <div
      className="w-20 text-right flex-shrink-0 mt-0.5"
      title={formatDateTime(time)}
    >
      {showDate && (
        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">
          {formatDateOnly(time)}
        </div>
      )}
      <div className="text-xs text-gray-500">{formatTimeOnly(time)}</div>
    </div>
  );
}

function TimelineNode() {
  return (
    <div className="flex-shrink-0 w-3 mt-1">
      <div className="w-3 h-3 rounded-full bg-gray-400" />
    </div>
  );
}

// Timeline line: positioned from wrapper (relative)
// left: px-4(16px) + w-20(80px) + gap-4(16px) + dot-center(5px) = 117px
// top: mt-1(4px) + dot-height(12px) = 16px
// bottom: -4px to extend into next item's mt-1 area
const timelineLineStyle = {
  left: '117px',
  top: '16px',
  bottom: '-4px',
};

interface ActivityTimelineItemProps {
  activity: ActivityLogEntry;
  isLast: boolean;
  showDate?: boolean;
}

function ActivityTimelineItem({ activity, isLast, showDate }: ActivityTimelineItemProps) {
  const { type, action } = parseEventType(activity.eventType);
  const issueId = getActivityIssueId(activity);
  const link = getActivityLink(activity);
  const typeColor = getActivityTypeColor(type);

  const timelineLine = !isLast && (
    <div className="absolute w-0.5 bg-gray-200" style={timelineLineStyle} />
  );

  // Primary entities: Task, Memo, Article - badge format
  if (isPrimaryEntity(type)) {
    const title = getPrimaryEntityTitle(activity);
    const details = getActivityDetails(activity);
    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);

    return (
      <div className="px-4 relative">
        {timelineLine}
        <div className="flex gap-4">
          <TimeColumn time={activity.occurredAt} showDate={showDate} />
          <TimelineNode />
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
        <TimeColumn time={activity.occurredAt} showDate={showDate} />
        <TimelineNode />
        <div className="flex-1 pb-4">
          <p className="text-gray-700 text-sm">{linkText}</p>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
    );

    if (link) {
      return (
        <Link to={link} className="block hover:bg-gray-50 transition-colors px-4 relative">
          {timelineLine}
          {content}
        </Link>
      );
    }

    return (
      <div className="px-4 opacity-75 cursor-not-allowed relative">
        {timelineLine}
        {content}
      </div>
    );
  }

  // Comment events - simple text format with clickable row
  if (type === 'comment') {
    const headline = getCommentHeadline(activity);
    const body = getCommentBody(activity);

    const content = (
      <div className="flex gap-4">
        <TimeColumn time={activity.occurredAt} showDate={showDate} />
        <TimelineNode />
        <div className="flex-1 pb-4">
          <p className="text-gray-700 text-sm">{headline}</p>
          {body && <p className="text-sm text-gray-500">{body}</p>}
        </div>
      </div>
    );

    if (link) {
      return (
        <Link to={link} className="block hover:bg-gray-50 transition-colors px-4 relative">
          {timelineLine}
          {content}
        </Link>
      );
    }

    return (
      <div className="px-4 opacity-75 cursor-not-allowed relative">
        {timelineLine}
        {content}
      </div>
    );
  }

  // Label events - single line format
  if (type === 'label') {
    const headline = getLabelHeadline(activity);

    const content = (
      <div className="flex gap-4">
        <TimeColumn time={activity.occurredAt} showDate={showDate} />
        <TimelineNode />
        <div className="flex-1 pb-4">
          <p className="text-gray-700 text-sm">{headline}</p>
        </div>
      </div>
    );

    if (link) {
      return (
        <Link to={link} className="block hover:bg-gray-50 transition-colors px-4 relative">
          {timelineLine}
          {content}
        </Link>
      );
    }

    return (
      <div className="px-4 opacity-75 cursor-not-allowed relative">
        {timelineLine}
        {content}
      </div>
    );
  }

  // Project events - single line format
  if (type === 'project') {
    const headline = getProjectHeadline(activity);

    const content = (
      <div className="flex gap-4">
        <TimeColumn time={activity.occurredAt} showDate={showDate} />
        <TimelineNode />
        <div className="flex-1 pb-4">
          <p className="text-gray-700 text-sm">{headline}</p>
        </div>
      </div>
    );

    if (link) {
      return (
        <Link to={link} className="block hover:bg-gray-50 transition-colors px-4 relative">
          {timelineLine}
          {content}
        </Link>
      );
    }

    return (
      <div className="px-4 opacity-75 cursor-not-allowed relative">
        {timelineLine}
        {content}
      </div>
    );
  }

  // Fallback for unknown types
  const details = getActivityDetails(activity);
  const content = (
    <div className="flex gap-4">
      <TimeColumn time={activity.occurredAt} showDate={showDate} />
      <TimelineNode />
      <div className="flex-1 pb-4">
        <p className="text-gray-700 text-sm">
          {type} {action}
        </p>
        {details && <p className="text-sm text-gray-500">{details}</p>}
      </div>
    </div>
  );

  return (
    <div className="px-4 relative">
      {timelineLine}
      {content}
    </div>
  );
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

  // Pre-compute date keys to determine where to show date labels
  const dateKeys = activities.map((a) => getDateKey(a.occurredAt));

  return (
    <div className="bg-white border border-gray-200 rounded-lg pt-4 pb-4">
      {activities.map((activity, index) => {
        const currentDateKey = dateKeys[index];
        const prevDateKey = index > 0 ? dateKeys[index - 1] : null;
        const isFirstOfDate = index === 0 || currentDateKey !== prevDateKey;
        const isLast = index === activities.length - 1;

        return (
          <ActivityTimelineItem
            key={activity.id}
            activity={activity}
            isLast={isLast}
            showDate={isFirstOfDate}
          />
        );
      })}
    </div>
  );
}
