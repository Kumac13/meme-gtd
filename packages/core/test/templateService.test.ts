import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase } from 'meme-gtd-db';
import { TemplateService } from '../src/index';

const withService = (fn: (svc: TemplateService, db: ReturnType<typeof openDatabase>) => void) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-tpl-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  const svc = new TemplateService({ db });
  try {
    fn(svc, db);
  } finally {
    db.close();
    fs.removeSync(dir);
  }
};

test('TemplateService: CRUD with labels + projects, and no activity log', () => {
  withService((svc, db) => {
    const projectId = Number(
      db.prepare("INSERT INTO projects (name) VALUES ('P')").run().lastInsertRowid
    );

    const created = svc.create({
      title: 'Book note',
      bodyMd: '- author:\n- publisher:',
      templateTarget: 'article',
      labels: ['book'],
      projects: [projectId]
    });
    assert.equal(created.type, 'template');
    assert.equal(created.templateTarget, 'article');
    assert.deepEqual(created.labels, ['book']);
    assert.deepEqual(created.projectIds, [projectId]);

    const list = svc.list({ target: 'article' });
    assert.equal(list.total, 1);
    assert.equal(list.data.length, 1);
    assert.deepEqual(list.data[0].projectIds, [projectId]);

    // target filter excludes the other kind
    assert.equal(svc.list({ target: 'task' }).total, 0);

    const got = svc.get(created.id);
    assert.equal(got.title, 'Book note');

    const updated = svc.update(created.id, { title: 'Reading note', labels: ['book', 'reading'] });
    assert.equal(updated.title, 'Reading note');
    assert.deepEqual([...(updated.labels ?? [])].sort(), ['book', 'reading']);

    // Per product decision, template mutations are NOT recorded in the activity log.
    const logCount = (db.prepare('SELECT count(*) AS c FROM activity_log').get() as { c: number }).c;
    assert.equal(logCount, 0);

    svc.remove(created.id);
    assert.equal(svc.list().total, 0);
  });
});
