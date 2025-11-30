/**
 * UI Type Definitions for Link Management
 *
 * These types define the state managed within React components
 * for displaying and managing links between issues.
 */

/**
 * Link type - defines the relationship between issues
 */
export type LinkType = 'parent' | 'child' | 'relates' | 'derived_from';

/**
 * Direction of the link relative to the viewed issue
 */
export type Direction = 'outgoing' | 'incoming';

/**
 * Target issue information included in link responses
 */
export interface TargetIssue {
  /** Target issue ID */
  id: number;
  /** Target issue type */
  type: 'task' | 'memo';
  /** Target issue title (or preview text for memos) */
  title: string;
}

/**
 * Link display item - represents a link as displayed in the UI
 *
 * This is the primary model for rendering links in the LinkItem component.
 * The targetIssue object eliminates the need for additional API calls.
 */
export interface LinkDisplayItem {
  /** Unique link ID from database */
  id: number;
  /** Source issue ID (the issue being viewed) */
  sourceIssueId: number;
  /** Target issue ID (the linked issue) */
  targetIssueId: number;
  /** Type of relationship */
  linkType: LinkType;
  /** Direction relative to the viewed issue */
  direction: Direction;
  /** Target issue information (populated by API) */
  targetIssue: TargetIssue;
  /** Link creation timestamp */
  createdAt: string;
}

/**
 * Link creation form state - tracks the inline form flow
 *
 * Managed in the LinkSection component to control the multi-step
 * inline form for creating new links.
 */
export interface LinkCreationState {
  /** Whether the add link form is visible */
  isAdding: boolean;
  /** Selected link type (null until user selects) */
  selectedType: LinkType | null;
  /** User-entered target issue ID (as string for input binding) */
  targetId: string;
  /** API validation error message (null when no error) */
  error: string | null;
  /** Whether the create API call is in progress */
  isSubmitting: boolean;
}

/**
 * Delete confirmation state - tracks which link is being deleted
 *
 * Managed in the LinkItem component to handle inline deletion confirmation.
 */
export interface DeleteConfirmationState {
  /** Link ID being deleted (null when no deletion in progress) */
  linkId: number | null;
  /** Whether delete confirmation prompt is showing */
  isConfirming: boolean;
}

/**
 * Pending link - represents a link to be created with a new task
 *
 * Used in TaskForm to track links that will be created after
 * the task is successfully created.
 */
export interface PendingLink {
  /** Target issue ID to link to */
  targetIssueId: number;
  /** Type of relationship */
  linkType: LinkType;
  /** Target issue information (for display purposes) */
  targetIssue?: {
    id: number;
    type: 'task' | 'memo';
    title: string;
  };
}

/**
 * IssuePicker item - unified type for Task and Memo in the issue picker
 *
 * Used by IssuePicker component to display searchable/selectable issues.
 * For Memo items, title is derived from the first line of bodyMd.
 */
export interface IssuePickerItem {
  /** Issue ID */
  id: number;
  /** Issue type */
  type: 'task' | 'memo';
  /** Display title (Task: title, Memo: first line of bodyMd) */
  title: string;
  /** Status (Task only, null for Memo) */
  status: string | null;
  /** Last update timestamp for sorting */
  updatedAt: string;
}
