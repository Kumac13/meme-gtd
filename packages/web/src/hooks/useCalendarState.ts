import { useQueryStates, parseAsString, parseAsStringEnum, parseAsInteger } from 'nuqs';

export type CalendarView = 'month' | 'week' | 'day';

const today = () => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

export function useCalendarState() {
  const [state, setState] = useQueryStates({
    view: parseAsStringEnum<CalendarView>(['month', 'week', 'day']).withDefault('month'),
    date: parseAsString.withDefault(today()),
    task: parseAsInteger,
  });

  const setView = (view: CalendarView) => {
    setState({ view });
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

  const goToPrevious = () => {
    const currentDate = new Date(state.date);
    if (state.view === 'month') {
      currentDate.setMonth(currentDate.getMonth() - 1);
    } else if (state.view === 'week') {
      currentDate.setDate(currentDate.getDate() - 7);
    } else {
      currentDate.setDate(currentDate.getDate() - 1);
    }
    setState({ date: currentDate.toISOString().split('T')[0] });
  };

  const goToNext = () => {
    const currentDate = new Date(state.date);
    if (state.view === 'month') {
      currentDate.setMonth(currentDate.getMonth() + 1);
    } else if (state.view === 'week') {
      currentDate.setDate(currentDate.getDate() + 7);
    } else {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    setState({ date: currentDate.toISOString().split('T')[0] });
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
