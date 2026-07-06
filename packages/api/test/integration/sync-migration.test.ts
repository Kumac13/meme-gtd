import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';

const DEVICE = 'migration-device-1';

let opCounter = 0;
const nextOpId = () => `mig-op-${++opCounter}`;

let uuidCounter = 0;
const nextUuid = () => `00000000-0000-7000-9000-${String(++uuidCounter).padStart(12, '0')}`;

// Bulk-migration entities of POST /api/sync/push (iOS Standalone -> Server
// one-way migration): create-only task / article / label / issue_label / link.
describe('Sync push bulk migration (POST /api/sync/push)', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const testServer = await createTestServer();
    app = testServer.app;
    cleanup = testServer.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  const push = async (operations: unknown[], deviceId = DEVICE) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/sync/push',
      payload: { deviceId, operations },
    });
    return response;
  };

  const pushOne = async (operation: Record<string, unknown>) => {
    const response = await push([operation]);
    assert.strictEqual(response.statusCode, 200);
    return JSON.parse(response.body).results[0];
  };

  const getJson = async (url: string) => {
    const response = await app.inject({ method: 'GET', url });
    assert.strictEqual(response.statusCode, 200);
    return JSON.parse(response.body);
  };

  const activityLogEventTypes = async (issueId: number): Promise<string[]> => {
    const log = await getJson(`/api/activity-log/issues/${issueId}`);
    const entries = Array.isArray(log) ? log : log.data ?? log.entries;
    return entries.map((e: any) => e.eventType);
  };

  describe('task create', () => {
    it('applies a full task payload preserving offline timestamps and execution stamps', async () => {
      const uuid = nextUuid();
      const op = {
        opId: nextOpId(),
        entity: 'task',
        type: 'create',
        uuid,
        payload: {
          title: 'Migrated task',
          bodyMd: 'task body from iOS',
          status: 'done',
          taskKind: 'action',
          scheduledStart: '2026-05-01T10:00:00',
          scheduledEnd: '2026-05-01T11:00:00',
          isAllDay: false,
          actualStart: '2026-05-01T10:05:00',
          actualEnd: '2026-05-01T10:55:00',
          createdAt: '2026-04-30T09:00:00.000Z',
          updatedAt: '2026-05-01T11:00:00.000Z',
        },
      };

      const result = await pushOne(op);
      assert.strictEqual(result.status, 'applied');
      assert.strictEqual(result.uuid, uuid);
      assert.ok(result.serverId);
      assert.strictEqual(result.updatedAt, '2026-05-01T11:00:00.000Z');

      const task = await getJson(`/api/tasks/${result.serverId}`);
      assert.strictEqual(task.title, 'Migrated task');
      assert.strictEqual(task.bodyMd, 'task body from iOS');
      assert.strictEqual(task.status, 'done');
      assert.strictEqual(task.taskKind, 'action');
      assert.strictEqual(task.scheduledStart, '2026-05-01T10:00:00');
      assert.strictEqual(task.scheduledEnd, '2026-05-01T11:00:00');
      assert.strictEqual(task.actualStart, '2026-05-01T10:05:00');
      assert.strictEqual(task.actualEnd, '2026-05-01T10:55:00');
      assert.strictEqual(task.createdAt, '2026-04-30T09:00:00.000Z');

      // Exact replay (same opId) and same-uuid replay (new opId) are both idempotent
      const replay = await pushOne(op);
      assert.strictEqual(replay.status, 'alreadyApplied');
      assert.strictEqual(replay.serverId, result.serverId);

      const differentOp = await pushOne({ ...op, opId: nextOpId() });
      assert.strictEqual(differentOp.status, 'alreadyApplied');
      assert.strictEqual(differentOp.serverId, result.serverId);

      const list = await getJson('/api/tasks');
      assert.strictEqual(list.data.filter((t: any) => t.title === 'Migrated task').length, 1);
    });

    it('applies a minimal task payload with defaults (status inbox, kind action)', async () => {
      const result = await pushOne({
        opId: nextOpId(),
        entity: 'task',
        type: 'create',
        uuid: nextUuid(),
        payload: { title: 'Minimal task' },
      });
      assert.strictEqual(result.status, 'applied');

      const task = await getJson(`/api/tasks/${result.serverId}`);
      assert.strictEqual(task.status, 'inbox');
      assert.strictEqual(task.taskKind, 'action');
      assert.strictEqual(task.bodyMd, '');
    });

    it('rejects a task create without title (400)', async () => {
      const response = await push([
        { opId: nextOpId(), entity: 'task', type: 'create', uuid: nextUuid(), payload: { bodyMd: 'no title' } },
      ]);
      assert.strictEqual(response.statusCode, 400);
    });
  });

  describe('article create', () => {
    it('applies an article create preserving meta and createdAt', async () => {
      const uuid = nextUuid();
      const op = {
        opId: nextOpId(),
        entity: 'article',
        type: 'create',
        uuid,
        payload: {
          title: 'Migrated article',
          bodyMd: '# Saved content',
          meta: {
            originalUrl: 'https://example.com/migrated',
            siteName: 'Example Site',
            archivedAt: '2026-04-01T08:00:00.000Z',
          },
          createdAt: '2026-04-01T08:00:05.000Z',
        },
      };

      const result = await pushOne(op);
      assert.strictEqual(result.status, 'applied');

      const article = await getJson(`/api/articles/${result.serverId}`);
      assert.strictEqual(article.title, 'Migrated article');
      assert.strictEqual(article.bodyMd, '# Saved content');
      assert.strictEqual(article.meta.originalUrl, 'https://example.com/migrated');
      assert.strictEqual(article.meta.siteName, 'Example Site');
      assert.strictEqual(article.meta.archivedAt, '2026-04-01T08:00:00.000Z');
      assert.strictEqual(article.createdAt, '2026-04-01T08:00:05.000Z');

      const replay = await pushOne({ ...op, opId: nextOpId() });
      assert.strictEqual(replay.status, 'alreadyApplied');
      assert.strictEqual(replay.serverId, result.serverId);
    });

    it('rejects an article create without meta.originalUrl (400)', async () => {
      const response = await push([
        {
          opId: nextOpId(),
          entity: 'article',
          type: 'create',
          uuid: nextUuid(),
          payload: { title: 'No URL', bodyMd: 'body' },
        },
      ]);
      assert.strictEqual(response.statusCode, 400);
    });
  });

  describe('label create', () => {
    it('applies a label create and re-sends of the same name are alreadyApplied', async () => {
      const first = await pushOne({
        opId: nextOpId(),
        entity: 'label',
        type: 'create',
        uuid: nextUuid(),
        payload: { name: 'ios-label', description: 'from iOS', createdAt: '2026-03-01T00:00:00.000Z' },
      });
      assert.strictEqual(first.status, 'applied');
      assert.ok(first.serverId);

      const labels = await getJson('/api/labels');
      const created = labels.find((l: any) => l.name === 'ios-label');
      assert.ok(created);
      assert.strictEqual(created.description, 'from iOS');
      assert.strictEqual(created.createdAt, '2026-03-01T00:00:00.000Z');

      // Same name from another op (idempotent re-run): existing id comes back
      const resend = await pushOne({
        opId: nextOpId(),
        entity: 'label',
        type: 'create',
        uuid: nextUuid(),
        payload: { name: 'ios-label' },
      });
      assert.strictEqual(resend.status, 'alreadyApplied');
      assert.strictEqual(resend.serverId, first.serverId);
    });

    it('a label that already exists on the server is alreadyApplied, not an error', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/labels',
        payload: { name: 'server-side-label' },
      });
      assert.strictEqual(created.statusCode, 201);
      const serverLabelId = JSON.parse(created.body).id;

      const result = await pushOne({
        opId: nextOpId(),
        entity: 'label',
        type: 'create',
        uuid: nextUuid(),
        payload: { name: 'server-side-label' },
      });
      assert.strictEqual(result.status, 'alreadyApplied');
      assert.strictEqual(result.serverId, serverLabelId);
    });
  });

  describe('issue_label create', () => {
    const seedMemoAndLabel = async () => {
      const memoUuid = nextUuid();
      const response = await push([
        { opId: nextOpId(), entity: 'memo', type: 'create', uuid: memoUuid, payload: { bodyMd: 'labeled memo' } },
        { opId: nextOpId(), entity: 'label', type: 'create', uuid: nextUuid(), payload: { name: 'attach-me' } },
      ]);
      const results = JSON.parse(response.body).results;
      return { memoUuid, memoId: results[0].serverId };
    };

    it('resolves issueUuid and labelName, applies once, replays as alreadyApplied', async () => {
      const { memoUuid, memoId } = await seedMemoAndLabel();

      const first = await pushOne({
        opId: nextOpId(),
        entity: 'issue_label',
        type: 'create',
        uuid: nextUuid(),
        payload: { issueUuid: memoUuid, labelName: 'attach-me' },
      });
      assert.strictEqual(first.status, 'applied');

      const memo = await getJson(`/api/memos/${memoId}`);
      assert.deepStrictEqual(memo.labels, ['attach-me']);

      const resend = await pushOne({
        opId: nextOpId(),
        entity: 'issue_label',
        type: 'create',
        uuid: nextUuid(),
        payload: { issueUuid: memoUuid, labelName: 'attach-me' },
      });
      assert.strictEqual(resend.status, 'alreadyApplied');

      const after = await getJson(`/api/memos/${memoId}`);
      assert.deepStrictEqual(after.labels, ['attach-me']);
    });

    it('skips with a reason when the issue or the label cannot be resolved', async () => {
      const { memoUuid } = await seedMemoAndLabel();

      const unknownIssue = await pushOne({
        opId: nextOpId(),
        entity: 'issue_label',
        type: 'create',
        uuid: nextUuid(),
        payload: { issueUuid: nextUuid(), labelName: 'attach-me' },
      });
      assert.strictEqual(unknownIssue.status, 'skipped');
      assert.match(unknownIssue.reason, /issue not found/);

      const unknownLabel = await pushOne({
        opId: nextOpId(),
        entity: 'issue_label',
        type: 'create',
        uuid: nextUuid(),
        payload: { issueUuid: memoUuid, labelName: 'no-such-label' },
      });
      assert.strictEqual(unknownLabel.status, 'skipped');
      assert.match(unknownLabel.reason, /label not found/);
    });
  });

  describe('link create', () => {
    const seedTwoMemos = async () => {
      const sourceUuid = nextUuid();
      const targetUuid = nextUuid();
      const response = await push([
        { opId: nextOpId(), entity: 'memo', type: 'create', uuid: sourceUuid, payload: { bodyMd: 'link source' } },
        { opId: nextOpId(), entity: 'memo', type: 'create', uuid: targetUuid, payload: { bodyMd: 'link target' } },
      ]);
      const results = JSON.parse(response.body).results;
      return {
        sourceUuid,
        targetUuid,
        sourceId: results[0].serverId,
        targetId: results[1].serverId,
      };
    };

    it('resolves both issue uuids, applies once, replays as alreadyApplied', async () => {
      const seeded = await seedTwoMemos();

      const first = await pushOne({
        opId: nextOpId(),
        entity: 'link',
        type: 'create',
        uuid: nextUuid(),
        payload: { sourceIssueUuid: seeded.sourceUuid, targetIssueUuid: seeded.targetUuid, linkType: 'relates' },
      });
      assert.strictEqual(first.status, 'applied');
      assert.ok(first.serverId);

      const links = await getJson(`/api/issues/${seeded.sourceId}/links`);
      const created = (Array.isArray(links) ? links : links.data).find(
        (l: any) => l.id === first.serverId
      );
      assert.ok(created);
      assert.strictEqual(created.linkType, 'relates');
      assert.strictEqual(created.sourceIssueId, seeded.sourceId);
      assert.strictEqual(created.targetIssueId, seeded.targetId);

      // Same pair again (new opId) is idempotent
      const resend = await pushOne({
        opId: nextOpId(),
        entity: 'link',
        type: 'create',
        uuid: nextUuid(),
        payload: { sourceIssueUuid: seeded.sourceUuid, targetIssueUuid: seeded.targetUuid, linkType: 'relates' },
      });
      assert.strictEqual(resend.status, 'alreadyApplied');
      assert.strictEqual(resend.serverId, first.serverId);

      // The symmetric 'relates' inverse is the same relationship
      const inverse = await pushOne({
        opId: nextOpId(),
        entity: 'link',
        type: 'create',
        uuid: nextUuid(),
        payload: { sourceIssueUuid: seeded.targetUuid, targetIssueUuid: seeded.sourceUuid, linkType: 'relates' },
      });
      assert.strictEqual(inverse.status, 'alreadyApplied');
      assert.strictEqual(inverse.serverId, first.serverId);
    });

    it('skips with a reason when a referenced issue is missing or validation fails', async () => {
      const seeded = await seedTwoMemos();

      const missingTarget = await pushOne({
        opId: nextOpId(),
        entity: 'link',
        type: 'create',
        uuid: nextUuid(),
        payload: { sourceIssueUuid: seeded.sourceUuid, targetIssueUuid: nextUuid(), linkType: 'relates' },
      });
      assert.strictEqual(missingTarget.status, 'skipped');
      assert.match(missingTarget.reason, /target issue not found/);

      const selfLink = await pushOne({
        opId: nextOpId(),
        entity: 'link',
        type: 'create',
        uuid: nextUuid(),
        payload: { sourceIssueUuid: seeded.sourceUuid, targetIssueUuid: seeded.sourceUuid, linkType: 'parent' },
      });
      assert.strictEqual(selfLink.status, 'skipped');
      assert.ok(selfLink.reason);
    });
  });

  describe('validation', () => {
    it('rejects update/delete for bulk-migration entities (400)', async () => {
      for (const entity of ['task', 'article', 'label', 'issue_label', 'link']) {
        for (const type of ['update', 'delete']) {
          const response = await push([
            { opId: nextOpId(), entity, type, uuid: nextUuid(), payload: { title: 'x', name: 'x' } },
          ]);
          assert.strictEqual(response.statusCode, 400, `${entity} ${type} should be rejected`);
        }
      }
    });

    it('rejects a request with more than 500 operations (400)', async () => {
      const operations = Array.from({ length: 501 }, () => ({
        opId: nextOpId(),
        entity: 'memo',
        type: 'create',
        uuid: nextUuid(),
        payload: { bodyMd: 'bulk' },
      }));
      const response = await push(operations);
      assert.strictEqual(response.statusCode, 400);
    });
  });

  describe('full migration scenario', () => {
    it('migrates labels, issues, issue_labels, comments and links in dependency order within one request', async () => {
      const taskUuid = nextUuid();
      const articleUuid = nextUuid();
      const memoUuid = nextUuid();
      const commentUuid = nextUuid();

      const response = await push([
        // 1. labels
        { opId: nextOpId(), entity: 'label', type: 'create', uuid: nextUuid(), payload: { name: 'migration' } },
        { opId: nextOpId(), entity: 'label', type: 'create', uuid: nextUuid(), payload: { name: 'reading' } },
        // 2. issues (task / article / memo)
        {
          opId: nextOpId(),
          entity: 'task',
          type: 'create',
          uuid: taskUuid,
          payload: { title: 'Do the migration', bodyMd: 'move everything', status: 'next', actualStart: '2026-06-01T09:00:00' },
        },
        {
          opId: nextOpId(),
          entity: 'article',
          type: 'create',
          uuid: articleUuid,
          payload: { title: 'Sync design notes', bodyMd: 'content', meta: { originalUrl: 'https://example.com/notes' } },
        },
        { opId: nextOpId(), entity: 'memo', type: 'create', uuid: memoUuid, payload: { bodyMd: 'migration memo' } },
        // 3. issue_labels
        { opId: nextOpId(), entity: 'issue_label', type: 'create', uuid: nextUuid(), payload: { issueUuid: taskUuid, labelName: 'migration' } },
        { opId: nextOpId(), entity: 'issue_label', type: 'create', uuid: nextUuid(), payload: { issueUuid: articleUuid, labelName: 'reading' } },
        // 4. comments
        { opId: nextOpId(), entity: 'comment', type: 'create', uuid: commentUuid, issueUuid: taskUuid, payload: { bodyMd: 'progress note' } },
        // 5. links
        {
          opId: nextOpId(),
          entity: 'link',
          type: 'create',
          uuid: nextUuid(),
          payload: { sourceIssueUuid: memoUuid, targetIssueUuid: taskUuid, linkType: 'relates' },
        },
        {
          opId: nextOpId(),
          entity: 'link',
          type: 'create',
          uuid: nextUuid(),
          payload: { sourceIssueUuid: taskUuid, targetIssueUuid: articleUuid, linkType: 'derived_from' },
        },
      ]);

      assert.strictEqual(response.statusCode, 200);
      const body = JSON.parse(response.body);
      assert.deepStrictEqual(
        body.results.map((r: any) => r.status),
        Array(10).fill('applied')
      );

      const taskId = body.results[2].serverId;
      const articleId = body.results[3].serverId;
      const memoId = body.results[4].serverId;

      const task = await getJson(`/api/tasks/${taskId}`);
      assert.strictEqual(task.status, 'next');
      assert.strictEqual(task.actualStart, '2026-06-01T09:00:00');
      assert.deepStrictEqual(task.labels, ['migration']);

      const article = await getJson(`/api/articles/${articleId}`);
      assert.deepStrictEqual(article.labels, ['reading']);

      const comments = await getJson(`/api/tasks/${taskId}/comments`);
      assert.strictEqual(comments.length, 1);
      assert.strictEqual(comments[0].bodyMd, 'progress note');

      const taskLinks = await getJson(`/api/issues/${taskId}/links`);
      const linkRows = Array.isArray(taskLinks) ? taskLinks : taskLinks.data;
      assert.strictEqual(linkRows.length, 2);

      // The memo side sees the relates link too
      const memoLinks = await getJson(`/api/issues/${memoId}/links`);
      const memoLinkRows = Array.isArray(memoLinks) ? memoLinks : memoLinks.data;
      assert.strictEqual(memoLinkRows.length, 1);
      assert.strictEqual(memoLinkRows[0].linkType, 'relates');
    });
  });

  describe('activity log integration', () => {
    it('bulk-migration mutations go through the service layer and are logged', async () => {
      const taskUuid = nextUuid();
      const articleUuid = nextUuid();
      const response = await push([
        { opId: nextOpId(), entity: 'label', type: 'create', uuid: nextUuid(), payload: { name: 'logged-label' } },
        { opId: nextOpId(), entity: 'task', type: 'create', uuid: taskUuid, payload: { title: 'Logged task' } },
        {
          opId: nextOpId(),
          entity: 'article',
          type: 'create',
          uuid: articleUuid,
          payload: { title: 'Logged article', bodyMd: 'body', meta: { originalUrl: 'https://example.com/logged' } },
        },
        { opId: nextOpId(), entity: 'issue_label', type: 'create', uuid: nextUuid(), payload: { issueUuid: taskUuid, labelName: 'logged-label' } },
        {
          opId: nextOpId(),
          entity: 'link',
          type: 'create',
          uuid: nextUuid(),
          payload: { sourceIssueUuid: taskUuid, targetIssueUuid: articleUuid, linkType: 'relates' },
        },
      ]);
      const results = JSON.parse(response.body).results;
      assert.deepStrictEqual(results.map((r: any) => r.status), Array(5).fill('applied'));

      const taskEvents = await activityLogEventTypes(results[1].serverId);
      assert.ok(taskEvents.includes('task.created'));
      assert.ok(taskEvents.includes('label.assigned'));
      assert.ok(taskEvents.includes('link.created'));

      const articleEvents = await activityLogEventTypes(results[2].serverId);
      assert.ok(articleEvents.includes('article.created'));
    });
  });
});
