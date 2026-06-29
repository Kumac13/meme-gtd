import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import type { FastifyInstance } from 'fastify';
import { createTestServer } from '../helpers/testServer.js';
import { createTaskFixture, createMemoFixture } from '../helpers/fixtures.js';

type ServerHandle = { app: FastifyInstance; cleanup: () => Promise<void> };

async function createMemo(app: FastifyInstance, bodyMd: string): Promise<{ id: number; bodyMd: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/memos',
    payload: createMemoFixture({ bodyMd }),
  });
  assert.strictEqual(res.statusCode, 201, `memo create failed: ${res.body}`);
  return JSON.parse(res.body);
}

async function createTask(app: FastifyInstance, title: string, bodyMd: string): Promise<{ id: number; bodyMd: string | null }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    payload: createTaskFixture({ title, bodyMd }),
  });
  assert.strictEqual(res.statusCode, 201, `task create failed: ${res.body}`);
  return JSON.parse(res.body);
}

async function getLinks(app: FastifyInstance, issueId: number): Promise<Array<{ linkType: string; direction: 'outgoing' | 'incoming'; targetIssue?: { id: number } }>> {
  const res = await app.inject({ method: 'GET', url: `/api/issues/${issueId}/links` });
  assert.strictEqual(res.statusCode, 200, `list links failed: ${res.body}`);
  return JSON.parse(res.body);
}

describe('Issue mention auto-link', () => {
  let s: ServerHandle;
  beforeEach(async () => {
    s = await createTestServer();
  });
  afterEach(async () => {
    await s.cleanup();
  });

  it('rewrites #id in memo body and creates a relates link', async () => {
    const target = await createTask(s.app, 'Target', 'body');
    const memo = await createMemo(s.app, `see #${target.id} for context`);

    assert.strictEqual(memo.bodyMd, `see [#${target.id}](/tasks/${target.id}) for context`);

    const sourceLinks = await getLinks(s.app, memo.id);
    const relates = sourceLinks.filter((l) => l.linkType === 'relates');
    assert.strictEqual(relates.length, 1, 'expected exactly one relates link on source');
    assert.strictEqual(relates[0].direction, 'outgoing');
    assert.strictEqual(relates[0].targetIssue?.id, target.id);

    const targetLinks = await getLinks(s.app, target.id);
    const inbound = targetLinks.filter((l) => l.linkType === 'relates' && l.direction === 'incoming');
    assert.strictEqual(inbound.length, 1, 'target should see incoming link');
  });

  it('leaves unknown #id untouched and creates no link', async () => {
    const memo = await createMemo(s.app, 'mention #9999');
    assert.strictEqual(memo.bodyMd, 'mention #9999');
    const links = await getLinks(s.app, memo.id);
    assert.strictEqual(links.length, 0);
  });

  it('leaves escaped \\#id unchanged', async () => {
    const target = await createTask(s.app, 'Target', 'body');
    const memo = await createMemo(s.app, `keep \\#${target.id} literal`);
    assert.strictEqual(memo.bodyMd, `keep \\#${target.id} literal`);
    const links = await getLinks(s.app, memo.id);
    assert.strictEqual(links.length, 0);
  });

  it('drops self-reference', async () => {
    // Create a memo first, then update it to reference itself.
    const memo = await createMemo(s.app, 'initial');
    const patch = await s.app.inject({
      method: 'PATCH',
      url: `/api/memos/${memo.id}`,
      payload: { bodyMd: `self #${memo.id}` },
    });
    assert.strictEqual(patch.statusCode, 200, `patch failed: ${patch.body}`);
    const body = JSON.parse(patch.body).bodyMd as string;
    assert.strictEqual(body, `self #${memo.id}`);
    const links = await getLinks(s.app, memo.id);
    assert.strictEqual(links.length, 0);
  });

  it('dedupes link rows when the same id is referenced multiple times', async () => {
    const target = await createTask(s.app, 'Target', 'body');
    const memo = await createMemo(
      s.app,
      `triple #${target.id} and #${target.id} again #${target.id}`
    );
    const link = `[#${target.id}](/tasks/${target.id})`;
    assert.strictEqual(memo.bodyMd, `triple ${link} and ${link} again ${link}`);
    const relates = (await getLinks(s.app, memo.id)).filter((l) => l.linkType === 'relates');
    assert.strictEqual(relates.length, 1);
  });

  it('adds a link on PATCH and keeps it on subsequent removal', async () => {
    const target = await createTask(s.app, 'Target', 'body');
    const memo = await createMemo(s.app, 'no mention yet');

    // Add mention via PATCH
    const addRes = await s.app.inject({
      method: 'PATCH',
      url: `/api/memos/${memo.id}`,
      payload: { bodyMd: `now references #${target.id}` },
    });
    assert.strictEqual(addRes.statusCode, 200);
    assert.strictEqual(
      JSON.parse(addRes.body).bodyMd,
      `now references [#${target.id}](/tasks/${target.id})`
    );
    let relates = (await getLinks(s.app, memo.id)).filter((l) => l.linkType === 'relates');
    assert.strictEqual(relates.length, 1);

    // Remove mention via PATCH — link should remain (GitHub-style)
    const removeRes = await s.app.inject({
      method: 'PATCH',
      url: `/api/memos/${memo.id}`,
      payload: { bodyMd: 'mention removed' },
    });
    assert.strictEqual(removeRes.statusCode, 200);
    assert.strictEqual(JSON.parse(removeRes.body).bodyMd, 'mention removed');
    relates = (await getLinks(s.app, memo.id)).filter((l) => l.linkType === 'relates');
    assert.strictEqual(relates.length, 1, 'link should persist after mention removal');
  });

  it('rewrites mentions inside a comment and links to the parent issue', async () => {
    const target = await createTask(s.app, 'Target', 'body');
    const memo = await createMemo(s.app, 'parent');
    const res = await s.app.inject({
      method: 'POST',
      url: `/api/memos/${memo.id}/comments`,
      payload: { bodyMd: `also see #${target.id}` },
    });
    assert.strictEqual(res.statusCode, 201, res.body);
    const comment = JSON.parse(res.body);
    assert.strictEqual(comment.bodyMd, `also see [#${target.id}](/tasks/${target.id})`);

    const links = (await getLinks(s.app, memo.id)).filter((l) => l.linkType === 'relates');
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].targetIssue?.id, target.id);
  });

  it('does not create an inverse relates link when one already exists in the other direction', async () => {
    // A mentions B → outgoing relates A→B is created.
    const b = await createTask(s.app, 'B', 'body');
    const a = await createMemo(s.app, `points to #${b.id}`);

    // Now B mentions A — without dedup this would create B→A, doubling the row.
    const patch = await s.app.inject({
      method: 'PATCH',
      url: `/api/tasks/${b.id}`,
      payload: { bodyMd: `back ref #${a.id}` },
    });
    assert.strictEqual(patch.statusCode, 200, patch.body);

    // Both sides should see exactly one relates link representing the same relationship.
    const aLinks = (await getLinks(s.app, a.id)).filter((l) => l.linkType === 'relates');
    const bLinks = (await getLinks(s.app, b.id)).filter((l) => l.linkType === 'relates');
    assert.strictEqual(aLinks.length, 1, 'A should still see exactly one relates link');
    assert.strictEqual(bLinks.length, 1, 'B should still see exactly one relates link');
  });

  it('rewrites task body to a memo URL when the mentioned id is a memo', async () => {
    const targetMemo = await createMemo(s.app, 'target memo');
    const task = await createTask(s.app, 'caller', `relates to #${targetMemo.id}`);
    assert.strictEqual(
      task.bodyMd,
      `relates to [#${targetMemo.id}](/memos/${targetMemo.id})`
    );
    const links = (await getLinks(s.app, task.id)).filter((l) => l.linkType === 'relates');
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].targetIssue?.id, targetMemo.id);
  });
});
