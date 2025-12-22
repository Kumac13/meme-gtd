/**
 * UI Type Definitions for Link Management
 *
 * These types define the state managed within React components
 * for displaying and managing links between issues.
 */

import type { IssueType } from 'meme-gtd-shared';

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
interface TargetIssue {
  /** Target issue ID */
  id: number;
  /** Target issue type */
  type: IssueType;
  /** Target issue title (or preview text for memos) */
  title: string;
  /** Target issue status (null for memos/articles) */
  status: string | null;
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
 * Pending link - represents a link to be created with a new task
 *
 * Used in TaskForm to track links that will be created after
 * the task is successfully created.
 *
 * Discriminated union supporting both issue-to-issue links and external URL links.
 */
export type PendingLink = PendingIssueLink | PendingUrlLink;

/**
 * Pending issue link - link to another issue (task/memo/article)
 */
export interface PendingIssueLink {
  /** Discriminator for union type */
  linkKind: 'issue';
  /** Target issue ID to link to */
  targetIssueId: number;
  /** Type of relationship */
  linkType: LinkType;
  /** Target issue information (for display purposes) */
  targetIssue?: {
    id: number;
    type: IssueType;
    title: string;
  };
}

/**
 * Pending URL link - link to external website
 */
export interface PendingUrlLink {
  /** Discriminator for union type */
  linkKind: 'url';
  /** External URL */
  url: string;
  /** Display title (optional) */
  title?: string;
}

/**
 * Type guard for PendingIssueLink
 */
export function isPendingIssueLink(link: PendingLink): link is PendingIssueLink {
  return link.linkKind === 'issue';
}

/**
 * Type guard for PendingUrlLink
 */
export function isPendingUrlLink(link: PendingLink): link is PendingUrlLink {
  return link.linkKind === 'url';
}

/**
 * IssuePicker item - unified type for Task, Memo, and Article in the issue picker
 *
 * Used by IssuePicker component to display searchable/selectable issues.
 * For Memo items, title is derived from the first line of bodyMd.
 */
export interface IssuePickerItem {
  /** Issue ID */
  id: number;
  /** Issue type */
  type: IssueType;
  /** Display title (Task/Article: title, Memo: first line of bodyMd) */
  title: string;
  /** Status (Task only, null for Memo/Article) */
  status: string | null;
  /** Last update timestamp for sorting */
  updatedAt: string;
}

/**
 * URL Link display item - represents an external URL link in the UI
 */
export interface UrlLinkDisplayItem {
  /** Unique URL link ID from database */
  id: number;
  /** Parent issue ID */
  issueId: number;
  /** External URL */
  url: string;
  /** Display title (null = derive from URL hostname) */
  title: string | null;
  /** Link creation timestamp */
  createdAt: string;
}

