import { useState, useEffect, useRef } from 'react';

interface ScheduleSectionProps {
    // New scheduling fields (ISO 8601 datetime: YYYY-MM-DDTHH:MM:SS)
    scheduledStart: string | null;
    scheduledEnd: string | null;
    isAllDay: boolean;
    // Execution fields
    actualStart: string | null;
    actualEnd: string | null;
    // Deprecated fields (kept for backward compatibility display)
    scheduledOn: string | null;
    startTime: string | null;
    endDate: string | null;
    endTime: string | null;
    duration: number | null;
    onScheduleChange: (updates: {
        scheduledStart?: string | null;
        scheduledEnd?: string | null;
        isAllDay?: boolean;
        actualStart?: string | null;
        actualEnd?: string | null;
        // Deprecated fields
        scheduledOn?: string | null;
        startTime?: string | null;
        endDate?: string | null;
        endTime?: string | null;
        duration?: number | null;
    }) => Promise<void>;
}

// Helper: Convert ISO datetime to datetime-local input value
function toDatetimeLocal(isoDatetime: string | null): string {
    if (!isoDatetime) return '';
    // ISO datetime is YYYY-MM-DDTHH:MM:SS, datetime-local wants YYYY-MM-DDTHH:MM
    return isoDatetime.slice(0, 16);
}

// Helper: Convert ISO datetime to date input value
function toDateOnly(isoDatetime: string | null): string {
    if (!isoDatetime) return '';
    return isoDatetime.split('T')[0];
}

// Helper: Convert datetime-local input to ISO datetime
function fromDatetimeLocal(datetimeLocal: string): string {
    if (!datetimeLocal) return '';
    // datetime-local is YYYY-MM-DDTHH:MM, we need YYYY-MM-DDTHH:MM:SS
    return datetimeLocal + ':00';
}

// Helper: Convert date input to ISO datetime (all-day start)
function fromDateToStartDatetime(date: string): string {
    if (!date) return '';
    return date + 'T00:00:00';
}

// Helper: Convert date input to ISO datetime (all-day end)
function fromDateToEndDatetime(date: string): string {
    if (!date) return '';
    return date + 'T23:59:59';
}

export function ScheduleSection({
    scheduledStart,
    scheduledEnd,
    isAllDay,
    actualStart,
    actualEnd,
    // Deprecated fields - kept in interface for API compatibility but not displayed
    scheduledOn: _scheduledOn,
    startTime: _startTime,
    endDate: _endDate,
    endTime: _endTime,
    duration: _duration,
    onScheduleChange
}: ScheduleSectionProps) {
    // Suppress unused variable warnings for deprecated fields
    void _scheduledOn; void _startTime; void _endDate; void _endTime; void _duration;
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Local state for form inputs
    const [formAllDay, setFormAllDay] = useState(isAllDay);
    const [formStartDate, setFormStartDate] = useState(toDateOnly(scheduledStart));
    const [formEndDate, setFormEndDate] = useState(toDateOnly(scheduledEnd));
    const [formStartDatetime, setFormStartDatetime] = useState(toDatetimeLocal(scheduledStart));
    const [formEndDatetime, setFormEndDatetime] = useState(toDatetimeLocal(scheduledEnd));
    // Actual times (for manual override)
    const [formActualStart, setFormActualStart] = useState(toDatetimeLocal(actualStart));
    const [formActualEnd, setFormActualEnd] = useState(toDatetimeLocal(actualEnd));
    const [showActualEdit, setShowActualEdit] = useState(false);

    // Sync local state when props change
    useEffect(() => {
        setFormAllDay(isAllDay);
        setFormStartDate(toDateOnly(scheduledStart));
        setFormEndDate(toDateOnly(scheduledEnd));
        setFormStartDatetime(toDatetimeLocal(scheduledStart));
        setFormEndDatetime(toDatetimeLocal(scheduledEnd));
        setFormActualStart(toDatetimeLocal(actualStart));
        setFormActualEnd(toDatetimeLocal(actualEnd));
    }, [scheduledStart, scheduledEnd, isAllDay, actualStart, actualEnd]);

    // Close when clicking outside
    useEffect(() => {
        if (!isEditing) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsEditing(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isEditing]);

    const handleSave = async () => {
        try {
            setLoading(true);
            setError(null);

            let newScheduledStart: string | null = null;
            let newScheduledEnd: string | null = null;

            if (formAllDay) {
                // All-day event: use date inputs
                if (formStartDate) {
                    newScheduledStart = fromDateToStartDatetime(formStartDate);
                    newScheduledEnd = formEndDate
                        ? fromDateToEndDatetime(formEndDate)
                        : fromDateToEndDatetime(formStartDate);
                }
            } else {
                // Timed event: use datetime inputs
                if (formStartDatetime) {
                    newScheduledStart = fromDatetimeLocal(formStartDatetime);
                }
                if (formEndDatetime) {
                    newScheduledEnd = fromDatetimeLocal(formEndDatetime);
                }
            }

            const updates: Parameters<typeof onScheduleChange>[0] = {
                scheduledStart: newScheduledStart,
                scheduledEnd: newScheduledEnd,
                isAllDay: formAllDay,
                // Clear deprecated fields when using new fields
                scheduledOn: null,
                startTime: null,
                endDate: null,
                endTime: null,
                duration: null,
            };

            // Include actual times if editing them
            if (showActualEdit) {
                updates.actualStart = formActualStart ? fromDatetimeLocal(formActualStart) : null;
                updates.actualEnd = formActualEnd ? fromDatetimeLocal(formActualEnd) : null;
            }

            await onScheduleChange(updates);
            setIsEditing(false);
        } catch (err) {
            console.error('Failed to update schedule:', err);
            setError(err instanceof Error ? err.message : 'Failed to update schedule');
        } finally {
            setLoading(false);
        }
    };

    const handleClear = async () => {
        try {
            setLoading(true);
            setError(null);
            await onScheduleChange({
                scheduledStart: null,
                scheduledEnd: null,
                isAllDay: false,
                actualStart: null,
                actualEnd: null,
                // Also clear deprecated fields
                scheduledOn: null,
                startTime: null,
                endDate: null,
                endTime: null,
                duration: null
            });
            setIsEditing(false);
        } catch (err) {
            console.error('Failed to clear schedule:', err);
            setError(err instanceof Error ? err.message : 'Failed to clear schedule');
        } finally {
            setLoading(false);
        }
    };

    const formatDisplay = () => {
        // Only use new scheduling fields (scheduledStart/scheduledEnd)
        // Deprecated fields (scheduledOn, startTime, etc.) are NOT displayed
        if (scheduledStart) {
            const startDate = scheduledStart.split('T')[0];
            const startTimeStr = scheduledStart.split('T')[1]?.slice(0, 5);
            const endDateStr = scheduledEnd?.split('T')[0];
            const endTimeStr = scheduledEnd?.split('T')[1]?.slice(0, 5);

            if (isAllDay) {
                if (endDateStr && endDateStr !== startDate) {
                    return `${startDate} - ${endDateStr} (All day)`;
                }
                return `${startDate} (All day)`;
            } else {
                let display = `${startDate} ${startTimeStr}`;
                if (endDateStr && endTimeStr) {
                    if (endDateStr === startDate) {
                        display += ` - ${endTimeStr}`;
                    } else {
                        display += ` - ${endDateStr} ${endTimeStr}`;
                    }
                }
                return display;
            }
        }

        return 'No schedule';
    };

    const formatActualDisplay = () => {
        if (!actualStart && !actualEnd) return null;
        const startStr = actualStart ? `${actualStart.split('T')[0]} ${actualStart.split('T')[1]?.slice(0, 5)}` : '';
        const endStr = actualEnd ? `${actualEnd.split('T')[0]} ${actualEnd.split('T')[1]?.slice(0, 5)}` : '';
        if (startStr && endStr) {
            return `Actual: ${startStr} - ${endStr}`;
        }
        if (startStr) return `Started: ${startStr}`;
        if (endStr) return `Ended: ${endStr}`;
        return null;
    };

    return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4" ref={containerRef}>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Schedule</h3>
                {loading && <span className="text-xs text-gray-500">Saving...</span>}
            </div>

            {error && (
                <div className="text-red-600 text-xs mb-2">{error}</div>
            )}

            {isEditing ? (
                <div className="flex flex-col space-y-3">
                    {/* All Day Toggle */}
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="all-day-toggle"
                            checked={formAllDay}
                            onChange={(e) => setFormAllDay(e.target.checked)}
                            className="h-4 w-4 text-github-green-600 focus:ring-github-green-500 border-gray-300 rounded"
                        />
                        <label htmlFor="all-day-toggle" className="ml-2 text-sm text-gray-700">
                            All day
                        </label>
                    </div>

                    {formAllDay ? (
                        /* All-day event: date inputs only */
                        <div className="grid grid-cols-2 gap-2">
                            <div className="min-w-0">
                                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={formStartDate}
                                    onChange={(e) => setFormStartDate(e.target.value)}
                                    className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 box-border overflow-hidden"
                                    style={{ WebkitAppearance: 'none', appearance: 'none' }}
                                    autoFocus
                                />
                            </div>
                            <div className="min-w-0">
                                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={formEndDate}
                                    onChange={(e) => setFormEndDate(e.target.value)}
                                    className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 box-border overflow-hidden"
                                    style={{ WebkitAppearance: 'none', appearance: 'none' }}
                                />
                            </div>
                        </div>
                    ) : (
                        /* Timed event: datetime inputs */
                        <div className="grid grid-cols-1 gap-2">
                            <div className="min-w-0">
                                <label className="block text-xs text-gray-500 mb-1">Start</label>
                                <input
                                    type="datetime-local"
                                    value={formStartDatetime}
                                    onChange={(e) => setFormStartDatetime(e.target.value)}
                                    className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 box-border overflow-hidden"
                                    style={{ WebkitAppearance: 'none', appearance: 'none' }}
                                    autoFocus
                                />
                            </div>
                            <div className="min-w-0">
                                <label className="block text-xs text-gray-500 mb-1">End</label>
                                <input
                                    type="datetime-local"
                                    value={formEndDatetime}
                                    onChange={(e) => setFormEndDatetime(e.target.value)}
                                    className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 box-border overflow-hidden"
                                    style={{ WebkitAppearance: 'none', appearance: 'none' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Actual Times Section (collapsible) */}
                    <div className="border-t border-gray-200 pt-3">
                        <button
                            type="button"
                            onClick={() => setShowActualEdit(!showActualEdit)}
                            className="flex items-center text-xs text-gray-500 hover:text-gray-700"
                        >
                            <svg
                                className={`w-3 h-3 mr-1 transition-transform ${showActualEdit ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            Actual execution times
                        </button>
                        {showActualEdit && (
                            <div className="grid grid-cols-1 gap-2 mt-2">
                                <div className="min-w-0">
                                    <label className="block text-xs text-gray-500 mb-1">Actual Start</label>
                                    <input
                                        type="datetime-local"
                                        value={formActualStart}
                                        onChange={(e) => setFormActualStart(e.target.value)}
                                        className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 box-border overflow-hidden"
                                        style={{ WebkitAppearance: 'none', appearance: 'none' }}
                                    />
                                </div>
                                <div className="min-w-0">
                                    <label className="block text-xs text-gray-500 mb-1">Actual End</label>
                                    <input
                                        type="datetime-local"
                                        value={formActualEnd}
                                        onChange={(e) => setFormActualEnd(e.target.value)}
                                        className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 box-border overflow-hidden"
                                        style={{ WebkitAppearance: 'none', appearance: 'none' }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end space-x-2 mt-2">
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-xs text-red-600 hover:text-red-800"
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="text-xs bg-github-green-600 text-white px-3 py-1 rounded hover:bg-github-green-700"
                        >
                            Save
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    onClick={() => setIsEditing(true)}
                    className="text-sm text-gray-700 hover:bg-gray-100 p-2 -mx-2 rounded cursor-pointer"
                >
                    <div className="flex items-center">
                        <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="ml-2">{formatDisplay()}</span>
                    </div>
                    {formatActualDisplay() && (
                        <div className="mt-1 ml-6 text-xs text-gray-500">
                            {formatActualDisplay()}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
