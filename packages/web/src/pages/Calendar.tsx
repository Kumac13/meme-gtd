import { useState, useEffect, useMemo, useCallback } from 'react';
import { useCalendarState } from '../hooks/useCalendarState';
import CalendarView from '../components/calendar/CalendarView';
import { TaskDetailPanel } from '../components/calendar/TaskDetailPanel';
import { tasksToCalendarEvents, getDateRange } from '../utils/calendarMapper';
import type { Task } from '../utils/calendarMapper';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

async function fetchTasks(scheduledFrom: string, scheduledTo: string): Promise<Task[]> {
  const params = new URLSearchParams({
    scheduledFrom,
    scheduledTo,
  });
  const response = await fetch(`/api/tasks?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch tasks');
  }
  return response.json();
}

export default function Calendar() {
  const { view, date, taskId, setTaskId, setView } = useCalendarState();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Set document title for calendar
  useDocumentTitle('Calendar');

  const dateRange = useMemo(() => getDateRange(date, view), [date, view]);

  useEffect(() => {
    async function loadTasks() {
      try {
        setLoading(true);
        setError(null);
        const fetchedTasks = await fetchTasks(dateRange.from, dateRange.to);
        setTasks(fetchedTasks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
        console.error('Error fetching tasks:', err);
      } finally {
        setLoading(false);
      }
    }

    loadTasks();
  }, [dateRange.from, dateRange.to]);

  const events = useMemo(() => tasksToCalendarEvents(tasks), [tasks]);

  const handleEventClick = (eventId: string) => {
    setTaskId(Number(eventId));
  };

  const handleModalClose = () => {
    setTaskId(null);
  };

  const handleTaskUpdated = useCallback(() => {
    // Refetch tasks when task is updated in modal
    const loadTasks = async () => {
      try {
        const fetchedTasks = await fetchTasks(dateRange.from, dateRange.to);
        setTasks(fetchedTasks);
      } catch (err) {
        console.error('Error refetching tasks:', err);
      }
    };
    loadTasks();
  }, [dateRange.from, dateRange.to]);

  if (loading) {
    return <LoadingState message="Loading calendar..." />;
  }

  if (error) {
    return <ErrorState error={error} title="Error loading calendar" />;
  }

  return (
    <div className="px-4 sm:px-0">
      <CalendarView
        events={events}
        view={view}
        selectedDate={date}
        onEventClick={handleEventClick}
        onViewChange={setView}
      />
      <TaskDetailPanel
        taskId={taskId}
        onClose={handleModalClose}
        onTaskUpdated={handleTaskUpdated}
      />
    </div>
  );
}
