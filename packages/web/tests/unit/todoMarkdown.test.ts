import { describe, expect, it } from 'vitest';
import { enumerateTodos, moveTodo, toggleTodo } from '../../src/utils/todoMarkdown';

describe('enumerateTodos', () => {
  it('enumerates top-level todos with global index', () => {
    const md = '- [ ] A\n- [x] B\n- [ ] C';
    const items = enumerateTodos(md);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ todoIndex: 0, startLine: 0, checked: false, indent: 0, parentKey: 'root' });
    expect(items[1]).toMatchObject({ todoIndex: 1, startLine: 1, checked: true });
    expect(items[2]).toMatchObject({ todoIndex: 2, startLine: 2, checked: false });
  });

  it('handles nested todos with proper parentKey grouping', () => {
    const md = '- [ ] parent1\n  - [ ] child1a\n  - [x] child1b\n- [ ] parent2';
    const items = enumerateTodos(md);
    expect(items).toHaveLength(4);
    expect(items[0].parentKey).toBe('root');
    expect(items[1].parentKey).toBe(items[2].parentKey);
    expect(items[1].parentKey).not.toBe('root');
    expect(items[3].parentKey).toBe('root');
  });

  it('includes nested children in parent range', () => {
    const md = '- [ ] parent1\n  - [ ] child1a\n  - [ ] child1b\n- [ ] parent2';
    const items = enumerateTodos(md);
    expect(items[0].startLine).toBe(0);
    expect(items[0].endLineExclusive).toBe(3);
    expect(items[3].startLine).toBe(3);
  });

  it('skips todos inside code fences', () => {
    const md = '- [ ] real\n```\n- [ ] in-code\n```\n- [ ] also-real';
    const items = enumerateTodos(md);
    expect(items).toHaveLength(2);
    expect(items[0].startLine).toBe(0);
    expect(items[1].startLine).toBe(4);
  });

  it('skips todos inside tilde-fenced code blocks', () => {
    const md = '- [ ] real\n~~~\n- [ ] in-code\n~~~\n- [ ] also-real';
    const items = enumerateTodos(md);
    expect(items).toHaveLength(2);
  });

  it('skips todos inside blockquotes', () => {
    const md = '- [ ] real\n> - [ ] quoted\n- [ ] also-real';
    const items = enumerateTodos(md);
    expect(items).toHaveLength(2);
  });

  it('returns empty for body with no todos', () => {
    expect(enumerateTodos('plain text\n- regular list item')).toEqual([]);
  });

  it('handles uppercase X', () => {
    const items = enumerateTodos('- [X] big-x');
    expect(items).toHaveLength(1);
    expect(items[0].checked).toBe(true);
  });

  it('handles different list markers - * +', () => {
    const md = '- [ ] dash\n* [ ] star\n+ [ ] plus';
    const items = enumerateTodos(md);
    expect(items).toHaveLength(3);
  });
});

describe('toggleTodo', () => {
  it('toggles unchecked to checked at given index', () => {
    const md = '- [ ] A\n- [ ] B';
    expect(toggleTodo(md, 0)).toBe('- [x] A\n- [ ] B');
    expect(toggleTodo(md, 1)).toBe('- [ ] A\n- [x] B');
  });

  it('toggles checked to unchecked', () => {
    expect(toggleTodo('- [x] done', 0)).toBe('- [ ] done');
  });

  it('preserves surrounding content exactly', () => {
    const md = '# Heading\n\nSome **bold** text.\n\n- [ ] A\n  - body line\n- [x] B\n\nFootnote.';
    const result = toggleTodo(md, 0);
    expect(result).toBe('# Heading\n\nSome **bold** text.\n\n- [x] A\n  - body line\n- [x] B\n\nFootnote.');
  });

  it('ignores out-of-range index', () => {
    const md = '- [ ] A';
    expect(toggleTodo(md, 5)).toBe(md);
  });

  it('does not touch todos inside code fences', () => {
    const md = '- [ ] real\n```\n- [ ] in-code\n```';
    const result = toggleTodo(md, 0);
    expect(result).toBe('- [x] real\n```\n- [ ] in-code\n```');
  });

  it('preserves indent and marker char', () => {
    const md = '  * [ ] indented';
    expect(toggleTodo(md, 0)).toBe('  * [x] indented');
  });
});

describe('moveTodo', () => {
  it('reorders siblings at same parent level', () => {
    const md = '- [ ] A\n- [ ] B\n- [x] C';
    const r = moveTodo(md, 0, 2);
    expect(r.ok).toBe(true);
    expect(r.md).toBe('- [ ] B\n- [x] C\n- [ ] A');
  });

  it('moves item up', () => {
    const md = '- [ ] A\n- [ ] B\n- [x] C';
    const r = moveTodo(md, 2, 0);
    expect(r.ok).toBe(true);
    expect(r.md).toBe('- [x] C\n- [ ] A\n- [ ] B');
  });

  it('drags nested children with parent', () => {
    const md = '- [ ] parent1\n  - [ ] child1a\n  - [ ] child1b\n- [ ] parent2';
    const r = moveTodo(md, 0, 3);
    expect(r.ok).toBe(true);
    expect(r.md).toBe('- [ ] parent2\n- [ ] parent1\n  - [ ] child1a\n  - [ ] child1b');
  });

  it('refuses cross-parent move', () => {
    const md = '- [ ] parent1\n  - [ ] child1a\n- [ ] parent2';
    const r = moveTodo(md, 1, 2);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('cross-parent');
  });

  it('no-op when from === to', () => {
    const md = '- [ ] A\n- [ ] B';
    const r = moveTodo(md, 0, 0);
    expect(r.ok).toBe(true);
    expect(r.reason).toBe('no-op');
    expect(r.md).toBe(md);
  });

  it('returns out-of-range for invalid indices', () => {
    const md = '- [ ] A';
    expect(moveTodo(md, 0, 5).ok).toBe(false);
    expect(moveTodo(md, 5, 0).ok).toBe(false);
  });

  it('preserves nested siblings reorder within same parent', () => {
    const md = '- [ ] parent\n  - [ ] a\n  - [ ] b\n  - [ ] c';
    const r = moveTodo(md, 1, 3);
    expect(r.ok).toBe(true);
    expect(r.md).toBe('- [ ] parent\n  - [ ] b\n  - [ ] c\n  - [ ] a');
  });
});
