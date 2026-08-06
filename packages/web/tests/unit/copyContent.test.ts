import { describe, expect, it } from 'vitest';
import { buildCopyContent, buildCopyContentJSON } from '../../src/utils/copyContent';

describe('buildCopyContent', () => {
  it('includes every article content section', () => {
    expect(buildCopyContent({
      title: 'Testing React',
      sourceUrl: 'https://example.com/article',
      body: 'Article body',
      comments: [
        { id: 1, issueId: 42, bodyMd: 'First comment', createdAt: '', updatedAt: '' },
        { id: 2, issueId: 42, bodyMd: 'Second comment', createdAt: '', updatedAt: '' },
      ],
    })).toBe([
      '# Testing React',
      'Source: https://example.com/article',
      '---',
      'Article body',
      '## Comments',
      'First comment',
      '---',
      'Second comment',
    ].join('\n\n'));
  });

  it('preserves item dates and complete comment data in JSON', () => {
    const content = buildCopyContentJSON({
      item: {
        id: 42,
        type: 'task',
        title: 'Dated task',
        bodyMd: 'Task body',
        scheduledStart: '2026-08-06T09:30:00',
        createdAt: '2026-08-05T01:02:03.000Z',
        updatedAt: '2026-08-06T04:05:06.000Z',
      },
      comments: [
        {
          id: 7,
          issueId: 42,
          bodyMd: 'Comment body',
          createdAt: '2026-08-06T05:00:00.000Z',
          updatedAt: '2026-08-06T05:30:00.000Z',
        },
      ],
    });

    expect(JSON.parse(content)).toEqual({
      item: {
        id: 42,
        type: 'task',
        title: 'Dated task',
        bodyMd: 'Task body',
        scheduledStart: '2026-08-06T09:30:00',
        createdAt: '2026-08-05T01:02:03.000Z',
        updatedAt: '2026-08-06T04:05:06.000Z',
      },
      comments: [
        {
          id: 7,
          issueId: 42,
          bodyMd: 'Comment body',
          createdAt: '2026-08-06T05:00:00.000Z',
          updatedAt: '2026-08-06T05:30:00.000Z',
        },
      ],
    });
  });
});
