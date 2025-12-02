interface ScheduleInputProps {
    value: {
        scheduledOn: string;
        startTime: string;
        endDate: string;
        endTime: string;
        duration: string;
    };
    onChange: (value: ScheduleInputProps['value']) => void;
}

export function ScheduleInput({ value, onChange }: ScheduleInputProps) {
    const handleChange = (field: keyof ScheduleInputProps['value'], newValue: string) => {
        onChange({
            ...value,
            [field]: newValue,
        });
    };

    return (
        <div className="space-y-3 bg-white border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0">
                    <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                    <input
                        type="date"
                        value={value.scheduledOn}
                        onChange={(e) => handleChange('scheduledOn', e.target.value)}
                        className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 box-border overflow-hidden"
                        style={{ WebkitAppearance: 'none', appearance: 'none' }}
                    />
                </div>
                <div className="min-w-0">
                    <label className="block text-xs text-gray-500 mb-1">End Date</label>
                    <input
                        type="date"
                        value={value.endDate}
                        onChange={(e) => handleChange('endDate', e.target.value)}
                        className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 box-border overflow-hidden"
                        style={{ WebkitAppearance: 'none', appearance: 'none' }}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0">
                    <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                    <input
                        type="time"
                        value={value.startTime}
                        onChange={(e) => handleChange('startTime', e.target.value)}
                        className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 box-border overflow-hidden"
                        style={{ WebkitAppearance: 'none', appearance: 'none' }}
                    />
                </div>
                <div className="min-w-0">
                    <label className="block text-xs text-gray-500 mb-1">End Time</label>
                    <input
                        type="time"
                        value={value.endTime}
                        onChange={(e) => handleChange('endTime', e.target.value)}
                        className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 box-border overflow-hidden"
                        style={{ WebkitAppearance: 'none', appearance: 'none' }}
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs text-gray-500 mb-1">Duration (minutes)</label>
                <input
                    type="number"
                    value={value.duration}
                    onChange={(e) => handleChange('duration', e.target.value)}
                    placeholder="e.g. 60"
                    className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 box-border overflow-hidden"
                    style={{ WebkitAppearance: 'none', appearance: 'none' }}
                />
            </div>
        </div>
    );
}
