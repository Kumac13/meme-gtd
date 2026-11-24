import { ActivityTarget } from './ActivityTarget';
import { LinkedActivityTarget } from './ActivityTimelineItem';
import { Link } from 'react-router-dom';
import { formatTimeOnly, formatDateTime, formatDateOnly, getDateKey } from '../utils/dates';
import {
  parseEventType,
  getActivityDetails,
  getLinkDescription,
  getActivityLink,
  getActivityIssueId,
  isPrimaryEntity,
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
    <div className="flex-shrink-0 w-3 mt-0.5">
      <div className="w-3 h-3 rounded-full bg-gray-400" />
    </div>
  );
}

// Timeline line: positioned from wrapper (relative)
// left: px-4(16px) + w-20(80px) + gap-4(16px) + dot-center(5px) = 117px
// top: mt-0.5(2px) + dot-height(12px) = 14px
// bottom: -4px to extend into next item's mt-1 area
const timelineLineStyle = {
  left: '117px',
  top: '14px',
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

  const timelineLine = !isLast && (
    <div className="absolute w-0.5 bg-gray-200" style={timelineLineStyle} />
  );

  // Primary entities: Task, Memo, Article - badge format
  if (isPrimaryEntity(type)) {
    const title = getPrimaryEntityTitle(activity);
    const details = getActivityDetails(activity);

    return (
      <div className="px-4 relative">
        {timelineLine}
        <div className="flex gap-4">
          <TimeColumn time={activity.occurredAt} showDate={showDate} />
          <TimelineNode />
          <div className="min-w-0 flex-1 pb-6">
            <p className="mb-1 text-xs text-gray-500">{action}</p>
            <ActivityTarget id={issueId} type={activity.eventType === 'memo.promoted' ? 'task' : type} title={title} to={link} />
            {details && <p className="mt-0.5 text-sm text-gray-500">{details}</p>}
          </div>
        </div>
      </div>
    );
  }

  // Link events - simple text format
  if (type === 'link') {
    const linkText = action === 'created' ? 'linked' : 'unlinked';
    const sourceId = activity.payload.source_issue_id;
    return (
      <div className="relative px-4">
        {timelineLine}
        <div className="flex gap-4">
          <TimeColumn time={activity.occurredAt} showDate={showDate} />
          <TimelineNode />
          <div className="min-w-0 flex-1 pb-4">
            <p className="mb-1 text-xs text-gray-500" title={getLinkDescription(activity)}>
              {typeof sourceId === 'number' && (link ? <Link to={link}>#{sourceId} </Link> : `#${sourceId} `)}
              {linkText}
            </p>
            <LinkedActivityTarget payload={activity.payload} />
          </div>
        </div>
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
