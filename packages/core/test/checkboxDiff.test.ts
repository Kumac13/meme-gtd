import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isInteractiveTodoChange } from '../src/checkboxDiff.ts';

describe('isInteractiveTodoChange', () => {
  it('returns true when only checkbox state changed', () => {
    const before = '- [ ] A\n- [ ] B\n- [x] C';
    const after = '- [ ] A\n- [x] B\n- [x] C';
    assert.strictEqual(isInteractiveTodoChange(before, after), true);
  });

  it('returns true for x → space toggle', () => {
    assert.strictEqual(isInteractiveTodoChange('- [x] done', '- [ ] done'), true);
  });

  it('returns true when multiple checkboxes toggled', () => {
    const before = '- [ ] A\n- [ ] B\n- [ ] C';
    const after = '- [x] A\n- [x] B\n- [x] C';
    assert.strictEqual(isInteractiveTodoChange(before, after), true);
  });

  it('returns true when items reordered (drag-to-reorder is also interactive)', () => {
    const before = '- [ ] A\n- [x] B';
    const after = '- [x] B\n- [ ] A';
    assert.strictEqual(isInteractiveTodoChange(before, after), true);
  });

  it('returns true when nested children move with the parent in a reorder', () => {
    const before = '- [ ] parent1\n  - [ ] child1a\n  - [ ] child1b\n- [ ] parent2';
    const after = '- [ ] parent2\n- [ ] parent1\n  - [ ] child1a\n  - [ ] child1b';
    assert.strictEqual(isInteractiveTodoChange(before, after), true);
  });

  it('returns true when reorder and toggle are combined in one PATCH', () => {
    const before = '- [ ] A\n- [ ] B\n- [ ] C';
    const after = '- [x] C\n- [ ] A\n- [ ] B';
    assert.strictEqual(isInteractiveTodoChange(before, after), true);
  });

  it('returns false when text content changed alongside checkbox', () => {
    const before = '- [ ] A\n- [ ] B';
    const after = '- [x] A\n- [ ] B renamed';
    assert.strictEqual(isInteractiveTodoChange(before, after), false);
  });

  it('returns false when items added', () => {
    const before = '- [ ] A\n- [ ] B';
    const after = '- [x] A\n- [ ] B\n- [ ] C';
    assert.strictEqual(isInteractiveTodoChange(before, after), false);
  });

  it('returns false when items removed', () => {
    const before = '- [ ] A\n- [ ] B\n- [ ] C';
    const after = '- [x] A\n- [ ] B';
    assert.strictEqual(isInteractiveTodoChange(before, after), false);
  });

  it('returns false when inputs are identical', () => {
    assert.strictEqual(isInteractiveTodoChange('- [ ] same', '- [ ] same'), false);
  });

  it('returns false when either side is null', () => {
    assert.strictEqual(isInteractiveTodoChange(null, '- [ ] foo'), false);
    assert.strictEqual(isInteractiveTodoChange('- [ ] foo', null), false);
    assert.strictEqual(isInteractiveTodoChange(null, null), false);
  });

  it('handles uppercase X correctly', () => {
    assert.strictEqual(isInteractiveTodoChange('- [ ] x', '- [X] x'), true);
  });

  it('returns true with nested todos and surrounding markdown when only checkboxes change', () => {
    const before = '# Heading\n\n- [ ] parent1\n  - [ ] child1a\n  - [ ] child1b\n- [ ] parent2\n\nFootnote.';
    const after = '# Heading\n\n- [ ] parent1\n  - [x] child1a\n  - [ ] child1b\n- [ ] parent2\n\nFootnote.';
    assert.strictEqual(isInteractiveTodoChange(before, after), true);
  });

  it('returns false when a non-todo line is modified', () => {
    const before = '# Heading\n\n- [ ] A';
    const after = '# Heading edited\n\n- [x] A';
    assert.strictEqual(isInteractiveTodoChange(before, after), false);
  });

  it('returns false when a todo line inside a code fence is toggled (not interactive)', () => {
    const before = '```\n- [ ] code\n```\n- [ ] real';
    const after = '```\n- [x] code\n```\n- [ ] real';
    assert.strictEqual(isInteractiveTodoChange(before, after), false);
  });

  it('returns false when a todo line inside a blockquote is toggled (not interactive)', () => {
    const before = '> - [ ] quoted\n- [ ] real';
    const after = '> - [x] quoted\n- [ ] real';
    assert.strictEqual(isInteractiveTodoChange(before, after), false);
  });
});
