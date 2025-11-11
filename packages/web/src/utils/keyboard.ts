/**
 * Detects if the user is on macOS
 */
export function isMacOS(): boolean {
  return /Mac|iPhone|iPod|iPad/.test(navigator.platform);
}

/**
 * Gets the keyboard shortcut hint for the current OS
 */
export function getShortcutHint(): string {
  return isMacOS() ? '⌘+Enter' : 'Ctrl+Enter';
}

/**
 * Checks if a keyboard event is Cmd/Ctrl+Enter
 */
export function isSubmitShortcut(e: React.KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && e.key === 'Enter';
}
