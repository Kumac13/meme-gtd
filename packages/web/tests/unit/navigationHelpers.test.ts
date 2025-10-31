/**
 * Unit tests for navigation helpers
 *
 * Tests filter encoding, decoding, and URL construction for
 * item list/detail navigation with filter preservation.
 */

import { describe, it, expect } from 'vitest';
import {
  encodeReturnFilters,
  decodeReturnFilters,
  createItemDetailUrl,
  createBackUrl,
} from '../../src/utils/navigationHelpers';

describe('navigationHelpers', () => {
  describe('encodeReturnFilters', () => {
    it('should encode valid filters', () => {
      const filters = new URLSearchParams('status=open&bookmarked=true');
      const result = encodeReturnFilters(filters);

      expect(result).toBe('status=open&bookmarked=true');
    });

    it('should encode single filter parameter', () => {
      const filters = new URLSearchParams('status=next');
      const result = encodeReturnFilters(filters);

      expect(result).toBe('status=next');
    });

    it('should encode bookmarked filter only', () => {
      const filters = new URLSearchParams('bookmarked=true');
      const result = encodeReturnFilters(filters);

      expect(result).toBe('bookmarked=true');
    });

    it('should handle invalid parameter names', () => {
      const filters = new URLSearchParams('invalid=value&status=open');
      const result = encodeReturnFilters(filters);

      // Only 'status' should pass through whitelist
      expect(result).toBe('status=open');
    });

    it('should filter out all invalid parameters', () => {
      const filters = new URLSearchParams('foo=bar&baz=qux');
      const result = encodeReturnFilters(filters);

      // Nothing passes whitelist
      expect(result).toBe('');
    });

    it('should handle empty filters', () => {
      const filters = new URLSearchParams('');
      const result = encodeReturnFilters(filters);

      expect(result).toBe('');
    });

    it('should handle XSS attempts', () => {
      const filters = new URLSearchParams('status=<script>alert(1)</script>');
      const result = encodeReturnFilters(filters);

      // Whitelist allows 'status' key, but value is URL-encoded by URLSearchParams
      expect(result).toContain('status=');
      expect(result).not.toContain('<script>');
    });

    it('should handle XSS in parameter names', () => {
      const filters = new URLSearchParams('<script>=value&bookmarked=true');
      const result = encodeReturnFilters(filters);

      // Only 'bookmarked' passes whitelist
      expect(result).toBe('bookmarked=true');
    });

    it('should preserve order of whitelisted parameters', () => {
      const filters = new URLSearchParams('bookmarked=true&status=waiting');
      const result = encodeReturnFilters(filters);

      // Should preserve both parameters
      expect(result).toContain('status=waiting');
      expect(result).toContain('bookmarked=true');
    });
  });

  describe('decodeReturnFilters', () => {
    it('should decode valid encoded filters for tasks', () => {
      const encoded = 'status=open&bookmarked=true';
      const result = decodeReturnFilters(encoded, 'task');

      expect(result.success).toBe(true);
      expect(result.filters).toEqual({
        status: 'open',
        bookmarked: 'true',
      });
      expect(result.error).toBeUndefined();
    });

    it('should decode single filter for tasks', () => {
      const encoded = 'status=next';
      const result = decodeReturnFilters(encoded, 'task');

      expect(result.success).toBe(true);
      expect(result.filters).toEqual({ status: 'next' });
    });

    it('should decode bookmarked filter for memos', () => {
      const encoded = 'bookmarked=true';
      const result = decodeReturnFilters(encoded, 'memo');

      expect(result.success).toBe(true);
      expect(result.filters).toEqual({ bookmarked: 'true' });
    });

    it('should decode bookmarked filter for projects', () => {
      const encoded = 'bookmarked=true';
      const result = decodeReturnFilters(encoded, 'project');

      expect(result.success).toBe(true);
      expect(result.filters).toEqual({ bookmarked: 'true' });
    });

    it('should apply item-type-specific validation for tasks', () => {
      const encoded = 'status=open&bookmarked=true&invalid=value';
      const result = decodeReturnFilters(encoded, 'task');

      expect(result.success).toBe(true);
      expect(result.filters).toEqual({
        status: 'open',
        bookmarked: 'true',
      });
      // 'invalid' parameter should be filtered out
      expect(result.filters).not.toHaveProperty('invalid');
    });

    it('should apply item-type-specific validation for memos (status rejected)', () => {
      const encoded = 'status=open&bookmarked=true';
      const result = decodeReturnFilters(encoded, 'memo');

      expect(result.success).toBe(true);
      expect(result.filters).toEqual({ bookmarked: 'true' });
      // 'status' should be filtered out for memos
      expect(result.filters).not.toHaveProperty('status');
    });

    it('should apply item-type-specific validation for projects (status rejected)', () => {
      const encoded = 'status=open&bookmarked=true';
      const result = decodeReturnFilters(encoded, 'project');

      expect(result.success).toBe(true);
      expect(result.filters).toEqual({ bookmarked: 'true' });
      // 'status' should be filtered out for projects
      expect(result.filters).not.toHaveProperty('status');
    });

    it('should handle empty encoded string', () => {
      const encoded = '';
      const result = decodeReturnFilters(encoded, 'task');

      expect(result.success).toBe(true);
      expect(result.filters).toEqual({});
    });

    it('should handle URL-encoded values', () => {
      const encoded = 'status=open&bookmarked=true';
      const result = decodeReturnFilters(encoded, 'task');

      expect(result.success).toBe(true);
      expect(result.filters.status).toBe('open');
    });

    it('should sanitize invalid parameters and log', () => {
      // Spy on console.error to verify logging
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const encoded = 'invalid1=val1&status=open&invalid2=val2';
      const result = decodeReturnFilters(encoded, 'task');

      expect(result.success).toBe(true);
      expect(result.filters).toEqual({ status: 'open' });

      // Verify error logging occurred
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ReturnFilters] Validation removed invalid parameters:',
        expect.objectContaining({
          itemType: 'task',
          encoded,
          allowedParams: ['status', 'bookmarked'],
        })
      );

      consoleSpy.mockRestore();
    });

    it('should handle malformed percent encoding gracefully', () => {
      // Intentionally malformed - but URLSearchParams handles it
      const encoded = 'status=%invalid';
      const result = decodeReturnFilters(encoded, 'task');

      // URLSearchParams treats this as literal "%invalid"
      expect(result.success).toBe(true);
      expect(result.filters).toHaveProperty('status');
    });

    it('should return empty filters when all parameters invalid', () => {
      const encoded = 'foo=bar&baz=qux';
      const result = decodeReturnFilters(encoded, 'task');

      expect(result.success).toBe(true);
      expect(result.filters).toEqual({});
    });
  });

  describe('createItemDetailUrl', () => {
    it('should create URL with filters', () => {
      const filters = new URLSearchParams('status=open&bookmarked=true');
      const result = createItemDetailUrl({
        basePath: '/tasks/',
        itemId: 123,
        currentFilters: filters,
      });

      expect(result).toBe('/tasks/123?returnFilters=status%3Dopen%26bookmarked%3Dtrue');
    });

    it('should create URL with single filter', () => {
      const filters = new URLSearchParams('status=next');
      const result = createItemDetailUrl({
        basePath: '/tasks/',
        itemId: 456,
        currentFilters: filters,
      });

      expect(result).toBe('/tasks/456?returnFilters=status%3Dnext');
    });

    it('should create URL without filters', () => {
      const result = createItemDetailUrl({
        basePath: '/tasks/',
        itemId: 123,
        currentFilters: undefined,
      });

      expect(result).toBe('/tasks/123');
    });

    it('should create URL with empty filters', () => {
      const filters = new URLSearchParams('');
      const result = createItemDetailUrl({
        basePath: '/tasks/',
        itemId: 123,
        currentFilters: filters,
      });

      expect(result).toBe('/tasks/123');
    });

    it('should handle basePath with trailing slash', () => {
      const filters = new URLSearchParams('bookmarked=true');
      const result = createItemDetailUrl({
        basePath: '/memos/',
        itemId: 789,
        currentFilters: filters,
      });

      expect(result).toBe('/memos/789?returnFilters=bookmarked%3Dtrue');
    });

    it('should handle basePath without trailing slash', () => {
      const filters = new URLSearchParams('bookmarked=true');
      const result = createItemDetailUrl({
        basePath: '/memos',
        itemId: 789,
        currentFilters: filters,
      });

      expect(result).toBe('/memos/789?returnFilters=bookmarked%3Dtrue');
    });

    it('should handle different item types (tasks)', () => {
      const filters = new URLSearchParams('status=waiting');
      const result = createItemDetailUrl({
        basePath: '/tasks/',
        itemId: 100,
        currentFilters: filters,
      });

      expect(result).toContain('/tasks/100');
      expect(result).toContain('returnFilters=');
    });

    it('should handle different item types (memos)', () => {
      const filters = new URLSearchParams('bookmarked=true');
      const result = createItemDetailUrl({
        basePath: '/memos/',
        itemId: 200,
        currentFilters: filters,
      });

      expect(result).toContain('/memos/200');
      expect(result).toContain('returnFilters=');
    });

    it('should handle different item types (projects)', () => {
      const filters = new URLSearchParams('bookmarked=true');
      const result = createItemDetailUrl({
        basePath: '/projects/',
        itemId: 300,
        currentFilters: filters,
      });

      expect(result).toContain('/projects/300');
      expect(result).toContain('returnFilters=');
    });

    it('should filter out invalid parameters', () => {
      const filters = new URLSearchParams('status=open&invalid=value');
      const result = createItemDetailUrl({
        basePath: '/tasks/',
        itemId: 123,
        currentFilters: filters,
      });

      // Should only encode 'status' (whitelist)
      expect(result).toContain('status%3Dopen');
      expect(result).not.toContain('invalid');
    });

    it('should handle string item IDs', () => {
      const filters = new URLSearchParams('bookmarked=true');
      const result = createItemDetailUrl({
        basePath: '/tasks/',
        itemId: 'abc-123',
        currentFilters: filters,
      });

      expect(result).toContain('/tasks/abc-123');
    });
  });

  describe('createBackUrl', () => {
    it('should create URL with filters', () => {
      const encoded = 'status%3Dopen%26bookmarked%3Dtrue';
      const result = createBackUrl({
        basePath: '/tasks/',
        returnFiltersEncoded: encoded,
      });

      expect(result).toBe('/tasks/?status=open&bookmarked=true');
    });

    it('should create URL with single filter', () => {
      const encoded = 'status%3Dnext';
      const result = createBackUrl({
        basePath: '/tasks/',
        returnFiltersEncoded: encoded,
      });

      expect(result).toBe('/tasks/?status=next');
    });

    it('should create URL without filters', () => {
      const result = createBackUrl({
        basePath: '/tasks/',
        returnFiltersEncoded: undefined,
      });

      expect(result).toBe('/tasks/');
    });

    it('should create URL with empty encoded string', () => {
      const result = createBackUrl({
        basePath: '/tasks/',
        returnFiltersEncoded: '',
      });

      expect(result).toBe('/tasks/');
    });

    it('should create URL with null returnFilters', () => {
      const result = createBackUrl({
        basePath: '/tasks/',
        returnFiltersEncoded: null,
      });

      expect(result).toBe('/tasks/');
    });

    it('should handle different item types (memos)', () => {
      const encoded = 'bookmarked%3Dtrue';
      const result = createBackUrl({
        basePath: '/memos/',
        returnFiltersEncoded: encoded,
      });

      expect(result).toBe('/memos/?bookmarked=true');
    });

    it('should handle different item types (projects)', () => {
      const encoded = 'bookmarked%3Dtrue';
      const result = createBackUrl({
        basePath: '/projects/',
        returnFiltersEncoded: encoded,
      });

      expect(result).toBe('/projects/?bookmarked=true');
    });

    it('should handle invalid encoded strings gracefully', () => {
      // Spy on console.error to verify logging
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const encoded = '%invalid%encoding%';
      const result = createBackUrl({
        basePath: '/tasks/',
        returnFiltersEncoded: encoded,
      });

      // Should fall back to base path on decoding error
      expect(result).toBe('/tasks/');

      // Verify error logging
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ReturnFilters] Failed to decode returnFilters for back URL:',
        expect.objectContaining({
          returnFiltersEncoded: encoded,
        })
      );

      consoleSpy.mockRestore();
    });

    it('should preserve basePath format', () => {
      const encoded = 'status%3Dopen';
      const result = createBackUrl({
        basePath: '/tasks/',
        returnFiltersEncoded: encoded,
      });

      expect(result.startsWith('/tasks/')).toBe(true);
    });

    it('should decode complex filter combinations', () => {
      const encoded = 'status%3Dscheduled%26bookmarked%3Dtrue';
      const result = createBackUrl({
        basePath: '/tasks/',
        returnFiltersEncoded: encoded,
      });

      expect(result).toBe('/tasks/?status=scheduled&bookmarked=true');
    });
  });
});
