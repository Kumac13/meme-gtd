/**
 * Returns true when the only textual difference between `oldMd` and `newMd`
 * is the checked state of GFM task list items (`[ ]` ↔ `[x]`). Used by the
 * service layer to suppress noisy `task.updated` / `memo.updated` /
 * `comment.updated` activity log entries on interactive checkbox toggles
 * (which would otherwise flood the timeline with one entry per click).
 */
export function isCheckboxOnlyChange(oldMd: string | null, newMd: string | null): boolean {
  if (oldMd === null || newMd === null) return false;
  if (oldMd === newMd) return false;
  const normalize = (s: string) => s.replace(/^(\s*[-*+]\s+)\[[ xX]\]/gm, '$1[ ]');
  return normalize(oldMd) === normalize(newMd);
}
