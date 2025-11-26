import { useQueryStates, parseAsString, parseAsStringEnum, parseAsInteger } from 'nuqs';

export type CalendarView = 'month' | 'week' | 'day';

const today = () => {
  const now = new Date();
  // Use local date components to avoid UTC timezone issues
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function useCalendarState() {
  const [state, setState] = useQueryStates({
    view: parseAsStringEnum<CalendarView>(['month', 'week', 'day']).withDefault('month').withOptions({ clearOnDefault: false }),
    date: parseAsString.withDefault(today()),
    task: parseAsInteger,
  });

  const setView = (newView: CalendarView) => {
    setState({ view: newView });
  };

  const setDate = (date: string) => {
    setState({ date });
  };

  const setTaskId = (taskId: number | null) => {
    setState({ task: taskId });
  };

  const goToToday = () => {
    setState({ date: today() });
  };

  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const goToPrevious = () => {
    // Parse date as local time by adding time component
    const currentDate = new Date(state.date + 'T00:00:00');
    if (state.view === 'month') {
      currentDate.setMonth(currentDate.getMonth() - 1);
    } else if (state.view === 'week') {
      currentDate.setDate(currentDate.getDate() - 7);
    } else {
      currentDate.setDate(currentDate.getDate() - 1);
    }
    setState({ date: formatLocalDate(currentDate) });
  };

  const goToNext = () => {
    // Parse date as local time by adding time component
    const currentDate = new Date(state.date + 'T00:00:00');
    if (state.view === 'month') {
      currentDate.setMonth(currentDate.getMonth() + 1);
    } else if (state.view === 'week') {
      currentDate.setDate(currentDate.getDate() + 7);
    } else {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    setState({ date: formatLocalDate(currentDate) });
  };

  return {
    view: state.view,
    date: state.date,
    taskId: state.task,
    setView,
    setDate,
    setTaskId,
    goToToday,
    goToPrevious,
    goToNext,
  };
}
