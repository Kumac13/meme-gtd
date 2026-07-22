import { useEffect, useState } from 'react';
import {
  ScheduleDateTimeFields,
  fromDatetimeLocal,
  toAllDayBoundary,
  toDatetimeLocal,
} from './ScheduleFields';

export interface ScheduleInputValue {
  scheduledStart: string | null;
  scheduledEnd: string | null;
  isAllDay: boolean;
}

interface ScheduleInputProps {
  value: ScheduleInputValue;
  onChange: (value: ScheduleInputValue) => void;
}

export function ScheduleInput({ value, onChange }: ScheduleInputProps) {
  const [allDay, setAllDay] = useState(value.isAllDay);
  const [start, setStart] = useState(toDatetimeLocal(value.scheduledStart));
  const [end, setEnd] = useState(toDatetimeLocal(value.scheduledEnd));

  useEffect(() => {
    setAllDay(value.isAllDay);
    setStart(toDatetimeLocal(value.scheduledStart));
    setEnd(toDatetimeLocal(value.scheduledEnd));
  }, [value.scheduledStart, value.scheduledEnd, value.isAllDay]);

  const emit = (nextStart: string, nextEnd: string, nextAllDay: boolean) => onChange({
    scheduledStart: nextAllDay ? toAllDayBoundary(nextStart, false) : fromDatetimeLocal(nextStart),
    scheduledEnd: nextAllDay ? toAllDayBoundary(nextEnd || nextStart, true) : fromDatetimeLocal(nextEnd),
    isAllDay: nextAllDay,
  });

  return (
    <div className="space-y-3 bg-white border border-gray-200 rounded-lg p-4">
      <ScheduleDateTimeFields
        idPrefix="schedule-input"
        allDay={allDay}
        onAllDayChange={(next) => {
          setAllDay(next);
          emit(start, end, next);
        }}
        start={start}
        onStartChange={(next) => {
          setStart(next);
          emit(next, end, allDay);
        }}
        end={end}
        onEndChange={(next) => {
          setEnd(next);
          emit(start, next, allDay);
        }}
      />
    </div>
  );
}
