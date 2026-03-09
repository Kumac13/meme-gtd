import { useState, useEffect, useRef } from 'react';

interface StatusDropdownProps {
  value: string;
  options: string[];
  labels: Record<string, string>;
  onChange: (status: string) => void;
}

export default function StatusDropdown({ value, options, labels, onChange }: StatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayLabel = labels[value] || value;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1 bg-github-green-600 text-white"
      >
        {displayLabel}
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-[160px] bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-64 overflow-y-auto">
          {options.map((status) => (
            <button
              key={status}
              onClick={() => {
                onChange(status);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                value === status ? 'font-semibold text-github-green-700 bg-gray-50' : 'text-gray-700'
              }`}
            >
              {value === status && (
                <svg className="w-4 h-4 shrink-0 text-github-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {value !== status && <span className="w-4 h-4 shrink-0" />}
              {labels[status] || status}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
