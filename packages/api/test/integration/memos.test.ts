import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { setTimeout as sleep } from 'node:timers/promises';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';
import { createMemoFixture } from '../helpers/fixtures.js';
import { createMemo } from 'meme-gtd-db';

describe('Memo CRUD Operations', () => {
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

  it('should create a new memo (POST /api/memos)', async () => {
    const memoData = createMemoFixture({ bodyMd: 'Test memo content' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: memoData,
    });

    if (response.statusCode !== 201) {
      console.error('Error response:', response.body);
    }
    assert.strictEqual(response.statusCode, 201);
    const memo = JSON.parse(response.body);
    assert.strictEqual(memo.type, 'memo');
    assert.strictEqual(memo.bodyMd, 'Test memo content');
    assert.strictEqual(memo.isBookmarked, false);
    assert.ok(memo.id);
    assert.ok(memo.createdAt);
    assert.ok(memo.updatedAt);
  });

  it('should return 400 when creating memo with empty body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { bodyMd: '' },
    });

    assert.strictEqual(response.statusCode, 400);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'VALIDATION_ERROR');
  });

  it('should list all memos (GET /api/memos)', async () => {
    // Create test memos
    await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Memo 1' }),
    });
    await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Memo 2' }),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/memos',
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.ok(result.data, 'result.data should exist');
    assert.ok(Array.isArray(result.data));
    assert.strictEqual(result.data.length, 2);
    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.limit, 100);
    assert.strictEqual(result.offset, 0);
    // T014: Assert labels field exists and is an array
    result.data.forEach((memo: any) => {
      assert.ok(Array.isArray(memo.labels), 'labels should be an array');
    });
  });

  it('should filter bookmarked memos (GET /api/memos?bookmarked=true)', async () => {
    // Create memo and bookmark it
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });
    const memo = JSON.parse(createResponse.body);

    await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/bookmark`,
    });

    // Create another non-bookmarked memo
    await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/memos?bookmarked=true',
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.data[0].isBookmarked, true);
  });

  it('should get memo by ID (GET /api/memos/:id)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Specific memo' }),
    });
    const created = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/memos/${created.id}`,
    });

    assert.strictEqual(response.statusCode, 200);
    const memo = JSON.parse(response.body);
    assert.strictEqual(memo.id, created.id);
    assert.strictEqual(memo.bodyMd, 'Specific memo');
    // T015: Assert labels field exists
    assert.ok(Array.isArray(memo.labels), 'labels should be an array');
  });

  it('should return 404 when memo not found (GET /api/memos/:id)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/memos/99999',
    });

    assert.strictEqual(response.statusCode, 404);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'NOT_FOUND');
  });

  it('should update memo (PATCH /api/memos/:id)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Original content' }),
    });
    const memo = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/memos/${memo.id}`,
      payload: { bodyMd: 'Updated content' },
    });

    assert.strictEqual(response.statusCode, 200);
    const updated = JSON.parse(response.body);
    assert.strictEqual(updated.bodyMd, 'Updated content');
    assert.strictEqual(updated.id, memo.id);
  });

  it('should delete memo (DELETE /api/memos/:id)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });
    const memo = JSON.parse(createResponse.body);

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/memos/${memo.id}`,
    });

    assert.strictEqual(deleteResponse.statusCode, 204);

    // Verify memo is deleted (soft delete)
    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/memos/${memo.id}`,
    });

    assert.strictEqual(getResponse.statusCode, 404);
  });

  it('should return memo with labels (GET /api/memos/:id) - T016', async () => {
    // Create a memo
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Memo with labels' }),
    });
    const memo = JSON.parse(createResponse.body);

    // Create labels and get their IDs
    const label1Response = await app.inject({
      method: 'POST',
      url: '/api/labels',
      payload: { name: 'important' },
    });
    const label1 = JSON.parse(label1Response.body);

    const label2Response = await app.inject({
      method: 'POST',
      url: '/api/labels',
      payload: { name: 'work' },
    });
    const label2 = JSON.parse(label2Response.body);

    // Assign labels to memo (one at a time)
    await app.inject({
      method: 'POST',
      url: `/api/issues/${memo.id}/labels`,
      payload: { labelId: label1.id },
    });
    await app.inject({
      method: 'POST',
      url: `/api/issues/${memo.id}/labels`,
      payload: { labelId: label2.id },
    });

    // Get memo with labels
    const response = await app.inject({
      method: 'GET',
      url: `/api/memos/${memo.id}`,
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.ok(Array.isArray(result.labels));
    assert.strictEqual(result.labels.length, 2);
    assert.ok(result.labels.includes('important'));
    assert.ok(result.labels.includes('work'));
  });

  it('should return memo without labels (empty array) - T017', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Memo without labels' }),
    });
    const memo = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/memos/${memo.id}`,
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.ok(Array.isArray(result.labels));
    assert.strictEqual(result.labels.length, 0);
  });
});

describe('Memo Promote Operation', () => {
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

  it('should promote memo to task (POST /api/memos/:id/promote)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Memo to promote' }),
    });
    const memo = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/promote`,
      payload: { title: 'Promoted Task', status: 'next' },
    });

    assert.strictEqual(response.statusCode, 200);
    const task = JSON.parse(response.body);
    assert.strictEqual(task.type, 'task');
    assert.strictEqual(task.title, 'Promoted Task');
    assert.strictEqual(task.status, 'next');
    assert.strictEqual(task.bodyMd, 'Memo to promote');
  });

  it('should return 400 when promoting without title', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });
    const memo = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/promote`,
      payload: {},
    });

    assert.strictEqual(response.statusCode, 400);
  });

  it('should return 404 when promoting non-existent memo', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/memos/99999/promote',
      payload: { title: 'Test' },
    });

    assert.strictEqual(response.statusCode, 404);
  });

  it('should override body, kind, schedule, and isAllDay when provided', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Original memo body' }),
    });
    const memo = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/promote`,
      payload: {
        title: 'Promoted with overrides',
        status: 'scheduled',
        bodyMd: 'Edited body',
        taskKind: 'event',
        scheduledStart: '2026-05-01T10:00:00',
        scheduledEnd: '2026-05-01T11:00:00',
        isAllDay: true,
      },
    });

    assert.strictEqual(response.statusCode, 200);
    const task = JSON.parse(response.body);
    assert.strictEqual(task.bodyMd, 'Edited body');
    assert.strictEqual(task.taskKind, 'event');
    assert.strictEqual(task.scheduledStart, '2026-05-01T10:00:00');
    assert.strictEqual(task.scheduledEnd, '2026-05-01T11:00:00');
    assert.strictEqual(task.isAllDay, true);
  });

  it('should accept done and canceled status values', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Past work' }),
    });
    const memo = JSON.parse(createResponse.body);

    for (const status of ['done', 'canceled'] as const) {
      const response = await app.inject({
        method: 'POST',
        url: `/api/memos/${memo.id}/promote`,
        payload: { title: `Task ${status}`, status },
      });
      assert.strictEqual(response.statusCode, 200);
      const task = JSON.parse(response.body);
      assert.strictEqual(task.status, status);
    }
  });

  it('should carry over memo labels to the promoted task', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Labelled memo' }),
    });
    const memo = JSON.parse(createResponse.body);

    for (const name of ['urgent', 'review']) {
      const labelResponse = await app.inject({
        method: 'POST',
        url: '/api/labels',
        payload: { name },
      });
      const label = JSON.parse(labelResponse.body);
      const assignResponse = await app.inject({
        method: 'POST',
        url: `/api/issues/${memo.id}/labels`,
        payload: { labelId: label.id },
      });
      assert.strictEqual(assignResponse.statusCode, 200);
    }

    const response = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/promote`,
      payload: { title: 'Promoted with labels' },
    });

    assert.strictEqual(response.statusCode, 200);
    const task = JSON.parse(response.body);
    assert.ok(Array.isArray(task.labels));
    const labelNames = new Set(task.labels);
    assert.ok(labelNames.has('urgent'));
    assert.ok(labelNames.has('review'));
  });

  it('should inline memo comments into the promoted task body', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Discussion memo' }),
    });
    const memo = JSON.parse(createResponse.body);

    await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/comments`,
      payload: { bodyMd: 'first thought' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/comments`,
      payload: { bodyMd: 'second thought' },
    });

    const promoteResponse = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/promote`,
      payload: { title: 'Promoted with comments' },
    });
    assert.strictEqual(promoteResponse.statusCode, 200);
    const task = JSON.parse(promoteResponse.body);

    assert.ok(task.bodyMd.includes('Discussion memo'));
    assert.ok(task.bodyMd.includes('## コメント'));
    assert.ok(task.bodyMd.includes('first thought'));
    assert.ok(task.bodyMd.includes('second thought'));
  });

  it('should use caller-supplied bodyMd verbatim (clients fetch preview, edit, and submit)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Memo body original' }),
    });
    const memo = JSON.parse(createResponse.body);

    await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/comments`,
      payload: { bodyMd: 'important discussion' },
    });

    const promoteResponse = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/promote`,
      payload: { title: 'Promoted with edited body', bodyMd: 'Memo body edited by user' },
    });
    assert.strictEqual(promoteResponse.statusCode, 200);
    const task = JSON.parse(promoteResponse.body);

    assert.strictEqual(task.bodyMd, 'Memo body edited by user');
  });

  it('should copy outgoing and incoming links to the promoted task', async () => {
    const otherResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Other memo' }),
    });
    const other = JSON.parse(otherResponse.body);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Source memo' }),
    });
    const memo = JSON.parse(createResponse.body);

    await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: { sourceIssueId: memo.id, targetIssueId: other.id, linkType: 'relates' },
    });

    const promoteResponse = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/promote`,
      payload: { title: 'Promoted with link' },
    });
    assert.strictEqual(promoteResponse.statusCode, 200);
    const task = JSON.parse(promoteResponse.body);

    const linksResponse = await app.inject({
      method: 'GET',
      url: `/api/issues/${task.id}/links`,
    });
    const links = JSON.parse(linksResponse.body);
    const relates = links.filter((l: { linkType: string }) => l.linkType === 'relates');
    const targetIds = relates.map((l: { targetIssue: { id: number } }) => l.targetIssue.id);
    assert.ok(targetIds.includes(other.id), `expected task to link to other memo; got ${JSON.stringify(links)}`);
  });

  it('should carry over memo project memberships to the promoted task', async () => {
    const projectResponse = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Carry Project' },
    });
    const project = JSON.parse(projectResponse.body);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Project memo' }),
    });
    const memo = JSON.parse(createResponse.body);

    await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/items`,
      payload: { issueId: memo.id },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/promote`,
      payload: { title: 'Promoted with project' },
    });

    assert.strictEqual(response.statusCode, 200);
    const task = JSON.parse(response.body);

    const projectsResponse = await app.inject({
      method: 'GET',
      url: `/api/issues/${task.id}/projects`,
    });
    const projects = JSON.parse(projectsResponse.body);
    assert.ok(Array.isArray(projects));
    const projectIds = projects.map((p: { id: number }) => p.id);
    assert.ok(projectIds.includes(project.id));
  });
});

describe('Memo Promote Preview Operation', () => {
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

  it('should return memo body with comments inlined (GET /api/memos/:id/promote-preview)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Preview memo body' }),
    });
    const memo = JSON.parse(createResponse.body);

    await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/comments`,
      payload: { bodyMd: 'thought A' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/comments`,
      payload: { bodyMd: 'thought B' },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/memos/${memo.id}/promote-preview`,
    });

    assert.strictEqual(response.statusCode, 200);
    const preview = JSON.parse(response.body);
    assert.ok(preview.bodyMd.includes('Preview memo body'));
    assert.ok(preview.bodyMd.includes('## コメント'));
    assert.ok(preview.bodyMd.includes('thought A'));
    assert.ok(preview.bodyMd.includes('thought B'));
  });

  it('should return just memo body when there are no comments', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Lonely memo' }),
    });
    const memo = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/memos/${memo.id}/promote-preview`,
    });

    assert.strictEqual(response.statusCode, 200);
    const preview = JSON.parse(response.body);
    assert.strictEqual(preview.bodyMd, 'Lonely memo');
  });

  it('should return 404 for a non-existent memo', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/memos/99999/promote-preview',
    });
    assert.strictEqual(response.statusCode, 404);
  });

  it('should produce a body that matches what POST /promote generates when bodyMd is omitted', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Roundtrip memo' }),
    });
    const memo = JSON.parse(createResponse.body);

    await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/comments`,
      payload: { bodyMd: 'shared comment' },
    });

    const previewResponse = await app.inject({
      method: 'GET',
      url: `/api/memos/${memo.id}/promote-preview`,
    });
    const preview = JSON.parse(previewResponse.body);

    const promoteResponse = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/promote`,
      payload: { title: 'Roundtrip' },
    });
    const task = JSON.parse(promoteResponse.body);

    assert.strictEqual(task.bodyMd, preview.bodyMd);
  });
});

describe('Memo Bookmark Operations', () => {
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

  it('should bookmark a memo (POST /api/memos/:id/bookmark)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });
    const memo = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/bookmark`,
    });

    assert.strictEqual(response.statusCode, 200);
    const bookmarked = JSON.parse(response.body);
    assert.strictEqual(bookmarked.isBookmarked, true);
    assert.strictEqual(bookmarked.id, memo.id);
  });

  it('should unbookmark a memo (POST /api/memos/:id/unbookmark)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture(),
    });
    const memo = JSON.parse(createResponse.body);

    // First bookmark it
    await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/bookmark`,
    });

    // Then unbookmark
    const response = await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/unbookmark`,
    });

    assert.strictEqual(response.statusCode, 200);
    const unbookmarked = JSON.parse(response.body);
    assert.strictEqual(unbookmarked.isBookmarked, false);
  });

  it('should return 404 when bookmarking non-existent memo', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/memos/99999/bookmark',
    });

    assert.strictEqual(response.statusCode, 404);
  });

  it('should return 404 when unbookmarking non-existent memo', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/memos/99999/unbookmark',
    });

    assert.strictEqual(response.statusCode, 404);
  });

  it('should list memos ordered by created_at DESC (not updated_at)', async () => {
    // Create 3 memos with small delays to ensure distinct timestamps
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'First memo' }),
    });
    const memo1 = JSON.parse(res1.body);
    await sleep(50);

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Second memo' }),
    });
    const memo2 = JSON.parse(res2.body);
    await sleep(50);

    const res3 = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Third memo' }),
    });
    const memo3 = JSON.parse(res3.body);
    await sleep(50);

    // Update the first memo so its updated_at becomes the newest
    await app.inject({
      method: 'PATCH',
      url: `/api/memos/${memo1.id}`,
      payload: { bodyMd: 'First memo updated' },
    });

    // List memos - should be ordered by created_at DESC: memo3, memo2, memo1
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/memos',
    });
    assert.strictEqual(listResponse.statusCode, 200);
    const result = JSON.parse(listResponse.body);
    assert.strictEqual(result.data.length, 3);
    assert.strictEqual(result.data[0].id, memo3.id, 'Most recently created memo should be first');
    assert.strictEqual(result.data[1].id, memo2.id, 'Second created memo should be second');
    assert.strictEqual(result.data[2].id, memo1.id, 'First created memo should be last despite being updated most recently');
  });

  it('should include commentCount field in GET /api/memos response', async () => {
    // Create memo with 2 comments
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Memo with comments' }),
    });
    assert.strictEqual(createResponse.statusCode, 201);
    const memo = JSON.parse(createResponse.body);

    await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/comments`,
      payload: { bodyMd: 'First comment' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/comments`,
      payload: { bodyMd: 'Second comment' },
    });

    // List memos and verify commentCount
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/memos',
    });
    assert.strictEqual(listResponse.statusCode, 200);
    const result = JSON.parse(listResponse.body);
    const foundMemo = result.data.find((m: any) => m.id === memo.id);
    assert.ok(foundMemo);
    assert.strictEqual(foundMemo.commentCount, 2);

    // Create memo with 0 comments
    const createResponse2 = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Memo without comments' }),
    });
    assert.strictEqual(createResponse2.statusCode, 201);

    // List memos again and verify zero count
    const listResponse2 = await app.inject({
      method: 'GET',
      url: '/api/memos',
    });
    const result2 = JSON.parse(listResponse2.body);
    const memo2 = result2.data.find((m: any) => m.bodyMd === 'Memo without comments');
    assert.ok(memo2);
    assert.strictEqual(memo2.commentCount, 0);
  });
});

describe('Memo Project Filter', () => {
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

  it('should filter memos by single projectId', async () => {
    // Create two memos
    const res1 = await app.inject({ method: 'POST', url: '/api/memos', payload: { bodyMd: 'Memo in project' } });
    const memo1 = JSON.parse(res1.body);
    await app.inject({ method: 'POST', url: '/api/memos', payload: { bodyMd: 'Memo without project' } });

    // Create a project
    const projectRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Filter Test Project', viewMeta: { viewType: 'board', columns: ['To Do', 'Done'] } },
    });
    const project = JSON.parse(projectRes.body);

    // Add memo1 to the project
    await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/items`,
      payload: { issueId: memo1.id },
    });

    // Filter by projectId
    const response = await app.inject({
      method: 'GET',
      url: `/api/memos?projectId=${project.id}`,
    });
    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.data[0].id, memo1.id);
  });

  it('should filter memos by projectId=none', async () => {
    // Create two memos
    const res1 = await app.inject({ method: 'POST', url: '/api/memos', payload: { bodyMd: 'Memo in project' } });
    const memo1 = JSON.parse(res1.body);
    const res2 = await app.inject({ method: 'POST', url: '/api/memos', payload: { bodyMd: 'Memo without project' } });
    const memo2 = JSON.parse(res2.body);

    // Create a project and add memo1
    const projectRes = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'None Filter Project', viewMeta: { viewType: 'board', columns: ['To Do', 'Done'] } },
    });
    const project = JSON.parse(projectRes.body);
    await app.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/items`,
      payload: { issueId: memo1.id },
    });

    // Filter by projectId=none
    const response = await app.inject({
      method: 'GET',
      url: '/api/memos?projectId=none',
    });
    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.ok(result.data.some((m: any) => m.id === memo2.id), 'should include unassigned memo');
    assert.ok(!result.data.some((m: any) => m.id === memo1.id), 'should not include assigned memo');
  });

  it('should filter memos by combined projectId and none', async () => {
    // Create three memos
    const res1 = await app.inject({ method: 'POST', url: '/api/memos', payload: { bodyMd: 'Memo in project A' } });
    const memo1 = JSON.parse(res1.body);
    const res2 = await app.inject({ method: 'POST', url: '/api/memos', payload: { bodyMd: 'Memo in project B' } });
    const memo2 = JSON.parse(res2.body);
    const res3 = await app.inject({ method: 'POST', url: '/api/memos', payload: { bodyMd: 'Memo unassigned' } });
    const memo3 = JSON.parse(res3.body);

    // Create two projects
    const projResA = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Project A', viewMeta: { viewType: 'board', columns: ['To Do', 'Done'] } },
    });
    const projectA = JSON.parse(projResA.body);
    const projResB = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Project B', viewMeta: { viewType: 'board', columns: ['To Do', 'Done'] } },
    });
    const projectB = JSON.parse(projResB.body);

    // Assign memos to projects
    await app.inject({ method: 'POST', url: `/api/projects/${projectA.id}/items`, payload: { issueId: memo1.id } });
    await app.inject({ method: 'POST', url: `/api/projects/${projectB.id}/items`, payload: { issueId: memo2.id } });

    // Filter by none + projectA: should return memo1 (in A) and memo3 (unassigned), not memo2 (in B)
    const response = await app.inject({
      method: 'GET',
      url: `/api/memos?projectId=none,${projectA.id}`,
    });
    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    const ids = result.data.map((m: any) => m.id);
    assert.ok(ids.includes(memo1.id), 'should include memo in project A');
    assert.ok(ids.includes(memo3.id), 'should include unassigned memo');
    assert.ok(!ids.includes(memo2.id), 'should not include memo in project B');
  });
});

describe('Memo Date Filtering', () => {
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

  it('should filter memos by createdFrom', async () => {
    const memo1 = createMemo(app.db, { bodyMd: 'Old memo' });
    const memo2 = createMemo(app.db, { bodyMd: 'New memo' });

    app.db.prepare('UPDATE issues SET created_at = ? WHERE id = ?').run('2024-06-15T10:00:00Z', memo1.id);
    app.db.prepare('UPDATE issues SET created_at = ? WHERE id = ?').run('2025-03-20T10:00:00Z', memo2.id);

    const response = await app.inject({
      method: 'GET',
      url: '/api/memos?createdFrom=2025-01-01',
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.data[0].bodyMd, 'New memo');
  });

  it('should filter memos by createdTo', async () => {
    const memo1 = createMemo(app.db, { bodyMd: 'Old memo' });
    const memo2 = createMemo(app.db, { bodyMd: 'New memo' });

    app.db.prepare('UPDATE issues SET created_at = ? WHERE id = ?').run('2024-06-15T10:00:00Z', memo1.id);
    app.db.prepare('UPDATE issues SET created_at = ? WHERE id = ?').run('2025-03-20T10:00:00Z', memo2.id);

    const response = await app.inject({
      method: 'GET',
      url: '/api/memos?createdTo=2024-12-31',
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.data[0].bodyMd, 'Old memo');
  });

  it('should filter memos by createdFrom and createdTo combined', async () => {
    const memo1 = createMemo(app.db, { bodyMd: 'Memo 2024' });
    const memo2 = createMemo(app.db, { bodyMd: 'Memo Jan 2025' });
    const memo3 = createMemo(app.db, { bodyMd: 'Memo Jul 2025' });

    app.db.prepare('UPDATE issues SET created_at = ? WHERE id = ?').run('2024-06-15T10:00:00Z', memo1.id);
    app.db.prepare('UPDATE issues SET created_at = ? WHERE id = ?').run('2025-01-10T10:00:00Z', memo2.id);
    app.db.prepare('UPDATE issues SET created_at = ? WHERE id = ?').run('2025-07-20T10:00:00Z', memo3.id);

    const response = await app.inject({
      method: 'GET',
      url: '/api/memos?createdFrom=2025-01-01&createdTo=2025-06-30',
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.data[0].bodyMd, 'Memo Jan 2025');
  });

  it('should filter memos by local date when UTC date differs (timezone boundary)', async () => {
    // Memo created at UTC 23:22 on April 6 = JST 08:22 on April 7
    const memo = createMemo(app.db, { bodyMd: 'Late night UTC memo' });
    app.db.prepare('UPDATE issues SET created_at = ? WHERE id = ?').run('2025-04-06T23:22:12.345Z', memo.id);

    // Filtering by local date April 7 (JST) should match
    const response1 = await app.inject({
      method: 'GET',
      url: '/api/memos?createdFrom=2025-04-07&createdTo=2025-04-07',
    });
    const result1 = JSON.parse(response1.body);
    assert.strictEqual(result1.data.length, 1, 'Should match local date April 7');

    // Filtering by UTC date April 6 should NOT match (local date is April 7)
    const response2 = await app.inject({
      method: 'GET',
      url: '/api/memos?createdFrom=2025-04-06&createdTo=2025-04-06',
    });
    const result2 = JSON.parse(response2.body);
    assert.strictEqual(result2.data.length, 0, 'Should not match UTC date April 6');
  });

  it('should reject invalid createdFrom format', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/memos?createdFrom=not-a-date',
    });

    assert.strictEqual(response.statusCode, 400);
  });

  it('should reject invalid createdTo format', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/memos?createdTo=2025/01/01',
    });

    assert.strictEqual(response.statusCode, 400);
  });

  it('should return all memos when no date filter is applied', async () => {
    createMemo(app.db, { bodyMd: 'Memo A' });
    createMemo(app.db, { bodyMd: 'Memo B' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/memos',
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.strictEqual(result.data.length, 2);
  });

  it('should reject invalid createdFrom format', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/memos?createdFrom=not-a-date',
    });

    assert.strictEqual(response.statusCode, 400);
  });

  it('should reject invalid createdTo format', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/memos?createdTo=2025/01/01',
    });

    assert.strictEqual(response.statusCode, 400);
  });

  it('should return correct total count with date filter', async () => {
    const memo1 = createMemo(app.db, { bodyMd: 'Old' });
    const memo2 = createMemo(app.db, { bodyMd: 'New 1' });
    const memo3 = createMemo(app.db, { bodyMd: 'New 2' });

    app.db.prepare('UPDATE issues SET created_at = ? WHERE id = ?').run('2024-01-01T10:00:00Z', memo1.id);
    app.db.prepare('UPDATE issues SET created_at = ? WHERE id = ?').run('2025-06-01T10:00:00Z', memo2.id);
    app.db.prepare('UPDATE issues SET created_at = ? WHERE id = ?').run('2025-06-15T10:00:00Z', memo3.id);

    const response = await app.inject({
      method: 'GET',
      url: '/api/memos?createdFrom=2025-01-01',
    });

    assert.strictEqual(response.statusCode, 200);
    const result = JSON.parse(response.body);
    assert.strictEqual(result.data.length, 2);
    assert.strictEqual(result.total, 2);
  });
});
