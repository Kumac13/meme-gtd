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
  onViewChange?: (view: ViewType) => void;
}

export default function CalendarView({
  events,
  view,
  selectedDate,
  onEventClick,
  onViewChange,
}: CalendarViewProps) {
  const viewMap = useMemo(() => ({
    month: 'month-grid',
    week: 'week',
    day: 'day',
  } as const), []);

  const reverseViewMap: Record<string, ViewType> = {
    'month-grid': 'month',
    'week': 'week',
    'day': 'day',
  };

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
    timezone: 'Asia/Tokyo',
    weekOptions: {
      gridHeight: 1400,
    },
    callbacks: {
      onEventClick: (event) => {
        if (onEventClick) {
          onEventClick(String(event.id));
        }
      },
      onRangeUpdate: () => {
        if (onViewChange) {
          const currentView = calendarControls.getView();
          const mappedView = reverseViewMap[currentView];
          if (mappedView && mappedView !== view) {
            onViewChange(mappedView);
          }
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
