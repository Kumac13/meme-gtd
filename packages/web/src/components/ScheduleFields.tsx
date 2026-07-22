interface ScheduleDateTimeFieldsProps {
  idPrefix: string;
  allDay: boolean;
  onAllDayChange: (allDay: boolean) => void;
  start: string;
  onStartChange: (start: string) => void;
  end: string;
  onEndChange: (end: string) => void;
}

export function toDatetimeLocal(isoDatetime: string | null): string {
  return isoDatetime?.slice(0, 16) ?? '';
}

export function fromDatetimeLocal(value: string): string | null {
  return value ? `${value}:00` : null;
}

export function toAllDayBoundary(value: string, end: boolean): string | null {
  if (!value) return null;
  return `${value.split('T')[0]}T${end ? '23:59:59' : '00:00:00'}`;
}

/** Shared all-day toggle and scheduled start/end inputs for create and detail forms. */
export function ScheduleDateTimeFields({
  idPrefix,
  allDay,
  onAllDayChange,
  start,
  onStartChange,
  end,
  onEndChange,
}: ScheduleDateTimeFieldsProps) {
  return (
    <>
      <div className="flex items-center">
        <input
          type="checkbox"
          id={`${idPrefix}-all-day`}
          checked={allDay}
          onChange={(event) => onAllDayChange(event.target.checked)}
          className="h-4 w-4 text-github-green-600 focus:ring-github-green-500 border-gray-300 rounded"
        />
        <label htmlFor={`${idPrefix}-all-day`} className="ml-2 text-sm text-gray-700">All day</label>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {([
          ['Start', start, onStartChange],
          ['End', end, onEndChange],
        ] as const).map(([label, value, onChange]) => (
          <div className="min-w-0" key={label}>
            <label className="block text-xs text-gray-500 mb-1">{label}</label>
            <input
              type="datetime-local"
              name={`${idPrefix}-${label.toLowerCase()}-dt`}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              autoComplete="off"
              data-form-type="other"
              className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500 box-border overflow-hidden"
              style={{ WebkitAppearance: 'none', appearance: 'none' }}
            />
          </div>
        ))}
      </div>
    </>
  );
}
