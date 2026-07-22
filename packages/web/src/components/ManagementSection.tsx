import { useRef, useState, type ReactNode } from 'react';
import { useOutsideClick } from '../hooks/useOutsideClick';

interface ManagementSectionProps {
  title: string;
  ariaLabel: string;
  loading: boolean;
  loadingMessage: string;
  error?: string | null;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchPlaceholder: string;
  summary: ReactNode;
  children: ReactNode;
}

/** Shared summary card and searchable management popover for issue metadata. */
export function ManagementSection({
  title,
  ariaLabel,
  loading,
  loadingMessage,
  error,
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder,
  summary,
  children,
}: ManagementSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useOutsideClick(rootRef, isOpen, () => setIsOpen(false));

  if (loading) {
    return <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 text-gray-500 text-sm">{loadingMessage}</div>;
  }

  return (
    <div className="relative" ref={rootRef}>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            className="p-1 rounded hover:bg-gray-200 transition-colors"
            aria-label={ariaLabel}
            title={ariaLabel}
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
        {error && <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">Error: {error}</div>}
        <div className="space-y-2">{summary}</div>
      </div>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 flex flex-col" style={{ maxHeight: '400px' }}>
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-github-green-500"
            />
          </div>
          <div className="overflow-y-auto p-2" style={{ maxHeight: '320px' }}>
            {error && <div className="p-2 mb-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">{error}</div>}
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
