import type Database from 'better-sqlite3';
import type { IssueType } from 'meme-gtd-shared';

const TYPE_TO_URL_PREFIX: Record<IssueType, string> = {
  memo: '/memos',
  task: '/tasks',
  article: '/articles',
};

export interface RewriteIssueMentionsResult {
  rewritten: string;
  mentionedIssueIds: number[];
}

interface Range {
  start: number;
  end: number;
}

interface Candidate {
  start: number;
  end: number;
  id: number;
}

/**
 * Scan body markdown for `#id` mentions, rewrite them as `[#id](/<type>/<id>)`,
 * and return the resolved issue IDs.
 *
 * - Skips text inside fenced code blocks, inline code spans, and existing
 *   markdown links (`[label](url)`).
 * - `\#id` is treated as an escape and left unchanged.
 * - Only matches `#\d+` with non-word boundaries on both sides and not
 *   preceded by `/`, `&`, `#`, or a backslash.
 * - Unknown IDs (non-existent or soft-deleted) are left as-is.
 * - The mention pointing to `selfIssueId` (when supplied) is left as-is and
 *   excluded from `mentionedIssueIds`.
 */
export function rewriteIssueMentions(
  db: Database.Database,
  body: string | null | undefined,
  selfIssueId?: number
): RewriteIssueMentionsResult {
  if (!body) {
    return { rewritten: body ?? '', mentionedIssueIds: [] };
  }

  const skipRanges = collectSkipRanges(body);
  const candidates = findMentionCandidates(body, skipRanges).filter(
    (c) => c.id !== selfIssueId
  );

  if (candidates.length === 0) {
    return { rewritten: body, mentionedIssueIds: [] };
  }

  const uniqueIds = [...new Set(candidates.map((c) => c.id))];
  const resolution = resolveIssueTypes(db, uniqueIds);

  const validCandidates = candidates.filter((c) => resolution.has(c.id));
  if (validCandidates.length === 0) {
    return { rewritten: body, mentionedIssueIds: [] };
  }

  // Apply replacements right-to-left so earlier indices remain valid.
  const ordered = [...validCandidates].sort((a, b) => b.start - a.start);
  let rewritten = body;
  for (const c of ordered) {
    const type = resolution.get(c.id)!;
    const url = `${TYPE_TO_URL_PREFIX[type]}/${c.id}`;
    const replacement = `[#${c.id}](${url})`;
    rewritten = rewritten.slice(0, c.start) + replacement + rewritten.slice(c.end);
  }

  const mentionedIssueIds = [...new Set(validCandidates.map((c) => c.id))];
  return { rewritten, mentionedIssueIds };
}

function collectSkipRanges(body: string): Range[] {
  const ranges: Range[] = [];

  // Fenced code blocks: scan line-by-line, track matching opener.
  const lines = body.split('\n');
  let offset = 0;
  let fenceStart: number | null = null;
  let fenceMarker = '';
  for (const line of lines) {
    const trimmed = line.replace(/^[ \t]+/, '');
    const m = /^(`{3,}|~{3,})/.exec(trimmed);
    if (m) {
      if (fenceStart === null) {
        fenceStart = offset;
        fenceMarker = m[1][0]; // '`' or '~'
      } else if (trimmed.startsWith(fenceMarker.repeat(3))) {
        ranges.push({ start: fenceStart, end: offset + line.length });
        fenceStart = null;
        fenceMarker = '';
      }
    }
    offset += line.length + 1; // +1 for '\n'
  }
  if (fenceStart !== null) {
    ranges.push({ start: fenceStart, end: body.length });
  }

  // Inline code spans and existing markdown links, skipping anything inside a fence.
  let i = 0;
  while (i < body.length) {
    const fence = ranges.find((r) => i >= r.start && i < r.end);
    if (fence) {
      i = fence.end;
      continue;
    }

    const ch = body[i];

    if (ch === '`') {
      let openCount = 0;
      let j = i;
      while (j < body.length && body[j] === '`') {
        openCount++;
        j++;
      }
      // Look for a matching run of the same length.
      let k = j;
      let closed = false;
      while (k < body.length) {
        if (body[k] === '`') {
          let closeCount = 0;
          let l = k;
          while (l < body.length && body[l] === '`') {
            closeCount++;
            l++;
          }
          if (closeCount === openCount) {
            ranges.push({ start: i, end: l });
            i = l;
            closed = true;
            break;
          }
          k = l;
        } else {
          k++;
        }
      }
      if (!closed) {
        i = j;
      }
      continue;
    }

    if (ch === '[') {
      const closeBracket = body.indexOf(']', i + 1);
      if (closeBracket !== -1 && body[closeBracket + 1] === '(') {
        const closeParen = body.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          ranges.push({ start: i, end: closeParen + 1 });
          i = closeParen + 1;
          continue;
        }
      }
    }

    i++;
  }

  ranges.sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

function findMentionCandidates(body: string, skipRanges: Range[]): Candidate[] {
  const candidates: Candidate[] = [];
  const regex = /#(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(body)) !== null) {
    const start = m.index;
    const end = start + m[0].length;

    if (skipRanges.some((r) => start >= r.start && start < r.end)) continue;

    const prev = start > 0 ? body[start - 1] : '';
    if (prev && /[\w/&#]/.test(prev)) continue;
    if (prev === '\\') continue;

    const next = end < body.length ? body[end] : '';
    if (next && /\w/.test(next)) continue;

    const id = Number.parseInt(m[1], 10);
    if (!Number.isFinite(id) || id <= 0) continue;

    candidates.push({ start, end, id });
  }
  return candidates;
}

function resolveIssueTypes(
  db: Database.Database,
  ids: number[]
): Map<number, IssueType> {
  const out = new Map<number, IssueType>();
  if (ids.length === 0) return out;
  const placeholders = ids.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT id, type FROM issues WHERE id IN (${placeholders}) AND is_deleted = 0`
    )
    .all(...ids) as Array<{ id: number; type: IssueType }>;
  for (const row of rows) {
    out.set(row.id, row.type);
  }
  return out;
}
