/**
 * Returns true when the textual difference between `oldMd` and `newMd` is
 * limited to interactive task list operations:
 *
 *   - toggling `[ ]` ↔ `[x]` on existing items
 *   - reordering existing task list items (including nested ones moved
 *     with their parent)
 *
 * Non-task lines (including task lines inside fenced code blocks or
 * blockquotes, which are not interactive on the client) must be identical
 * in the same positions. The multiset of normalized task lines (checkbox
 * state ignored) must match.
 *
 * Used by the service layer to suppress noisy `task.updated` /
 * `memo.updated` / `comment.updated` activity log entries when the change
 * came from the Web/iOS interactive checkbox UX — one entry per click or
 * drag would flood the timeline. Mirrors GitHub's behavior.
 */
export function isInteractiveTodoChange(oldMd: string | null, newMd: string | null): boolean {
  if (oldMd === null || newMd === null) return false;
  if (oldMd === newMd) return false;
  const o = classify(oldMd);
  const n = classify(newMd);
  if (o.fixed.length !== n.fixed.length) return false;
  for (let i = 0; i < o.fixed.length; i++) {
    if (o.fixed[i] !== n.fixed[i]) return false;
  }
  if (o.todos.length !== n.todos.length) return false;
  const sortedO = [...o.todos].sort();
  const sortedN = [...n.todos].sort();
  for (let i = 0; i < sortedO.length; i++) {
    if (sortedO[i] !== sortedN[i]) return false;
  }
  return true;
}

const FENCE = /^\s*(```|~~~)/;
const BLOCKQUOTE = /^\s*>/;
const TODO = /^(\s*[-*+]\s+)\[[ xX]\]/;

function classify(md: string): { fixed: string[]; todos: string[] } {
  const fixed: string[] = [];
  const todos: string[] = [];
  let inFence = false;
  let fenceMarker: string | null = null;
  for (const line of md.split('\n')) {
    const fm = line.match(FENCE);
    if (fm) {
      const marker = fm[1];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = null;
      }
      fixed.push(line);
      continue;
    }
    if (inFence) {
      fixed.push(line);
      continue;
    }
    if (BLOCKQUOTE.test(line)) {
      fixed.push(line);
      continue;
    }
    if (TODO.test(line)) {
      todos.push(line.replace(TODO, '$1[ ]'));
    } else {
      fixed.push(line);
    }
  }
  return { fixed, todos };
}
