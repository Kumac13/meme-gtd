import { useState, useEffect, useMemo } from 'react';
import { useCalendarState } from '../hooks/useCalendarState';
import CalendarView from '../components/calendar/CalendarView';
import CalendarToolbar from '../components/calendar/CalendarToolbar';
import { tasksToCalendarEvents, getDateRange, type Task } from '../utils/calendarMapper';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

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
  const { view, date, setView, setTaskId, goToToday, goToPrevious, goToNext } = useCalendarState();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return <LoadingState message="Loading calendar..." />;
  }

  if (error) {
    return <ErrorState error={error} title="Error loading calendar" />;
  }

  return (
    <div className="px-4 sm:px-0">
      <CalendarToolbar
        view={view}
        onViewChange={setView}
        onToday={goToToday}
        onPrevious={goToPrevious}
        onNext={goToNext}
        currentDate={date}
      />
      <CalendarView
        events={events}
        view={view}
        selectedDate={date}
        onEventClick={handleEventClick}
      />
    </div>
  );
}
