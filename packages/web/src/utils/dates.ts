/**
 * Date formatting utilities for meme-gtd Web UI
 */

/**
 * Format ISO date string to human-readable format
 * @param isoString ISO 8601 date string (e.g., "2025-01-15T10:30:00Z")
 * @returns Formatted date string (e.g., "2025-01-15 10:30")
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Format ISO date string to date only (YYYY-MM-DD)
 * @param isoString ISO 8601 date string
 * @returns Date string (e.g., "2025-01-15")
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format ISO date string to relative time (e.g., "2 hours ago", "3 days ago")
 * @param isoString ISO 8601 date string
 * @returns Relative time string
 */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  } else if (diffDay < 7) {
    return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  } else {
    return formatDate(isoString);
  }
}

/**
 * Parse date input (YYYY-MM-DD) to ISO string
 * @param dateString Date string in YYYY-MM-DD format
 * @returns ISO 8601 date string
 */
export function parseDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString();
}

/**
 * Get current date in ISO format
 * @returns Current date as ISO 8601 string
 */
export function getCurrentDateTime(): string {
  return new Date().toISOString();
}

/**
 * Check if a date string is valid
 * @param dateString Date string to validate
 * @returns true if valid, false otherwise
 */
export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}
