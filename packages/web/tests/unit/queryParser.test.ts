import { describe, it, expect } from 'vitest';
import { parseSearchQuery, type ParsedSearchQuery } from '../../src/utils/queryParser';

describe('queryParser', () => {
  describe('parseSearchQuery', () => {
    it('should return empty object for empty or whitespace-only string', () => {
      expect(parseSearchQuery('')).toEqual({});
      expect(parseSearchQuery('  ')).toEqual({});
    });

    it('should treat a single word as free-text', () => {
      expect(parseSearchQuery('authentication')).toEqual({
        freeText: 'authentication',
        rawQuery: 'authentication',
      });
    });

    it('should treat multi-word input as free-text', () => {
      expect(parseSearchQuery('OAuth login screen')).toEqual({
        freeText: 'OAuth login screen',
        rawQuery: 'OAuth login screen',
      });
    });

    it('should trim whitespace from the free-text but keep raw query intact', () => {
      const parsed: ParsedSearchQuery = parseSearchQuery('  login screen  ');
      expect(parsed.freeText).toBe('login screen');
      expect(parsed.rawQuery).toBe('  login screen  ');
    });

    it('should pass label: / status: substrings through as free-text (filters live in dropdown UI now)', () => {
      // The legacy `label:` / `status:` extraction was removed; structured
      // filters are owned by dedicated dropdowns. Anything typed in the
      // search box flows verbatim into freeText.
      expect(parseSearchQuery('label:bug status:open login screen')).toEqual({
        freeText: 'label:bug status:open login screen',
        rawQuery: 'label:bug status:open login screen',
      });
    });
  });
});
