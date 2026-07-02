import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { setTimeout as sleep } from 'node:timers/promises';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';

const DEVICE = 'test-device-1';

let opCounter = 0;
const nextOpId = () => `op-${++opCounter}`;

let uuidCounter = 0;
const nextUuid = () => `00000000-0000-7000-8000-${String(++uuidCounter).padStart(12, '0')}`;

describe('Sync API (GET /api/sync/changes, POST /api/sync/push)', () => {
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

  const pullChanges = async (since: number, limit?: number) => {
    const url = `/api/sync/changes?since=${since}${limit ? `&limit=${limit}` : ''}`;
    const response = await app.inject({ method: 'GET', url });
    assert.strictEqual(response.statusCode, 200);
    return JSON.parse(response.body);
  };

  const createMemoViaApi = async (bodyMd: string): Promise<number> => {
    const response = await app.inject({ method: 'POST', url: '/api/memos', payload: { bodyMd } });
    assert.strictEqual(response.statusCode, 201);
    return JSON.parse(response.body).id;
  };

  describe('changes feed', () => {
    it('returns all existing rows for since=0, ordered by serverSeq', async () => {
      await createMemoViaApi('memo one');
      await createMemoViaApi('memo two');

      const page = await pullChanges(0);
      assert.ok(page.changes.length >= 2);
      assert.ok(page.latestSeq >= 2);
      assert.strictEqual(page.hasMore, false);

      const seqs = page.changes.map((c: any) => c.serverSeq);
      assert.deepStrictEqual(seqs, [...seqs].sort((a: number, b: number) => a - b));

      const issueChanges = page.changes.filter((c: any) => c.entity === 'issue');
      assert.strictEqual(issueChanges.length, 2);
      assert.strictEqual(issueChanges[0].op, 'upsert');
      assert.ok(issueChanges[0].data.uuid);
      assert.strictEqual(issueChanges[0].data.bodyMd, 'memo one');
    });

    it('paginates with limit and hasMore, cursor resumes correctly', async () => {
      await createMemoViaApi('m1');
      await createMemoViaApi('m2');
      await createMemoViaApi('m3');

      const page1 = await pullChanges(0, 2);
      assert.strictEqual(page1.changes.length, 2);
      assert.strictEqual(page1.hasMore, true);

      const cursor = page1.changes[page1.changes.length - 1].serverSeq;
      const page2 = await pullChanges(cursor, 2);
      assert.strictEqual(page2.hasMore, false);
      assert.ok(page2.changes.length >= 1);
      assert.ok(page2.changes[0].serverSeq > cursor);
    });

    it('includes soft-deleted memos with isDeleted=true (deletion visible to pollers)', async () => {
      const id = await createMemoViaApi('to be deleted');
      const del = await app.inject({ method: 'DELETE', url: `/api/memos/${id}` });
      assert.strictEqual(del.statusCode, 204);

      const page = await pullChanges(0);
      const deleted = page.changes.find((c: any) => c.entity === 'issue' && c.data.id === id);
      assert.ok(deleted);
      assert.strictEqual(deleted.data.isDeleted, true);
    });

    it('emits label/issue_label upserts and delete tombstones', async () => {
      const memoId = await createMemoViaApi('labeled memo');
      const labelRes = await app.inject({
        method: 'POST',
        url: '/api/labels',
        payload: { name: 'sync-label' },
      });
      assert.strictEqual(labelRes.statusCode, 201);
      const labelId = JSON.parse(labelRes.body).id;

      await app.inject({
        method: 'POST',
        url: `/api/issues/${memoId}/labels`,
        payload: { labelId },
      });

      let page = await pullChanges(0);
      assert.ok(page.changes.some((c: any) => c.entity === 'label' && c.op === 'upsert' && c.data.name === 'sync-label'));
      assert.ok(page.changes.some((c: any) => c.entity === 'issue_label' && c.op === 'upsert' && c.data.labelName === 'sync-label'));

      const cursorBeforeDelete = page.latestSeq;
      await app.inject({ method: 'DELETE', url: '/api/labels/sync-label' });

      page = await pullChanges(cursorBeforeDelete);
      const labelDelete = page.changes.find((c: any) => c.entity === 'label' && c.op === 'delete');
      const assignmentDelete = page.changes.find((c: any) => c.entity === 'issue_label' && c.op === 'delete');
      assert.ok(labelDelete);
      assert.strictEqual(labelDelete.data.labelName, 'sync-label');
      assert.ok(assignmentDelete);
      assert.strictEqual(assignmentDelete.data.labelId, labelId);
    });

    it('comment changes carry the parent issueUuid', async () => {
      const memoId = await createMemoViaApi('memo with comment');
      await app.inject({
        method: 'POST',
        url: `/api/memos/${memoId}/comments`,
        payload: { bodyMd: 'a comment' },
      });

      const page = await pullChanges(0);
      const memoChange = page.changes.find((c: any) => c.entity === 'issue' && c.data.id === memoId);
      const commentChange = page.changes.find((c: any) => c.entity === 'comment');
      assert.ok(commentChange);
      assert.strictEqual(commentChange.data.issueUuid, memoChange.data.uuid);
      assert.strictEqual(commentChange.data.issueId, memoId);
    });
  });

  describe('push: create', () => {
    it('applies a memo create and is idempotent on replay', async () => {
      const uuid = nextUuid();
      const op = {
        opId: nextOpId(),
        entity: 'memo',
        type: 'create',
        uuid,
        payload: { bodyMd: 'offline memo', createdAt: '2026-01-15T10:00:00.000Z' },
      };

      const first = await push([op]);
      assert.strictEqual(first.statusCode, 200);
      const firstBody = JSON.parse(first.body);
      assert.strictEqual(firstBody.results[0].status, 'applied');
      assert.strictEqual(firstBody.results[0].uuid, uuid);
      assert.ok(firstBody.results[0].serverId);
      assert.ok(firstBody.results[0].updatedAt);
      assert.ok(firstBody.latestSeq > 0);

      // The memo is visible through the normal API with preserved createdAt
      const list = await app.inject({ method: 'GET', url: '/api/memos' });
      const memos = JSON.parse(list.body).data;
      const created = memos.find((m: any) => m.id === firstBody.results[0].serverId);
      assert.ok(created);
      assert.strictEqual(created.bodyMd, 'offline memo');
      assert.strictEqual(created.createdAt, '2026-01-15T10:00:00.000Z');

      // Exact replay (same opId) returns the recorded result as alreadyApplied
      const replay = await push([op]);
      const replayBody = JSON.parse(replay.body);
      assert.strictEqual(replayBody.results[0].status, 'alreadyApplied');
      assert.strictEqual(replayBody.results[0].serverId, firstBody.results[0].serverId);

      // Same uuid under a NEW opId is also detected as already applied
      const differentOp = await push([{ ...op, opId: nextOpId() }]);
      assert.strictEqual(JSON.parse(differentOp.body).results[0].status, 'alreadyApplied');

      // No duplicate memos were created
      const finalList = JSON.parse((await app.inject({ method: 'GET', url: '/api/memos' })).body);
      assert.strictEqual(finalList.data.filter((m: any) => m.bodyMd === 'offline memo').length, 1);
    });

    it('creates memo comments resolving issueUuid, FIFO within one batch', async () => {
      const memoUuid = nextUuid();
      const commentUuid = nextUuid();
      const response = await push([
        {
          opId: nextOpId(),
          entity: 'memo',
          type: 'create',
          uuid: memoUuid,
          payload: { bodyMd: 'parent memo' },
        },
        {
          opId: nextOpId(),
          entity: 'comment',
          type: 'create',
          uuid: commentUuid,
          issueUuid: memoUuid,
          payload: { bodyMd: 'offline comment' },
        },
      ]);

      const body = JSON.parse(response.body);
      assert.strictEqual(body.results[0].status, 'applied');
      assert.strictEqual(body.results[1].status, 'applied');

      const memoId = body.results[0].serverId;
      const comments = JSON.parse(
        (await app.inject({ method: 'GET', url: `/api/memos/${memoId}/comments` })).body
      );
      assert.strictEqual(comments.length, 1);
      assert.strictEqual(comments[0].bodyMd, 'offline comment');
    });

    it('skips a comment create whose parent uuid is unknown', async () => {
      const response = await push([
        {
          opId: nextOpId(),
          entity: 'comment',
          type: 'create',
          uuid: nextUuid(),
          issueUuid: nextUuid(),
          payload: { bodyMd: 'orphan comment' },
        },
      ]);
      assert.strictEqual(JSON.parse(response.body).results[0].status, 'skipped');
    });

    it('rejects create without bodyMd and comment create without issueUuid (400)', async () => {
      const noBody = await push([
        { opId: nextOpId(), entity: 'memo', type: 'create', uuid: nextUuid() },
      ]);
      assert.strictEqual(noBody.statusCode, 400);

      const noParent = await push([
        {
          opId: nextOpId(),
          entity: 'comment',
          type: 'create',
          uuid: nextUuid(),
          payload: { bodyMd: 'x' },
        },
      ]);
      assert.strictEqual(noParent.statusCode, 400);
    });
  });

  describe('push: update and conflicts', () => {
    // Creates a memo via push and returns { uuid, serverId, updatedAt }
    const seedMemo = async (bodyMd: string) => {
      const uuid = nextUuid();
      const response = await push([
        { opId: nextOpId(), entity: 'memo', type: 'create', uuid, payload: { bodyMd } },
      ]);
      const result = JSON.parse(response.body).results[0];
      return { uuid, serverId: result.serverId, updatedAt: result.updatedAt };
    };

    it('applies an update when baseUpdatedAt matches (clean fast-forward)', async () => {
      const memo = await seedMemo('original body');
      const response = await push([
        {
          opId: nextOpId(),
          entity: 'memo',
          type: 'update',
          uuid: memo.uuid,
          baseUpdatedAt: memo.updatedAt,
          payload: { bodyMd: 'edited offline' },
        },
      ]);
      const result = JSON.parse(response.body).results[0];
      assert.strictEqual(result.status, 'applied');
      assert.notStrictEqual(result.updatedAt, memo.updatedAt);

      const detail = JSON.parse(
        (await app.inject({ method: 'GET', url: `/api/memos/${memo.serverId}` })).body
      );
      assert.strictEqual(detail.bodyMd, 'edited offline');
    });

    it('creates a conflicted copy when the body diverged (server version wins)', async () => {
      const memo = await seedMemo('base body');

      // Server-side edit invalidates the client's base
      await sleep(5);
      await app.inject({
        method: 'PATCH',
        url: `/api/memos/${memo.serverId}`,
        payload: { bodyMd: 'server edit' },
      });

      const response = await push([
        {
          opId: nextOpId(),
          entity: 'memo',
          type: 'update',
          uuid: memo.uuid,
          baseUpdatedAt: memo.updatedAt, // stale
          payload: { bodyMd: 'client edit' },
        },
      ]);
      const result = JSON.parse(response.body).results[0];
      assert.strictEqual(result.status, 'conflictCopied');
      assert.ok(result.conflictCopyUuid);

      // Server row keeps the server version
      const detail = JSON.parse(
        (await app.inject({ method: 'GET', url: `/api/memos/${memo.serverId}` })).body
      );
      assert.strictEqual(detail.bodyMd, 'server edit');

      // The client body survives as a conflicted-copy memo
      const list = JSON.parse((await app.inject({ method: 'GET', url: '/api/memos' })).body);
      const copy = list.data.find((m: any) => m.bodyMd.includes('client edit'));
      assert.ok(copy);
      assert.ok(copy.bodyMd.startsWith('> Conflicted copy (from device test-device-1'));
    });

    it('applies a bookmark-only change as LWW even with a stale base (no conflict copy)', async () => {
      const memo = await seedMemo('bookmark target');
      await sleep(5);
      await app.inject({
        method: 'PATCH',
        url: `/api/memos/${memo.serverId}`,
        payload: { bodyMd: 'server edit' },
      });

      const countBefore = JSON.parse(
        (await app.inject({ method: 'GET', url: '/api/memos' })).body
      ).total;

      const response = await push([
        {
          opId: nextOpId(),
          entity: 'memo',
          type: 'update',
          uuid: memo.uuid,
          baseUpdatedAt: memo.updatedAt, // stale
          payload: { isBookmarked: true },
        },
      ]);
      assert.strictEqual(JSON.parse(response.body).results[0].status, 'applied');

      const detail = JSON.parse(
        (await app.inject({ method: 'GET', url: `/api/memos/${memo.serverId}` })).body
      );
      assert.strictEqual(detail.isBookmarked, true);
      assert.strictEqual(detail.bodyMd, 'server edit');

      const countAfter = JSON.parse(
        (await app.inject({ method: 'GET', url: '/api/memos' })).body
      ).total;
      assert.strictEqual(countAfter, countBefore);
    });

    it('edit beats delete: updating a server-deleted memo resurrects it', async () => {
      const memo = await seedMemo('will be deleted on server');
      await app.inject({ method: 'DELETE', url: `/api/memos/${memo.serverId}` });

      const response = await push([
        {
          opId: nextOpId(),
          entity: 'memo',
          type: 'update',
          uuid: memo.uuid,
          baseUpdatedAt: memo.updatedAt,
          payload: { bodyMd: 'edited while server deleted it' },
        },
      ]);
      assert.strictEqual(JSON.parse(response.body).results[0].status, 'applied');

      const detail = await app.inject({ method: 'GET', url: `/api/memos/${memo.serverId}` });
      assert.strictEqual(detail.statusCode, 200);
      assert.strictEqual(JSON.parse(detail.body).bodyMd, 'edited while server deleted it');
    });
  });

  describe('push: delete', () => {
    const seedMemo = async (bodyMd: string) => {
      const uuid = nextUuid();
      const response = await push([
        { opId: nextOpId(), entity: 'memo', type: 'create', uuid, payload: { bodyMd } },
      ]);
      const result = JSON.parse(response.body).results[0];
      return { uuid, serverId: result.serverId, updatedAt: result.updatedAt };
    };

    it('applies a delete when baseUpdatedAt matches', async () => {
      const memo = await seedMemo('delete me');
      const response = await push([
        {
          opId: nextOpId(),
          entity: 'memo',
          type: 'delete',
          uuid: memo.uuid,
          baseUpdatedAt: memo.updatedAt,
        },
      ]);
      assert.strictEqual(JSON.parse(response.body).results[0].status, 'applied');

      const detail = await app.inject({ method: 'GET', url: `/api/memos/${memo.serverId}` });
      assert.strictEqual(detail.statusCode, 404);
    });

    it('edit beats delete: a stale delete is skipped when the server row was edited', async () => {
      const memo = await seedMemo('server will edit this');
      await sleep(5);
      await app.inject({
        method: 'PATCH',
        url: `/api/memos/${memo.serverId}`,
        payload: { bodyMd: 'server edited' },
      });

      const response = await push([
        {
          opId: nextOpId(),
          entity: 'memo',
          type: 'delete',
          uuid: memo.uuid,
          baseUpdatedAt: memo.updatedAt, // stale
        },
      ]);
      assert.strictEqual(JSON.parse(response.body).results[0].status, 'skipped');

      const detail = await app.inject({ method: 'GET', url: `/api/memos/${memo.serverId}` });
      assert.strictEqual(detail.statusCode, 200);
    });

    it('deleting an unknown or already-deleted memo is alreadyApplied (idempotent no-op)', async () => {
      const unknown = await push([
        { opId: nextOpId(), entity: 'memo', type: 'delete', uuid: nextUuid() },
      ]);
      assert.strictEqual(JSON.parse(unknown.body).results[0].status, 'alreadyApplied');

      const memo = await seedMemo('double delete');
      await push([
        { opId: nextOpId(), entity: 'memo', type: 'delete', uuid: memo.uuid, baseUpdatedAt: memo.updatedAt },
      ]);
      const second = await push([
        { opId: nextOpId(), entity: 'memo', type: 'delete', uuid: memo.uuid },
      ]);
      assert.strictEqual(JSON.parse(second.body).results[0].status, 'alreadyApplied');
    });
  });

  describe('push: comments update/delete', () => {
    const seedMemoWithComment = async () => {
      const memoUuid = nextUuid();
      const commentUuid = nextUuid();
      const response = await push([
        { opId: nextOpId(), entity: 'memo', type: 'create', uuid: memoUuid, payload: { bodyMd: 'parent' } },
        {
          opId: nextOpId(),
          entity: 'comment',
          type: 'create',
          uuid: commentUuid,
          issueUuid: memoUuid,
          payload: { bodyMd: 'first version' },
        },
      ]);
      const results = JSON.parse(response.body).results;
      return {
        memoId: results[0].serverId,
        commentUuid,
        commentUpdatedAt: results[1].updatedAt,
      };
    };

    it('updates and deletes comments through push', async () => {
      const seeded = await seedMemoWithComment();

      const update = await push([
        {
          opId: nextOpId(),
          entity: 'comment',
          type: 'update',
          uuid: seeded.commentUuid,
          baseUpdatedAt: seeded.commentUpdatedAt,
          payload: { bodyMd: 'edited comment' },
        },
      ]);
      const updateResult = JSON.parse(update.body).results[0];
      assert.strictEqual(updateResult.status, 'applied');

      let comments = JSON.parse(
        (await app.inject({ method: 'GET', url: `/api/memos/${seeded.memoId}/comments` })).body
      );
      assert.strictEqual(comments[0].bodyMd, 'edited comment');

      const del = await push([
        {
          opId: nextOpId(),
          entity: 'comment',
          type: 'delete',
          uuid: seeded.commentUuid,
          baseUpdatedAt: updateResult.updatedAt,
        },
      ]);
      assert.strictEqual(JSON.parse(del.body).results[0].status, 'applied');

      comments = JSON.parse(
        (await app.inject({ method: 'GET', url: `/api/memos/${seeded.memoId}/comments` })).body
      );
      assert.strictEqual(comments.length, 0);
    });

    it('edit beats delete for comments: stale comment delete is skipped after a server edit', async () => {
      const seeded = await seedMemoWithComment();

      // Server-side comment edit via push with fresh base (simulates another device)
      await sleep(5);
      const serverEdit = await push([
        {
          opId: nextOpId(),
          entity: 'comment',
          type: 'update',
          uuid: seeded.commentUuid,
          baseUpdatedAt: seeded.commentUpdatedAt,
          payload: { bodyMd: 'edited by other device' },
        },
      ]);
      assert.strictEqual(JSON.parse(serverEdit.body).results[0].status, 'applied');

      const staleDelete = await push([
        {
          opId: nextOpId(),
          entity: 'comment',
          type: 'delete',
          uuid: seeded.commentUuid,
          baseUpdatedAt: seeded.commentUpdatedAt, // stale
        },
      ]);
      assert.strictEqual(JSON.parse(staleDelete.body).results[0].status, 'skipped');

      const comments = JSON.parse(
        (await app.inject({ method: 'GET', url: `/api/memos/${seeded.memoId}/comments` })).body
      );
      assert.strictEqual(comments.length, 1);
      assert.strictEqual(comments[0].bodyMd, 'edited by other device');
    });
  });

  describe('activity log integration', () => {
    it('push mutations are recorded in the activity log', async () => {
      const uuid = nextUuid();
      const response = await push([
        { opId: nextOpId(), entity: 'memo', type: 'create', uuid, payload: { bodyMd: 'logged memo' } },
      ]);
      const serverId = JSON.parse(response.body).results[0].serverId;

      const log = JSON.parse(
        (await app.inject({ method: 'GET', url: `/api/activity-log/issues/${serverId}` })).body
      );
      const entries = Array.isArray(log) ? log : log.data ?? log.entries;
      assert.ok(entries.some((e: any) => e.eventType === 'memo.created'));
    });
  });
});
