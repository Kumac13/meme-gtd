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
  const submitButtonClass = canSubmit
    ? 'bg-github-green-600 text-white hover:bg-github-green-700'
    : 'bg-gray-300 text-white';

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (canSubmit) {
        void onSubmit();
      }
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(16px,calc(env(safe-area-inset-bottom,0px)+56px))] z-30 px-3">
      <div className="mx-auto max-w-4xl">
        <div className="pointer-events-auto relative rounded-xl border border-gray-200 bg-white shadow-sm">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={placeholder}
            disabled={disabled || submitting}
            className="min-h-[42px] w-full resize-none overflow-hidden appearance-none rounded-xl border-0 bg-transparent px-3 py-2 pr-12 text-sm text-gray-800 placeholder:text-gray-400 outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ outline: 'none', boxShadow: 'none', border: 'none' }}
          />
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={!canSubmit}
            aria-label={submitLabel}
            className={`absolute bottom-1.5 right-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full focus:outline-none focus:ring-0 ${submitButtonClass} ${canSubmit ? '' : 'cursor-not-allowed'}`}
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
