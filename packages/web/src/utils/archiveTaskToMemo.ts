/**
 * Utility functions for archiving a task to a memo
 */

interface Task {
  id: number;
  title: string | null;
  bodyMd: string;
}

interface Comment {
  id: number;
  bodyMd: string;
  createdAt: string;
}

/**
 * Build initial memo body from task content
 * Combines task title, body, and comments into a single markdown document
 */
export function buildMemoBodyFromTask(task: Task, comments: Comment[]): string {
  const parts: string[] = [];

  if (task.title) {
    parts.push(`# ${task.title}`);
    parts.push('');
  }

  if (task.bodyMd) {
    parts.push(task.bodyMd);
  }

  if (comments.length > 0) {
    parts.push('');
    parts.push('---');
    parts.push('## コメント');
    parts.push('');

    for (const comment of comments) {
      parts.push(`### ${comment.createdAt}`);
      parts.push(comment.bodyMd);
      parts.push('');
    }
  }

  return parts.join('\n').trim();
}
