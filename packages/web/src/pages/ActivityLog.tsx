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

export default function ActivityLogPage() {
  useDocumentTitle('Activity');

  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ActivityCategory>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

  useEffect(() => {
    async function fetchActivities() {
      try {
        setLoading(true);
        setError(null);

        // Get activities from the last 24 hours
        const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const response = await ActivityLogService.listActivityLog(
          undefined, // issueId
          undefined, // projectId
          undefined, // labelId
          undefined, // eventType
          undefined, // sourceType
          from,      // from
          undefined, // to
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
  }, []);

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

      <ActivityCategoryFilter
        category={category}
        onCategoryChange={setCategory}
      />

      {filteredActivities.length === 0 ? (
        <EmptyState
          message={category === 'all' ? 'No recent activity' : `No ${category} activity`}
          submessage="Activities from the last 24 hours will appear here"
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
