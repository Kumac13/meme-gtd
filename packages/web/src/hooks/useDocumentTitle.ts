import { useEffect } from 'react';

const BASE_TITLE = 'Mëmo';

/**
 * Custom hook to set the document title dynamically.
 * Format: "Mëmo - {title}" or just "Mëmo" if no title provided.
 *
 * @param title - The page-specific title to display
 * @param deps - Optional dependency array to control when title updates
 */
export function useDocumentTitle(title?: string | null, deps: unknown[] = []) {
  useEffect(() => {
    const previousTitle = document.title;

    if (title) {
      document.title = `${BASE_TITLE} - ${title}`;
    } else {
      document.title = BASE_TITLE;
    }

    // Restore original title on unmount
    return () => {
      document.title = previousTitle;
    };
  }, [title, ...deps]);
}

/**
 * Truncates text to a maximum length, adding ellipsis if needed.
 * Useful for memo bodies that don't have titles.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum length (default: 30)
 * @returns Truncated text with ellipsis if needed
 */
export function truncateForTitle(text: string, maxLength = 30): string {
  // Get first line only
  const firstLine = text.split('\n')[0].trim();

  if (firstLine.length <= maxLength) {
    return firstLine;
  }

  return firstLine.slice(0, maxLength).trim() + '...';
}
