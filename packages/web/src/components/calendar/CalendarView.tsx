import { useCalendarApp, ScheduleXCalendar } from '@schedule-x/react';
import {
  createViewDay,
  createViewWeek,
  createViewMonthGrid,
  type CalendarEventExternal,
} from '@schedule-x/calendar';
import { createCalendarControlsPlugin } from '@schedule-x/calendar-controls';
import { useEffect, useMemo, useState, useRef } from 'react';
import type { CalendarView as ViewType } from '../../hooks/useCalendarState';
import '@schedule-x/theme-default/dist/index.css';

interface CalendarViewProps {
  events: CalendarEventExternal[];
  view: ViewType;
  selectedDate: string;
  onEventClick?: (eventId: string) => void;
  onViewChange: (view: ViewType) => void;
  onDateChange: (date: string) => void;
}

export default function CalendarView({
  events,
  view,
  selectedDate,
  onEventClick,
  onViewChange,
  onDateChange,
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

  // Use refs to access latest values in callbacks (avoid stale closures)
  const viewRef = useRef(view);
  const selectedDateRef = useRef(selectedDate);
  const onViewChangeRef = useRef(onViewChange);
  const onDateChangeRef = useRef(onDateChange);

  useEffect(() => {
    viewRef.current = view;
    selectedDateRef.current = selectedDate;
    onViewChangeRef.current = onViewChange;
    onDateChangeRef.current = onDateChange;
  }, [view, selectedDate, onViewChange, onDateChange]);

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
    monthGridOptions: {
      nEventsPerDay: 10,
    },
    callbacks: {
      onEventClick: (event) => {
        if (onEventClick) {
          onEventClick(String(event.id));
        }
      },
      onRangeUpdate: () => {
        // Sync view changes from calendar to URL
        const currentView = calendarControls.getView();
        const mappedView = reverseViewMap[currentView];
        if (mappedView && mappedView !== viewRef.current) {
          onViewChangeRef.current(mappedView);
        }

        // Sync date changes from calendar to URL
        const currentDate = calendarControls.getDate();
        const newDate = String(currentDate);
        if (newDate !== selectedDateRef.current) {
          onDateChangeRef.current(newDate);
        }
      },
    },
  });

  // Sync view from URL to calendar
  useEffect(() => {
    const currentView = calendarControls.getView();
    if (viewMap[view] !== currentView) {
      calendarControls.setView(viewMap[view]);
    }
  }, [calendarControls, view, viewMap]);

  // Sync date from URL to calendar
  useEffect(() => {
    const currentDate = String(calendarControls.getDate());
    if (selectedDate !== currentDate) {
      calendarControls.setDate(selectedDateTemporal);
    }
  }, [calendarControls, selectedDate, selectedDateTemporal]);

  // Sync events from props to calendar
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
