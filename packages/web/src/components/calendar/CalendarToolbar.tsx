import type { CalendarView } from '../../hooks/useCalendarState';

interface CalendarToolbarProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onToday: () => void;
  onPrevious: () => void;
  onNext: () => void;
  currentDate: string;
}

function formatDateLabel(date: string, view: CalendarView): string {
  const d = new Date(date);
  const options: Intl.DateTimeFormatOptions = { year: 'numeric' };

  if (view === 'month') {
    return d.toLocaleDateString('ja-JP', { ...options, month: 'long' });
  } else if (view === 'week') {
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - d.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const startMonth = startOfWeek.getMonth();
    const endMonth = endOfWeek.getMonth();

    if (startMonth === endMonth) {
      return `${startOfWeek.toLocaleDateString('ja-JP', { month: 'long', year: 'numeric' })} ${startOfWeek.getDate()}–${endOfWeek.getDate()}`;
    }
    return `${startOfWeek.toLocaleDateString('ja-JP', { month: 'short' })} ${startOfWeek.getDate()} – ${endOfWeek.toLocaleDateString('ja-JP', { month: 'short' })} ${endOfWeek.getDate()}, ${d.getFullYear()}`;
  } else {
    return d.toLocaleDateString('ja-JP', { ...options, month: 'long', day: 'numeric', weekday: 'long' });
  }
}

export default function CalendarToolbar({
  view,
  onViewChange,
  onToday,
  onPrevious,
  onNext,
  currentDate,
}: CalendarToolbarProps) {
  const viewOptions: { value: CalendarView; label: string }[] = [
    { value: 'month', label: 'Month' },
    { value: 'week', label: 'Week' },
    { value: 'day', label: 'Day' },
  ];

  return (
    <div className="flex items-center justify-between mb-4 p-2 bg-white rounded-lg shadow-sm">
      <div className="flex items-center gap-2">
        <button
          onClick={onToday}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500"
        >
          Today
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={onPrevious}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-github-green-500"
            aria-label="Previous"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={onNext}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-github-green-500"
            aria-label="Next"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <span className="text-lg font-semibold text-gray-900 ml-2">
          {formatDateLabel(currentDate, view)}
        </span>
      </div>
      <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
        {viewOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onViewChange(option.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              view === option.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
