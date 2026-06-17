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

  it('should include memo labels in preview', async () => {
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
      await app.inject({
        method: 'POST',
        url: `/api/issues/${memo.id}/labels`,
        payload: { labelId: label.id },
      });
    }

    const response = await app.inject({
      method: 'GET',
      url: `/api/memos/${memo.id}/promote-preview`,
    });

    assert.strictEqual(response.statusCode, 200);
    const preview = JSON.parse(response.body);
    assert.ok(Array.isArray(preview.labels));
    assert.ok(preview.labels.includes('urgent'));
    assert.ok(preview.labels.includes('review'));
  });

  it('should include memo project memberships in preview', async () => {
    const projectResponse = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Preview Project' },
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
      method: 'GET',
      url: `/api/memos/${memo.id}/promote-preview`,
    });

    assert.strictEqual(response.statusCode, 200);
    const preview = JSON.parse(response.body);
    assert.ok(Array.isArray(preview.projectIds));
    assert.ok(preview.projectIds.includes(project.id));
  });

  it('should include outgoing and incoming links with target issue info', async () => {
    const otherResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Other memo body' }),
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

    const response = await app.inject({
      method: 'GET',
      url: `/api/memos/${memo.id}/promote-preview`,
    });

    assert.strictEqual(response.statusCode, 200);
    const preview = JSON.parse(response.body);
    assert.ok(Array.isArray(preview.linkedIssues));
    assert.strictEqual(preview.linkedIssues.length, 1);
    const link = preview.linkedIssues[0];
    assert.strictEqual(link.direction, 'outgoing');
    assert.strictEqual(link.linkType, 'relates');
    assert.strictEqual(link.targetIssue.id, other.id);
    assert.strictEqual(link.targetIssue.type, 'memo');
    assert.ok(link.targetIssue.title.length > 0);
  });

  it('should return empty arrays when memo has no labels, projects, or links', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: createMemoFixture({ bodyMd: 'Bare memo' }),
    });
    const memo = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/memos/${memo.id}/promote-preview`,
    });

    assert.strictEqual(response.statusCode, 200);
    const preview = JSON.parse(response.body);
    assert.deepStrictEqual(preview.labels, []);
    assert.deepStrictEqual(preview.projectIds, []);
    assert.deepStrictEqual(preview.linkedIssues, []);
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

describe('Memo Idempotent Create (clientId)', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  // Valid ULID (Crockford Base32, 26 chars)
  const validClientId = '01HMBS6YZK0F1V8N1JKZ8R3MP4';

  beforeEach(async () => {
    const testServer = await createTestServer();
    app = testServer.app;
    cleanup = testServer.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should create memo with a client-supplied ULID and return 201', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { bodyMd: 'first capture from the train', clientId: validClientId },
    });

    assert.strictEqual(response.statusCode, 201);
    const memo = JSON.parse(response.body);
    assert.strictEqual(memo.bodyMd, 'first capture from the train');
    assert.ok(memo.id);
  });

  it('should return the existing memo with status 200 on retry with the same clientId', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { bodyMd: 'offline memo', clientId: validClientId },
    });
    assert.strictEqual(first.statusCode, 201);
    const original = JSON.parse(first.body);

    const retry = await app.inject({
      method: 'POST',
      url: '/api/memos',
      // Body is intentionally different to prove the server returns the
      // ORIGINAL row, not whatever the retry payload happens to carry.
      payload: { bodyMd: 'this body should be ignored', clientId: validClientId },
    });

    assert.strictEqual(retry.statusCode, 200);
    const reread = JSON.parse(retry.body);
    assert.strictEqual(reread.id, original.id);
    assert.strictEqual(reread.bodyMd, 'offline memo');

    // And the list should still show exactly one memo.
    const list = await app.inject({ method: 'GET', url: '/api/memos' });
    const result = JSON.parse(list.body);
    assert.strictEqual(result.total, 1);
  });

  it('should reject a clientId that is not a valid ULID', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { bodyMd: 'bad client id', clientId: 'not-a-ulid' },
    });

    assert.strictEqual(response.statusCode, 400);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'VALIDATION_ERROR');
  });

  it('should still auto-generate id when no clientId is supplied (backwards compat)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { bodyMd: 'no client id' },
    });

    assert.strictEqual(response.statusCode, 201);
    const memo = JSON.parse(response.body);
    assert.ok(memo.id);
    assert.strictEqual(memo.bodyMd, 'no client id');
  });

  it('should accept different clientIds as distinct memos', async () => {
    const idA = '01HMBS6YZK0F1V8N1JKZ8R3MPA';
    const idB = '01HMBS6YZK0F1V8N1JKZ8R3MPB';

    const a = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { bodyMd: 'memo A', clientId: idA },
    });
    const b = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { bodyMd: 'memo B', clientId: idB },
    });

    assert.strictEqual(a.statusCode, 201);
    assert.strictEqual(b.statusCode, 201);
    const memoA = JSON.parse(a.body);
    const memoB = JSON.parse(b.body);
    assert.notStrictEqual(memoA.id, memoB.id);
  });
});

describe('Memo Create with projectIds', () => {
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

  const createProject = async (name: string): Promise<number> => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name, viewMeta: { viewType: 'board', columns: ['To Do', 'Done'] } },
    });
    return JSON.parse(res.body).id;
  };

  it('should link memo to specified projects on fresh create', async () => {
    const projectA = await createProject('Inbox A');
    const projectB = await createProject('Inbox B');

    const create = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { bodyMd: 'multi-project memo', projectIds: [projectA, projectB] },
    });
    assert.strictEqual(create.statusCode, 201);
    const memo = JSON.parse(create.body);

    const listA = await app.inject({ method: 'GET', url: `/api/memos?projectId=${projectA}` });
    assert.ok(JSON.parse(listA.body).data.some((m: any) => m.id === memo.id));
    const listB = await app.inject({ method: 'GET', url: `/api/memos?projectId=${projectB}` });
    assert.ok(JSON.parse(listB.body).data.some((m: any) => m.id === memo.id));
  });

  it('should not duplicate links on idempotent retry with the same projectIds', async () => {
    const clientId = '01HMBS6YZK0F1V8N1JKZ8R3M01';
    const project = await createProject('Retry Inbox');

    const first = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { bodyMd: 'retry memo', clientId, projectIds: [project] },
    });
    assert.strictEqual(first.statusCode, 201);
    const memo = JSON.parse(first.body);

    const retry = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { bodyMd: 'ignored body', clientId, projectIds: [project] },
    });
    assert.strictEqual(retry.statusCode, 200);

    const listed = await app.inject({ method: 'GET', url: `/api/memos?projectId=${project}` });
    const matched = JSON.parse(listed.body).data.filter((m: any) => m.id === memo.id);
    assert.strictEqual(matched.length, 1);
  });

  it('should merge in missing links on retry with a superset of projectIds', async () => {
    const clientId = '01HMBS6YZK0F1V8N1JKZ8R3M02';
    const projectA = await createProject('First Inbox');
    const projectB = await createProject('Added Inbox');

    const first = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { bodyMd: 'evolving memo', clientId, projectIds: [projectA] },
    });
    assert.strictEqual(first.statusCode, 201);
    const memo = JSON.parse(first.body);

    const retry = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { bodyMd: 'evolving memo', clientId, projectIds: [projectA, projectB] },
    });
    assert.strictEqual(retry.statusCode, 200);

    const listA = await app.inject({ method: 'GET', url: `/api/memos?projectId=${projectA}` });
    const listB = await app.inject({ method: 'GET', url: `/api/memos?projectId=${projectB}` });
    assert.ok(JSON.parse(listA.body).data.some((m: any) => m.id === memo.id));
    assert.ok(JSON.parse(listB.body).data.some((m: any) => m.id === memo.id));
  });

  it('should return 404 when a projectId does not exist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { bodyMd: 'bad project', projectIds: [99999] },
    });
    assert.strictEqual(response.statusCode, 404);
    const error = JSON.parse(response.body);
    assert.strictEqual(error.code, 'NOT_FOUND');
  });

  it('should accept empty projectIds array as a no-op', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { bodyMd: 'no projects', projectIds: [] },
    });
    assert.strictEqual(response.statusCode, 201);
  });
});
