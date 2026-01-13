import type { Comment } from '../components/CommentSection';

interface CopyContentOptions {
  title: string | null;
  body: string;
  comments?: Comment[];
  includeTitle?: boolean;
}

/**
 * Builds formatted content for copying to clipboard
 * Format with title: # Title\n\n---\n\nBody\n\n## Comments\n\nComment1\n\n---\n\nComment2
 * Format without title: Body\n\n## Comments\n\nComment1\n\n---\n\nComment2
 */
function buildCopyContent({
  title,
  body,
  comments = [],
  includeTitle = true,
}: CopyContentOptions): string {
  let content: string;

  if (includeTitle) {
    const displayTitle = title || 'Untitled';
    content = `# ${displayTitle}\n\n---\n\n${body}`;
  } else {
    content = body;
  }

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
