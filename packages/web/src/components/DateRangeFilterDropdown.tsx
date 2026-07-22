import { useMemo } from 'react';
import { FilterDropdown } from './FilterControls';

interface DateRangeFilterDropdownProps {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
  onClear: () => void;
}

interface Preset {
  label: string;
  from: string;
  to: string;
}

function getPresets(): Preset[] {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth(); // 0-indexed

  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDayOfMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();

  const todayStr = `${thisYear}-${pad(thisMonth + 1)}-${pad(now.getDate())}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;

  // Monday-based week
  const day = now.getDay();
  const daysFromMonday = (day + 6) % 7;
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - daysFromMonday);
  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekStart.getDate() + 6);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(thisWeekStart.getDate() - 1);

  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  return [
    { label: 'Today', from: todayStr, to: todayStr },
    { label: 'Yesterday', from: yesterdayStr, to: yesterdayStr },
    { label: 'This Week', from: fmtDate(thisWeekStart), to: fmtDate(thisWeekEnd) },
    { label: 'Last Week', from: fmtDate(lastWeekStart), to: fmtDate(lastWeekEnd) },
    {
      label: 'This Month',
      from: `${thisYear}-${pad(thisMonth + 1)}-01`,
      to: `${thisYear}-${pad(thisMonth + 1)}-${lastDayOfMonth(thisYear, thisMonth)}`,
    },
    {
      label: 'Last Month',
      from: thisMonth === 0
        ? `${thisYear - 1}-12-01`
        : `${thisYear}-${pad(thisMonth)}-01`,
      to: thisMonth === 0
        ? `${thisYear - 1}-12-31`
        : `${thisYear}-${pad(thisMonth)}-${lastDayOfMonth(thisYear, thisMonth - 1)}`,
    },
    {
      label: 'This Year',
      from: `${thisYear}-01-01`,
      to: `${thisYear}-12-31`,
    },
    {
      label: 'Last Year',
      from: `${thisYear - 1}-01-01`,
      to: `${thisYear - 1}-12-31`,
    },
  ];
}

function formatButtonLabel(from: string, to: string, presets: Preset[]): string {
  if (!from && !to) return 'Schedule';

  // Check if it matches a preset
  const match = presets.find(p => p.from === from && p.to === to);
  if (match) return match.label;

  // Format dates for display
  if (from && to) {
    const fDate = new Date(from + 'T00:00:00');
    const tDate = new Date(to + 'T00:00:00');
    const fMonth = fDate.toLocaleString('en', { month: 'short' });
    const tMonth = tDate.toLocaleString('en', { month: 'short' });
    if (fDate.getFullYear() === tDate.getFullYear()) {
      if (fDate.getMonth() === tDate.getMonth()) {
        return `${fMonth} ${fDate.getFullYear()}`;
      }
      return `${fMonth} - ${tMonth} ${fDate.getFullYear()}`;
    }
    return `${fMonth} ${fDate.getFullYear()} - ${tMonth} ${tDate.getFullYear()}`;
  }
  if (from) return `From ${from}`;
  return `To ${to}`;
}

export default function DateRangeFilterDropdown({
  dateFrom,
  dateTo,
  onChange,
  onClear,
}: DateRangeFilterDropdownProps) {
  const presets = useMemo(() => getPresets(), []);
  const isActive = !!(dateFrom || dateTo);
  const buttonLabel = formatButtonLabel(dateFrom, dateTo, presets);

  const activePreset = presets.find(p => p.from === dateFrom && p.to === dateTo);

  return (
    <FilterDropdown label={buttonLabel} active={isActive} onClear={onClear}>
      {(close) => <>
          {/* Presets */}
          <div className="p-2 border-b border-gray-100">
            <div className="text-xs text-gray-400 px-1 mb-1">Presets</div>
            <div className="flex flex-wrap gap-1">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => { onChange(preset.from, preset.to); close(); }}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    activePreset?.label === preset.label
                      ? 'bg-github-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date inputs */}
          <div className="p-2">
            <div className="text-xs text-gray-400 px-1 mb-1">Custom Range</div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onChange(e.target.value, dateTo)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-github-green-500 focus:border-github-green-500"
              />
              <span className="text-xs text-gray-400">-</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onChange(dateFrom, e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-github-green-500 focus:border-github-green-500"
              />
            </div>
          </div>
      </>}
    </FilterDropdown>
  );
}
