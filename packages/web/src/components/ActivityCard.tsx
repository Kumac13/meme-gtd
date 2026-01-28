import { Link } from 'react-router-dom';
import { formatRelativeTime, formatDateTime } from '../utils/dates';
import {
  parseEventType,
  getActivityTitle,
  getActivityDetails,
  getActivityLink,
  getActivityTypeColor,
  type ActivityLogEntry,
} from '../utils/activityLogHelpers';

interface ActivityCardProps {
  activity: ActivityLogEntry;
}

function ActivityCard({ activity }: ActivityCardProps) {
  const { type, action } = parseEventType(activity.eventType);
  const title = getActivityTitle(activity);
  const details = getActivityDetails(activity);
  const link = getActivityLink(activity);
  const typeColor = getActivityTypeColor(type);

  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        {/* Line 1: [Type] action */}
        <div className="flex items-center gap-2 text-sm">
          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${typeColor}`}>
            {type}
          </span>
          <span className="text-gray-600">{action}</span>
        </div>
        {/* Line 2: Title/content */}
        <p className="mt-1 text-gray-900 truncate">{title}</p>
        {/* Line 3: Details (if any) */}
        {details && <p className="mt-1 text-sm text-gray-500">{details}</p>}
      </div>
      {/* Time */}
      <span
        className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0"
        title={formatDateTime(activity.occurredAt)}
      >
        {formatRelativeTime(activity.occurredAt)}
      </span>
    </div>
  );

  if (link) {
    return (
      <Link
        to={link}
        className="block p-4 hover:bg-gray-50 transition-colors"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="p-4 opacity-75 cursor-not-allowed">
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

  return (
    <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
      {activities.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}
    </div>
  );
}
