import { useState, useEffect, useRef } from 'react';

interface ScheduleSectionProps {
    scheduledOn: string | null;
    startTime: string | null;
    endDate: string | null;
    endTime: string | null;
    duration: number | null;
    onScheduleChange: (updates: {
        scheduledOn?: string | null;
        startTime?: string | null;
        endDate?: string | null;
        endTime?: string | null;
        duration?: number | null;
    }) => Promise<void>;
}

export function ScheduleSection({ scheduledOn, startTime, endDate, endTime, duration, onScheduleChange }: ScheduleSectionProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Local state for form inputs
    const [formDate, setFormDate] = useState(scheduledOn || '');
    const [formEndDate, setFormEndDate] = useState(endDate || '');
    const [formStart, setFormStart] = useState(startTime || '');
    const [formEnd, setFormEnd] = useState(endTime || '');
    const [formDuration, setFormDuration] = useState(duration?.toString() || '');

    // Sync local state when props change
    useEffect(() => {
        setFormDate(scheduledOn || '');
        setFormEndDate(endDate || '');
        setFormStart(startTime || '');
        setFormEnd(endTime || '');
        setFormDuration(duration?.toString() || '');
    }, [scheduledOn, startTime, endDate, endTime, duration]);

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
            await onScheduleChange({
                scheduledOn: formDate || null,
                startTime: formStart || null,
                endDate: formEndDate || null,
                endTime: formEnd || null,
                duration: formDuration ? parseInt(formDuration, 10) : null
            });
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
        if (!scheduledOn) return 'No schedule';
        let display = scheduledOn;
        if (endDate && endDate !== scheduledOn) {
            display += ` - ${endDate}`;
        }
        if (startTime) {
            display += ` ${startTime}`;
            if (endTime) display += ` - ${endTime}`;
        }
        if (duration) {
            display += ` (${duration} min)`;
        }
        return display;
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
                <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                            <input
                                type="date"
                                value={formDate}
                                onChange={(e) => setFormDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">End Date</label>
                            <input
                                type="date"
                                value={formEndDate}
                                onChange={(e) => setFormEndDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                            <input
                                type="time"
                                value={formStart}
                                onChange={(e) => setFormStart(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">End Time</label>
                            <input
                                type="time"
                                value={formEnd}
                                onChange={(e) => setFormEnd(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Duration (min)</label>
                        <input
                            type="number"
                            value={formDuration}
                            onChange={(e) => setFormDuration(e.target.value)}
                            placeholder="e.g. 60"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500"
                        />
                    </div>

                    <div className="flex justify-end gap-2 mt-2">
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
                    className="text-sm text-gray-700 hover:bg-gray-100 p-2 -mx-2 rounded cursor-pointer flex items-center gap-2"
                >
                    <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{formatDisplay()}</span>
                </div>
            )}
        </div>
    );
}
