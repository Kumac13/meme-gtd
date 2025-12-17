/**
 * Link Icon Utilities
 *
 * Provides SVG icons and labels for link types with direction awareness.
 * Icons follow GitHub's 16x16 viewBox pattern for consistency.
 */

import type { LinkType, Direction } from '../types/links';

/**
 * SVG Icon Components
 */

const IconParentOutgoing = () => (
  <svg className="w-4 h-4 inline-block" fill="currentColor" viewBox="0 0 16 16" aria-label="Parent (outgoing)">
    <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM4.5 7.5l3-3 .5.5-2.293 2.293H11v1H5.707L8 10.586l-.5.5-3-3z" />
  </svg>
);

const IconParentIncoming = () => (
  <svg className="w-4 h-4 inline-block" fill="currentColor" viewBox="0 0 16 16" aria-label="Parent (incoming)">
    <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM11.5 8.5l-3 3-.5-.5 2.293-2.293H5v-1h5.293L8 5.414l.5-.5 3 3z" />
  </svg>
);

const IconChildOutgoing = () => (
  <svg className="w-4 h-4 inline-block" fill="currentColor" viewBox="0 0 16 16" aria-label="Child (outgoing)">
    <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM11.5 8.5l-3 3-.5-.5 2.293-2.293H5v-1h5.293L8 5.414l.5-.5 3 3z" />
  </svg>
);

const IconChildIncoming = () => (
  <svg className="w-4 h-4 inline-block" fill="currentColor" viewBox="0 0 16 16" aria-label="Child (incoming)">
    <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM4.5 7.5l3-3 .5.5-2.293 2.293H11v1H5.707L8 10.586l-.5.5-3-3z" />
  </svg>
);

const IconRelated = () => (
  <svg className="w-4 h-4 inline-block" fill="currentColor" viewBox="0 0 16 16" aria-label="Related">
    <path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z"></path>
  </svg>
);

const IconDerivedFrom = () => (
  <svg className="w-4 h-4 inline-block" fill="currentColor" viewBox="0 0 16 16" aria-label="Derived from">
    <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM5.5 7.5l3-3 .5.5L6.707 7.5 11 7.5v1H6.707L9 10.793l-.5.5-3-3z" />
  </svg>
);

const IconExternalLink = () => (
  <svg className="w-4 h-4 inline-block" fill="currentColor" viewBox="0 0 16 16" aria-label="External link">
    <path d="M3.75 2h3.5a.75.75 0 010 1.5h-2.44l5.72 5.72a.75.75 0 11-1.06 1.06L3.75 4.56v2.44a.75.75 0 01-1.5 0v-3.5A1.5 1.5 0 013.75 2z"/>
    <path d="M6.75 5.5a.75.75 0 01.75-.75h5.75a2 2 0 012 2v5.5a2 2 0 01-2 2H7.75a2 2 0 01-2-2V9a.75.75 0 011.5 0v3.25a.5.5 0 00.5.5h5.5a.5.5 0 00.5-.5v-5.5a.5.5 0 00-.5-.5H7.5a.75.75 0 01-.75-.75z"/>
  </svg>
);

/**
 * Get the appropriate icon component for a link type and direction
 *
 * @param linkType - The type of link (parent, child, relates, derived_from)
 * @param direction - The direction of the link (outgoing, incoming)
 * @returns React element containing the appropriate SVG icon
 */
export function getLinkIcon(linkType: LinkType, direction: Direction): React.ReactElement {
  switch (linkType) {
    case 'parent':
      return direction === 'outgoing' ? <IconParentOutgoing /> : <IconParentIncoming />;
    case 'child':
      return direction === 'outgoing' ? <IconChildOutgoing /> : <IconChildIncoming />;
    case 'relates':
      return <IconRelated />;
    case 'derived_from':
      return <IconDerivedFrom />;
    default:
      // Fallback for unknown types
      return <IconRelated />;
  }
}

/**
 * Get a human-readable label for a link type with direction
 *
 * @param linkType - The type of link
 * @param direction - The direction of the link
 * @returns Human-readable label string
 */
export function getLinkLabel(linkType: LinkType, direction: Direction): string {
  switch (linkType) {
    case 'parent':
      return direction === 'outgoing' ? 'Parent of' : 'Child of';
    case 'child':
      return direction === 'outgoing' ? 'Child of' : 'Parent of';
    case 'relates':
      return 'Related to';
    case 'derived_from':
      return direction === 'outgoing' ? 'Derived from' : 'Source of';
    default:
      return 'Linked to';
  }
}

/**
 * Get direction arrow symbol for display
 *
 * @param direction - The direction of the link
 * @returns Arrow symbol (→ or ←)
 */
export function getDirectionArrow(direction: Direction): string {
  return direction === 'outgoing' ? '→' : '←';
}

/**
 * Get the external link icon component
 *
 * @returns React element containing the external link SVG icon
 */
export function getUrlLinkIcon(): React.ReactElement {
  return <IconExternalLink />;
}

/**
 * Get display label for a URL link
 *
 * @param title - User-provided title (may be null)
 * @param url - The URL string
 * @returns Display label (title or hostname derived from URL)
 */
export function getUrlLinkLabel(title: string | null, url: string): string {
  if (title) return title;
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return url.substring(0, 30);
  }
}

/**
 * Truncate URL for display
 *
 * @param url - The full URL
 * @param maxLength - Maximum length (default 60)
 * @returns Truncated URL string
 */
export function truncateUrl(url: string, maxLength = 60): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + '...';
}
