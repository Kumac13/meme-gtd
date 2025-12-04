/**
 * Attachment storage utilities for meme-gtd
 * Handles file path generation and directory management for image attachments
 */

import { homedir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Get the base attachments directory path
 * @returns Absolute path to ~/.mgtd/attachments
 */
export function getAttachmentsDir(): string {
  return path.join(homedir(), '.mgtd', 'attachments');
}

/**
 * Get the attachments directory for a specific issue
 * @param issueId - The issue ID
 * @returns Absolute path to ~/.mgtd/attachments/{issueId}
 */
export function getIssueAttachmentsDir(issueId: number): string {
  return path.join(getAttachmentsDir(), String(issueId));
}

/**
 * Ensure the attachments directory exists for a specific issue
 * Creates the directory recursively if it doesn't exist
 * @param issueId - The issue ID
 * @returns The absolute path to the created/existing directory
 */
export async function ensureAttachmentsDir(issueId: number): Promise<string> {
  const dir = getIssueAttachmentsDir(issueId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Get the full file path for an attachment
 * @param issueId - The issue ID
 * @param filename - The filename (uuid.ext format)
 * @returns Absolute path to the attachment file
 */
export function getAttachmentPath(issueId: number, filename: string): string {
  return path.join(getIssueAttachmentsDir(issueId), filename);
}

/**
 * Check if an attachment file exists
 * @param issueId - The issue ID
 * @param filename - The filename
 * @returns True if the file exists
 */
export async function attachmentExists(issueId: number, filename: string): Promise<boolean> {
  try {
    await fs.access(getAttachmentPath(issueId, filename));
    return true;
  } catch {
    return false;
  }
}
