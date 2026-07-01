import { describe, it, expect } from 'vitest';
import { buildMemoBodyFromTask } from '../../src/utils/archiveTaskToMemo';

describe('buildMemoBodyFromTask', () => {
  it('builds body with title only', () => {
    const task = { id: 1, title: 'Test Title', bodyMd: '' };
    const comments: never[] = [];

    const result = buildMemoBodyFromTask(task, comments);

    expect(result).toBe('# Test Title');
  });

  it('builds body with title and body', () => {
    const task = { id: 1, title: 'Test Title', bodyMd: 'Task body content' };
    const comments: never[] = [];

    const result = buildMemoBodyFromTask(task, comments);

    expect(result).toBe('# Test Title\n\nTask body content');
  });

  it('builds body with body only (no title)', () => {
    const task = { id: 1, title: null, bodyMd: 'Task body content' };
    const comments: never[] = [];

    const result = buildMemoBodyFromTask(task, comments);

    expect(result).toBe('Task body content');
  });

  it('builds body with comments', () => {
    const task = { id: 1, title: 'Test Title', bodyMd: 'Task body' };
    const comments = [
      { id: 1, bodyMd: 'First comment', createdAt: '2025-01-01T00:00:00Z' },
      { id: 2, bodyMd: 'Second comment', createdAt: '2025-01-02T00:00:00Z' },
    ];

    const result = buildMemoBodyFromTask(task, comments);

    expect(result).toContain('# Test Title');
    expect(result).toContain('Task body');
    expect(result).toContain('---');
    expect(result).toContain('## Comments');
    expect(result).toContain('### 2025-01-01T00:00:00Z');
    expect(result).toContain('First comment');
    expect(result).toContain('### 2025-01-02T00:00:00Z');
    expect(result).toContain('Second comment');
  });

  it('handles empty task', () => {
    const task = { id: 1, title: null, bodyMd: '' };
    const comments: never[] = [];

    const result = buildMemoBodyFromTask(task, comments);

    expect(result).toBe('');
  });

  it('handles comments only (no title, no body)', () => {
    const task = { id: 1, title: null, bodyMd: '' };
    const comments = [
      { id: 1, bodyMd: 'Comment content', createdAt: '2025-01-01T00:00:00Z' },
    ];

    const result = buildMemoBodyFromTask(task, comments);

    expect(result).toContain('---');
    expect(result).toContain('## Comments');
    expect(result).toContain('Comment content');
  });

  it('preserves markdown formatting in body', () => {
    const task = {
      id: 1,
      title: 'Test',
      bodyMd: '## Heading\n\n- Item 1\n- Item 2\n\n```code```',
    };
    const comments: never[] = [];

    const result = buildMemoBodyFromTask(task, comments);

    expect(result).toContain('## Heading');
    expect(result).toContain('- Item 1');
    expect(result).toContain('```code```');
  });
});
