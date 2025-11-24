import { useCalendarApp, ScheduleXCalendar } from '@schedule-x/react';
import {
  createViewDay,
  createViewWeek,
  createViewMonthGrid,
} from '@schedule-x/calendar';
import { useEffect, useMemo } from 'react';
import type { CalendarView as ViewType } from '../../hooks/useCalendarState';
import type { CalendarEvent } from '../../utils/calendarMapper';
import '@schedule-x/theme-default/dist/index.css';

interface CalendarViewProps {
  events: CalendarEvent[];
  view: ViewType;
  selectedDate: string;
  onEventClick?: (eventId: string) => void;
}

export default function CalendarView({
  events,
  view,
  selectedDate,
  onEventClick,
}: CalendarViewProps) {
  const viewMap = useMemo(() => ({
    month: 'month-grid',
    week: 'week',
    day: 'day',
  } as const), []);

  const calendar = useCalendarApp({
    views: [createViewMonthGrid(), createViewWeek(), createViewDay()],
    events,
    selectedDate,
    defaultView: viewMap[view],
    callbacks: {
      onEventClick: (event) => {
        if (onEventClick) {
          onEventClick(String(event.id));
        }
      },
    },
  });

  useEffect(() => {
    if (calendar) {
      const calendarApi = calendar as unknown as {
        setView?: (view: string) => void;
        goToDate?: (date: string) => void;
        events?: { set: (events: CalendarEvent[]) => void };
      };
      if (calendarApi.setView) {
        calendarApi.setView(viewMap[view]);
      }
    }
  }, [calendar, view, viewMap]);

  useEffect(() => {
    if (calendar && selectedDate) {
      const calendarApi = calendar as unknown as { goToDate?: (date: string) => void };
      if (calendarApi.goToDate) {
        calendarApi.goToDate(selectedDate);
      }
    }
  }, [calendar, selectedDate]);

  useEffect(() => {
    if (calendar) {
      const calendarApi = calendar as unknown as { events?: { set: (events: CalendarEvent[]) => void } };
      if (calendarApi.events?.set) {
        calendarApi.events.set(events);
      }
    }
  }, [calendar, events]);

  return (
    <div className="sx-react-calendar-wrapper">
      <ScheduleXCalendar calendarApp={calendar} />
    </div>
  );
}
