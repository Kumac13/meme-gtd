import { useState, useEffect } from 'react';

export interface ScheduleInputValue {
    scheduledStart: string | null;  // ISO 8601: YYYY-MM-DDTHH:MM:SS
    scheduledEnd: string | null;    // ISO 8601: YYYY-MM-DDTHH:MM:SS
    isAllDay: boolean;
}

interface ScheduleInputProps {
    value: ScheduleInputValue;
    onChange: (value: ScheduleInputValue) => void;
}

// Helper: Convert ISO datetime to datetime-local input value
function toDatetimeLocal(isoDatetime: string | null): string {
    if (!isoDatetime) return '';
    return isoDatetime.slice(0, 16);
}

// Helper: Convert datetime-local input to ISO datetime
function fromDatetimeLocal(datetimeLocal: string): string | null {
    if (!datetimeLocal) return null;
    return datetimeLocal + ':00';
}

// Helper: Convert datetime-local to all-day start (set time to 00:00:00)
function toAllDayStart(datetimeLocal: string): string | null {
    if (!datetimeLocal) return null;
    const date = datetimeLocal.split('T')[0];
    return date + 'T00:00:00';
}

// Helper: Convert datetime-local to all-day end (set time to 23:59:59)
function toAllDayEnd(datetimeLocal: string): string | null {
    if (!datetimeLocal) return null;
    const date = datetimeLocal.split('T')[0];
    return date + 'T23:59:59';
}

export function ScheduleInput({ value, onChange }: ScheduleInputProps) {
    const [isAllDay, setIsAllDay] = useState(value.isAllDay);
    const [startDatetime, setStartDatetime] = useState(toDatetimeLocal(value.scheduledStart));
    const [endDatetime, setEndDatetime] = useState(toDatetimeLocal(value.scheduledEnd));

    // Sync local state when props change
    useEffect(() => {
        setIsAllDay(value.isAllDay);
        setStartDatetime(toDatetimeLocal(value.scheduledStart));
        setEndDatetime(toDatetimeLocal(value.scheduledEnd));
    }, [value.scheduledStart, value.scheduledEnd, value.isAllDay]);

    const handleAllDayChange = (checked: boolean) => {
        setIsAllDay(checked);
        if (checked) {
            // All-day: normalize times to day boundaries
            onChange({
                scheduledStart: toAllDayStart(startDatetime),
                scheduledEnd: toAllDayEnd(endDatetime || startDatetime),
                isAllDay: true,
            });
        } else {
            // Timed: use datetime as-is
            onChange({
                scheduledStart: fromDatetimeLocal(startDatetime),
                scheduledEnd: fromDatetimeLocal(endDatetime),
                isAllDay: false,
            });
        }
    };

    const handleStartChange = (datetime: string) => {
        setStartDatetime(datetime);
        if (isAllDay) {
            onChange({
                scheduledStart: toAllDayStart(datetime),
                scheduledEnd: toAllDayEnd(endDatetime || datetime),
                isAllDay: true,
            });
        } else {
            onChange({
                scheduledStart: fromDatetimeLocal(datetime),
                scheduledEnd: fromDatetimeLocal(endDatetime),
                isAllDay: false,
            });
        }
    };

    const handleEndChange = (datetime: string) => {
        setEndDatetime(datetime);
        if (isAllDay) {
            onChange({
                scheduledStart: toAllDayStart(startDatetime),
                scheduledEnd: toAllDayEnd(datetime),
                isAllDay: true,
            });
        } else {
            onChange({
                scheduledStart: fromDatetimeLocal(startDatetime),
                scheduledEnd: fromDatetimeLocal(datetime),
                isAllDay: false,
            });
        }
    };

    return (
        <div className="space-y-3 bg-white border border-gray-200 rounded-lg p-4">
            {/* All Day Toggle */}
            <div className="flex items-center">
                <input
                    type="checkbox"
                    id="all-day-toggle-input"
                    checked={isAllDay}
                    onChange={(e) => handleAllDayChange(e.target.checked)}
                    className="h-4 w-4 text-github-green-600 focus:ring-github-green-500 border-gray-300 rounded"
                />
                <label htmlFor="all-day-toggle-input" className="ml-2 text-sm text-gray-700">
                    All day
                </label>
            </div>

            {/* Always show datetime-local inputs */}
            <div className="grid grid-cols-1 gap-2">
                <div className="min-w-0">
                    <label className="block text-xs text-gray-500 mb-1">Start</label>
                    <input
                        type="datetime-local"
                        name="schedule-input-start-dt"
                        value={startDatetime}
                        onChange={(e) => handleStartChange(e.target.value)}
                        autoComplete="off"
                        data-form-type="other"
                        className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 box-border overflow-hidden"
                        style={{ WebkitAppearance: 'none', appearance: 'none' }}
                    />
                </div>
                <div className="min-w-0">
                    <label className="block text-xs text-gray-500 mb-1">End</label>
                    <input
                        type="datetime-local"
                        name="schedule-input-end-dt"
                        value={endDatetime}
                        onChange={(e) => handleEndChange(e.target.value)}
                        autoComplete="off"
                        data-form-type="other"
                        className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 box-border overflow-hidden"
                        style={{ WebkitAppearance: 'none', appearance: 'none' }}
                    />
                </div>
            </div>

        </div>
    );
}
