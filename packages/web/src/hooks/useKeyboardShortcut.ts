import { useCallback } from 'react';
import { isSubmitShortcut } from '../utils/keyboard';

interface UseKeyboardShortcutOptions {
  disabled?: boolean;
}

/**
 * Custom hook for Cmd/Ctrl+Enter keyboard shortcuts
 * @param callback - Function to call when shortcut is triggered
 * @param options - Configuration options
 * @returns Keyboard event handler
 */
export function useKeyboardShortcut(
  callback: () => void,
  options?: UseKeyboardShortcutOptions
) {
  return useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      if (options?.disabled) return;

      if (isSubmitShortcut(e)) {
        e.preventDefault(); // Prevent newline in textarea
        callback();
      }
    },
    [callback, options?.disabled]
  );
}
