import type { ReactNode } from 'react';

interface SidePanelProps {
  header: ReactNode;
  children: ReactNode;
  onClose: () => void;
  contentClassName?: string;
}

/** Shared right-side overlay used by create and detail panels. */
export default function SidePanel({
  header,
  children,
  onClose,
  contentClassName = '',
}: SidePanelProps) {
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 sm:bg-transparent"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-1/2 bg-white shadow-xl border-l border-gray-200 z-50 flex flex-col overflow-hidden rounded-t-xl sm:rounded-none">
        <div className="flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0">
          <div className="min-w-0 flex-1">{header}</div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0 ml-2"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className={`flex-1 overflow-y-auto ${contentClassName}`}>{children}</div>
      </div>
    </>
  );
}
