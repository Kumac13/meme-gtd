import { describe, it } from 'node:test';
import assert from 'node:assert';
import { maybePromptEditor, type EditorOptions } from '../../src/lib/editor.js';

describe('maybePromptEditor', () => {
  it('should throw error when both editor and noEditor are true', async () => {
    const options: EditorOptions = {
      editor: true,
      noEditor: true,
      initialContent: 'test'
    };

    await assert.rejects(
      async () => await maybePromptEditor(options),
      /Cannot specify both --editor and --no-editor/
    );
  });

  it('should return undefined when noEditor is true', async () => {
    const options: EditorOptions = {
      noEditor: true,
      initialContent: 'test content'
    };

    const result = await maybePromptEditor(options);
    assert.strictEqual(result, undefined);
  });

  it('should return undefined when noEditor is true even with editor flag', async () => {
    const options: EditorOptions = {
      editor: false,
      noEditor: true,
      initialContent: 'test'
    };

    const result = await maybePromptEditor(options);
    assert.strictEqual(result, undefined);
  });

  it('should return undefined when neither flag is set and initialContent exists', async () => {
    const options: EditorOptions = {
      initialContent: 'existing content'
    };

    const result = await maybePromptEditor(options);
    assert.strictEqual(result, undefined);
  });

  // Note: Tests that actually launch editor are skipped in automated testing
  // as they require interactive terminal. Manual testing required for:
  // - editor flag forces editor launch
  // - no initialContent triggers default editor launch
});
