export interface FormatAllContentInput {
  title: string | null;
  bodyMd: string;
  comments: Array<{
    bodyMd: string;
    createdAt: string;
  }>;
  itemId?: number;
}

export function formatAllContent({
  title,
  bodyMd,
  comments,
  itemId,
}: FormatAllContentInput): string {
  // メモの場合（title === null）、デフォルトタイトルを使用
  const heading = title || `Memo #${itemId || 'Unknown'}`;

  let markdown = `# ${heading}\n\n${bodyMd}`;

  if (comments.length > 0) {
    markdown += '\n\n## Comments\n';
    comments.forEach((comment, index) => {
      markdown += `\n### Comment ${index + 1} (${comment.createdAt})\n${comment.bodyMd}`;
    });
  }

  return markdown.trim();
}
