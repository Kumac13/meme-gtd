import { useState, useEffect } from 'react';
import { LabelsService } from '../api/services/LabelsService';
import { LabelBadge } from './LabelBadge';
import { FilterDropdown } from './FilterControls';

interface Label {
  id: number;
  name: string;
  taskCount: number;
  memoCount: number;
  articleCount: number;
}

interface LabelFilterDropdownProps {
  selectedLabels: Set<string>;
  onToggle: (labelName: string) => void;
  onClear: () => void;
  countKey: 'taskCount' | 'memoCount' | 'articleCount';
}

export default function LabelFilterDropdown({
  selectedLabels,
  onToggle,
  onClear,
  countKey,
}: LabelFilterDropdownProps) {
  const [labels, setLabels] = useState<Label[]>([]);

  useEffect(() => {
    LabelsService.listLabels()
      .then((data) => setLabels(data.map((l) => ({ id: l.id, name: l.name, taskCount: l.taskCount, memoCount: l.memoCount, articleCount: l.articleCount })).sort((a, b) => b[countKey] - a[countKey])))
      .catch(console.error);
  }, [countKey]);

  const count = selectedLabels.size;
  const buttonLabel = count === 0 ? 'Label' : `${count} Labels`;

  return (
    <FilterDropdown label={buttonLabel} active={count > 0} onClear={onClear} panelClassName="min-w-[220px] max-w-[360px] max-h-64 overflow-y-auto">
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
                <span className="ml-auto text-xs text-gray-400">{label[countKey]}</span>
              </button>
            ))
          )}
    </FilterDropdown>
  );
}
