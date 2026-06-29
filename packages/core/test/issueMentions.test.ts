import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import Database from 'better-sqlite3';
import { applyMigrations } from 'meme-gtd-db';
import { MemoService, TaskService, ArticleService } from '../src/index';
import { rewriteIssueMentions } from '../src/issueMentions';
import type { MgtdConfig } from 'meme-gtd-config';

type Fixture = {
  config: MgtdConfig;
  db: Database.Database;
  memo: MemoService;
  task: TaskService;
  article: ArticleService;
  cleanup: () => void;
};

const setup = (): Fixture => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-mentions-'));
  const dbPath = path.join(dir, 'issues.db');
  const contextPath = path.join(dir, 'context.json');
  applyMigrations(dbPath);
  const config: MgtdConfig = { dbPath, contextPath };
  const db = new Database(dbPath);
  return {
    config,
    db,
    memo: new MemoService({ config }),
    task: new TaskService({ config }),
    article: new ArticleService({ config }),
    cleanup: () => {
      db.close();
      fs.removeSync(dir);
    },
  };
};

test('rewriteIssueMentions: returns body unchanged when no mentions', () => {
  const f = setup();
  const result = rewriteIssueMentions(f.db, 'hello world');
  assert.equal(result.rewritten, 'hello world');
  assert.deepEqual(result.mentionedIssueIds, []);
  f.cleanup();
});

test('rewriteIssueMentions: handles null/empty body', () => {
  const f = setup();
  assert.deepEqual(rewriteIssueMentions(f.db, null), { rewritten: '', mentionedIssueIds: [] });
  assert.deepEqual(rewriteIssueMentions(f.db, undefined), { rewritten: '', mentionedIssueIds: [] });
  assert.deepEqual(rewriteIssueMentions(f.db, ''), { rewritten: '', mentionedIssueIds: [] });
  f.cleanup();
});

test('rewriteIssueMentions: rewrites task mention with task URL', () => {
  const f = setup();
  const t = f.task.create({ title: 'Target', bodyMd: '' });
  const result = rewriteIssueMentions(f.db, `see #${t.id} for details`);
  assert.equal(result.rewritten, `see [#${t.id}](/tasks/${t.id}) for details`);
  assert.deepEqual(result.mentionedIssueIds, [t.id]);
  f.cleanup();
});

test('rewriteIssueMentions: rewrites memo mention with memo URL', () => {
  const f = setup();
  const m = f.memo.create({ bodyMd: 'original' });
  const result = rewriteIssueMentions(f.db, `relates #${m.id}`);
  assert.equal(result.rewritten, `relates [#${m.id}](/memos/${m.id})`);
  assert.deepEqual(result.mentionedIssueIds, [m.id]);
  f.cleanup();
});

test('rewriteIssueMentions: rewrites article mention with article URL', () => {
  const f = setup();
  const a = f.article.create({
    title: 'Doc',
    bodyMd: 'body',
    originalUrl: 'https://example.com/a',
  });
  const result = rewriteIssueMentions(f.db, `see #${a.id}`);
  assert.equal(result.rewritten, `see [#${a.id}](/articles/${a.id})`);
  assert.deepEqual(result.mentionedIssueIds, [a.id]);
  f.cleanup();
});

test('rewriteIssueMentions: leaves unknown id unchanged', () => {
  const f = setup();
  const result = rewriteIssueMentions(f.db, 'see #9999');
  assert.equal(result.rewritten, 'see #9999');
  assert.deepEqual(result.mentionedIssueIds, []);
  f.cleanup();
});

test('rewriteIssueMentions: rewrites mention at start of body', () => {
  const f = setup();
  const t = f.task.create({ title: 'A', bodyMd: '' });
  const result = rewriteIssueMentions(f.db, `#${t.id} is the issue`);
  assert.equal(result.rewritten, `[#${t.id}](/tasks/${t.id}) is the issue`);
  f.cleanup();
});

test('rewriteIssueMentions: skips #123abc (non-word boundary on right)', () => {
  const f = setup();
  const t = f.task.create({ title: 'A', bodyMd: '' });
  const result = rewriteIssueMentions(f.db, `#${t.id}abc`);
  assert.equal(result.rewritten, `#${t.id}abc`);
  assert.deepEqual(result.mentionedIssueIds, []);
  f.cleanup();
});

test('rewriteIssueMentions: skips word#123 (non-word boundary on left)', () => {
  const f = setup();
  const t = f.task.create({ title: 'A', bodyMd: '' });
  const result = rewriteIssueMentions(f.db, `abc#${t.id}`);
  assert.equal(result.rewritten, `abc#${t.id}`);
  f.cleanup();
});

test('rewriteIssueMentions: leaves escaped \\#id unchanged', () => {
  const f = setup();
  const t = f.task.create({ title: 'A', bodyMd: '' });
  const result = rewriteIssueMentions(f.db, `escape \\#${t.id} here`);
  assert.equal(result.rewritten, `escape \\#${t.id} here`);
  assert.deepEqual(result.mentionedIssueIds, []);
  f.cleanup();
});

test('rewriteIssueMentions: skips mentions inside inline code', () => {
  const f = setup();
  const t = f.task.create({ title: 'A', bodyMd: '' });
  const result = rewriteIssueMentions(f.db, `code \`#${t.id}\` end`);
  assert.equal(result.rewritten, `code \`#${t.id}\` end`);
  f.cleanup();
});

test('rewriteIssueMentions: skips mentions inside fenced code blocks', () => {
  const f = setup();
  const t = f.task.create({ title: 'A', bodyMd: '' });
  const body = ['before', '```', `#${t.id}`, '```', 'after'].join('\n');
  const result = rewriteIssueMentions(f.db, body);
  assert.equal(result.rewritten, body);
  assert.deepEqual(result.mentionedIssueIds, []);
  f.cleanup();
});

test('rewriteIssueMentions: skips mentions inside existing markdown link url', () => {
  const f = setup();
  const t = f.task.create({ title: 'A', bodyMd: '' });
  const body = `see [existing](/tasks/${t.id})`;
  const result = rewriteIssueMentions(f.db, body);
  assert.equal(result.rewritten, body);
  assert.deepEqual(result.mentionedIssueIds, []);
  f.cleanup();
});

test('rewriteIssueMentions: same id mentioned multiple times rewrites all but dedupes ids', () => {
  const f = setup();
  const t = f.task.create({ title: 'A', bodyMd: '' });
  const body = `#${t.id} and #${t.id} and #${t.id}`;
  const result = rewriteIssueMentions(f.db, body);
  const link = `[#${t.id}](/tasks/${t.id})`;
  assert.equal(result.rewritten, `${link} and ${link} and ${link}`);
  assert.deepEqual(result.mentionedIssueIds, [t.id]);
  f.cleanup();
});

test('rewriteIssueMentions: excludes self-reference', () => {
  const f = setup();
  const t = f.task.create({ title: 'A', bodyMd: '' });
  const result = rewriteIssueMentions(f.db, `mention #${t.id}`, t.id);
  assert.equal(result.rewritten, `mention #${t.id}`);
  assert.deepEqual(result.mentionedIssueIds, []);
  f.cleanup();
});

test('rewriteIssueMentions: handles soft-deleted target as unknown', () => {
  const f = setup();
  const t = f.task.create({ title: 'A', bodyMd: '' });
  f.task.remove(t.id);
  const result = rewriteIssueMentions(f.db, `see #${t.id}`);
  assert.equal(result.rewritten, `see #${t.id}`);
  assert.deepEqual(result.mentionedIssueIds, []);
  f.cleanup();
});

test('rewriteIssueMentions: handles mixed types in one body', () => {
  const f = setup();
  const m = f.memo.create({ bodyMd: 'm' });
  const t = f.task.create({ title: 'T', bodyMd: '' });
  const a = f.article.create({
    title: 'A',
    bodyMd: 'a',
    originalUrl: 'https://example.com/a',
  });
  const body = `mix #${m.id}, #${t.id}, #${a.id}`;
  const result = rewriteIssueMentions(f.db, body);
  assert.equal(
    result.rewritten,
    `mix [#${m.id}](/memos/${m.id}), [#${t.id}](/tasks/${t.id}), [#${a.id}](/articles/${a.id})`
  );
  assert.deepEqual(result.mentionedIssueIds.sort((x, y) => x - y), [m.id, t.id, a.id].sort((x, y) => x - y));
  f.cleanup();
});

test('rewriteIssueMentions: skips HTML entity-like &#123;', () => {
  const f = setup();
  const t = f.task.create({ title: 'A', bodyMd: '' });
  void t;
  const result = rewriteIssueMentions(f.db, 'entity &#123; here');
  assert.equal(result.rewritten, 'entity &#123; here');
  assert.deepEqual(result.mentionedIssueIds, []);
  f.cleanup();
});

test('rewriteIssueMentions: handles mention at end of line and in middle', () => {
  const f = setup();
  const t1 = f.task.create({ title: 'A', bodyMd: '' });
  const t2 = f.task.create({ title: 'B', bodyMd: '' });
  const body = `line1 #${t1.id}\nmid #${t2.id} end`;
  const result = rewriteIssueMentions(f.db, body);
  assert.equal(
    result.rewritten,
    `line1 [#${t1.id}](/tasks/${t1.id})\nmid [#${t2.id}](/tasks/${t2.id}) end`
  );
  f.cleanup();
});

test('rewriteIssueMentions: preserves mention before punctuation', () => {
  const f = setup();
  const t = f.task.create({ title: 'A', bodyMd: '' });
  const result = rewriteIssueMentions(f.db, `done #${t.id}.`);
  assert.equal(result.rewritten, `done [#${t.id}](/tasks/${t.id}).`);
  f.cleanup();
});
