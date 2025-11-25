import { useCalendarApp, ScheduleXCalendar } from '@schedule-x/react';
import {
  createViewDay,
  createViewWeek,
  createViewMonthGrid,
  type CalendarEventExternal,
} from '@schedule-x/calendar';
import { createCalendarControlsPlugin } from '@schedule-x/calendar-controls';
import { useEffect, useMemo, useState } from 'react';
import type { CalendarView as ViewType } from '../../hooks/useCalendarState';
import '@schedule-x/theme-default/dist/index.css';

interface CalendarViewProps {
  events: CalendarEventExternal[];
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

  const [calendarControls] = useState(() => createCalendarControlsPlugin());

  const selectedDateTemporal = useMemo(
    () => Temporal.PlainDate.from(selectedDate),
    [selectedDate]
  );

  const calendar = useCalendarApp({
    views: [createViewMonthGrid(), createViewWeek(), createViewDay()],
    events,
    selectedDate: selectedDateTemporal,
    defaultView: viewMap[view],
    plugins: [calendarControls],
    callbacks: {
      onEventClick: (event) => {
        if (onEventClick) {
          onEventClick(String(event.id));
        }
      },
    },
  });

  useEffect(() => {
    calendarControls.setView(viewMap[view]);
  }, [calendarControls, view, viewMap]);

  useEffect(() => {
    calendarControls.setDate(selectedDateTemporal);
  }, [calendarControls, selectedDateTemporal]);

  useEffect(() => {
    if (calendar) {
      calendar.events.set(events);
    }
  }, [calendar, events]);

  return (
    <div className="sx-react-calendar-wrapper">
      <ScheduleXCalendar calendarApp={calendar} />
    </div>
  );
}
