import { useState, useEffect, useMemo } from 'react';
import { ActivityLogService } from '../api/services/ActivityLogService';
import { ActivityList } from '../components/ActivityCard';
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

export default function ActivityLogPage() {
  useDocumentTitle('Activity');

  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ActivityCategory>('all');

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
          'desc'     // order
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
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Activity (Last 24H)</h1>
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
          <ActivityList activities={filteredActivities} />
        </>
      )}
    </div>
  );
}
