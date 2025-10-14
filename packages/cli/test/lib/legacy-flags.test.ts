import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  detectLegacyFlags,
  formatLegacyFlagError,
  type LegacyFlagMapping
} from '../../src/lib/legacy-flags.js';

describe('detectLegacyFlags', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv.slice();
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('should detect --bodyFile flag', () => {
    process.argv = ['node', 'script.js', '--bodyFile', 'test.md'];

    const mappings: LegacyFlagMapping = {
      '--bodyFile': '--body-file'
    };

    const result = detectLegacyFlags(mappings);

    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.legacyFlag, '--bodyFile');
    assert.strictEqual(result.suggestion, '--body-file');
  });

  it('should detect --addLabel flag', () => {
    process.argv = ['node', 'script.js', '--addLabel', 'bug'];

    const mappings: LegacyFlagMapping = {
      '--addLabel': '--add-label'
    };

    const result = detectLegacyFlags(mappings);

    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.legacyFlag, '--addLabel');
    assert.strictEqual(result.suggestion, '--add-label');
  });

  it('should detect --setLabel flag with special message', () => {
    process.argv = ['node', 'script.js', '--setLabel', 'bug'];

    const mappings: LegacyFlagMapping = {
      '--setLabel': 'removed (use: mgtd memo label set)'
    };

    const result = detectLegacyFlags(mappings);

    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.legacyFlag, '--setLabel');
    assert.strictEqual(result.suggestion, 'removed (use: mgtd memo label set)');
  });

  it('should not detect when no legacy flags present', () => {
    process.argv = ['node', 'script.js', '--body-file', 'test.md'];

    const mappings: LegacyFlagMapping = {
      '--bodyFile': '--body-file'
    };

    const result = detectLegacyFlags(mappings);

    assert.strictEqual(result.detected, false);
  });

  it('should detect first matching legacy flag when multiple exist', () => {
    process.argv = ['node', 'script.js', '--bodyFile', 'test.md', '--addLabel', 'bug'];

    const mappings: LegacyFlagMapping = {
      '--bodyFile': '--body-file',
      '--addLabel': '--add-label'
    };

    const result = detectLegacyFlags(mappings);

    assert.strictEqual(result.detected, true);
    assert.strictEqual(result.legacyFlag, '--bodyFile');
  });
});

describe('formatLegacyFlagError', () => {
  it('should format regular rename error message', () => {
    const result = {
      detected: true,
      legacyFlag: '--bodyFile',
      suggestion: '--body-file'
    };

    const message = formatLegacyFlagError(result);

    assert.strictEqual(
      message,
      'Unknown flag: --bodyFile\nDid you mean: --body-file?'
    );
  });

  it('should format removed flag error message', () => {
    const result = {
      detected: true,
      legacyFlag: '--setLabel',
      suggestion: 'removed (use: mgtd memo label set)'
    };

    const message = formatLegacyFlagError(result);

    assert.strictEqual(
      message,
      '--setLabel has been removed.\nUse mgtd memo label set instead.'
    );
  });

  it('should return empty string when not detected', () => {
    const result = {
      detected: false
    };

    const message = formatLegacyFlagError(result);

    assert.strictEqual(message, '');
  });
});
