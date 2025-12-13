import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase, listActivityLog } from 'meme-gtd-db';
import { ArticleService } from '../src/index.js';

const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-article-log-test-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  return { dir, db, dbPath };
};

// ============================================================
// ArticleService Activity Log Integration Tests
// ============================================================

test('ArticleService.create() logs article.created event', () => {
  const { dir, db } = createTempDb();
  const articleService = new ArticleService({ db });

  // Create an article
  const article = articleService.create({
    title: 'Test Article',
    bodyMd: 'Test article content',
    originalUrl: 'https://example.com/article',
  });

  // Verify activity log entry
  const logs = listActivityLog(db, {});
  assert.equal(logs.length, 1);
  assert.equal(logs[0].eventType, 'article.created');
  assert.equal(logs[0].sourceType, 'api');

  const payload = logs[0].payload as Record<string, unknown>;
  assert.equal(payload.issue_id, article.id);
  assert.equal(payload.issue_type, 'article');
  assert.equal(payload.title, 'Test Article');
  assert.equal(payload.original_url, 'https://example.com/article');

  db.close();
  fs.removeSync(dir);
});

test('ArticleService.create() includes full body in payload', () => {
  const { dir, db } = createTempDb();
  const articleService = new ArticleService({ db });

  // Create an article with long body
  const longBody = 'A'.repeat(150);
  articleService.create({
    title: 'Long Article',
    bodyMd: longBody,
    originalUrl: 'https://example.com/long',
  });

  const logs = listActivityLog(db, {});
  const payload = logs[0].payload as Record<string, unknown>;
  // Body should contain the full content
  assert.equal(payload.body, longBody);

  db.close();
  fs.removeSync(dir);
});

test('ArticleService.remove() logs article.deleted event', () => {
  const { dir, db } = createTempDb();
  const articleService = new ArticleService({ db });

  // Create then delete an article
  const article = articleService.create({
    title: 'To be deleted',
    bodyMd: 'This article will be deleted',
    originalUrl: 'https://example.com/delete',
  });
  articleService.remove(article.id);

  // Verify activity log entries (order: asc to get chronological order)
  const logs = listActivityLog(db, { order: 'asc' });
  assert.equal(logs.length, 2);
  assert.equal(logs[0].eventType, 'article.created');
  assert.equal(logs[1].eventType, 'article.deleted');

  const payload = logs[1].payload as Record<string, unknown>;
  assert.equal(payload.issue_id, article.id);
  assert.equal(payload.issue_type, 'article');
  assert.equal(payload.title, 'To be deleted');

  db.close();
  fs.removeSync(dir);
});

test('ArticleService uses cli sourceType when specified', () => {
  const { dir, db } = createTempDb();
  const articleService = new ArticleService({ db, sourceType: 'cli' });

  articleService.create({
    title: 'CLI Article',
    bodyMd: 'Created from CLI',
    originalUrl: 'https://example.com/cli',
  });

  const logs = listActivityLog(db, {});
  assert.equal(logs.length, 1);
  assert.equal(logs[0].sourceType, 'cli');

  db.close();
  fs.removeSync(dir);
});

test('ArticleService.get() does not log any event', () => {
  const { dir, db } = createTempDb();
  const articleService = new ArticleService({ db });

  const article = articleService.create({
    title: 'Test Article',
    bodyMd: 'Content',
    originalUrl: 'https://example.com',
  });

  // Get the article
  articleService.get(article.id);

  // Should only have the create event
  const logs = listActivityLog(db, {});
  assert.equal(logs.length, 1);
  assert.equal(logs[0].eventType, 'article.created');

  db.close();
  fs.removeSync(dir);
});

test('ArticleService.list() does not log any event', () => {
  const { dir, db } = createTempDb();
  const articleService = new ArticleService({ db });

  articleService.create({
    title: 'Article 1',
    bodyMd: 'Content 1',
    originalUrl: 'https://example.com/1',
  });
  articleService.create({
    title: 'Article 2',
    bodyMd: 'Content 2',
    originalUrl: 'https://example.com/2',
  });

  // List articles
  articleService.list();

  // Should only have the create events
  const logs = listActivityLog(db, {});
  assert.equal(logs.length, 2);
  assert.ok(logs.every(l => l.eventType === 'article.created'));

  db.close();
  fs.removeSync(dir);
});
