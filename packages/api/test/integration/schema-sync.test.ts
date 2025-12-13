import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventTypeSchema, SourceTypeSchema } from '../../src/schemas/activityLogSchemas.js';
import { ALL_EVENT_TYPES, SOURCE_TYPES } from 'meme-gtd-shared';

/**
 * Schema Synchronization Tests
 *
 * These tests verify that API Zod schemas stay in sync with
 * TypeScript type definitions in the shared package.
 *
 * IMPORTANT: These tests use constants exported from meme-gtd-shared
 * as the single source of truth. When a new event type is added to
 * shared/types/activity-log.ts, these tests will FAIL until the
 * corresponding Zod schema in api/schemas/activityLogSchemas.ts is updated.
 */
describe('Schema Synchronization', () => {
  describe('EventTypeSchema must include all EventType values from shared', () => {
    // Test each event type from shared package
    for (const eventType of ALL_EVENT_TYPES) {
      it(`should accept "${eventType}"`, () => {
        const result = EventTypeSchema.safeParse(eventType);
        assert.ok(
          result.success,
          `EventTypeSchema must accept "${eventType}" from shared package. ` +
            `Error: ${!result.success ? JSON.stringify(result.error.issues) : ''}`
        );
      });
    }

    it('should have exactly the same number of values as shared ALL_EVENT_TYPES', () => {
      const schemaValues = EventTypeSchema.options;
      assert.strictEqual(
        schemaValues.length,
        ALL_EVENT_TYPES.length,
        `EventTypeSchema has ${schemaValues.length} values but shared ALL_EVENT_TYPES has ${ALL_EVENT_TYPES.length} values. ` +
          `\nSchema values: [${schemaValues.join(', ')}]` +
          `\nShared values: [${ALL_EVENT_TYPES.join(', ')}]`
      );
    });

    it('should not have any extra values not in shared ALL_EVENT_TYPES', () => {
      const schemaValues = EventTypeSchema.options;
      const sharedSet = new Set(ALL_EVENT_TYPES);
      const extraValues = schemaValues.filter((v: string) => !sharedSet.has(v as typeof ALL_EVENT_TYPES[number]));
      assert.strictEqual(
        extraValues.length,
        0,
        `EventTypeSchema has extra values not in shared: [${extraValues.join(', ')}]`
      );
    });
  });

  describe('SourceTypeSchema must include all SourceType values from shared', () => {
    for (const sourceType of SOURCE_TYPES) {
      it(`should accept "${sourceType}"`, () => {
        const result = SourceTypeSchema.safeParse(sourceType);
        assert.ok(
          result.success,
          `SourceTypeSchema must accept "${sourceType}" from shared package`
        );
      });
    }

    it('should have exactly the same number of values as shared SOURCE_TYPES', () => {
      const schemaValues = SourceTypeSchema.options;
      assert.strictEqual(
        schemaValues.length,
        SOURCE_TYPES.length,
        `SourceTypeSchema has ${schemaValues.length} values but shared SOURCE_TYPES has ${SOURCE_TYPES.length}`
      );
    });
  });
});
