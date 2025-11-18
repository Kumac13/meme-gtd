import { describe, it, expect } from 'vitest';
import { formatAllContent } from '../../src/utils/markdownFormatter';

describe('formatAllContent', () => {
  it('should format task with title, body, and comments', () => {
    const result = formatAllContent({
      title: 'Test Task',
      bodyMd: 'Body content',
      comments: [
        { bodyMd: 'Comment 1', createdAt: '2025-11-18T10:00:00Z' },
        { bodyMd: 'Comment 2', createdAt: '2025-11-18T11:00:00Z' },
      ],
    });

    expect(result).toContain('# Test Task');
    expect(result).toContain('Body content');
    expect(result).toContain('## Comments');
    expect(result).toContain('### Comment 1 (2025-11-18T10:00:00Z)');
    expect(result).toContain('Comment 1');
    expect(result).toContain('### Comment 2 (2025-11-18T11:00:00Z)');
    expect(result).toContain('Comment 2');
  });

  it('should use default title for memo (title = null)', () => {
    const result = formatAllContent({
      title: null,
      bodyMd: 'Memo body',
      comments: [],
      itemId: 123,
    });

    expect(result).toContain('# Memo #123');
    expect(result).toContain('Memo body');
    expect(result).not.toContain('## Comments');
  });

  it('should omit comments section when empty', () => {
    const result = formatAllContent({
      title: 'Task',
      bodyMd: 'Body',
      comments: [],
    });

    expect(result).toContain('# Task');
    expect(result).toContain('Body');
    expect(result).not.toContain('## Comments');
  });

  it('should preserve special characters in content', () => {
    const result = formatAllContent({
      title: 'Task with **bold** and *italic*',
      bodyMd: '```javascript\nconsole.log("test");\n```',
      comments: [
        { bodyMd: '- [ ] checkbox\n- [x] checked', createdAt: '2025-11-18T12:00:00Z' },
      ],
    });

    expect(result).toContain('Task with **bold** and *italic*');
    expect(result).toContain('```javascript\nconsole.log("test");\n```');
    expect(result).toContain('- [ ] checkbox\n- [x] checked');
  });

  it('should handle empty body', () => {
    const result = formatAllContent({
      title: 'Task',
      bodyMd: '',
      comments: [],
    });

    expect(result).toBe('# Task');
  });

  it('should use "Unknown" when memo has no itemId', () => {
    const result = formatAllContent({
      title: null,
      bodyMd: 'Body',
      comments: [],
    });

    expect(result).toContain('# Memo #Unknown');
  });

  it('should format multiple comments in order', () => {
    const result = formatAllContent({
      title: 'Task',
      bodyMd: 'Body',
      comments: [
        { bodyMd: 'First', createdAt: '2025-11-18T10:00:00Z' },
        { bodyMd: 'Second', createdAt: '2025-11-18T11:00:00Z' },
        { bodyMd: 'Third', createdAt: '2025-11-18T12:00:00Z' },
      ],
    });

    const comment1Index = result.indexOf('### Comment 1');
    const comment2Index = result.indexOf('### Comment 2');
    const comment3Index = result.indexOf('### Comment 3');

    expect(comment1Index).toBeLessThan(comment2Index);
    expect(comment2Index).toBeLessThan(comment3Index);
  });
});
