import { describe, it, expect } from 'vitest';
import {
  VALID_STATUSES,
  validateStatus,
  validateBookmarked,
  updateStatusParam,
  updateBookmarkedParam,
  type StatusFilter,
} from '../../src/utils/urlFilterHelpers';

describe('urlFilterHelpers', () => {
  describe('validateStatus', () => {
    it('should return "all" for null input', () => {
      expect(validateStatus(null)).toBe('all');
    });

    it('should return valid status values unchanged', () => {
      expect(validateStatus('open')).toBe('open');
      expect(validateStatus('next')).toBe('next');
      expect(validateStatus('waiting')).toBe('waiting');
      expect(validateStatus('scheduled')).toBe('scheduled');
      expect(validateStatus('done')).toBe('done');
      expect(validateStatus('canceled')).toBe('canceled');
    });

    it('should return "all" for invalid status (fallback behavior)', () => {
      expect(validateStatus('invalid')).toBe('all');
      expect(validateStatus('unknown')).toBe('all');
      expect(validateStatus('random')).toBe('all');
    });

    it('should return "all" for empty string', () => {
      expect(validateStatus('')).toBe('all');
    });
  });

  describe('validateBookmarked', () => {
    it('should return true for "true" string', () => {
      expect(validateBookmarked('true')).toBe(true);
    });

    it('should return false for "false" string', () => {
      expect(validateBookmarked('false')).toBe(false);
    });

    it('should return false for null input', () => {
      expect(validateBookmarked(null)).toBe(false);
    });

    it('should return false for other values', () => {
      expect(validateBookmarked('yes')).toBe(false);
      expect(validateBookmarked('1')).toBe(false);
      expect(validateBookmarked('True')).toBe(false);
      expect(validateBookmarked('')).toBe(false);
    });
  });

  describe('updateStatusParam', () => {
    it('should remove status parameter when set to "all"', () => {
      const params = new URLSearchParams('status=open');
      const updated = updateStatusParam(params, 'all');
      expect(updated.has('status')).toBe(false);
      expect(updated.toString()).toBe('');
    });

    it('should add status parameter when setting valid status', () => {
      const params = new URLSearchParams();
      const updated = updateStatusParam(params, 'open');
      expect(updated.get('status')).toBe('open');
      expect(updated.toString()).toBe('status=open');
    });

    it('should update existing status parameter', () => {
      const params = new URLSearchParams('status=open');
      const updated = updateStatusParam(params, 'done');
      expect(updated.get('status')).toBe('done');
      expect(updated.toString()).toBe('status=done');
    });

    it('should preserve other parameters when updating status', () => {
      const params = new URLSearchParams('status=open&bookmarked=true');
      const updated = updateStatusParam(params, 'done');
      expect(updated.get('status')).toBe('done');
      expect(updated.get('bookmarked')).toBe('true');
      expect(updated.toString()).toBe('status=done&bookmarked=true');
    });

    it('should preserve other parameters when removing status', () => {
      const params = new URLSearchParams('status=open&bookmarked=true');
      const updated = updateStatusParam(params, 'all');
      expect(updated.has('status')).toBe(false);
      expect(updated.get('bookmarked')).toBe('true');
      expect(updated.toString()).toBe('bookmarked=true');
    });

    it('should handle empty URLSearchParams', () => {
      const params = new URLSearchParams();
      const updated = updateStatusParam(params, 'open');
      expect(updated.get('status')).toBe('open');
    });
  });

  describe('updateBookmarkedParam', () => {
    it('should add bookmarked parameter when setting to true', () => {
      const params = new URLSearchParams();
      const updated = updateBookmarkedParam(params, true);
      expect(updated.get('bookmarked')).toBe('true');
      expect(updated.toString()).toBe('bookmarked=true');
    });

    it('should remove bookmarked parameter when setting to false', () => {
      const params = new URLSearchParams('bookmarked=true');
      const updated = updateBookmarkedParam(params, false);
      expect(updated.has('bookmarked')).toBe(false);
      expect(updated.toString()).toBe('');
    });

    it('should preserve other parameters when adding bookmarked', () => {
      const params = new URLSearchParams('status=open');
      const updated = updateBookmarkedParam(params, true);
      expect(updated.get('status')).toBe('open');
      expect(updated.get('bookmarked')).toBe('true');
      expect(updated.toString()).toBe('status=open&bookmarked=true');
    });

    it('should preserve other parameters when removing bookmarked', () => {
      const params = new URLSearchParams('status=open&bookmarked=true');
      const updated = updateBookmarkedParam(params, false);
      expect(updated.get('status')).toBe('open');
      expect(updated.has('bookmarked')).toBe(false);
      expect(updated.toString()).toBe('status=open');
    });

    it('should handle empty URLSearchParams', () => {
      const params = new URLSearchParams();
      const updated = updateBookmarkedParam(params, true);
      expect(updated.get('bookmarked')).toBe('true');
    });

    it('should handle toggling bookmarked multiple times', () => {
      let params = new URLSearchParams();
      params = updateBookmarkedParam(params, true);
      expect(params.get('bookmarked')).toBe('true');
      params = updateBookmarkedParam(params, false);
      expect(params.has('bookmarked')).toBe(false);
      params = updateBookmarkedParam(params, true);
      expect(params.get('bookmarked')).toBe('true');
    });
  });
});
