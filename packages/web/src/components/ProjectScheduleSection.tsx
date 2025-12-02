import { useState, useEffect, useRef } from 'react';

interface ProjectScheduleSectionProps {
    startDate: string | null;
    endDate: string | null;
    onScheduleChange: (updates: {
        startDate?: string | null;
        endDate?: string | null;
    }) => Promise<void>;
}

export function ProjectScheduleSection({ startDate, endDate, onScheduleChange }: ProjectScheduleSectionProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Local state for form inputs
    const [formStartDate, setFormStartDate] = useState(startDate || '');
    const [formEndDate, setFormEndDate] = useState(endDate || '');

    // Sync local state when props change
    useEffect(() => {
        setFormStartDate(startDate || '');
        setFormEndDate(endDate || '');
    }, [startDate, endDate]);

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
                startDate: formStartDate || null,
                endDate: formEndDate || null,
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
                startDate: null,
                endDate: null,
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
        if (!startDate && !endDate) return 'No schedule';
        if (startDate && endDate) {
            return `${startDate} - ${endDate}`;
        }
        if (startDate) return `From ${startDate}`;
        if (endDate) return `Until ${endDate}`;
        return 'No schedule';
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

                    {formStartDate && formEndDate && formStartDate > formEndDate && (
                        <p className="text-xs text-red-600">
                            Warning: Start date is after end date
                        </p>
                    )}

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
