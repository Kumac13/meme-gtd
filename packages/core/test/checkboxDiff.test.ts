import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isCheckboxOnlyChange } from '../src/checkboxDiff.ts';

describe('isCheckboxOnlyChange', () => {
  it('returns true when only checkbox state changed', () => {
    const before = '- [ ] A\n- [ ] B\n- [x] C';
    const after = '- [ ] A\n- [x] B\n- [x] C';
    assert.strictEqual(isCheckboxOnlyChange(before, after), true);
  });

  it('returns true for x → space toggle', () => {
    assert.strictEqual(isCheckboxOnlyChange('- [x] done', '- [ ] done'), true);
  });

  it('returns true when multiple checkboxes toggled', () => {
    const before = '- [ ] A\n- [ ] B\n- [ ] C';
    const after = '- [x] A\n- [x] B\n- [x] C';
    assert.strictEqual(isCheckboxOnlyChange(before, after), true);
  });

  it('returns false when text content changed alongside checkbox', () => {
    const before = '- [ ] A\n- [ ] B';
    const after = '- [x] A\n- [ ] B renamed';
    assert.strictEqual(isCheckboxOnlyChange(before, after), false);
  });

  it('returns false when items added or removed', () => {
    const before = '- [ ] A\n- [ ] B';
    const after = '- [x] A\n- [ ] B\n- [ ] C';
    assert.strictEqual(isCheckboxOnlyChange(before, after), false);
  });

  it('returns false when items reordered (even if checkbox states the same)', () => {
    const before = '- [ ] A\n- [x] B';
    const after = '- [x] B\n- [ ] A';
    assert.strictEqual(isCheckboxOnlyChange(before, after), false);
  });

  it('returns false when inputs are identical', () => {
    assert.strictEqual(isCheckboxOnlyChange('- [ ] same', '- [ ] same'), false);
  });

  it('returns false when either side is null', () => {
    assert.strictEqual(isCheckboxOnlyChange(null, '- [ ] foo'), false);
    assert.strictEqual(isCheckboxOnlyChange('- [ ] foo', null), false);
    assert.strictEqual(isCheckboxOnlyChange(null, null), false);
  });

  it('handles uppercase X correctly', () => {
    assert.strictEqual(isCheckboxOnlyChange('- [ ] x', '- [X] x'), true);
  });

  it('handles nested todos and surrounding markdown', () => {
    const before = '# Heading\n\n- [ ] parent1\n  - [ ] child1a\n  - [ ] child1b\n- [ ] parent2\n\nFootnote.';
    const after = '# Heading\n\n- [ ] parent1\n  - [x] child1a\n  - [ ] child1b\n- [ ] parent2\n\nFootnote.';
    assert.strictEqual(isCheckboxOnlyChange(before, after), true);
  });

  it('returns false when a non-todo line is modified', () => {
    const before = '# Heading\n\n- [ ] A';
    const after = '# Heading edited\n\n- [x] A';
    assert.strictEqual(isCheckboxOnlyChange(before, after), false);
  });
});
