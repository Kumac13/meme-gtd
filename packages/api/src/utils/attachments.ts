/**
 * Attachment storage utilities for meme-gtd
 * Handles file path generation and directory management for image attachments
 *
 * Storage design: All attachments are stored in a flat directory structure
 * at ~/.mgtd/attachments/{uuid}.{ext}. This allows uploading images before
 * an issue is created (like GitHub's approach).
 */

import { homedir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Get the base attachments directory path
 * @returns Absolute path to ~/.mgtd/attachments
 */
function getAttachmentsDir(): string {
  return path.join(homedir(), '.mgtd', 'attachments');
}

/**
 * Ensure the attachments directory exists
 * Creates the directory recursively if it doesn't exist
 * @returns The absolute path to the created/existing directory
 */
export async function ensureAttachmentsDir(): Promise<string> {
  const dir = getAttachmentsDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Get the full file path for an attachment
 * @param filename - The filename (uuid.ext format)
 * @returns Absolute path to the attachment file
 */
export function getAttachmentPath(filename: string): string {
  return path.join(getAttachmentsDir(), filename);
}

/**
 * Check if an attachment file exists
 * @param filename - The filename
 * @returns True if the file exists
 */
export async function attachmentExists(filename: string): Promise<boolean> {
  try {
    await fs.access(getAttachmentPath(filename));
    return true;
  } catch {
    return false;
  }
}
