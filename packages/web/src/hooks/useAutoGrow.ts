import { useLayoutEffect, type RefObject } from 'react';

/**
 * Auto-grow a textarea based on its content.
 * Sets height to match scrollHeight, respecting CSS min-height.
 * Uses useLayoutEffect to avoid visual flash on remount.
 *
 * @param ref - Ref to the textarea element
 * @param value - Current textarea value (triggers recalculation on change)
 * @param trigger - Additional value to trigger recalculation (e.g., tab mode)
 */
export function useAutoGrow(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  trigger?: unknown
): void {
  useLayoutEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [ref, value, trigger]);
}
