import { useRef, type KeyboardEvent } from 'react';
import { useAutoGrow } from '../hooks/useAutoGrow';

interface MobileFloatingComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void> | void;
  placeholder: string;
  submitLabel: string;
  disabled?: boolean;
  submitting?: boolean;
}

export default function MobileFloatingComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  submitLabel,
  disabled = false,
  submitting = false,
}: MobileFloatingComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(textareaRef, value);

  const canSubmit = value.trim().length > 0 && !disabled && !submitting;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (canSubmit) {
        void onSubmit();
      }
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 bg-gray-50 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-2">
      <div className="mx-auto max-w-4xl">
        <div className="relative rounded-2xl border border-gray-300 bg-white shadow-sm">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={placeholder}
            disabled={disabled || submitting}
            className="max-h-40 min-h-[44px] w-full resize-none rounded-2xl px-3 py-2 pr-12 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-github-green-500 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={!canSubmit}
            aria-label={submitLabel}
            className="absolute bottom-1.5 right-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-github-green-600 text-white hover:bg-github-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M1 8 15 1l-4 7 4 7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
