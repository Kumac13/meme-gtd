import { describe, it, expect } from 'vitest';
import {
  parseSearchQuery,
  buildSearchQuery,
  isValidStatus,
  type ParsedSearchQuery,
} from '../../src/utils/queryParser';

describe('queryParser', () => {
  describe('parseSearchQuery', () => {
    it('should return empty object for empty string', () => {
      expect(parseSearchQuery('')).toEqual({});
      expect(parseSearchQuery('  ')).toEqual({});
    });

    it('should extract label filters', () => {
      expect(parseSearchQuery('label:bug')).toEqual({
        labels: ['bug'],
        rawQuery: 'label:bug',
      });

      expect(parseSearchQuery('label:bug,enhancement')).toEqual({
        labels: ['bug', 'enhancement'],
        rawQuery: 'label:bug,enhancement',
      });
    });

    it('should extract status filter', () => {
      expect(parseSearchQuery('status:open')).toEqual({
        status: 'open',
        rawQuery: 'status:open',
      });
    });

    it('should extract combined label and status filters', () => {
      expect(parseSearchQuery('label:bug status:open')).toEqual({
        labels: ['bug'],
        status: 'open',
        rawQuery: 'label:bug status:open',
      });
    });

    it('should extract free-text search terms', () => {
      expect(parseSearchQuery('login screen')).toEqual({
        freeText: 'login screen',
        rawQuery: 'login screen',
      });
    });

    it('should extract free-text with structured filters', () => {
      expect(parseSearchQuery('label:bug status:open login screen')).toEqual({
        labels: ['bug'],
        status: 'open',
        freeText: 'login screen',
        rawQuery: 'label:bug status:open login screen',
      });
    });

    it('should extract free-text from mixed order', () => {
      expect(parseSearchQuery('login label:bug screen status:open feature')).toEqual({
        labels: ['bug'],
        status: 'open',
        freeText: 'login  screen  feature',
        rawQuery: 'login label:bug screen status:open feature',
      });
    });

    it('should handle single word free-text', () => {
      expect(parseSearchQuery('authentication')).toEqual({
        freeText: 'authentication',
        rawQuery: 'authentication',
      });
    });

    it('should handle multi-word free-text', () => {
      expect(parseSearchQuery('OAuth login screen')).toEqual({
        freeText: 'OAuth login screen',
        rawQuery: 'OAuth login screen',
      });
    });

    it('should handle multiple label: filters', () => {
      expect(parseSearchQuery('label:bug label:urgent search terms')).toEqual({
        labels: ['bug', 'urgent'],
        freeText: 'search terms',
        rawQuery: 'label:bug label:urgent search terms',
      });
    });

    it('should trim whitespace from free-text', () => {
      expect(parseSearchQuery('  label:bug   login screen  ')).toEqual({
        labels: ['bug'],
        freeText: 'login screen',
        rawQuery: '  label:bug   login screen  ',
      });
    });

    it('should not include freeText if only structured filters', () => {
      expect(parseSearchQuery('label:bug status:open')).toEqual({
        labels: ['bug'],
        status: 'open',
        rawQuery: 'label:bug status:open',
      });
    });
  });

  describe('buildSearchQuery', () => {
    it('should build query from labels only', () => {
      expect(buildSearchQuery({ labels: ['bug'] })).toBe('label:bug');
      expect(buildSearchQuery({ labels: ['bug', 'enhancement'] })).toBe('label:bug,enhancement');
    });

    it('should build query from status only', () => {
      expect(buildSearchQuery({ status: 'open' })).toBe('status:open');
    });

    it('should build query from freeText only', () => {
      expect(buildSearchQuery({ freeText: 'login screen' })).toBe('login screen');
    });

    it('should build query from combined filters', () => {
      expect(buildSearchQuery({ labels: ['bug'], status: 'open' })).toBe('label:bug status:open');
    });

    it('should build query from all fields', () => {
      expect(buildSearchQuery({ labels: ['bug'], status: 'open', freeText: 'login screen' }))
        .toBe('label:bug status:open login screen');
    });

    it('should return empty string for empty filters', () => {
      expect(buildSearchQuery({})).toBe('');
    });
  });

  describe('isValidStatus', () => {
    it('should validate correct statuses', () => {
      expect(isValidStatus('open')).toBe(true);
      expect(isValidStatus('next')).toBe(true);
      expect(isValidStatus('waiting')).toBe(true);
      expect(isValidStatus('scheduled')).toBe(true);
      expect(isValidStatus('done')).toBe(true);
      expect(isValidStatus('canceled')).toBe(true);
    });

    it('should reject invalid statuses', () => {
      expect(isValidStatus('invalid')).toBe(false);
      expect(isValidStatus('unknown')).toBe(false);
      expect(isValidStatus('')).toBe(false);
    });
  });
});
