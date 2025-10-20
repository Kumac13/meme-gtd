import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations, openDatabase } from '../src/index';
import {
  createLink,
  getLinkById,
  listLinks,
  deleteLink,
  findLink,
  type CreateLinkInput
} from '../src/linkRepository';
import { createTask } from '../src/taskRepository';
import { createMemo } from '../src/memoRepository';

const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-linktest-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);
  const db = openDatabase({ dbPath });
  return { dir, db, dbPath };
};

test('createLink() creates a parent link successfully', () => {
  const { dir, db } = createTempDb();

  // Create two tasks for linking
  const parentTask = createTask(db, { title: 'Parent Task', bodyMd: '' });
  const childTask = createTask(db, { title: 'Child Task', bodyMd: '' });

  const input: CreateLinkInput = {
    sourceIssueId: childTask.id,
    targetIssueId: parentTask.id,
    linkType: 'parent'
  };

  const link = createLink(db, input);

  assert.ok(link.id > 0);
  assert.equal(link.sourceIssueId, childTask.id);
  assert.equal(link.targetIssueId, parentTask.id);
  assert.equal(link.linkType, 'parent');
  assert.ok(link.createdAt);

  db.close();
  fs.removeSync(dir);
});

test('createLink() creates a child link successfully', () => {
  const { dir, db } = createTempDb();

  const parentTask = createTask(db, { title: 'Parent', bodyMd: '' });
  const childTask = createTask(db, { title: 'Child', bodyMd: '' });

  const link = createLink(db, {
    sourceIssueId: parentTask.id,
    targetIssueId: childTask.id,
    linkType: 'child'
  });

  assert.equal(link.linkType, 'child');
  assert.equal(link.sourceIssueId, parentTask.id);
  assert.equal(link.targetIssueId, childTask.id);

  db.close();
  fs.removeSync(dir);
});

test('createLink() creates a relates link successfully', () => {
  const { dir, db } = createTempDb();

  const task1 = createTask(db, { title: 'Task 1', bodyMd: '' });
  const task2 = createTask(db, { title: 'Task 2', bodyMd: '' });

  const link = createLink(db, {
    sourceIssueId: task1.id,
    targetIssueId: task2.id,
    linkType: 'relates'
  });

  assert.equal(link.linkType, 'relates');

  db.close();
  fs.removeSync(dir);
});

test('createLink() creates a derived_from link between memo and task', () => {
  const { dir, db } = createTempDb();

  const memo = createMemo(db, { bodyMd: 'Original memo idea' });
  const task = createTask(db, { title: 'Derived Task', bodyMd: '' });

  const link = createLink(db, {
    sourceIssueId: task.id,
    targetIssueId: memo.id,
    linkType: 'derived_from'
  });

  assert.equal(link.linkType, 'derived_from');
  assert.equal(link.sourceIssueId, task.id);
  assert.equal(link.targetIssueId, memo.id);

  db.close();
  fs.removeSync(dir);
});

test('getLinkById() retrieves link by ID', () => {
  const { dir, db } = createTempDb();

  const task1 = createTask(db, { title: 'T1', bodyMd: '' });
  const task2 = createTask(db, { title: 'T2', bodyMd: '' });
  const created = createLink(db, {
    sourceIssueId: task1.id,
    targetIssueId: task2.id,
    linkType: 'parent'
  });

  const retrieved = getLinkById(db, created.id);

  assert.equal(retrieved.id, created.id);
  assert.equal(retrieved.sourceIssueId, created.sourceIssueId);
  assert.equal(retrieved.targetIssueId, created.targetIssueId);
  assert.equal(retrieved.linkType, created.linkType);

  db.close();
  fs.removeSync(dir);
});

test('getLinkById() throws error for non-existent link', () => {
  const { dir, db } = createTempDb();

  assert.throws(() => {
    getLinkById(db, 999);
  }, /Link #999 not found/);

  db.close();
  fs.removeSync(dir);
});

test('listLinks() returns empty array when no links exist', () => {
  const { dir, db } = createTempDb();

  const task = createTask(db, { title: 'Lonely Task', bodyMd: '' });
  const links = listLinks(db, task.id);

  assert.deepEqual(links, []);

  db.close();
  fs.removeSync(dir);
});

test('listLinks() returns all links for an issue (outgoing)', () => {
  const { dir, db } = createTempDb();

  const parent = createTask(db, { title: 'Parent', bodyMd: '' });
  const child1 = createTask(db, { title: 'Child 1', bodyMd: '' });
  const child2 = createTask(db, { title: 'Child 2', bodyMd: '' });

  createLink(db, { sourceIssueId: parent.id, targetIssueId: child1.id, linkType: 'child' });
  createLink(db, { sourceIssueId: parent.id, targetIssueId: child2.id, linkType: 'child' });

  const links = listLinks(db, parent.id);

  assert.equal(links.length, 2);
  assert.ok(links.every(l => l.sourceIssueId === parent.id));

  db.close();
  fs.removeSync(dir);
});

test('listLinks() returns all links for an issue (incoming)', () => {
  const { dir, db } = createTempDb();

  const parent = createTask(db, { title: 'Parent', bodyMd: '' });
  const child = createTask(db, { title: 'Child', bodyMd: '' });

  createLink(db, { sourceIssueId: child.id, targetIssueId: parent.id, linkType: 'parent' });

  const parentLinks = listLinks(db, parent.id);

  assert.equal(parentLinks.length, 1);
  assert.equal(parentLinks[0].targetIssueId, parent.id);

  db.close();
  fs.removeSync(dir);
});

test('listLinks() returns both incoming and outgoing links', () => {
  const { dir, db } = createTempDb();

  const task1 = createTask(db, { title: 'T1', bodyMd: '' });
  const task2 = createTask(db, { title: 'T2', bodyMd: '' });
  const task3 = createTask(db, { title: 'T3', bodyMd: '' });

  // task1 -> task2 (outgoing from task1)
  createLink(db, { sourceIssueId: task1.id, targetIssueId: task2.id, linkType: 'relates' });
  // task3 -> task1 (incoming to task1)
  createLink(db, { sourceIssueId: task3.id, targetIssueId: task1.id, linkType: 'relates' });

  const links = listLinks(db, task1.id);

  assert.equal(links.length, 2);

  db.close();
  fs.removeSync(dir);
});

test('listLinks() filters by link type', () => {
  const { dir, db } = createTempDb();

  const task = createTask(db, { title: 'Main', bodyMd: '' });
  const parent = createTask(db, { title: 'Parent', bodyMd: '' });
  const related = createTask(db, { title: 'Related', bodyMd: '' });

  createLink(db, { sourceIssueId: task.id, targetIssueId: parent.id, linkType: 'parent' });
  createLink(db, { sourceIssueId: task.id, targetIssueId: related.id, linkType: 'relates' });

  const parentLinks = listLinks(db, task.id, { type: 'parent' });
  assert.equal(parentLinks.length, 1);
  assert.equal(parentLinks[0].linkType, 'parent');

  const relatesLinks = listLinks(db, task.id, { type: 'relates' });
  assert.equal(relatesLinks.length, 1);
  assert.equal(relatesLinks[0].linkType, 'relates');

  db.close();
  fs.removeSync(dir);
});

test('deleteLink() removes a link successfully', () => {
  const { dir, db } = createTempDb();

  const task1 = createTask(db, { title: 'T1', bodyMd: '' });
  const task2 = createTask(db, { title: 'T2', bodyMd: '' });
  const link = createLink(db, {
    sourceIssueId: task1.id,
    targetIssueId: task2.id,
    linkType: 'relates'
  });

  deleteLink(db, link.id);

  const links = listLinks(db, task1.id);
  assert.equal(links.length, 0);

  db.close();
  fs.removeSync(dir);
});

test('deleteLink() throws error for non-existent link', () => {
  const { dir, db } = createTempDb();

  assert.throws(() => {
    deleteLink(db, 999);
  }, /Link #999 not found/);

  db.close();
  fs.removeSync(dir);
});

test('findLink() finds exact match', () => {
  const { dir, db } = createTempDb();

  const task1 = createTask(db, { title: 'T1', bodyMd: '' });
  const task2 = createTask(db, { title: 'T2', bodyMd: '' });

  createLink(db, {
    sourceIssueId: task1.id,
    targetIssueId: task2.id,
    linkType: 'parent'
  });

  const found = findLink(db, {
    sourceIssueId: task1.id,
    targetIssueId: task2.id,
    linkType: 'parent'
  });

  assert.ok(found);
  assert.equal(found?.sourceIssueId, task1.id);
  assert.equal(found?.targetIssueId, task2.id);
  assert.equal(found?.linkType, 'parent');

  db.close();
  fs.removeSync(dir);
});

test('findLink() returns null when no match', () => {
  const { dir, db } = createTempDb();

  const task1 = createTask(db, { title: 'T1', bodyMd: '' });
  const task2 = createTask(db, { title: 'T2', bodyMd: '' });

  const found = findLink(db, {
    sourceIssueId: task1.id,
    targetIssueId: task2.id,
    linkType: 'parent'
  });

  assert.equal(found, null);

  db.close();
  fs.removeSync(dir);
});

test('findLink() can search by partial criteria', () => {
  const { dir, db } = createTempDb();

  const task1 = createTask(db, { title: 'T1', bodyMd: '' });
  const task2 = createTask(db, { title: 'T2', bodyMd: '' });

  createLink(db, {
    sourceIssueId: task1.id,
    targetIssueId: task2.id,
    linkType: 'parent'
  });

  const foundBySource = findLink(db, { sourceIssueId: task1.id });
  assert.ok(foundBySource);

  const foundByType = findLink(db, { linkType: 'parent' });
  assert.ok(foundByType);

  db.close();
  fs.removeSync(dir);
});

test('CASCADE DELETE: deleting issue removes associated links', () => {
  const { dir, db } = createTempDb();

  const task1 = createTask(db, { title: 'T1', bodyMd: '' });
  const task2 = createTask(db, { title: 'T2', bodyMd: '' });

  const link = createLink(db, {
    sourceIssueId: task1.id,
    targetIssueId: task2.id,
    linkType: 'parent'
  });

  // Delete task1 (source)
  db.prepare('UPDATE issues SET is_deleted = 1 WHERE id = ?').run(task1.id);
  db.prepare('DELETE FROM issues WHERE id = ?').run(task1.id);

  // Link should be automatically deleted due to CASCADE
  assert.throws(() => {
    getLinkById(db, link.id);
  }, /Link #.*not found/);

  db.close();
  fs.removeSync(dir);
});
