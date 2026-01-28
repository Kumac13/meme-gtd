import { useState, useEffect, useMemo } from 'react';
import { ActivityLogService } from '../api/services/ActivityLogService';
import { ActivityList } from '../components/ActivityCard';
import { ActivitySwimlane } from '../components/ActivitySwimlane';
import { ActivityCategoryFilter } from '../components/ActivityCategoryFilter';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import {
  filterByCategory,
  type ActivityLogEntry,
  type ActivityCategory,
} from '../utils/activityLogHelpers';

type ViewMode = 'timeline' | 'swimlane';
type DateRange = '24h' | '7d' | '30d' | 'custom';

export default function ActivityLogPage() {
  useDocumentTitle('Activity');

  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ActivityCategory>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [dateRange, setDateRange] = useState<DateRange>('24h');
  const [customStart, setCustomStart] = useState<string>(''); // YYYY-MM-DD
  const [customEnd, setCustomEnd] = useState<string>('');     // YYYY-MM-DD

  const { from, to } = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case '24h':
        return {
          from: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          to: undefined,
        };
      case '7d':
        return {
          from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          to: undefined,
        };
      case '30d':
        return {
          from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          to: undefined,
        };
      case 'custom':
        return {
          from: customStart ? new Date(customStart).toISOString() : undefined,
          to: customEnd ? new Date(customEnd + 'T23:59:59').toISOString() : undefined,
        };
    }
  }, [dateRange, customStart, customEnd]);

  useEffect(() => {
    async function fetchActivities() {
      try {
        setLoading(true);
        setError(null);

        const response = await ActivityLogService.listActivityLog(
          undefined, // issueId
          undefined, // projectId
          undefined, // labelId
          undefined, // eventType
          undefined, // sourceType
          from,      // from
          to,        // to
          100,       // limit
          undefined, // offset
          'asc'      // order - oldest first (top), newest last (bottom)
        );

        setActivities(response as ActivityLogEntry[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load activities');
        console.error('Error fetching activities:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchActivities();
  }, [from, to]);

  const filteredActivities = useMemo(() => {
    return filterByCategory(activities, category);
  }, [activities, category]);

  if (loading) {
    return <LoadingState message="Loading activities..." />;
  }

  if (error) {
    return <ErrorState error={error} title="Error loading activities" />;
  }

  return (
    <div className={viewMode === 'swimlane' ? 'max-w-7xl mx-auto px-4 py-2' : 'max-w-4xl mx-auto px-4 py-2'}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'timeline'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setViewMode('swimlane')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'swimlane'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Swimlane
          </button>
        </div>
      </div>

      {/* Date range filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as DateRange)}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
        >
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="custom">Custom</option>
        </select>

        {dateRange === 'custom' && (
          <>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
            />
          </>
        )}
      </div>

      <ActivityCategoryFilter
        category={category}
        onCategoryChange={setCategory}
      />

      {filteredActivities.length === 0 ? (
        <EmptyState
          message={category === 'all' ? 'No recent activity' : `No ${category} activity`}
          submessage={
            dateRange === '24h' ? 'Activities from the last 24 hours will appear here' :
            dateRange === '7d' ? 'Activities from the last 7 days will appear here' :
            dateRange === '30d' ? 'Activities from the last 30 days will appear here' :
            'Activities in the selected date range will appear here'
          }
        />
      ) : (
        <>
          <div className="text-sm text-gray-500 mb-2">
            {filteredActivities.length} {filteredActivities.length === 1 ? 'activity' : 'activities'}
          </div>
          {viewMode === 'timeline' ? (
            <ActivityList activities={filteredActivities} />
          ) : (
            <ActivitySwimlane activities={filteredActivities} />
          )}
        </>
      )}
    </div>
  );
}
