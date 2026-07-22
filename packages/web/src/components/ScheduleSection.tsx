import { useState, useEffect } from 'react';
import type { TaskKind } from 'meme-gtd-shared';
import { EditableSectionCard } from './EditableSectionCard';
import {
    ScheduleDateTimeFields,
    fromDatetimeLocal,
    toAllDayBoundary,
    toDatetimeLocal,
} from './ScheduleFields';

interface ScheduleSectionProps {
    // Task Kind (event or action)
    taskKind: TaskKind;
    onTaskKindChange?: (taskKind: TaskKind) => Promise<void>;
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

export function ScheduleSection({
    taskKind,
    onTaskKindChange,
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

    // Local state for form inputs
    const [formTaskKind, setFormTaskKind] = useState<TaskKind>(taskKind);
    const [formAllDay, setFormAllDay] = useState(isAllDay);
    const [formStartDatetime, setFormStartDatetime] = useState(toDatetimeLocal(scheduledStart));
    const [formEndDatetime, setFormEndDatetime] = useState(toDatetimeLocal(scheduledEnd));
    // Actual times (for manual override)
    const [formActualStart, setFormActualStart] = useState(toDatetimeLocal(actualStart));
    const [formActualEnd, setFormActualEnd] = useState(toDatetimeLocal(actualEnd));

    // Sync local state when props change
    useEffect(() => {
        setFormTaskKind(taskKind);
        setFormAllDay(isAllDay);
        setFormStartDatetime(toDatetimeLocal(scheduledStart));
        setFormEndDatetime(toDatetimeLocal(scheduledEnd));
        setFormActualStart(toDatetimeLocal(actualStart));
        setFormActualEnd(toDatetimeLocal(actualEnd));
    }, [taskKind, scheduledStart, scheduledEnd, isAllDay, actualStart, actualEnd]);

    const handleSave = async () => {
        try {
            setLoading(true);
            setError(null);

            // Save taskKind if changed
            if (formTaskKind !== taskKind && onTaskKindChange) {
                await onTaskKindChange(formTaskKind);
            }

            let newScheduledStart: string | null = null;
            let newScheduledEnd: string | null = null;

            if (formStartDatetime) {
                if (formAllDay) {
                    newScheduledStart = toAllDayBoundary(formStartDatetime, false);
                } else {
                    newScheduledStart = fromDatetimeLocal(formStartDatetime);
                }
            }
            if (formEndDatetime) {
                if (formAllDay) {
                    newScheduledEnd = toAllDayBoundary(formEndDatetime, true);
                } else {
                    newScheduledEnd = fromDatetimeLocal(formEndDatetime);
                }
            } else if (formAllDay && formStartDatetime) {
                newScheduledEnd = toAllDayBoundary(formStartDatetime, true);
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

            // Always include actual times
            updates.actualStart = formActualStart ? fromDatetimeLocal(formActualStart) : null;
            updates.actualEnd = formActualEnd ? fromDatetimeLocal(formActualEnd) : null;

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
        <EditableSectionCard
            title="Schedule"
            isEditing={isEditing}
            onEditingChange={setIsEditing}
            loading={loading}
            error={error}
        >
            {isEditing ? (
                <div className="flex flex-col space-y-3">
                    {/* Kind Toggle */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Kind</label>
                        <div className="flex rounded-md border border-gray-300 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setFormTaskKind('action')}
                                className={`flex-1 px-3 py-1.5 text-sm ${
                                    formTaskKind === 'action'
                                        ? 'bg-github-green-600 text-white'
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                Action
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormTaskKind('event')}
                                className={`flex-1 px-3 py-1.5 text-sm border-l border-gray-300 ${
                                    formTaskKind === 'event'
                                        ? 'bg-github-green-600 text-white'
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                Event
                            </button>
                        </div>
                    </div>

                    <ScheduleDateTimeFields
                        idPrefix="schedule-section"
                        allDay={formAllDay}
                        onAllDayChange={setFormAllDay}
                        start={formStartDatetime}
                        onStartChange={setFormStartDatetime}
                        end={formEndDatetime}
                        onEndChange={setFormEndDatetime}
                    />

                    {/* Actual Times Section - always visible */}
                    <div className="border-t border-gray-200 pt-3">
                        <div className="grid grid-cols-1 gap-2">
                            <div className="min-w-0">
                                <label className="block text-xs text-gray-500 mb-1">Actual Start</label>
                                <input
                                    type="datetime-local"
                                    name="schedule-section-actual-start-dt"
                                    value={formActualStart}
                                    onChange={(e) => setFormActualStart(e.target.value)}
                                    autoComplete="off"
                                    data-form-type="other"
                                    className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 box-border overflow-hidden"
                                    style={{ WebkitAppearance: 'none', appearance: 'none' }}
                                />
                            </div>
                            <div className="min-w-0">
                                <label className="block text-xs text-gray-500 mb-1">Actual End</label>
                                <input
                                    type="datetime-local"
                                    name="schedule-section-actual-end-dt"
                                    value={formActualEnd}
                                    onChange={(e) => setFormActualEnd(e.target.value)}
                                    autoComplete="off"
                                    data-form-type="other"
                                    className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 box-border overflow-hidden"
                                    style={{ WebkitAppearance: 'none', appearance: 'none' }}
                                />
                            </div>
                        </div>
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
                    {/* Task Kind */}
                    <div className="flex items-center mb-1">
                        {taskKind === 'event' ? (
                            <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                        )}
                        <span className="ml-2">{taskKind === 'event' ? 'Event' : 'Action'}</span>
                    </div>
                    {/* Schedule */}
                    <div className="flex items-center">
                        <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
        </EditableSectionCard>
    );
}
