import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase } from '../src/index';
import {
  createTemplate,
  getTemplate,
  listTemplates,
  countTemplates,
  updateTemplate,
  deleteTemplate
} from '../src/templateRepository';

const withDb = (fn: (db: ReturnType<typeof openDatabase>) => void) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-tpl-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  try {
    fn(db);
  } finally {
    db.close();
    fs.removeSync(dir);
  }
};

const seedProject = (db: ReturnType<typeof openDatabase>, name: string): number => {
  const r = db.prepare("INSERT INTO projects (name) VALUES (?)").run(name);
  return Number(r.lastInsertRowid);
};

test('createTemplate stores target, labels and projects; getTemplate returns them', () => {
  withDb((db) => {
    const projectId = seedProject(db, 'Proj');
    const created = createTemplate(db, {
      title: 'Deploy checklist',
      bodyMd: '## steps\n- [ ] tag',
      templateTarget: 'task',
      labels: ['ops', 'deploy'],
      projects: [projectId]
    });

    assert.equal(created.type, 'template');
    assert.equal(created.templateTarget, 'task');
    assert.ok(created.serverSeq && created.serverSeq > 0, 'sync trigger stamped server_seq');
    assert.match(created.uuid ?? '', /^[0-9a-f-]{36}$/);
    assert.deepEqual([...(created.labels ?? [])].sort(), ['deploy', 'ops']);

    const fetched = getTemplate(db, created.id);
    assert.equal(fetched.title, 'Deploy checklist');
    assert.deepEqual([...(fetched.labels ?? [])].sort(), ['deploy', 'ops']);

    const items = db.prepare('SELECT count(*) c FROM project_items WHERE issue_id = ?').get(created.id) as { c: number };
    assert.equal(items.c, 1);
  });
});

test('listTemplates filters by target', () => {
  withDb((db) => {
    createTemplate(db, { title: 'T1', bodyMd: 'a', templateTarget: 'task' });
    createTemplate(db, { title: 'A1', bodyMd: 'b', templateTarget: 'article' });

    assert.equal(countTemplates(db), 2);
    const taskOnly = listTemplates(db, { target: 'task' });
    assert.equal(taskOnly.length, 1);
    assert.equal(taskOnly[0].title, 'T1');

    const articleOnly = listTemplates(db, { target: 'article' });
    assert.equal(articleOnly.length, 1);
    assert.equal(articleOnly[0].title, 'A1');
  });
});

test('updateTemplate patches fields and diffs labels', () => {
  withDb((db) => {
    const created = createTemplate(db, {
      title: 'Old',
      bodyMd: 'old body',
      templateTarget: 'task',
      labels: ['keep', 'drop']
    });

    const updated = updateTemplate(db, created.id, {
      title: 'New',
      bodyMd: 'new body',
      templateTarget: 'article',
      labels: ['keep', 'add']
    });

    assert.equal(updated.title, 'New');
    assert.equal(updated.bodyMd, 'new body');
    assert.equal(updated.templateTarget, 'article');
    assert.deepEqual([...(updated.labels ?? [])].sort(), ['add', 'keep']);
  });
});

test('deleteTemplate soft-deletes and getTemplate then throws', () => {
  withDb((db) => {
    const created = createTemplate(db, { title: 'X', bodyMd: 'x', templateTarget: 'task' });
    deleteTemplate(db, created.id);
    assert.throws(() => getTemplate(db, created.id), /not found/);
    assert.equal(listTemplates(db).length, 0);
  });
});

test('getTemplate rejects a non-template id', () => {
  withDb((db) => {
    const r = db.prepare("INSERT INTO issues (type, body_md) VALUES ('memo','m')").run();
    assert.throws(() => getTemplate(db, Number(r.lastInsertRowid)), /different type/);
  });
});
