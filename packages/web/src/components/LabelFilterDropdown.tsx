import { useState, useEffect, useRef } from 'react';
import { LabelsService } from '../api/services/LabelsService';
import { LabelBadge } from './LabelBadge';

interface Label {
  id: number;
  name: string;
}

interface LabelFilterDropdownProps {
  selectedLabels: Set<string>;
  onToggle: (labelName: string) => void;
  onClear: () => void;
}

export default function LabelFilterDropdown({
  selectedLabels,
  onToggle,
  onClear,
}: LabelFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    LabelsService.listLabels()
      .then((data) => setLabels(data.map((l) => ({ id: l.id, name: l.name }))))
      .catch(console.error);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const count = selectedLabels.size;
  const buttonLabel = count === 0 ? 'Label' : `${count} Labels`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1 ${
          count > 0
            ? 'bg-github-green-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {buttonLabel}
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-[220px] max-w-[360px] bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-64 overflow-y-auto">
          {count > 0 && (
            <button
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 border-b border-gray-100"
            >
              Clear
            </button>
          )}
          {labels.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">No labels</div>
          ) : (
            labels.map((label) => (
              <button
                key={label.id}
                onClick={() => onToggle(label.name)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4 shrink-0"
                  viewBox="0 0 20 20"
                  fill={selectedLabels.has(label.name) ? 'currentColor' : 'none'}
                >
                  {selectedLabels.has(label.name) ? (
                    <path
                      className="text-github-green-600"
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  ) : (
                    <rect
                      x="3"
                      y="3"
                      width="14"
                      height="14"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-gray-300"
                    />
                  )}
                </svg>
                <LabelBadge name={label.name} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
