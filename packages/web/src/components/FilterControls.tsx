import { useRef, useState, type ReactNode } from 'react';
import { useOutsideClick } from '../hooks/useOutsideClick';

export function ToggleFilterButton({ active, onToggle, children }: { active: boolean; onToggle: () => void; children: ReactNode }) {
  return <button type="button" onClick={onToggle} className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${active ? 'bg-github-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{children}</button>;
}

/** Shared multi-select row for filter popovers. */
export function FilterOption({ selected, onToggle, children }: { selected: boolean; onToggle: () => void; children: ReactNode }) {
  return <button type="button" role="menuitemcheckbox" aria-checked={selected} onClick={onToggle} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill={selected ? 'currentColor' : 'none'}>
      {selected
        ? <path className="text-github-green-600" fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        : <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" className="text-gray-300" />}
    </svg>
    {children}
  </button>;
}

interface FilterDropdownProps {
  label: ReactNode;
  active: boolean;
  onClear: () => void;
  children: ReactNode | ((close: () => void) => ReactNode);
  panelClassName?: string;
}

/** Shared trigger, outside-dismiss, clear action and popover shell for list filters. */
export function FilterDropdown({ label, active, onClear, children, panelClassName = 'min-w-[280px]' }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useOutsideClick(rootRef, open, () => setOpen(false));

  return <div className="relative" ref={rootRef}>
    <button type="button" onClick={() => setOpen((value) => !value)} className={`px-3 py-1 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1 ${active ? 'bg-github-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
      {label}<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
    </button>
    {open && <div className={`absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 ${panelClassName}`}>
      {active && <button type="button" onClick={() => { onClear(); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 border-b border-gray-100">Clear</button>}
      {typeof children === 'function' ? children(() => setOpen(false)) : children}
    </div>}
  </div>;
}
