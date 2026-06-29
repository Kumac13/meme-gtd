interface TodoItem {
  todoIndex: number;
  startLine: number;
  endLineExclusive: number;
  indent: number;
  parentKey: string;
  checked: boolean;
}

export interface MoveTodoResult {
  md: string;
  ok: boolean;
  reason?: 'cross-parent' | 'out-of-range' | 'no-op';
}

const TODO_LINE_RE = /^(\s*)([-*+])(\s+)\[([ xX])\](\s+)/;
const LIST_ITEM_RE = /^(\s*)[-*+]\s+/;
const FENCE_RE = /^\s*(```|~~~)/;
const BLOCKQUOTE_RE = /^\s*>/;

interface RawTodo {
  startLine: number;
  indent: number;
  checked: boolean;
}

function scanRawTodos(lines: string[]): RawTodo[] {
  const out: RawTodo[] = [];
  let inFence = false;
  let fenceMarker: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(FENCE_RE);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = null;
      }
      continue;
    }
    if (inFence) continue;
    if (BLOCKQUOTE_RE.test(line)) continue;
    const m = line.match(TODO_LINE_RE);
    if (m) {
      out.push({
        startLine: i,
        indent: m[1].length,
        checked: m[4] === 'x' || m[4] === 'X',
      });
    }
  }
  return out;
}

function computeRange(
  lines: string[],
  startLine: number,
  indent: number,
  nextSiblingStart: number,
): number {
  let end = startLine + 1;
  while (end < nextSiblingStart) {
    const line = lines[end];
    if (line.length === 0) {
      let j = end + 1;
      while (j < nextSiblingStart && lines[j].length === 0) j++;
      if (j >= nextSiblingStart) break;
      const leading = lines[j].match(/^(\s*)/);
      const nextIndent = leading ? leading[1].length : 0;
      if (nextIndent > indent) {
        end = j;
        continue;
      }
      break;
    }
    const leading = line.match(/^(\s*)/);
    const lineIndent = leading ? leading[1].length : 0;
    if (lineIndent <= indent && LIST_ITEM_RE.test(line)) break;
    end++;
  }
  return end;
}

export function enumerateTodos(md: string): TodoItem[] {
  const lines = md.split('\n');
  const raw = scanRawTodos(lines);
  const items: TodoItem[] = [];
  const indentStack: { indent: number; key: string }[] = [];

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    while (indentStack.length && indentStack[indentStack.length - 1].indent >= r.indent) {
      indentStack.pop();
    }
    const parentKey = indentStack.length === 0 ? 'root' : indentStack[indentStack.length - 1].key;
    const myKey = `${parentKey}/${r.indent}@${r.startLine}`;
    let nextSiblingStart = lines.length;
    for (let j = i + 1; j < raw.length; j++) {
      if (raw[j].indent <= r.indent) {
        nextSiblingStart = raw[j].startLine;
        break;
      }
    }
    const endLineExclusive = computeRange(lines, r.startLine, r.indent, nextSiblingStart);

    items.push({
      todoIndex: i,
      startLine: r.startLine,
      endLineExclusive,
      indent: r.indent,
      parentKey,
      checked: r.checked,
    });

    indentStack.push({ indent: r.indent, key: myKey });
  }

  return items;
}

export function toggleTodo(md: string, todoIndex: number): string {
  const items = enumerateTodos(md);
  const target = items[todoIndex];
  if (!target) return md;
  const lines = md.split('\n');
  const line = lines[target.startLine];
  const m = line.match(TODO_LINE_RE);
  if (!m) return md;
  const charPos = m[1].length + m[2].length + m[3].length + 1;
  const newChar = target.checked ? ' ' : 'x';
  lines[target.startLine] = line.substring(0, charPos) + newChar + line.substring(charPos + 1);
  return lines.join('\n');
}

export function moveTodo(md: string, fromIndex: number, toIndex: number): MoveTodoResult {
  const items = enumerateTodos(md);
  const from = items[fromIndex];
  const to = items[toIndex];
  if (!from || !to) return { md, ok: false, reason: 'out-of-range' };
  if (from.parentKey !== to.parentKey) return { md, ok: false, reason: 'cross-parent' };
  if (fromIndex === toIndex) return { md, ok: true, reason: 'no-op' };

  const lines = md.split('\n');
  const fromBlock = lines.slice(from.startLine, from.endLineExclusive);
  const remaining = [...lines.slice(0, from.startLine), ...lines.slice(from.endLineExclusive)];

  let insertAt: number;
  if (to.startLine > from.startLine) {
    const shift = from.endLineExclusive - from.startLine;
    insertAt = to.endLineExclusive - shift;
  } else {
    insertAt = to.startLine;
  }

  const next = [...remaining.slice(0, insertAt), ...fromBlock, ...remaining.slice(insertAt)];
  return { md: next.join('\n'), ok: true };
}
