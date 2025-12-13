import type { Comment } from '../components/CommentSection';

interface CopyContentOptions {
  title: string | null;
  body: string;
  comments?: Comment[];
}

/**
 * Builds formatted content for copying to clipboard
 * Format: # Title\n\n---\n\nBody\n\n## Comments\n\nComment1\n\n---\n\nComment2
 */
export function buildCopyContent({ title, body, comments = [] }: CopyContentOptions): string {
  const displayTitle = title || 'Untitled';
  let content = `# ${displayTitle}\n\n---\n\n${body}`;

  if (comments.length > 0) {
    const commentsText = comments.map((c) => c.bodyMd).join('\n\n---\n\n');
    content += `\n\n## Comments\n\n${commentsText}`;
  }

  return content;
}

/**
 * Copies item content (title, body, comments) to clipboard
 */
export async function copyItemContent(options: CopyContentOptions): Promise<void> {
  const content = buildCopyContent(options);
  await navigator.clipboard.writeText(content);
}
