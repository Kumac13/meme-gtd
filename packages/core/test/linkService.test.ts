import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { applyMigrations } from 'meme-gtd-db';
import { LinkService } from '../src/linkService';
import { TaskService } from '../src/index';
import { MemoService } from '../src/index';
import type { MgtdConfig } from 'meme-gtd-config';

const createTempConfig = (): { dir: string; config: MgtdConfig; cleanup: () => void } => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-linkservice-'));
  const dbPath = path.join(dir, 'issues.db');
  const contextPath = path.join(dir, 'context.json');

  applyMigrations(dbPath);

  const config: MgtdConfig = {
    dbPath,
    contextPath
  };

  const cleanup = () => {
    fs.removeSync(dir);
  };

  return { dir, config, cleanup };
};

test('LinkService.create() validates self-reference', () => {
  const { config, cleanup } = createTempConfig();

  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const task = taskService.create({ title: 'Task', bodyMd: '' });

  assert.throws(() => {
    linkService.create(task.id, task.id, 'parent');
  }, /Cannot link issue to itself \(ID: \d+\)/);

  cleanup();
});

test('LinkService.create() validates source ID exists', () => {
  const { config, cleanup } = createTempConfig();

  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const task = taskService.create({ title: 'Task', bodyMd: '' });

  assert.throws(() => {
    linkService.create(999, task.id, 'parent');
  }, /Issue #999 not found/);

  cleanup();
});

test('LinkService.create() validates target ID exists', () => {
  const { config, cleanup } = createTempConfig();

  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const task = taskService.create({ title: 'Task', bodyMd: '' });

  assert.throws(() => {
    linkService.create(task.id, 999, 'parent');
  }, /Issue #999 not found/);

  cleanup();
});

test('LinkService.create() validates duplicate link', () => {
  const { config, cleanup } = createTempConfig();

  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const task1 = taskService.create({ title: 'T1', bodyMd: '' });
  const task2 = taskService.create({ title: 'T2', bodyMd: '' });

  linkService.create(task1.id, task2.id, 'parent');

  assert.throws(() => {
    linkService.create(task1.id, task2.id, 'parent');
  }, /Link already exists \(source: \d+, target: \d+, type: parent\)/);

  cleanup();
});

test('LinkService.create() creates valid parent link', () => {
  const { config, cleanup } = createTempConfig();

  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const parent = taskService.create({ title: 'Parent', bodyMd: '' });
  const child = taskService.create({ title: 'Child', bodyMd: '' });

  const link = linkService.create(child.id, parent.id, 'parent');

  assert.ok(link.id > 0);
  assert.equal(link.sourceIssueId, child.id);
  assert.equal(link.targetIssueId, parent.id);
  assert.equal(link.linkType, 'parent');

  cleanup();
});

test('LinkService.create() creates valid child link', () => {
  const { config, cleanup } = createTempConfig();

  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const parent = taskService.create({ title: 'Parent', bodyMd: '' });
  const child = taskService.create({ title: 'Child', bodyMd: '' });

  const link = linkService.create(parent.id, child.id, 'child');

  assert.equal(link.linkType, 'child');

  cleanup();
});

test('LinkService.create() creates valid relates link', () => {
  const { config, cleanup } = createTempConfig();

  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const task1 = taskService.create({ title: 'T1', bodyMd: '' });
  const task2 = taskService.create({ title: 'T2', bodyMd: '' });

  const link = linkService.create(task1.id, task2.id, 'relates');

  assert.equal(link.linkType, 'relates');

  cleanup();
});

test('LinkService.create() creates valid derived_from link', () => {
  const { config, cleanup } = createTempConfig();

  const memoService = new MemoService({ config });
  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const memo = memoService.create({ bodyMd: 'Original idea' });
  const task = taskService.create({ title: 'Derived', bodyMd: '' });

  const link = linkService.create(task.id, memo.id, 'derived_from');

  assert.equal(link.linkType, 'derived_from');
  assert.equal(link.sourceIssueId, task.id);
  assert.equal(link.targetIssueId, memo.id);

  cleanup();
});

test('LinkService.list() returns links for an issue', () => {
  const { config, cleanup } = createTempConfig();

  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const task1 = taskService.create({ title: 'T1', bodyMd: '' });
  const task2 = taskService.create({ title: 'T2', bodyMd: '' });
  const task3 = taskService.create({ title: 'T3', bodyMd: '' });

  linkService.create(task1.id, task2.id, 'parent');
  linkService.create(task1.id, task3.id, 'relates');

  const links = linkService.list(task1.id);

  assert.equal(links.length, 2);

  cleanup();
});

test('LinkService.list() filters by type', () => {
  const { config, cleanup } = createTempConfig();

  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const task1 = taskService.create({ title: 'T1', bodyMd: '' });
  const task2 = taskService.create({ title: 'T2', bodyMd: '' });
  const task3 = taskService.create({ title: 'T3', bodyMd: '' });

  linkService.create(task1.id, task2.id, 'parent');
  linkService.create(task1.id, task3.id, 'relates');

  const parentLinks = linkService.list(task1.id, { type: 'parent' });
  assert.equal(parentLinks.length, 1);
  assert.equal(parentLinks[0].linkType, 'parent');

  const relatesLinks = linkService.list(task1.id, { type: 'relates' });
  assert.equal(relatesLinks.length, 1);
  assert.equal(relatesLinks[0].linkType, 'relates');

  cleanup();
});

test('LinkService.remove() deletes a link', () => {
  const { config, cleanup } = createTempConfig();

  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const task1 = taskService.create({ title: 'T1', bodyMd: '' });
  const task2 = taskService.create({ title: 'T2', bodyMd: '' });

  const link = linkService.create(task1.id, task2.id, 'relates');

  linkService.remove(link.id);

  const links = linkService.list(task1.id);
  assert.equal(links.length, 0);

  cleanup();
});

test('LinkService.remove() throws error for non-existent link', () => {
  const { config, cleanup } = createTempConfig();

  const linkService = new LinkService({ config });

  assert.throws(() => {
    linkService.remove(999);
  }, /Link #999 not found/);

  cleanup();
});

// --- Circular Detection Tests (FR-013) ---

test('LinkService.create() rejects direct circular parent-child link (A->B, B->A)', () => {
  const { config, cleanup } = createTempConfig();

  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const taskA = taskService.create({ title: 'Task A', bodyMd: '' });
  const taskB = taskService.create({ title: 'Task B', bodyMd: '' });

  // Create A -> B (A is parent of B)
  linkService.create(taskA.id, taskB.id, 'parent');

  // Attempt to create B -> A (B is parent of A) - should fail
  assert.throws(() => {
    linkService.create(taskB.id, taskA.id, 'parent');
  }, /Circular relationship detected: Creating this link would form a cycle in the parent-child hierarchy/);

  cleanup();
});

test('LinkService.create() rejects 3-level circular parent-child link (A->B->C->A)', () => {
  const { config, cleanup } = createTempConfig();

  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const taskA = taskService.create({ title: 'Task A', bodyMd: '' });
  const taskB = taskService.create({ title: 'Task B', bodyMd: '' });
  const taskC = taskService.create({ title: 'Task C', bodyMd: '' });

  // Create A -> B -> C
  linkService.create(taskA.id, taskB.id, 'parent');
  linkService.create(taskB.id, taskC.id, 'parent');

  // Attempt to create C -> A (would create cycle) - should fail
  assert.throws(() => {
    linkService.create(taskC.id, taskA.id, 'parent');
  }, /Circular relationship detected: Creating this link would form a cycle in the parent-child hierarchy/);

  cleanup();
});

test('LinkService.create() rejects multi-level circular parent-child link (A->B->C->D->A)', () => {
  const { config, cleanup } = createTempConfig();

  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const taskA = taskService.create({ title: 'Task A', bodyMd: '' });
  const taskB = taskService.create({ title: 'Task B', bodyMd: '' });
  const taskC = taskService.create({ title: 'Task C', bodyMd: '' });
  const taskD = taskService.create({ title: 'Task D', bodyMd: '' });

  // Create A -> B -> C -> D
  linkService.create(taskA.id, taskB.id, 'parent');
  linkService.create(taskB.id, taskC.id, 'parent');
  linkService.create(taskC.id, taskD.id, 'parent');

  // Attempt to create D -> A (would create cycle) - should fail
  assert.throws(() => {
    linkService.create(taskD.id, taskA.id, 'parent');
  }, /Circular relationship detected: Creating this link would form a cycle in the parent-child hierarchy/);

  cleanup();
});

test('LinkService.create() allows circular relates links (not hierarchical)', () => {
  const { config, cleanup } = createTempConfig();

  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const taskA = taskService.create({ title: 'Task A', bodyMd: '' });
  const taskB = taskService.create({ title: 'Task B', bodyMd: '' });
  const taskC = taskService.create({ title: 'Task C', bodyMd: '' });

  // Create A -> B -> C with 'relates' type
  linkService.create(taskA.id, taskB.id, 'relates');
  linkService.create(taskB.id, taskC.id, 'relates');

  // Creating C -> A with 'relates' should succeed (relates is not hierarchical)
  const link = linkService.create(taskC.id, taskA.id, 'relates');

  assert.ok(link.id > 0);
  assert.equal(link.linkType, 'relates');

  cleanup();
});

test('LinkService.create() allows circular derived_from links (not hierarchical)', () => {
  const { config, cleanup } = createTempConfig();

  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const taskA = taskService.create({ title: 'Task A', bodyMd: '' });
  const taskB = taskService.create({ title: 'Task B', bodyMd: '' });
  const taskC = taskService.create({ title: 'Task C', bodyMd: '' });

  // Create A -> B -> C with 'derived_from' type
  linkService.create(taskA.id, taskB.id, 'derived_from');
  linkService.create(taskB.id, taskC.id, 'derived_from');

  // Creating C -> A with 'derived_from' should succeed (not hierarchical validation)
  const link = linkService.create(taskC.id, taskA.id, 'derived_from');

  assert.ok(link.id > 0);
  assert.equal(link.linkType, 'derived_from');

  cleanup();
});
