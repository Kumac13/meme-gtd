import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useAutoGrow } from '../hooks/useAutoGrow';

interface MobileFloatingComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void> | void;
  placeholder: string;
  submitLabel: string;
  disabled?: boolean;
  submitting?: boolean;
  onOccupiedHeightChange?: (height: number) => void;
}

const AESTHETIC_GAP_PX = 20;
const KEYBOARD_THRESHOLD_PX = 120;

function readSafeAreaInsetBottom(): number {
  if (typeof window === 'undefined' || !window.document?.body) return 0;

  const probe = document.createElement('div');
  probe.style.position = 'fixed';
  probe.style.bottom = '0';
  probe.style.paddingBottom = 'env(safe-area-inset-bottom)';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  document.body.appendChild(probe);
  const safeArea = parseFloat(window.getComputedStyle(probe).paddingBottom || '0');
  probe.remove();
  return Number.isFinite(safeArea) ? safeArea : 0;
}

export default function MobileFloatingComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  submitLabel,
  disabled = false,
  submitting = false,
  onOccupiedHeightChange,
}: MobileFloatingComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);
  const [bottomPx, setBottomPx] = useState(AESTHETIC_GAP_PX);
  const [occupiedHeight, setOccupiedHeight] = useState(128);
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

  useEffect(() => {
    const safeAreaInsetBottom = readSafeAreaInsetBottom();
    let rafId: number | null = null;

    const updateMetrics = () => {
      const vv = window.visualViewport;
      const keyboardHeightRaw = isFocusedRef.current && vv
        ? Math.max(0, window.innerHeight - vv.height)
        : 0;
      const keyboardVisible = isFocusedRef.current && keyboardHeightRaw > KEYBOARD_THRESHOLD_PX;
      const keyboardHeight = keyboardVisible ? keyboardHeightRaw : 0;
      const nextBottom = keyboardHeight + safeAreaInsetBottom + (keyboardVisible ? 0 : AESTHETIC_GAP_PX);
      const panelHeight = panelRef.current?.offsetHeight ?? 0;
      const nextOccupiedHeight = Math.ceil(nextBottom + panelHeight);

      setBottomPx(nextBottom);
      setOccupiedHeight(nextOccupiedHeight);
    };

    const scheduleUpdate = () => {
      if (rafId != null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateMetrics();
      });
    };

    updateMetrics();

    const vv = window.visualViewport;
    vv?.addEventListener('resize', scheduleUpdate);
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('orientationchange', scheduleUpdate);

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    if (panelRef.current) {
      resizeObserver.observe(panelRef.current);
    }

    return () => {
      if (rafId != null) {
        window.cancelAnimationFrame(rafId);
      }
      vv?.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('orientationchange', scheduleUpdate);
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    onOccupiedHeightChange?.(occupiedHeight);
  }, [occupiedHeight, onOccupiedHeightChange]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-30 px-3"
      style={{ bottom: `${bottomPx}px` }}
    >
      <div className="mx-auto max-w-4xl">
        <div ref={panelRef} className="pointer-events-auto relative rounded-xl border border-gray-200 bg-white shadow-sm">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              isFocusedRef.current = true;
            }}
            onBlur={() => {
              isFocusedRef.current = false;
              const safe = readSafeAreaInsetBottom();
              const nextBottom = safe + AESTHETIC_GAP_PX;
              const panelHeight = panelRef.current?.offsetHeight ?? 0;
              setBottomPx(nextBottom);
              setOccupiedHeight(Math.ceil(nextBottom + panelHeight));
            }}
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
