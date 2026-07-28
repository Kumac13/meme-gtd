import { describe, expect, it } from 'vitest';
import { buildCopyContent } from '../../src/utils/copyContent';

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
});
