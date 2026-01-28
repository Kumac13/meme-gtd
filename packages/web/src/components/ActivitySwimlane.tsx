import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatTimeOnly, formatDateTime } from '../utils/dates';
import {
  groupActivitiesByEntity,
  getShortActionLabel,
  getActivityLink,
  getActivityTypeColor,
  getActivityDotColor,
  type ActivityLogEntry,
  type EntityInfo,
  type TimeSlot,
} from '../utils/activityLogHelpers';

interface SwimlaneHeaderProps {
  entities: EntityInfo[];
}

function SwimlaneHeader({ entities }: SwimlaneHeaderProps) {
  return (
    <thead>
      <tr className="border-b border-gray-200">
        {/* Empty header for time column */}
        <th className="sticky left-0 z-10 bg-white w-20 py-2" />
        {entities.map((entity) => {
          const typeColor = getActivityTypeColor(entity.type);
          const capitalizedType =
            entity.type.charAt(0).toUpperCase() + entity.type.slice(1);

          return (
            <th
              key={entity.id}
              className="px-3 py-2 text-left text-xs font-medium min-w-[10rem] max-w-[12rem]"
            >
              <div className="flex flex-col gap-1">
                <span
                  className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${typeColor} w-fit`}
                >
                  #{entity.id} {capitalizedType}
                </span>
                <span
                  className="text-gray-700 font-normal truncate"
                  title={entity.title}
                >
                  {entity.title}
                </span>
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

interface SwimlaneCellProps {
  activities: ActivityLogEntry[];
  hasMoreAbove: boolean;
  hasMoreBelow: boolean;
}

function SwimlaneCell({ activities, hasMoreAbove, hasMoreBelow }: SwimlaneCellProps) {
  const hasActivities = activities.length > 0;
  // Line position: px-3 = 12px padding, dot w-3 = 12px, line w-0.5 = 2px
  // Dot center = 12 + 6 = 18px, line center should be at 18px, so line left = 18 - 1 = 17px
  const lineLeft = 17;

  // Empty cell - show connecting line through entire cell if needed
  if (!hasActivities) {
    if (hasMoreAbove && hasMoreBelow) {
      return (
        <td className="relative min-w-[10rem] px-3 py-2">
          <div
            className="absolute w-0.5 bg-gray-200 top-0 bottom-0"
            style={{ left: `${lineLeft}px` }}
          />
        </td>
      );
    }
    return <td className="min-w-[10rem] px-3 py-2" />;
  }

  return (
    <td className="relative min-w-[10rem] px-3 py-2">
      {/* Vertical line - spans full cell height, trimmed at ends if no more activities */}
      {(hasMoreAbove || hasMoreBelow || activities.length > 1) && (
        <div
          className="absolute w-0.5 bg-gray-200"
          style={{
            left: `${lineLeft}px`,
            top: hasMoreAbove ? 0 : '18px',
            bottom: hasMoreBelow ? 0 : '18px',
          }}
        />
      )}
      <div className="flex flex-col gap-2">
        {activities.map((activity) => {
          const label = getShortActionLabel(activity);
          const link = getActivityLink(activity);
          const dotColor = getActivityDotColor(activity);

          const badge = (
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${dotColor} z-10 flex-shrink-0`} />
              <span className="text-xs text-gray-700">{label}</span>
            </div>
          );

          if (link) {
            return (
              <Link
                key={activity.id}
                to={link}
                className="hover:opacity-70 transition-opacity"
              >
                {badge}
              </Link>
            );
          }

          return (
            <div key={activity.id} className="opacity-75">
              {badge}
            </div>
          );
        })}
      </div>
    </td>
  );
}

interface SwimlaneRowProps {
  slot: TimeSlot;
  entities: EntityInfo[];
  entitiesWithMoreAbove: Set<number>;
  entitiesWithMoreBelow: Set<number>;
}

function SwimlaneRow({ slot, entities, entitiesWithMoreAbove, entitiesWithMoreBelow }: SwimlaneRowProps) {
  return (
    <tr className="hover:bg-gray-50/50 transition-colors">
      {/* Time column: right-aligned, tabular-nums */}
      <td
        className="sticky left-0 z-10 bg-white w-20 text-xs text-gray-500 text-right pr-3 align-top py-2"
        style={{ fontVariantNumeric: 'tabular-nums' }}
        title={formatDateTime(slot.displayTime)}
      >
        {formatTimeOnly(slot.displayTime)}
      </td>
      {entities.map((entity) => {
        const activities = slot.activities.get(entity.id) || [];
        const hasMoreAbove = entitiesWithMoreAbove.has(entity.id);
        const hasMoreBelow = entitiesWithMoreBelow.has(entity.id);
        return (
          <SwimlaneCell
            key={entity.id}
            activities={activities}
            hasMoreAbove={hasMoreAbove}
            hasMoreBelow={hasMoreBelow}
          />
        );
      })}
    </tr>
  );
}

interface ActivitySwimlaneProps {
  activities: ActivityLogEntry[];
}

export function ActivitySwimlane({ activities }: ActivitySwimlaneProps) {
  const grouped = useMemo(
    () => groupActivitiesByEntity(activities),
    [activities]
  );

  const { entitiesWithMoreAboveByRow, entitiesWithMoreBelowByRow } = useMemo(() => {
    const aboveResult: Set<number>[] = [];
    const belowResult: Set<number>[] = [];
    const { timeSlots, entities } = grouped;

    const seenFromTop = new Set<number>();
    const seenFromBottom = new Set<number>();

    for (let i = 0; i < timeSlots.length; i++) {
      aboveResult[i] = new Set(seenFromTop);
      const slot = timeSlots[i];
      for (const entity of entities) {
        if ((slot.activities.get(entity.id)?.length ?? 0) > 0) {
          seenFromTop.add(entity.id);
        }
      }
    }

    for (let i = timeSlots.length - 1; i >= 0; i--) {
      belowResult[i] = new Set(seenFromBottom);
      const slot = timeSlots[i];
      for (const entity of entities) {
        if ((slot.activities.get(entity.id)?.length ?? 0) > 0) {
          seenFromBottom.add(entity.id);
        }
      }
    }

    return { entitiesWithMoreAboveByRow: aboveResult, entitiesWithMoreBelowByRow: belowResult };
  }, [grouped]);

  if (grouped.entities.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
        No activities to display in swimlane view
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <SwimlaneHeader entities={grouped.entities} />
          <tbody>
            {grouped.timeSlots.map((slot, index) => (
              <SwimlaneRow
                key={slot.time}
                slot={slot}
                entities={grouped.entities}
                entitiesWithMoreAbove={entitiesWithMoreAboveByRow[index] || new Set()}
                entitiesWithMoreBelow={entitiesWithMoreBelowByRow[index] || new Set()}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
