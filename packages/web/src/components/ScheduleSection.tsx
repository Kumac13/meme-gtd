import { useState, useEffect, useRef } from 'react';

interface ScheduleSectionProps {
    scheduledOn: string | null;
    onScheduleChange: (date: string | null) => Promise<void>;
}

export function ScheduleSection({ scheduledOn, onScheduleChange }: ScheduleSectionProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

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

    const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = e.target.value || null;
        try {
            setLoading(true);
            setError(null);
            await onScheduleChange(newDate);
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
            await onScheduleChange(null);
            setIsEditing(false);
        } catch (err) {
            console.error('Failed to clear schedule:', err);
            setError(err instanceof Error ? err.message : 'Failed to clear schedule');
        } finally {
            setLoading(false);
        }
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
                <div className="flex flex-col gap-2">
                    <input
                        type="date"
                        defaultValue={scheduledOn || ''}
                        onChange={handleDateChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500"
                        autoFocus
                    />
                    <div className="flex justify-end gap-2">
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
                    </div>
                </div>
            ) : (
                <div
                    onClick={() => setIsEditing(true)}
                    className="text-sm text-gray-700 hover:bg-gray-100 p-2 -mx-2 rounded cursor-pointer flex items-center gap-2"
                >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{scheduledOn || 'No schedule'}</span>
                </div>
            )}
        </div>
    );
}
